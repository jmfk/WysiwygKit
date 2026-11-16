import Foundation
public enum DocumentFormat: String, Codable, CaseIterable, Sendable { case markdown, html, fountain }
public enum EditorTheme: String, Codable, CaseIterable, Sendable { case system, light, dark }
public enum TextDirection: String, Codable, CaseIterable, Sendable { case auto, ltr, rtl }
public struct JSONValue: Codable, Sendable, Equatable {
    public enum Value: Sendable, Equatable { case string(String), number(Double), bool(Bool), object([String:JSONValue]), array([JSONValue]), null }
    public var value: Value
    public init(_ value: Value) { self.value = value }
    public init(from decoder: any Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { value = .null }
        else if let v = try? c.decode(Bool.self) { value = .bool(v) }
        else if let v = try? c.decode(Double.self) { value = .number(v) }
        else if let v = try? c.decode(String.self) { value = .string(v) }
        else if let v = try? c.decode([String:JSONValue].self) { value = .object(v) }
        else { value = .array(try c.decode([JSONValue].self)) }
    }
    public func encode(to encoder: any Encoder) throws {
        var c = encoder.singleValueContainer()
        switch value { case .null: try c.encodeNil(); case .bool(let v): try c.encode(v); case .number(let v): try c.encode(v); case .string(let v): try c.encode(v); case .object(let v): try c.encode(v); case .array(let v): try c.encode(v) }
    }
}
public struct EditorDocument: Codable, Sendable, Equatable {
    public var id: String
    public var format: DocumentFormat
    public var source: String
    /// Portable sidecar schema v1. Preserved verbatim; the shared engine validates its digest and mappings.
    public var metadata: JSONValue?
    public init(id: String = UUID().uuidString, format: DocumentFormat, source: String, metadata: JSONValue? = nil) {
        self.id = id; self.format = format; self.source = source; self.metadata = metadata
    }
}
public struct EditorSnapshot: Codable, Sendable {
    public let id: String
    public let format: DocumentFormat
    public let source: String
    public let revision: Int
    public let metadata: JSONValue?
    public var document: EditorDocument { EditorDocument(id: id, format: format, source: source, metadata: metadata) }
}
public struct EditorConfiguration: Codable, Sendable {
    public var theme: EditorTheme = .system
    public var locale: String = "en"
    public var readOnly: Bool = false
    public var toolbar: Bool = true
    public var uiDirection: TextDirection = .auto
    public var allowRemoteImages: Bool = false
    public init() {}
}
public struct EditorState: Codable, Sendable {
    public let documentId: String
    public let format: DocumentFormat
    public let revision: Int
    public let dirty: Bool
    public let readOnly: Bool
}
public struct EditorDiagnostic: Codable, Sendable { public let code: String; public let message: String; public let severity: String }
public enum EditorFailure: Error, LocalizedError, Sendable {
    case notMounted, disposed, timeout, missingResources, bridge(String, String)
    public var errorDescription: String? {
        switch self { case .notMounted: "Mount an EditorView before calling this operation."; case .disposed: "The editor has been disposed."; case .timeout: "The editor did not respond in time."; case .missingResources: "The bundled editor resources are missing. Build the shared engine first."; case .bridge(let code, let message): "\(code): \(message)" }
    }
}
public enum EditorCommand: String, Sendable {
    case bold, italic, underline, strike, code, heading, paragraph, bulletList, orderedList, taskList, blockquote, codeBlock, horizontalRule
    case undo, redo, link, unlink, openLink, image, imageAlt, imageFocus, table, addRow, addColumn, deleteRow, deleteColumn, deleteTable, mergeCells, splitCell
    case screenplay, find, replace, replaceAll, pastePlain, cancelUpload
}
public struct EditorAsset: Codable, Sendable {
    public let id: String
    public let version: String
    public let width: Int
    public let height: Int
    public let uri: String
    public init(id:String,version:String,width:Int,height:Int,uri:String) { self.id=id;self.version=version;self.width=width;self.height=height;self.uri=uri }
}
public struct ImageUpload: Decodable, Sendable {
    public let name: String
    public let mimeType: String
    public let dataURL: String
    public let width: Int
    public let height: Int
    public var data: Data? { dataURL.split(separator:",",maxSplits:1).last.flatMap { Data(base64Encoded:String($0)) } }
}
