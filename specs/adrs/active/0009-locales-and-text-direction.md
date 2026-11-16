---
id: ADR-0009
title: Independent UI locale, content language and direction
status: accepted
date: 2026-11-16
related_prds: [PRD-0002, PRD-0003]
supersedes: []
superseded_by: []
---

# ADR-0009: Independent UI locale, content language and direction

Accepted records the selected planning direction, not separate user sign-off, a shipped feature or permission to provision/deploy infrastructure. Referenced PRDs remain draft until implementation starts.

## Context

A multilingual editor must distinguish translated controls from authored content. Text language, script, direction and file encoding are related but not interchangeable. The requirement for English project language remains useful for development even when runtime UI is translated.

## Decision

Keep four independent settings: effective UI locale, UI direction, default content language and document direction. Content blocks/ranges can override language/direction where supported. Use BCP 47 tags, semantic `lang`/`dir`/`bdi` markup and logical CSS. Changing UI locale is a presentation change; changing authored language/direction metadata is a document transaction with undo and a new revision.

English remains the default catalog and development language. Add Swedish and Arabic catalogs as the first multilingual proof; validate message keys, interpolation and actual translation review. Support host catalog overrides through one small message lookup interface. No translation management service or large localization platform is required.

Use Unicode internally and UTF-8 for file/API bytes. Preserve source normalization and meaningful control/joiner characters. The shared editor engine owns text edits and positions; exposed positions declare units and revision rather than assuming byte, UTF-16 and Swift character offsets are equal. Use runtime segmentation and native input methods instead of implementing a shaping engine.

Use HTML's supported standard language/direction attributes for HTML persistence. Carry metadata without portable Markdown/Fountain syntax in the optional sidecar from [ADR-0010](0010-portable-media-metadata.md). An HTML fragment export also returns default root attributes for the publishing host; an embedded editor must not mutate its application's document root.

Distinct translated content versions remain separate host-owned documents. The library handles mixed-language content, optional language metadata and per-occurrence localized alt/captions, not translation synchronization or automatic translation.

## Rationale

Separating the settings avoids an Arabic toolbar accidentally reinterpreting an English screenplay. A small localization contract and real RTL tests cost less than retrofitting physical-layout assumptions and English strings later.

## Consequences

- Internationalization and mixed-script input are first-release foundations across every supported adapter.
- Sanitization allows the declared safe language/direction metadata; blanket removal would violate fidelity.
- RTL does not reverse source order, image coordinate systems, URLs or code.
- Native menus, IME and screen readers need platform evidence beyond browser snapshots.
- Legacy encoding converters and translation workflows remain host responsibilities.

## Alternatives Considered

- One locale setting controlling all content: rejected because UI and authoring language differ.
- Select direction from language alone: rejected because scripts and mixed runs need independent control.
- Retrofitting i18n after the API stabilizes: rejected due to avoidable schema/UI changes.
- Shipping an unreviewed RTL catalog as a verified translation: rejected; review status must be honest.

## Links

- [PRD-0003](../../prds/0003-internationalization-and-content-languages.md)
- [W3C language metadata](https://www.w3.org/International/questions/qa-html-language-declarations)
- [W3C direction guidance](https://www.w3.org/International/questions/qa-html-dir)
- [Unicode text segmentation](https://www.unicode.org/reports/tr29/)
