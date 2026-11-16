---
id: ADR-0008
title: Verification, packaging and coordinated releases
status: accepted
date: 2026-11-16
related_prds: [PRD-0001, PRD-0002]
supersedes: [ADR-0001]
superseded_by: []
---

# ADR-0008: Verification, packaging and coordinated releases

This records the selected implementation direction. Accepted here means the current project architecture, not separate user sign-off or evidence of implemented behavior.

## Context

Unit tests alone cannot prove editable behavior or native integration. Bundled engines can drift from source, and a demo that only compiles does not prove that document messages reach a real WebView.

## Decision

Maintain one shared format/conformance corpus and layer tests by risk: codec units, semantic round trips, editor integration, React lifecycle, browser end-to-end, visual baselines, native bridge/resource tests and real platform smoke runs. Add a focused regression fixture for each meaningful editing or serialization defect.

Use Playwright for Chromium, Firefox and WebKit browser behavior. Use a fixed corpus, viewport, fonts and runtime environment for visual comparisons. Baselines are platform-specific; each update explains the intended change. Supplement automated checks with manual composition and VoiceOver/Narrator checks. Do not call a cross-compiled native package runtime-tested.

Build the shared native engine from locked dependencies. Include an engine version, bridge protocol version and asset manifest. Validate that packaged resources match the intended build. Distribute prebuilt local assets so Swift/C# consumers do not need Node for normal integration. Prefer standard build-time manifests and scripts over a custom release platform.

Use npm source packages for core/React, a Swift Package Manager product and a NuGet-compatible WPF project. Before a Swift Git-tag release, expose a root Package.swift so consumers can add the repository URL directly; a nested package alone is a local-checkout integration. Pack native resources with their corresponding library and upstream notices. Verify installation from packed artifacts rather than only workspace links.

Use one coordinated pre-1.0 version and tag. Publish a public GitHub repository and tested release assets under the existing user authorization. npm/NuGet publication depends on explicit registry ownership and credentials; absent those, provide local/tarball/package installation instructions without claiming public registry availability.

Run focused local checks during implementation and one coherent release gate before publishing the completed batch. CI confirms locally credible work; do not open micro PRs or use repeated pushes to discover basic build failures. Native CI runs on suitable Apple/Windows runners. Record skipped checks and infrastructure blockers precisely.

## Rationale

This separates fast iteration from evidence required to claim support. Coordinated versions and deterministic resource validation reduce native/web mismatch without introducing unnecessary release infrastructure.

## Consequences

- Publish the exact tested commit, supported feature matrix, platform prerequisites and known limitations.
- Capture hardware/runtime versions for benchmarks and use measured, meaningful performance thresholds.
- Check licensing, notices, packed-resource presence and clean-checkout builds before a release tag.
- SDK and OS minimums are unresolved until selected and tested; they are release blockers for a supported native package, not grounds for invented compatibility claims.
- A failed external CI provider is documented and addressed; it does not justify more low-value PRs.

## Alternatives Considered

- Only parser units: insufficient for selection, input, history and bridges.
- Browser smoke tests as a substitute for native execution: rejected because focus, sandbox and message behavior differ.
- Require every Swift/C# consumer to compile Node assets: rejected for distribution usability.
- Independent package versions from day one: deferred until actual release cadence requires it.

## Links

- [PRD-0001](../../prds/0001-cross-platform-editors.md)
- [PRD-0002](../../prds/0002-editing-contract-and-release.md)

## Follow-up clarification — 2026-11-16

ADR-0012 and ADR-0013 gate optional companion artifacts separately from the first core release. Shared versions/protocol checks remain coordinated; absence of Go artifacts does not block a core release that makes no claim to include the companion.
