-- Support tickets (the app also creates this table on first use).
CREATE TABLE IF NOT EXISTS app_tickets (
id CHAR(36) NOT NULL PRIMARY KEY,
user_id CHAR(36) NOT NULL,
user_name VARCHAR(255) NULL,
user_email VARCHAR(320) NULL,
user_role VARCHAR(40) NULL,
organization_name VARCHAR(255) NULL,
category VARCHAR(20) NOT NULL DEFAULT 'problem',
subject VARCHAR(160) NOT NULL,
details TEXT NOT NULL,
page VARCHAR(300) NULL,
status VARCHAR(20) NOT NULL DEFAULT 'open',
admin_note TEXT NULL,
created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
KEY app_tickets_user (user_id, created_at),
KEY app_tickets_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
;
