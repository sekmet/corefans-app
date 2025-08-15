import { useMemo } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Home,
  Bell,
  MessageSquare,
  Radio,
  Bookmark,
  List,
  Wallet,
  User,
  Settings as SettingsIcon,
  ShoppingCart,
  RadioTower,
} from "lucide-react";

const NAV_ITEMS = [
  { title: "Home", icon: Home, href: "/feed" },
  { title: "Notifications", icon: Bell, href: "#" },
  { title: "Messages", icon: MessageSquare, href: "#" },
  { title: "Streams", icon: Radio, href: "/streams" },
  { title: "Bookmarks", icon: Bookmark, href: "#" },
  { title: "Lists", icon: List, href: "#" },
  { title: "Subscriptions", icon: Wallet, href: "/subscriptions/history" },
  { title: "Marketplace", icon: ShoppingCart, href: "/marketplace" },
  { title: "Profile", icon: User, href: "/profile" },
  { title: "Settings", icon: SettingsIcon, href: "/settings" },
] as const;

function useUserDisplay() {
  const { data: session } = authClient.useSession();
  const user = session?.user ?? ({} as any);

  const display = useMemo(() => {
    const name: string | undefined = user.name ?? user.email?.split("@")[0];
    const username: string | undefined =
      user.username ||
      (name ? name.toString().trim().toLowerCase().replace(/\s+/g, "") : undefined) ||
      user.id;
    const handle = username ? `@${username}` : "@user";
    const avatarUrl: string | undefined = user.image || user.avatarUrl;

    return { name: name || "User", handle, avatarUrl };
  }, [user]);

  return display;
}

export default function ProtectedDashboardLayout() {
  const location = useLocation();
  const { name, handle, avatarUrl } = useUserDisplay();

  return (
    <div className="h-screen">
      <SidebarProvider>
      <Sidebar collapsible="offcanvas" variant="inset">
        <SidebarHeader>
          {/* User block at the very top (tap target >=44px) */}
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-sidebar-accent"
          >
            <Avatar className="size-11">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={name} />
              ) : null}
              {/* Gradient avatar style matching the reference */}
              <AvatarFallback className="bg-gradient-to-br from-pink-500 to-orange-400" />
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium lowercase">{name}</div>
              <div className="truncate text-xs text-muted-foreground">{handle}</div>
            </div>
          </Link>

          <SidebarMenu className="mt-1">
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/feed" className="font-semibold">
                  <span className="text-base">CoreFans</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <nav className="px-2">
            <ul className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.href !== "#" &&
                      (location.pathname === item.href || location.pathname.startsWith(item.href + "/"))
                    }
                  >
                    <Link
                      to={item.href}
                      className={cn(
                        "flex items-center gap-2",
                        item.href !== "#" &&
                          (location.pathname === item.href || location.pathname.startsWith(item.href + "/")) &&
                          "text-gradient-primary font-medium"
                      )}
                    >
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </ul>
          </nav>
        </SidebarContent>
        {/* Featured Go Live button fixed at the bottom */}
        <SidebarFooter className="mt-auto">
          <div className="px-2 pb-2">
            <Button
              asChild
              className="w-full h-11 text-base font-semibold bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white shadow-lg shadow-pink-500/20"
            >
              <Link to="/streams/go-live" aria-label="Go Live">
                <RadioTower className="mr-2 h-4 w-4" />
                Go Live
              </Link>
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="h-full overflow-hidden">
        <header
          className={cn(
            "sticky top-0 z-10 border-b bg-background/80 backdrop-blur",
            "flex items-center justify-between gap-3 px-3 py-2 md:px-4 md:hidden"
          )}
        >
          <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" />
          </div>
        </header>

        <div className="flex flex-1 flex-col min-h-0">
          <div className="p-2 flex-1 overflow-hidden">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
