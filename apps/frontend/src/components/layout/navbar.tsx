"use client";

import { Bell, Moon, Sun, Search } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth.store";
import { Avatar } from "@/components/ui/avatar";

interface NavbarProps {
  title?: string;
  actions?: React.ReactNode;
}

export function Navbar({ title, actions }: NavbarProps) {
  const { theme, setTheme } = useTheme();
  const { user } = useAuthStore();

  return (
    <header className="h-14 border-b bg-card flex items-center gap-4 px-6 flex-shrink-0">
      {title && <h1 className="text-base font-semibold mr-auto">{title}</h1>}
      {!title && <div className="flex-1" />}

      {actions && <div className="flex items-center gap-2">{actions}</div>}

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
        </Button>
        <Avatar src={user?.avatarUrl} name={user?.name ?? ""} size="sm" />
      </div>
    </header>
  );
}
