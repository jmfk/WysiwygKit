import Foundation
import Combine
@preconcurrency import WebKit
#if os(macOS)
import AppKit
#endif

@MainActor
public final class EditorController: NSObject, ObservableObject, WKNavigationDelegate, WKScriptMessageHandler, WKUIDelegate {
    @Published public private(set) var isReady = false
    @Published public private(set) var state: EditorState?
    @Published public private(set) var diagnostic: EditorDiagnostic?
    @Published public private(set) var failure: String?
    public var onChange: ((EditorState) -> Void)?
    public var onOpenLink: ((URL) -> Void)?
    public var onDiagnostic: ((EditorDiagnostic) -> Void)?
    /// Assign before mounting. Nil uses bounded local data-URI storage.
    public var uploadImage: ((ImageUpload) async throws -> EditorAsset)?
    /// Assign before mounting. Return a temporary authorized URL without changing durable asset identity.
    public var resolveAsset: ((EditorAsset) async throws -> String)?
    private var assetTasks: [String: Task<Void, Never>] = [:]
    private let initial: EditorDocument
    private var configuration: EditorConfiguration
    private var webView: WKWebView?
    private var entryURL: URL?
    private var disposed = false
    private var pending: [UUID: CheckedContinuation<Data, any Error>] = [:]
    private var timeouts: [UUID: Task<Void, Never>] = [:]
    private var initializationTimeout: Task<Void, Never>?
    public init(document: EditorDocument, configuration: EditorConfiguration = .init()) {
        initial = document; self.configuration = configuration; super.init()
    }
    public static var bundledEditorURL: URL? { Bundle.module.url(forResource: "index", withExtension: "html", subdirectory: "editor") }
    public func makeWebView() -> WKWebView {
        if let webView { return webView }
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.userContentController.add(self, name: "wysiwyg")
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = self; view.uiDelegate = self
        webView = view
        guard !disposed else { failure = EditorFailure.disposed.localizedDescription; return view }
        guard let url = Self.bundledEditorURL else { failure = EditorFailure.missingResources.localizedDescription; return view }
        entryURL = url
        view.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        initializationTimeout = Task { [weak self] in
            try? await Task.sleep(for: .seconds(20))
            guard !Task.isCancelled, let self, !self.isReady else { return }
            self.failure = EditorFailure.timeout.localizedDescription
        }
        return view
    }
    #if os(macOS)
    public func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable ([URL]?) -> Void) {
        guard frame.isMainFrame, frame.request.url?.standardizedFileURL == entryURL?.standardizedFileURL else { completionHandler(nil); return }
        let panel=NSOpenPanel();panel.allowsMultipleSelection=false;panel.canChooseDirectories=false
        panel.begin { response in completionHandler(response == .OK ? panel.urls : nil) }
    }
    #endif
    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard !disposed else { return }
        Task { [weak self] in
            guard let self else { return }
            do {
                _ = try await self.raw("initialize", payload: ["document": try self.dictionary(self.initial), "configuration": try self.bridgeConfiguration()])
                guard !self.disposed else { return }
                self.isReady = true; self.failure = nil; self.initializationTimeout?.cancel()
            } catch { self.failure = error.localizedDescription }
        }
    }
    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) { failure = error.localizedDescription }
    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) { failure = error.localizedDescription }
    public func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { isReady = false; failure = "The editor process stopped. Restore the last host snapshot." }
    public func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url, url.standardizedFileURL == entryURL?.standardizedFileURL, navigationAction.targetFrame?.isMainFrame == true else { decisionHandler(.cancel); return }
        decisionHandler(.allow)
    }
    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard !disposed, message.frameInfo.isMainFrame, message.frameInfo.request.url?.standardizedFileURL == entryURL?.standardizedFileURL,
              let body = message.body as? [String: Any], body["protocolVersion"] as? Int == 1, let type = body["type"] as? String else { return }
        do {
            if type == "assetCancel", let id = body["assetRequestId"] as? String { assetTasks.removeValue(forKey:id)?.cancel() }
            else if type == "assetRequest", let id = body["assetRequestId"] as? String, let kind = body["kind"] as? String, let payload = body["payload"] {
                let data = try JSONSerialization.data(withJSONObject:payload)
                assetTasks[id] = Task { [weak self] in
                    guard let self else { return };defer {self.assetTasks.removeValue(forKey:id)}
                    do {
                        let result: Any
                        if kind == "upload", let handler = self.uploadImage { result = try self.dictionary(await handler(JSONDecoder().decode(ImageUpload.self,from:data))) }
                        else if kind == "resolve", let handler = self.resolveAsset { result = try await handler(JSONDecoder().decode(EditorAsset.self,from:data)) }
                        else { throw EditorFailure.bridge("ASSET_HANDLER_REQUIRED","The host asset handler is unavailable.") }
                        guard !Task.isCancelled, !self.disposed else { return }
                        _ = try await self.raw("assetResponse",payload:["assetRequestId":id,"result":result])
                    } catch {
                        guard !Task.isCancelled, !self.disposed else { return }
                        _ = try? await self.raw("assetResponse",payload:["assetRequestId":id,"error":"The host could not complete the image operation."])
                    }
                }
            }
            else if type == "change", let raw = body["state"] {
                let value = try JSONDecoder().decode(EditorState.self, from: JSONSerialization.data(withJSONObject: raw))
                state = value; onChange?(value)
            } else if type == "diagnostic", let raw = body["diagnostic"] {
                let value = try JSONDecoder().decode(EditorDiagnostic.self, from: JSONSerialization.data(withJSONObject: raw))
                diagnostic = value; onDiagnostic?(value)
            } else if type == "openLink", let raw = body["url"] as? String, let url = URL(string: raw), ["http", "https", "mailto", "tel"].contains(url.scheme?.lowercased() ?? "") { onOpenLink?(url) }
        } catch { failure = "An invalid editor event was rejected." }
    }
    private func bridgeConfiguration() throws -> [String:Any] {
        var payload = try dictionary(configuration) as! [String:Any]
        payload["useHostUpload"] = uploadImage != nil;payload["useHostResolve"] = resolveAsset != nil
        return payload
    }
    private func dictionary<T: Encodable>(_ value: T) throws -> Any { try JSONSerialization.jsonObject(with: JSONEncoder().encode(value), options: .fragmentsAllowed) }
    private func waitUntilReady() async throws {
        if disposed { throw EditorFailure.disposed }
        guard webView != nil else { throw EditorFailure.notMounted }
        let deadline = ContinuousClock.now + .seconds(20)
        while !isReady {
            if disposed { throw EditorFailure.disposed }
            if let failure { throw EditorFailure.bridge("INITIALIZATION_FAILED", failure) }
            if ContinuousClock.now >= deadline { throw EditorFailure.timeout }
            try await Task.sleep(for: .milliseconds(20))
        }
    }
    private func raw(_ operation: String, payload: [String: Any] = [:], documentId: String? = nil, revision: Int? = nil) async throws -> Data {
        guard !disposed, let webView else { throw disposed ? EditorFailure.disposed : EditorFailure.notMounted }
        let id = UUID(); var request: [String:Any] = ["protocolVersion":1,"id":id.uuidString,"operation":operation,"payload":payload]
        request["documentId"] = documentId; request["revision"] = revision
        let data: Data = try await withCheckedThrowingContinuation { continuation in
            pending[id] = continuation
            timeouts[id] = Task { [weak self] in
                try? await Task.sleep(for: .seconds(15))
                guard !Task.isCancelled, let self else { return }
                self.pending.removeValue(forKey: id)?.resume(throwing: EditorFailure.timeout)
                self.timeouts.removeValue(forKey: id)
            }
            // Structured arguments: document text is never interpolated into JavaScript source.
            webView.callAsyncJavaScript("return await window.wysiwygNative.receive(request)", arguments: ["request":request], in: nil, in: .page, completionHandler: { [weak self] result in
                guard let self, let waiter = self.pending.removeValue(forKey: id) else { return }
                self.timeouts.removeValue(forKey: id)?.cancel()
                do {
                    let value = try result.get()
                    waiter.resume(returning: try JSONSerialization.data(withJSONObject: value, options: .fragmentsAllowed))
                } catch { waiter.resume(throwing: error) }
            })
        }
        guard let response = try JSONSerialization.jsonObject(with: data) as? [String:Any], response["id"] as? String == id.uuidString, response["protocolVersion"] as? Int == 1 else { throw EditorFailure.bridge("PROTOCOL_MISMATCH", "Invalid response.") }
        if response["ok"] as? Bool != true {
            let error = response["error"] as? [String:String] ?? [:]
            throw EditorFailure.bridge(error["code"] ?? "BRIDGE_ERROR", error["message"] ?? "The operation failed.")
        }
        return try JSONSerialization.data(withJSONObject: response["result"] ?? NSNull(), options: .fragmentsAllowed)
    }
    public func snapshot() async throws -> EditorSnapshot { try await waitUntilReady(); return try JSONDecoder().decode(EditorSnapshot.self, from: await raw("snapshot")) }
    public func load(_ document: EditorDocument, acceptNormalization: Bool = false) async throws {
        try await waitUntilReady(); _ = try await raw("load", payload:["document":try dictionary(document),"acceptNormalization":acceptNormalization])
    }
    public func configure(_ configuration: EditorConfiguration) async throws {
        try await waitUntilReady(); self.configuration = configuration
        guard let payload = try dictionary(configuration) as? [String:Any] else { return }
        _ = try await raw("configure", payload:payload)
    }
    @discardableResult public func command(_ command: EditorCommand, argument: JSONValue? = nil, documentId: String? = nil, revision: Int? = nil) async throws -> Bool {
        try await waitUntilReady(); var payload:[String:Any] = ["command":command.rawValue]
        if let argument { payload["argument"] = try dictionary(argument) }
        let data = try await raw("command", payload:payload, documentId:documentId, revision:revision)
        return (try JSONSerialization.jsonObject(with:data, options:.fragmentsAllowed) as? Bool) ?? false
    }
    public func markSaved(_ snapshot: EditorSnapshot) async throws { try await waitUntilReady(); _ = try await raw("markSaved",payload:["documentId":snapshot.id,"revision":snapshot.revision]) }
    public func setContentLanguage(_ language: String?, direction: TextDirection = .auto) async throws {
        try await waitUntilReady(); var payload:[String:Any] = ["direction":direction.rawValue];payload["language"] = language
        _ = try await raw("contentLanguage",payload:payload)
    }
    public func dispose() {
        guard !disposed else { return }; disposed = true; isReady = false; initializationTimeout?.cancel()
        assetTasks.values.forEach { $0.cancel() };assetTasks.removeAll()
        timeouts.values.forEach { $0.cancel() };timeouts.removeAll()
        pending.values.forEach { $0.resume(throwing:EditorFailure.disposed) };pending.removeAll()
        webView?.evaluateJavaScript("window.wysiwygNative.receive({protocolVersion:1,id:'dispose',operation:'dispose'})", completionHandler:nil)
        webView?.isHidden = true
        webView?.configuration.userContentController.removeScriptMessageHandler(forName:"wysiwyg")
        webView?.stopLoading();webView?.navigationDelegate = nil;webView?.uiDelegate = nil;webView = nil
    }
}
