#!/usr/bin/env python3
from __future__ import annotations

import argparse
import urllib.request


def check(base_url: str, path: str, hint: str | None = None) -> None:
    url = base_url.rstrip('/') + path
    req = urllib.request.Request(url, headers={'User-Agent': 'rank-device-smoke-test/1.0'})
    with urllib.request.urlopen(req, timeout=15) as res:
        body = res.read(200_000)
        if res.status != 200:
            raise SystemExit(f'FAIL {path}: {res.status}')
        if hint and hint.encode() not in body:
            raise SystemExit(f'FAIL {path}: missing {hint}')
        print(f'OK {path}')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('base_url')
    args = parser.parse_args()
    check(args.base_url, '/health', 'ok')
    check(args.base_url, '/', 'Rank Device')
    check(args.base_url, '/directory', 'Annuaire')
    check(args.base_url, '/m/reine-pagne-dantokpa', 'Reine Pagne')
    check(args.base_url, '/m/reine-pagne-dantokpa/qr.png')
    check(args.base_url, '/robots.txt', 'Sitemap')
    check(args.base_url, '/sitemap.xml', 'urlset')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
