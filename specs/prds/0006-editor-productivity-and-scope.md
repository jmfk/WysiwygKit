---
id: PRD-0006
title: Editor productivity, recovery and scope boundaries
status: in-progress
locked: true
created: 2026-11-16
related_adrs: [ADR-0012, ADR-0013]
---

# PRD-0006: Editor productivity, recovery and scope boundaries

## Problem

An editor may offer many formatting buttons yet still make everyday work difficult or lose unsaved edits during integration failures. Conversely, adding a DAM, translation system and several backend services would turn a reusable editing library into an application platform before the editing journeys work.

## Goals

Prioritize capabilities that improve all three document formats and all adapters. Establish a small additional first-release set and an explicit next/deferred list. Optional media/backend packages must not become release dependencies of offline editing.

## Priority and scope decisions

| Priority | Capability | Scope and reason |
| --- | --- | --- |
| Core first release | Internationalization, Unicode, mixed-direction content and declared UI catalogs | Foundation affects schema/UI/serialization; [PRD-0003](0003-internationalization-and-content-languages.md) |
| Core first release | Portable optional metadata and stable asset/placement IDs | Avoid expiring-URL and format-metadata dead ends; [PRD-0004](0004-media-and-image-integrations.md) contract only |
| Core first release | In-document find/replace, link editing and predictable paste | Everyday authoring benefit across formats; requirements below |
| Core first release | Safe host save/recovery hooks and revision acknowledgements | Prevent stale saves and expose recoverability without a hidden document store |
| First optional integration | Manual focal-point UI, previews, responsive/publish resolution | Useful media workflow with a bounded provider-neutral contract |
| First optional integration | One S3-compatible recipe and one imgproxy adapter | Prove actual integration instead of building a speculative provider platform |
| Next editor increment | Document outline and locale-aware counts | High value for long articles/screenplays; small bounded scope below |
| Conditional later milestone | One Go media companion, binaries and OCI images | Only after a consumer demonstrates a gap in existing-host reuse; [PRD-0005](0005-optional-go-media-companion.md) |
| Defer | Tables of contents generated into source, comments/review changes, advanced print/PDF/FDX, art direction | Each adds significant format/layout contracts; require separate validated demand |
| Outside this product now | Collaboration backend, accounts, DAM, translation management, AI services, storage/CDN hosting | Separate application/service responsibilities |

## Requirements: first core release additions

### EDIT-01: In-document find and replace

- Find source-visible authored text with next/previous, result count and visible matches. Use the existing combined command palette for action discovery and a contextual search area for match navigation, without a second global command system.
- Support literal matching, match-case option and replace-current/replace-all. Regex, fuzzy matching and cross-document search are not required.
- Operate on document text and defined block boundaries, not generated HTML tags, URLs hidden in attributes or raw serialized markup. Explain the searchable boundary for notes/boneyards and include them intentionally in Fountain authoring search.
- Never split grapheme clusters. Preserve supported marks where meaningful and report unavailable cross-node replacements rather than producing invalid schema. Replacing a whole match across adjacent inline marks uses the documented inheritance rule and a focused fixture.
- Replacements participate in undo; replace-all is one coherent history operation. Read-only permits find but prevents replacement.
- Update matches as content changes; searches do not modify source or stored language metadata. Avoid claiming universal language-specific collation; publish the supported literal/case behavior and test non-ASCII cases.

### EDIT-02: Links and paste

- Provide accessible edit/remove/open-link commands with host URL policy, clear labels and safe protocol validation. Opening uses a host event and cannot navigate an embedded editor away.
- Support paste-as-plain-text with a visible command/shortcut. Normal rich paste uses the existing sanitizer and capability diagnostics.
- Route pasted/dropped image files through the same host asset pipeline as the picker. Do not auto-download arbitrary remote clipboard images, silently upload files or enable image nodes in Fountain.
- Keep accepted paste/replacement operations undoable. A rejected paste leaves current content intact and explains the unsupported or unsafe construct.

