"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/board", label: "Board" },
  { href: "/backlog", label: "Backlog" },
];

/**
 * View switcher for the Work → Board space. Board (kanban) and Backlog (table)
 * are two views of the same features, consolidated under one nav entry; this
 * toggle moves between them.
 */
export function WorkViewTabs() {
  const pathname = usePathname();
  return (
    <div className="inline-flex items-center rounded-md border bg-background p-0.5 text-sm">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded px-3 py-1 font-medium transition-colors",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
