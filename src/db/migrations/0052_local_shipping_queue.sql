-- Local manual-fulfilment queue. This timestamp records the operator decision
-- to move an order from Order Management into Pengiriman; it is deliberately
-- independent from shipping_status and never represents an external dispatch.

ALTER TABLE `orders` ADD COLUMN `shipping_queued_at` text;
--> statement-breakpoint
CREATE INDEX `idx_orders_shipping_queue_created`
  ON `orders` (`shipping_queued_at`, `created_at`);
