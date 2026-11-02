-- Run after copying data from Supabase (safe to run more than once).
-- 1. Live-update counters table (added after the first schema load).
CREATE TABLE IF NOT EXISTS app_live_events (
  channel    VARCHAR(191) NOT NULL,
  version    BIGINT       NOT NULL DEFAULT 0,
  updated_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (channel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Media links: same paths, now served by nextdox.app instead of Supabase Storage.
UPDATE consultant_cards SET
  profile_image_url      = REPLACE(profile_image_url,      'https://ywtdskskkplpurniyyto.supabase.co', 'https://nextdox.app'),
  calling_card_image_url = REPLACE(calling_card_image_url, 'https://ywtdskskkplpurniyyto.supabase.co', 'https://nextdox.app'),
  logo_url               = REPLACE(logo_url,               'https://ywtdskskkplpurniyyto.supabase.co', 'https://nextdox.app');
UPDATE consultant_reviews      SET image_url = REPLACE(image_url, 'https://ywtdskskkplpurniyyto.supabase.co', 'https://nextdox.app');
UPDATE consultant_vehicles     SET image_url = REPLACE(image_url, 'https://ywtdskskkplpurniyyto.supabase.co', 'https://nextdox.app'),
                                   builder_data = REPLACE(builder_data, 'https://ywtdskskkplpurniyyto.supabase.co', 'https://nextdox.app');
UPDATE consultant_videos       SET video_url = REPLACE(video_url, 'https://ywtdskskkplpurniyyto.supabase.co', 'https://nextdox.app');
UPDATE consultant_sold_gallery SET image_url = REPLACE(image_url, 'https://ywtdskskkplpurniyyto.supabase.co', 'https://nextdox.app');
UPDATE user_settings SET
  dealer_info     = REPLACE(dealer_info,     'https://ywtdskskkplpurniyyto.supabase.co', 'https://nextdox.app'),
  consultant_info = REPLACE(consultant_info, 'https://ywtdskskkplpurniyyto.supabase.co', 'https://nextdox.app');
-- Deals are deliberately untouched: deal documents must not change.
