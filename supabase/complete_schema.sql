-- ============================================================================
-- AL UZER COMMON SERVICES CRM - COMPLETE CONSOLIDATED SUPABASE SCHEMA & DATA
-- ============================================================================
-- Run this entire script in your Supabase SQL Editor to set up all tables,
-- columns, indexes, RLS security policies, and import your existing live data.
-- ============================================================================

-- Enable pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. WORK TYPES MASTER TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.work_types (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL UNIQUE,
  expense numeric(12,2) NOT NULL DEFAULT 0 CHECK (expense >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. CUSTOMER RECORDS (JOBS & PAYMENTS) TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customer_records (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  customer_name text NOT NULL,
  mobile text NOT NULL DEFAULT '',
  work_type text NOT NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  charges numeric(12,2) NOT NULL DEFAULT 0 CHECK (charges >= 0),
  paid numeric(12,2) NOT NULL DEFAULT 0 CHECK (paid >= 0),
  expense numeric(12,2) NOT NULL DEFAULT 0 CHECK (expense >= 0),
  income numeric(12,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'PENDING',
  work_status text NOT NULL DEFAULT 'Pending',
  payment_mode text NOT NULL DEFAULT 'Cash',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure charges and payment_mode columns exist if table was created previously
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'customer_records' AND column_name = 'charges'
  ) THEN
    ALTER TABLE public.customer_records ADD COLUMN charges numeric(12,2) NOT NULL DEFAULT 0 CHECK (charges >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'customer_records' AND column_name = 'payment_mode'
  ) THEN
    ALTER TABLE public.customer_records ADD COLUMN payment_mode text NOT NULL DEFAULT 'Cash';
  END IF;
END $$;

-- ============================================================================
-- 3. SPENDINGS (BUSINESS EXPENSES) TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.spendings (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  expense_name text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  category text NOT NULL DEFAULT 'Business',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. SPENDING CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.spending_categories (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. WORK STATUSES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.work_statuses (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. KIRKOL (COUNTER REVENUE) TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.kirkol (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  work text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 7. SMS REMINDER SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sms_settings (
  id text PRIMARY KEY,
  enabled boolean DEFAULT true,
  min_days_overdue integer DEFAULT 5,
  reminder_frequency_days integer DEFAULT 5,
  reminder_time text DEFAULT '10:00 AM',
  max_reminders integer DEFAULT 3,
  message_template text NOT NULL,
  business_name text DEFAULT 'Your Business',
  gateway_api_key text,
  gateway_device_name text,
  gateway_last_seen timestamptz,
  updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 8. SMS REMINDER QUEUE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sms_queue (
  id text PRIMARY KEY,
  customer_id text,
  customer_name text NOT NULL,
  phone_number text NOT NULL,
  message text NOT NULL,
  balance numeric DEFAULT 0,
  days_overdue integer DEFAULT 0,
  work_type text,
  status text DEFAULT 'pending',
  scheduled_at timestamptz DEFAULT timezone('utc'::text, now()),
  attempts integer DEFAULT 0,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 9. SMS DISPATCH LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id text PRIMARY KEY,
  customer_id text,
  customer_name text NOT NULL,
  phone_number text NOT NULL,
  message text NOT NULL,
  balance numeric DEFAULT 0,
  status text NOT NULL,
  sent_at timestamptz DEFAULT timezone('utc'::text, now()),
  error_message text,
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- 10. APP & OWNER SECURITY CREDENTIALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_security (
  id text PRIMARY KEY DEFAULT 'owner_pin_config',
  owner_pin text NOT NULL DEFAULT '163692',
  updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_customer_records_created_at ON public.customer_records (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_records_work_type ON public.customer_records (work_type);
CREATE INDEX IF NOT EXISTS idx_customer_records_payment_status ON public.customer_records (payment_status);
CREATE INDEX IF NOT EXISTS idx_spendings_created_at ON public.spendings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kirkol_created_at ON public.kirkol (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_queue_status ON public.sms_queue(status);
CREATE INDEX IF NOT EXISTS idx_sms_queue_customer_id ON public.sms_queue(customer_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_customer_id ON public.sms_logs(customer_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.work_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spendings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spending_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kirkol ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_security ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'work_types', 'customer_records', 'spendings', 'spending_categories', 
    'work_statuses', 'kirkol', 'sms_settings', 'sms_queue', 'sms_logs', 'app_security'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "shared_select_%I" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "shared_select_%I" ON public.%I FOR SELECT TO anon, authenticated USING (true)', tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS "shared_insert_%I" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "shared_insert_%I" ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true)', tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS "shared_update_%I" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "shared_update_%I" ON public.%I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS "shared_delete_%I" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "shared_delete_%I" ON public.%I FOR DELETE TO anon, authenticated USING (true)', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================================
-- SPENDING CATEGORIES & WORK STATUSES
-- ============================================================================
INSERT INTO public.spending_categories (name) VALUES 
  ('Business'), ('Utilities'), ('Office supplies'), ('Personal') 
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.work_statuses (name) VALUES 
  ('Pending'), ('In Progress'), ('Payment Pending'), ('Document Required'), ('Completed'), ('Delivered'), ('Rejected'), ('Cancelled') 
ON CONFLICT (name) DO NOTHING;
