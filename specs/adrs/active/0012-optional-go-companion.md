---
id: ADR-0012
title: One optional Go companion with binaries and OCI images
status: accepted
date: 2026-11-16
related_prds: [PRD-0004, PRD-0005, PRD-0006]
supersedes: []
superseded_by: []
---

# ADR-0012: One optional Go companion with binaries and OCI images

Accepted records the selected planning direction, not separate user sign-off, a shipped feature or permission to provision/deploy infrastructure. Referenced PRDs remain draft until implementation starts.

## Context

A ready-to-run backend can help consumers with no existing media routes. It would also create an unnecessary deployment requirement if introduced before the callback integration proves what is missing. Multiple specialized services would multiply the operational cost.

## Decision

Reserve a conditional implementation milestone for one optional Go media gateway, activated only by a recorded real consumer gap after [PRD-0004](../../prds/0004-media-and-image-integrations.md) proves the host integrations. Use standard HTTP/JSON and a documented OpenAPI contract; do not make the editor speak a proprietary mandatory backend protocol.

The service can issue scoped upload plans, validate/finalize immutable originals and sign bounded public-publication variants. It uses operator-owned S3-compatible storage and optionally an existing imgproxy server. It does not include image processing itself, a document database, identity provider, asset library UI, billing or a queue. An existing host can implement the same routes instead.

Keep the service restart-safe without a local application database: a bounded signed receipt and durable object state support upload completion/idempotency. Implementation must specify receipt validation, rotation, byte-capture/promotion and provider conditional-write semantics before claiming stateless correctness. If a concrete requirement later needs persistent workflow state, record that decision rather than hiding it in process memory.

Ship Linux amd64/arm64 native executables and Linux amd64/arm64 Docker-compatible OCI images when this milestone is actually implemented and tested. Native executable and container are separate artifacts with shared source/version, checksums, dependency notices and build evidence. A Go executable must not be advertised as bundling imgproxy/libvips into a pure-Go image processor.

Use one explicit host-issued capability authentication mode with pinned trust configuration and operation/namespace/expiry constraints. No public unauthenticated default. Secret values enter through protected runtime configuration, not images, committed Compose files, client bundles or logs. Health/readiness reveal only bounded operational state.

Each deployment uses its own stable workload ID and product/environment credentials. The shared public image is reusable; shared runtime/data/control-plane ownership across Bad Herring and Staravenir is not. This ADR provisions nothing and does not accept a production secret-control-plane or deployment decision.

## Rationale

One optional process is a useful reusable integration product when demand is demonstrated. Keeping image processing upstream and storage host-owned limits our service to a tractable API and validation boundary.

## Consequences

- Core and optional client integrations can release without this service.
- The Go artifact milestone has its own real storage, authorization, restart/race and executable/container smoke gates.
- No claim of published binaries or container tags until downloadable artifacts exist and pass the declared platform tests.
- Native file/executable builds do not require Docker to run; OCI users do not need Go installed.
- Deployment examples must follow registered port/shared-service and CapRover policies where applicable; they cannot stop/reset machine-wide provider services.
- A service count increase, processing engine or persistent database requires new validated need and an ADR.

## Alternatives Considered

- Mandatory multi-service editor backend: rejected because offline editing and existing hosts do not need it.
- Go custom image transformer: rejected because native format support/security would become our maintenance burden.
- No companion ever: too restrictive given repeated consumers; a gated milestone preserves a practical path.
- Build the service immediately before proving integrations: deferred because the smallest useful route set is not yet demonstrated.

## Links

- [PRD-0005](../../prds/0005-optional-go-media-companion.md)
- [ADR-0007: Existing offline/security boundary](0007-assets-and-security.md)
- [ADR-0008: Existing packaging/release policy](0008-verification-and-releases.md)
- [ADR-0011: Storage and image delivery boundaries](0011-storage-and-image-delivery.md)
