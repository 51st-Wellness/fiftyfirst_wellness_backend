#!/bin/bash

echo "🚀 Applying latest migration to Turso database..."

# Get the latest migration directory
LATEST_MIGRATION=$(ls -1 prisma/migrations/ | grep -E '^[0-9]{14}_' | sort | tail -1)

if [ -z "$LATEST_MIGRATION" ]; then
    echo "❌ No migration directories found"
    exit 1
fi

echo "📋 Found latest migration: $LATEST_MIGRATION"

# Check if migration.sql exists
MIGRATION_PATH="prisma/migrations/$LATEST_MIGRATION/migration.sql"

if [ ! -f "$MIGRATION_PATH" ]; then
    echo "❌ Migration file not found: $MIGRATION_PATH"
    exit 1
fi

echo "✅ Migration file found: $MIGRATION_PATH"
echo "🔧 Applying migration to database..."

# Execute the Turso command
d$ turso db shell fifty-firstwellness < "$MIGRATION_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Migration applied successfully!"
    echo "📊 Applied migration: $LATEST_MIGRATION"
else
    echo "❌ Failed to apply migration"
    echo "💡 Make sure:"
    echo "1. Your Turso database 'fifty-firstwellness' exists"
    echo "2. You have the correct permissions to access the database"
    echo "3. The migration file is valid SQL"
    exit 1
fi 