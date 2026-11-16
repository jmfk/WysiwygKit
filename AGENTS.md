# Project instructions

- Use English for code, API names, repository metadata and developer documentation. Runtime catalogs and content samples may use their declared languages.
- Read `specs/index.md` before changing scope. Preserve locked PRD requirements and decision history.
- Keep core editing independent of mandatory backend services. Product/application data, credentials and deployment settings belong to the consuming application.
- Preserve the shared engine/command/codec behavior across plain web, React, SwiftUI and WPF. Do not reimplement codecs in platform adapters.
- Source lives in `packages/`; demos live in separate `demos/` directories. Generated native resources are rebuilt with `npm run build`.
- Run the narrowest meaningful checks while iterating; before publication run the coherent verification gate and record platform limitations honestly.
- Add focused regression coverage for meaningful editing/serialization defects. Do not claim a native runtime is verified solely because it cross-compiles.
- Never commit credentials, private documents, build caches or `.DS_Store` files. Delete `.DS_Store` files when encountered.
