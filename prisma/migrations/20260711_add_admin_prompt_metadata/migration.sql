DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'prompt_template_type'
  ) THEN
    CREATE TYPE prompt_template_type AS ENUM (
      'resume-analysis',
      'cover-letter',
      'summary',
      'feedback',
      'interview-questions'
    );
  END IF;
END
$$;

ALTER TABLE prompt_templates
  ADD COLUMN IF NOT EXISTS prompt_type prompt_template_type,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'prompt_templates'
      AND column_name = 'prompt_type'
      AND udt_name <> 'prompt_template_type'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM prompt_templates
      WHERE prompt_type IS NOT NULL
        AND prompt_type::text NOT IN (
          'resume-analysis',
          'cover-letter',
          'summary',
          'feedback',
          'interview-questions'
        )
    ) THEN
      RAISE EXCEPTION 'prompt_templates.prompt_type contains unsupported values';
    END IF;

    ALTER TABLE prompt_templates
      ALTER COLUMN prompt_type TYPE prompt_template_type
      USING prompt_type::prompt_template_type;
  END IF;
END
$$;

UPDATE prompt_templates
SET updated_at = NOW()
WHERE updated_at IS NULL;

ALTER TABLE prompt_templates
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION set_prompt_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_prompt_templates_updated_at ON prompt_templates;

CREATE TRIGGER set_prompt_templates_updated_at
  BEFORE UPDATE ON prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_prompt_templates_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS uq_prompt_templates_type_version
  ON prompt_templates (prompt_type, version)
  WHERE prompt_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prompt_templates_prompt_type
  ON prompt_templates (prompt_type);
