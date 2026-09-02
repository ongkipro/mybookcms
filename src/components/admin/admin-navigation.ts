import type { LucideIcon } from "lucide-react";
import type { AdminRole } from "../../lib/auth";
export type { AdminRole } from "../../lib/auth";
import {
  Boxes,
  CircleUserRound,
  CodeXml,
  CreditCard,
  FilePenLine,
  LayoutDashboard,
  Megaphone,
  Package,
  Settings,
  ShoppingBag,
  Truck,
} from "lucide-react";


/** Stable MyBookCMS visual identity. Storefront tenant theming must not alter admin UI. */
export const ADMIN_ACCENT = "#2563eb";

export type AdminNavItem = {
  id: string;
  href: string;
  label: string;
  shortLabel?: string;
  description: string;
  icon: LucideIcon;
  keywords: string;
  children?: Array<{ href: string; label: string; icon?: LucideIcon }>;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export const adminNavGroups: AdminNavGroup[] = [
  {
    label: "Perdagangan",
    items: [
      {
        id: "dashboard",
        href: "/admin/dashboard",
        label: "Dashboard",
        description: "Snapshot performa toko",
        icon: LayoutDashboard,
        keywords: "dashboard ringkasan omzet performa",
      },
      {
        id: "orders",
        href: "/admin/orders",
        label: "Manajemen Pesanan",
        shortLabel: "Pesanan",
        description: "Validasi dan proses pesanan",
        icon: ShoppingBag,
        keywords: "orders pesanan transaksi pelanggan",
      },
      {
        id: "shipping",
        href: "/admin/shipping",
        label: "Pengiriman",
        description: "Antrean, alamat, ongkir, dan status",
        icon: Truck,
        keywords: "shipping pengiriman antrean status ongkir",
      },
      {
        id: "products",
        href: "/admin/products",
        label: "Katalog",
        description: "Produk, varian, dan landing page",
        icon: Package,
        keywords: "products produk katalog varian stock landing pages",
        children: [
          { href: "/admin/landing-pages", label: "Landing Page", icon: FilePenLine },
        ],
      },
    ],
  },
  {
    label: "Operasional",
    items: [
      {
        id: "expeditions",
        href: "/admin/expeditions",
        label: "Tarif Malaysia",
        description: "Zona, poskod, dan weight band",
        icon: Boxes,
        keywords: "malaysia shipping poskod postcode zone rate tarif sabah sarawak labuan",
      },
    ],
  },
  {
    label: "Pertumbuhan",
    items: [
      {
        id: "ads",
        href: "/admin/ads",
        label: "Ads & Tracking",
        description: "Sinyal dan atribusi",
        icon: Megaphone,
        keywords: "ads meta pixel capi google gtm tracking conversion",
        children: [
          { href: "/admin/ads/meta", label: "Meta Pixel & CAPI" },
          { href: "/admin/ads/google", label: "Google Ads" },
        ],
      },
    ],
  },
  {
    label: "Keuangan & Sistem",
    items: [
      {
        id: "payments",
        href: "/admin/payments",
        label: "Pembayaran",
        shortLabel: "Pembayaran",
        description: "COD, transfer manual, dan DOKU Malaysia",
        icon: CreditCard,
        keywords: "payments cod transfer bank manual rekening doku fpx ewallet",
      },
      {
        id: "settings",
        href: "/admin/settings",
        label: "Pengaturan",
        description: "Store, CRM, developer, dan akses",
        icon: Settings,
        keywords: "settings system store crm access headless developer api",
        children: [
          { href: "/admin/settings/store", label: "Toko & CS", icon: ShoppingBag },
          { href: "/admin/settings/developer", label: "Headless API", icon: CodeXml },
          { href: "/admin/settings/crm", label: "Template CRM", icon: FilePenLine },
          { href: "/admin/settings/access", label: "Akses Pengguna", icon: CircleUserRound },
        ],
      },
    ],
  },
];

export const profileNavItem: AdminNavItem = {
  id: "profile",
  href: "/admin/profile",
  label: "Profil",
  shortLabel: "Profil",
  description: "Akun dan keamanan",
  icon: CircleUserRound,
  keywords: "profile akun password keamanan",
};

export function isAdminNavHrefActive(currentPath: string, href: string) {
  const base = "https://admin.local";
  const current = new URL(currentPath, base);
  const target = new URL(href, base);
  if (current.pathname !== target.pathname) return false;
  for (const [key, value] of target.searchParams) {
    if (current.searchParams.get(key) !== value) return false;
  }
  return true;
}

export function getVisibleNavGroups(role: AdminRole) {
  if (role === "owner") return adminNavGroups;
  const visibleIds = role === "admin"
    ? new Set(adminNavGroups.flatMap((group) => group.items.map((item) => item.id)))
    : role === "advertiser"
      // "content" was here too, but no group defines that id any more - the page is
      // deliberately off the menu and reached from Pengaturan > Toko.
      ? new Set(["dashboard", "products", "ads"])
      : new Set(["dashboard", "orders", "shipping"]);
  return adminNavGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => visibleIds.has(item.id))
        .map((item) => role === "admin" && item.id === "settings"
          ? {
              ...item,
              children: item.children?.filter(
                (child) => child.href !== "/admin/settings/access",
              ),
            }
          : item),
    }))
    .filter((group) => group.items.length > 0);
}

export function getSearchableNavItems(role: AdminRole) {
  const groups = getVisibleNavGroups(role);
  return [
    ...groups.flatMap((group) =>
      group.items.flatMap((item) => [
        { ...item, group: group.label },
        ...(item.children ?? []).map((child) => ({
          ...item,
          href: child.href,
          label: child.label,
          description: item.label,
          icon: child.icon ?? item.icon,
          group: group.label,
        })),
      ]),
    ),
    { ...profileNavItem, group: "Account" },
  ];
}
