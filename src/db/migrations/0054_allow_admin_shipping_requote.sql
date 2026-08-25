-- Accepted checkout quotes stay stable until an authenticated operator
-- explicitly edits the Malaysia destination or shipping cost.
DROP TRIGGER IF EXISTS `orders_shipping_quote_snapshot_immutable`;
