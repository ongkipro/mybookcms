-- Calibrated merchant-owned Malaysia shipping reference rates (A-177).
--
-- Research reference, retrieved 2026-08-23:
-- https://www.ninjavan.co/en-my/logistics-solutions/last-mile-parcel-delivery
-- Public postpaid tables publish per-kilogram West/East rates exclusive of
-- tax and COD fees. MyBook rounds those rates into customer-facing policy that
-- includes a small pickup/tax buffer. This does not book or quote a courier.

-- Retire only the exact original preview rules. A merchant-edited rule is left
-- untouched, and immutable historical order snapshots keep their referenced ID.
UPDATE `shipping_rate_rules`
SET `is_active` = 0, `updated_at` = CURRENT_TIMESTAMP
WHERE `is_reference` = 1
  AND `min_weight_grams` = 1
  AND `max_weight_grams` = 5000
  AND (
    (`amount_sen` = 650 AND `shipping_zone_id` = (
      SELECT `id` FROM `shipping_zones` WHERE `code` = 'peninsular'
    ))
    OR
    (`amount_sen` = 1300 AND `shipping_zone_id` IN (
      SELECT `id` FROM `shipping_zones` WHERE `code` IN ('sabah', 'sarawak', 'labuan')
    ))
  );
--> statement-breakpoint

-- Exact kilogram bands prevent a 5 kg parcel from receiving the 1 kg price.
-- Peninsular: RM8/9/10/11/12. East Malaysia and Labuan:
-- RM15/26/39/48/60. Amounts remain integer sen and operator-editable.
WITH `reference_rates` (`zone_code`, `min_grams`, `max_grams`, `amount_sen`) AS (
  VALUES
    ('peninsular', 1, 1000, 800),
    ('peninsular', 1001, 2000, 900),
    ('peninsular', 2001, 3000, 1000),
    ('peninsular', 3001, 4000, 1100),
    ('peninsular', 4001, 5000, 1200),
    ('sabah', 1, 1000, 1500),
    ('sabah', 1001, 2000, 2600),
    ('sabah', 2001, 3000, 3900),
    ('sabah', 3001, 4000, 4800),
    ('sabah', 4001, 5000, 6000),
    ('sarawak', 1, 1000, 1500),
    ('sarawak', 1001, 2000, 2600),
    ('sarawak', 2001, 3000, 3900),
    ('sarawak', 3001, 4000, 4800),
    ('sarawak', 4001, 5000, 6000),
    ('labuan', 1, 1000, 1500),
    ('labuan', 1001, 2000, 2600),
    ('labuan', 2001, 3000, 3900),
    ('labuan', 3001, 4000, 4800),
    ('labuan', 4001, 5000, 6000)
)
INSERT INTO `shipping_rate_rules` (
  `shipping_zone_id`, `min_weight_grams`, `max_weight_grams`, `amount_sen`,
  `is_active`, `is_reference`, `state_code`
)
SELECT z.`id`, rates.`min_grams`, rates.`max_grams`, rates.`amount_sen`, 1, 1, NULL
FROM `reference_rates` rates
INNER JOIN `shipping_zones` z ON z.`code` = rates.`zone_code`
WHERE NOT EXISTS (
  SELECT 1 FROM `shipping_rate_rules` existing
  WHERE existing.`shipping_zone_id` = z.`id`
    AND existing.`state_code` IS NULL
    AND existing.`is_active` = 1
    AND rates.`min_grams` <= existing.`max_weight_grams`
    AND rates.`max_grams` >= existing.`min_weight_grams`
);
--> statement-breakpoint

-- One primary 1 kg row per state/WP keeps the admin's state list concise.
-- Higher bands deliberately fall back to the matching calibrated zone rule.
WITH `state_rates` (`state_code`, `zone_code`, `amount_sen`) AS (
  VALUES
    ('johor', 'peninsular', 800),
    ('kedah', 'peninsular', 800),
    ('kelantan', 'peninsular', 800),
    ('melaka', 'peninsular', 800),
    ('negeri_sembilan', 'peninsular', 800),
    ('pahang', 'peninsular', 800),
    ('perak', 'peninsular', 800),
    ('perlis', 'peninsular', 800),
    ('pulau_pinang', 'peninsular', 800),
    ('selangor', 'peninsular', 800),
    ('terengganu', 'peninsular', 800),
    ('kuala_lumpur', 'peninsular', 800),
    ('putrajaya', 'peninsular', 800),
    ('sabah', 'sabah', 1500),
    ('sarawak', 'sarawak', 1500),
    ('labuan', 'labuan', 1500)
)
INSERT INTO `shipping_rate_rules` (
  `shipping_zone_id`, `min_weight_grams`, `max_weight_grams`, `amount_sen`,
  `is_active`, `is_reference`, `state_code`
)
SELECT z.`id`, 1, 1000, states.`amount_sen`, 1, 1, states.`state_code`
FROM `state_rates` states
INNER JOIN `shipping_zones` z ON z.`code` = states.`zone_code`
WHERE NOT EXISTS (
  SELECT 1 FROM `shipping_rate_rules` existing
  WHERE existing.`shipping_zone_id` = z.`id`
    AND existing.`state_code` = states.`state_code`
    AND existing.`is_active` = 1
    AND 1 <= existing.`max_weight_grams`
    AND 1000 >= existing.`min_weight_grams`
);
