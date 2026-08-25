-- MyBookCMS Malaysia cutover: remove provider, advertising, and abandoned-lead persistence.
--
-- `orders` has legacy foreign keys to warehouse and pickup tables. SQLite
-- cannot DROP those columns in place, so this forward migration rebuilds the
-- relation once, preserving every retained order fact and its primary key.
-- `courier_code`, `courier_service`, and `cnote_no` remain the neutral manual
-- fulfilment record; the Malaysia shipping quote snapshot remains unchanged.

DROP TABLE `payment_reconciliation_audits`;
--> statement-breakpoint
DROP TABLE `payment_transactions`;
--> statement-breakpoint
DROP TABLE `provider_dispatch_locks`;
--> statement-breakpoint
DROP TABLE `courier_rules`;
--> statement-breakpoint
DROP TABLE `capi_event_outbox`;
--> statement-breakpoint
DROP TRIGGER `orders_shipping_quote_snapshot_complete_insert`;
--> statement-breakpoint
DROP TRIGGER `orders_shipping_quote_snapshot_complete_update`;
--> statement-breakpoint
DROP TRIGGER `orders_shipping_quote_snapshot_immutable`;
--> statement-breakpoint
PRAGMA defer_foreign_keys = ON;
--> statement-breakpoint
CREATE TABLE `orders_mybookcms_cutover` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `order_number` text NOT NULL,
  `store_id` integer NOT NULL,
  `customer_name` text NOT NULL,
  `customer_phone` text NOT NULL,
  `address` text NOT NULL,
  `province` text NOT NULL,
  `city` text NOT NULL,
  `district` text NOT NULL,
  `postal_code` text,
  `total_amount` integer NOT NULL,
  `shipping_cost` integer DEFAULT 0 NOT NULL,
  `discount_amount` integer DEFAULT 0,
  `payment_method` text DEFAULT 'cod' NOT NULL,
  `payment_status` text DEFAULT 'unpaid' NOT NULL,
  `shipping_status` text DEFAULT 'pending' NOT NULL,
  `courier_code` text,
  `courier_service` text,
  `cnote_no` text,
  `created_at` text NOT NULL,
  `submit_token` text,
  `customer_email` text,
  `public_status_token` text,
  `confirmed_at` text,
  `seller_bank_account_id` integer,
  `seller_bank_code` text,
  `seller_bank_name` text,
  `seller_account_holder` text,
  `seller_account_number` text,
  `stock_restored_at` text,
  `shipping_zone_code` text,
  `shipping_rate_rule_id` integer REFERENCES `shipping_rate_rules`(`id`) ON DELETE RESTRICT,
  `shipping_amount_sen` integer,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `orders_mybookcms_cutover` (
  id, order_number, store_id, customer_name, customer_phone, address, province,
  city, district, postal_code, total_amount, shipping_cost, discount_amount,
  payment_method, payment_status, shipping_status, courier_code, courier_service,
  cnote_no, created_at, submit_token, customer_email, public_status_token,
  confirmed_at, seller_bank_account_id, seller_bank_code, seller_bank_name,
  seller_account_holder, seller_account_number, stock_restored_at,
  shipping_zone_code, shipping_rate_rule_id, shipping_amount_sen
)
SELECT
  id, order_number, store_id, customer_name, customer_phone, address, province,
  city, district, postal_code, total_amount, shipping_cost, discount_amount,
  payment_method, payment_status, shipping_status, courier_code, courier_service,
  cnote_no, created_at, submit_token, customer_email, public_status_token,
  confirmed_at, seller_bank_account_id, seller_bank_code, seller_bank_name,
  seller_account_holder, seller_account_number, stock_restored_at,
  shipping_zone_code, shipping_rate_rule_id, shipping_amount_sen
FROM `orders`;
--> statement-breakpoint
DROP TABLE `orders`;
--> statement-breakpoint
ALTER TABLE `orders_mybookcms_cutover` RENAME TO `orders`;
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_submit_token_unique` ON `orders` (`submit_token`);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_public_status_token_unique` ON `orders` (`public_status_token`);
--> statement-breakpoint
CREATE INDEX `idx_orders_shipping_created` ON `orders` (`shipping_status`, `created_at`);
--> statement-breakpoint
CREATE INDEX `idx_orders_created_at` ON `orders` (`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_orders_created_id` ON `orders` (`created_at` DESC, `id` DESC);
--> statement-breakpoint
CREATE INDEX `idx_orders_order_number` ON `orders` (`order_number`);
--> statement-breakpoint
CREATE INDEX `idx_orders_public_status_token` ON `orders` (`public_status_token`);
--> statement-breakpoint
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
 AND (NEW.`shipping_zone_code` IS NOT OLD.`shipping_zone_code`
   OR NEW.`shipping_rate_rule_id` IS NOT OLD.`shipping_rate_rule_id`
   OR NEW.`shipping_amount_sen` IS NOT OLD.`shipping_amount_sen`)
BEGIN
  SELECT RAISE(ABORT, 'shipping quote snapshot is immutable');
END;
--> statement-breakpoint
DROP TABLE `pickup_schedules`;
--> statement-breakpoint
DROP TABLE `warehouses`;
--> statement-breakpoint
ALTER TABLE `stores` DROP COLUMN `mengantar_api_key`;
--> statement-breakpoint
ALTER TABLE `stores` DROP COLUMN `autolaris_api_key`;
--> statement-breakpoint
ALTER TABLE `stores` DROP COLUMN `mengantar_base_url`;
--> statement-breakpoint
ALTER TABLE `stores` DROP COLUMN `autolaris_base_url`;
--> statement-breakpoint
ALTER TABLE `stores` DROP COLUMN `meta_pixel_id`;
--> statement-breakpoint
ALTER TABLE `stores` DROP COLUMN `meta_capi_token`;
--> statement-breakpoint
ALTER TABLE `stores` DROP COLUMN `google_ads_conversion_id`;
--> statement-breakpoint
ALTER TABLE `stores` DROP COLUMN `google_ads_conversion_label`;
--> statement-breakpoint
ALTER TABLE `stores` DROP COLUMN `google_tag_manager_id`;
--> statement-breakpoint
ALTER TABLE `stores` DROP COLUMN `payment_fee_bearer`;
--> statement-breakpoint
ALTER TABLE `stores` DROP COLUMN `cod_fee_bearer`;
--> statement-breakpoint
ALTER TABLE `stores` DROP COLUMN `is_autolaris_enabled`;
--> statement-breakpoint
ALTER TABLE `stores` DROP COLUMN `disabled_autolaris_channels`;
--> statement-breakpoint
ALTER TABLE `stores` DROP COLUMN `cod_disabled_province_codes`;
