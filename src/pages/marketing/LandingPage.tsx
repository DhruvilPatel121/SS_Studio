import React from "react";
import { Link } from "react-router-dom";
import {
  Camera,
  Zap,
  Users,
  Shield,
  ArrowRight,
  Check,
  Star,
  Image,
  Scan,
  Download,
  QrCode,
  Palette,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarketingLayout } from "@/components/layouts/MarketingLayout";

const features = [
  {
    icon: Scan,
    title: "AI Face Recognition",
    desc: "InsightFace-powered matching — every guest finds their photos in seconds without manual tagging.",
  },
  {
    icon: Image,
    title: "Instant Branded Gallery",
    desc: "Photos appear in a beautiful gallery with your studio logo, colors, and watermark applied automatically.",
  },
  {
    icon: QrCode,
    title: "QR Code Access",
    desc: "Generate a unique QR per event or group. Guests scan, snap a selfie, and see only their photos.",
  },
  {
    icon: Shield,
    title: "Privacy by Default",
    desc: "Public, private, or unlisted events. Face embeddings live in your own Supabase instance.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    desc: "Add photographers and staff per event. Role-based access keeps everyone in their lane.",
  },
  {
    icon: Download,
    title: "One-Click Downloads",
    desc: "Guests download single photos or their entire collection as a ZIP — watermarked automatically.",
  },
];

const steps = [
  {
    num: "01",
    title: "Create an Event",
    desc: "Set up in under 2 minutes. Add a name, date, privacy setting, and your branding.",
  },
  {
    num: "02",
    title: "Upload Photos",
    desc: "Drag-and-drop bulk upload. AI detects and indexes every face automatically in the background.",
  },
  {
    num: "03",
    title: "Share the QR",
    desc: "Print or project your event QR. Guests scan, take a selfie, and find all their photos instantly.",
  },
];

const testimonials = [
  {
    quote:
      "We used to spend 3 hours after each wedding sending photos manually. Now guests find everything themselves within minutes.",
    author: "Priya K.",
    role: "Wedding Photographer, Mumbai",
  },
  {
    quote:
      "The face matching accuracy is incredible. Our corporate clients love the white-label gallery — it looks like our own product.",
    author: "James T.",
    role: "Commercial Studio, London",
  },
  {
    quote:
      "CamSort paid for itself after the first conference we shot. The QR code flow is seamless for large-scale events.",
    author: "Arun S.",
    role: "Event Photographer, Bangalore",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    price: "₹999",
    period: "/month",
    desc: "Perfect for solo photographers starting out.",
    features: [
      "Up to 5 events/month",
      "2,000 photos per event",
      "AI face recognition",
      "QR code access",
      "Email support",
    ],
    cta: "Start free trial",
    highlighted: false,
  },
  {
    name: "Studio",
    price: "₹2,999",
    period: "/month",
    desc: "For growing studios with multiple shoots.",
    features: [
      "Unlimited events",
      "10,000 photos per event",
      "AI face recognition",
      "Custom branding & watermarks",
      "Team members (up to 5)",
      "Priority support",
    ],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    name: "Agency",
    price: "Custom",
    period: "",
    desc: "For large agencies managing many studios.",
    features: [
      "Everything in Studio",
      "Unlimited team members",
      "White-label domains",
      "SLA guarantee",
      "Dedicated account manager",
      "API access",
    ],
    cta: "Contact sales",
    highlighted: false,
  },
];

