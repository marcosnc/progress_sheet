#!/bin/sh
set -e

PUBLIC_DIR="/app/packages/web/public"

mkdir -p "$PUBLIC_DIR"
node -e "
const fs = require('fs');
const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const content =
  'window.__PROGRESS_SHEET_CONFIG__ = ' + JSON.stringify({ apiUrl: url }) + ';';
fs.writeFileSync('${PUBLIC_DIR}/runtime-env.js', content);
"

exec "$@"
