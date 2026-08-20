#!/usr/bin/env bash
set -euo pipefail

# Preview and validate pending Prisma migrations before they are applied in
# production. The script exits non-zero if any destructive operation is detected
# or if the schema fails validation.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATABASE_DIR="$PROJECT_ROOT/packages/database"

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx is required" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL is not set" >&2
  exit 1
fi

cd "$DATABASE_DIR"

echo "==> Validating Prisma schema..."
npx prisma validate

echo "==> Checking migration status..."
npx prisma migrate status

echo "==> Generating migration preview (schema -> target database)..."
PREVIEW_FILE="$(mktemp)"
trap 'rm -f "$PREVIEW_FILE"' EXIT

npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "$PREVIEW_FILE" || {
  echo "Error: failed to generate migration preview" >&2
  exit 1
}

if [ ! -s "$PREVIEW_FILE" ]; then
  echo "==> No pending migrations. Database is in sync with schema."
  exit 0
fi

echo "==> Pending migration preview:"
cat "$PREVIEW_FILE"

echo "==> Checking for destructive operations..."
DESTRUCTIVE_PATTERN='\b(DROP TABLE|DROP COLUMN|DROP INDEX|DROP SCHEMA|TRUNCATE|DELETE FROM|ALTER TABLE .* DROP)\b'
if grep -Ei "$DESTRUCTIVE_PATTERN" "$PREVIEW_FILE"; then
  echo "Error: destructive operations detected in pending migration (see above)." >&2
  echo "Review the migration SQL and add a manual data-backup/rollback plan before deploying." >&2
  exit 1
fi

echo "==> No destructive operations detected in preview."
echo "==> Migration compatibility check passed."
