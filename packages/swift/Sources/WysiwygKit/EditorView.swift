import SwiftUI
import WebKit
#if os(macOS)
public struct EditorView: NSViewRepresentable {
    @ObservedObject public var controller: EditorController
    public init(controller: EditorController) { self.controller = controller }
    public func makeNSView(context: Context) -> WKWebView { controller.makeWebView() }
    public func updateNSView(_ nsView: WKWebView, context: Context) {}
}
#else
public struct EditorView: UIViewRepresentable {
    @ObservedObject public var controller: EditorController
    public init(controller: EditorController) { self.controller = controller }
    public func makeUIView(context: Context) -> WKWebView { controller.makeWebView() }
    public func updateUIView(_ uiView: WKWebView, context: Context) {}
}
#endif
