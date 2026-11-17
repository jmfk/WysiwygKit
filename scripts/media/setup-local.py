#!/usr/bin/env python3
"""Provider admission for an isolated bucket and restricted access keys. Status output is redacted."""

import argparse
import json
import os
import secrets
import subprocess
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STABLE = "bep9j4"
PHASE = "configuration"


def run(args, **kwargs):
    return subprocess.run(
        args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs
    )


def private_write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name("." + path.name + "." + str(os.getpid()) + ".tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "w") as out:
            out.write(text)
            out.flush()
            os.fsync(out.fileno())
        os.replace(tmp, path)
        os.chmod(path, 0o600)
    finally:
        tmp.unlink(missing_ok=True)


def main():
    global PHASE
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", required=True, type=Path)
    parser.add_argument("--mc", required=True, type=Path)
    args = parser.parse_args()
    if run(["docker", "context", "show"], text=True).stdout.strip() != "orbstack":
        raise RuntimeError()
    if run(["git", "-C", str(ROOT), "check-ignore", "-q", ".env.local"]).returncode:
        raise RuntimeError()
    provider = args.provider.resolve()
    contract = provider / "consumers" / (STABLE + ".json")
    if not (provider / "AGENTS.md").is_file():
        raise RuntimeError()
    if contract.exists() and json.loads(contract.read_text()).get("project") != str(
        ROOT
    ):
        raise RuntimeError()
    envpath = ROOT / ".env.local"
    values = {}
    if envpath.exists():
        if envpath.is_symlink() or envpath.stat().st_mode & 0o077:
            raise RuntimeError()
        values = dict(
            line.split("=", 1)
            for line in envpath.read_text().splitlines()
            if line and not line.startswith("#") and "=" in line
        )
    bucket = STABLE + "-dev-media"
    namespace = STABLE + "/dev/media"
    expected = {
        "MEDIA_BUCKET": bucket,
        "MEDIA_NAMESPACE": namespace,
        "MEDIA_S3_ENDPOINT": "http://127.0.0.1:10302",
        "MEDIA_S3_REGION": "us-east-1",
        "IMGPROXY_BASE_URL": "http://127.0.0.1:13702",
        "MEDIA_PUBLIC_ORIGIN": "http://127.0.0.1:13701",
    }
    for name, value in expected.items():
        if name in values and values[name] != value:
            raise RuntimeError()
    values.update(expected)
    for key in ["MEDIA_RECEIPT_KEY", "IMGPROXY_KEY", "IMGPROXY_SALT"]:
        if key in values and not values[key]:
            raise RuntimeError()
        values.setdefault(key, secrets.token_hex(32))
    values.update(
        {
            "IMGPROXY_USE_S3": "true",
            "IMGPROXY_S3_REGION": "us-east-1",
            "IMGPROXY_S3_ENDPOINT": "http://minio:9000",
            "IMGPROXY_S3_ENDPOINT_USE_PATH_STYLE": "true",
            "IMGPROXY_ALLOWED_SOURCES": "s3://"
            + bucket
            + "/"
            + namespace
            + "/originals/",
            "IMGPROXY_BIND": ":8080",
            "IMGPROXY_LOG_LEVEL": "error",
            "IMGPROXY_MAX_SRC_FILE_SIZE": "4000000",
            "IMGPROXY_MAX_SRC_RESOLUTION": "32",
            "IMGPROXY_MAX_RESULT_DIMENSION": "2048",
            "IMGPROXY_AUTO_ROTATE": "true",
            "IMGPROXY_DEVELOPMENT_ERRORS_MODE": "false",
        }
    )
    local = ROOT / ".local"
    local.mkdir(exist_ok=True)
    local.chmod(0o700)

    def save():
        private_write(
            envpath, "\n".join(k + "=" + v for k, v in sorted(values.items())) + "\n"
        )

    PHASE = "provider-credentials"
    rootuser = (provider / "secrets/minio_root_user").read_text().strip()
    rootpassword = (provider / "secrets/minio_root_password").read_text().strip()
    if not rootuser or not rootpassword:
        raise RuntimeError()
    child = {
        **os.environ,
        "MC_HOST_local": "http://"
        + urllib.parse.quote(rootuser, safe="")
        + ":"
        + urllib.parse.quote(rootpassword, safe="")
        + "@127.0.0.1:10302",
        "MC_CONFIG_DIR": str(local / "mc"),
    }

    def mc(*arguments):
        result = run([str(args.mc.resolve()), *arguments], env=child, text=True)
        if result.returncode:
            raise RuntimeError()
        return result.stdout

    PHASE = "bucket"
    mc("mb", "--ignore-existing", "local/" + bucket)
    policies = {
        "app": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": ["s3:GetBucketLocation"],
                    "Resource": ["arn:aws:s3:::" + bucket],
                },
                {
                    "Effect": "Allow",
                    "Action": ["s3:GetObject", "s3:PutObject"],
                    "Resource": ["arn:aws:s3:::" + bucket + "/" + namespace + "/*"],
                },
                {
                    "Effect": "Allow",
                    "Action": ["s3:DeleteObject"],
                    "Resource": [
                        "arn:aws:s3:::" + bucket + "/" + namespace + "/staging/*"
                    ],
                },
            ],
        },
        "images": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": ["s3:GetBucketLocation"],
                    "Resource": ["arn:aws:s3:::" + bucket],
                },
                {
                    "Effect": "Allow",
                    "Action": ["s3:GetObject"],
                    "Resource": [
                        "arn:aws:s3:::" + bucket + "/" + namespace + "/originals/*"
                    ],
                },
            ],
        },
    }
    for role, access, secret, marker in [
        ("app", "MEDIA_ACCESS_KEY", "MEDIA_SECRET_KEY", "MEDIA_ADMITTED_APP"),
        (
            "images",
            "AWS_ACCESS_KEY_ID",
            "AWS_SECRET_ACCESS_KEY",
            "MEDIA_ADMITTED_IMAGES",
        ),
    ]:
        PHASE = role + "-admission"
        if values.get(marker) == "true":
            if not values.get(access) or not values.get(secret):
                raise RuntimeError()
            continue
        policy = local / (role + "-policy.json")
        policy.write_text(json.dumps(policies[role]))
        result = json.loads(
            mc(
                "admin",
                "accesskey",
                "create",
                "local/",
                "--policy",
                str(policy),
                "--name",
                STABLE + "-dev-" + role,
                "--json",
            )
        )
        if not result.get("accessKey") or not result.get("secretKey"):
            raise RuntimeError()
        values[access] = result["accessKey"]
        values[secret] = result["secretKey"]
        values[marker] = "true"
        save()
    PHASE = "admission-record"
    contract.write_text(
        json.dumps(
            {
                "systemId": STABLE,
                "project": str(ROOT),
                "portfolio": "neutral",
                "service": "MinIO",
                "bucket": bucket,
                "namespace": namespace,
                "endpoint": "http://127.0.0.1:10302",
                "permissions": "application staging/original/publication; image server read-only originals; no provider lifecycle",
            },
            indent=2,
        )
        + "\n"
    )
    save()
    PHASE = "imgproxy"
    name = STABLE + "-dev-imgproxy"
    imageenv = local / "imgproxy.env"
    imagevalues = {
        k: v
        for k, v in values.items()
        if k.startswith("IMGPROXY_")
        or k in {"AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"}
    }
    imagecontent = "\n".join(k + "=" + v for k, v in sorted(imagevalues.items())) + "\n"
    changed = not imageenv.exists() or imageenv.read_text() != imagecontent
    private_write(imageenv, imagecontent)
    exists = run(
        [
            "docker",
            "--context",
            "orbstack",
            "container",
            "inspect",
            "--format",
            '{{index .Config.Labels "media-workload"}}',
            name,
        ],
        text=True,
    )
    if exists.returncode == 0:
        if exists.stdout.strip() != STABLE:
            raise RuntimeError()
        version = run(
            [
                "docker",
                "--context",
                "orbstack",
                "container",
                "inspect",
                "--format",
                '{{index .Config.Labels "media-config-version"}}',
                name,
            ],
            text=True,
        ).stdout.strip()
        if changed or version != "1":
            if run(["docker", "--context", "orbstack", "rm", "-f", name]).returncode:
                raise RuntimeError()
            exists.returncode = 1
        elif run(["docker", "--context", "orbstack", "start", name]).returncode:
            raise RuntimeError()
    if (
        exists.returncode != 0
        and run(
            [
                "docker",
                "--context",
                "orbstack",
                "run",
                "-d",
                "--name",
                name,
                "--label",
                "media-workload=" + STABLE,
                "--label",
                "media-config-version=1",
                "--network",
                "shared-local-services",
                "-p",
                "127.0.0.1:13702:8080",
                "--env-file",
                str(imageenv),
                "ghcr.io/imgproxy/imgproxy:v4.0.24",
            ]
        ).returncode
    ):
        raise RuntimeError()
    print(
        "media-admission=ready isolated-bucket=ready scoped-credentials=ready imgproxy=ready"
    )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print(
            "media-admission=failed phase=" + PHASE + " (no credential details logged)",
            file=sys.stderr,
        )
        sys.exit(1)
