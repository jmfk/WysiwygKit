---
id: PRD-0002
title: Editing contract and first public release
status: in-progress
locked: true
created: 2026-11-16
related_adrs: [ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0010, ADR-0011, ADR-0012, ADR-0013]
---

# Editing contract and first public release

## Relationship to the original request

This document refines [PRD-0001](0001-cross-platform-editors.md), whose started requirements remain unchanged. It defines the detailed acceptance contract before editor implementation begins. Requirements below are proposed elaborations of the request, not evidence of user approval or shipped functionality. The selected implementation architecture is recorded separately in ADRs.

The request is for permissively licensed open source libraries providing consistent WYSIWYG editing of Markdown, publishing HTML and Fountain, with automated tests, regression suites and separate demos. Swift and web/React are primary consumers; C# on Windows is also included in the planned release. The working project name is **WysiwygKit**. Developer-facing project language is English. The default UI is English; localized runtime UI and multilingual content are specified by [PRD-0003](0003-internationalization-and-content-languages.md).

## Follow-up scope and release boundary

The follow-up request adds UI/content languages and reading directions, focal-point image integrations, object storage, image servers and possible Go backend artifacts. Detailed requirements and priority are separated into:

- [PRD-0003](0003-internationalization-and-content-languages.md): first-core-release localization, Unicode and direction foundations.
- [PRD-0004](0004-media-and-image-integrations.md): first-core-release portable media/metadata contract; focal UI and storage/image-server adapters in the first optional integration milestone.
- [PRD-0005](0005-optional-go-media-companion.md): conditional later Go companion, standalone binaries and OCI images after a real integration gap is demonstrated.
- [PRD-0006](0006-editor-productivity-and-scope.md): first-core-release find/replace, link/paste and host save/recovery contracts; outline/counts in a next increment.

These supplement the first release where explicitly marked. Optional integration and companion acceptance criteria do not block offline core editing. No implementation or infrastructure is created by accepting these planning documents.

## Problem and intended outcome

Applications currently need to integrate different editors for each platform and document format. Their toolbars, supported formatting, serialization and edge cases diverge. A developer should be able to choose a format, embed an editor, provide content and receive edits through a small host API, without recreating editing behavior or a theme on every platform.

Success means a developer can clone the public repository, run an appropriate demo and integrate each library using documented examples. Features declared supported must work across every adapter marked supported for that release.

## Users and core journeys

| User | Journey | Observable result |
| --- | --- | --- |
| App developer | Embed an editor, load a document, subscribe to changes, save and reopen | Content and supported structure survive; no backend is required |
| Content author | Edit a Markdown article with an image and table | WYSIWYG edits export as supported Markdown |
| Web publisher | Paste or import an HTML body, edit it and export | Supported structure remains editable; unsafe markup is removed with diagnostics |
| Screenwriter | Import a Fountain screenplay and edit scenes, action and dialogue | Block meaning, emphasis and retained screenplay metadata survive export |
| Integrator | Change theme, read-only state and toolbar visibility | The editor updates through the public API without replacing the document |
| Maintainer | Reproduce a reported bug using a fixture | A focused regression protects the behavior on supported adapters |

## Product scope

### Libraries and platforms

| Surface | Planned deliverable | Acceptance requirement |
| --- | --- | --- |
| Plain web | Framework-independent TypeScript/JavaScript library | Mount, update, command, export and destroy without React |
| React | React component and typed integration API | Safe mount/unmount, Strict Mode behavior and no change-feedback loops |
| Apple | Swift package with SwiftUI component for macOS, iOS and iPadOS | Bundle the engine locally; expose a typed document/event API |
| Windows | C# WPF library using WebView2 | Typed asynchronous API, packaged engine and documented runtime prerequisite |
| Other web frameworks | Plain-web integration recipe | No framework-specific wrapper is required for the first release |

The first release uses the same editor engine inside platform containers. Fully native NSTextView, UIKit text-system or RichEdit implementations are outside this release. WPF is the initial Windows surface; WinUI, WinForms and MAUI adapters are future work.

### Format capability contract

The matrix describes the required first-release subset. It is not a promise of complete CommonMark, GFM, arbitrary HTML or every screenwriting application's extensions. Each row must map to conformance fixtures before the corresponding feature is marked supported.

