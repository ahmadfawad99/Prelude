"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/inquiries", label: "Leads", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/dashboard", label: "Dashboard", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/clients", label: "Clients", icon: "M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 10a3 3 0 100-6 3 3 0 000 6zM21 20v-2a4 4 0 00-3-3.87" },
  { href: "/rates", label: "Rates", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {NAV.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href + "/") || (n.href === "/inquiries" && pathname === "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
