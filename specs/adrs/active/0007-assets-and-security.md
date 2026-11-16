---
id: ADR-0007
title: Offline engine, host-owned assets and untrusted content
status: accepted
date: 2026-11-16
related_prds: [PRD-0001, PRD-0002]
supersedes: [ADR-0001]
superseded_by: []
---

# ADR-0007: Offline engine, host-owned assets and untrusted content

This records the selected implementation direction. Accepted here means the current project architecture, not separate user sign-off or evidence of implemented behavior.

## Context

Documents and pasted HTML are untrusted. Embedded editors must not give document content access to privileged native capabilities. Images are needed without forcing every consuming app to adopt an upload service.

## Decision

Bundle the engine locally with each native distribution. Do not load editor code, fonts or startup assets from a CDN. Editing works without an account, backend or network connection; external document assets remain subject to host policy and connectivity.

Hosts own document persistence and asset storage. Provide an asynchronous asset callback returning an allowed reference and optional metadata. The editor owns only temporary UI state and resources it creates; it does not delete host assets when an image is removed. Revoke owned temporary object URLs on disposal and when no longer needed.

Use a maintained sanitizer and schema allowlist for HTML import/paste and for generated publishing HTML. Apply consistent URL validation to imported content and command arguments, including Markdown links/images. Disallow executable schemes, event handlers, executable embeds and arbitrary document styles. The concrete allowlist and permitted image encodings are documented and covered by adversarial fixtures before release.

Default to no automatic fetch of external assets from newly imported content until the host's asset policy permits them. Clicking a link must not navigate the embedded editor. Hosts receive an explicit open-link event and decide whether to invoke a platform browser.

Serve only required local engine resources to native WebViews. Block navigation and unexpected new windows; do not register a general filesystem handler. Accept bridge messages only from the expected main-frame local editor origin. Engine CSP permits only required resources; external images follow the configured policy. CSP is defense in depth, not a replacement for sanitization and bridge validation.

Do not log document text, image payloads or user-selected file paths by default. No telemetry or automatic document upload is included.

## Rationale

The library remains useful for offline apps and different storage systems without becoming a hosted service. Explicit resource and bridge boundaries protect native applications from hostile input.

## Consequences

- Image selection uses host/platform pickers; applications choose storage, authentication and lifetime.
- Asset errors must preserve editing state and reject stale completions after document replacement.
- Security removal cannot be bypassed by accepting lossy normalization.
- Hosts publishing HTML must also enforce their own publication policy; a client editor is not a server trust boundary.
- Resource and navigation restrictions require native integration tests and documented defaults.

## Alternatives Considered

- Built-in upload backend: rejected as unnecessary infrastructure and ownership coupling.
- Remote hosted editor page: rejected because it adds availability, privacy and version-skew risks.
- Trust HTML because it comes from an editor: rejected because imported and pasted content is untrusted.

## Links

- [PRD-0001](../../prds/0001-cross-platform-editors.md)
- [PRD-0002](../../prds/0002-editing-contract-and-release.md)

## Follow-up clarification — 2026-11-16

ADR-0011 and ADR-0012 add optional host integration recipes and a conditional standalone Go companion. The rejection of a built-in upload backend still applies to the editor core; offline use, host ownership and separate product/environment trust boundaries remain in force.
