import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Target,
  Heart,
  Lightbulb,
  Zap,
  Users,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarketingLayout } from "@/components/layouts/MarketingLayout";

const values = [
  {
    icon: Target,
    title: "Photographer-first",
    desc: "Every feature is designed around how real studios work — from bulk upload to granular team roles.",
  },
  {
    icon: Heart,
    title: "Guest delight",
    desc: "Guests should never dig through hundreds of photos. Personalised galleries are the standard, not a luxury.",
  },
  {
    icon: Lightbulb,
    title: "Privacy by default",
    desc: "Face embeddings live in your own Supabase instance. We never train on your clients' biometric data.",
  },
];

const stats = [
  { value: "10,000+", label: "Events hosted" },
  { value: "2.5M+", label: "Photos delivered" },
  { value: "98%", label: "Guest match rate" },
  { value: "500+", label: "Studios worldwide" },
];

const team = [
  {
    name: "Arjun Mehta",
    role: "Co-founder & CEO",
    bio: "Former wedding photographer turned engineer. Built CamSort after manually sorting 80,000 photos in one summer.",
  },
  {
    name: "Sofia Reyes",
    role: "Co-founder & CTO",
    bio: "Computer vision researcher. Led face recognition projects before joining as co-founder.",
  },
  {
    name: "Daniel Park",
    role: "Head of Product",
    bio: "Product designer with a background in photo SaaS tools. Obsessed with guest experience.",
  },
];

export default function AboutPage() {
  return (
    <MarketingLayout>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <Badge variant="secondary" className="mb-5 text-xs">
            About CamSort
          </Badge>
          <h1 className="font-editorial text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6 text-balance">
            We built the photo-sharing platform we always wished existed
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl text-pretty">
            CamSort started from a real problem: after every event,
            photographers spend hours manually sorting and distributing
            thousands of photos to guests who may never see them. We decided to
            fix that with AI.
          </p>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────── */}
      <section className="border-b border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="font-editorial text-3xl md:text-4xl font-bold text-accent">
                  {s.value}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Story ────────────────────────────────────────────────── */}
      <section className="py-20 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <Badge variant="secondary" className="mb-5 text-xs">
            Our story
          </Badge>
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div className="space-y-5 text-muted-foreground leading-relaxed">
              <p>
                In 2024, a wedding photographer we know delivered 1,400 photos
                to a couple. Only 120 of those photos ever got seen — because
                most were of guests the couple had no way to identify or reach.
              </p>
              <p>
                The AI tools existed. Face recognition was mature. But no
                platform combined them into a product studios could actually use
                without an ML engineering team.
              </p>
              <p>
                So we built CamSort: an end-to-end platform where photographers
                upload, AI detects and indexes every face, and guests use a
                simple selfie to find every photo they appear in.
              </p>
              <p>
                Today, 500+ studios in India, UK, and US use CamSort to deliver
                personalised galleries at weddings, corporate events,
                conferences, and sports meets.
              </p>
            </div>
            <div className="space-y-4">
              {[
                {
                  icon: Zap,
                  stat: "3 min",
                  label: "Average time from upload to AI-indexed gallery",
                },
                {
                  icon: TrendingUp,
                  stat: "98%",
                  label:
                    "Of guests successfully find their photos using face search",
                },
                {
                  icon: Users,
                  stat: "12×",
                  label: "More photos claimed compared to manual distribution",
                },
              ].map((item) => (
                <div
                  key={item.stat}
                  className="rounded-xl border border-border bg-card p-5 flex items-center gap-4"
                >
                  <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <item.icon className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-editorial text-2xl font-bold leading-none mb-1">
                      {item.stat}
                    </p>
                    <p className="text-xs text-muted-foreground leading-snug">
                      {item.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Values ───────────────────────────────────────────────── */}
      <section className="py-20 border-b border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4 text-xs">
              Our values
            </Badge>
            <h2 className="font-editorial text-3xl md:text-4xl font-bold text-balance">
              What we stand for
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {values.map((v) => (
              <div
                key={v.title}
                className="rounded-xl border border-border bg-card p-6 space-y-3 hover:border-foreground/20 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <v.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="font-semibold">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
                  {v.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team ─────────────────────────────────────────────────── */}
      <section className="py-20 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4 text-xs">
              Team
            </Badge>
            <h2 className="font-editorial text-3xl md:text-4xl font-bold text-balance">
              The people behind CamSort
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {team.map((m) => (
              <div
                key={m.name}
                className="rounded-xl border border-border bg-card p-6"
              >
                <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                  <span className="font-editorial font-bold text-accent text-lg">
                    {m.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                </div>
                <p className="font-semibold">{m.name}</p>
                <p className="text-xs text-accent mb-3">{m.role}</p>
                <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
                  {m.bio}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-4 md:px-6 text-center">
          <h2 className="font-editorial text-3xl md:text-4xl font-bold mb-4 text-balance">
            Join 500+ studios on CamSort
          </h2>
          <p className="text-muted-foreground mb-8 text-pretty">
            Start delivering personalised photo galleries at your next event.
            Free for 14 days.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/register">
              <Button size="lg" className="gap-2 px-8 w-full sm:w-auto">
                Get started free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button
                variant="outline"
                size="lg"
                className="px-8 w-full sm:w-auto"
              >
                Contact us
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
