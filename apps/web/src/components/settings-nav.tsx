"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/repositories", label: "Repositories" },
  { href: "/settings/company", label: "Company & Team" },
  { href: "/settings/work-cards", label: "Work cards" },
  { href: "/settings/hierarchy", label: "Hierarchy" },
  { href: "/settings/branding", label: "Branding" },
];

/** Left sub-navigation for the Settings section. */
export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b pb-px sm:w-48 sm:flex-col sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-secondary font-medium text-secondary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
