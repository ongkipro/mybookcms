-- The merchant's own pickup address: where a courier collects, or where a buyer
-- returns a parcel. The product has no logistics integration (REQ-180), so this
-- is operator reference data, not a dispatch payload.
--
-- Four columns, not six: `city` and `state` are resolved from
-- `malaysia_postcodes` at read time, so a stored city can never disagree with
-- the postcode it belongs to.
ALTER TABLE `stores` ADD `pickup_name` text;
--> statement-breakpoint
ALTER TABLE `stores` ADD `pickup_phone` text;
--> statement-breakpoint
ALTER TABLE `stores` ADD `pickup_address` text;
--> statement-breakpoint
ALTER TABLE `stores` ADD `pickup_postcode` text
  CHECK (`pickup_postcode` IS NULL OR `pickup_postcode` GLOB '[0-9][0-9][0-9][0-9][0-9]');
