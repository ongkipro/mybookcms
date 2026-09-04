import type { AdminRole } from "./auth.ts";
import { resolveMalaysiaLocation } from "./malaysia-locations.ts";
import { quoteMalaysiaOrderShippingFromD1 } from "./malaysia-shipping.ts";

export type AdminOrderDeliveryInput = {
  orderId: number;
  address?: string;
  locationId?: number;
  shippingCostSen?: number;
  /**
   * The operator making the change. Required, and not optional-with-a-default,
   * because a caller that forgets it should fail to compile rather than fall
   * into the permissive branch.
   */
  role: AdminRole | undefined;
};

export type AdminOrderDeliveryPatch = {
  assignments: string[];
  values: unknown[];
  /** True when a direct amount was supplied by a role that may not set one. */
  shippingCostRefused: boolean;
};

/**
 * Resolves trusted Malaysia destination fields and a consistent MYR total.
 *
 * The role check lives here rather than at the call sites, and that is the whole
 * point of the placement. Guarding `PATCH /api/admin/orders/[id]` alone left the
 * identical write reachable through `PATCH /api/admin/shipping`, a route
 * customer service also holds, in two clicks of its own UI — an independent
 * review found it. Any third route that imports this helper inherits the rule
 * instead of having to remember it.
 *
 * What is guarded is the *direct amount*. A destination change still re-quotes
 * from D1, because correcting a wrong address is the work customer service
 * exists to do and the price of the real destination is not the operator's to
 * choose. That is not a complete answer: an operator who picks a cheaper zone
 * changes the collected total by proxy, which is fraud by data entry rather
 * than an authorization bypass, and the answer to it is an actor-attributed
 * audit record — A-226 — not a block that would break the job.
 */
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

  const maySetAmount = input.role === "owner" || input.role === "admin";
  const shippingCostRefused =
    input.shippingCostSen !== undefined && !maySetAmount;

  if (input.address !== undefined) add("address", input.address);

  let resolvedCost = shippingCostRefused ? undefined : input.shippingCostSen;
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

  return { assignments, values, shippingCostRefused };
}
