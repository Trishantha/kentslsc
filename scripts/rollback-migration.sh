#!/usr/bin/env bash
set -euo pipefail

# Generate a compensating ("down") migration for the most recently applied
# Prisma migration. This does NOT automatically apply it unless --apply is
# passed, and it requires the application to be in maintenance mode so partial
# data states are not exposed.
#
# Usage:
#   DATABASE_URL=... ./scripts/rollback-migration.sh
#   DATABASE_URL=... ./scripts/rollback-migration.sh --apply

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATABASE_DIR="$PROJECT_ROOT/packages/database"
APPLY=0

if [ "${1:-}" = "--apply" ]; then
  APPLY=1
elif [ $# -gt 0 ]; then
  echo "Usage: DATABASE_URL=... ${BASH_SOURCE[0]} [--apply]" >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx is required" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL is not set" >&2
  exit 1
fi

cd "$DATABASE_DIR"

echo "==> Determining last applied migration..."
LAST_APPLIED="$(npx prisma migrate status --json 2>/dev/null | node -e '
  const chunks = [];
  process.stdin.on("data", c => chunks.push(c));
  process.stdin.on("end", () => {
    try {
      const parsed = JSON.parse(chunks.join(""));
      const applied = (parsed.applied || []).slice(-1)[0];
      console.log(applied ? applied.migration_name : "");
    } catch {
      process.stdout.write("");
    }
  });
')" || true

if [ -z "$LAST_APPLIED" ]; then
  echo "Error: could not determine the last applied migration." >&2
  exit 1
fi

echo "Last applied migration: $LAST_APPLIED"
MIGRATION_DIR="prisma/migrations/$LAST_APPLIED"
if [ ! -d "$MIGRATION_DIR" ]; then
  echo "Error: migration directory $MIGRATION_DIR not found" >&2
  exit 1
fi

echo "==> Generating compensating migration..."
ROLLBACK_FILE="$MIGRATION_DIR/rollback.sql"

npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "$ROLLBACK_FILE" || {
  echo "Error: failed to generate rollback SQL" >&2
  exit 1
}

if [ ! -s "$ROLLBACK_FILE" ]; then
  echo "==> Rollback SQL is empty; the migration appears to be a no-op relative to the current database."
  rm -f "$ROLLBACK_FILE"
  exit 0
fi

echo "==> Rollback SQL written to $ROLLBACK_FILE"
echo "==> Review the generated SQL before applying:"
cat "$ROLLBACK_FILE"

if [ "$APPLY" -eq 1 ]; then
  echo "==> Applying rollback SQL..."
  psql "$DATABASE_URL" -f "$ROLLBACK_FILE" || {
    echo "Error: failed to apply rollback SQL" >&2
    exit 1
  }
  echo "==> Marking migration $LAST_APPLIED as rolled back..."
  npx prisma migrate resolve --rolled-back "$LAST_APPLIED"
  echo "==> Rollback complete."
else
  echo "==> Rollback SQL generated but not applied. Run with --apply after reviewing and backing up data."
fi
