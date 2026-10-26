import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Code2,
  MonitorSmartphone,
  Sliders,
  Crop,
  History,
  Rocket,
  ShieldCheck,
  Palette,
  Sparkles,
  ArrowRight,
  MousePointer2,
  FileCode2,
  Check,
} from 'lucide-react';
import {
  SiteNav,
  SiteFooter,
  AmbientField,
  LandingPrimaryButton,
} from '@/pages/landing-page';

export function FeaturesPage() {
  const navigate = useNavigate();
  const goImport = () => navigate('/app', { state: { openImport: true } });

  const featureGroups = [
    {
      category: 'Canvas & Layout',
      headline: 'Pixel-Level Visual Control',
      summary:
        'A full-fledged visual workspace designed specifically for contemporary web layouts—supporting flexbox, CSS grid, and responsive flows.',
      features: [
        {
          icon: MousePointer2,
          name: 'Direct Point & Click Selection',
          description:
            'Hover to highlight any DOM element. Click to inspect, move, or modify its visual attributes instantly.',
        },
        {
          icon: Layers,
          name: 'Structural Drag & Drop Reordering',
          description:
            'Reorder list items, swap hero columns, and nest cards with fluid drop indicators and instant tree indexing.',
        },
        {
          icon: Sliders,
          name: 'Visual Box Model Controls',
          description:
            'Adjust margins, padding, gap, alignment, border width, and border radii with intuitive sliders and stepper inputs.',
        },
        {
          icon: MonitorSmartphone,
          name: 'Responsive Breakpoint Overrides',
          description:
            'Design mobile-first with confidence. Preview on Desktop (1280px), Tablet (768px), and Mobile (375px) with dedicated overrides.',
        },
      ],
    },
    {
      category: 'Code & Architecture',
      headline: 'Bi-Directional Code Parity',
      summary:
        'Reframely never traps your design inside an opaque binary blob. What you see on canvas is rendered by real React JSX and Tailwind CSS.',
      features: [
        {
          icon: FileCode2,
          name: 'Built-in Monaco Code Editor',
          description:
            'The same editor engine powering VS Code right in your browser. Inspect and hand-craft code whenever you prefer.',
        },
        {
          icon: Code2,
          name: 'Real-Time Bi-Directional Synchronization',
          description:
            'Change a CSS class in the code editor, and the canvas instantly re-renders. Drag an element on canvas, and the JSX updates in sync.',
        },
        {
          icon: ShieldCheck,
          name: 'Clean, Readable AST Generation',
          description:
            'No bloated wrapper divs or arbitrary CSS hashes. Export clean, semantic, accessible code your development team will celebrate.',
        },
        {
          icon: Rocket,
          name: 'Zero Vendor Lock-In',
          description:
            'Export your project as a standard Vite + React project that builds and deploys anywhere without special runtime libraries.',
        },
      ],
    },
    {
      category: 'Design Systems & Tokens',
      headline: 'Tokens, Themes & Typography',
      summary:
        'Enforce consistent visual rhythms across every page with central design tokens for colors, type scales, and radii.',
      features: [
        {
          icon: Palette,
          name: 'Global Color Palette Switcher',
          description:
            'Swap accent colors or complete color themes with a single click. Every referenced token cascades harmoniously across the canvas.',
        },
        {
          icon: Sparkles,
          name: 'Dark & Light Mode Support',
          description:
            'Native dark mode toggling with zero light/dark paint flash. Verify your design in both colorways with one click.',
        },
        {
          icon: Crop,
          name: 'Integrated Asset Cropping',
          description:
            'Crop, zoom, and adjust aspect ratios (16:9, 4:3, 1:1) directly on the canvas without firing up external image editors.',
        },
        {
          icon: History,
          name: 'Autosave & Version Timeline',
          description:
            'Every modification is tracked in your local version history. Revert back to any previous state whenever you experiment.',
        },
      ],
    },
  ];

  return (
    <div className="landing-mesh relative min-h-screen overflow-x-hidden bg-canvas text-foreground">
      <AmbientField />
      <SiteNav onCta={goImport} />

      <main className="relative z-10 mx-auto max-w-6xl px-5 py-16 sm:px-8">
        {/* Hero */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1 text-xs font-medium text-accent">
            Comprehensive Toolset
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Features Built for Fast, Precise Web Creation
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-foreground-muted sm:text-lg">
            Everything you need to transform rough AI prototypes into production-grade,
            polished web applications—without wasting time or credits.
          </p>
        </div>

        {/* Feature Groups */}
        <div className="mt-20 space-y-24">
          {featureGroups.map((group) => (
            <section key={group.category} className="space-y-8">
              <div className="border-b border-border/80 pb-5">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
                  {group.category}
                </span>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {group.headline}
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-foreground-muted sm:text-base">
                  {group.summary}
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {group.features.map((feat) => {
                  const Icon = feat.icon;
                  return (
                    <div
                      key={feat.name}
                      className="group flex flex-col justify-between rounded-xl border border-border bg-surface/70 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/50 hover:shadow-md"
                    >
                      <div>
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h3 className="mt-4 text-base font-semibold text-foreground">
                          {feat.name}
                        </h3>
                        <p className="mt-2 text-xs leading-relaxed text-foreground-muted sm:text-sm">
                          {feat.description}
                        </p>
                      </div>
                      <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                        <Check className="h-3.5 w-3.5" /> Included
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Comparison table */}
        <div className="mt-24 rounded-2xl border border-border bg-surface/80 p-8 shadow-sm">
          <h3 className="text-xl font-bold text-foreground sm:text-2xl">
            Why Reframely vs. Pure AI Re-Prompting?
          </h3>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-foreground-muted">
                  <th className="pb-3 font-semibold">Workflow Dimension</th>
                  <th className="pb-3 font-semibold text-foreground">Reframely</th>
                  <th className="pb-3 font-semibold text-foreground-muted">Chatbot Re-Prompting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs sm:text-sm">
                <tr>
                  <td className="py-3.5 font-medium text-foreground">Cost per layout tweak</td>
                  <td className="py-3.5 text-emerald-500 font-semibold">$0.00 (Unlimited visual editing)</td>
                  <td className="py-3.5 text-danger">Burns credits every prompt</td>
                </tr>
                <tr>
                  <td className="py-3.5 font-medium text-foreground">Feedback latency</td>
                  <td className="py-3.5 text-emerald-500 font-semibold">0ms (Instant tactile changes)</td>
                  <td className="py-3.5 text-foreground-muted">30–60 seconds per response</td>
                </tr>
                <tr>
                  <td className="py-3.5 font-medium text-foreground">Layout predictability</td>
                  <td className="py-3.5 text-emerald-500 font-semibold">100% deterministic & controlled</td>
                  <td className="py-3.5 text-foreground-muted">Frequent regressions & surprises</td>
                </tr>
                <tr>
                  <td className="py-3.5 font-medium text-foreground">Code cleanliness</td>
                  <td className="py-3.5 text-emerald-500 font-semibold">Clean, idiomatic React + Tailwind</td>
                  <td className="py-3.5 text-foreground-muted">Duplicated classes & messy markup</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Take control of your web designs today
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-foreground-muted">
            Launch Reframely and experience the visual editor built for modern builders.
          </p>
          <div className="mt-6 flex justify-center">
            <LandingPrimaryButton size="lg" onClick={goImport}>
              Start editing visually <ArrowRight className="h-4 w-4" />
            </LandingPrimaryButton>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