| Capability | Markdown | Publishing HTML | Fountain |
| --- | --- | --- | --- |
| Paragraphs, line breaks and Unicode | Required | Required | Required; intentional screenplay line breaks retained |
| Bold and italic | Required | Required | Required |
| Underline | Outside the portable Markdown subset | Required | Required, using Fountain underscore semantics |
| Strikethrough, inline code, fenced code | Required | Required | Not applicable |
| Headings H1–H6, blockquotes and thematic breaks | Required | Required | Use screenplay elements instead |
| Ordered, unordered, nested and task lists | Required | Required | Not applicable |
| Links | Required | Required | Preserve literal source; no invented Fountain link syntax |
| Images and alt text | Required | Required | Not a Fountain feature |
| Tables with header cells | Required | Required | Not a Fountain feature |
| Add/delete table rows and columns | Required | Required | Not applicable |
| Merged cells | Outside portable Markdown tables | Required for HTML | Not applicable |
| Scene headings and optional scene numbers | Not applicable | Not applicable | Required |
| Action, character, dialogue and parentheticals | Not applicable | Not applicable | Required, including forced element syntax |
| Transitions, centered text and lyrics | Not applicable | Not applicable | Required |
| Title-page fields and indented continuations | Not applicable | Not applicable | Required, including unknown title-page keys |
| Sections, synopses, notes and boneyards | Not applicable | Not applicable | Required; retained as authoring content |
| Dual dialogue | Not applicable | Not applicable | Retain markers and associations; side-by-side layout deferred |
| Explicit page breaks | Not applicable | Not applicable | Retain markers; exact print pagination deferred |

Unsupported constructs must produce an actionable diagnostic before a lossy replacement is committed. The host may choose explicit normalization or keep the original source. A source document containing unsupported syntax must not silently become an apparently successful lossy edit. Security removals are always enforced and reported; accepting normalization cannot enable unsafe markup.

## Functional requirements

### FR-01: Document lifecycle

- Create an empty document in any supported format.
- Load a complete document, edit it and export it in its original format.
- Provide a read-only state that prevents keyboard, paste, drop, toolbar and programmatic mutation commands while still allowing selection and export. Explicit host document replacement remains available.
- Expose a dirty state; a host save acknowledgement names the atomically saved source/optional-sidecar revision. Acknowledging an older revision never marks newer edits clean.
- Loading a new document resets history and establishes a new document identity. Saving does not reset history.
- Destroying an editor releases listeners, native message handlers and owned resources. Multiple independent instances must work on one screen.

### FR-02: Editing and history

- Provide selection-aware formatting commands, undo/redo and accurate command availability/active state.
- Group user edits meaningfully; undo of typing, table operations, paste and image insertion must not corrupt the document.
- Respect platform modifier keys and input composition. Handle Unicode, emoji, diacritics and mixed-direction text without damaging source content.
- Preserve supported rich content on paste; sanitize imported HTML and links before using it.
- Show composition-sensitive behavior in the compatibility evidence; browser automation alone is not proof of IME correctness.

### FR-03: Import, export and fidelity

- Treat Markdown, HTML and Fountain as distinct authoring formats with explicit capabilities.
- Report normalized, removed and unsupported constructs using stable diagnostic codes and human-readable messages. Do not include document excerpts in console logs by default.
- Define fidelity as supported semantic structure and text surviving load → edit → export → reload, with documented normalization. Promise byte preservation only for explicitly tested source-preservation paths.
- Same-format no-op imports and exports must not drop Fountain notes, boneyards, title metadata, scene numbers or dual-dialogue markers.
- Export publishing HTML as a sanitized body fragment. Do not promise preservation of full HTML pages, scripts, embedded applications, arbitrary CSS or email layouts.
- Do not automatically convert a document when a host changes the format. A new format requires an explicit load; cross-format conversion is a separate future capability.
- A WYSIWYG/source view switch, if exposed, belongs to one document and must retain pending text and selection as practicable. Invalid or unsupported source must not be silently committed over the last supported document.

### FR-04: Images and tables

- Insert an image through a host-supplied asset handler or an explicitly supplied allowed URL; edit alt text and remove it with undo.
- A host-supplied file picker uses the platform picker. No upload service is required by or included in the core. Optional storage adapters and a gated standalone companion are specified separately in PRD-0004/0005.
- While an asset resolves, show a nonblocking insertion state. Failure leaves the document recoverable and offers retry or removal. A late completion must not insert into a different document or a destroyed editor.
- Supply documented schemes and a host policy for external images and links. No remote assets are fetched merely to start the editor.
- Markdown tables export as portable pipe tables; HTML may retain supported cell spans. Do not offer format-incompatible table commands.

### FR-05: Screenplay authoring

- Provide visible commands to select screenplay block type and retain Fountain's forced-type semantics.
- Enter behavior follows the current block: character → dialogue; parenthetical → dialogue; leaving a dialogue passage can produce action without requiring raw source editing.
- Render screenplay typography and indentation consistently using the shared theme.
- Keep notes, boneyards, sections and synopses distinguishable in the authoring view. Do not mistake their visibility during editing for inclusion in a future print renderer.
- Do not interpret Markdown underscore rules as Fountain underline rules or vice versa.

### FR-06: UI, accessibility and integration

