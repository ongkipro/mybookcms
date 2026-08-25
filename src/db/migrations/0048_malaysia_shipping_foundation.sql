-- Malaysia-owned shipping foundation (A-163).
--
-- These tables deliberately hold merchant policy, not a courier rate card. A
-- quote is possible only when both an active postcode range and exactly one
-- active weight rule exist. Reference rules are seeded separately and remain
-- inactive until an operator has confirmed a merchant rate card.

CREATE TABLE `shipping_zones` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `code` text NOT NULL,
  `name` text NOT NULL,
  `is_active` integer NOT NULL DEFAULT 1 CHECK (`is_active` IN (0, 1)),
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (`code` IN ('peninsular', 'sabah', 'sarawak', 'labuan'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipping_zones_code_unique` ON `shipping_zones` (`code`);
--> statement-breakpoint

CREATE TABLE `shipping_postcode_ranges` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `shipping_zone_id` integer NOT NULL,
  `postcode_start` text NOT NULL,
  `postcode_end` text NOT NULL,
  `is_active` integer NOT NULL DEFAULT 1 CHECK (`is_active` IN (0, 1)),
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`shipping_zone_id`) REFERENCES `shipping_zones`(`id`) ON DELETE RESTRICT,
  CHECK (`postcode_start` GLOB '[0-9][0-9][0-9][0-9][0-9]'),
  CHECK (`postcode_end` GLOB '[0-9][0-9][0-9][0-9][0-9]'),
  CHECK (`postcode_start` <= `postcode_end`)
);
--> statement-breakpoint
CREATE INDEX `shipping_postcode_ranges_active_lookup`
  ON `shipping_postcode_ranges` (`is_active`, `postcode_start`, `postcode_end`);
--> statement-breakpoint

CREATE TABLE `shipping_rate_rules` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `shipping_zone_id` integer NOT NULL,
  `min_weight_grams` integer NOT NULL,
  `max_weight_grams` integer NOT NULL,
  `amount_sen` integer NOT NULL,
  `is_active` integer NOT NULL DEFAULT 0 CHECK (`is_active` IN (0, 1)),
  `is_reference` integer NOT NULL DEFAULT 0 CHECK (`is_reference` IN (0, 1)),
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`shipping_zone_id`) REFERENCES `shipping_zones`(`id`) ON DELETE RESTRICT,
  CHECK (`min_weight_grams` > 0),
  CHECK (`max_weight_grams` >= `min_weight_grams`),
  CHECK (`amount_sen` >= 0)
);
--> statement-breakpoint
CREATE INDEX `shipping_rate_rules_active_lookup`
  ON `shipping_rate_rules` (`shipping_zone_id`, `is_active`, `min_weight_grams`, `max_weight_grams`);
--> statement-breakpoint

-- A database constraint, rather than an admin-only check, protects every
-- writer from publishing two active zones for one postcode.
CREATE TRIGGER `shipping_postcode_ranges_no_active_overlap_insert`
BEFORE INSERT ON `shipping_postcode_ranges`
WHEN NEW.`is_active` = 1 AND EXISTS (
  SELECT 1 FROM `shipping_postcode_ranges` AS existing
  WHERE existing.`is_active` = 1
    AND NEW.`postcode_start` <= existing.`postcode_end`
    AND NEW.`postcode_end` >= existing.`postcode_start`
)
BEGIN
  SELECT RAISE(ABORT, 'active shipping postcode ranges overlap');
END;
--> statement-breakpoint
CREATE TRIGGER `shipping_postcode_ranges_no_active_overlap_update`
BEFORE UPDATE OF `postcode_start`, `postcode_end`, `is_active` ON `shipping_postcode_ranges`
WHEN NEW.`is_active` = 1 AND EXISTS (
  SELECT 1 FROM `shipping_postcode_ranges` AS existing
  WHERE existing.`id` <> NEW.`id`
    AND existing.`is_active` = 1
    AND NEW.`postcode_start` <= existing.`postcode_end`
    AND NEW.`postcode_end` >= existing.`postcode_start`
)
BEGIN
  SELECT RAISE(ABORT, 'active shipping postcode ranges overlap');
END;
--> statement-breakpoint
CREATE TRIGGER `shipping_rate_rules_no_active_overlap_insert`
BEFORE INSERT ON `shipping_rate_rules`
WHEN NEW.`is_active` = 1 AND EXISTS (
  SELECT 1 FROM `shipping_rate_rules` AS existing
  WHERE existing.`shipping_zone_id` = NEW.`shipping_zone_id`
    AND existing.`is_active` = 1
    AND NEW.`min_weight_grams` <= existing.`max_weight_grams`
    AND NEW.`max_weight_grams` >= existing.`min_weight_grams`
)
BEGIN
  SELECT RAISE(ABORT, 'active shipping weight rules overlap');
END;
--> statement-breakpoint
CREATE TRIGGER `shipping_rate_rules_no_active_overlap_update`
BEFORE UPDATE OF `shipping_zone_id`, `min_weight_grams`, `max_weight_grams`, `is_active` ON `shipping_rate_rules`
WHEN NEW.`is_active` = 1 AND EXISTS (
  SELECT 1 FROM `shipping_rate_rules` AS existing
  WHERE existing.`id` <> NEW.`id`
    AND existing.`shipping_zone_id` = NEW.`shipping_zone_id`
    AND existing.`is_active` = 1
    AND NEW.`min_weight_grams` <= existing.`max_weight_grams`
    AND NEW.`max_weight_grams` >= existing.`min_weight_grams`
)
BEGIN
  SELECT RAISE(ABORT, 'active shipping weight rules overlap');
END;
--> statement-breakpoint

ALTER TABLE `orders` ADD `shipping_zone_code` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_rate_rule_id` integer REFERENCES `shipping_rate_rules`(`id`) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_amount_sen` integer;
--> statement-breakpoint

-- Existing historical orders remain NULL. Once the Malaysia quote is written,
-- it is an order fact and must never follow later rate-table edits.
CREATE TRIGGER `orders_shipping_quote_snapshot_complete_insert`
BEFORE INSERT ON `orders`
WHEN (NEW.`shipping_zone_code` IS NULL) <> (NEW.`shipping_rate_rule_id` IS NULL)
  OR (NEW.`shipping_zone_code` IS NULL) <> (NEW.`shipping_amount_sen` IS NULL)
  OR NEW.`shipping_amount_sen` < 0
BEGIN
  SELECT RAISE(ABORT, 'shipping quote snapshot must be complete');
END;
--> statement-breakpoint
CREATE TRIGGER `orders_shipping_quote_snapshot_complete_update`
BEFORE UPDATE OF `shipping_zone_code`, `shipping_rate_rule_id`, `shipping_amount_sen` ON `orders`
WHEN (NEW.`shipping_zone_code` IS NULL) <> (NEW.`shipping_rate_rule_id` IS NULL)
  OR (NEW.`shipping_zone_code` IS NULL) <> (NEW.`shipping_amount_sen` IS NULL)
  OR NEW.`shipping_amount_sen` < 0
BEGIN
  SELECT RAISE(ABORT, 'shipping quote snapshot must be complete');
END;
--> statement-breakpoint
CREATE TRIGGER `orders_shipping_quote_snapshot_immutable`
BEFORE UPDATE OF `shipping_zone_code`, `shipping_rate_rule_id`, `shipping_amount_sen` ON `orders`
WHEN OLD.`shipping_rate_rule_id` IS NOT NULL
 AND (
   NEW.`shipping_zone_code` IS NOT OLD.`shipping_zone_code`
   OR NEW.`shipping_rate_rule_id` IS NOT OLD.`shipping_rate_rule_id`
   OR NEW.`shipping_amount_sen` IS NOT OLD.`shipping_amount_sen`
 )
BEGIN
  SELECT RAISE(ABORT, 'shipping quote snapshot is immutable');
END;
