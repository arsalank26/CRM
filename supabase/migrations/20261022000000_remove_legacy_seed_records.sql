-- Remove the former owner's bundled starter records from existing databases.
-- Matches every seeded business field and timestamp so unrelated rows are retained.
WITH legacy_customers(created_at, work_type, total_amount, paid, expense, income, payment_status, work_status) AS (
  VALUES
    ('2026-09-03T10:00:00Z'::timestamptz, 'PAN CARD 500', 450.00::numeric, 450.00::numeric, 320.00::numeric, 130.00::numeric, 'PAID', 'Pending'),
    ('2026-09-03T10:30:00Z'::timestamptz, 'ELECTION', 300.00::numeric, 300.00::numeric, 20.00::numeric, 280.00::numeric, 'PAID', 'In Progress'),
    ('2026-09-03T11:00:00Z'::timestamptz, 'ELECTION', 300.00::numeric, 300.00::numeric, 20.00::numeric, 280.00::numeric, 'PAID', 'Payment Pending'),
    ('2026-09-03T11:30:00Z'::timestamptz, 'PAN CARD 400', 400.00::numeric, 400.00::numeric, 220.00::numeric, 180.00::numeric, 'PAID', 'Pending'),
    ('2026-09-03T12:00:00Z'::timestamptz, 'DRIVING LICENSE (2W+4W TRANSPO', 5500.00::numeric, 3500.00::numeric, 3500.00::numeric, 2000.00::numeric, 'PARTIAL', 'Pending'),
    ('2026-09-02T10:00:00Z'::timestamptz, 'AADHAR PAN LINK', 1200.00::numeric, 1200.00::numeric, 1000.00::numeric, 200.00::numeric, 'PAID', 'In Progress'),
    ('2026-09-02T11:00:00Z'::timestamptz, 'PASSPORT', 3000.00::numeric, 2500.00::numeric, 2500.00::numeric, 500.00::numeric, 'PARTIAL', 'Pending'),
    ('2026-09-01T10:00:00Z'::timestamptz, 'INCOME', 250.00::numeric, 250.00::numeric, 170.00::numeric, 80.00::numeric, 'PAID', 'In Progress'),
    ('2026-09-01T11:00:00Z'::timestamptz, 'ELECTION', 300.00::numeric, 300.00::numeric, 20.00::numeric, 280.00::numeric, 'PAID', 'In Progress'),
    ('2026-09-01T11:30:00Z'::timestamptz, 'ELECTION', 300.00::numeric, 300.00::numeric, 20.00::numeric, 280.00::numeric, 'PAID', 'In Progress'),
    ('2026-09-01T12:00:00Z'::timestamptz, 'PAN CARD 250', 250.00::numeric, 250.00::numeric, 120.00::numeric, 130.00::numeric, 'PAID', 'Pending')
)
DELETE FROM public.customer_records AS customer
USING legacy_customers AS legacy
WHERE customer.created_at = legacy.created_at
  AND customer.work_type = legacy.work_type
  AND customer.total_amount = legacy.total_amount
  AND customer.charges = 0
  AND customer.paid = legacy.paid
  AND customer.expense = legacy.expense
  AND customer.income = legacy.income
  AND customer.payment_status = legacy.payment_status
  AND customer.work_status = legacy.work_status
  AND customer.payment_mode = 'Cash';

WITH legacy_kirkol(work, price, created_at) AS (
  VALUES
    ('2000 MT T', 20.00::numeric, '2026-09-04T09:00:00Z'::timestamptz),
    ('AADHAAR', 60.00::numeric, '2026-09-04T09:15:00Z'::timestamptz),
    ('AADHAAR', 60.00::numeric, '2026-09-04T09:30:00Z'::timestamptz),
    ('ADHAAR', 60.00::numeric, '2026-09-04T09:45:00Z'::timestamptz),
    ('PVC CARD', 100.00::numeric, '2026-09-04T10:00:00Z'::timestamptz),
    ('8000 ONLNE YUKUB BHAI J', 80.00::numeric, '2026-09-04T10:15:00Z'::timestamptz),
    ('PHOTO', 50.00::numeric, '2026-09-04T10:30:00Z'::timestamptz),
    ('5000 MT', 50.00::numeric, '2026-09-04T10:45:00Z'::timestamptz),
    ('2000 MT', 20.00::numeric, '2026-09-04T11:00:00Z'::timestamptz),
    ('1000 MJ', 10.00::numeric, '2026-09-04T11:15:00Z'::timestamptz),
    ('AADHAAR', 60.00::numeric, '2026-09-04T11:30:00Z'::timestamptz),
    ('2000MT T', 20.00::numeric, '2026-09-03T09:00:00Z'::timestamptz),
    ('COLOUR PRINT', 10.00::numeric, '2026-09-03T09:30:00Z'::timestamptz),
    ('AADHAR', 60.00::numeric, '2026-09-03T10:00:00Z'::timestamptz),
    ('850 MT J', 10.00::numeric, '2026-09-03T10:30:00Z'::timestamptz),
    ('MHA ID', 100.00::numeric, '2026-09-03T11:00:00Z'::timestamptz),
    ('500MT T', 10.00::numeric, '2026-09-03T11:30:00Z'::timestamptz),
    ('AADHAR', 120.00::numeric, '2026-09-03T12:00:00Z'::timestamptz),
    ('500 MT J', 10.00::numeric, '2026-09-03T12:30:00Z'::timestamptz),
    ('12500 MT J', 130.00::numeric, '2026-09-03T13:00:00Z'::timestamptz),
    ('2000 MT T', 20.00::numeric, '2026-09-03T13:30:00Z'::timestamptz),
    ('500 LADKI BAHEN J', 10.00::numeric, '2026-09-03T14:00:00Z'::timestamptz),
    ('400 MT T', 10.00::numeric, '2026-09-03T14:30:00Z'::timestamptz),
    ('PHOTO', 50.00::numeric, '2026-09-03T15:00:00Z'::timestamptz),
    ('PHOTO', 50.00::numeric, '2026-09-03T15:30:00Z'::timestamptz),
    ('MAHA ID', 200.00::numeric, '2026-09-03T16:00:00Z'::timestamptz),
    ('LETTER HEAD', 80.00::numeric, '2026-09-03T16:30:00Z'::timestamptz),
    ('10000 mt j', 100.00::numeric, '2026-09-03T17:00:00Z'::timestamptz),
    ('2200 MT J', 30.00::numeric, '2026-09-03T17:30:00Z'::timestamptz),
    ('AADHAR', 60.00::numeric, '2026-09-03T18:00:00Z'::timestamptz),
    ('2000 MONEY TRANSFER', 20.00::numeric, '2026-09-03T18:30:00Z'::timestamptz)
)
DELETE FROM public.kirkol AS record
USING legacy_kirkol AS legacy
WHERE record.work = legacy.work
  AND record.price = legacy.price
  AND record.created_at = legacy.created_at;

DELETE FROM public.app_security
WHERE id = 'owner_pin_config' AND owner_pin = '163692';

DELETE FROM public.sms_settings
WHERE id = 'sms-default-config'
  AND gateway_api_key = 'alz-gateway-sim-sec-key-889';