- Use neutral chrome, content-led layout, semantic theme tokens and a shared command catalog. Localize runtime controls independently from content language/direction as specified in PRD-0003.
- Support Light, Dark and System modes. Follow System by default; expose theme configuration to hosts.
- Provide keyboard access, visible focus, screen-reader names, pressed/disabled command state and usable touch targets.
- Provide a searchable command palette with Command-K / Control-K. Commands expose their shortcuts; macOS demos also register applicable commands in the menu bar.
- Allow hosts to hide the supplied toolbar and use the same command catalog from their own interface.
- Respect text scaling, browser zoom and Reduce Motion. Toolbars must wrap or adapt at narrow widths without covering content.
- Distinguish loading, ready, read-only and error states. Errors appear inline and preserve recoverable content.

### FR-07: Public API and platform bridge

- Expose typed initialization options, format and theme enums, document load/export, command dispatch, change/status/diagnostic events and disposal.
- Use document identity and monotonically increasing revisions so hosts can reject stale saves and native responses.
- A change event reports a revision and format, with documented content-export behavior. Selection changes do not emit document-change events.
- Host-driven loads do not echo as user edits. React updates must not reset selection or undo history on every rerender.
- Native readiness, failure and timeouts are explicit. Calls before readiness either await initialization or fail with a typed error; they never disappear silently.
- Include engine and bridge protocol versions so mismatched native assets fail clearly.
- Expose the optional versioned source-sidecar and atomic snapshot contract from ADR-0010. It carries portable metadata without exposing the internal editor AST.
- Include the first-release find/replace, safe link/paste and host save/recovery behavior from PRD-0006.

### FR-08: Demos

- Keep plain-web, React, Swift and Windows demos in separate `demos/` directories, outside library sources.
- Each demo offers Markdown, HTML and Fountain sample documents, editing, export, theme selection, read-only mode and visible error handling.
- Demonstrate image insertion and table editing for rich formats and block-type selection for Fountain.
- Include English run instructions, platform prerequisites and a compact integration example per demo.
- Samples are original or compatibly licensed. Demos require no account, credential or application backend. Network access is optional only for explicitly chosen external assets.

## Nonfunctional requirements

- **Privacy:** no telemetry, cloud dependency or document transmission by default. Hosts own persistence and uploaded assets.
- **Security:** document input is untrusted across imports, paste, drop, links, image URLs and native messages. Document content never receives native filesystem, process or arbitrary host-call access.
- **Consistency:** shared semantics, commands and theme tokens define parity; platform font rasterization, system pickers and native navigation may differ.
- **Performance:** collect load, typing and export measurements on committed representative fixtures and recorded hardware/runtime versions. Proposed first-release targets on the recorded desktop baseline are p95 key-to-paint below 50 ms in a 25,000-word article and a 120-page-equivalent screenplay, and initial interactive load within 2 seconds. Treat these as measured release criteria, not existing guarantees. Document larger-document behavior rather than claiming unlimited size.
- **Dependencies:** no paid editor extensions or proprietary service requirement. Inventory transitive licenses before distribution.
- **Compatibility:** publish an exact tested browser/OS/runtime matrix per release. Initial browser targets are Chromium, Firefox and WebKit; native OS minimums and SDK/runtime versions must be selected and recorded before a native adapter is declared supported.

## Verification and regression contract

| Layer | Required evidence |
| --- | --- |
| Format units | Positive, malformed, escaping, Unicode and canonicalization fixtures for each supported syntax |
| Round trips | Same-format semantic equality; protected Fountain metadata; stable repeated normalization |
| Editor integration | Selection formatting, tables, assets, history, read-only state and document replacement |
| Security | Script/event-handler removal, unsafe URL rejection, hostile paste, bridge origin/message validation and navigation escape prevention |
| Browser end to end | Real typing, keyboard commands, clipboard where supported, export/reload, lifecycle and multiple instances |
| React | Strict Mode, remount cleanup, rerenders, callbacks and externally loaded content |
| Native | Swift and C# builds, bundled-resource checks, bridge integration and real WKWebView/WebView2 smoke runs |
| Visual | Fixed fixtures and pinned environment; separate baselines per browser/platform for light/dark, rich text, tables, images and screenplay layout |
| Accessibility | Automated checks plus manual keyboard and VoiceOver/Narrator evidence for each supported native surface |
| Performance | Reproducible fixture benchmark and recorded baseline; guard only against meaningful measured regression |

A bug fix that changes editing or serialization behavior adds a focused regression. Snapshot updates require an explained intentional visual change, rather than blindly accepting output. Reuse passing evidence for unchanged code and avoid repeated broad suites during iteration.

## Release acceptance

