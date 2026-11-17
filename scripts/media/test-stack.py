#!/usr/bin/env python3
"""Explicit disposable-test exception: RAM-backed S3, isolated network, no shared volumes."""

import argparse
import json
import os
import secrets
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NAME = "bep9j4-test"
PHASE = "configuration"


def run(args, **kwargs):
    return subprocess.run(
        args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs
    )


def private_write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.parent.chmod(0o700)
    temp = path.with_name("." + path.name + ".tmp")
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "w") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def main():
    global PHASE
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["up", "down"])
    parser.add_argument("--mc", type=Path)
    parser.add_argument("--minio-image")
    parser.add_argument("--context", default="orbstack")
    args = parser.parse_args()
    docker = ["docker", "--context", args.context] if args.context else ["docker"]
    if args.action == "up" and (
        not args.mc or not args.mc.is_file() or not args.minio_image
    ):
        raise RuntimeError()
    if (
        args.context == "orbstack"
        and run(["docker", "context", "show"], text=True).stdout.strip() != "orbstack"
    ):
        raise RuntimeError()
    for suffix in ["imgproxy", "s3"]:
        name = NAME + "-" + suffix
        state = run(
            docker
            + [
                "inspect",
                "--format",
                '{{index .Config.Labels "disposable-media-test"}}',
                name,
            ],
            text=True,
        )
        if state.returncode == 0:
            if state.stdout.strip() != NAME:
                raise RuntimeError()
            if run(docker + ["rm", "-f", name]).returncode:
                raise RuntimeError()
    network = run(
        docker
        + [
            "network",
            "inspect",
            "--format",
            '{{index .Labels "disposable-media-test"}}',
            NAME,
        ],
        text=True,
    )
    if network.returncode == 0:
        if network.stdout.strip() != NAME:
            raise RuntimeError()
        if run(docker + ["network", "rm", NAME]).returncode:
            raise RuntimeError()
    if args.action == "down":
        print("disposable-media-stack=removed (shared provider untouched)")
        return
    if not args.mc or not args.minio_image:
        raise RuntimeError()
    run(
        docker
        + ["network", "create", "--label", "disposable-media-test=" + NAME, NAME],
        check=True,
    )
    local = ROOT / ".local/media-test"
    local.mkdir(parents=True, exist_ok=True)
    local.chmod(0o700)
    rootuser = secrets.token_hex(12)
    rootpassword = secrets.token_hex(32)
    rootenv = local / "root.env"
    private_write(
        rootenv,
        "MINIO_ROOT_USER=" + rootuser + "\nMINIO_ROOT_PASSWORD=" + rootpassword + "\n",
    )
    PHASE = "test-s3"
    if run(
        docker
        + [
            "run",
            "-d",
            "--name",
            NAME + "-s3",
            "--label",
            "disposable-media-test=" + NAME,
            "--network",
            NAME,
            "--network-alias",
            "media-s3",
            "--tmpfs",
            "/data:rw,noexec,nosuid,size=268435456",
            "--memory",
            "1g",
            "-p",
            "127.0.0.1:13703:9000",
            "--env-file",
            str(rootenv),
            "--entrypoint",
            "/usr/bin/minio",
            args.minio_image,
            "server",
            "/data",
            "--address",
            ":9000",
        ]
    ).returncode:
        raise RuntimeError()
    for attempt in range(50):
        try:
            with urllib.request.urlopen(
                "http://127.0.0.1:13703/minio/health/live", timeout=2
            ) as response:
                if response.status == 200:
                    break
        except Exception:
            time.sleep(0.2)
    else:
        raise RuntimeError()
    bucket = NAME + "-media"
    namespace = NAME + "/media"
    child = {
        **os.environ,
        "MC_HOST_test": "http://"
        + urllib.parse.quote(rootuser, safe="")
        + ":"
        + urllib.parse.quote(rootpassword, safe="")
        + "@127.0.0.1:13703",
        "MC_CONFIG_DIR": str(local / "mc"),
    }

    def mc(*parts):
        result = run([str(args.mc.resolve()), *parts], env=child, text=True)
        if result.returncode:
            raise RuntimeError()
        return result.stdout

    PHASE = "test-identities"
    mc("mb", "test/" + bucket)
    policy = {
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
                "Resource": ["arn:aws:s3:::" + bucket + "/" + namespace + "/staging/*"],
            },
        ],
    }
    policy_path = local / "app-policy.json"
    policy_path.write_text(json.dumps(policy))
    app = json.loads(
        mc(
            "admin",
            "accesskey",
            "create",
            "test/",
            "--policy",
            str(policy_path),
            "--json",
        )
    )
    policy["Statement"] = policy["Statement"][:1] + [
        {
            "Effect": "Allow",
            "Action": ["s3:GetObject"],
            "Resource": ["arn:aws:s3:::" + bucket + "/" + namespace + "/originals/*"],
        }
    ]
    policy_path = local / "image-policy.json"
    policy_path.write_text(json.dumps(policy))
    reader = json.loads(
        mc(
            "admin",
            "accesskey",
            "create",
            "test/",
            "--policy",
            str(policy_path),
            "--json",
        )
    )
    values = {
        "MEDIA_BUCKET": bucket,
        "MEDIA_NAMESPACE": namespace,
        "MEDIA_S3_ENDPOINT": "http://127.0.0.1:13703",
        "MEDIA_S3_REGION": "us-east-1",
        "MEDIA_ACCESS_KEY": app["accessKey"],
        "MEDIA_SECRET_KEY": app["secretKey"],
        "AWS_ACCESS_KEY_ID": reader["accessKey"],
        "AWS_SECRET_ACCESS_KEY": reader["secretKey"],
        "MEDIA_RECEIPT_KEY": secrets.token_hex(32),
        "IMGPROXY_KEY": secrets.token_hex(32),
        "IMGPROXY_SALT": secrets.token_hex(32),
        "IMGPROXY_BASE_URL": "http://127.0.0.1:13704",
        "MEDIA_PUBLIC_ORIGIN": "http://127.0.0.1:13701",
    }
    private_write(
        ROOT / ".local/media-test.env",
        "\n".join(k + "=" + v for k, v in sorted(values.items())) + "\n",
    )
    image = {
        k: v
        for k, v in values.items()
        if k
        in [
            "IMGPROXY_KEY",
            "IMGPROXY_SALT",
            "AWS_ACCESS_KEY_ID",
            "AWS_SECRET_ACCESS_KEY",
        ]
    }
    image.update(
        {
            "IMGPROXY_USE_S3": "true",
            "IMGPROXY_S3_REGION": "us-east-1",
            "IMGPROXY_S3_ENDPOINT": "http://media-s3:9000",
            "IMGPROXY_S3_ENDPOINT_USE_PATH_STYLE": "true",
            "IMGPROXY_ALLOWED_SOURCES": "s3://"
            + bucket
            + "/"
            + namespace
            + "/originals/",
            "IMGPROXY_LOG_LEVEL": "error",
            "IMGPROXY_BIND": ":8080",
            "IMGPROXY_AUTO_ROTATE": "true",
            "IMGPROXY_MAX_SRC_FILE_SIZE": "4000000",
            "IMGPROXY_MAX_SRC_RESOLUTION": "32",
            "IMGPROXY_MAX_RESULT_DIMENSION": "2048",
            "IMGPROXY_DEVELOPMENT_ERRORS_MODE": "false",
        }
    )
    imageenv = local / "imgproxy.env"
    private_write(
        imageenv, "\n".join(k + "=" + v for k, v in sorted(image.items())) + "\n"
    )
    PHASE = "test-imgproxy"
    if run(
        docker
        + [
            "run",
            "-d",
            "--name",
            NAME + "-imgproxy",
            "--label",
            "disposable-media-test=" + NAME,
            "--network",
            NAME,
            "-p",
            "127.0.0.1:13704:8080",
            "--env-file",
            str(imageenv),
            "ghcr.io/imgproxy/imgproxy:v4.0.24",
        ]
    ).returncode:
        raise RuntimeError()
    for attempt in range(50):
        try:
            with urllib.request.urlopen(
                "http://127.0.0.1:13704/health", timeout=2
            ) as response:
                if response.status == 200:
                    break
        except Exception:
            time.sleep(0.2)
    else:
        raise RuntimeError()
    print("disposable-media-stack=ready storage=RAM namespace=isolated")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print(
            "disposable-media-stack=failed phase=" + PHASE + " (details redacted)",
            file=sys.stderr,
        )
        sys.exit(1)
