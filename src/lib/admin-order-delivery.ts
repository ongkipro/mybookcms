import type { AdminRole } from "./auth.ts";
import { resolveMalaysiaLocation } from "./malaysia-locations.ts";
import { quoteMalaysiaOrderShippingFromD1 } from "./malaysia-shipping.ts";

/** The goods have left, so the amount is a record rather than a pending price. */
const SETTLED_SHIPPING_STATUSES = ["shipped", "delivered"] as const;
/** The money has been taken, by the same argument. */
const SETTLED_PAYMENT_STATUSES = ["paid", "settled", "success"] as const;

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
  /**
   * True when a destination change was supplied for an order whose money is
   * already settled, by a role that may not reprice one.
   */
  destinationChangeRefused: boolean;
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
 * Two things are guarded, and the second was missed on the first attempt.
 *
 * The *direct amount* is owner/admin only. A destination change still re-quotes
 * from D1 while the order is open, because correcting a wrong address is the
 * work customer service exists to do and the price of the real destination is
 * not the operator's to choose.
 *
 * But that reasoning stops at dispatch. Once the goods have shipped or the
 * payment is verified, the amount is settled rather than pending, and
 * re-quoting rewrites a number the books already recorded: an operator could
 * collect a Sabah COD total, then move the order to a peninsular postcode and
 * watch `total_amount` fall by the difference, with analytics reporting the
 * lower figure as revenue. So on a settled order a destination change is
 * refused for the roles that may not set an amount directly. The free-text
 * `address` correction stays open always — fixing a typo in a street name is
 * not a price change.
 *
 * What remains, and is deliberately not blocked, is choosing a cheaper zone on
 * an order that is still open. That is fraud by data entry rather than an
 * authorization bypass: any role that may correct a destination can do it, and
 * blocking it would remove the job. The answer there is an actor-attributed
 * audit record, A-226.
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

  // Read the order's own state rather than trusting the caller for it: whether
  // the money is settled is not something a request body should assert.
  const settled = maySetAmount || input.locationId === undefined
    ? null
    : await database
        .prepare(
          `SELECT shipping_status, payment_status FROM orders WHERE id = ? LIMIT 1`,
        )
        .bind(input.orderId)
        .first<{ shipping_status: string; payment_status: string }>();
  const destinationChangeRefused = Boolean(
    settled &&
      (SETTLED_SHIPPING_STATUSES.includes(settled.shipping_status as never) ||
        SETTLED_PAYMENT_STATUSES.includes(settled.payment_status as never)),
  );

  if (input.address !== undefined) add("address", input.address);

  let resolvedCost = shippingCostRefused ? undefined : input.shippingCostSen;
  if (input.locationId !== undefined && !destinationChangeRefused) {
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

  return { assignments, values, shippingCostRefused, destinationChangeRefused };
}
