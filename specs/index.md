# WysiwygKit specifications

WysiwygKit is a product-neutral, permissively licensed family of Markdown, HTML and Fountain editors for web, React, SwiftUI and Windows WPF. Development language is English; runtime UI is localizable and content can be multilingual.

Start with [PRD-0002: Editing contract and first public release](prds/0002-editing-contract-and-release.md). [PRD-0001](prds/0001-cross-platform-editors.md) preserves the original started baseline. [PRD-0006](prds/0006-editor-productivity-and-scope.md) explains the recommended scope and feature priorities.

## What belongs where

| Layer | Scope | Requirements |
| --- | --- | --- |
| Core first release | Existing three-format editing, independent UI/content language and direction, Unicode/IME, portable optional metadata, stable image references, find/replace, links/paste and safe save/recovery hooks | PRD-0002, [PRD-0003](prds/0003-internationalization-and-content-languages.md), core portions of [PRD-0004](prds/0004-media-and-image-integrations.md) and [PRD-0006](prds/0006-editor-productivity-and-scope.md) |
| Optional first integrations | Manual image focus, aspect previews, responsive/publish resolution, local adapter, one S3-compatible recipe and imgproxy reference adapter | [PRD-0004](prds/0004-media-and-image-integrations.md) |
| Next editor increment | Navigable heading/scene outline and locale-aware counts | [PRD-0006](prds/0006-editor-productivity-and-scope.md) |
| Conditional later companion | One Go media gateway; Linux executables and multi-architecture OCI images after an actual consumer gap is demonstrated | [PRD-0005](prds/0005-optional-go-media-companion.md) |
| Deferred/outside current product | Full DAM, collaboration service, accounts, translation management, custom image processor, hosted storage/CDN and AI services | Explicitly excluded by the current PRDs |

Core editing requires no backend. Object storage, image delivery and application persistence are host-owned. Reusable code/images never merge product/environment runtime identities or data.

## Architecture

The [active ADRs](adrs/index.md) cover a shared editor engine, thin platform adapters, explicit format fidelity, typed native bridge, common themes, offline assets and layered verification. New ADR-0009–0013 add localization, portable metadata, media boundaries, conditional Go packaging and scope/recovery decisions.

## Current state

An early implementation now includes all four library surfaces and separate demos. PRD-0002/0003/0004/0006 are in progress; PRD-0005 remains a conditional draft. [Implementation status](../docs/status.md) records verified tests/builds and remaining acceptance work. Runtime translation review, full provider integrations and a stable release are not complete.

## Indexes

- [Product requirements](prds/index.md)
- [Architecture decision records](adrs/index.md)

## Maintenance

Started PRD requirements are immutable; append implementation notes or add a successor PRD for scope changes. Accepted ADRs belong in `adrs/active/`; preserve superseded decision history in `adrs/archive/`. Update indexes and related references together.
