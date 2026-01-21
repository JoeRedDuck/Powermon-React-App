#!/bin/bash
# Apply migration to make FK constraints deferrable
# This needs to be run ONCE on production database

echo "Applying FK deferrable migration to production database..."
echo "This will briefly lock the monitor and poll tables."
echo ""

PGPASSWORD="${DB_PASS:-password}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-powermon_db3}" -f migrate_fk_deferrable.sql

echo ""
echo "Migration complete. Machine renaming will now be lock-free!"
