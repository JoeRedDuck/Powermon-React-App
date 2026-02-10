#!/usr/bin/env python3
"""
Apply migration to make FK constraints deferrable.
This fixes the lock timeout issue when renaming machines.
"""
import sys
from sqlalchemy import create_engine, text
from database import DATABASE_URL


def main():
    print(f"Connecting to: {DATABASE_URL}")
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            print("Applying migration: make_constraints_deferrable")

            # Drop existing constraints
            print("  - Dropping old constraints...")
            conn.execute(
                text("ALTER TABLE monitor DROP CONSTRAINT IF EXISTS monitor_machine_name_fkey"))
            conn.execute(
                text("ALTER TABLE poll DROP CONSTRAINT IF EXISTS poll_machine_name_fkey"))

            # Recreate as DEFERRABLE INITIALLY DEFERRED
            print("  - Creating DEFERRABLE constraints...")
            conn.execute(text("""
                ALTER TABLE monitor 
                ADD CONSTRAINT monitor_machine_name_fkey 
                FOREIGN KEY (machine_name) 
                REFERENCES machine(machine_name) 
                DEFERRABLE INITIALLY DEFERRED
            """))

            conn.execute(text("""
                ALTER TABLE poll 
                ADD CONSTRAINT poll_machine_name_fkey 
                FOREIGN KEY (machine_name) 
                REFERENCES machine(machine_name) 
                ON DELETE CASCADE 
                DEFERRABLE INITIALLY DEFERRED
            """))

            # Verify
            print("  - Verifying constraints...")
            result = conn.execute(text("""
                SELECT conname, condeferrable, condeferred 
                FROM pg_constraint 
                WHERE conname IN ('monitor_machine_name_fkey', 'poll_machine_name_fkey')
            """))

            for row in result:
                defer_str = "DEFERRABLE" if row[1] else "NOT DEFERRABLE"
                deferred_str = "INITIALLY DEFERRED" if row[2] else "INITIALLY IMMEDIATE"
                print(f"    ✓ {row[0]}: {defer_str} {deferred_str}")

            conn.commit()
            print("\n✅ Migration applied successfully!")
            print(
                "You can now restart the server and edit device names without lock timeouts.")

    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
