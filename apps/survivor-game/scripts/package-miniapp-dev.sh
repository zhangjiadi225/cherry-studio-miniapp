#!/bin/sh
set -eu

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ "$#" -ne 1 ]; then
  echo "Usage: pnpm package:miniapp:dev -- /absolute/path/to/app.miniapp" >&2
  exit 2
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname -- "$SCRIPT_DIR")
OUTPUT_PATH=$1

case "$OUTPUT_PATH" in
  *.miniapp) ;;
  *)
    echo "Output path must end in .miniapp" >&2
    exit 2
    ;;
esac

case "$OUTPUT_PATH" in
  /*) ;;
  *) OUTPUT_PATH="$PROJECT_DIR/$OUTPUT_PATH" ;;
esac

if [ -e "$OUTPUT_PATH" ]; then
  echo "Refusing to overwrite existing package: $OUTPUT_PATH" >&2
  exit 2
fi

STAGE_DIR=$(mktemp -d)
cleanup() {
  if [ -n "${STAGE_DIR:-}" ] && [ -d "$STAGE_DIR" ]; then
    rm -rf "$STAGE_DIR"
  fi
}
trap cleanup EXIT INT TERM

cd "$PROJECT_DIR"
pnpm exec tsc --noEmit
pnpm exec vite build --mode development --minify false --sourcemap --outDir "$STAGE_DIR"
cp miniapp/manifest.json "$STAGE_DIR/manifest.json"

node -e '
  const fs = require("node:fs");
  const crypto = require("node:crypto");
  const path = require("node:path");
  const root = process.argv[1];
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const icon = fs.readFileSync(path.join(root, manifest.icon.path));
  const actual = crypto.createHash("sha256").update(icon).digest("hex");
  if (actual !== manifest.icon.sha256) {
    throw new Error(`Icon hash mismatch: expected ${manifest.icon.sha256}, got ${actual}`);
  }
' "$STAGE_DIR"

mkdir -p "$(dirname -- "$OUTPUT_PATH")"
(
  cd "$STAGE_DIR"
  zip -q -r "$OUTPUT_PATH" . -x '*.DS_Store' -x '__MACOSX/*'
)

echo "$OUTPUT_PATH"
