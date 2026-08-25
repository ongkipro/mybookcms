-- Local preview seed only. Run through the local D1 binding; never pass this
-- file to a --remote command. Active demo rates use published 2025 Ninja Van
-- starting rates as a merchant-owned reference; MyBookCMS does not integrate
-- with or book shipments through that courier.

INSERT INTO shipping_zones (code, name, is_active)
VALUES
  ('peninsular', 'Peninsular Malaysia', 1),
  ('sabah', 'Sabah', 1),
  ('sarawak', 'Sarawak', 1),
  ('labuan', 'Labuan', 1)
ON CONFLICT(code) DO UPDATE SET name = excluded.name, is_active = excluded.is_active, updated_at = CURRENT_TIMESTAMP;

INSERT INTO shipping_postcode_ranges (shipping_zone_id, postcode_start, postcode_end, is_active)
SELECT id, '01000', '86999', 1 FROM shipping_zones WHERE code = 'peninsular'
  AND NOT EXISTS (
    SELECT 1 FROM shipping_postcode_ranges
    WHERE postcode_start = '01000' AND postcode_end = '86999'
  );
INSERT INTO shipping_postcode_ranges (shipping_zone_id, postcode_start, postcode_end, is_active)
SELECT id, '87000', '87033', 1 FROM shipping_zones WHERE code = 'labuan'
  AND NOT EXISTS (
    SELECT 1 FROM shipping_postcode_ranges
    WHERE postcode_start = '87000' AND postcode_end = '87033'
  );
UPDATE shipping_postcode_ranges
SET postcode_end = '91400', updated_at = CURRENT_TIMESTAMP
WHERE shipping_zone_id = (SELECT id FROM shipping_zones WHERE code = 'sabah')
  AND postcode_start = '88000' AND postcode_end = '91309';
INSERT INTO shipping_postcode_ranges (shipping_zone_id, postcode_start, postcode_end, is_active)
SELECT id, '88000', '91400', 1 FROM shipping_zones WHERE code = 'sabah'
  AND NOT EXISTS (
    SELECT 1 FROM shipping_postcode_ranges
    WHERE is_active = 1 AND postcode_start <= '91400' AND postcode_end >= '88000'
  );
INSERT INTO shipping_postcode_ranges (shipping_zone_id, postcode_start, postcode_end, is_active)
SELECT id, '93000', '98859', 1 FROM shipping_zones WHERE code = 'sarawak'
  AND NOT EXISTS (
    SELECT 1 FROM shipping_postcode_ranges
    WHERE postcode_start = '93000' AND postcode_end = '98859'
  );

-- Current public courier tables are used only as a research benchmark. These
-- rounded merchant rules include a pickup/tax buffer, remain editable, and do
-- not imply a live quote or courier booking.
UPDATE shipping_rate_rules
SET is_active = 0, updated_at = CURRENT_TIMESTAMP
WHERE is_reference = 1 AND min_weight_grams = 1 AND max_weight_grams = 5000
  AND ((amount_sen = 650 AND shipping_zone_id = (SELECT id FROM shipping_zones WHERE code = 'peninsular'))
    OR (amount_sen = 1300 AND shipping_zone_id IN (SELECT id FROM shipping_zones WHERE code IN ('sabah', 'sarawak', 'labuan'))));

WITH reference_rates(zone_code, min_grams, max_grams, amount_sen) AS (
  VALUES
    ('peninsular', 1, 1000, 800),
    ('peninsular', 1001, 2000, 900),
    ('peninsular', 2001, 3000, 1000),
    ('peninsular', 3001, 4000, 1100),
    ('peninsular', 4001, 5000, 1200),
    ('sabah', 1, 1000, 1500), ('sabah', 1001, 2000, 2600),
    ('sabah', 2001, 3000, 3900), ('sabah', 3001, 4000, 4800),
    ('sabah', 4001, 5000, 6000),
    ('sarawak', 1, 1000, 1500), ('sarawak', 1001, 2000, 2600),
    ('sarawak', 2001, 3000, 3900), ('sarawak', 3001, 4000, 4800),
    ('sarawak', 4001, 5000, 6000),
    ('labuan', 1, 1000, 1500), ('labuan', 1001, 2000, 2600),
    ('labuan', 2001, 3000, 3900), ('labuan', 3001, 4000, 4800),
    ('labuan', 4001, 5000, 6000)
)
INSERT INTO shipping_rate_rules (
  shipping_zone_id, min_weight_grams, max_weight_grams, amount_sen,
  is_active, is_reference, state_code
)
SELECT z.id, rates.min_grams, rates.max_grams, rates.amount_sen, 1, 1, NULL
FROM reference_rates rates
INNER JOIN shipping_zones z ON z.code = rates.zone_code
WHERE NOT EXISTS (
  SELECT 1 FROM shipping_rate_rules existing
  WHERE existing.shipping_zone_id = z.id AND existing.state_code IS NULL
    AND existing.is_active = 1
    AND rates.min_grams <= existing.max_weight_grams
    AND rates.max_grams >= existing.min_weight_grams
);

WITH state_rates(state_code, zone_code, amount_sen) AS (
  VALUES
    ('johor', 'peninsular', 800), ('kedah', 'peninsular', 800),
    ('kelantan', 'peninsular', 800), ('melaka', 'peninsular', 800),
    ('negeri_sembilan', 'peninsular', 800), ('pahang', 'peninsular', 800),
    ('perak', 'peninsular', 800), ('perlis', 'peninsular', 800),
    ('pulau_pinang', 'peninsular', 800), ('selangor', 'peninsular', 800),
    ('terengganu', 'peninsular', 800), ('kuala_lumpur', 'peninsular', 800),
    ('putrajaya', 'peninsular', 800), ('sabah', 'sabah', 1500),
    ('sarawak', 'sarawak', 1500), ('labuan', 'labuan', 1500)
)
INSERT INTO shipping_rate_rules (
  shipping_zone_id, min_weight_grams, max_weight_grams, amount_sen,
  is_active, is_reference, state_code
)
SELECT z.id, 1, 1000, states.amount_sen, 1, 1, states.state_code
FROM state_rates states
INNER JOIN shipping_zones z ON z.code = states.zone_code
WHERE NOT EXISTS (
  SELECT 1 FROM shipping_rate_rules existing
  WHERE existing.shipping_zone_id = z.id AND existing.state_code = states.state_code
    AND existing.is_active = 1
    AND 1 <= existing.max_weight_grams AND 1000 >= existing.min_weight_grams
);
