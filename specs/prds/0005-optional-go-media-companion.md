---
id: PRD-0005
title: Optional Go media companion and deployable artifacts
status: draft
locked: false
created: 2026-11-16
related_adrs: [ADR-0011, ADR-0012]
---

# PRD-0005: Optional Go media companion and deployable artifacts

## Problem

Consumers without a backend need a small, ready-to-run way to authorize image uploads and resolve image-server variants. Copying signing logic and validation into every demo is error-prone. Requiring an editor-specific backend for all consumers would undermine offline/local use and increase operational burden.

## Status, priority and activation gate

This is a **conditional later milestone**, not a dependency of the first core or first integration release. First prove the host callback, local resolver and one real object-storage/image-server integration. Build this companion only if an actual consumer needs reusable upload/signing endpoints beyond a small existing-host route. Record that consumer and the remaining gap in implementation notes before starting.

The selected packaging direction is Go plus optional OCI images. This specification authorizes neither cloud provisioning nor deployment, and does not claim that binaries exist.

## Goals

- One small optional service, deployable without a database, message broker, account system or proprietary infrastructure.
- A standalone Go executable and Docker-compatible OCI image, both with documented configuration and pinned dependencies.
- Direct upload to object storage, bounded validation/finalization and safe variant URL signing.
- Same typed media contract whether a host uses this service, embeds equivalent routes or supplies its own backend.

## Core journey

The host authenticates its user and grants a scoped upload capability. The editor requests an upload plan, uploads bytes directly into staging storage, then completes validation/finalization. Only the finalized immutable asset is attached to the document. For publication, an explicitly authorized request returns allowed image variants from the configured image server. The host persists the document/sidecar and owns the relationship to the asset.

## Requirements

### GO-01: One process and small API

- Implement a Go HTTP service with a documented OpenAPI contract covering create-upload-plan, complete-upload, resolve-public-variant and health/readiness. Return stable error codes with localizable client messages; do not hard-code end-user language in protocol semantics.
- Use one configured S3-compatible storage adapter and one optional imgproxy signing adapter initially. Do not build a registry of providers, scheduler, custom image transformer or background worker fleet.
- Use no durable local application database. A signed bounded upload receipt plus staged/final object state supports restart-safe completion and idempotency. Define receipt format, expiry and rotation behavior in implementation before publishing the API; do not rely on process memory for correctness.
- Set explicit request/upload/decode/pixel/timeout/concurrency limits. Start with JPEG, PNG and still WebP only after tested decoder support; reject executable SVG, animations and unsupported formats with a specific error.
- Do not download arbitrary caller-provided URLs. Operate only on authorized asset references and configured object keys.

### GO-02: Authentication and ownership

- The host remains the identity/authorization authority. Validate short-lived host-issued signed capabilities with an explicit issuer, audience, algorithm allowlist and configured trusted verification keys.
- Capabilities bind allowed operation, deployment namespace, size/type constraints and expiry. Host-selected asset references are checked against authorized ownership, not trusted because a request supplies a namespace or document ID.
- Reject absent/expired/mismatched capabilities by default. A local demo may use a separately marked loopback-only development issuer; it must not silently disable production authentication.
- Keep storage credentials, signing secrets and private original locations server-side. Treat presigned URLs/receipts as bearer material and redact request query strings, auth headers and their values from logs.
- Maintain separate configuration, runtime identities, buckets/prefixes, credentials and deployment state for each product/environment. A shared library or container image does not authorize a shared Bad Herring/Staravenir control plane.

### GO-03: Upload/finalize correctness

- Generate unique staging and immutable final keys on the server. A client cannot overwrite an existing final original or choose another owner's object key.
- An upload plan bounds target, method, expiry, declared media type and checksum constraints when supported. Browser CORS policy is configured explicitly for allowed origins; native authorization does not depend on CORS.
- Presigned PUT may be reusable until expiry; it is not a single-use upload grant. Never publish the same mutable staging object directly as the original.
- Finalization validates actual bytes, detected format, decode bounds, dimensions and checksum. Finalize one captured object version/byte sequence, then promote those validated bytes to a distinct immutable final key. A HEAD/check followed by an unpinned second fetch is insufficient.
- Retry of a successful completion returns the same asset/version. Conflicting replay produces a conflict rather than overwriting bytes or attaching inconsistent metadata. Require tested conditional-write/version behavior or an equally explicit immutable-promotion strategy for each supported provider.
- Keep staging TTL cleanup separate from final originals and from editor undo. Staging expiration uses operator-owned object lifecycle rules; the service never infers that a final asset is unused from absence in an open editor.
- Failed finalization leaves no attachable success result. An orphaned finalized asset after host save failure remains host-owned; no automatic deletion races the host's retry.

