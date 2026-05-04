-- fts_search_patch.sql
-- Adds full-text-search and trigram indexes to services for fast keyword queries.

-- 1. Trigram extension (enables fast ILIKE / similarity queries)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Trigram GIN indexes on title and description
CREATE INDEX IF NOT EXISTS idx_services_title_trgm
  ON public.services USING gin(title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_services_description_trgm
  ON public.services USING gin(description gin_trgm_ops);

-- 3. tsvector column maintained by trigger
--    (GENERATED ALWAYS AS cannot use to_tsvector — it's only STABLE, not IMMUTABLE)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS fts tsvector;

CREATE OR REPLACE FUNCTION services_fts_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.fts := to_tsvector('simple',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS services_fts_trg ON public.services;
CREATE TRIGGER services_fts_trg
  BEFORE INSERT OR UPDATE OF title, description, tags
  ON public.services
  FOR EACH ROW EXECUTE FUNCTION services_fts_update();

-- Backfill existing rows
UPDATE public.services
  SET fts = to_tsvector('simple',
    coalesce(title, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(array_to_string(tags, ' '), '')
  );

CREATE INDEX IF NOT EXISTS idx_services_fts
  ON public.services USING gin(fts);
