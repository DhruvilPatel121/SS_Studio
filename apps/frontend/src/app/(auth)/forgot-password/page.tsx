"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { toast } from "sonner";
import { Camera, Mail, ArrowLeft } from "lucide-react";
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

const schema = z.object({ email: z.string().email() });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormData) => {
    try {
      await api.forgotPassword(values.email);
      setSent(true);
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
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>
              {sent
                ? "Check your email for a reset link."
                : "Enter your email and we'll send you a reset link."}
            </CardDescription>
          </CardHeader>

          {!sent ? (
            <form onSubmit={handleSubmit(onSubmit)}>
              <CardContent>
                <Input
                  {...register("email")}
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  leftIcon={<Mail className="h-4 w-4" />}
                  error={errors.email?.message}
                />
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button type="submit" className="w-full" loading={isSubmitting}>
                  Send Reset Link
                </Button>
                <Link
                  href="/login"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to sign in
                </Link>
              </CardFooter>
            </form>
          ) : (
            <CardContent className="flex flex-col items-center gap-4 pb-6">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <Mail className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                If an account exists for that email, you will receive a password
                reset link shortly.
              </p>
              <Link href="/login">
                <Button variant="outline" className="mt-2">
                  Back to Sign In
                </Button>
              </Link>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
