---
id: ADR-0002
title: Product-neutral monorepo and MIT licensing
status: accepted
date: 2026-11-16
related_prds: [PRD-0001, PRD-0002]
supersedes: [ADR-0001]
superseded_by: []
---

# ADR-0002: Product-neutral monorepo and MIT licensing

This records the selected implementation direction. Accepted here means the current project architecture, not separate user sign-off or evidence of implemented behavior.

## Context

The libraries share features, fixtures and visual behavior. Splitting repositories now would add version-coordination work before the shared contract is proven. The user requests a public repository with a generous open source license.

## Decision

Use one public GitHub monorepo, provisionally named WysiwygKit, with independently consumable packages. License original project code under MIT. Include the license text and relevant third-party notices in distributed packages and bundled engine resources.

The project belongs to neither Bad Herring nor Staravenir. It contains no portfolio-specific configuration, infrastructure, domains, customer data, credentials or provider identities. Applications from either portfolio may consume the same public library through their own adapters.

Use this logical layout; implementation may add conventional build files without introducing more products:

```text
packages/core/       Framework-independent engine and public web API
packages/react/      React integration
packages/swift/      Swift package and local engine resources
packages/windows/    C# WPF library
demos/web/          Plain-web demo
demos/react/        React demo
demos/swift/        Apple demos
demos/windows/      Windows demo
 tests/fixtures/     Shared conformance and regression corpus
 tests/unit/         Format and integration tests
 tests/browser/      Browser behavior and visual tests
 specs/              Requirements and decision history
 scripts/            Build, resource and verification tooling
```

Keep demos outside library source trees. Use original or compatibly licensed samples. Registry names and package publication are separate from creating a public Git repository; proposed names are not an ownership claim.

## Rationale

A monorepo allows one reviewable change to update the engine, adapters, demos and fixtures together. MIT permits broad reuse while keeping the initial licensing model simple.

## Consequences

- Start with one coordinated release version; do not build independent release orchestration until needed.
- Review transitive dependency licenses and preserve notices; MIT on our code does not relicense dependencies.
- Never commit credentials, local environment files, build caches or `.DS_Store` files.
- Public publication is already within the user's request; package-registry access may still be unavailable.

## Alternatives Considered

- One repository per platform: defer until real ownership or independent-release needs justify the cost.
- A copyleft license: not selected because broad integration is the stated aim.
- A shared portfolio service: unnecessary for an offline editing library and incompatible with strict portfolio separation.

## Links

- [PRD-0001](../../prds/0001-cross-platform-editors.md)
- [PRD-0002](../../prds/0002-editing-contract-and-release.md)
- [MIT license identifier and text](https://spdx.org/licenses/MIT.html)
