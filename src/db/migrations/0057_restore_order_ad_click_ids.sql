-- Migration 0049 rebuilt orders for the Malaysia cutover but omitted the
-- persisted advertising attribution column still consumed by checkout and the
-- public Meta event endpoint. Restore it without rewriting existing orders.
ALTER TABLE `orders` ADD `ad_click_ids` text;
