---
id: PRD-0001
title: Cross-platform editing libraries
status: started
locked: true
created: 2026-11-16
related_adrs: [ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0008]
---

# Cross-platform editing libraries

## Problem
Applications repeatedly need consistent rich editing for Markdown, web HTML and Fountain on web, Apple platforms and Windows.

## Goals
- Provide reusable open source libraries with consistent features and appearance.
- Provide separate working demos, tests and regression suites.

## Requirements
- English is the project language for code, API, UI, documentation and repository metadata.
- Publish a public GitHub repository under a permissive MIT license.
- Support Markdown and HTML rich editing with images, tables, inline formatting, lists and undo/redo.
- Support Fountain screenplay editing, import and export with screenplay block types.
- Provide framework-independent web, React, SwiftUI (macOS/iOS) and C# WPF adapters.
- Use a shared engine, command catalog and semantic light/dark/system theme.
- Keep application data local; allow hosts to supply image storage.
- Provide automated format, security, browser interaction and visual regression tests plus platform build checks.
- Include demos in separate directories and documented setup and limitations.

## Acceptance Criteria
- Each adapter can load, edit and export all three supported formats.
- Markdown and HTML demos can insert images and edit tables.
- Fountain demo can change screenplay block type and retains screenplay metadata on export.
- Shared regression suite exercises format round trips, undo/redo, unsafe input and browser keyboard interaction.
- Platform-specific CI builds Swift and Windows packages and demos.

## Constraints
- No paid editor service or proprietary editor feature is required.
- Consistency may use a bundled web engine inside platform-native containers.
- No claim of lossless conversion for arbitrary HTML, arbitrary Markdown extensions or cross-format conversion.

## Implementation Notes
- Implementation started 2026-11-16.
- 2026-11-16: Only workspace scaffolding and documentation exist; editor and adapter implementation has not been verified. The detailed acceptance contract is in [PRD-0002](0002-editing-contract-and-release.md). The original requirements above remain unchanged.

- 2026-11-16: The follow-up introduces localized runtime UI, content languages/direction and optional media/backend scope in [PRD-0003](0003-internationalization-and-content-languages.md), [PRD-0004](0004-media-and-image-integrations.md), [PRD-0005](0005-optional-go-media-companion.md) and [PRD-0006](0006-editor-productivity-and-scope.md). These newer requirements clarify the original English-UI baseline; development language remains English.

## Linked ADRs
- [ADR-0001](../adrs/archive/0001-shared-editor-engine.md)

- ADR-0001 is superseded by [the active decisions](../adrs/index.md).

## Completion Evidence
- Pending.
