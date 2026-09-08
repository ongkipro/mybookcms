-- Privileged mutation audits commit with their mutation; scheduler failures are
-- best-effort diagnostics. Neither accepts request/provider payloads.
CREATE TABLE `system_events` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `actor` text NOT NULL CHECK (length(`actor`) BETWEEN 3 AND 64 AND `actor` NOT GLOB '*[^a-z0-9._-]*'),
  `source` text NOT NULL CHECK (`source` IN ('admin', 'scheduler', 'auth')),
  `action` text NOT NULL CHECK (length(`action`) BETWEEN 1 AND 64),
  `label` text NOT NULL CHECK (length(`label`) BETWEEN 1 AND 160),
  `severity` text NOT NULL CHECK (`severity` IN ('info', 'warning', 'error')),
  `correlation` text NOT NULL CHECK (length(`correlation`) BETWEEN 1 AND 80 AND `correlation` NOT GLOB '*[^a-z0-9:_-]*'),
  `detail` text DEFAULT '{}' NOT NULL CHECK (`detail` = '{}'),
  `occurred_at` text NOT NULL CHECK (`occurred_at` GLOB '????-??-??T??:??:??.???Z')
);
--> statement-breakpoint
CREATE INDEX `system_events_occurred_idx` ON `system_events` (`occurred_at`, `id`);
--> statement-breakpoint
CREATE TRIGGER `system_events_no_update`
BEFORE UPDATE ON `system_events`
BEGIN
  SELECT RAISE(ABORT, 'system events are append-only');
END;
