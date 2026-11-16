---
id: ADR-0001
title: Shared editor engine and native adapters
status: superseded
date: 2026-11-16
related_prds: [PRD-0001]
supersedes: []
superseded_by: [ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0008]
---

# Shared editor engine and native adapters

## Context
Independent native editor implementations diverge in selection, serialization, table support and typography. The requested priority is consistent functionality and appearance.

## Decision
Use the MIT-licensed Tiptap/ProseMirror engine with its Markdown extension, a dedicated Fountain block schema and shared DOM/CSS chrome. Expose a framework-independent TypeScript API and React component. Bundle the same compiled offline engine in WKWebView for SwiftUI and WebView2 for C# WPF. Native containers use typed JSON messages; document text is never interpolated into executable JavaScript. The repository is independent of both Bad Herring and Staravenir.

Use MIT for original code. Keep upstream notices with the bundled engine. Package names are proposed source packages until separately published to npm/NuGet; Swift Package Manager can consume this Git repository's packages/swift directory via a local checkout.

## Consequences
- One implementation and regression corpus define behavior and appearance.
- Swift and Windows are native integration libraries containing a web editor, not NSTextView/RichEdit implementations.
- No server is required for editing. Hosts own file persistence and image hosting.
- HTML is an editable, sanitized body fragment, not a page designer. Unsupported styles/elements can normalize or be removed.
- Fountain is screenplay editing, not a pagination or production scheduling tool. Dual-dialogue markers are retained; side-by-side print pagination is deferred.
- React and plain web consume the same public API; native adapters embed a committed reproducible engine asset.

## Alternatives Considered
- Separate AppKit/UIKit, Windows and web engines: rejected due to large maintenance and parity cost.
- Implementing contenteditable and history directly: rejected because composition, selection and tables need an established editing model.

## Links
- PRD-0001: ../../prds/0001-cross-platform-editors.md
- https://tiptap.dev/docs/editor/markdown/getting-started/basic-usage
- https://fountain.io/syntax/

## Supersession Notes

2026-11-16: Split into ADR-0002 through ADR-0008 to make format, API, security, UI and release decisions independently discoverable. The earlier nested Swift-package distribution note is refined by ADR-0008: a root manifest is required for direct Git URL consumption. No original implementation claim was verified.
