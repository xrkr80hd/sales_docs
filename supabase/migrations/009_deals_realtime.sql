-- Migration 009: Add deals table to Supabase Realtime publication
-- The F&I queue screen already subscribes to UPDATE events on deals,
-- but Supabase won't broadcast them unless the table is in the publication.

alter publication supabase_realtime add table public.deals;
