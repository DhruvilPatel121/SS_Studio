import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Mail, CheckCircle, ArrowLeft, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/services/api";
import { getErrorMessage } from "@/lib/utils";

const schema = z.object({ email: z.string().email("Enter a valid email") });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormData) => {
    try {
      await authApi.forgotPassword(values.email);
      setSent(true);
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
            Reset password
          </h1>
          <p className="text-muted-foreground text-sm">
            We'll send a reset link to your email
          </p>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-accent" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Check your inbox</p>
              <p className="text-sm text-muted-foreground">
                We sent a reset link to <strong>{getValues("email")}</strong>
              </p>
            </div>
            <Link to="/login">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Button>
            </Link>
          </div>
        ) : (
          <>
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
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Sending…" : "Send reset link"}
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground">
              <Link
                to="/login"
                className="text-accent hover:underline font-medium flex items-center justify-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