### GO-04: Image delivery boundary

- Resolve approved bounded rendition presets: dimensions, fit, effective manual focus and permitted output formats. Reject arbitrary provider options, unbounded resize dimensions and unapproved source keys.
- Sign image-server URLs server-side. A transform signature prevents tampering; it does not by itself authorize a reader or revoke cached private derivatives.
- The first companion provides a public-publication variant path, requiring a host-granted publication capability. Private bucket originals can feed processing, but that does not make public derivatives private.
- Private authoring/delivery stays behind a host-provided authorized resolver/proxy until a separately tested private-delivery design is added. The first companion must return an unsupported-policy error rather than expose a private asset through a public signed image URL.
- Reuse an existing imgproxy deployment or documented upstream container. Its native image-processing dependencies are separate; do not advertise it as part of a pure-Go standalone binary.

### GO-05: Ready-to-run artifacts

| Artifact | First companion release requirement |
| --- | --- |
| Standalone executable | Linux amd64 and arm64; tested without a Go toolchain; other OS targets require their own declared evidence |
| Container image | Docker-compatible OCI manifest for linux/amd64 and linux/arm64; immutable version tag and digest |
| Integrity | Release checksums, dependency/license inventory and build provenance/SBOM |
| Runtime | Non-root execution, minimal writable paths, graceful shutdown and safe health/readiness endpoints |
| Configuration | Validated environment/file schema; secrets supplied by deployment facilities, never image layers or examples |
| Examples | Optional Compose recipe using external/registered storage and optional upstream image server, plus a non-container executable recipe |

A native executable and a container image are distinct deliverables. Do not require Docker to run the standalone binary, or require a local Go toolchain to run the OCI image. Never promise a static image-processing binary when a separate native processor is used.

### GO-06: Operation and local development

- Storage, TLS ingress and optional image server are operator-provided; no cloud auto-provisioning or production deployment is included.
- Deployment examples use host-generated stable workload IDs, not repository or portfolio names, for durable storage/runtime identifiers. Do not allocate a single global namespace for all consumers.
- On this development machine, reuse registered compatible shared storage and OrbStack, reserve host ports before running examples, and never take ownership of the provider container/volume. CapRover checks, if introduced, run on the configured Linode test server, not local Docker.
- Before implementation handles real configuration/credentials, apply the project's secret-management instructions. No credential is needed to read these specifications.
- Expose useful bounded status/error counters without asset payloads or sensitive URLs. A deployment may attach its own monitoring; no observability platform is required.

## Acceptance criteria

- **AC-GO-01:** The recorded activation gate is satisfied and the editor demos still function with the companion disabled.
- **AC-GO-02:** Exact supported provider operations pass real integration tests for signing, CORS, checksums, promotion, immutability and idempotency. Advertised compatibility names tested vendors/versions rather than all S3 implementations.
- **AC-GO-03:** Cross-namespace access, missing auth, malformed/expired capability, unsafe rendition, oversized/corrupt upload and replay/overwrite attacks fail safely.
- **AC-GO-04:** Restart between upload and completion does not lose correctness. Upload/finalization races validate and attach only the captured bytes; no mutable staging URL becomes durable source.
- **AC-GO-05:** Standalone and container artifacts start from documented recipes, pass upload → finalize → public-variant smoke tests and shut down cleanly. Cross-compilation alone is not runtime verification.
- **AC-GO-06:** Private publication is rejected without an explicit host publication path; signed transform URLs are not misrepresented as private access control.
- **AC-GO-07:** Examples, logs, image layers and release artifacts contain no credentials, document text or sensitive preview URLs. License notices accompany our and separately reused upstream artifacts.

## Non-goals

Accounts/SSO, multi-tenant SaaS control plane, billing, a document store, asset catalog/search, a full DAM, persistent queues, long-running workers, a custom image renderer, private CDN revocation, production cloud hosting, automatic deletion of finalized assets or an all-in-one container containing every dependency.

## Dependencies

[PRD-0004](0004-media-and-image-integrations.md), a proven host integration and a documented operator-owned storage/image-server configuration. Core editing stays offline-capable and independent under [PRD-0002](0002-editing-contract-and-release.md).

## Implementation Notes

2026-11-16: Conditional draft. No activation consumer recorded, service implemented, binary built, container published or deployment performed.

## Linked ADRs

- [ADR-0011: Storage and image delivery boundaries](../adrs/active/0011-storage-and-image-delivery.md)
- [ADR-0012: Optional Go media companion](../adrs/active/0012-optional-go-companion.md)

## Completion Evidence

Pending activation and implementation.

## References

- [AWS S3: Presigned URL semantics](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
- [imgproxy: URL signatures](https://docs.imgproxy.net/usage/signing_url)
