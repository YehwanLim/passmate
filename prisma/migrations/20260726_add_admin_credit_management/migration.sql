ALTER TYPE analysis_reservation_source ADD VALUE IF NOT EXISTS 'BONUS';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_credit_grant_source') THEN
    CREATE TYPE admin_credit_grant_source AS ENUM ('MANUAL', 'COUPON');
  END IF;
END
$$;

ALTER TABLE analysis_entitlements
  ADD COLUMN IF NOT EXISTS bonus_credits_granted INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS credit_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  credits_granted INTEGER NOT NULL CHECK (credits_granted BETWEEN 1 AND 10000),
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT credit_coupons_usage_limit CHECK (max_uses IS NULL OR used_count <= max_uses)
);

CREATE TABLE IF NOT EXISTS admin_credit_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  granted_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  credits_granted INTEGER NOT NULL CHECK (credits_granted BETWEEN 1 AND 10000),
  source admin_credit_grant_source NOT NULL,
  coupon_id UUID REFERENCES credit_coupons(id) ON DELETE RESTRICT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_credit_grants_source_coupon CHECK (
    (source = 'MANUAL' AND coupon_id IS NULL) OR (source = 'COUPON' AND coupon_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS admin_credit_grants_user_id
  ON admin_credit_grants (user_id);
CREATE INDEX IF NOT EXISTS admin_credit_grants_granted_by_user_id
  ON admin_credit_grants (granted_by_user_id);
CREATE INDEX IF NOT EXISTS admin_credit_grants_coupon_id
  ON admin_credit_grants (coupon_id);
CREATE UNIQUE INDEX IF NOT EXISTS admin_credit_grants_one_coupon_per_user
  ON admin_credit_grants (coupon_id, user_id)
  WHERE coupon_id IS NOT NULL;
