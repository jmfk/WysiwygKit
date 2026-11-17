# S3-compatible storage and imgproxy

The optional `@wysiwygkit/media` browser client and server-only `@wysiwygkit/media-server` integrate an existing host with S3-compatible storage and OSS imgproxy. They do not add a mandatory service to editing. The Node reference host is a **loopback development demo**; consuming applications own authentication, per-user/document/asset authorization, quotas, bucket lifecycle and deployments. No Go service or production deployment is included.

## Try the demos

Install dependencies and build with `npm ci && npm run build`. Run `npm run dev` and the media API in another terminal. Open [plain web](http://127.0.0.1:13700/demos/media/) or [React](http://127.0.0.1:13700/demos/media-react/).

The demos upload JPEG/PNG/still WebP (4 MB, 32 megapixels maximum), edit per-placement focus, reuse an original, show wide/square/portrait server crops, save/restore a portable snapshot and explicitly publish responsive HTML. The two demos share all media behavior. Existing native demos still use local images; native hosts can implement the same upload/resolve HTTP contract in their asset delegates, with application-owned authentication.

### Shared local development provider

On this machine use OrbStack's `orbstack` context and the registered provider at `/Users/jmfk/code/shared-local-infrastructure`. Its MinIO endpoint is `127.0.0.1:10302`; that provider alone owns its lifecycle and volume. Obtain the official `mc` executable for your platform from [MinIO releases](https://github.com/minio/mc/releases/tag/RELEASE.2025-08-13T08-35-41Z), verify the accompanying checksum and pass the local executable path:

```sh
python3 scripts/media/setup-local.py \
  --provider /Users/jmfk/code/shared-local-infrastructure \
  --mc /path/to/verified/mc
npm run dev:media
```

The redacting admission helper creates only workload `bep9j4`'s bucket `bep9j4-dev-media`, namespace `bep9j4/dev/media`, scoped access keys and provider consumer record. It creates ignored mode-0600 `.env.local`, a separate read-only imgproxy environment and a project-owned stateless imgproxy container on 13702. It never starts/stops the shared MinIO provider or mounts its volume. Do not print environment files or use expanded Docker configuration for debugging.

**Observed 2026-11-17:** the shared provider's data disk is full and writes return HTTP 507. Admission is configured, but this is not a healthy end-to-end demo environment until the provider owner restores space. No other project's data was cleaned. Use the explicit disposable test environment below while that operational problem remains.

### Disposable provider tests and demo environment

The separate test stack is an explicit ephemeral-test exception: isolated network, different identities/bucket, MinIO data in a 256 MiB RAM filesystem, no named or shared volumes. `down` removes only containers bearing its exact ownership label. Starting it again discards **only its own test data**, so saved test snapshots then reference missing assets.

```sh
# Use the exact locally installed compatible MinIO image ID or a verified test image.
python3 scripts/media/test-stack.py up \
  --mc /path/to/verified/mc --minio-image <verified-minio-image>
node --env-file=.local/media-test.env demos/media/server.mjs
# In another terminal: npm run dev
```

The tested MinIO release is `RELEASE.2025-09-07T16-13-09Z`; imgproxy is pinned to `ghcr.io/imgproxy/imgproxy:v4.0.24`. The test script expects the image's MinIO binary at `/usr/bin/minio`. CI builds a disposable image from the checksum-pinned official Linux MinIO release using `scripts/media/ci-fixtures.sh`, avoiding unavailable historic container tags. MinIO/mc and imgproxy retain their own upstream licenses; they are not relicensed by this MIT repository.

Reserved ports: web 13700, loopback API 13701, development imgproxy 13702, disposable S3 13703, disposable imgproxy 13704. The default script requires the active OrbStack context; `--context ''` is only for the CI runner's Docker engine.

```sh
node --env-file=.local/media-test.env node_modules/vitest/vitest.mjs run --config vitest.media.config.ts
# Stop any separately started API first; Playwright starts its own API on 13701.
npm run test:media:browser
python3 scripts/media/test-stack.py down
```

For the admitted shared provider, `npm run test:media` uses `.env.local`. Provider regressions create small fixtures in the selected test namespace. They do not clean other namespaces or delete finalized originals. Traces, screenshots, videos and network artifact uploads are disabled for media browser tests because short-lived capabilities must not become test artifacts.

## Integrate an existing host

```ts
// Browser only. The host supplies its normal application authorization headers/session.
import { createMediaClient } from '@wysiwygkit/media'
const media = createMediaClient(location.origin)
const editor = createEditor(element, {
  document,
  uploadImage: media.uploadImage,
  resolveAsset: media.resolveAsset,
})
await editor.ready
const captured = editor.getHTMLSnapshot()
const published = await media.publishHTML(captured)
// Publish published.html only after the application's normal publishing decision.
// Persist editor.getSnapshot() separately; publication does not acknowledge a save.
```

```ts
// Server only. Never import this library or its configuration into a client bundle.
import { S3MediaHost } from '@wysiwygkit/media-server'
const host = new S3MediaHost({
  s3, bucket, namespace,
  receiptKey, // >=32 random bytes, stable across ordinary host restarts
  imgproxy: { url: internalImageServerURL, key: signingKey, salt: signingSalt },
  publicOrigin: applicationOrigin,
})
// Call host methods only after authorizing the caller for the target document/asset.
```

The reference HTTP mapping is implemented in [the demo host](../demos/media/server.mjs):

| Method/path | Input | Result |
| --- | --- | --- |
| POST `/api/media/uploads` | size, MIME type, SHA-256 hex | five-minute presigned PUT plan and signed finalization receipt |
| POST `/api/media/complete` | receipt | verified durable asset, including oriented dimensions |
| POST `/api/media/resolve` | asset ID/version and bounded variant | private host capability, dimensions and expiry |
| GET `/api/media/preview/:capability` | expiring scoped capability | no-store image bytes |
| POST `/api/media/publish` | asset ID/version, placement focus/aspect | immutable public manifest and bounded responsive variants |
| GET `/media/published/:manifest/:width.webp` | previously published manifest and permitted width | public cacheable image bytes |

Every POST needs real application authorization in production. The demo's `x-wysiwyg-demo: 1`, Host/Origin allowlists and loopback binding express browser intent for local development; they are not user authentication. The reference host limits decode/render work to two active jobs and eight waiting jobs. A production host must add its own admission/rate limits, deadlines, allowed origins, S3 CORS, storage quotas and appropriate publication policy. Avoid logging request bodies, presigned URLs, capabilities or SDK configuration.

## Integrity and delivery model

- The browser has no storage or signing key. PUT is limited to a unique staging object with a signed content type/checksum. A PUT grant is replayable until expiry; it never addresses a finalized original. Declared size is checked against captured bytes during finalization, not enforced as an S3 POST policy at upload time.
- Finalization captures at most 4 MB, verifies exact size/digest, validates detected format and fully decodes with a 32 megapixel bound. Only that captured byte sequence is stored at a different immutable key using `If-None-Match: *`; verified dimensions/digest are atomically stored in S3 metadata. Retry/restart reads that metadata. EXIF orientation precedes focal coordinates. SVG and animated images are rejected.
- The application runtime can read/write its namespace and delete staging objects only. imgproxy gets read-only access to finalized originals, a source-prefix restriction, source limits and required signing. Bucket administration, retention, orphan cleanup, deletion and backups belong to the host/provider owner. Treat arbitrary objects outside the library's verified write path as untrusted.
- Snapshots contain `asset:id@version` references and independent occurrence metadata. Delivery refresh does not change source, revision, dirty state, history or selection. Existing string resolvers remain compatible; web resolvers may additionally return `{url, expiresAt}` for automatic refresh.
- Private previews expire at the host. An imgproxy transform signature alone is not reader authentication. Public output requires explicit publication; no private preview capability or storage URL enters HTML. Public manifest routes survive imgproxy key rotation, provided the host and image server rotate together. Published content remains public; revocation/cache invalidation is a host concern.
- Focal coordinates are normalized in oriented original-image space, independent of UI reading direction. Regression images compare actual imgproxy pixels with the shared `focalCover` geometry at edges and intermediate focus positions. No AI/smart crop or custom image-processing service is added.

`publishHTML` accepts the trusted, sanitized result of `getHTMLSnapshot()`, resolves its managed images in order and returns the captured document ID/revision with HTML. It is not an arbitrary HTML sanitizer. Unmanaged external images require an explicit host policy and are rejected by this helper. Editing can continue while a captured revision publishes.

Compatibility evidence is for the pinned MinIO/imgproxy versions only, not certification of AWS, R2 or every S3 implementation. Other providers must pass the same conditional-write/checksum/permissions/CORS tests. Direct focal gravity, S3 conditional writes and signing follow [imgproxy processing](https://docs.imgproxy.net/usage/processing), [imgproxy signing](https://docs.imgproxy.net/usage/signing_url) and [S3 PutObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html).
