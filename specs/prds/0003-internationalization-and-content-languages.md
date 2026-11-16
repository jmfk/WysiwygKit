---
id: PRD-0003
title: Internationalization and multilingual content
status: in-progress
locked: true
created: 2026-11-16
related_adrs: [ADR-0009, ADR-0010]
---

# PRD-0003: Internationalization and multilingual content

## Problem

English-only assumptions in controls, serialization, cursor handling and layout become expensive to remove after adapters ship. UI language, document language and reading direction are separate user choices. A Swedish application may edit Arabic content containing English product names.

## Goals and release scope

Include internationalization foundations in the first core release across web, React, SwiftUI and WPF. Ship English as the default UI catalog, Swedish as a second catalog and an Arabic catalog to exercise an actual RTL interface. Arabic is marked reviewed only after a competent language review; pseudolocalization is a test tool, not a shipped translation claim. If a promised catalog lacks review, report the release criterion as unmet rather than silently claiming translation quality.

Code identifiers, developer documentation, schemas, API reference and repository discussions remain English. Runtime catalogs and multilingual content samples deliberately contain other languages, as requested in the follow-up.

## Users and use cases

- A host selects Swedish UI while retaining an English document and its undo history.
- An author edits Arabic and English in the same paragraph, including punctuation, URLs, numbers and table cells.
- A Japanese author uses an IME without a formatter or save callback prematurely committing composition.
- A screenwriter uses non-Latin character names and forced Fountain character syntax.
- A host edits independently translated documents without the editor overwriting another language variant.

## Requirements

### I18N-01: Localized UI

- Resolve editor-owned labels, command search terms, tooltips, screen-reader names, errors, empty states and image controls from stable message IDs. No sentence concatenation; use named interpolation and locale-aware plural/number formatting where needed.
- Accept a host-selected BCP 47 locale and optional message overrides. Resolve exact tag → supported language fallback → English. Unsupported locale tags produce a bounded diagnostic and a usable fallback.
- Catalogs declare their UI direction. Allow a host override; do not derive document direction from the catalog. Determine fallback direction from the effective catalog unless explicitly overridden.
- Changing UI locale or direction updates labels and chrome without reloading content, changing document language, resetting selection or clearing history.
- Catalog validation catches missing keys, unused keys and interpolation mismatch. Command IDs, diagnostic codes and keyboard semantics remain stable across locales.
- Demos expose locale selection. Native menus and editor controls use the same translated command labels; hosts remain responsible for translating host-owned UI.

### I18N-02: Content language and direction

- Represent optional default content language independently from `uiLocale`, plus document direction `auto`, `ltr` or `rtl`. Allow paragraph/block overrides and inline language/direction isolation where the format can retain them.
- Use BCP 47 language tags for content metadata. Language is not sufficient evidence of direction: the same language may use different scripts, and mixed content still requires local direction control.
- Apply semantic `lang`, `dir` and supported `bdi` markup in the editor. Use logical CSS properties for chrome and content layout; do not reverse underlying text strings or reorder serialized content to simulate RTL.
- Handle mixed-direction list markers, table cells, selection, caret movement and punctuation. Code and URLs use appropriate isolation; do not mirror images, focal coordinates or literal keyboard shortcuts.
- Fountain layout uses the same logical direction model while retaining screenplay block semantics. Non-Latin character names can be explicitly forced; no ASCII-only character detection or automatic transliteration.

### I18N-03: Unicode and encoding

- Use Unicode throughout and UTF-8 for file/API source bytes. Language-specific scripts need no separate application encoding.
- Native and JavaScript strings may have different index representations. Keep edits in the shared engine; do not interpret Swift character counts or Go byte offsets as editor positions. Any exposed range explicitly declares its coordinate system and revision.
- Preserve combining marks, emoji sequences, non-BMP characters, ZWJ/ZWNJ and meaningful bidi controls. No blanket stripping of invisible characters and no implicit NFC/NFD normalization of the saved source.
- Use runtime grapheme/word segmentation where needed and document runtime Unicode-version differences. Never truncate by raw bytes or split a surrogate pair when limiting input.
- Test real composition and input methods on WKWebView and WebView2. Avoid host-triggered document replacement during active composition.
- Legacy encoding import is a host adapter responsibility: explicit encoding selection and conversion with diagnostics. Do not guess ambiguous byte encodings or silently replace undecodable input.

