---
id: ADR-0003
title: Shared editor engine and platform adapters
status: accepted
date: 2026-11-16
related_prds: [PRD-0001, PRD-0002]
supersedes: [ADR-0001]
superseded_by: []
---

# ADR-0003: Shared editor engine and platform adapters

This records the selected implementation direction. Accepted here means the current project architecture, not separate user sign-off or evidence of implemented behavior.

## Context

The central requirement is parity across web, Swift and potentially C#. Implementing independent editing engines would multiply work around selection, tables, history, composition and serialization.

## Decision

Use Tiptap/ProseMirror as the shared rich-text engine. Use its open source Markdown integration for the supported Markdown subset, table/image/list extensions and a project-owned Fountain block/codec layer. Verify dependency behavior against project fixtures rather than inferring complete conformance from package names.

Expose the engine through a framework-independent TypeScript library and a thin React adapter. Embed a local build of the same editor surface in WKWebView for SwiftUI on macOS/iOS/iPadOS and WebView2 for WPF on Windows. No remote editor page or CDN is required.

Keep editor behavior, serialization, command availability and presentation in the shared layer. Platform adapters own view lifecycle, typed messaging, platform pickers and native command integration. Do not duplicate editor logic in Swift or C#.

## Rationale

One engine gives one implementation to test for all formats and prevents platform feature drift. Existing editing machinery is preferable to implementing contenteditable, composition and history from scratch.

## Consequences

- Native packages contain an embedded web editor; documentation must state this plainly.
- Shared rendering reduces divergence but cannot guarantee identical rasterization across operating systems.
- Native focus, composition, accessibility and clipboard behavior require real platform validation.
- C# support initially means WPF, not every .NET UI framework.
- No paid Tiptap extensions or hosted services are required. Pin dependency versions and test upgrades locally.
- If the WebView prototype fails a required native capability, record a replacement ADR before creating a second editor implementation.

## Alternatives Considered

- NSTextView/UIKit + Windows RichEdit + an unrelated web engine: rejected for initial maintenance and parity cost.
- A fully custom editing engine: rejected because selection, IME and table editing are substantial correctness work.
- Swift-only or web-only delivery: insufficient for the overall requested outcome.

## Links

- [PRD-0001](../../prds/0001-cross-platform-editors.md)
- [PRD-0002](../../prds/0002-editing-contract-and-release.md)
- [Tiptap Markdown usage](https://tiptap.dev/docs/editor/markdown/getting-started/basic-usage)
- [WKWebView](https://developer.apple.com/documentation/webkit/wkwebview)
- [Microsoft WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/)
