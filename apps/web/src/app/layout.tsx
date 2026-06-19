import type { ReactNode } from "react";
import { Toaster } from "sonner";

import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { listSidebarOrgs } from "@/lib/workspace-access";

import "./globals.css";

export const metadata = {
  title: "SpecBoard",
  description: "Spec-based product management over git-native specs.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const orgs = await listSidebarOrgs();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <div className="flex min-h-screen">
            <AppSidebar orgs={orgs} />
            <main className="min-w-0 flex-1">
              <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
            </main>
          </div>
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
