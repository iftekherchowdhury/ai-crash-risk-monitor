#!/bin/sh
# Optional: rebuild the Grok canvas source (canvas/page.tsx) from data/. Usage: canvas/assemble.sh D
cd "$(dirname "$0")" && python3 build_data.py "$1" > page_data.js && cat page_head.tsx page_data.js page_body.tsx > page.tsx && rm page_data.js
