# Implementation status

WysiwygKit 0.1.0 is an **early preview**, not a completed stable-release claim. The PRDs remain in progress wherever manual/platform acceptance or planned integration work is outstanding.

## Implemented

- One shared editor engine for Markdown, sanitized publishing HTML and Fountain; plain-web and React APIs.
- SwiftUI components for macOS/iOS/iPadOS and a C# WPF control, both embedding the same committed offline engine.
- Separate plain-web, React, macOS, iOS and Windows demos.
- Rich-text commands, images/alt text, tables and row/column operations, history, read-only state and a shared command palette.
- Fountain block types, forced-type import/export, emphasis, title fields, notes/boneyards, scene numbers and dual markers. Unchanged source lines are preserved; edited lines normalize. No exact print pagination/side-by-side dual layout.
- English, Swedish and Arabic UI catalogs; independent UI/content direction; Unicode and mixed-script source; supported HTML language/direction attributes.
- Document identity/revision/save acknowledgement, atomic snapshots with source-bound metadata, stable image placements and per-placement non-destructive focus; manual focal cover preview.
- Local image storage or async host upload/resolution callbacks on all library surfaces. A bounded presigned PUT helper is available; finalization belongs to the host.
- Literal find/replace across inline marks, grapheme boundaries, safe link/paste actions, derived outline/count APIs and an opt-in bounded web recovery demo.
- Automated tests, versioned native resource manifests, dependency notices, npm/NuGet packaging and CI jobs for web, Apple and Windows.

## Verified locally — 2026-11-16

| Check | Evidence |
| --- | --- |
| Format/type/package build | TypeScript typecheck and core/React/native bundle builds pass |
| Unit/integration regressions | 24 tests pass: format round trips, metadata, history, URLs, read-only, Unicode, revisions and asynchronous ownership |
| Browser behavior | 30 tests pass across Chromium 159, Firefox 159 and WebKit 27.2 |
| Visual regression | Six macOS per-browser light-Markdown/dark-Fountain baselines inspected; three visual tests pass against them |
| Swift runtime | Three Swift tests pass, including actual WKWebView edit/export, revision guards and Fountain source preservation |
| Apple demos | macOS executable builds; iOS simulator SDK build passes for arm64/x86_64 |
| Windows | WPF library, demo and native smoke test compile on macOS; local NuGet pack succeeds. The real Windows WebView2 smoke test also passed in GitHub CI |
| Installable web packages | Core/React npm tarballs install together in an isolated consumer; both packages import successfully |
| Resource/spec checks | Bundled checksums match; specification structure and local links pass |

Local environment: macOS 26 arm64, Node 25.2.1, TypeScript 6.0.3, Swift 6.3.3, .NET SDK 11.0.100 targeting .NET 8 WPF. Tool versions are locked in package-lock/NuGet configuration. Current-SDK builds do not establish minimum-OS runtime compatibility.

## Outstanding acceptance work

- Native-language review of Swedish/Arabic catalogs; manual VoiceOver/Narrator, actual native IME/touch and minimum-OS/device validation.
- Exhaustive unsupported-syntax diagnostics and format conformance beyond the committed corpus. Keep originals and inspect normalization diagnostics when evaluating new document classes.
- Per-block/inline language sidecars for plain Markdown/Fountain. Root document language/direction and HTML metadata are supported; unsupported block-language mutations fail explicitly.
- Responsive/publishing rendition resolution, private-delivery policy and tested real-provider S3 finalization/imgproxy conformance. Current callbacks and crop model are the integration foundation, not a provider certification.
- Reproducible performance baselines on representative large articles/screenplays and durable host-native recovery examples.
- The optional Go service/containers remain conditional under PRD-0005. No Go backend artifact, registry publication or production deployment is claimed.

The first GitHub CI run passed both Apple verification and the real Windows WebView2 smoke gate. Its web installation exposed two omitted cross-platform optional dependencies in the npm lockfile; they were repaired without changing existing dependency versions. Linux WebKit then identified an invalid CRC in the original inline PNG test image; the test now uses a checksum-valid shared binary fixture. Visual baselines intentionally run through a separate command and are not silently compared across different OS/font environments.