- **AC-01:** Public GitHub repository contains MIT license, third-party notices, contribution/security guidance and accurate English documentation.
- **AC-02:** All four library surfaces expose the documented lifecycle for all three formats.
- **AC-03:** The matrix's required rich-format and screenplay features pass conformance and round-trip fixtures.
- **AC-04:** Separate demos run from the documented instructions and demonstrate their claimed features.
- **AC-05:** Shared tests and relevant native build/smoke gates pass for the exact release commit; unavailable platform execution is reported as unverified.
- **AC-06:** Supported browser/OS matrix, format limitations, sanitization rules and native runtime prerequisites are published.
- **AC-07:** Distributed native assets match the source engine version and include upstream notices.
- **AC-08:** Tagged, reproducible release artifacts and checksums are available. Registry publication is claimed only after packages actually exist and can be installed.
- **AC-09:** First-release internationalization and input criteria in PRD-0003 pass across supported adapters, with honest translation/manual verification status.
- **AC-10:** PRD-0004's core metadata contract and PRD-0006's first-release productivity/save requirements pass. Optional integrations and companion artifacts remain separately gated.

## Delivery sequence

1. **Shared contract and vertical slice:** implement web load/edit/export for each format, history and a minimal demo; lock fixtures before adding adapters.
2. **Rich editing and screenplay completeness:** add matrix features, diagnostics, source preservation, themes, accessibility and focused regressions.
3. **Web integration:** complete the public core API, React adapter and separate web demos.
4. **Apple integration:** Swift package, local assets, macOS/iOS demos and platform verification.
5. **Windows integration:** WPF package, WebView2 bridge, demo and Windows verification.
6. **Public release:** reconcile capabilities, run one coherent release gate, publish the public repository and tag tested artifacts. npm/NuGet publication requires separately available registry ownership/credentials.

A milestone is complete only when its demonstrable journey and evidence pass. The overall request is not complete after only a web prototype or placeholder platform adapters.

## Non-goals for the first release

Real-time collaboration/CRDT infrastructure; accounts; mandatory asset-hosting services (optional integrations are specified separately); AI editing; arbitrary plugin execution; a website page builder; pixel-perfect HTML/CSS preservation; email-template editing; PDF/Final Draft import/export; print pagination; revision tracking; production scheduling; automatic cross-format conversion; registry-name ownership before publication.

## Risks and decisions to validate

| Risk | Mitigation or required evidence |
| --- | --- |
| WebView behavior differs from native expectations | Prototype keyboard focus, IME, scrolling, accessibility and asset pickers on actual native surfaces |
| Markdown extension support differs from the proposed subset | Test dependency behavior against our corpus; document gaps before declaring support |
| Fountain normalization damages authorial intent | Preserve source metadata and intentional line breaks; require same-format regression fixtures |
| Engine packages or bundled files drift | Derive all native assets from one locked build and validate their manifest |
| Browser tests miss native bridge or accessibility faults | Require platform-specific smoke and assistive-technology checks |
| First-release scope grows without evidence | Complete the listed journeys; defer speculative adapters and services |

## Implementation Notes

- 2026-11-16: Implementation is available as an early preview. See [implementation status](../../docs/status.md) for working surfaces, verification evidence and outstanding acceptance work. Requirements remain locked; no stable-release completion is claimed.

- 2026-11-16: Detailed contract drafted. Existing files are scaffolding and specifications; working editors, demos and release evidence are not yet available.
- 2026-11-16: Draft refined for PRD-0003–0006; English development language is retained while runtime localization, media metadata and explicit optional-service boundaries are added.

## Linked ADRs

- [ADR-0002: Product-neutral monorepo and MIT licensing](../adrs/active/0002-monorepo-and-licensing.md)
- [ADR-0003: Shared engine and platform adapters](../adrs/active/0003-shared-engine-and-adapters.md)
- [ADR-0004: Format fidelity and document ownership](../adrs/active/0004-format-fidelity.md)
- [ADR-0005: Public API and native bridge](../adrs/active/0005-api-and-native-bridge.md)
- [ADR-0006: Shared UI and accessibility](../adrs/active/0006-shared-ui-and-accessibility.md)
- [ADR-0007: Offline assets and untrusted content](../adrs/active/0007-assets-and-security.md)
- [ADR-0008: Verification, packaging and releases](../adrs/active/0008-verification-and-releases.md)

- [ADR-0009: Locales and direction](../adrs/active/0009-locales-and-text-direction.md)
- [ADR-0010: Portable source/media metadata](../adrs/active/0010-portable-media-metadata.md)
- [ADR-0011: Storage and delivery](../adrs/active/0011-storage-and-image-delivery.md)
- [ADR-0012: Optional Go companion](../adrs/active/0012-optional-go-companion.md)
- [ADR-0013: Scope and recovery](../adrs/active/0013-scope-and-host-owned-recovery.md)

## Completion Evidence

Documentation only. No implementation or release acceptance criterion has been marked complete.
