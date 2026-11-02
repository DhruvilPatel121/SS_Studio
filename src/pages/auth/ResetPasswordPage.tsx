import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, CheckCircle, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/services/api";
import { getErrorMessage } from "@/lib/utils";
import { supabase } from "@/db/supabase";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Requires uppercase")
      .regex(/[0-9]/, "Requires number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  // Supabase embeds the recovery token in the URL hash — we need to exchange it
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // If user arrived with a hash fragment, Supabase handles it automatically
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormData) => {
    try {
      await authApi.resetPassword(values.password);
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <Link to="/" className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center">
            <Camera className="h-4 w-4 text-accent-foreground" />
          </div>
          <span className="font-editorial text-lg font-bold">CamSort</span>
        </Link>

        <div className="space-y-2">
          <h1 className="font-editorial text-3xl font-bold tracking-tight">
            Set new password
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter and confirm your new password
          </p>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-accent" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Password updated!</p>
              <p className="text-sm text-muted-foreground">
                Redirecting to sign in…
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
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
              <Label htmlFor="confirmPassword">Confirm password</Label>
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
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !ready}
            >
              {isSubmitting ? "Updating…" : "Reset password"}
            </Button>
            <p className="text-center text-sm">
              <Link to="/login" className="text-accent hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
