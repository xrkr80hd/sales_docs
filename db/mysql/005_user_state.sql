-- Per-account terms acceptance and read notifications (the app also creates this table on first use).
CREATE TABLE IF NOT EXISTS app_user_state (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  disclosure_version VARCHAR(40) NULL,
  disclosure_accepted_at DATETIME(3) NULL,
  read_announcements TEXT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
