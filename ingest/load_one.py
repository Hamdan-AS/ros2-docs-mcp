#!/usr/bin/env python3
"""Phase 3 — fetch one doc page, parse into sections, load into Postgres.

Reuses fetch_one.py's fetch/parse. Inserts the package row (idempotent via
ON CONFLICT) and one doc_chunks row per section.

Usage:
    .venv/bin/python ingest/load_one.py <path-in-repo> [--distro jazzy] [--package tf2]

Example:
    .venv/bin/python ingest/load_one.py Tutorials/Intermediate/Tf2/Tf2-Main.rst --package tf2
"""
import os
import sys

import psycopg2

from fetch_one import BASE, fetch, parse_sections

DB = dict(
    dbname=os.environ.get("PGDATABASE", "ros2docs"),
    user=os.environ.get("PGUSER", "ros2docs"),
    password=os.environ.get("PGPASSWORD", "ros2docs"),
    host=os.environ.get("PGHOST", "127.0.0.1"),
    port=os.environ.get("PGPORT", "5432"),
)
DATABASE_URL = os.environ.get("DATABASE_URL")


def connect():
    return psycopg2.connect(DATABASE_URL) if DATABASE_URL else psycopg2.connect(**DB)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    distro = "jazzy"
    package = None
    if "--distro" in sys.argv:
        distro = sys.argv[sys.argv.index("--distro") + 1]
    if "--package" in sys.argv:
        package = sys.argv[sys.argv.index("--package") + 1]
    if not args:
        sys.exit(__doc__)
    path = args[0]
    if package is None:
        package = path.split("/")[-1].split(".rst")[0]

    url = BASE.format(distro=distro, path=path)
    sections = parse_sections(fetch(url))

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO packages (name, distro, source_url)
                VALUES (%s, %s, %s)
                ON CONFLICT (name, distro) DO NOTHING
                """,
                (package, distro, url),
            )
            cur.execute(
                "SELECT id FROM packages WHERE name = %s AND distro = %s",
                (package, distro),
            )
            package_id = cur.fetchone()[0]
            for s in sections:
                cur.execute(
                    """
                    INSERT INTO doc_chunks (package_id, distro, section_title, content, source_url)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (package_id, distro, s["title"], s["content"], url),
                )
    print(f"loaded {len(sections)} sections for {package}/{distro} <- {url}")


if __name__ == "__main__":
    main()
