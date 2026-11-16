import SwiftUI
import WysiwygKit

@main
struct WysiwygDemoApp: App {
    @StateObject private var controller = EditorController(document: .init(format:.markdown,source:"# WysiwygKit\n\nA shared **Markdown**, HTML and Fountain editor.\n\n| Feature | State |\n| --- | --- |\n| Tables | Editable |\n\nمرحبا · Hej · こんにちは"))
    var body: some Scene {
        WindowGroup { DemoView(controller:controller).frame(minWidth:700,minHeight:600) }
            .commands { CommandGroup(replacing:.undoRedo) {
                Button("Undo") { run(.undo) }.keyboardShortcut("z")
                Button("Redo") { run(.redo) }.keyboardShortcut("z",modifiers:[.command,.shift])
            }; CommandMenu("Editor") {
                Button("Bold") { run(.bold) }.keyboardShortcut("b")
                Button("Italic") { run(.italic) }.keyboardShortcut("i")
                Button("Find") { run(.find) }.keyboardShortcut("f")
                Button("Insert Table") { run(.table) }
                Button("Export Snapshot") { NotificationCenter.default.post(name:.init("ExportSnapshot"),object:nil) }.keyboardShortcut("s")
            } }
    }
    private func run(_ command:EditorCommand) { Task { try? await controller.command(command) } }
}
struct DemoView: View {
    @ObservedObject var controller: EditorController
    @State private var format: DocumentFormat = .markdown
    @State private var config = EditorConfiguration()
    @State private var output = ""
    @State private var error = ""
    private let fountain = "Title: A NEW SCENE\n\nINT. ROOM - DAY\n\nA writer looks up.\n\nALEX\nLet's begin.\n\n[[Keep this note.]]\n"
    var body: some View {
        VStack(alignment:.leading,spacing:0) {
            HStack {
                Picker("Format",selection:$format) { ForEach(DocumentFormat.allCases,id:\.self) { Text($0.rawValue).tag($0) } }.frame(width:200)
                Picker("Theme",selection:$config.theme) { ForEach(EditorTheme.allCases,id:\.self) { Text($0.rawValue).tag($0) } }.frame(width:180)
                Picker("UI language",selection:$config.locale) { Text("English").tag("en");Text("Svenska").tag("sv");Text("العربية").tag("ar") }.frame(width:180)
                Toggle("Read only",isOn:$config.readOnly)
                Button("Export") { export() }
            }.padding()
            if let failure = controller.failure { Text(failure).foregroundStyle(.red).padding(.horizontal) }
            if !error.isEmpty { Text(error).foregroundStyle(.red).padding(.horizontal) }
            EditorView(controller:controller)
            DisclosureGroup("Snapshot") { TextEditor(text:$output).font(.system(.body,design:.monospaced)).frame(height:160) }.padding(.horizontal)
        }
        .onChange(of:format) { value in Task { do { try await controller.load(.init(format:value,source:value == .fountain ? fountain : value == .html ? "<h1>Publish</h1><p>Edit <strong>HTML</strong>.</p>" : "# Write\n\nEdit **Markdown**.")) } catch { self.error=error.localizedDescription } } }
        .onChange(of:config.theme) { _ in configure() }.onChange(of:config.locale) { _ in configure() }.onChange(of:config.readOnly) { _ in configure() }
        .onReceive(NotificationCenter.default.publisher(for:.init("ExportSnapshot"))) { _ in export() }
    }
    private func configure() { Task { do { try await controller.configure(config) } catch { self.error=error.localizedDescription } } }
    private func export() { Task { do { let snapshot=try await controller.snapshot(); let encoder=JSONEncoder();encoder.outputFormatting=[.prettyPrinted,.sortedKeys];output=String(decoding:try encoder.encode(snapshot),as:UTF8.self);try await controller.markSaved(snapshot) } catch { self.error=error.localizedDescription } } }
}
