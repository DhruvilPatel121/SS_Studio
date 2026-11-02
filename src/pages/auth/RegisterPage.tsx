import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, User, Building2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/utils";

const schema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Enter a valid email"),
    studioName: z.string().optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const [showPw, setShowPw] = useState(false);
  const { login } = useAuthStore();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormData) => {
    try {
      const result = await authApi.register({
        name: values.name,
        email: values.email,
        password: values.password,
        studioName: values.studioName,
      });
      // If email confirmation is disabled, session is returned immediately
      if (result?.session) {
        await login(values.email, values.password);
        toast.success("Account created! Welcome to CamSort");
      } else {
        // Email confirmation required — show message instead of erroring
        toast.success(
          "Account created! Please check your email to confirm your account, then sign in.",
        );
        navigate("/login");
      }
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
        <div className="space-y-6">
          <h2 className="font-editorial text-3xl font-bold leading-snug">
            Professional photo sharing, powered by AI face recognition.
          </h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {[
              "AI face matching — guests find their photos instantly",
              "Custom-branded galleries for your studio",
              "QR code access for every event",
              "Role-based team management",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-0.5 h-4 w-4 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          © 2026 CamSort. All rights reserved.
        </p>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-sm space-y-8">
          <Link to="/" className="flex md:hidden items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center">
              <Camera className="h-4 w-4 text-accent-foreground" />
            </div>
            <span className="font-editorial text-lg font-bold">CamSort</span>
          </Link>

          <div className="space-y-2">
            <h1 className="font-editorial text-3xl font-bold tracking-tight">
              Create account
            </h1>
            <p className="text-muted-foreground text-sm">
              Start sharing event photos with AI-powered face search
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    {...register("name")}
                    placeholder="Jane Smith"
                    className="pl-9"
                  />
                </div>
                {errors.name && (
                  <p className="text-xs text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="studioName">Studio name</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="studioName"
                    {...register("studioName")}
                    placeholder="Optional"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  {...register("email")}
                  type="email"
                  placeholder="you@studio.com"
                  className="pl-9"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  {...register("password")}
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-9 pr-9"
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

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  {...register("confirmPassword")}
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-9"
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-accent hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
