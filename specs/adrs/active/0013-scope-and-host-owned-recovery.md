---
id: ADR-0013
title: Scope gates, editing productivity and host-owned recovery
status: accepted
date: 2026-11-16
related_prds: [PRD-0002, PRD-0003, PRD-0004, PRD-0005, PRD-0006]
supersedes: []
superseded_by: []
---

# ADR-0013: Scope gates, editing productivity and host-owned recovery

Accepted records the selected planning direction, not separate user sign-off, a shipped feature or permission to provision/deploy infrastructure. Referenced PRDs remain draft until implementation starts.

## Context

The initial scope already includes three document formats and four integration surfaces. Additional features should improve the recurring author journey or protect an important future boundary, not create a generic CMS/SaaS platform. Save failures also expose data-integrity issues that formatting tests do not catch.

## Decision

Use three delivery boundaries:

1. **Core release:** existing editing journeys plus localization/Unicode/RTL foundations, portable optional metadata, find/replace, safe link/paste behavior and revision-safe save/recovery hooks.
2. **Optional integrations:** manual focal-point authoring, responsive/publish resolution, local media adapter, one object-storage recipe and one image-server adapter. No mandatory backend.
3. **Conditional companion:** the Go gateway and distributable artifacts, after the documented integration/consumer gate.

A navigable outline and locale-aware word/character/scene counts are a next editor increment, not a prerequisite of core. Collaboration, accounts, translation management, full DAM, AI services, print/FDX pipelines, automatic storage cleanup and hosted infrastructure require separate demand and scope decisions.

Implement in-document literal find/replace and safe paste/link commands through the existing shared command catalog. Derived search results, outlines and counts are views of the document, not persisted competing data models. Use explicit Unicode/segmentation behavior and focused fixtures; do not introduce an indexing service.

The host owns persistence and recovery. The library provides atomic revisioned source/sidecar snapshots, debounced callbacks and save acknowledgements tied to a specific revision. Acknowledging an old save cannot clear newer dirty content. Save failure leaves the working document intact; an opt-in demo shows local restore with namespace, retention and private-content policy.

No default hidden localStorage document database, unload-based durability promise or automatic cloud synchronization is added. Restoring older snapshots is an explicit host action with revision/conflict checks.

## Rationale

Localization and metadata contracts prevent expensive compatibility changes. Find/replace, predictable paste and save correctness are high-value daily features. Optional integrations and a conditional backend preserve a small usable core while supporting repeated application needs.

## Consequences

- Core release acceptance includes the first-release additions from PRD-0003 and PRD-0006, plus PRD-0004's metadata contract.
- The core does not wait for focal UI, storage deployment, image-server operation or Go binaries.
- Save/recovery evidence includes stale acknowledgements, source/sidecar half-save failures, restore conflict and disabled storage.
- Every claimed layer has its own coherent verification gate; unimplemented optional scope remains visibly planned.
- These decisions extend existing offline-first and host-ownership ADRs, rather than reversing them into a mandatory hosted platform.

## Alternatives Considered

- Put every requested integration into the first core release: rejected for delivery and operational coupling.
- Defer all metadata/i18n until later: rejected because it would force public API and serialization changes.
- Add a built-in document store for autosave: rejected because host storage and privacy policies vary.
- Implement broad collaboration/translation/DAM abstractions preemptively: deferred without demonstrated need.

## Links

- [PRD-0002: Base release](../../prds/0002-editing-contract-and-release.md)
- [PRD-0003: Internationalization](../../prds/0003-internationalization-and-content-languages.md)
- [PRD-0004: Media integrations](../../prds/0004-media-and-image-integrations.md)
- [PRD-0005: Optional Go companion](../../prds/0005-optional-go-media-companion.md)
- [PRD-0006: Productivity and scope](../../prds/0006-editor-productivity-and-scope.md)
