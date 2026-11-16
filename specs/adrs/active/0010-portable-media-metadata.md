---
id: ADR-0010
title: Portable source metadata and non-destructive images
status: accepted
date: 2026-11-16
related_prds: [PRD-0002, PRD-0003, PRD-0004]
supersedes: []
superseded_by: []
---

# ADR-0010: Portable source metadata and non-destructive images

Accepted records the selected planning direction, not separate user sign-off, a shipped feature or permission to provision/deploy infrastructure. Referenced PRDs remain draft until implementation starts.

## Context

Plain Markdown/Fountain cannot portably preserve every language, direction or image placement attribute. Storing an engine-specific JSON tree would couple documents to our implementation. Storing a temporary URL as asset identity would make documents expire. The same asset may have several distinct uses.

## Decision

Extend the public export/load contract with an optional versioned source-sidecar pair. Source remains the human-readable durable format from [ADR-0004](0004-format-fidelity.md); the sidecar carries only metadata that source cannot express portably. It is not a public copy of the internal editor AST, a document server or an independently mutable source of truth.

An atomic host snapshot identifies document ID, revision, format, source and optional metadata schema version. Bind the sidecar to the exact serialized source with a source digest. Its mappings use serializer-produced, explicitly declared UTF-8 byte spans and stable occurrence IDs; runtime editor positions remain internal. Recompute source mappings from the same snapshot. Do not identify duplicate image placements by URL, ordinal position or a text-search guess.

On external source edits/digest mismatch, return an actionable mismatch diagnostic and require explicit host reconciliation or metadata discard. Do not guess which image or language range should inherit metadata. Unknown sidecar versions fail clearly and leave the previous document unchanged.

Minimum portable metadata covers optional content language/direction and overrides, plus per-image occurrence ID and applicable image metadata. Managed images include an opaque asset ID, immutable asset version, intrinsic oriented dimensions, optional focal override and caption. Plain URL-only images do not require an asset registry; version-bound focal fidelity requires a host-provided immutable reference. Keep supported alt text in source as well as its appropriate language context; do not create competing independently editable alt values. Host asset defaults may be resolved as defaults, not duplicated as authoritative per-placement state.

A logical asset reference or durable host URL may appear in authoring image destinations. A non-network logical reference is resolved by the configured adapter before display, never used as an executable URL. Plain portable publication requires materializing a durable allowed URL; diagnose unresolved references or metadata loss. Preview URLs remain ephemeral view state and are never used as the sidecar identity or saved authoring source.

### Focal-point contract

Coordinates are normalized in the EXIF-oriented original's physical axes, independent of UI direction. Effective focus is placement override → host asset default → center. Store focus against the exact asset version; replacing a version requires explicit reconciliation. Originals are immutable and crop operations are reversible metadata edits.

For source size `(w,h)`, target `(W,H)` and effective point `(x,y)`, define focal cover using:

```text
s = max(W / w, H / h)
scaledW = w * s; scaledH = h * s
left = clamp(x * scaledW - W / 2, 0, scaledW - W)
top  = clamp(y * scaledH - H / 2, 0, scaledH - H)
```

Render the scaled image offset by `(-left,-top)` into the target viewport. Reject invalid/nonfinite dimensions and points before computing. Adapters translate this model to provider-specific options with explicit rounding tolerance and fixture comparison. Do not assume percentage CSS object-position or a provider's “smart crop” has identical semantics. Unsupported rendition semantics return a capability diagnostic.

## Rationale

A small metadata sidecar preserves portable text while supporting image focus and language metadata without inventing private Fountain syntax. Stable identity and immutable versions survive storage migrations and URL rotation.

## Consequences

- Hosts saving metadata-bearing documents acknowledge source and sidecar together at one revision. A failed half-save never becomes a clean-state acknowledgement.
- Plain-source-only workflows remain valid with explicit omission diagnostics and materialized publish URLs.
- New metadata needs a version/migration policy; avoid turning the sidecar into a general application document framework.
- Copy creates a new image occurrence ID while retaining the asset/version. Undo restores placement identity and metadata.
- Asset IDs and deployment namespaces do not derive from mutable filenames, brands or bucket names. No workload identity is allocated by merely installing the library.
- Browser preview and server adapters must prove crop conformance rather than asserting visual parity from similar option names.

## Alternatives Considered

- Engine JSON as the only saved document: rejected for format portability and implementation lock-in.
- Custom image syntax/frontmatter inserted into every Markdown/Fountain file: rejected because other tools would not share its contract.
- Expiring image URL as ID: rejected because identity and access lifetime differ.
- Store focus only on the global asset: rejected because placements need independent composition.
- Match sidecars to edited source by URLs alone: rejected because duplicates and moved content make matching ambiguous.

## Links

- [PRD-0003](../../prds/0003-internationalization-and-content-languages.md)
- [PRD-0004](../../prds/0004-media-and-image-integrations.md)
- [ADR-0004: Existing source ownership](0004-format-fidelity.md)
