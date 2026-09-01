#!/bin/sh
set -eu
cat > /usr/share/nginx/html/config.js <<EOF
window.__AFRIA_INDUSTRIAL_CONFIG__ = {
  apiBaseUrl: '${AFRIA_INDUSTRIAL_API_BASE_URL:-http://localhost:8000}',
  proofApiKey: '${AFRIA_INDUSTRIAL_PROOF_API_KEY:-}'
};
EOF
