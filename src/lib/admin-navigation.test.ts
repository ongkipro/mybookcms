import assert from "node:assert/strict";
import test from "node:test";
import {
  getSearchableNavItems,
  getVisibleNavGroups,
  isAdminNavHrefActive,
} from "../components/admin/admin-navigation.ts";
import { ADMIN_ROLES, canAccessAdminRoute } from "./auth.ts";

test("visible admin navigation never exposes a route denied to its role", () => {
  for (const role of ADMIN_ROLES) {
    const links = getSearchableNavItems(role).map((item) => item.href);
    for (const href of links) {
      assert.equal(
        canAccessAdminRoute(role, new URL(href, "https://admin.local").pathname),
        true,
        `${role} cannot access visible link ${href}`,
      );
    }
  }
});

test("scoped roles see their complete workspace without privileged settings", () => {
  const advertiserItems = getVisibleNavGroups("advertiser").flatMap(
    (group) => group.items,
  );
  assert.deepEqual(
    advertiserItems.map((item) => item.id),
    // "content" is deliberately absent: the storefront content editor is
    // reachable at /admin/content and left out of the menu, entered from
    // Pengaturan -> Toko & CS instead. ADR-025 records why.
    ["dashboard", "products", "ads"],
  );
  assert.equal(
    advertiserItems
      .find((item) => item.id === "products")
      ?.children?.some((child) => child.href === "/admin/landing-pages"),
    true,
  );

  const adminSettings = getVisibleNavGroups("admin")
    .flatMap((group) => group.items)
    .find((item) => item.id === "settings");
  assert.equal(
    adminSettings?.children?.some(
      (child) => child.href === "/admin/settings/access",
    ),
    false,
  );
});

test("navigation active matching keeps required query filters and accepts pagination", () => {
  assert.equal(
    isAdminNavHrefActive(
      "/admin/orders?status=processing&page=2",
      "/admin/orders?status=processing",
    ),
    true,
  );
  assert.equal(
    isAdminNavHrefActive(
      "/admin/orders?status=paid",
      "/admin/orders?status=processing",
    ),
    false,
  );
  assert.equal(
    isAdminNavHrefActive("/admin/landing-pages/12/edit", "/admin/landing-pages"),
    false,
  );
});

test("payments navigation names DOKU Malaysia only for privileged roles", () => {
  for (const role of ["owner", "admin"] as const) {
    const payments = getVisibleNavGroups(role)
      .flatMap((group) => group.items)
      .find((item) => item.id === "payments");
    assert.match(payments?.description ?? "", /DOKU Malaysia/);
    assert.match(payments?.keywords ?? "", /doku fpx ewallet/);
  }
  for (const role of ["advertiser", "customer_service"] as const) {
    assert.equal(
      getVisibleNavGroups(role).flatMap((group) => group.items).some((item) => item.id === "payments"),
      false,
    );
  }
});
