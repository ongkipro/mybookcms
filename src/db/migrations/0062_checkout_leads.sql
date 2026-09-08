-- Leads are not orders: capture never reserves stock or contributes revenue.
CREATE TABLE checkout_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  capture_token TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  follow_up_status TEXT NOT NULL DEFAULT 'new'
    CHECK (follow_up_status IN ('new', 'contacted', 'qualified', 'not_interested')),
  follow_up_note TEXT NOT NULL DEFAULT '',
  followed_up_by TEXT,
  followed_up_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  converted_at TEXT,
  converted_order_id INTEGER UNIQUE REFERENCES orders(id) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX checkout_leads_pending_idx ON checkout_leads(converted_at, id DESC);
--> statement-breakpoint
-- Every order entry point shares this transaction, including buyer completion,
-- CS conversion, DOKU and headless checkout. A rollback also unlinks the lead.
CREATE TRIGGER checkout_leads_order_insert
AFTER INSERT ON orders
BEGIN
  SELECT RAISE(ABORT, 'LEAD_ALREADY_CONVERTED')
  WHERE EXISTS (SELECT 1 FROM checkout_leads WHERE capture_token = NEW.submit_token AND converted_at IS NOT NULL);
  UPDATE checkout_leads SET converted_order_id = NEW.id, converted_at = NEW.created_at,
    updated_at = NEW.created_at
  WHERE capture_token = NEW.submit_token AND converted_at IS NULL;
END;
