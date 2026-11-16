import SwiftUI
import WysiwygKit
@main struct EditorDemo: App {
    var body: some Scene { WindowGroup { WritingView() } }
}
struct WritingView: View {
    @StateObject private var editor=EditorController(document:.init(format:.markdown,source:"# WysiwygKit\n\nWrite **Markdown**, HTML and Fountain.\n\nمرحبا · Hej · こんにちは"))
    @State private var format:DocumentFormat = .markdown
    @State private var configuration=EditorConfiguration()
    @State private var output=""
    @State private var error=""
    var body: some View {
        VStack(alignment:.leading,spacing:8) {
            HStack {
                Picker("Format",selection:$format) { ForEach(DocumentFormat.allCases,id:\.self){Text($0.rawValue).tag($0)} }
                Picker("UI language",selection:$configuration.locale) { Text("English").tag("en");Text("Svenska").tag("sv");Text("العربية").tag("ar") }
                Button("Export") { Task { do {let snapshot=try await editor.snapshot();output=snapshot.source;try await editor.markSaved(snapshot)} catch {self.error=error.localizedDescription} } }
            }.padding(.horizontal)
            HStack { Picker("Theme",selection:$configuration.theme) { ForEach(EditorTheme.allCases,id:\.self){Text($0.rawValue).tag($0)} }; Toggle("Read only",isOn:$configuration.readOnly) }.padding(.horizontal)
            if let failure=editor.failure { Text(failure).foregroundStyle(.red) }
            if !error.isEmpty { Text(error).foregroundStyle(.red) }
            EditorView(controller:editor)
            DisclosureGroup("Source") { ScrollView {Text(output).font(.system(.body,design:.monospaced)).textSelection(.enabled)}.frame(maxHeight:180) }.padding(.horizontal)
        }
        .onChange(of:format) {value in Task {do{try await editor.load(.init(format:value,source:value == .fountain ? "Title: BEGIN\n\nINT. ROOM - DAY\n\nALEX\nHello.\n" : value == .html ? "<h1>Publish</h1><p>Edit HTML.</p>" : "# Write\n\nEdit **Markdown**."))}catch{self.error=error.localizedDescription}}}
        .onChange(of:configuration.locale){_ in configure()}.onChange(of:configuration.theme){_ in configure()}.onChange(of:configuration.readOnly){_ in configure()}
    }
    func configure(){Task{do{try await editor.configure(configuration)}catch{self.error=error.localizedDescription}}}
}
