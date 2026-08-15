#!/usr/bin/env python3
"""Phase 2 — fetch one doc file from ros2/ros2_documentation and print clean sections.

Usage:
    python3 ingest/fetch_one.py <path-in-repo> [--distro jazzy]

Example:
    python3 ingest/fetch_one.py Tutorials/Intermediate/Tf2/Tf2-Main.rst
"""
import re
import sys
import urllib.request
import urllib.error

DEFAULT_DISTRO = "jazzy"
BASE = "https://raw.githubusercontent.com/ros2/ros2_documentation/{distro}/source/{path}"


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "ros2-docs-mcp-ingest"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        sys.exit(f"fetch failed: {e.code} {url}")


_INLINE_RE = re.compile(
    r"(:[a-zA-Z0-9_-]+:)?`(?P<label>[^`]+?)( <[^`]+>)?`[_]?"
    r"|``(?P<code>[^`]+)``"
    r"|(?P<url>https?://[^\s]+)"
)


def clean_inline(text: str) -> str:
    def sub(m):
        if m.group("code"):
            return m.group("code")
        if m.group("url"):
            return m.group("url")
        return m.group("label")
    return _INLINE_RE.sub(sub, text)


_HEADER_UNDERLINE = re.compile(r"^([=~^\-`:\'\"])\1{2,}\s*$")


def parse_sections(text: str) -> list:
    """Split RST into (title, body) sections.

    Headers are a line followed by a line of repeated underline chars.
    Directive blocks (``.. foo::``) and their indented continuations are dropped.
    """
    lines = text.splitlines()
    cleaned: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.lstrip().startswith(".. "):
            i += 1
            while i < len(lines):
                l = lines[i]
                if not l.strip() or l.startswith("   ") or l.startswith("\t"):
                    i += 1
                    continue
                break
            continue
        cleaned.append(line)
        i += 1

    sections: list = []
    current_title = ""
    current_body: list[str] = []
    for j, line in enumerate(cleaned):
        if _HEADER_UNDERLINE.match(line) and j > 0:
            if current_title or current_body:
                sections.append({"title": clean_inline(current_title.strip()),
                                 "content": "\n".join(current_body).strip()})
            current_title = cleaned[j - 1]
            current_body = []
            continue
        if line.strip().startswith(":") and ":" in line and line.strip().endswith(":") and len(line.strip()) < 80:
            continue  # field list (e.g. :Author:)
        if re.match(r"^\s*[*-]?\s*\.\. (toc|contents)::", line):
            continue
        is_title_line = (j + 1 < len(cleaned)) and bool(_HEADER_UNDERLINE.match(cleaned[j + 1]))
        if not is_title_line:
            current_body.append(clean_inline(line))
    if current_title or current_body:
        sections.append({"title": clean_inline(current_title.strip()),
                         "content": "\n".join(current_body).strip()})
    return [s for s in sections if s["content"] or s["title"]]


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    distro = DEFAULT_DISTRO
    if "--distro" in sys.argv:
        distro = sys.argv[sys.argv.index("--distro") + 1]
    if not args:
        sys.exit(__doc__)
    path = args[0]
    url = BASE.format(distro=distro, path=path)
    text = fetch(url)
    sections = parse_sections(text)
    print(f"source: {url}")
    print(f"sections: {len(sections)}")
    for s in sections:
        print(f"\n=== {s['title']} ===")
        print(s["content"])


if __name__ == "__main__":
    main()
