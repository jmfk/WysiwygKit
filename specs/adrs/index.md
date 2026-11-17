# ADR Index

Accepted decisions record the selected planning architecture. They do not imply separate user sign-off, implementation evidence or infrastructure/deployment approval. ADR-0009–0013 supplement existing core decisions; optional Go artifacts remain conditional rather than mandatory runtime dependencies.

## Active Decisions

| ID | Title | Status | Related PRDs |
| --- | --- | --- | --- |
| ADR-0002 | [Product-neutral monorepo and MIT licensing](active/0002-monorepo-and-licensing.md) | accepted | PRD-0001, PRD-0002 |
| ADR-0003 | [Shared editor engine and platform adapters](active/0003-shared-engine-and-adapters.md) | accepted | PRD-0001, PRD-0002 |
| ADR-0004 | [Format fidelity and document ownership](active/0004-format-fidelity.md) | accepted | PRD-0001, PRD-0002 |
| ADR-0005 | [Public API and versioned native bridge](active/0005-api-and-native-bridge.md) | accepted | PRD-0001, PRD-0002 |
| ADR-0006 | [Shared UI, themes and accessible commands](active/0006-shared-ui-and-accessibility.md) | accepted | PRD-0001, PRD-0002 |
| ADR-0007 | [Offline engine, host-owned assets and untrusted content](active/0007-assets-and-security.md) | accepted | PRD-0001, PRD-0002 |
| ADR-0008 | [Verification, packaging and coordinated releases](active/0008-verification-and-releases.md) | accepted | PRD-0001, PRD-0002 |
| ADR-0009 | [Independent UI locale, content language and direction](active/0009-locales-and-text-direction.md) | accepted | PRD-0002, PRD-0003 |
| ADR-0010 | [Portable source metadata and non-destructive images](active/0010-portable-media-metadata.md) | accepted | PRD-0002, PRD-0003, PRD-0004 |
| ADR-0011 | [Separate storage, asset identity and image delivery](active/0011-storage-and-image-delivery.md) | accepted | PRD-0004, PRD-0005 |
| ADR-0012 | [One optional Go companion with binaries and OCI images](active/0012-optional-go-companion.md) | accepted | PRD-0004, PRD-0005, PRD-0006 |
| ADR-0013 | [Scope gates, editing productivity and host-owned recovery](active/0013-scope-and-host-owned-recovery.md) | accepted | PRD-0002, PRD-0003, PRD-0004, PRD-0005, PRD-0006 |
| ADR-0014 | [S3 and imgproxy reference integration](active/0014-s3-imgproxy-reference-integration.md) | accepted | PRD-0004 |

## Archived Decisions

| ID | Title | Status | Replacement |
| --- | --- | --- | --- |
| ADR-0001 | [Shared editor engine and native adapters](archive/0001-shared-editor-engine.md) | superseded | ADR-0002–0008 |
