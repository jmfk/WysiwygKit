---
id: ADR-0006
title: Shared UI, themes and accessible commands
status: accepted
date: 2026-11-16
related_prds: [PRD-0001, PRD-0002]
supersedes: [ADR-0001]
superseded_by: []
---

# ADR-0006: Shared UI, themes and accessible commands

This records the selected implementation direction. Accepted here means the current project architecture, not separate user sign-off or evidence of implemented behavior.

## Context

Parity requires shared behavior and appearance, while native navigation, gestures and platform controls should remain familiar. Hosts also need the option to supply their own chrome.

## Decision

Implement one shared editor surface and semantic theme token set. Provide Light, Dark and System modes, defaulting to System. Use platform system fonts initially, with a screenplay monospace role. Keep font family, sizes, spacing, selection, focus, foreground, background and error colors configurable through a small documented theme contract.

Define one command catalog containing stable IDs, labels, shortcuts and applicability. Use it for the supplied toolbar, searchable Command-K / Control-K palette and host integration. Native demos expose applicable commands in the macOS menu bar; the platform container still owns native file pickers and normal navigation.

Use neutral UI chrome and spacing/type hierarchy. Distinct formats expose relevant tools without showing disabled controls for fundamentally unavailable capabilities. Temporary disabled state, such as undo with empty history, remains discoverable and correctly announced.

Provide semantic controls with accessible names, pressed state, disabled state, keyboard navigation and visible focus. Adapt toolbars to narrow surfaces, respect browser zoom and system text scaling, and honor Reduce Motion. Image insertion has visible progress and recoverable inline errors. Read-only and load failures are announced without discarding content.

## Rationale

A common token and command system gives hosts consistent semantics without requiring a large design-system framework. Accessibility is part of supported editing behavior rather than a visual polish phase.

## Consequences

- Visual tests use separate rendering baselines per environment; they do not assert cross-platform pixel identity.
- Assistive-technology checks must use actual WKWebView and WebView2, not only a desktop browser.
- Hosts may hide supplied chrome but can reuse the catalog; host-provided UI is responsible for preserving accessible access to commands.
- Platform font rendering may differ. Bundling a specific font can be considered later with licensing and demonstrated need.

## Alternatives Considered

- Duplicate native and web toolbars with separate command logic: rejected due to drift.
- Force identical platform interactions: rejected because native file dialogs, keyboard conventions and navigation belong to the platform.
- Introduce an unrelated full design system: unnecessary for the current scope.

## Links

- [PRD-0001](../../prds/0001-cross-platform-editors.md)
- [PRD-0002](../../prds/0002-editing-contract-and-release.md)

## Follow-up clarification — 2026-11-16

ADR-0009 extends shared command/theme behavior to independent runtime UI catalogs and content languages/direction. English remains the default UI and development language.
