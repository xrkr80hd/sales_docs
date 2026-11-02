-- Migration 008: F&I Claim + Finish columns on deals
-- Phase 23 — lets F&I person claim deals from queue and mark them finished.
-- Zero data movement: just timestamps on the existing deal row.

ALTER TABLE deals
  ADD COLUMN fni_claimed_at   timestamptz,
  ADD COLUMN fni_claimed_by   uuid REFERENCES profiles(id),
  ADD COLUMN fni_finished_at  timestamptz;
