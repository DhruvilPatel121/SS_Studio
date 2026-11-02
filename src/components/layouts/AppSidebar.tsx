import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Calendar,
  Upload,
  QrCode,
  BarChart3,
  Palette,
  Settings,
  Users,
  Bell,
  Camera,
  ChevronLeft,
  ChevronRight,
  Shield,
  LogOut,
} from "lucide-react";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles?: string[];
  badge?: string;
  exact?: boolean;
}

const photographerItems: NavItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  { label: "Events", path: "/dashboard/events", icon: Calendar },
  { label: "Upload Photos", path: "/dashboard/upload", icon: Upload },
  { label: "QR Codes", path: "/dashboard/qr", icon: QrCode },
  { label: "Analytics", path: "/dashboard/analytics", icon: BarChart3 },
  { label: "Branding", path: "/dashboard/branding", icon: Palette },
  { label: "Team", path: "/dashboard/team", icon: Users },
  { label: "Notifications", path: "/dashboard/notifications", icon: Bell },
  { label: "Settings", path: "/dashboard/settings", icon: Settings },
];

const superAdminItems: NavItem[] = [
  { label: "Users", path: "/super-admin/users", icon: Users },
  { label: "Permissions", path: "/super-admin/permissions", icon: Shield },
  { label: "Events", path: "/super-admin/events", icon: Calendar },
  { label: "Jobs", path: "/super-admin/jobs", icon: BarChart3 },
  { label: "Audit Logs", path: "/super-admin/audit-logs", icon: Shield },
  { label: "Settings", path: "/super-admin/settings", icon: Settings },
];

interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AppSidebar({ mobileOpen, onMobileClose }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const navItems = isSuperAdmin ? superAdminItems : photographerItems;
  const showDashboardLink = isSuperAdmin; // super-admins also get a dashboard link

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div
      className={cn(
        "flex flex-col h-full bg-sidebar text-sidebar-foreground",
        !isMobile && (collapsed ? "w-14" : "w-60"),
        isMobile && "w-72",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border py-4 shrink-0",
          collapsed && !isMobile ? "justify-center px-2" : "gap-2.5 px-4",
        )}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent shrink-0">
          <Camera className="h-4 w-4 text-accent-foreground" />
        </div>
        {(!collapsed || isMobile) && (
          <span className="font-editorial text-lg font-bold text-sidebar-primary tracking-tight">
            CamSort
          </span>
        )}
        {!isMobile && (
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="ml-auto text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Role badge */}
      {(!collapsed || isMobile) && (
        <div className="px-4 pt-3 pb-1">
          <Badge
            variant="outline"
            className="text-[10px] px-2 py-0.5 border-sidebar-border text-sidebar-foreground/60 uppercase tracking-wider"
          >
            {isSuperAdmin ? "Super Admin" : (user?.role ?? "Photographer")}
          </Badge>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {showDashboardLink && (
          <SidebarNavItem
            item={{
              label: "Dashboard",
              path: "/dashboard",
              icon: LayoutDashboard,
              exact: true,
            }}
            collapsed={collapsed && !isMobile}
            onClose={onMobileClose}
          />
        )}
        {navItems.map((item) => (
          <SidebarNavItem
            key={item.path}
            item={item}
            collapsed={collapsed && !isMobile}
            onClose={onMobileClose}
          />
        ))}
      </nav>

      {/* User footer */}
      <div
        className={cn(
          "border-t border-sidebar-border p-3 shrink-0",
          collapsed && !isMobile ? "flex justify-center" : "",
        )}
      >
        {collapsed && !isMobile ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className="p-2 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0 text-xs font-bold text-sidebar-foreground">
              {user?.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-sidebar-foreground">
                {user?.name}
              </p>
              <p className="text-xs text-sidebar-foreground/50 truncate">
                {user?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex flex-col h-screen sticky top-0 shrink-0 border-r border-border overflow-hidden transition-all duration-200">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={onMobileClose}
          />
          <aside className="absolute left-0 top-0 h-full shadow-xl">
            <SidebarContent isMobile />
          </aside>
        </div>
      )}
    </>
  );
}

function SidebarNavItem({
  item,
  collapsed,
  onClose,
}: {
  item: NavItem;
  collapsed: boolean;
  onClose?: () => void;
}) {
  const Icon = item.icon;

  const content = (
    <NavLink
      to={item.path}
      end={item.exact ?? false}
      onClick={onClose}
      className={({ isActive }) =>
        cn(
          "flex items-center rounded-md text-sm transition-colors",
          collapsed ? "justify-center p-2" : "gap-2.5 px-3 py-2",
          isActive
            ? "bg-sidebar-accent text-sidebar-primary font-medium"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.badge && (
        <Badge className="text-[10px] h-4 px-1.5 bg-accent text-accent-foreground border-0">
          {item.badge}
        </Badge>
      )}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }
  return content;
}
