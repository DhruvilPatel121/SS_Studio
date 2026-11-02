import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth.store";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/utils";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

function getRoleRedirect(role: string): string {
  if (role === "SUPER_ADMIN") return "/super-admin/users";
  return "/dashboard";
}

export default function LoginPage() {
  const [showPw, setShowPw] = useState(false);
  const { login } = useAuthStore();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from;

  // Redirect already-authenticated users
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(from || getRoleRedirect(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate, from]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handleQuickFill = (email: string, pass: string) => {
    setValue("email", email, { shouldValidate: true, shouldDirty: true });
    setValue("password", pass, { shouldValidate: true, shouldDirty: true });
  };

  const onSubmit = async (values: FormData) => {
    try {
      await login(values.email, values.password);
      // navigation handled by useEffect above after user state updates
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel – branding */}
      <div className="hidden md:flex md:w-1/2 bg-card border-r border-border flex-col justify-between p-12">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-md bg-accent flex items-center justify-center">
            <Camera className="h-5 w-5 text-accent-foreground" />
          </div>
          <span className="font-editorial text-xl font-bold tracking-tight">
            CamSort
          </span>
        </Link>
        <div>
          <blockquote className="space-y-3">
            <p className="text-2xl font-editorial font-bold leading-snug text-foreground">
              "The AI face recognition saved us hours after every wedding.
              Guests find their photos instantly."
            </p>
            <footer className="text-sm text-muted-foreground">
              — Sofia M., Wedding Photographer
            </footer>
          </blockquote>
        </div>
        <p className="text-xs text-muted-foreground">
          © 2026 CamSort. All rights reserved.
        </p>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <Link to="/" className="flex md:hidden items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center">
              <Camera className="h-4 w-4 text-accent-foreground" />
            </div>
            <span className="font-editorial text-lg font-bold">CamSort</span>
          </Link>

          <div className="space-y-2">
            <h1 className="font-editorial text-3xl font-bold tracking-tight">
              Welcome back
            </h1>
            <p className="text-muted-foreground text-sm">
              Sign in to your CamSort account
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  {...register("email")}
                  type="email"
                  placeholder="you@studio.com"
                  className="pl-9"
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-accent hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  {...register("password")}
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-9 pr-9"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {/* Demo Accounts Card */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-2.5 text-xs">
            <p className="font-semibold text-foreground flex items-center justify-between">
              <span>Demo Accounts</span>
              <span className="text-[10px] text-muted-foreground font-normal">
                Click to quick-fill
              </span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  handleQuickFill("superadmin@gmail.com", "Superadmin@123")
                }
                className="p-2.5 rounded-lg border border-border bg-muted/40 hover:bg-muted/70 text-left transition-colors cursor-pointer"
              >
                <p className="font-medium text-foreground">Super Admin</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  superadmin@gmail.com
                </p>
                <p className="text-[10px] text-accent mt-0.5 font-mono">
                  Superadmin@123
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleQuickFill(
                    "dhruvil.unofficial@gmail.com",
                    "Dhruvil@123",
                  )
                }
                className="p-2.5 rounded-lg border border-border bg-muted/40 hover:bg-muted/70 text-left transition-colors cursor-pointer"
              >
                <p className="font-medium text-foreground">Studio Admin</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  dhruvil.unofficial@gmail.com
                </p>
                <p className="text-[10px] text-accent mt-0.5 font-mono">
                  Dhruvil@123
                </p>
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-accent hover:underline font-medium"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
