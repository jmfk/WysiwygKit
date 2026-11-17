---
id: PRD-0004
title: Non-destructive images and storage integrations
status: in-progress
locked: true
created: 2026-11-16
related_adrs: [ADR-0010, ADR-0011, ADR-0012, ADR-0014]
---

# PRD-0004: Non-destructive images and storage integrations

## Problem

An image URL alone does not capture an image's durable identity, focal point or how it should appear in different aspect ratios. Expiring storage URLs break saved documents. Hard-wiring a bucket or image service into the editor creates provider lock-in and can expose credentials.

## Goals and scope

Put small, durable image metadata and resolver contracts in the core before public API release. Deliver focal-point authoring, responsive delivery and reference object-storage/image-server integrations as an optional first integration milestone, independently of the core release. Images apply to Markdown/HTML; do not add private image syntax to Fountain.

Keep image placement and alt text available with a host callback even when none of the optional integrations is installed. A simple local-file adapter is a complete supported integration for offline apps.

## Users and core journey

An author selects an image through a host picker or pastes/drops an allowed file. The host creates a durable asset reference. The author sets an accessible description and, optionally, a focal point. They preview wide, square and portrait crops without changing the original. The host saves source plus metadata. Reloading after delivery URLs expire resolves the same asset/version and crop without replacing the document.

## Requirements

### MEDIA-01: Durable identity and ownership

- Use an opaque host-owned `assetId` and immutable `assetVersion`, independent of the original filename, provider hostname, bucket/key, mutable product name or signed URL. The library does not invent a global asset registry.
- Plain imported URL images remain valid without registration in an asset service. Managed asset identity is required only when the host opts into managed/versioned media. A URL-only mutable original cannot claim version-bound focal fidelity; require host versioning or report that limitation before enabling a durable crop.
- A distinct stable `occurrenceId` identifies each image placement in a document. Reusing one asset does not force the same caption, alt text or crop everywhere. Copying an occurrence creates a new placement identity; undo restores the original identity.
- Store oriented intrinsic pixel width/height and detected media type where known. Resource dimensions are untrusted until validated by the host/service.
- Originals are immutable. Replacement means a new asset version, with an explicit choice to retain or reset placement crop metadata. Never silently apply old coordinates to a differently oriented/reframed image.
- Authoring/source export and durable metadata must not contain temporary bearer URLs, storage access keys, image-server signing secrets or native file paths.

### MEDIA-02: Focus and crop behavior

- A manual focal point is normalized `{ x, y }`, each finite and within `[0,1]`, on the EXIF-oriented original. Origin is physical top-left; x increases right and y increases down regardless of UI/content direction.
- Effective focus is placement override → host asset default → center `(0.5,0.5)`. Changing a placement override never changes another placement or the shared asset default.
- Provide point selection, reset and accessible keyboard adjustment with visible numeric values. All changes participate in undo/redo. Use the shared command catalog; do not require pointer-only dragging.
- Offer `contain` and focal `cover` previews with host-selected aspect ratio. The cover crop centers the point where possible and clamps to original bounds. A focal point is a cropping hint, not a guarantee that the entire subject fits.
- Use a reference crop calculation for preview/server adapter conformance; raw percentage `object-position` is not accepted as proof of the same focal-centering result.
- No destructive pixel editing is required. Freeform crop rectangles, per-breakpoint art direction, face recognition, automatic subject detection and AI cropping are later work.

### MEDIA-03: Typed host integration

Provide narrow cancellable host operations for file/asset selection, upload, resolve/refresh delivery references and optional variant generation. Declare adapter capabilities: crop support, responsive variants, private delivery and offline resolution. Do not make callers implement a provider plugin framework.

- Picker results and paste/drop use the same validation/upload pipeline. External URL insertion remains governed by host URL/fetch policy.
- The resolver maps an authorized asset/version and requested rendition to a URL/headers descriptor appropriate for the surface. If an image element cannot use custom headers, the host supplies an allowed delivery mechanism rather than putting arbitrary credentials in markup.
- Ephemeral preview URL refresh must not dirty the document, create undo entries or move selection. A user crop/alt change does.
- Show progress, cancellation and actionable errors. Cancelled/stale tasks cannot mutate another document, a removed image or a disposed editor.
- Read-only suppresses asset mutations. Removing an occurrence does not delete its shared original. No automatic asset garbage collection follows editor undo or document close.

### MEDIA-04: Storage and image-server integration

- Publish a tested recipe for S3-compatible presigned upload through the host or optional companion. Use a server-selected key, bounded expiry and explicit finalize/validation; clients never receive long-lived storage credentials.
- Test exact supported operations against actual named providers. “S3-compatible” is a protocol target, not a promise that all vendors implement checksum, conditional-write, CORS and signing behavior identically.
- Publish one imgproxy reference adapter using explicit manual focal coordinates and server-side signing. Keep the generic delivery contract usable with an existing image server. Verify the chosen pinned OSS version without requiring Pro features.
- Return explicit capability diagnostics when a provider cannot satisfy a crop/variant. Do not silently fall back to an unrelated crop.
- Use width/height and bounded responsive candidates for publishing HTML; variants have stable asset-version/transform identity. No need to implement a CDN, cache service or pixel-processing engine ourselves.
- Private derivatives enforce the same ownership policy as originals. A transformed URL is not authorization by itself, and public caches must not mix private content.

