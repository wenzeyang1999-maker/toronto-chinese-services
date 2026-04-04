-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Q&A Schema
-- questions: users ask public questions on a service
-- answers:   provider or any user can answer publicly
-- Safe to run multiple times (IF NOT EXISTS guards throughout).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS questions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  UUID        NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  asker_id    UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_service ON questions (service_id);
CREATE INDEX IF NOT EXISTS idx_questions_asker   ON questions (asker_id);

CREATE TABLE IF NOT EXISTS answers (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  UUID        NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answerer_id  UUID        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  content      TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_answers_question ON answers (question_id);
CREATE INDEX IF NOT EXISTS idx_answers_answerer ON answers (answerer_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers   ENABLE ROW LEVEL SECURITY;

-- Anyone can read questions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questions' AND policyname='anyone can read questions') THEN
    CREATE POLICY "anyone can read questions" ON questions FOR SELECT USING (true);
  END IF;
END $$;

-- Authenticated users can ask
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questions' AND policyname='users can insert own question') THEN
    CREATE POLICY "users can insert own question" ON questions FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL AND asker_id = auth.uid());
  END IF;
END $$;

-- Users can delete their own question
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questions' AND policyname='users can delete own question') THEN
    CREATE POLICY "users can delete own question" ON questions FOR DELETE
      USING (asker_id = auth.uid());
  END IF;
END $$;

-- Anyone can read answers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='answers' AND policyname='anyone can read answers') THEN
    CREATE POLICY "anyone can read answers" ON answers FOR SELECT USING (true);
  END IF;
END $$;

-- Authenticated users can answer
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='answers' AND policyname='users can insert own answer') THEN
    CREATE POLICY "users can insert own answer" ON answers FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL AND answerer_id = auth.uid());
  END IF;
END $$;

-- Users can update their own answer
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='answers' AND policyname='users can update own answer') THEN
    CREATE POLICY "users can update own answer" ON answers FOR UPDATE
      USING (answerer_id = auth.uid());
  END IF;
END $$;

-- Users can delete their own answer
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='answers' AND policyname='users can delete own answer') THEN
    CREATE POLICY "users can delete own answer" ON answers FOR DELETE
      USING (answerer_id = auth.uid());
  END IF;
END $$;
