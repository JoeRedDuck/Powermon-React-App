CREATE TABLE IF NOT EXISTS machine (
  machine_name VARCHAR(255) PRIMARY KEY,
  machine_type VARCHAR(255),
  location VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS monitor (
  monitor_mac_address VARCHAR(255) PRIMARY KEY,
  monitor_id INT,
  monitor_ip VARCHAR(255),
  type VARCHAR(255),
  machine_name VARCHAR(255),
  FOREIGN KEY (machine_name) REFERENCES machine(machine_name)
);

CREATE TABLE IF NOT EXISTS poll (
  poll_number SERIAL PRIMARY KEY,
  poll_time TIMESTAMP(3),
  power_usage INT,
  machine_name VARCHAR(255), 
  device_mac_address VARCHAR(255),
  FOREIGN KEY (machine_name) REFERENCES machine(machine_name) ON DELETE CASCADE,
  FOREIGN KEY (device_mac_address) REFERENCES monitor(monitor_mac_address) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_token (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  device_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
