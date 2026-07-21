DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'analysis_reservation_status') THEN
    CREATE TYPE analysis_reservation_status AS ENUM ('PENDING', 'CONSUMED', 'CANCELLED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'analysis_reservation_source') THEN
    CREATE TYPE analysis_reservation_source AS ENUM ('FREE', 'PREMIUM');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_intent_status') THEN
    CREATE TYPE purchase_intent_status AS ENUM ('PENDING', 'PAID', 'CANCELLED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS entitlement_settings (
  id VARCHAR(32) PRIMARY KEY,
  premium_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  premium_credits_per_purchase INTEGER NOT NULL DEFAULT 3,
  groble_payment_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT entitlement_settings_singleton CHECK (id = 'singleton')
);

CREATE TABLE IF NOT EXISTS analysis_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  premium_credits_granted INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source analysis_reservation_source NOT NULL,
  status analysis_reservation_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS purchase_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status purchase_intent_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_payment_id VARCHAR(255) NOT NULL,
  credits_granted INTEGER NOT NULL,
  raw_event JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_reservations_user_id
  ON analysis_reservations (user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_reservations_status
  ON analysis_reservations (status);
CREATE INDEX IF NOT EXISTS idx_purchase_intents_user_id
  ON purchase_intents (user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_intents_status
  ON purchase_intents (status);
CREATE INDEX IF NOT EXISTS idx_payment_entitlements_user_id
  ON payment_entitlements (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_entitlements_provider_payment_id
  ON payment_entitlements (provider_payment_id);

INSERT INTO entitlement_settings (
  id,
  premium_enabled,
  premium_credits_per_purchase,
  groble_payment_url
)
VALUES (
  'singleton',
  FALSE,
  3,
  'https://www.groble.im/payment/4SGBV5'
)
ON CONFLICT DO NOTHING;
