import { resolveMalaysiaLocation } from "./malaysia-locations.ts";
import { quoteMalaysiaOrderShippingFromD1 } from "./malaysia-shipping.ts";

export type AdminOrderDeliveryInput = {
  orderId: number;
  address?: string;
  locationId?: number;
  shippingCostSen?: number;
};

export type AdminOrderDeliveryPatch = {
  assignments: string[];
  values: unknown[];
};

/** Resolves trusted Malaysia destination fields and a consistent MYR total update. */
export async function resolveAdminOrderDeliveryPatch(
  database: D1Database,
  input: AdminOrderDeliveryInput,
): Promise<AdminOrderDeliveryPatch> {
  const assignments: string[] = [];
  const values: unknown[] = [];
  const add = (column: string, value: unknown) => {
    assignments.push(`${column} = ?`);
    values.push(value);
  };

  if (input.address !== undefined) add("address", input.address);

  let resolvedCost = input.shippingCostSen;
  if (input.locationId !== undefined) {
    const location = await resolveMalaysiaLocation(database, input.locationId);
    const quote = await quoteMalaysiaOrderShippingFromD1(database, {
      orderId: input.orderId,
      postcode: location.postcode,
    });
    add("district", location.city);
    add("city", location.city);
    add("province", location.state);
    add("postal_code", location.postcode);
    add("shipping_zone_code", quote.zoneCode);
    add("shipping_rate_rule_id", quote.rateRuleId);
    resolvedCost ??= quote.amountSen;
  }

  if (resolvedCost !== undefined) {
    add("shipping_amount_sen", resolvedCost);
    add("shipping_cost", resolvedCost);
    assignments.push(`total_amount = MAX(0, COALESCE((
      SELECT SUM(oi.quantity * oi.unit_price) FROM order_items oi WHERE oi.order_id = orders.id
    ), 0) + ? - COALESCE(discount_amount, 0))`);
    values.push(resolvedCost);
  }

  return { assignments, values };
}
