"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import {
  LayoutDashboard,
  CalendarDays,
  Upload,
  Users,
  BarChart2,
  Settings,
  Palette,
  QrCode,
  Shield,
  LogOut,
  Camera,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["PHOTOGRAPHER", "ADMIN", "SUPER_ADMIN", "STAFF"],
  },
  {
    href: "/dashboard/events",
    label: "Events",
    icon: CalendarDays,
    roles: ["PHOTOGRAPHER", "ADMIN", "SUPER_ADMIN", "STAFF"],
  },
  {
    href: "/dashboard/upload",
    label: "Upload",
    icon: Upload,
    roles: ["PHOTOGRAPHER", "ADMIN", "SUPER_ADMIN", "STAFF"],
  },
  {
    href: "/dashboard/guests",
    label: "Guests",
    icon: Users,
    roles: ["PHOTOGRAPHER", "ADMIN", "SUPER_ADMIN"],
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: BarChart2,
    roles: ["PHOTOGRAPHER", "ADMIN", "SUPER_ADMIN"],
  },
  {
    href: "/dashboard/qr",
    label: "QR Codes",
    icon: QrCode,
    roles: ["PHOTOGRAPHER", "ADMIN", "SUPER_ADMIN"],
  },
  {
    href: "/dashboard/branding",
    label: "Branding",
    icon: Palette,
    roles: ["PHOTOGRAPHER", "ADMIN", "SUPER_ADMIN"],
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    roles: ["PHOTOGRAPHER", "ADMIN", "SUPER_ADMIN", "STAFF"],
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Shield,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const filtered = navItems.filter(
    (item) => user?.role && item.roles.includes(user.role),
  );

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-card border-r transition-all duration-300",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-5 border-b",
          collapsed && "justify-center px-0",
        )}
      >
        <Camera className="h-7 w-7 text-primary flex-shrink-0" />
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight">Medo.dev</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {filtered.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className={cn("border-t p-3", collapsed && "flex justify-center")}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <Avatar src={user?.avatarUrl} name={user?.name ?? ""} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.role}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logout()}
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-20 bg-card border rounded-full p-1 shadow-sm hover:bg-accent"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  );
}
