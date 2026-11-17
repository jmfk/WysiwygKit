#!/usr/bin/env bash
# Disposable CI fixture; no host data or provider credentials. Official binaries are checksum pinned.
set -euo pipefail
fixture_dir="${RUNNER_TEMP:?CI runner required}/wysiwyg-media-fixtures"
mkdir -p "$fixture_dir"
gh release download RELEASE.2025-09-07T16-13-09Z --repo minio/minio --pattern minio.linux-amd64.RELEASE.2025-09-07T16-13-09Z --dir "$fixture_dir"
gh release download RELEASE.2025-08-13T08-35-41Z --repo minio/mc --pattern mc.linux-amd64.RELEASE.2025-08-13T08-35-41Z --dir "$fixture_dir"
cd "$fixture_dir"
echo '7c5bd8512c6e966455b1d198209358b2d191c77a83ab377c4073281065fb855f  minio.linux-amd64.RELEASE.2025-09-07T16-13-09Z' | sha256sum --check --status
echo '01f866e9c5f9b87c2b09116fa5d7c06695b106242d829a8bb32990c00312e891  mc.linux-amd64.RELEASE.2025-08-13T08-35-41Z' | sha256sum --check --status
mv minio.linux-amd64.RELEASE.2025-09-07T16-13-09Z minio
mv mc.linux-amd64.RELEASE.2025-08-13T08-35-41Z mc
chmod +x minio mc
# Reuse the pinned image-server base; avoid unavailable historic MinIO Docker tags.
cat > Dockerfile <<'DOCKER'
FROM ghcr.io/imgproxy/imgproxy:v4.0.24
COPY --chmod=755 minio /usr/bin/minio
DOCKER
docker build -t bep9j4-test-minio:2025-09-07 .