### MEDIA-05: Export and metadata

The optional versioned sidecar stores stable asset/occurrence references and crop settings. It is part of the host save acknowledgement for a metadata-bearing document, not an independently mutable document database. See [ADR-0010](../adrs/active/0010-portable-media-metadata.md).

| Output | Requirement |
| --- | --- |
| Authoring source + sidecar | Reload restores asset identity, per-occurrence metadata and focus after URL expiry |
| Plain Markdown | Standard image link and alt text; require a durable publish URL or host decision; diagnose lost focus/caption/identity metadata |
| Publishing HTML | Resolve authorized, publishable URLs/variants; emit safe image/picture attributes as supported; no internal storage keys or signing credentials |
| Self-contained offline export | Local asset mapping is host-owned; the core does not promise an archive/download manager |
| Fountain | No image nodes or private image encoding |

Publishing private content to a public URL is an explicit host operation. If durable output cannot be resolved, export reports a blocking diagnostic rather than saving an expiring preview URL as permanent source.

## Integration demos

Add a separate optional `demos/media/` journey showing repeated image placements, accessible focus adjustment, aspect-ratio previews, local resolution, save/reload with metadata and expired-URL refresh. The local path needs no account or backend. A separately enabled storage/image-server path demonstrates the reference adapters using operator-provided configuration; it does not embed keys or start shared provider services. Document enabled capabilities and unsupported provider policies in English.

## Acceptance criteria

- **AC-MEDIA-01:** Two placements of the same image have independent alt/caption/focus; modifying one and undoing it leaves the other unchanged.
- **AC-MEDIA-02:** Focus/crop fixtures include corners, center, edge clamping, portrait/landscape, EXIF orientations and RTL chrome. Preview and reference adapter agree within a documented pixel-rounding tolerance.
- **AC-MEDIA-03:** A source-plus-sidecar save/reload restores metadata after all preview URLs expire. URL refresh leaves revision/history unchanged.
- **AC-MEDIA-04:** Delayed upload, retry, cancel, deletion, document switch, undo/redo and disposal produce no wrong-document insertion or dangling callback.
- **AC-MEDIA-05:** Host callback/local-file usage works without backend packages. Signed object-storage recipe and imgproxy adapter pass their contract tests in the optional integration release.
- **AC-MEDIA-06:** Keyboard/screen-reader users can set/reset focus, edit alt text and understand upload errors in all declared UI locales and themes.
- **AC-MEDIA-07:** Exports enforce plain-format diagnostics and private/public policy; snapshots/logs/source contain no temporary credentials or signed preview query strings.

## Non-goals

A full digital asset manager, asset search/catalog service, folders/tags/rights administration, automatic storage deletion, a custom image processor, provider support for every storage vendor, video/audio pipelines, background removal or face recognition.

## Dependencies and rollout

- Core: stable metadata and callback contract; plain image insertion/alt text.
- Optional integration milestone: focal UI, responsive/publish resolution, local-file example, one S3-compatible recipe and one imgproxy adapter.
- Optional companion later: [PRD-0005](0005-optional-go-media-companion.md). Existing applications can use their own backend and never deploy it.

## Implementation Notes

- 2026-11-16: Implementation is available as an early preview. See [implementation status](../../docs/status.md) for working surfaces, verification evidence and outstanding acceptance work. Requirements remain locked; no stable-release completion is claimed.

2026-11-16: Draft only. No storage provider, focal UI or image-server integration has been implemented or verified.

- 2026-11-17: Optional S3/imgproxy libraries, plain-web/React media demos and provider/browser regressions are implemented under [ADR-0014](../adrs/active/0014-s3-imgproxy-reference-integration.md). See [integration setup](../../docs/media-integrations.md) and [verification evidence](../../docs/status.md). Status remains in progress for broader/manual/platform acceptance.

## Linked ADRs

- [ADR-0010: Portable source metadata and non-destructive images](../adrs/active/0010-portable-media-metadata.md)
- [ADR-0011: Storage and image delivery boundaries](../adrs/active/0011-storage-and-image-delivery.md)
- [ADR-0012: Optional Go media companion](../adrs/active/0012-optional-go-companion.md)

- [ADR-0014: S3 and imgproxy reference integration](../adrs/active/0014-s3-imgproxy-reference-integration.md)

## References

- [AWS S3: Presigned upload/download semantics](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
- [imgproxy: Processing options](https://docs.imgproxy.net/usage/processing)
- [imgproxy: URL signing](https://docs.imgproxy.net/usage/signing_url)

## Completion Evidence

2026-11-17: 16 real MinIO/imgproxy regressions and nine cross-browser media journeys pass. Five new unit regressions cover presentation-only refresh, stale callbacks, independent placements and captured publication. Full evidence and remaining gates: [implementation status](../../docs/status.md).
