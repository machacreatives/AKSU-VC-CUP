"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/table", label: "Groups" },
  { href: "/admin/stats", label: "Stats" },
  { href: "/admin/settings", label: "Settings" },
];

// Login and setup are reached without a session, so they get no nav.
const BARE_PAGES = ["/admin/login", "/admin/setup"];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  if (BARE_PAGES.includes(pathname)) return null;

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 lg:px-6 lg:py-3">
      <nav className="scroll-x flex gap-1.5">
        {links.map((link) => {
          // "/admin" would otherwise light up on every admin page.
          const active =
            link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13.5px] font-bold uppercase tracking-wide transition-colors ${
                active
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-surface text-white hover:bg-surface2"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="rounded-full border border-line px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-surface2"
        >
          View site
        </Link>
        <button
          onClick={logout}
          className="rounded-full border border-line px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-surface2"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
