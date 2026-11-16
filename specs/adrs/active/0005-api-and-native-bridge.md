---
id: ADR-0005
title: Public API and versioned native bridge
status: accepted
date: 2026-11-16
related_prds: [PRD-0001, PRD-0002]
supersedes: [ADR-0001]
superseded_by: []
---

# ADR-0005: Public API and versioned native bridge

This records the selected implementation direction. Accepted here means the current project architecture, not separate user sign-off or evidence of implemented behavior.

## Context

An editor must be easy to embed without leaking engine-specific internals. Native WebViews add asynchronous readiness and stale-response hazards. React can accidentally reload a document on every render.

## Decision

Provide a small typed host API covering:

| Area | Contract |
| --- | --- |
| Initialization | Format, initial document, theme, read-only state, toolbar policy and asset handler |
| State | Loading/ready/failed/disposed, document identity, current revision, dirty state |
| Document | Explicit load, same-format export and mark-current-revision-saved |
| Commands | Stable command identifiers, arguments, enabled/active state and execution |
| Events | Ready, document changed, command/selection state, diagnostic and failure |
| Lifecycle | Explicit disposal and cancellation of outstanding work |

Treat this as the required API shape; exact language-specific symbol names are chosen during implementation and documented before release. Do not create a general-purpose plugin bus.

Use JSON message envelopes for native requests and responses. Include protocol version, request ID, operation and payload; document-scoped work also includes document ID and revision. Validate origin/frame, operation, payload type and relevant revision before dispatch. Reject unknown protocol versions and operations. Limit accepted message sizes and define timeout/cancellation errors in the implementation contract.

Never concatenate source content into executable JavaScript. Use structured argument/message APIs or a fixed receiver with safely serialized data. No message allows arbitrary JavaScript evaluation, native selector invocation, filesystem paths or process execution.

Native calls await readiness or return explicit initialization errors. Disposal rejects pending calls and unregisters handlers. Old asset completions and responses cannot mutate a newer document. Change events are transaction-based; selection changes have their own state event. Hosts may request export without full serialization on every caret movement.

React owns one editor instance per mounted view. Prop changes to theme/read-only/callbacks update configuration, while document replacement requires a distinct document identity or explicit load. Controlled-host examples must prevent an exported change from being immediately reloaded as a new document.

## Rationale

Explicit identity, revisions and lifecycle prevent subtle data loss while keeping the surface small. A narrow bridge is easier to audit and test than exposing the engine or arbitrary native calls.

## Consequences

- All adapters implement the same semantics, with idiomatic Swift/C#/TypeScript syntax.
- Native tests include queued calls, failure, stale revisions, invalid messages and disposal.
- Read-only prevents editor mutation commands; the host can still intentionally load another document.
- The public contract is versioned independently from internal Tiptap schema details.

## Alternatives Considered

- Expose the full Tiptap instance as the portable API: rejected because Swift/C# cannot provide the same contract.
- Fire-and-forget string commands: rejected because failures and readiness become invisible.
- Serialize the whole document on every UI state event: rejected for avoidable cost on larger documents.

## Links

- [PRD-0001](../../prds/0001-cross-platform-editors.md)
- [PRD-0002](../../prds/0002-editing-contract-and-release.md)
