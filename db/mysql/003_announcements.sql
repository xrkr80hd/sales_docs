-- Notification Center announcements (the app also creates this table on first use).
CREATE TABLE IF NOT EXISTS app_announcements (
  id CHAR(36) NOT NULL PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  body TEXT NOT NULL,
  signoff VARCHAR(300) NULL,
  link_url VARCHAR(500) NULL,
  link_label VARCHAR(80) NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY app_announcements_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
