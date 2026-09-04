-- Index the columns the operator system log filters and orders on.
--
-- `GET /api/admin/system-log` issues one read per source, each filtering and
-- ordering on a timestamp. Measured with EXPLAIN QUERY PLAN against a clean
-- chain, three of the four could not use an index:
--
--   capi_event_outbox          SCAN + USE TEMP B-TREE FOR ORDER BY
--   notifications              SCAN + USE TEMP B-TREE FOR ORDER BY
--   payment_events             SCAN of an index leading with payment_attempt_id,
--                              plus a temp B-tree to order
--   headless_api_audit_events  SEARCH USING INDEX (created_at>?) — already right
--
-- It costs nothing on a small store and bites exactly when the panel matters
-- most: `notifications` grows one row per order and `payment_events` several per
-- DOKU attempt, and neither is pruned, so an owner opening the panel during an
-- incident on a busy store paid three full scans.
--
-- Each index leads with the timestamp the query filters on and carries `id` as
-- the tiebreaker the ORDER BY also names, so the sort is satisfied by the index
-- rather than by a temporary B-tree. Existing indexes are left alone: the ones
-- on payment_events and capi_event_outbox serve different queries that still
-- need them.

CREATE INDEX IF NOT EXISTS `capi_event_outbox_updated_idx`
  ON `capi_event_outbox` (`updated_at` DESC, `id` DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notifications_created_idx`
  ON `notifications` (`created_at` DESC, `id` DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `payment_events_received_idx`
  ON `payment_events` (`received_at` DESC, `id` DESC);
