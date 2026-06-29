#!/bin/bash
# Render CHT architecture Mermaid diagrams to PDF (and PNG).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIAGRAMS_DIR="$REPO_ROOT/docs/engineering/diagrams"
OUT_DIR="$REPO_ROOT/docs/engineering"

MMDC=(npx --yes @mermaid-js/mermaid-cli)

echo "Rendering architecture diagrams..."
for name in cht-platform-architecture cht-platform-auth; do
  src="$DIAGRAMS_DIR/${name}.mmd"
  if [ ! -f "$src" ]; then
    echo "Missing: $src"
    exit 1
  fi
  "${MMDC[@]}" -i "$src" -o "$OUT_DIR/${name}.pdf" -b white -w 1600 -H 1200
  "${MMDC[@]}" -i "$src" -o "$OUT_DIR/${name}.png" -b white -w 1600 -H 1200
  echo "  ✓ $OUT_DIR/${name}.pdf"
  echo "  ✓ $OUT_DIR/${name}.png"
done

echo ""
echo "Done. Main diagram: $OUT_DIR/cht-platform-architecture.pdf"
