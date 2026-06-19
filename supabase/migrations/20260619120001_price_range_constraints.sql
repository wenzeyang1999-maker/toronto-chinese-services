-- Price/salary range guards for jobs, properties, secondhand.
-- services already has services_price_range (db_constraints_patch.sql); these
-- bring the other listing tables in line so the DB rejects negative or absurd
-- values even if the client-side validation is bypassed.
--
-- Caps are intentionally generous (just enough to catch garbage, not to reject
-- legitimate listings) and all guards allow NULL since price/salary are optional.

-- jobs: non-negative salaries, generous upper bound, and min <= max when both set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'jobs'
      AND constraint_name = 'jobs_salary_range'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_salary_range CHECK (
        (salary_min IS NULL OR (salary_min >= 0 AND salary_min <= 10000000)) AND
        (salary_max IS NULL OR (salary_max >= 0 AND salary_max <= 10000000)) AND
        (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max)
      );
  END IF;
END $$;

-- properties: non-negative price, generous upper bound (Toronto sales reach 8 figures)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'properties'
      AND constraint_name = 'properties_price_range'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_price_range
        CHECK (price IS NULL OR (price >= 0 AND price <= 100000000));
  END IF;
END $$;

-- secondhand: non-negative price, generous upper bound
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'secondhand'
      AND constraint_name = 'secondhand_price_range'
  ) THEN
    ALTER TABLE public.secondhand
      ADD CONSTRAINT secondhand_price_range
        CHECK (price IS NULL OR (price >= 0 AND price <= 10000000));
  END IF;
END $$;
