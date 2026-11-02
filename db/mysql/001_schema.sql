-- NXTDOX MySQL schema (moved off Supabase, 2026-11-02).
-- Mirrors the Supabase public schema plus the auth tables the app needs.
-- Times are stored in UTC. IDs are UUID strings. JSON columns hold the same
-- shapes the app already reads and writes.
SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ── Accounts (replaces Supabase auth.users) ─────────────────────────────
CREATE TABLE IF NOT EXISTS app_users (
  id                 CHAR(36)     NOT NULL,
  email              VARCHAR(320) NOT NULL,
  encrypted_password VARCHAR(255) NULL,           -- bcrypt hash carried over from Supabase
  email_confirmed_at DATETIME(6)  NULL,
  app_metadata       JSON         NULL,
  user_metadata      JSON         NULL,
  created_at         DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at         DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  last_sign_in_at    DATETIME(6)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY app_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash   CHAR(64)    NOT NULL,              -- sha256 of the session token; the token itself is never stored
  user_id      CHAR(36)    NOT NULL,
  created_at   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  last_seen_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  expires_at   DATETIME(6) NOT NULL,
  PRIMARY KEY (token_hash),
  KEY app_sessions_user (user_id),
  CONSTRAINT app_sessions_user_fk FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_password_resets (
  token_hash CHAR(64)    NOT NULL,
  user_id    CHAR(36)    NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  used_at    DATETIME(6) NULL,
  PRIMARY KEY (token_hash),
  KEY app_password_resets_user (user_id),
  CONSTRAINT app_password_resets_user_fk FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Core ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id           CHAR(36)     NOT NULL,
  role         VARCHAR(32)  NOT NULL DEFAULT 'user',
  display_name VARCHAR(255) NULL,
  created_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  card_enabled TINYINT(1)   NOT NULL DEFAULT 0,
  username     VARCHAR(255) NULL,
  PRIMARY KEY (id),
  CONSTRAINT profiles_user_fk FOREIGN KEY (id) REFERENCES app_users(id) ON DELETE CASCADE,
  CONSTRAINT profiles_role_chk CHECK (role IN ('admin','user','fni','sales_manager'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organizations (
  id         CHAR(36)     NOT NULL,
  name       VARCHAR(255) NOT NULL,
  slug       VARCHAR(255) NOT NULL,
  created_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY organizations_name (name),
  UNIQUE KEY organizations_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_memberships (
  user_id         CHAR(36)    NOT NULL,
  organization_id CHAR(36)    NOT NULL,
  chat_enabled    TINYINT(1)  NOT NULL DEFAULT 0,
  can_dm          TINYINT(1)  NOT NULL DEFAULT 0,
  can_org_chat    TINYINT(1)  NOT NULL DEFAULT 0,
  assigned_by     CHAR(36)    NULL,
  updated_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  chat_nickname   VARCHAR(32) NULL,
  PRIMARY KEY (user_id),
  KEY organization_memberships_org (organization_id),
  CONSTRAINT org_members_org_fk  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT org_members_user_fk FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT org_members_by_fk   FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id         CHAR(36)    NOT NULL,
  dealer_info     JSON        NOT NULL,
  consultant_info JSON        NOT NULL,
  updated_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id),
  CONSTRAINT user_settings_user_fk FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invites (
  id          CHAR(36)     NOT NULL,
  email       VARCHAR(320) NOT NULL,
  role        VARCHAR(32)  NOT NULL DEFAULT 'user',
  invited_by  CHAR(36)     NULL,
  created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  expires_at  DATETIME(6)  NOT NULL,
  accepted_at DATETIME(6)  NULL,
  PRIMARY KEY (id),
  CONSTRAINT invites_by_fk FOREIGN KEY (invited_by) REFERENCES app_users(id) ON DELETE SET NULL,
  CONSTRAINT invites_role_chk CHECK (role IN ('admin','user','fni','sales_manager'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Deals (deal documents must not change) ──────────────────────────────
CREATE TABLE IF NOT EXISTS deals (
  id              CHAR(36)    NOT NULL,
  user_id         CHAR(36)    NOT NULL,
  workflow_data   JSON        NOT NULL,
  signatures      JSON        NOT NULL,
  status          VARCHAR(16) NOT NULL DEFAULT 'open',
  finished_at     DATETIME(6) NULL,
  created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  fni_ready       TINYINT(1)  NOT NULL DEFAULT 0,
  fni_sent_at     DATETIME(6) NULL,
  fni_claimed_at  DATETIME(6) NULL,
  fni_claimed_by  CHAR(36)    NULL,
  fni_finished_at DATETIME(6) NULL,
  sm_ready        TINYINT(1)  NOT NULL DEFAULT 0,
  sm_sent_at      DATETIME(6) NULL,
  sm_claimed_at   DATETIME(6) NULL,
  sm_claimed_by   CHAR(36)    NULL,
  sm_finished_at  DATETIME(6) NULL,
  deal_number     VARCHAR(64) NULL,
  sm_attachments  JSON        NOT NULL,
  PRIMARY KEY (id),
  KEY deals_user_status (user_id, status),
  KEY deals_finished_at (status, finished_at),
  KEY deals_fni_queue (fni_ready, status, fni_sent_at),
  KEY deals_created_at (created_at),
  CONSTRAINT deals_user_fk FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
  CONSTRAINT deals_fni_by_fk FOREIGN KEY (fni_claimed_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT deals_sm_by_fk  FOREIGN KEY (sm_claimed_by)  REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT deals_status_chk CHECK (status IN ('open','finished'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id             CHAR(36)      NOT NULL,
  recipient_role VARCHAR(32)   NOT NULL,
  deal_id        CHAR(36)      NULL,
  message        TEXT          NOT NULL,
  `read`         TINYINT(1)    NOT NULL DEFAULT 0,
  created_at     DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY notifications_role_unread (recipient_role, `read`, created_at),
  CONSTRAINT notifications_deal_fk FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
  CONSTRAINT notifications_role_chk CHECK (recipient_role IN ('admin','user','fni','sales_manager'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Consultant business cards ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultant_cards (
  id                     CHAR(36)      NOT NULL,
  user_id                CHAR(36)      NOT NULL,
  slug                   VARCHAR(191)  NOT NULL,
  is_published           TINYINT(1)    NOT NULL DEFAULT 0,
  published_at           DATETIME(6)   NULL,
  display_name           VARCHAR(255)  NOT NULL DEFAULT '',
  job_title              VARCHAR(255)  NOT NULL DEFAULT 'Sales Consultant',
  dealership             VARCHAR(255)  NOT NULL DEFAULT 'Walker Automotive',
  location               VARCHAR(255)  NOT NULL DEFAULT 'Alexandria, Louisiana',
  phone                  VARCHAR(64)   NOT NULL DEFAULT '',
  email                  VARCHAR(320)  NOT NULL DEFAULT '',
  profile_image_url      VARCHAR(2048) NOT NULL DEFAULT '',
  calling_card_image_url VARCHAR(2048) NOT NULL DEFAULT '',
  logo_url               VARCHAR(2048) NOT NULL DEFAULT '',
  language_label         VARCHAR(64)   NOT NULL DEFAULT 'EN · ES',
  primary_phrase         VARCHAR(500)  NOT NULL DEFAULT '',
  sales_quote            TEXT          NULL,
  bio                    TEXT          NULL,
  inventory_url          VARCHAR(2048) NOT NULL DEFAULT 'https://www.walkerautomotive.com/',
  inventory_button_label VARCHAR(255)  NOT NULL DEFAULT 'Browse Walker Inventory',
  call_label             VARCHAR(64)   NOT NULL DEFAULT 'Call',
  text_label             VARCHAR(64)   NOT NULL DEFAULT 'Text',
  email_label            VARCHAR(64)   NOT NULL DEFAULT 'Email',
  created_at             DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at             DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY consultant_cards_user (user_id),
  UNIQUE KEY consultant_cards_slug (slug),
  CONSTRAINT consultant_cards_user_fk FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consultant_reviews (
  id            CHAR(36)      NOT NULL,
  card_id       CHAR(36)      NOT NULL,
  reviewer_name VARCHAR(255)  NOT NULL DEFAULT '',
  image_url     VARCHAR(2048) NOT NULL DEFAULT '',
  rating        INT           NOT NULL DEFAULT 5,
  is_long       TINYINT(1)    NOT NULL DEFAULT 0,
  sort_order    INT           NOT NULL DEFAULT 0,
  created_at    DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY consultant_reviews_card (card_id, sort_order),
  CONSTRAINT consultant_reviews_card_fk FOREIGN KEY (card_id) REFERENCES consultant_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consultant_vehicles (
  id           CHAR(36)      NOT NULL,
  card_id      CHAR(36)      NOT NULL,
  title        VARCHAR(500)  NOT NULL DEFAULT '',
  description  TEXT          NULL,
  url          VARCHAR(2048) NOT NULL DEFAULT '',
  image_url    VARCHAR(2048) NOT NULL DEFAULT '',
  vin          VARCHAR(64)   NOT NULL DEFAULT '',
  stock        VARCHAR(64)   NOT NULL DEFAULT '',
  price        VARCHAR(64)   NOT NULL DEFAULT '',
  sort_order   INT           NOT NULL DEFAULT 0,
  created_at   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  builder_data JSON          NULL,
  PRIMARY KEY (id),
  KEY consultant_vehicles_card (card_id, sort_order),
  CONSTRAINT consultant_vehicles_card_fk FOREIGN KEY (card_id) REFERENCES consultant_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consultant_videos (
  id          CHAR(36)      NOT NULL,
  card_id     CHAR(36)      NOT NULL,
  title       VARCHAR(500)  NOT NULL DEFAULT '',
  description TEXT          NULL,
  video_url   VARCHAR(2048) NOT NULL DEFAULT '',
  sort_order  INT           NOT NULL DEFAULT 0,
  created_at  DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY consultant_videos_card (card_id, sort_order),
  CONSTRAINT consultant_videos_card_fk FOREIGN KEY (card_id) REFERENCES consultant_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consultant_sold_gallery (
  id          CHAR(36)      NOT NULL,
  card_id     CHAR(36)      NOT NULL,
  title       VARCHAR(500)  NOT NULL DEFAULT '',
  description TEXT          NULL,
  image_url   VARCHAR(2048) NOT NULL DEFAULT '',
  sort_order  INT           NOT NULL DEFAULT 0,
  created_at  DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY consultant_sold_gallery_card (card_id, sort_order),
  CONSTRAINT consultant_sold_gallery_card_fk FOREIGN KEY (card_id) REFERENCES consultant_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consultant_social_links (
  id         CHAR(36)      NOT NULL,
  card_id    CHAR(36)      NOT NULL,
  title      VARCHAR(255)  NOT NULL DEFAULT '',
  url        VARCHAR(2048) NOT NULL DEFAULT '',
  sort_order INT           NOT NULL DEFAULT 0,
  created_at DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY consultant_social_links_card (card_id, sort_order),
  CONSTRAINT consultant_social_links_card_fk FOREIGN KEY (card_id) REFERENCES consultant_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consultant_analytics_events (
  id           CHAR(36)     NOT NULL,
  card_id      CHAR(36)     NOT NULL,
  event_type   VARCHAR(32)  NOT NULL,
  item_id      VARCHAR(191) NOT NULL DEFAULT '',
  visitor_hash CHAR(64)     NOT NULL,
  event_day    DATE         NOT NULL,
  created_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY consultant_analytics_once (card_id, event_type, item_id, visitor_hash, event_day),
  KEY consultant_analytics_card_day (card_id, event_day),
  CONSTRAINT consultant_analytics_card_fk FOREIGN KEY (card_id) REFERENCES consultant_cards(id) ON DELETE CASCADE,
  CONSTRAINT consultant_analytics_type_chk CHECK (event_type IN ('card_view','video_view','vehicle_view','call_click','text_click','email_click','listing_click'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Messenger ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messenger_conversations (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  kind            VARCHAR(16)  NOT NULL,
  title           VARCHAR(255) NULL,
  dm_key          VARCHAR(191) NULL,
  created_by      CHAR(36)     NULL,
  created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  channel         VARCHAR(16)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY messenger_conversations_dm_key (dm_key),
  -- One channel of each kind per organization. DMs have channel NULL, and NULLs never collide.
  UNIQUE KEY messenger_one_org_channel (organization_id, channel),
  KEY messenger_conversations_org (organization_id),
  CONSTRAINT messenger_conv_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT messenger_conv_by_fk  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT messenger_conv_kind_chk CHECK ((kind = 'dm' AND channel IS NULL) OR (kind = 'organization' AND channel IN ('consultant','management')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messenger_participants (
  conversation_id CHAR(36)    NOT NULL,
  user_id         CHAR(36)    NOT NULL,
  last_read_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  joined_at       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (conversation_id, user_id),
  KEY messenger_user_participation (user_id, conversation_id),
  CONSTRAINT messenger_part_conv_fk FOREIGN KEY (conversation_id) REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  CONSTRAINT messenger_part_user_fk FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messenger_messages (
  id              BIGINT      NOT NULL AUTO_INCREMENT,
  conversation_id CHAR(36)    NOT NULL,
  sender_id       CHAR(36)    NOT NULL,
  body            TEXT        NOT NULL,
  created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  edited_at       DATETIME(6) NULL,
  deleted_at      DATETIME(6) NULL,
  PRIMARY KEY (id),
  KEY messenger_history (conversation_id, id),
  KEY messenger_unread (conversation_id, deleted_at, created_at),
  CONSTRAINT messenger_msg_conv_fk FOREIGN KEY (conversation_id) REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  CONSTRAINT messenger_msg_sender_fk FOREIGN KEY (sender_id) REFERENCES profiles(id),
  CONSTRAINT messenger_msg_body_chk CHECK (CHAR_LENGTH(body) BETWEEN 1 AND 4000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messenger_presence (
  user_id      CHAR(36)    NOT NULL,
  last_seen_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id),
  CONSTRAINT messenger_presence_user_fk FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint     VARCHAR(768) NOT NULL,
  user_id      CHAR(36)     NOT NULL,
  subscription JSON         NOT NULL,
  created_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (endpoint),
  KEY push_subscriptions_user (user_id),
  CONSTRAINT push_subscriptions_user_fk FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Media files (replaces Supabase Storage buckets) ─────────────────────
-- Files live on disk under the site; this table records who owns each one.
CREATE TABLE IF NOT EXISTS media_files (
  id           CHAR(36)      NOT NULL,
  user_id      CHAR(36)      NULL,
  bucket       VARCHAR(191)  NOT NULL,
  path         VARCHAR(512)  NOT NULL,
  content_type VARCHAR(128)  NOT NULL DEFAULT 'application/octet-stream',
  size_bytes   BIGINT        NOT NULL DEFAULT 0,
  created_at   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY media_files_location (bucket, path),
  KEY media_files_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
