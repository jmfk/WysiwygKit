---
id: ADR-0011
title: Separate storage, asset identity and image delivery
status: accepted
date: 2026-11-16
related_prds: [PRD-0004, PRD-0005]
supersedes: []
superseded_by: []
---

# ADR-0011: Separate storage, asset identity and image delivery

Accepted records the selected planning direction, not separate user sign-off, a shipped feature or permission to provision/deploy infrastructure. Referenced PRDs remain draft until implementation starts.

## Context

Object storage stores originals; an image server transforms images; the host authorizes ownership and publication. Mixing these into the editor leaks credentials and couples saved documents to a provider. A signature protecting image transformations does not establish private-content authorization.

## Decision

Keep the editor dependent on narrow host media callbacks. Provide a local adapter first, one tested S3-compatible upload recipe and one imgproxy reference adapter as optional integrations. Use the same portable asset/version/focal model across them. Do not add a provider registry or direct long-lived storage credentials to TypeScript, Swift or C# clients.

Storage owns original bytes and staged uploads. The host owns asset identity, references, authorization and lifecycle. A resolver turns stable references plus rendition requests into authorized ephemeral presentation descriptors. An image server owns decoding, resizing and delivery variants. The optional Go companion can coordinate upload/signing, not become the owner of application documents or accounts.

Use manual focal coordinates translated and tested against [ADR-0010](0010-portable-media-metadata.md). imgproxy is the first reference integration because its documented options expose manual focal gravity and URL signing. Pin and verify an OSS build for the required subset; use no Pro-only auto-object-detection/crop feature. This is a reference choice, not a requirement to migrate an existing application's image server.

Sign transformations on the server. Validate asset ownership, target presets and source restrictions before signing. Do not expose arbitrary image-source fetching or unbounded resize commands. imgproxy supports restricted sources and S3 configuration; the deployment still needs explicit policy and real compatibility tests.

Treat private access separately: originals and derivatives need the host's reader policy, bounded access and cache isolation. Transform signing alone is insufficient for revocation or authorization. The initial optional companion handles explicit public publication; private authoring uses a host-controlled authorized resolver/proxy. Do not promise private CDN revocation without a tested design.

Presigned uploads target mutable staging only. They may be reused until expiry and can overwrite their target. Finalization must validate a captured byte sequence and publish a distinct immutable original before attachment. Checksum/conditional-write/version behavior is tested per supported provider; ETag is not assumed to be a content checksum.

## Rationale

These boundaries support local apps, existing CMS backends and different storage vendors with little code in the core. Reusing a real image server avoids building and operating our own decoder/transform pipeline.

## Consequences

- Focal and delivery integrations are in scope as optional packages, not mandatory servers.
- URL refresh is presentation state; crop/alt edits are document transactions.
- A host policy controls remote fetch, private/public publication and cache lifetime.
- Asset removal from a document does not delete a shared original. Finalized asset garbage collection belongs to the host.
- Stable opaque workload IDs and environment/role dimensions name deployed buckets and namespaces; portfolio deployments remain separate. No names, buckets or credentials are provisioned by this decision.
- Browser and native upload paths share semantics while using platform-appropriate networking/pickers.

## Alternatives Considered

- Direct storage SDK plus embedded credentials in every client: rejected for security and provider coupling.
- Reimplement an image server in the editor project: rejected for maintenance and operational burden.
- Treat a signed transform URL as private access control: rejected because signing and reader authorization differ.
- Integrate every storage/image provider at launch: deferred until a second real integration requires an adapter.

## Links

- [PRD-0004](../../prds/0004-media-and-image-integrations.md)
- [PRD-0005](../../prds/0005-optional-go-media-companion.md)
- [AWS S3 presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
- [imgproxy processing options](https://docs.imgproxy.net/usage/processing)
- [imgproxy URL signing](https://docs.imgproxy.net/usage/signing_url)
- [imgproxy source/storage configuration](https://docs.imgproxy.net/configuration/options)
