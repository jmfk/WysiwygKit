# WysiwygKit

A shared Markdown, publishing HTML and Fountain editor engine, with plain web, React, SwiftUI and Windows WPF libraries. MIT licensed. Editing requires no account or backend.

**Status: early preview, not a stable release.** See [implementation status](docs/status.md) for verified behavior and remaining acceptance gates. The specifications describe the intended release, not a claim that every item is complete. Swedish and Arabic UI catalogs are drafts awaiting language/accessibility review.

## Repository layout

| Directory | Purpose |
| --- | --- |
| `packages/core` | Framework-independent TypeScript editor, commands, codecs, themes and metadata |
| `packages/react` | React component using the same engine |
| `packages/swift` | SwiftUI + WKWebView integration for macOS/iOS |
| `packages/windows` | C# WPF + WebView2 integration |
| `packages/native` | Shared offline bridge entry, bundled into both native libraries |
| `demos/web`, `demos/react`, `demos/swift`, `demos/windows` | Separate runnable integration demos |
| `tests` | Format, security, lifecycle, browser and regression tests |
| `specs` | PRDs, ADRs, planned integrations and scope |

## Run the web demos

Requires Node 22.12+ and npm. The development port is 13700.

```sh
npm ci
npm run dev
```

Open [plain web](http://localhost:13700/demos/web/) or [React](http://localhost:13700/demos/react/). Both demos load all three formats, switch theme/UI locale/read-only state, insert images and tables in rich formats and export portable snapshots. Local demo image insertion uses a bounded data URI; it does not upload files.

## Plain web

After `npm run build`, consume the local `packages/core` package or install its `npm pack` tarball. Registry names are source package names until separately published.

```ts
import { createEditor } from '@wysiwygkit/core'
import '@wysiwygkit/core/style.css'

const editor = createEditor(document.getElementById('editor')!, {
  document: { id: 'article-1', format: 'markdown', source: '# Hello\n\nWrite here.' },
  theme: 'system',
  locale: 'en',
  onChange(state) { /* schedule a host save using state.documentId and revision */ },
})
await editor.ready
const snapshot = await editor.getSnapshot()
// Persist source and metadata together. Only acknowledge the successfully saved revision.
editor.markSaved(snapshot.revision, snapshot.id)
// When the containing screen unmounts:
editor.dispose()
```

## React

```tsx
import { Wysiwyg } from '@wysiwygkit/react'
import '@wysiwygkit/core/style.css'

<Wysiwyg
  document={{ id: 'article-1', format: 'markdown', source: '# Hello' }}
  locale="en"
  theme="system"
  onReady={editor => { /* retain a host handle for export/commands */ }}
  onChange={state => { /* persist via an atomic snapshot */ }}
/>
```

Changing a document ID loads a new document. Same-ID source echoes do not reset selection/history. Use `loadDocument` explicitly for a same-ID external replacement. React Strict Mode mount cleanup is supported.

## SwiftUI

The root `Package.swift` exposes the `WysiwygKit` product (macOS 13+, iOS/iPadOS 16+). Add this repository through Swift Package Manager or use a local path. Native consumers use bundled assets and do not need Node.

```swift
import SwiftUI
import WysiwygKit

struct WritingScreen: View {
    @StateObject private var editor = EditorController(
        document: .init(format: .markdown, source: "# Hello")
    )
    var body: some View { EditorView(controller: editor) }
    // After mounting: try await editor.snapshot()
    // Explicitly dispose the controller when its owning screen/session ends.
}
```

Run the macOS demo with `swift run --package-path demos/swift`. See [Apple demo instructions](demos/swift/README.md) for iOS and integration checks.

## Windows WPF

Requires Windows, .NET 8 and the Microsoft Edge WebView2 Runtime. The library contains the engine as embedded resources. A Mac can cross-build it with Windows targeting enabled, which is not evidence of Windows runtime behavior.

```csharp
using WysiwygKit;
var editor = new EditorControl(new EditorDocument(
    Guid.NewGuid().ToString(), DocumentFormat.markdown, "# Hello"));
host.Content = editor;
var snapshot = await editor.SnapshotAsync();
// Persist before calling MarkSavedAsync. Dispose on the WPF Dispatcher thread.
```

Run `dotnet run --project demos/windows` on Windows. See [Windows demo](demos/windows/README.md).

## Commands and host API

- Await `ready` before using a new web instance. Native async methods wait for initialization and report timeouts.
- `loadDocument(input, { acceptNormalization: true })` explicitly accepts reported unsupported/unsafe HTML normalization. The default rejects it and retains the previous document.
- `execute(id, argument)` dispatches the shared command catalog; `commandState(id)` exposes availability/active state. The toolbar and Command-K / Control-K palette use the same IDs.
- `getSnapshot()` captures source, format, identity, revision and a source-bound metadata sidecar. `getSource()` is plain-source export and reports metadata omission.
- `configure` changes presentation/read-only state. `setContentLanguage` changes authored language/direction independently of UI locale.
- Hosts supply `uploadImage`, `resolveAsset`, `onOpenLink`, `onAutosave` and persistence. The core has no telemetry or default persistent document store.

## Format boundaries

Markdown uses a tested CommonMark/GFM-inspired subset including headings, emphasis, lists, tasks, code, images and pipe tables. HTML is a sanitized editable body fragment, not a website layout designer. Fountain uses screenplay blocks and its own emphasis rules; images/tables are intentionally unavailable. No automatic cross-format conversion is performed.

Fountain source preservation protects unchanged lines including notes, boneyards, forced elements, title fields, scene numbers and dual-dialogue markers. Editing normalizes the affected line. Exact print pagination and side-by-side dual dialogue are not included.

Image focus is non-destructive metadata on an image placement. Image display URLs are not durable identity. Imported remote images are not fetched by default; enable host-approved remote previews explicitly. Unsupported arbitrary HTML/Markdown may normalize; consult diagnostics and keep the original input until accepting a load.

## Build and verify

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:browser
swift test
swift build --package-path demos/swift
# On Windows, or as a cross-build with Windows targeting:
dotnet build demos/windows
```

`npm run build` builds source packages and regenerates the committed offline native engine and dependency notices. The manifest records engine/protocol versions and SHA-256 asset checksums. All native consumers embed this same build. Do not edit generated engine resources manually.

## Scope and contribution

[Specs overview](specs/index.md) describes localization, portable media metadata and optional focal/storage/image-server integrations. The optional Go companion is a conditional future milestone; no backend binaries or containers are advertised as existing.

Read [CONTRIBUTING](CONTRIBUTING.md) and [SECURITY](SECURITY.md). File a focused regression for editing/serialization bugs. Keep product credentials, customer data and deployment infrastructure outside this neutral library. Original code is [MIT](LICENSE); bundled dependencies retain their own notices.
