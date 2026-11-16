# Contributing

Code, public API names and developer documentation use English. Runtime translation catalogs are intentionally multilingual. Keep original code MIT-compatible and preserve dependency notices.

Read `specs/index.md` and the relevant PRD/ADRs before changing behavior. Started PRD requirements are immutable; record meaningful design changes in an ADR and update indexes. Mark incomplete capabilities as planned rather than claiming support.

## Development

```sh
npm ci
npm run dev
npm run format
npm run typecheck
npm test
npm run build
```

Run focused checks while iterating. Before a coherent release or PR, run `npm run verify`, `node scripts/check-assets.mjs`, `python3 scripts/check-specs.py` and the affected native checks. Browser regression tests use Playwright Chromium, Firefox and WebKit. Install them with `npx playwright install chromium firefox webkit`.

`npm run test:visual` uses committed per-browser/macOS baselines. Update with `npm run test:update-snapshots` only after inspecting the rendered change. Functional CI runs without visual baselines so a different OS/font renderer does not silently overwrite them. New OS visual support needs its own reviewed baselines.

## Regression cases

Add a focused fixture for content loss, selection/history, schema changes or security defects. Assert user-visible semantics and same-format reload, not an internal implementation detail. Use synthetic or compatibly licensed documents. Never commit private manuscripts, user uploads or credentials.

Do not add mandatory backend services, provider credentials or product-specific configuration to the core. Keep demos outside library directories. Build native resources from `packages/native/bridge.ts`; never edit generated `Resources/editor` files. Native hosts must use the exact corresponding protocol/engine version.

## Native checks

- Apple: `swift test`, `swift build --package-path demos/swift`, and the iOS demo's documented simulator build. Real WKWebView tests run on macOS.
- Windows: `dotnet build demos/windows`, then `dotnet run --project tests/windows` on a Windows desktop with WebView2 Runtime. Cross-compiling on macOS is only a build check.
- Actual IME, VoiceOver/Narrator, touch and translation review remain manual acceptance evidence.

Batch related changes by workflow. Reuse passing evidence for unchanged code, verify locally before pushing, and avoid cosmetic micro PRs. Delete `.DS_Store` files rather than committing them.