export default function LandingPage() {
  return (
    <MarketingLayout>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--accent)/0.12),transparent)]" />
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-36 text-center relative">
          <Badge variant="secondary" className="mb-6 gap-1.5 px-3 py-1 text-xs">
            <Zap className="h-3 w-3 text-accent" />
            AI-Powered Photo Sharing for Studios
          </Badge>
          <h1 className="font-editorial text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6 text-balance">
            Every guest finds
            <br />
            <span className="text-accent">their own photos</span>
          </h1>
          <p className="text-base md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed text-pretty">
            CamSort is the event photo platform for professional studios. AI
            face recognition delivers personalised galleries to every guest —
            instantly, automatically.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/register">
              <Button size="lg" className="gap-2 px-8 w-full sm:w-auto">
                Start free trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button
                variant="outline"
                size="lg"
                className="px-8 w-full sm:w-auto"
              >
                Talk to sales
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No credit card required · 14-day free trial · Cancel anytime
          </p>

          {/* Social proof bar */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground border-t border-border pt-10">
            {[
              { value: "10,000+", label: "Events hosted" },
              { value: "2.5M+", label: "Photos delivered" },
              { value: "98%", label: "Guest match rate" },
              { value: "500+", label: "Studios worldwide" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-editorial text-xl font-bold text-foreground">
                  {s.value}
                </p>
                <p>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section id="features" className="py-24 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-14">
            <Badge variant="secondary" className="mb-4 text-xs">
              Features
            </Badge>
            <h2 className="font-editorial text-3xl md:text-4xl font-bold mb-4 text-balance">
              Everything your studio needs
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-pretty">
              One platform from upload to guest download — with AI doing the
              heavy lifting.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-card p-6 hover:border-foreground/20 hover:shadow-sm transition-all"
              >
                <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="py-24 border-b border-border bg-card/30"
      >
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-14">
            <Badge variant="secondary" className="mb-4 text-xs">
              How it works
            </Badge>
            <h2 className="font-editorial text-3xl md:text-4xl font-bold mb-4 text-balance">
              Up and running in minutes
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-pretty">
              Three steps from first upload to happy guests.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={s.num} className="relative flex flex-col">
                {i < steps.length - 1 && (
                  <ChevronRight className="hidden md:block absolute top-4 -right-5 h-5 w-5 text-muted-foreground/40" />
                )}
                <div className="text-5xl font-editorial font-bold text-foreground/10 mb-4 leading-none">
                  {s.num}
                </div>
                <div className="flex-1 rounded-xl border border-border bg-card p-5">
                  <h3 className="font-semibold text-base mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────── */}
      <section className="py-24 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-14">
            <Badge variant="secondary" className="mb-4 text-xs">
              Testimonials
            </Badge>
            <h2 className="font-editorial text-3xl md:text-4xl font-bold mb-4">
              Loved by photographers
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div
                key={t.author}
                className="rounded-xl border border-border bg-card p-6 space-y-4 hover:border-foreground/20 transition-colors"
              >
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-foreground/90 text-pretty">
                  "{t.quote}"
                </p>
                <div className="border-t border-border pt-3">
                  <p className="text-sm font-semibold">{t.author}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 border-b border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-14">
            <Badge variant="secondary" className="mb-4 text-xs">
              Pricing
            </Badge>
            <h2 className="font-editorial text-3xl md:text-4xl font-bold mb-4 text-balance">
              Simple, transparent pricing
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-pretty">
              Start free for 14 days. No credit card required.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-7 flex flex-col ${
                  plan.highlighted
                    ? "border-accent bg-accent/5 shadow-md relative"
                    : "border-border bg-card"
                }`}
              >
                {plan.highlighted && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-xs px-3">
                    Most popular
                  </Badge>
                )}
                <div className="mb-6">
                  <p className="font-semibold text-base mb-1">{plan.name}</p>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="font-editorial text-3xl font-bold">
                      {plan.price}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {plan.period}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.desc}</p>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.cta === "Contact sales" ? "/contact" : "/register"}
                >
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-4 md:px-6 text-center">
          <h2 className="font-editorial text-3xl md:text-5xl font-bold mb-6 leading-tight text-balance">
            Ready to wow your guests?
          </h2>
          <p className="text-muted-foreground mb-8 text-base md:text-lg text-pretty">
            Join 500+ studios delivering personalised photo galleries at every
            event.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/register">
              <Button size="lg" className="gap-2 px-10 w-full sm:w-auto">
                Create free account <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/about">
              <Button
                variant="outline"
                size="lg"
                className="px-10 w-full sm:w-auto"
              >
                Learn more
              </Button>
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {[
              "Free 14-day trial",
              "No credit card",
              "Cancel anytime",
              "GDPR compliant",
            ].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-accent shrink-0" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </MarketingLayout>
  );
}
