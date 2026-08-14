"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { queryKeys, useMe } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { ROLE_LABELS } from "@/lib/types";

const SUPERADMIN_LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/table", label: "Groups" },
  { href: "/admin/standings", label: "Tables" },
  { href: "/admin/knockout", label: "Knockout" },
  { href: "/admin/stats", label: "Stats" },
  { href: "/admin/settings", label: "Settings" },
];

// A team admin runs one team. Everything else in the tournament is on the
// public site anyway, so there is nothing here for them to navigate to.
const teamAdminLinks = (departmentId: string | null) => [
  { href: "/admin", label: "Matches" },
  { href: departmentId ? `/admin/teams/${departmentId}` : "/admin/teams", label: "My team" },
  { href: "/admin/settings", label: "Account" },
];

// Login and setup are reached without a session, so they get no nav.
const BARE_PAGES = ["/admin/login", "/admin/setup"];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe({ enabled: !BARE_PAGES.includes(pathname) });

  if (BARE_PAGES.includes(pathname)) return null;

  const links =
    me?.role === "TEAM_ADMIN" ? teamAdminLinks(me.departmentId) : SUPERADMIN_LINKS;

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    // Otherwise the next account to sign in on this browser inherits the
    // previous one's cached role and sees a nav they cannot use.
    queryClient.clear();
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
        {me && (
          <span className="hidden text-[12px] text-white/70 sm:inline">
            {me.username} · {ROLE_LABELS[me.role]}
          </span>
        )}
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
