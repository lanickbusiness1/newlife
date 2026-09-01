#!/bin/sh
set -eu
cd "$(dirname "$0")/../backend"
python -m pytest tests/test_failure_modes.py tests/test_acceptance.py -v
