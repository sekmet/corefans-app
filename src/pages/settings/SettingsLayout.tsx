import React from "react";
import Seo from "@/components/Seo";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { User, Lock, Bell, CreditCard, Shield, Wallet, Users, List, BadgeCheck, DollarSign, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const SECTIONS = [
  { to: "profile", label: "Profile", icon: User },
  { to: "account", label: "Account", icon: Lock },
  { to: "notifications", label: "Notifications", icon: Bell },
  { to: "payments", label: "Payments", icon: CreditCard },
  { to: "privacy", label: "Privacy", icon: Shield },
  { to: "wallet", label: "Wallet", icon: Wallet },
  { to: "creator", label: "Creator", icon: Sparkles },
  { to: "referrals", label: "Referrals", icon: Users },
  { to: "subscriptions", label: "Subscriptions", icon: List },
  { to: "verification", label: "Verification", icon: BadgeCheck },
  { to: "rates", label: "Rates", icon: DollarSign },
] as const;

export default function SettingsLayout() {
  const location = useLocation();
  const currentUrl = typeof window !== "undefined" ? window.location.href : undefined;
  return (
    <div className="mx-auto max-w-6xl h-full min-h-0 grid grid-cols-1 gap-4 overflow-hidden md:grid-cols-[220px_1fr]">
      <Seo title="Settings • CoreFans" description="Manage your CoreFans account settings" canonical={currentUrl} />

      {/* Mobile: Hamburger to open sections */}
      <div className="md:hidden px-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="mb-2 inline-flex items-center gap-2">
              <List className="size-4" /> Sections
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[88%] sm:max-w-sm">
            <SheetHeader className="px-4 pt-4 pb-2 text-left">
              <SheetTitle>Settings</SheetTitle>
              <p className="text-sm text-muted-foreground">Manage your account</p>
            </SheetHeader>
            <nav aria-label="Settings sections" className="px-2 pb-4">
              <ul className="flex flex-col gap-1">
                {SECTIONS.map((s) => (
                  <li key={s.to}>
                    <NavLink
                      to={s.to}
                      className={({ isActive }) =>
                        cn(
                          "block rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted",
                          isActive && "bg-muted font-medium"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <span className={cn("inline-flex items-center gap-2", isActive && "text-indigo-600 font-semibold")}>
                          <s.icon className="size-4" /> {s.label}
                        </span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: sticky aside */}
      <aside className="hidden md:block sticky top-2 md:top-4 self-start md:h-[calc(100vh-6rem)] overflow-y-auto">
        <div className="px-3 py-2 md:px-0">
          <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
          <p className="text-sm text-muted-foreground">Manage your account</p>
        </div>
        <nav aria-label="Settings sections" className="px-2 md:px-0">
          <ul className="flex md:flex-col gap-2 md:gap-1 overflow-auto">
            {SECTIONS.map((s) => (
              <li key={s.to}>
                <NavLink
                  to={s.to}
                  className={({ isActive }) =>
                    cn(
                      "block rounded-md px-1 py-2 text-sm transition-colors hover:bg-muted",
                      isActive && "bg-muted font-medium"
                    )
                  }
                >
                  {({ isActive }) => (
                    <span className={cn("inline-flex items-center gap-2", isActive && "text-indigo-600 font-semibold")}> 
                      <s.icon className="size-4" /> {s.label}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main className="min-h-0 overflow-y-auto pr-1">
        <div className="space-y-6 p-3 sm:p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
