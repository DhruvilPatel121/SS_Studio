"use client";

import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { toast } from "sonner";
import { Camera, Eye, EyeOff, Lock, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getErrorMessage } from "@/lib/utils";

const schema = z
  .object({
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

export default function ResetPasswordPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(t);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormData) => {
    if (!token) return toast.error("Invalid or missing reset token");
    try {
      await api.resetPassword(token, values.password);
      setDone(true);
      setTimeout(() => router.replace("/login"), 3000);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Camera className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">Medo.dev</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Set new password</CardTitle>
            <CardDescription>
              Enter and confirm your new password below.
            </CardDescription>
          </CardHeader>

          {done ? (
            <CardContent className="flex flex-col items-center gap-4 pb-6">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-sm text-center text-muted-foreground">
                Password reset! Redirecting to sign in…
              </p>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                <Input
                  {...register("password")}
                  label="New Password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  leftIcon={<Lock className="h-4 w-4" />}
                  rightIcon={
                    <button type="button" onClick={() => setShowPw((v) => !v)}>
                      {showPw ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  }
                  error={errors.password?.message}
                />
                <Input
                  {...register("confirmPassword")}
                  label="Confirm Password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  leftIcon={<Lock className="h-4 w-4" />}
                  error={errors.confirmPassword?.message}
                />
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button type="submit" className="w-full" loading={isSubmitting}>
                  Reset Password
                </Button>
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Back to sign in
                </Link>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
