# test_poll_insertion.py
"""
Tests for the new insert_poll() function and poll ingestion logic.
"""
import pytest  # type: ignore
from sqlalchemy import create_engine  # type: ignore
from sqlalchemy.orm import sessionmaker  # type: ignore
from datetime import datetime, timezone

import models
import db as db_service
from database import Base


@pytest.fixture(scope="function")
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


class MockDeviceData:
    def __init__(self, name, mac, location, machine_type, id=1):
        self.name = name
        self.mac = mac
        self.location = location
        self.machine_type = machine_type
        self.id = id


def test_insert_poll_success(db_session):
    """Test successful poll insertion with machine_name resolution."""
    # Setup: Add a device
    data = MockDeviceData("CNC Machine", "AA:BB:CC", "Shop", "CNC")
    db_service.add_device(db_session, data)

    # Insert poll using new helper function
    now = datetime.now(timezone.utc)
    success = db_service.insert_poll(db_session, "AA:BB:CC", 1500, now)

    assert success is True

    # Verify poll was inserted with correct machine_name
    poll = db_session.query(models.Poll).first()
    assert poll is not None
    assert poll.monitor_mac == "AA:BB:CC"
    assert poll.machine_name == "CNC Machine"
    assert poll.power_usage == 1500
    # Note: poll_time comparison may differ in timezone info, just check it exists
    assert poll.poll_time is not None


def test_insert_poll_monitor_not_found(db_session):
    """Test poll insertion fails gracefully when monitor doesn't exist."""
    # Try to insert poll for non-existent monitor
    now = datetime.now(timezone.utc)
    success = db_service.insert_poll(db_session, "XX:XX:XX", 1500, now)

    assert success is False

    # Verify no poll was inserted
    assert db_session.query(models.Poll).count() == 0


def test_insert_poll_no_machine_assigned(db_session):
    """Test poll insertion fails when monitor has no machine_name."""
    # Manually create a monitor without a machine
    monitor = models.Monitor(
        mac="BB:BB:BB",
        id=1,
        type="IPM",
        machine_name=None  # No machine assigned
    )
    db_session.add(monitor)
    db_session.commit()

    # Try to insert poll - should raise ValueError
    now = datetime.now(timezone.utc)
    with pytest.raises(ValueError, match="has no associated machine_name"):
        db_service.insert_poll(db_session, "BB:BB:BB", 1500, now)


def test_insert_poll_machine_doesnt_exist(db_session):
    """Test poll insertion fails when referenced machine doesn't exist."""
    # Create monitor pointing to non-existent machine
    monitor = models.Monitor(
        mac="CC:CC:CC",
        id=1,
        type="IPM",
        machine_name="NonExistentMachine"
    )
    db_session.add(monitor)
    db_session.commit()

    # Try to insert poll - should raise ValueError
    now = datetime.now(timezone.utc)
    with pytest.raises(ValueError, match="does not exist"):
        db_service.insert_poll(db_session, "CC:CC:CC", 1500, now)


def test_insert_poll_multiple_polls_same_machine(db_session):
    """Test multiple polls can be inserted for the same machine."""
    # Setup device
    data = MockDeviceData("Mill", "DD:DD:DD", "Shop", "Mill")
    db_service.add_device(db_session, data)

    # Insert multiple polls
    now = datetime.now(timezone.utc)
    for i in range(5):
        success = db_service.insert_poll(
            db_session,
            "DD:DD:DD",
            1000 + i * 100,  # Increasing power
            now
        )
        assert success is True

    # Verify all polls were inserted
    polls = db_session.query(models.Poll).all()
    assert len(polls) == 5

    # All polls should have same machine_name
    machine_names = {p.machine_name for p in polls}
    assert machine_names == {"Mill"}


def test_insert_poll_data_stays_with_machine_after_monitor_change(db_session):
    """Test that machine_name keeps data linked even when monitors change.

    Note: In this test, we can't actually delete the old monitor because of
    the CASCADE constraint - polls would be deleted too. This test demonstrates
    that polls are correctly associated with machine_name.
    """
    # Setup initial device
    data = MockDeviceData("Lathe", "EE:EE:EE", "Shop", "Lathe")
    db_service.add_device(db_session, data)

    # Insert polls with first monitor
    now = datetime.now(timezone.utc)
    db_service.insert_poll(db_session, "EE:EE:EE", 1000, now)
    db_service.insert_poll(db_session, "EE:EE:EE", 1100, now)

    # Add a second monitor to the same machine (simulating redundant monitoring)
    new_monitor = models.Monitor(
        mac="FF:FF:FF",
        id=2,
        type="IPM",
        machine_name="Lathe"
    )
    db_session.add(new_monitor)
    db_session.commit()

    # Insert poll with new monitor
    db_service.insert_poll(db_session, "FF:FF:FF", 1200, now)

    # Verify all polls are associated with the same machine
    polls = db_session.query(models.Poll).all()
    assert len(polls) == 3

    # All polls should have same machine_name
    machine_names = {p.machine_name for p in polls}
    assert machine_names == {"Lathe"}

    # Monitor MACs should include both monitors
    monitor_macs = {p.monitor_mac for p in polls}
    assert monitor_macs == {"EE:EE:EE", "FF:FF:FF"}

    # Verify get_power() returns all historical data for the machine
    # Query with the NEW monitor - should get ALL polls for the machine
    power_data = db_service.get_power(
        db_session,
        "FF:FF:FF",  # Query with NEW monitor
        now  # cutoff
    )
    # Should get all 3 polls because they're all for the same machine
    assert len(power_data) == 3

    # Query with the OLD monitor - should also get ALL polls for the machine
    power_data_old = db_service.get_power(
        db_session,
        "EE:EE:EE",  # Query with OLD monitor
        now
    )
    # Should get same 3 polls - machine_name is the key
    assert len(power_data_old) == 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
