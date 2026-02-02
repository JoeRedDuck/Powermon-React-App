from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON  # type: ignore
from sqlalchemy.orm import relationship  # type: ignore
from datetime import datetime
from database import Base


class Machine(Base):
    __tablename__ = "machine"

    name = Column("machine_name", String, primary_key=True)
    type = Column("machine_type", String)
    location = Column(String)

    monitors = relationship("Monitor", back_populates="machine")
    polls = relationship("Poll", back_populates="machine")


class Monitor(Base):
    __tablename__ = "monitor"

    mac = Column("monitor_mac_address", String, primary_key=True)
    id = Column("monitor_id", Integer)
    type = Column(String)

    machine_name = Column(String, ForeignKey("machine.machine_name"))

    machine = relationship("Machine", back_populates="monitors")
    polls = relationship("Poll", back_populates="monitor")


class Poll(Base):
    __tablename__ = "poll"

    id = Column("poll_number", Integer, primary_key=True, autoincrement=True)
    poll_time = Column(DateTime)
    power_usage = Column(Integer)
    machine_name = Column(String, ForeignKey("machine.machine_name"))
    monitor_mac = Column("device_mac_address", String,
                         ForeignKey("monitor.monitor_mac_address"))

    machine = relationship("Machine")
    monitor = relationship("Monitor", back_populates="polls")


class NotificationToken(Base):
    __tablename__ = "notification_token"
    id = Column(Integer, primary_key=True, autoincrement=True)
    token = Column(String, unique=True, nullable=False)
    device_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DeviceMutePreference(Base):
    __tablename__ = "device_mute_preferences"
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String, unique=True, nullable=False, index=True)
    muted_machines = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)
