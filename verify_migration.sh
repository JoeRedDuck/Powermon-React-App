#!/bin/bash
# Verify if FK constraints are deferrable
# Run this on the production server to check migration status

echo "Checking if FK constraints are deferrable..."
echo ""

PGPASSWORD="${DB_PASS:-password}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-powermon_db3}" << 'EOF'
SELECT 
    conname AS constraint_name,
    CASE WHEN condeferrable THEN 'YES' ELSE 'NO' END AS is_deferrable,
    CASE WHEN condeferred THEN 'DEFERRED' ELSE 'IMMEDIATE' END AS default_mode
FROM pg_constraint 
WHERE conname IN ('monitor_machine_name_fkey', 'poll_machine_name_fkey')
ORDER BY conname;
EOF

echo ""
echo "✅ If both constraints show 'is_deferrable = YES', migration is complete!"
echo "⚠️  If both show 'NO', you need to run: ./apply_migration.sh"
