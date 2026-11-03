ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS sm_ready       boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sm_sent_at     timestamptz,
  ADD COLUMN IF NOT EXISTS sm_claimed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS sm_claimed_by  uuid        REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS sm_finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS deal_number    text,
  ADD COLUMN IF NOT EXISTS sm_attachments jsonb       NOT NULL DEFAULT '[]'::jsonb;
