#!/usr/bin/env python3
"""Phase 5 — bulk ingest the priority package list across in-scope distros.

Sources per package (see config/ingest_manifest.yaml):
  - main_docs  : RST pages from ros2/ros2_documentation, distro-branched,
                 parsed into sections (reuses fetch_one.parse_sections).
  - interfaces : .msg/.srv/.action definitions from the package's source repo
                 (per ros/rosdistro), one chunk per file.
  - readme     : the package repo README, one chunk.

Idempotent: re-running refreshes (delete + reinsert) each package's chunks.

Usage:
    .venv/bin/python ingest/ingest_all.py [--dry-run] [--distro jazzy]
"""
import os
import sys
import urllib.request
import urllib.error
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

import yaml
import psycopg2

from fetch_one import parse_sections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, "config")

DB = dict(
    dbname=os.environ.get("PGDATABASE", "ros2docs"),
    user=os.environ.get("PGUSER", "ros2docs"),
    password=os.environ.get("PGPASSWORD", "ros2docs"),
    host=os.environ.get("PGHOST", "127.0.0.1"),
    port=os.environ.get("PGPORT", "5432"),
)
DATABASE_URL = os.environ.get("DATABASE_URL")

RAW = "https://raw.githubusercontent.com/{repo}/{ref}/{path}"
CODELOAD = "https://codeload.github.com/{repo}/tar.gz/refs/heads/{ref}"
FALLBACK_REFS = ["rolling", "master", "main"]
INTERFACE_EXTS = (".msg", ".srv", ".action")
UA = {"User-Agent": "ros2-docs-mcp-ingest"}


def fetch_text(url: str) -> str | None:
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise
    except urllib.error.URLError:
        return None


def fetch_many(urls: list[str], workers: int = 8) -> dict:
    """Fetch a batch of URLs concurrently. Returns {url: text|None}."""
    results = {}
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for url, text in zip(urls, ex.map(fetch_text, urls)):
            results[url] = text
    return results


def resolve_ref(repo: str, refs: list[str]) -> str | None:
    """First ref whose README resolves via raw fetch (distro branch, then fallbacks).

    Uses raw.githubusercontent (not the GitHub API) so unauthenticated rate
    limits never block ingestion.
    """
    for ref in refs:
        url = RAW.format(repo=repo, ref=ref, path="README.md")
        req = urllib.request.Request(url, headers=UA)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp.read()
            return ref
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise
        except urllib.error.URLError:
            pass
    return None


def list_interface_files(repo: str, ref: str, subdirs: list[str]) -> list[str]:
    """Enumerate interface files by listing the repo tarball (no GitHub API)."""
    import io
    import tarfile

    url = CODELOAD.format(repo=repo, ref=urllib.parse.quote(ref))
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        blob = io.BytesIO(resp.read())
    out = []
    with tarfile.open(fileobj=blob, mode="r:gz") as tf:
        for m in tf.getmembers():
            if not m.isfile():
                continue
            parts = m.name.split("/", 1)
            if len(parts) < 2:
                continue
            rel = parts[1]
            if rel.endswith(INTERFACE_EXTS) and any(rel.startswith(sub + "/") for sub in subdirs):
                out.append(rel)
    return out


def refresh_package(conn, package: str, distro: str, chunks: list[dict], source_url: str) -> int:
    """Upsert package row, replace its chunks. Returns number of chunks written.

    In dry-run mode (conn is None) no rows are touched; only the count returns.
    """
    if conn is None:
        return len(chunks)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO packages (name, distro, source_url)
            VALUES (%s, %s, %s)
            ON CONFLICT (name, distro) DO UPDATE SET source_url = EXCLUDED.source_url
            """,
            (package, distro, source_url),
        )
        cur.execute("SELECT id FROM packages WHERE name = %s AND distro = %s", (package, distro))
        package_id = cur.fetchone()[0]
        cur.execute("DELETE FROM doc_chunks WHERE package_id = %s", (package_id,))
        for c in chunks:
            cur.execute(
                """
                INSERT INTO doc_chunks (package_id, distro, section_title, content, source_url)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (package_id, distro, c["title"], c["content"], c["source_url"]),
            )
    return len(chunks)


