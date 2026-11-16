---
id: ADR-0004
title: Format fidelity and document ownership
status: accepted
date: 2026-11-16
related_prds: [PRD-0001, PRD-0002]
supersedes: [ADR-0001]
superseded_by: []
---

# ADR-0004: Format fidelity and document ownership

This records the selected implementation direction. Accepted here means the current project architecture, not separate user sign-off or evidence of implemented behavior.

## Context

Markdown, publishing HTML and Fountain have different semantics. A universal lowest-common-denominator schema would discard information; promising lossless arbitrary input would be misleading.

## Decision

Expose three explicit format modes with a versioned capability matrix. Markdown and HTML share supported rich-text primitives. Fountain uses screenplay-aware blocks and Fountain emphasis rules; unsupported image/table commands are unavailable in that mode.

The external source format is the host's durable document. The live editor model is the authoritative current editing state while mounted; do not keep a competing mutable source copy. Retained source fragments or metadata are attached to the parsed document and invalidated when their associated structure changes. The editor JSON/schema is internal, not a promised durable public interchange format.

Return structured diagnostics for unsupported syntax, normalizations and security removals. Use a preflight/load result so lossy normalization needs an explicit host choice. A failed or refused load leaves the previous document intact and returns the original input to the host's control. For unsupported content, retaining the original source is preferable to silently accepting loss.

Define round-trip correctness as supported semantics and intentional text surviving same-format export/reload. Preserve Fountain title fields, notes, boneyards, scene numbers, dual-dialogue associations and intentional line breaks. If exact original source is retained for unchanged fragments, test that as an additional guarantee; do not imply byte fidelity for arbitrary edited documents.

HTML is a sanitized editable body fragment. Scripts, document-level layout, arbitrary CSS and application embeds are outside its contract. Markdown uses a declared CommonMark/GFM-inspired subset, not a claim of full specification compliance. Cross-format conversion is not implicit or part of the first release.

## Rationale

A bounded, tested contract protects author content better than a broad feature claim. Fountain metadata and underscore semantics need explicit handling independent of Markdown.

## Consequences

- The capability matrix and fixtures are release artifacts, not only marketing documentation.
- Format changes require an explicit document load; changing a configuration field cannot reinterpret live content.
- Rich-table features are gated by export format: no merged-cell command for portable Markdown.
- Unsupported content may require source-only handling by the host until support is added.
- Native and React adapters must propagate diagnostics rather than turning an incomplete load into success.

## Alternatives Considered

- Store everything as HTML: rejected because it loses format-specific authoring intent.
- Maintain independently editable source and rich models: rejected because synchronization creates competing truth.
- Promise byte-for-byte serialization universally: rejected because editing, sanitization and canonicalization legitimately change source.

## Links

- [PRD-0001](../../prds/0001-cross-platform-editors.md)
- [PRD-0002](../../prds/0002-editing-contract-and-release.md)
- [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/)
- [GFM specification](https://github.github.com/gfm/)
- [Fountain syntax](https://fountain.io/syntax/)

## Follow-up clarification — 2026-11-16

ADR-0010 adds an optional versioned source-sidecar contract for metadata that the text format cannot express. Source remains durable and the editor AST remains internal; the sidecar is saved atomically with its bound source revision.
