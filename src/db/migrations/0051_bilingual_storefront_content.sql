-- Keep the existing Malay columns as the backward-compatible content record.
-- English is an optional sibling translation; storefront reads resolve the
-- requested locale first, then the merchant-selected stores.locale fallback.
ALTER TABLE `storefront_content` ADD COLUMN `draft_json_en` text;
--> statement-breakpoint
ALTER TABLE `storefront_content` ADD COLUMN `published_json_en` text;
--> statement-breakpoint
ALTER TABLE `storefront_content` ADD COLUMN `published_at_en` text;
