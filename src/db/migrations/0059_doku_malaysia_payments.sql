-- D1 owns the complete local DOKU payment lifecycle. Provider configuration
-- stores encrypted credentials only; attempts retain the minimum resumable
-- provider facts; events are an append-only deduplication/audit record.

CREATE TABLE `payment_provider_configs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `store_id` integer NOT NULL,
  `provider` text DEFAULT 'doku' NOT NULL
    CHECK (`provider` = 'doku'),
  `environment` text DEFAULT 'sandbox' NOT NULL
    CHECK (`environment` IN ('sandbox', 'production')),
  `client_id` text,
  `api_key_ciphertext` text,
  `secret_key_ciphertext` text,
  `enabled_channels_json` text DEFAULT '[]' NOT NULL
    CHECK (json_valid(`enabled_channels_json`) AND json_type(`enabled_channels_json`) = 'array'),
  `is_enabled` integer DEFAULT 0 NOT NULL
    CHECK (`is_enabled` IN (0, 1)),
  `config_revision` integer DEFAULT 1 NOT NULL
    CHECK (typeof(`config_revision`) = 'integer' AND `config_revision` > 0),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_provider_configs_store_provider_unique`
  ON `payment_provider_configs` (`store_id`, `provider`);
--> statement-breakpoint

CREATE TABLE `payment_attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` integer NOT NULL,
  `provider_config_id` integer NOT NULL,
  `provider` text DEFAULT 'doku' NOT NULL
    CHECK (`provider` = 'doku'),
  `environment` text NOT NULL
    CHECK (`environment` IN ('sandbox', 'production')),
  `config_revision` integer NOT NULL
    CHECK (typeof(`config_revision`) = 'integer' AND `config_revision` > 0),
  `merchant_invoice` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `request_fingerprint` text NOT NULL,
  `provider_reference` text,
  `amount_sen` integer NOT NULL
    CHECK (typeof(`amount_sen`) = 'integer' AND `amount_sen` >= 0),
  `currency` text DEFAULT 'MYR' NOT NULL
    CHECK (`currency` = 'MYR'),
  `checkout_url` text,
  `expires_at` text,
  `channel` text,
  `provider_status` text,
  `provider_state` text,
  `local_status` text DEFAULT 'created' NOT NULL
    CHECK (`local_status` IN ('created', 'pending', 'paid', 'failed', 'expired', 'attention_required')),
  `error_class` text
    CHECK (`error_class` IS NULL OR `error_class` IN ('configuration', 'authentication', 'signature', 'timeout', 'provider', 'local_transition')),
  `lease_token` text,
  `lease_until` text,
  `next_reconcile_at` text,
  `reconcile_attempts` integer DEFAULT 0 NOT NULL
    CHECK (typeof(`reconcile_attempts`) = 'integer' AND `reconcile_attempts` >= 0),
  `initiated_at` text,
  `paid_at` text,
  `terminal_at` text,
  `stock_released_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CHECK (`paid_at` IS NULL OR `local_status` = 'paid'),
  CHECK (`stock_released_at` IS NULL OR `local_status` IN ('failed', 'expired')),
  CHECK ((`local_status` IN ('paid', 'failed', 'expired')) = (`terminal_at` IS NOT NULL)),
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`provider_config_id`) REFERENCES `payment_provider_configs`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_attempts_provider_invoice_unique`
  ON `payment_attempts` (`provider`, `merchant_invoice`);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_attempts_provider_idempotency_unique`
  ON `payment_attempts` (`provider`, `idempotency_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_attempts_provider_reference_unique`
  ON `payment_attempts` (`provider`, `provider_reference`)
  WHERE `provider_reference` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `payment_attempts_order_created_idx`
  ON `payment_attempts` (`order_id`, `created_at` DESC);
--> statement-breakpoint
CREATE INDEX `payment_attempts_reconcile_due_idx`
  ON `payment_attempts` (`local_status`, `next_reconcile_at`, `lease_until`);
--> statement-breakpoint

CREATE TRIGGER `payment_attempts_terminal_status_immutable`
BEFORE UPDATE OF `local_status` ON `payment_attempts`
WHEN OLD.`local_status` IN ('paid', 'failed', 'expired')
 AND NEW.`local_status` IS NOT OLD.`local_status`
BEGIN
  SELECT RAISE(ABORT, 'terminal payment status is immutable');
END;
--> statement-breakpoint

CREATE TABLE `payment_events` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `payment_attempt_id` text NOT NULL,
  `source` text NOT NULL
    CHECK (`source` IN ('checkout', 'return', 'notification', 'status', 'reconciliation', 'retry')),
  `event_key` text NOT NULL,
  `provider_status` text,
  `provider_state` text,
  `resulting_status` text NOT NULL
    CHECK (`resulting_status` IN ('created', 'pending', 'paid', 'failed', 'expired', 'attention_required')),
  `received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`payment_attempt_id`) REFERENCES `payment_attempts`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_events_attempt_source_key_unique`
  ON `payment_events` (`payment_attempt_id`, `source`, `event_key`);
--> statement-breakpoint
CREATE INDEX `payment_events_attempt_received_idx`
  ON `payment_events` (`payment_attempt_id`, `received_at`, `id`);
--> statement-breakpoint

CREATE TRIGGER `payment_events_append_only_update`
BEFORE UPDATE ON `payment_events`
BEGIN
  SELECT RAISE(ABORT, 'payment events are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `payment_events_append_only_delete`
BEFORE DELETE ON `payment_events`
BEGIN
  SELECT RAISE(ABORT, 'payment events are append-only');
END;
