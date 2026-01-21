#!/usr/bin/env python3
"""
Test script to verify machine renaming works correctly on PostgreSQL.
This addresses the FK constraint issues that SQLite tests don't catch.
"""
import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import models
import db as db_service

# Use the actual PostgreSQL database
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASS = os.getenv('DB_PASS', 'password')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'powermon_db3')

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

print(f"Connecting to: postgresql://{DB_USER}:***@{DB_HOST}:{DB_PORT}/{DB_NAME}")

try:
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Test the connection
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version()"))
        print(f"✓ Connected to PostgreSQL: {result.fetchone()[0][:50]}...")
    
    session = SessionLocal()
    
    # Create a test machine with monitor and polls
    print("\n=== Setting up test data ===")
    test_mac = "FF:FF:FF:FF:FF:FF"
    old_name = "TEST_OLD_NAME"
    new_name = "TEST_NEW_NAME"
    
    # Clean up any existing test data
    session.execute(text(f"DELETE FROM poll WHERE machine_name IN ('{old_name}', '{new_name}')"))
    session.execute(text(f"DELETE FROM monitor WHERE monitor_mac_address = '{test_mac}'"))
    session.execute(text(f"DELETE FROM machine WHERE machine_name IN ('{old_name}', '{new_name}')"))
    session.commit()
    
    # Create test machine
    session.execute(text(f"""
        INSERT INTO machine (machine_name, machine_type, location) 
        VALUES ('{old_name}', 'test', 'test location')
    """))
    
    # Create test monitor
    session.execute(text(f"""
        INSERT INTO monitor (monitor_mac_address, monitor_id, machine_name, type) 
        VALUES ('{test_mac}', 9999, '{old_name}', 'TEST')
    """))
    
    # Create test polls
    session.execute(text(f"""
        INSERT INTO poll (poll_time, power_usage, machine_name, device_mac_address) 
        VALUES (NOW(), 100, '{old_name}', '{test_mac}'), 
               (NOW(), 200, '{old_name}', '{test_mac}')
    """))
    session.commit()
    
    print(f"✓ Created test machine '{old_name}' with monitor and 2 polls")
    
    # Verify initial state
    machine = session.query(models.Machine).filter_by(name=old_name).first()
    monitor = session.query(models.Monitor).filter_by(mac=test_mac).first()
    polls = session.query(models.Poll).filter_by(machine_name=old_name).all()
    
    print(f"✓ Verified: machine={machine.name}, monitor FK={monitor.machine_name}, polls={len(polls)}")
    
    # Now test the rename operation
    print(f"\n=== Testing rename from '{old_name}' to '{new_name}' ===")
    
    class MockDeviceData:
        def __init__(self, name, mac, location, machine_type):
            self.name = name
            self.mac = mac
            self.location = location
            self.machine_type = machine_type
    
    update_data = MockDeviceData(new_name, test_mac, "test location", "test")
    
    try:
        success = db_service.update_device(session, test_mac, update_data)
        
        if not success:
            print("✗ FAILED: update_device returned False")
            sys.exit(1)
        
        print("✓ update_device completed successfully")
        
        # Verify the changes
        print("\n=== Verifying changes ===")
        
        # Check machine was renamed
        old_machine = session.query(models.Machine).filter_by(name=old_name).first()
        new_machine = session.query(models.Machine).filter_by(name=new_name).first()
        
        if old_machine is not None:
            print(f"✗ FAILED: Old machine '{old_name}' still exists")
            sys.exit(1)
        
        if new_machine is None:
            print(f"✗ FAILED: New machine '{new_name}' doesn't exist")
            sys.exit(1)
        
        print(f"✓ Machine renamed to '{new_name}'")
        
        # Check monitor FK was updated
        monitor = session.query(models.Monitor).filter_by(mac=test_mac).first()
        if monitor.machine_name != new_name:
            print(f"✗ FAILED: Monitor FK still points to '{monitor.machine_name}'")
            sys.exit(1)
        
        print(f"✓ Monitor FK updated to '{new_name}'")
        
        # Check polls were updated
        old_polls = session.query(models.Poll).filter_by(machine_name=old_name).all()
        new_polls = session.query(models.Poll).filter_by(machine_name=new_name).all()
        
        if len(old_polls) > 0:
            print(f"✗ FAILED: {len(old_polls)} polls still reference '{old_name}'")
            sys.exit(1)
        
        if len(new_polls) != 2:
            print(f"✗ FAILED: Expected 2 polls for '{new_name}', found {len(new_polls)}")
            sys.exit(1)
        
        print(f"✓ All {len(new_polls)} polls updated to '{new_name}'")
        
        # Verify FK constraints were recreated
        result = session.execute(text("""
            SELECT conname, contype FROM pg_constraint 
            WHERE conname IN ('monitor_machine_name_fkey', 'poll_machine_name_fkey')
            ORDER BY conname
        """))
        constraints = result.fetchall()
        
        if len(constraints) != 2:
            print(f"✗ FAILED: Expected 2 FK constraints, found {len(constraints)}")
            sys.exit(1)
        
        print(f"✓ FK constraints recreated: {[c[0] for c in constraints]}")
        
        print("\n=== ✓✓✓ ALL TESTS PASSED ✓✓✓ ===")
        
    except Exception as e:
        print(f"\n✗ FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    finally:
        # Clean up test data
        try:
            session.execute(text(f"DELETE FROM poll WHERE machine_name IN ('{old_name}', '{new_name}')"))
            session.execute(text(f"DELETE FROM monitor WHERE monitor_mac_address = '{test_mac}'"))
            session.execute(text(f"DELETE FROM machine WHERE machine_name IN ('{old_name}', '{new_name}')"))
            session.commit()
            print("\n✓ Cleaned up test data")
        except:
            pass
        
        session.close()

except Exception as e:
    print(f"\n✗ FATAL ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
