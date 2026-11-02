import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sun,
  Moon,
  Bell,
  Menu,
  User,
  Settings,
  LogOut,
  Camera,
} from "lucide-react";

interface TopNavbarProps {
  onMenuClick?: () => void;
  title?: string;
}

export function TopNavbar({ onMenuClick, title }: TopNavbarProps) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-background/95 backdrop-blur px-4 gap-3 shrink-0">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-1.5 rounded-md hover:bg-muted transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile logo */}
      <div className="md:hidden flex items-center gap-2">
        <div className="h-6 w-6 rounded bg-accent flex items-center justify-center">
          <Camera className="h-3 w-3 text-accent-foreground" />
        </div>
        <span className="font-editorial font-bold text-base">CamSort</span>
      </div>

      {/* Page title (desktop) */}
      {title && (
        <h1 className="hidden md:block font-editorial font-bold text-lg tracking-tight truncate flex-1">
          {title}
        </h1>
      )}

      <div className="flex-1 md:flex-none" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-8 w-8"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Notifications */}
        <Link to="/dashboard/notifications">
          <Button variant="ghost" size="icon" className="h-8 w-8 relative">
            <Bell className="h-4 w-4" />
          </Button>
        </Link>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted transition-colors">
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
                {user?.name?.[0]?.toUpperCase() ?? "U"}
              </div>
              <span className="hidden md:block text-sm font-medium max-w-[120px] truncate">
                {user?.name}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <p className="font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground font-normal truncate">
                {user?.email}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                to="/dashboard/settings"
                className="flex items-center gap-2 cursor-pointer"
              >
                <User className="h-4 w-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                to="/dashboard/settings"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive flex items-center gap-2 cursor-pointer"
              onClick={async () => {
                await logout();
                navigate("/");
              }}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
