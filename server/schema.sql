CREATE TABLE IF NOT EXISTS divisions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN','STAFF','DRIVER') NOT NULL,
  division_id BIGINT UNSIGNED NULL,
  phone VARCHAR(20) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  availability_status ENUM('AVAILABLE','ON_LEAVE','OFF_DUTY') NOT NULL DEFAULT 'AVAILABLE',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_users_division FOREIGN KEY (division_id) REFERENCES divisions(id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  priority ENUM('NORMAL','URGENT') NOT NULL DEFAULT 'NORMAL',
  urgent_deadline TIMESTAMP(3) NULL,
  scheduled_at TIMESTAMP(3) NULL,
  status ENUM('WAITING','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'WAITING',
  creator_id BIGINT UNSIGNED NOT NULL,
  guest_creator_name VARCHAR(120) NULL,
  division_id BIGINT UNSIGNED NOT NULL,
  assignee_id BIGINT UNSIGNED NOT NULL,
  location_name VARCHAR(180) NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  reference_photo TEXT NULL,
  completion_photos JSON NULL,
  completion_note TEXT NULL,
  completion_latitude DECIMAL(10,7) NULL,
  completion_longitude DECIMAL(10,7) NULL,
  cancel_reason TEXT NULL,
  cancelled_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  started_at TIMESTAMP(3) NULL,
  completed_at TIMESTAMP(3) NULL,
  cancelled_at TIMESTAMP(3) NULL,
  CONSTRAINT fk_tasks_creator FOREIGN KEY (creator_id) REFERENCES users(id),
  CONSTRAINT fk_tasks_division FOREIGN KEY (division_id) REFERENCES divisions(id),
  CONSTRAINT fk_tasks_assignee FOREIGN KEY (assignee_id) REFERENCES users(id),
  INDEX idx_tasks_status_priority_created (status, priority, created_at),
  INDEX idx_tasks_creator (creator_id),
  INDEX idx_tasks_assignee (assignee_id)
);

CREATE TABLE IF NOT EXISTS task_events (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  task_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  event_type ENUM('TASK_CREATED','TASK_STARTED','TASK_COMPLETED','TASK_CANCELLED') NOT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_events_task FOREIGN KEY (task_id) REFERENCES tasks(id),
  CONSTRAINT fk_events_actor FOREIGN KEY (actor_id) REFERENCES users(id),
  INDEX idx_events_task_created (task_id, created_at)
);

CREATE TABLE IF NOT EXISTS driver_locations (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  driver_id BIGINT UNSIGNED NOT NULL,
  task_id BIGINT UNSIGNED NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  accuracy FLOAT NULL,
  recorded_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_dloc_driver FOREIGN KEY (driver_id) REFERENCES users(id),
  CONSTRAINT fk_dloc_task FOREIGN KEY (task_id) REFERENCES tasks(id),
  INDEX idx_dloc_driver_recorded (driver_id, recorded_at),
  INDEX idx_dloc_recorded (recorded_at)
);

CREATE TABLE IF NOT EXISTS driver_last_location (
  driver_id BIGINT UNSIGNED PRIMARY KEY,
  task_id BIGINT UNSIGNED NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  accuracy FLOAT NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_dll_driver FOREIGN KEY (driver_id) REFERENCES users(id),
  CONSTRAINT fk_dll_task FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  type ENUM('TASK_CREATED','TASK_STARTED','TASK_COMPLETED','TASK_CANCELLED') NOT NULL,
  task_id BIGINT UNSIGNED NOT NULL,
  message VARCHAR(255) NOT NULL,
  read_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_task FOREIGN KEY (task_id) REFERENCES tasks(id),
  INDEX idx_notif_user_read (user_id, read_at)
);

CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP(3) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_expiry (expires_at)
);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  val TEXT NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);
