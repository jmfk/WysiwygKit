---
id: ADR-0014
title: S3 and imgproxy reference integration in existing hosts
status: accepted
date: 2026-11-17
related_prds: [PRD-0004]
supersedes: []
superseded_by: []
---

# S3 and imgproxy reference integration in existing hosts

## Context

The next authorized batch is the S3-compatible/imgproxy integration, demos and regression tests from PRD-0004. Core editing and existing platform adapters already work. A separate Go gateway remains conditional; a reference Node host can exercise the integration without starting another backend product.

## Decision

Add an optional browser media client and a server-only Node library using the AWS S3 SDK, bounded sharp decoding for validation, and server-side imgproxy signing. The reference host is a loopback-only demo application, not a production authentication service or activation of PRD-0005.

Upload to a unique staging key with a short-lived signed plan. Bind finalization to a signed receipt, declared size/type/SHA-256 and configured namespace. Read one captured byte sequence, validate those bytes, and create a distinct final object with If-None-Match. Verified dimensions/digest are stored atomically in the immutable object's S3 metadata. Restart/retry reads that metadata, never process memory or mutable staging.

The host owns authorization. Private preview URLs are short-lived scoped capabilities served through a no-store host proxy; imgproxy's signed source URLs and storage keys are not sent to browsers. Public publication is an explicit operation creating an immutable rendition manifest with a bounded width list. Stable host publication routes survive rotation of imgproxy signing keys. Signing a transform is not reader authentication. Public manifests are committed per asset, not as a document transaction. The client preflights locally blocking image conditions; the consuming host authorizes the entire capture before starting, and earlier successful per-asset publications remain public if a later network/provider operation fails.

Test direct focal gravity against the shared focal-cover reference. If provider rounding/semantics differ, use an explicit source crop translated from the reference model; no silent smart-crop substitution. EXIF orientation is applied before coordinates are interpreted. Export safe HTML with bounded srcset variants without mutating the editing document.

For local development, the neutral workload ID is `bep9j4`. Shared MinIO admits only this workload's bucket and scoped users. The project owns its stateless imgproxy container and reserved ports, never the shared provider lifecycle. CI and provider regression tests use explicitly disposable RAM-backed isolated storage to test adversarial/replay behavior; it owns no developer data. The shared provider was observed full (HTTP 507), so the explicit ephemeral-test exception also supplies the verified demo environment until its owner restores space. The Node host bounds concurrent decode/render work and uses a short bounded queue for normal multi-preview bursts.

## Consequences

- Existing core, React, Swift and WPF asset delegates can use the same HTTP contract; no keys enter client bundles or snapshots.
- No hosted account system, database, custom image processor, Go binary or cloud deployment is introduced.
- Optional integration tests must exercise real MinIO and pinned OSS imgproxy, crop output, expiry, replay, invalid data and source/sidecar preservation.
- Actual compatibility is limited to tested providers/versions. Other S3 implementations require their own conformance run.
- Local credentials are generated into ignored mode-0600 .env.local files through a redacting admission helper. No production secret-control-plane decision is made.

## Alternatives Considered

- A mandatory Go gateway now: unnecessary before the existing-host recipe is proven.
- Direct client storage credentials or imgproxy signing: rejected because credentials belong server-side.
- Publishing preview URLs: rejected because expiring access and durable document identity have different lifetimes.

## Links

- [PRD-0004](../../prds/0004-media-and-image-integrations.md)
- [ADR-0011](0011-storage-and-image-delivery.md)
- [S3 conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html)
- [imgproxy processing](https://docs.imgproxy.net/usage/processing)
