-- ── Provider Profile Migration ────────────────────────────────────────────────
-- Adds: business_type, skill_tags (proper column), certifications, online coords

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS business_type  TEXT    NOT NULL DEFAULT 'individual'
    CHECK (business_type IN ('individual','business')),
  ADD COLUMN IF NOT EXISTS skill_tags     TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS certifications JSONB   NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS online_lat     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS online_lng     DOUBLE PRECISION;

-- Migrate existing tags from social_links._tags → skill_tags
UPDATE public.users
SET skill_tags = ARRAY(
  SELECT trim(t)
  FROM unnest(string_to_array(social_links->>'_tags', ',')) AS t
  WHERE trim(t) != ''
)
WHERE social_links->>'_tags' IS NOT NULL
  AND trim(social_links->>'_tags') != '';

-- GIN index for fast array contains queries (skill_tags @> ARRAY[kw])
CREATE INDEX IF NOT EXISTS users_skill_tags_gin ON public.users USING GIN (skill_tags);

-- Index for online providers map query
CREATE INDEX IF NOT EXISTS users_is_online_idx ON public.users (is_online)
  WHERE is_online = true;
