import React from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Mail,
  MessageSquare,
  User,
  Clock,
  Building,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { contactApi } from "@/services/api";
import { getErrorMessage } from "@/lib/utils";
import { MarketingLayout } from "@/components/layouts/MarketingLayout";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  subject: z.string().min(1, "Please select a subject"),
  message: z.string().min(20, "Message must be at least 20 characters"),
});
type FormData = z.infer<typeof schema>;

const subjects = [
  { value: "sales", label: "Sales inquiry" },
  { value: "support", label: "Technical support" },
  { value: "billing", label: "Billing question" },
  { value: "partnership", label: "Partnership" },
  { value: "demo", label: "Request a demo" },
  { value: "other", label: "Other" },
];

const faqs = [
  {
    q: "How does the face recognition work?",
    a: "We use InsightFace to create face embeddings from photos. Guest selfies are matched against these embeddings to find their photos — no names or IDs needed.",
  },
  {
    q: "Where is my data stored?",
    a: "All photos, face data, and metadata live in your own Supabase project. We never have access to your clients' biometric data.",
  },
  {
    q: "Can I white-label the galleries?",
    a: "Yes — upload your studio logo, set brand colors, add a watermark, and custom footer on every gallery. Available on Studio and Agency plans.",
  },
  {
    q: "How many photos can I upload?",
    a: "Starter allows 2,000 photos per event. Studio allows 10,000. Agency is unlimited. Contact us for very high-volume needs.",
  },
];

export default function ContactPage() {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormData) => {
    try {
      await contactApi.submit(values);
      toast.success("Message sent! We'll reply within 1 business day.");
      reset();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <MarketingLayout>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <Badge variant="secondary" className="mb-5 text-xs">
            Contact us
          </Badge>
          <h1 className="font-editorial text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-4 text-balance">
            We'd love to hear from you
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl text-pretty">
            Whether you're evaluating CamSort, need technical help, or want a
            live demo — we respond to every message within one business day.
          </p>
        </div>
      </section>

      {/* ── Contact cards + form ─────────────────────────────────── */}
      <section className="py-16 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-5 gap-10">
            {/* Info column */}
            <div className="md:col-span-2 space-y-6">
              {/* Contact info cards */}
              {[
                {
                  icon: Mail,
                  label: "General enquiries",
                  value: "hello@camsort.io",
                },
                {
                  icon: Building,
                  label: "Enterprise sales",
                  value: "sales@camsort.io",
                },
                {
                  icon: Clock,
                  label: "Response time",
                  value: "Within 1 business day",
                },
                {
                  icon: MessageSquare,
                  label: "Live chat",
                  value: "Available 9am–6pm IST, weekdays",
                },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3.5">
                  <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                    <item.icon className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="text-sm font-medium">{item.value}</p>
                  </div>
                </div>
              ))}

              {/* Demo callout */}
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 mt-2">
                <p className="text-sm font-semibold mb-1.5">
                  Want a live demo?
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
                  Select "Request a demo" below and we'll schedule a 30-minute
                  walkthrough tailored to your studio's workflow.
                </p>
                <Link to="#contact-form">
                  <Button size="sm" variant="outline" className="mt-3 text-xs">
                    Request demo
                  </Button>
                </Link>
              </div>
            </div>

            {/* Form */}
            <div
              id="contact-form"
              className="md:col-span-3 rounded-xl border border-border bg-card p-6 md:p-8"
            >
              {isSubmitSuccessful ? (
                <div className="text-center py-16 space-y-4">
                  <div className="h-14 w-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                    <Mail className="h-7 w-7 text-accent" />
                  </div>
                  <h3 className="font-editorial text-xl font-bold">
                    Message received!
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    We'll get back to you within 1 business day.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reset()}
                    className="mt-2"
                  >
                    Send another message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
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
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="subject">Subject *</Label>
                    <Select
                      onValueChange={(v) =>
                        setValue("subject", v, { shouldValidate: true })
                      }
                    >
                      <SelectTrigger id="subject">
                        <SelectValue placeholder="Select a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.subject && (
                      <p className="text-xs text-destructive">
                        {errors.subject.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      {...register("message")}
                      rows={5}
                      placeholder="Tell us how we can help…"
                      className="resize-none"
                    />
                    {errors.message && (
                      <p className="text-xs text-destructive">
                        {errors.message.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Sending…" : "Send message"}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    We respond within 1 business day
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section className="py-20 bg-card/30">
        <div className="max-w-3xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4 text-xs">
              FAQ
            </Badge>
            <h2 className="font-editorial text-3xl font-bold text-balance">
              Frequently asked questions
            </h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq.q}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start gap-3">
                  <HelpCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm mb-2">{faq.q}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-8">
            Still have questions?{" "}
            <Link
              to="/contact"
              className="text-accent hover:underline font-medium"
            >
              Ask us directly
            </Link>
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
