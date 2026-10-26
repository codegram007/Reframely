import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Globe,
  Sliders,
  Download,
  Code2,
  CheckCircle2,
  ArrowRight,
  MonitorSmartphone,
} from 'lucide-react';
import {
  SiteNav,
  SiteFooter,
  AmbientField,
  LandingPrimaryButton,
} from '@/pages/landing-page';

export function HowItWorksPage() {
  const navigate = useNavigate();
  const goImport = () => navigate('/app', { state: { openImport: true } });

  const steps = [
    {
      badge: 'Step 01',
      title: 'Import Any Website in Seconds',
      tagline: 'No complex migrations or vendor lock-in',
      description:
        'Reframely takes the site you generated with AI tools (v0, bolt, lovable, cursor) or any existing web project and digests it cleanly into a visual tree.',
      icon: Upload,
      details: [
        {
          title: 'Direct Zip Upload',
          desc: 'Drag & drop your exported static HTML/CSS/JS or Vite/React build archive.',
        },
        {
          title: 'GitHub Repository Clone',
          desc: 'Provide a link to any public repository. Reframely pulls, parses, and stages your source.',
        },
        {
          title: 'Live URL Snapshotting',
          desc: 'Enter any public URL. Headless Chromium captures DOM structure, styles, and viewport layouts.',
        },
      ],
      diagram: (
        <div className="rounded-xl border border-border/80 bg-surface/80 p-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3 text-xs text-foreground-muted">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
            <span className="ml-2 font-mono text-[11px]">import-pipeline.ts</span>
          </div>
          <div className="mt-4 space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2 text-foreground">
              <span className="text-accent">→</span> Extract HTML AST & CSS rules
            </div>
            <div className="flex items-center gap-2 text-foreground">
              <span className="text-accent">→</span> Map fonts, color tokens & responsive breakpoints
            </div>
            <div className="flex items-center gap-2 text-emerald-500">
              <CheckCircle2 className="h-3.5 w-3.5" /> Widget Tree synthesized without losing code integrity
            </div>
          </div>
        </div>
      ),
    },
    {
      badge: 'Step 02',
      title: 'Edit Visually Without Burning AI Credits',
      tagline: 'Stop prompting an LLM 10 times just to change padding or color',
      description:
        'Why spend tokens and wait 45 seconds for a chatbot to nudge a button 8 pixels to the right—and risk having it break the rest of the layout? Reframely gives you tactile, instant direct manipulation.',
      icon: Sliders,
      details: [
        {
          title: 'Point, Click & Edit',
          desc: 'Select any element on the canvas. Change text, swap images, adjust padding, margins, borders, and shadows in real-time.',
        },
        {
          title: 'Drag-and-Drop Structure',
          desc: 'Reorder sections, move cards between columns, and nest components with full visual feedback.',
        },
        {
          title: 'Responsive Multi-Device Preview',
          desc: 'Toggle between Desktop (1280px), Tablet (768px), and Mobile (375px) to preview and tune breakpoint overrides.',
        },
      ],
      diagram: (
        <div className="rounded-xl border border-border/80 bg-surface/80 p-5 shadow-sm">
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-medium">
            <div className="rounded-lg border border-border bg-surface-sunken p-3">
              <MonitorSmartphone className="mx-auto mb-1 h-4 w-4 text-accent" />
              <span>Mobile</span>
              <span className="block text-[10px] text-foreground-muted">375px</span>
            </div>
            <div className="rounded-lg border border-border bg-surface-sunken p-3">
              <MonitorSmartphone className="mx-auto mb-1 h-4 w-4 text-accent" />
              <span>Tablet</span>
              <span className="block text-[10px] text-foreground-muted">768px</span>
            </div>
            <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-accent">
              <MonitorSmartphone className="mx-auto mb-1 h-4 w-4 text-accent" />
              <span>Desktop</span>
              <span className="block text-[10px] text-accent/80">1280px</span>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-surface-sunken p-3 text-xs text-foreground-muted">
            <span className="font-semibold text-foreground">Canvas State:</span> Instant bi-directional update. Zero roundtrips to an AI model.
          </div>
        </div>
      ),
    },
    {
      badge: 'Step 03',
      title: 'Real-Time Bi-Directional Code Sync',
      tagline: 'Your code and your canvas are always in perfect harmony',
      description:
        'Unlike closed-box site builders that generate messy proprietary JSON or lock you in, Reframely maintains clean, idiomatic React and Tailwind code with a full in-browser Monaco Editor.',
      icon: Code2,
      details: [
        {
          title: 'Monaco Editor Integration',
          desc: 'Inspect and edit the exact JSX and Tailwind classes generated behind every single visual component.',
        },
        {
          title: 'Synchronized Updates',
          desc: 'Visual changes immediately update the source code. Code changes immediately re-render in the visual canvas.',
        },
        {
          title: 'Full AST Cleanliness',
          desc: 'Output is clean, readable, componentized code that senior engineers actually want to read and maintain.',
        },
      ],
      diagram: (
        <div className="rounded-xl border border-border/80 bg-surface/80 p-5 shadow-sm font-mono text-xs">
          <div className="text-foreground-muted">// JSX automatically updated:</div>
          <div className="mt-2 text-accent">&lt;section className=&quot;relative px-6 py-12&quot;&gt;</div>
          <div className="ml-4 text-foreground">&lt;h1 className=&quot;text-3xl font-bold tracking-tight&quot;&gt;</div>
          <div className="ml-8 text-emerald-500">Reframed Design</div>
          <div className="ml-4 text-foreground">&lt;/h1&gt;</div>
          <div className="text-accent">&lt;/section&gt;</div>
        </div>
      ),
    },
    {
      badge: 'Step 04',
      title: 'Deploy to Cloud or Export Pure Code',
      tagline: 'Zero lock-in. You own 100% of your work.',
      description:
        'When your site looks exactly the way you want, share it with the world instantly or download the production build files to host anywhere.',
      icon: Download,
      details: [
        {
          title: 'Instant Preview Deploy',
          desc: 'Mint a live shareable URL with a single click to present your work to clients, founders, or team members.',
        },
        {
          title: 'Zip Export',
          desc: 'Download a self-contained Vite + React + Tailwind package ready to run with `npm run dev`.',
        },
        {
          title: 'Hosting Freedom',
          desc: 'Deploy effortlessly to Netlify, Vercel, Cloudflare Pages, AWS, or your own VPS.',
        },
      ],
      diagram: (
        <div className="rounded-xl border border-border/80 bg-surface/80 p-5 shadow-sm text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Globe className="h-5 w-5" />
          </div>
          <div className="mt-2 font-medium text-foreground text-sm">One-Click Production Staging</div>
          <p className="mt-1 text-xs text-foreground-muted">
            https://preview.reframely.app/p/your-project
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] text-foreground-muted">Netlify</span>
            <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] text-foreground-muted">Vercel</span>
            <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] text-foreground-muted">Cloudflare</span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="landing-mesh relative min-h-screen overflow-x-hidden bg-canvas text-foreground">
      <AmbientField />
      <SiteNav onCta={goImport} />

      <main className="relative z-10 mx-auto max-w-5xl px-5 py-16 sm:px-8">
        {/* Header */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1 text-xs font-medium text-accent">
            The Reframely Workflow
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            How Reframely Works
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-foreground-muted sm:text-lg">
            A frictionless bridge between AI-generated websites and pixel-perfect design.
            Understand how our four-step pipeline gives you full visual superpowers with zero credit burn.
          </p>
        </div>

        {/* Steps List */}
        <div className="mt-16 space-y-16">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <section
                key={step.badge}
                className="rounded-2xl border border-border bg-surface/60 p-6 backdrop-blur-md transition-all duration-300 hover:border-border-strong sm:p-10 shadow-sm"
              >
                <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 rounded-md bg-accent/15 px-2.5 py-1 font-mono text-xs font-semibold text-accent">
                        <Icon className="h-3.5 w-3.5" />
                        <span>{step.badge}</span>
                      </div>
                      <span className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
                        {step.tagline}
                      </span>
                    </div>

                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                      {step.title}
                    </h2>

                    <p className="mt-3 text-sm leading-relaxed text-foreground-muted sm:text-base">
                      {step.description}
                    </p>

                    <div className="mt-6 space-y-3.5">
                      {step.details.map((item) => (
                        <div key={item.title} className="flex items-start gap-3">
                          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-accent" />
                          <div>
                            <span className="text-sm font-semibold text-foreground">{item.title}: </span>
                            <span className="text-sm text-foreground-muted">{item.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="w-full lg:w-[380px] shrink-0">
                    {step.diagram}
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {/* Bottom CTA Banner */}
        <div className="mt-20 rounded-2xl border border-accent/40 bg-gradient-to-r from-accent/15 via-surface to-accent/10 p-8 text-center sm:p-12">
          <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Ready to reframe your first site?
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-foreground-muted">
            Drop in any static site, GitHub repo, or live URL and experience true visual editing without token limits.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <LandingPrimaryButton size="lg" onClick={goImport}>
              Import your site now <ArrowRight className="h-4 w-4" />
            </LandingPrimaryButton>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