### EDIT-03: Save and recovery contract

- Expose an atomic export snapshot containing document identity, revision, source and optional sidecar. A save acknowledgement names the saved revision; acknowledging revision N does not mark newer revision N+1 clean.
- Preserve live edits on recoverable save/upload errors and show dirty/error state without blocking continued typing. Hosts decide retry, file/storage location and persistence frequency.
- Offer a cancellable debounced snapshot callback suitable for host autosave, with no persistent storage enabled by default. Flush requests before deliberate host navigation are asynchronous and may fail; never promise an unload/crash handler can always save.
- Document an opt-in demo recovery adapter: isolated per document/host namespace, bounded retention, clear/restore controls and explicit handling of private content and unavailable storage. Native demos use appropriate host storage instead of relying on WebView localStorage for a durability promise.
- Restore is an explicit host load with a revision/source-sidecar match check. It never silently replaces an externally newer document. No cloud sync, conflict-free merge or cross-device recovery is implied.
- The library owns no long-lived document database and cannot garbage-collect host assets based on recovery snapshots.

## Requirements: next editor increment

### EDIT-04: Outline and counts

- Derive a read-only navigable outline from Markdown/HTML headings or Fountain sections/scene headings. Selecting an entry focuses the corresponding current document location.
- Derive counts using the declared content locale/segmentation policy, with explicit labels for words, grapheme characters and optional screenplay scenes. Avoid whitespace-only “word” claims for CJK/Thai.
- These are computed views, not another editable structure or persisted source-of-truth. Do not add heading/scene numbering, automatic generated source or pagination in this increment.
- Add measurements before running full-document scans on every keystroke; use editor transactions and debouncing where necessary.

## Acceptance criteria

- **AC-EDIT-01:** Keyboard users find and replace Latin, mixed-script and marked inline text without source corruption; read-only and undo/redo fixtures pass.
- **AC-EDIT-02:** Link/paste commands respect URL and format policy in browser and native WebViews; no navigation escape or wrong-document image insertion occurs.
- **AC-EDIT-03:** A delayed acknowledgement of an older snapshot leaves newer edits dirty. Retried persistence saves a consistent source/sidecar pair and never marks a failed save successful.
- **AC-EDIT-04:** Recovery opt-in, restore conflict, private-content policy, disabled storage and document switching are demonstrated without a backend. Limits and potential unsaved crash window are documented.
- **AC-EDIT-05:** The core release can be installed and its full declared demo journeys run without object storage, image server or Go companion.
- **AC-EDIT-06:** The next-increment outline/count features are marked planned until their own navigation, segmentation and performance fixtures pass; they do not block the first release.

## Non-goals

Application-wide search indexing; regex engine; document synchronization; collaborative editing; revision database; a mandatory autosave store; automatic translation; content moderation; asset lifecycle management; app accounts or hosted infrastructure.

## Delivery and dependencies

These additions extend [PRD-0002](0002-editing-contract-and-release.md), with localization from [PRD-0003](0003-internationalization-and-content-languages.md) and media contracts from [PRD-0004](0004-media-and-image-integrations.md). Build complete demonstrable journeys one at a time, and run narrow local checks before one coherent release gate. No PR is required merely to update a small neighboring spec sentence.

## Implementation Notes

- 2026-11-16: Implementation is available as an early preview. See [implementation status](../../docs/status.md) for working surfaces, verification evidence and outstanding acceptance work. Requirements remain locked; no stable-release completion is claimed.

2026-11-16: Prioritization and requirements drafted; no editor, save adapter or recovery behavior implemented.

## Linked ADRs

- [ADR-0012: Optional Go media companion](../adrs/active/0012-optional-go-companion.md)
- [ADR-0013: Scope gates, editing productivity and host-owned recovery](../adrs/active/0013-scope-and-host-owned-recovery.md)

## Completion Evidence

Pending implementation. This PRD intentionally distinguishes first-release requirements from a later increment.