def ingest_package(conn, pkg_cfg: dict, distro: str) -> dict:
    """Ingest one package for one distro. Returns a result report dict."""
    result = {"package": pkg_cfg["name"], "distro": distro, "chunks": 0,
              "skipped": [], "ref_used": distro}
    if "main_docs" in pkg_cfg:
        urls = ["https://raw.githubusercontent.com/ros2/ros2_documentation/{d}/source/{p}.rst".format(
            d=distro, p=path) for path in pkg_cfg["main_docs"]]
        fetched = fetch_many(urls)
        chunks = []
        for path, url in zip(pkg_cfg["main_docs"], urls):
            text = fetched.get(url)
            if text is None:
                result["skipped"].append(path)
                continue
            for s in parse_sections(text):
                chunks.append({"title": s["title"], "content": s["content"], "source_url": url})
        result["chunks"] += refresh_package(conn, pkg_cfg["name"], distro, chunks,
                                            chunks[0]["source_url"] if chunks else "")
    elif "interfaces" in pkg_cfg:
        repo = pkg_cfg["interfaces"]["repo"]
        ref = resolve_ref(repo, [distro] + FALLBACK_REFS)
        result["ref_used"] = ref or distro
        if ref:
            files = list_interface_files(repo, ref, pkg_cfg["interfaces"]["paths"])
            urls = [RAW.format(repo=repo, ref=ref, path=f) for f in sorted(files)]
            fetched = fetch_many(urls)
            chunks = []
            for f, url in zip(sorted(files), urls):
                text = fetched.get(url)
                if text is None:
                    result["skipped"].append(f)
                    continue
                chunks.append({"title": f, "content": text, "source_url": url})
            result["chunks"] += refresh_package(conn, pkg_cfg["name"], distro, chunks,
                                                chunks[0]["source_url"] if chunks else "")
        else:
            result["skipped"].append("<interface repo unreachable>")
    elif "readme" in pkg_cfg:
        repo = pkg_cfg["readme"]["repo"]
        refs = [pkg_cfg["readme"].get("ref", distro)] + FALLBACK_REFS
        ref = resolve_ref(repo, refs)
        result["ref_used"] = ref or distro
        if ref:
            path = pkg_cfg["readme"].get("path", "README.md")
            url = RAW.format(repo=repo, ref=ref, path=path)
            text = fetch_text(url)
            if text is None:
                result["skipped"].append(path)
            else:
                result["chunks"] += refresh_package(
                    conn, pkg_cfg["name"], distro,
                    [{"title": "README", "content": text, "source_url": url}], url)
    return result


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    distro_filter = None
    if "--distro" in sys.argv:
        distro_filter = sys.argv[sys.argv.index("--distro") + 1]

    with open(os.path.join(CONFIG, "distros.yaml")) as f:
        distros_cfg = yaml.safe_load(f)
    with open(os.path.join(CONFIG, "priority_packages.yaml")) as f:
        priority = yaml.safe_load(f)
    with open(os.path.join(CONFIG, "ingest_manifest.yaml")) as f:
        manifest = yaml.safe_load(f)

    distros = [d["name"] for d in distros_cfg["distros"] if d.get("in_scope")]
    if distro_filter:
        if distro_filter not in distros:
            sys.exit(f"unknown distro {distro_filter}; in-scope: {distros}")
        distros = [distro_filter]

    pkg_order = [p["name"] for p in priority["packages"]]
    pkg_cfgs = {}
    for p in priority["packages"]:
        if p["name"] not in manifest["packages"]:
            sys.exit(f"priority package {p['name']} has no entry in ingest_manifest.yaml")
        pkg_cfgs[p["name"]] = dict(manifest["packages"][p["name"]], name=p["name"])

    conn = None if dry_run else (psycopg2.connect(DATABASE_URL) if DATABASE_URL else psycopg2.connect(**DB))
    try:
        reports = []
        for name in pkg_order:
            cfg = pkg_cfgs[name]
            for distro in distros:
                r = ingest_package(conn, cfg, distro)
                reports.append(r)
                print(f"done: {name}/{distro} -> {r['chunks']} chunks", flush=True)
        if conn:
            conn.commit()
    finally:
        if conn:
            conn.close()

    lines = []
    lines.append(f"ingest report {('(dry-run, no DB writes)' if dry_run else '(DB refreshed)')}")
    lines.append(f"packages x distros processed: {len(reports)}")
    total = sum(r["chunks"] for r in reports)
    lines.append(f"total doc chunks written: {total}")
    lines.append("")
    lines.append(f"{'package':22s} {'distro':8s} {'chunks':>6s}  skipped")
    lines.append("-" * 80)
    for r in sorted(reports, key=lambda r: (r["package"], r["distro"])):
        lines.append(f"{r['package']:22s} {r['distro']:8s} {r['chunks']:6d}  {', '.join(r['skipped'])}")
    report = "\n".join(lines)
    print(report)
    if not dry_run:
        with open(os.path.join(ROOT, "ingest", "last_run_report.txt"), "w") as f:
            f.write(report + "\n")


if __name__ == "__main__":
    main()
