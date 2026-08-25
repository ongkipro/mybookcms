-- Restore only the advertising configuration removed during the Malaysia cutover.
-- Provider payment/logistics columns intentionally stay removed.
ALTER TABLE `stores` ADD `meta_pixel_id` text;
--> statement-breakpoint
ALTER TABLE `stores` ADD `meta_capi_token` text;
--> statement-breakpoint
ALTER TABLE `stores` ADD `google_tag_manager_id` text;
--> statement-breakpoint
ALTER TABLE `stores` ADD `google_ads_conversion_id` text;
--> statement-breakpoint
ALTER TABLE `stores` ADD `google_ads_conversion_label` text;
--> statement-breakpoint

CREATE TABLE `capi_event_outbox` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `event_name` text NOT NULL,
  `event_id` text NOT NULL,
  `payload_json` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL CHECK (`status` IN ('pending', 'delivered', 'failed')),
  `attempts` integer DEFAULT 0 NOT NULL,
  `next_retry_at` text,
  `last_error` text,
  `delivered_at` text,
  `created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  `updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `capi_event_outbox_event_unique`
  ON `capi_event_outbox` (`event_name`, `event_id`);
--> statement-breakpoint
CREATE INDEX `capi_event_outbox_due_idx`
  ON `capi_event_outbox` (`status`, `next_retry_at`);
