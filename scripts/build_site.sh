#!/bin/sh
# Assemble the static site into _site/ (site/ + data/).
set -e
cd "$(dirname "$0")/.."
rm -rf _site && mkdir -p _site/data
cp site/* _site/
cp data/*.json data/*.csv _site/data/
touch _site/.nojekyll
