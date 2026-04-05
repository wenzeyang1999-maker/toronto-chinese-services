-- ─── Saves Cleanup Triggers ──────────────────────────────────────────────────
-- Problem: saves.target_id has no FK (polymorphic reference), so deleting a
-- listing leaves orphaned rows in saves that never get cleaned up.
-- Fix: one trigger function + one trigger per listing table.
-- Safe to run multiple times (CREATE OR REPLACE).
-- ─────────────────────────────────────────────────────────────────────────────

-- Shared trigger function — TG_ARGV[0] carries the target_type string
CREATE OR REPLACE FUNCTION cleanup_saves_for_deleted_listing()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM saves
  WHERE  target_type = TG_ARGV[0]
  AND    target_id   = OLD.id;
  RETURN OLD;
END;
$$;

-- services
DROP TRIGGER IF EXISTS trg_saves_cleanup_services    ON services;
CREATE TRIGGER trg_saves_cleanup_services
  AFTER DELETE ON services
  FOR EACH ROW EXECUTE FUNCTION cleanup_saves_for_deleted_listing('service');

-- jobs
DROP TRIGGER IF EXISTS trg_saves_cleanup_jobs        ON jobs;
CREATE TRIGGER trg_saves_cleanup_jobs
  AFTER DELETE ON jobs
  FOR EACH ROW EXECUTE FUNCTION cleanup_saves_for_deleted_listing('job');

-- properties
DROP TRIGGER IF EXISTS trg_saves_cleanup_properties  ON properties;
CREATE TRIGGER trg_saves_cleanup_properties
  AFTER DELETE ON properties
  FOR EACH ROW EXECUTE FUNCTION cleanup_saves_for_deleted_listing('property');

-- secondhand
DROP TRIGGER IF EXISTS trg_saves_cleanup_secondhand  ON secondhand;
CREATE TRIGGER trg_saves_cleanup_secondhand
  AFTER DELETE ON secondhand
  FOR EACH ROW EXECUTE FUNCTION cleanup_saves_for_deleted_listing('secondhand');

-- events
DROP TRIGGER IF EXISTS trg_saves_cleanup_events      ON events;
CREATE TRIGGER trg_saves_cleanup_events
  AFTER DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION cleanup_saves_for_deleted_listing('event');
