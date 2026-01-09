from sqlalchemy import create_engine, text  # type: ignore
from sqlalchemy.orm import sessionmaker  # type: ignore
from database import DATABASE_URL
import models

# 1. Connect
print(f"Checking database: {DATABASE_URL}")
try:
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
except Exception as e:
    print(f"CRITICAL: Could not connect. {e}")
    exit()

# 2. Count Rows
try:
    machine_count = session.query(models.Machine).count()
    monitor_count = session.query(models.Monitor).count()

    print(f"\n--- DIAGNOSTICS ---")
    print(f"Machines found: {machine_count}")
    print(f"Monitors found: {monitor_count}")

    if monitor_count > 0:
        first = session.query(models.Monitor).first()
        print(f"Sample Monitor: {first.mac} -> Machine: {first.machine_name}")
    else:
        print("ERROR: No monitors found. Did setup_db.py run correctly?")

except Exception as e:
    print(f"Error querying data: {e}")
    # Check if tables exist
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1 FROM monitor LIMIT 1"))
        print("Table 'monitor' exists.")
    except:
        print("CRITICAL: Table 'monitor' does not exist.")
