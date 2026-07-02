-- ============================================================
-- Migration 001: Initial schema for Coupon Marketplace
-- Run this in the Supabase SQL Editor (or via supabase db push)
-- ============================================================

-- Enable pgcrypto for uuid generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable pg_trgm for text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE coupon_status AS ENUM ('available', 'sold');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS coupons (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name            TEXT NOT NULL,
  category              TEXT NOT NULL,
  title                 TEXT NOT NULL,
  expiry_date           DATE NOT NULL,
  terms_and_conditions  TEXT[] NOT NULL DEFAULT '{}',
  price                 NUMERIC(10, 2) NOT NULL,
  coupon_code_encrypted TEXT NOT NULL,          -- AES-256-GCM encrypted, server-only
  masked_code           TEXT NOT NULL,          -- public safe display e.g. "IXI****"
  status                coupon_status NOT NULL DEFAULT 'available',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coupon_id            UUID NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
  payment_id           TEXT,                    -- Razorpay payment_id (set after success)
  razorpay_order_id    TEXT NOT NULL UNIQUE,    -- Razorpay order ID
  razorpay_signature   TEXT,                    -- Verified signature
  payment_status       payment_status NOT NULL DEFAULT 'pending',
  amount               NUMERIC(10, 2) NOT NULL,
  currency             TEXT NOT NULL DEFAULT 'INR',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional audit table for coupon reveals
CREATE TABLE IF NOT EXISTS coupon_reveals_audit (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coupon_id   UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  revealed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address  TEXT
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Coupons: browse/filter index
CREATE INDEX IF NOT EXISTS idx_coupons_status_category_expiry
  ON coupons (status, category, expiry_date);

-- Coupons: full-text / trigram search on title and brand
CREATE INDEX IF NOT EXISTS idx_coupons_title_trgm
  ON coupons USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_coupons_brand_trgm
  ON coupons USING GIN (brand_name gin_trgm_ops);

-- Orders: user timeline
CREATE INDEX IF NOT EXISTS idx_orders_user_created
  ON orders (user_id, created_at DESC);

-- Orders: lookup by Razorpay order ID (webhook idempotency)
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id
  ON orders (razorpay_order_id);

-- Audit: user timeline
CREATE INDEX IF NOT EXISTS idx_coupon_reveals_audit_user
  ON coupon_reveals_audit (user_id, revealed_at DESC);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_coupons_updated_at
    BEFORE UPDATE ON coupons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_reveals_audit ENABLE ROW LEVEL SECURITY;

-- ----- COUPONS policies -----

-- Public: anyone can read safe coupon fields (masked_code only, not encrypted code)
-- Note: coupon_code_encrypted is excluded from the SELECT grant below
CREATE POLICY "coupons_public_read" ON coupons
  FOR SELECT
  TO public
  USING (true);

-- Admin: full write access (insert / update / delete)
-- Replace 'admin_role' with your actual admin role name or use a metadata check
CREATE POLICY "coupons_admin_insert" ON coupons
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "coupons_admin_update" ON coupons
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "coupons_admin_delete" ON coupons
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ----- ORDERS policies -----

-- Authenticated users can read their own orders only
CREATE POLICY "orders_user_read_own" ON orders
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Authenticated users can insert their own orders
CREATE POLICY "orders_user_insert" ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Server (service_role) can update orders (webhook fulfillment)
-- No RLS policy needed for service_role — it bypasses RLS by default

-- ----- AUDIT policies -----

CREATE POLICY "audit_user_read_own" ON coupon_reveals_audit
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "audit_user_insert_own" ON coupon_reveals_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- COLUMN-LEVEL SECURITY: restrict coupon_code_encrypted
-- Only service_role (server-side) should access this column.
-- Revoke from anon + authenticated.
-- ============================================================

REVOKE SELECT (coupon_code_encrypted) ON coupons FROM anon;
REVOKE SELECT (coupon_code_encrypted) ON coupons FROM authenticated;

-- ============================================================
-- SEED DATA (example coupons — remove in production)
-- ============================================================

-- NOTE: Replace 'ENCRYPTED_VALUE' with actual encrypted values
-- generated by your server-side encryptCode() utility.
-- This is a placeholder to illustrate the schema.

/*
INSERT INTO coupons (brand_name, category, title, expiry_date, terms_and_conditions, price, coupon_code_encrypted, masked_code)
VALUES
  ('ixigo', 'Flights', 'Up to ₹6000 off on flights', '2025-12-31',
   ARRAY[
     'Valid on ixigo app and website',
     'Minimum booking value ₹5000',
     'Maximum discount ₹6000',
     'Valid for domestic flights only',
     'Not valid on already discounted fares'
   ],
   49, 'ENCRYPTED_VALUE_HERE', 'IXI****'),
  ('Lenskart', 'Eyewear', '₹500 off on eyeglasses', '2025-10-31',
   ARRAY[
     'Valid on first purchase',
     'Minimum order value ₹1500',
     'Cannot be clubbed with other offers'
   ],
   29, 'ENCRYPTED_VALUE_HERE', 'LEN****');
*/
