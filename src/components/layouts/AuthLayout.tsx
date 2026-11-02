import React, { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { Camera } from "lucide-react";

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left panel – editorial visual */}
      <div className="hidden md:flex flex-col relative bg-primary overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1200&q=80')] bg-cover bg-center opacity-20" />
        <div className="relative z-10 flex flex-col h-full p-12">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-accent flex items-center justify-center">
              <Camera className="h-5 w-5 text-accent-foreground" />
            </div>
            <span className="font-editorial text-2xl font-bold text-primary-foreground">
              CamSort
            </span>
          </div>
          <div className="flex-1 flex flex-col justify-end">
            <blockquote className="space-y-4">
              <p className="font-editorial text-3xl font-bold text-primary-foreground leading-tight">
                "Every face tells a story. We help guests find theirs."
              </p>
              <footer className="text-sm text-primary-foreground/60">
                AI-powered event photo sharing
              </footer>
            </blockquote>
          </div>
        </div>
        {/* Editorial rule lines */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-accent" />
      </div>

      {/* Right panel – form */}
      <div className="flex flex-col items-center justify-center p-6 md:p-12 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center gap-2 md:hidden">
            <div className="h-8 w-8 rounded bg-accent flex items-center justify-center">
              <Camera className="h-4 w-4 text-accent-foreground" />
            </div>
            <span className="font-editorial font-bold text-xl">CamSort</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
