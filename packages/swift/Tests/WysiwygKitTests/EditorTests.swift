import XCTest
@testable import WysiwygKit
#if os(macOS)
import AppKit
#endif
final class EditorTests: XCTestCase {
    func testDocumentAndMetadataAreEncodedAsData() throws {
        let source="</script>\"\\\n日本語 مرحبًا 👨‍👩‍👧‍👦"
        let original=EditorDocument(id:"one",format:.fountain,source:source,metadata:JSONValue(.object(["schemaVersion":JSONValue(.number(1))])))
        let data=try JSONEncoder().encode(original)
        XCTAssertEqual(try JSONDecoder().decode(EditorDocument.self,from:data),original)
    }
    @MainActor func testBundledResourcesExist() throws {
        let entry=try XCTUnwrap(EditorController.bundledEditorURL)
        XCTAssertTrue(FileManager.default.fileExists(atPath:entry.path))
        let manifest=entry.deletingLastPathComponent().appendingPathComponent("manifest.json")
        let json=try JSONSerialization.jsonObject(with:Data(contentsOf:manifest)) as! [String:Any]
        XCTAssertEqual(json["engineVersion"] as? String,"0.1.0")
        XCTAssertEqual(json["protocolVersion"] as? Int,1)
    }
    @MainActor func testActualWebViewRoundTripAndRevisionGuard() async throws {
        #if os(macOS)
        _ = NSApplication.shared
        #endif
        let controller=EditorController(document:.init(id:"native",format:.markdown,source:"# Native\n\nHello **world**."))
        let view=controller.makeWebView()
        #if os(macOS)
        let window=NSWindow(contentRect:NSRect(x:0,y:0,width:800,height:600),styleMask:[.titled],backing:.buffered,defer:false)
        window.contentView=view
        #endif
        defer {controller.dispose()}
        let initial=try await controller.snapshot()
        XCTAssertTrue(initial.source.contains("# Native"))
        XCTAssertNotNil(initial.metadata)
        _ = try await controller.command(.replaceAll,argument:JSONValue(.object(["text":.init(.string("Hello")),"replacement":.init(.string("Hej"))])))
        let changed=try await controller.snapshot();XCTAssertTrue(changed.source.contains("Hej"));XCTAssertGreaterThan(changed.revision,initial.revision)
        do { _ = try await controller.command(.bold,documentId:"different"); XCTFail("Stale document should fail") } catch { XCTAssertTrue(error.localizedDescription.contains("STALE_DOCUMENT")) }
        try await controller.markSaved(initial)
        let fountain=EditorDocument(id:"script",format:.fountain,source:"Title: Test\n\nINT. ROOM - DAY\n\nALEX\nHello.\n\n[[Keep me]]\n")
        try await controller.load(fountain);let reloaded=try await controller.snapshot();XCTAssertEqual(reloaded.source,fountain.source)
    }
}