### I18N-04: Fidelity by format

| Format | Text/script handling | Language and direction persistence |
| --- | --- | --- |
| HTML body fragment | Supported Unicode content | Preserve supported standard attributes on blocks/spans and `bdi`; return default root attributes for the publishing host |
| Markdown | Preserve Unicode text and supported structure | Plain Markdown has no universal language/direction metadata contract; preserve extended metadata in the optional source sidecar, or diagnose its omission |
| Fountain | Preserve Unicode text, punctuation and Fountain syntax | Keep language/direction in the optional sidecar; do not invent Fountain control keywords or turn underscores into Markdown italics |

The portable metadata contract is defined by [ADR-0010](../adrs/active/0010-portable-media-metadata.md). Plain-source export remains available and explicitly reports any omitted metadata. Sanitization must preserve the supported safe language/direction attributes.

### I18N-05: Multiple content translations

The core edits one document at a time, which may contain multiple languages. Separate translated versions are separate host-owned documents. Hosts may associate them with an opaque translation-group reference and locale, but the library includes no translation database, synchronization, machine translation, translation-status workflow or automatic fallback that replaces authored content.

Alt text and captions belong to each document/image occurrence and may differ between translated documents. Never copy English alt text over an explicitly authored translation during asset refresh.

## Acceptance criteria and evidence

- **AC-I18N-01:** English, Swedish and Arabic catalogs cover the same command/message keys; review status is documented. Pseudolocalization and long-label tests pass.
- **AC-I18N-02:** Switching any combination of UI locale/direction and content language/direction preserves document revision, source, selection and undo history.
- **AC-I18N-03:** Arabic/Hebrew + English/numbers/URLs, CJK, Devanagari, accented Latin and emoji fixtures survive same-format load/edit/export/reload on all supported adapters.
- **AC-I18N-04:** RTL toolbars, menus, lists and tables remain keyboard/touch accessible at narrow widths and large text sizes in light/dark themes.
- **AC-I18N-05:** HTML metadata round trips, sidecar metadata round trips and plain-source omission diagnostics pass. UI locale never implicitly changes publishing metadata.
- **AC-I18N-06:** Real native IME and VoiceOver/Narrator language/direction checks have recorded evidence. Automated browser success alone does not close this criterion.
- **AC-I18N-07:** Cross-runtime text-position, combining-mark and no-normalization tests pass. Invalid UTF-8 is rejected or explicitly converted by the host, never silently repaired.

## Non-goals

Every human language translated at launch; custom font/shaping engines; vertical writing modes; transliteration; translation management; bundled dictionaries; cloud spelling/grammar services; support for every legacy encoding. Native/browser spellcheck hints are permitted without claiming uniform grammar or dictionary support.

## Dependencies and constraints

Extends [PRD-0002](0002-editing-contract-and-release.md). The first public core release requires the foundations and declared catalogs above. Translation contribution instructions and catalog schemas are English. Use system font fallback for script coverage and record font-dependent visual baselines rather than claiming universal glyph availability.

## Implementation Notes

- 2026-11-16: Implementation is available as an early preview. See [implementation status](../../docs/status.md) for working surfaces, verification evidence and outstanding acceptance work. Requirements remain locked; no stable-release completion is claimed.

2026-11-16: Draft scope and contract only; no translation, Unicode or native input verification has been completed.

## Linked ADRs

- [ADR-0009: Independent UI locale, content language and direction](../adrs/active/0009-locales-and-text-direction.md)
- [ADR-0010: Portable source metadata and non-destructive images](../adrs/active/0010-portable-media-metadata.md)

## Completion Evidence

Pending implementation and per-platform evidence.

## References

- [W3C: Declaring language in HTML](https://www.w3.org/International/questions/qa-html-language-declarations)
- [W3C: Structural markup and right-to-left text](https://www.w3.org/International/questions/qa-html-dir)
- [Unicode UAX #29: Text segmentation](https://www.unicode.org/reports/tr29/)
