import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

interface Props {
  children: React.ReactNode;
}

export function MarketingLayout({ children }: Props) {
  const { isAuthenticated, user } = useAuth();
  const [open, setOpen] = useState(false);
  const dashLink =
    user?.role === "SUPER_ADMIN" ? "/super-admin/users" : "/dashboard";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Navbar ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center">
              <Camera className="h-4 w-4 text-accent-foreground" />
            </div>
            <span className="font-editorial text-lg font-bold tracking-tight">
              CamSort
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                to={l.href}
                className="hover:text-foreground transition-colors whitespace-nowrap"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {isAuthenticated ? (
              <Link to={dashLink}>
                <Button size="sm" className="gap-1.5">
                  Dashboard <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Get started free</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <div className="flex items-center justify-between px-5 h-16 border-b border-border">
                <Link
                  to="/"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2"
                >
                  <div className="h-7 w-7 rounded-md bg-accent flex items-center justify-center">
                    <Camera className="h-3.5 w-3.5 text-accent-foreground" />
                  </div>
                  <span className="font-editorial font-bold">CamSort</span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <nav className="flex flex-col px-4 py-4 gap-1">
                {NAV_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    to={l.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center px-3 py-3 rounded-md text-sm hover:bg-muted transition-colors"
                  >
                    {l.label}
                  </Link>
                ))}
                <div className="h-px bg-border my-3" />
                {isAuthenticated ? (
                  <Link to={dashLink} onClick={() => setOpen(false)}>
                    <Button className="w-full gap-1.5">
                      Dashboard <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                ) : (
                  <div className="space-y-2">
                    <Link to="/login" onClick={() => setOpen(false)}>
                      <Button variant="outline" className="w-full">
                        Sign in
                      </Button>
                    </Link>
                    <Link to="/register" onClick={() => setOpen(false)}>
                      <Button className="w-full">Get started free</Button>
                    </Link>
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* ── Page content ───────────────────────────────── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="border-t border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1 space-y-3">
              <Link to="/" className="flex items-center gap-2">
                <div className="h-7 w-7 rounded bg-accent flex items-center justify-center">
                  <Camera className="h-3.5 w-3.5 text-accent-foreground" />
                </div>
                <span className="font-editorial font-bold">CamSort</span>
              </Link>
              <p className="text-xs text-muted-foreground leading-relaxed">
                AI-powered photo sharing for professional studios.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Product
              </p>
              <ul className="space-y-2 text-sm">
                {[
                  ["/#features", "Features"],
                  ["/#how-it-works", "How it works"],
                  ["/#pricing", "Pricing"],
                ].map(([h, l]) => (
                  <li key={h}>
                    <Link
                      to={h}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Company
              </p>
              <ul className="space-y-2 text-sm">
                {[
                  ["/about", "About"],
                  ["/contact", "Contact"],
                ].map(([h, l]) => (
                  <li key={h}>
                    <Link
                      to={h}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Account
              </p>
              <ul className="space-y-2 text-sm">
                {[
                  ["/login", "Sign in"],
                  ["/register", "Register"],
                  ["/dashboard", "Dashboard"],
                ].map(([h, l]) => (
                  <li key={h}>
                    <Link
                      to={h}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>© 2026 CamSort. All rights reserved.</span>
            <span>Built for professional photo studios worldwide.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
