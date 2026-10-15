#!/usr/bin/env python3
"""Upload to Google Play internal testing using keyless gcloud authentication."""
import argparse
import http.client
import json
from pathlib import Path
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile

SERVICE_ACCOUNT = "caloriesai@caloriesaipublish.iam.gserviceaccount.com"
PACKAGE = "com.rados.keylocalandroidfoodcalorieestimator"
BASE = f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{PACKAGE}/edits"


def request(url, token, method="GET", data=None):
    headers = {"Authorization": f"Bearer {token}"}
    if data is not None:
        data = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            body = response.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"Google API {error.code}: {error.read().decode()}") from None


def publisher_token():
    # Generate an explicitly scoped token; gcloud impersonation may ignore --scopes.
    source = subprocess.check_output(
        ["gcloud", "auth", "print-access-token"], text=True
    ).strip()
    result = request(
        f"https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/{SERVICE_ACCOUNT}:generateAccessToken",
        source, "POST",
        {"scope": ["https://www.googleapis.com/auth/androidpublisher"], "lifetime": "3600s"},
    )
    return result["accessToken"]


def upload_bundle(path, edit, token):
    connection = http.client.HTTPSConnection("androidpublisher.googleapis.com", timeout=900)
    try:
        connection.putrequest("POST", f"/upload/androidpublisher/v3/applications/{PACKAGE}/edits/{edit}/bundles?uploadType=media")
        connection.putheader("Authorization", f"Bearer {token}")
        connection.putheader("Content-Type", "application/octet-stream")
        connection.putheader("Content-Length", str(path.stat().st_size))
        connection.endheaders()
        with path.open("rb") as bundle:
            while chunk := bundle.read(1024 * 1024):
                connection.send(chunk)
        response = connection.getresponse()
        body = response.read().decode()
        if response.status >= 400:
            raise RuntimeError(f"Upload {response.status}: {body}")
        return json.loads(body)["versionCode"]
    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("aab", nargs="?", type=Path)
    parser.add_argument("--check", action="store_true", help="Check access without publishing")
    parser.add_argument("--name", help="Internal release name")
    args = parser.parse_args()
    if not args.check:
        if not args.aab or not args.aab.is_file():
            parser.error("Provide an existing AAB or use --check")
        with zipfile.ZipFile(args.aab) as bundle:
            if "BundleConfig.pb" not in bundle.namelist():
                parser.error("The file is not an Android App Bundle")
    token = publisher_token()
    edit = request(BASE, token, "POST", {})["id"]
    committed = False
    try:
        track = request(f"{BASE}/{edit}/tracks/internal", token)
        if args.check:
            print("Access OK. Internal releases:")
            for release in track.get("releases", []):
                print(f"  {release.get('name', '')}: {release.get('versionCodes', [])} ({release.get('status', '')})")
            return
        version = upload_bundle(args.aab, edit, token)
        release = {"name": args.name or args.aab.stem, "versionCodes": [str(version)], "status": "completed"}
        # Keep release notes from the previous internal release where available.
        previous = next((r for r in track.get("releases", []) if r.get("status") == "completed"), {})
        if previous.get("releaseNotes"):
            release["releaseNotes"] = previous["releaseNotes"]
        request(f"{BASE}/{edit}/tracks/internal", token, "PUT", {"track": "internal", "releases": [release]})
        request(f"{BASE}/{edit}:validate", token, "POST")
        request(f"{BASE}/{edit}:commit", token, "POST")
        committed = True
        print(f"Published version {version} to internal testing.")
    finally:
        if not committed:
            request(f"{BASE}/{edit}", token, "DELETE")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
