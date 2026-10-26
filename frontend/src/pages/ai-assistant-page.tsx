import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Bot,
  Zap,
  CheckCircle,
  Eye,
  Flame,
  ArrowRight,
  Layers,
  Wand2,
} from 'lucide-react';
import {
  SiteNav,
  SiteFooter,
  AmbientField,
  LandingPrimaryButton,
} from '@/pages/landing-page';

export function AiAssistantPage() {
  const navigate = useNavigate();
  const goImport = () => navigate('/app', { state: { openImport: true } });

  const capabilities = [
    {
      title: 'Contextual Layout Reframing',
      desc: 'Instead of hallucinating an entirely new page, the assistant reads your active widget tree and offers precise suggestions for spacing, alignment, and visual hierarchy.',
      icon: Layers,
    },
    {
      title: 'Preview-Before-Apply Diffing',
      desc: 'Never accept a suggestion blindly. Every proposal comes with a live visual preview on your canvas. Accept what you love, dismiss what you don’t.',
      icon: Eye,
    },
    {
      title: 'Color & Contrast Harmony',
      desc: 'Automatically scans your typography and background colors against WCAG AA/AAA standards and proposes accessible, aesthetically balanced token adjustments.',
      icon: Wand2,
    },
    {
      title: 'Token-Conserving Philosophy',
      desc: 'Built specifically to curb token expenditure. Use AI for creative leverage, then tune details visually for zero token cost.',
      icon: Zap,
    },
  ];

  const comparisons = [
    {
      scenario: 'Nudging a button 10px',
      traditional: 'Costs ~800 tokens, takes 40s, might break sidebar layout.',
      reframely: '0 tokens. 0 seconds. Click and drag or tap the slider.',
    },
    {
      scenario: 'Fixing mobile responsive layout',
      traditional: 'Write complex prompts explaining viewport queries.',
      reframely: 'Toggle mobile preview; assistant highlights cramped containers.',
    },
    {
      scenario: 'Updating brand colors',
      traditional: 'Hope the AI remembers hex codes across all components.',
      reframely: 'Swap the primary color token; all bound elements update instantly.',
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
            <Sparkles className="h-3.5 w-3.5" /> Next-Gen Assistant
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            The AI Assistant That Enhances, Never Destroys
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-foreground-muted sm:text-lg">
            Stop burning precious tokens on endless trial-and-error re-prompts.
            Reframely pairs surgical agentic recommendations with direct visual manipulation.
          </p>
        </div>

        {/* Hero Interactive Mock */}
        <div className="mt-14 overflow-hidden rounded-2xl border border-border bg-surface/80 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-border/80 bg-surface-sunken/60 px-5 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-accent" />
              <span className="text-xs font-semibold text-foreground">Reframely Assistant Inspector</span>
            </div>
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
              Active Context: Hero Section
            </span>
          </div>

          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-2">
            <div className="space-y-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                Observed Opportunity
              </span>
              <h3 className="text-lg font-bold text-foreground sm:text-xl">
                Increase Hero Conversion Contrast
              </h3>
              <p className="text-xs leading-relaxed text-foreground-muted sm:text-sm">
                The primary call-to-action is currently competing with secondary badges for visual dominance.
                Proposing a 4px increase in vertical button padding and a high-contrast accent token.
              </p>

              <div className="rounded-lg border border-border bg-surface-sunken p-3.5 text-xs">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Proposed Tokens:
                </div>
                <div className="mt-2 space-y-1 font-mono text-[11px] text-foreground-muted">
                  <div>btn-padding: py-3.5 px-6</div>
                  <div>color-accent: bg-accent text-accent-foreground</div>
                  <div>box-shadow: shadow-glow</div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <LandingPrimaryButton size="sm">
                  Apply Proposal
                </LandingPrimaryButton>
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground-muted hover:bg-surface-sunken"
                >
                  Dismiss
                </button>
              </div>
            </div>

            <div className="flex flex-col justify-center rounded-xl border border-dashed border-accent/40 bg-accent/5 p-6 text-center">
              <span className="text-xs font-mono text-accent">Canvas Visual Diff</span>
              <div className="mt-4 rounded-lg border border-border bg-surface p-4 shadow-sm">
                <div className="h-3 w-2/3 rounded bg-foreground-muted/20 mx-auto" />
                <div className="mt-2 h-2 w-1/2 rounded bg-foreground-muted/15 mx-auto" />
                <div className="mt-4 inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground shadow-sm">
                  Sign Up Free →
                </div>
              </div>
              <span className="mt-3 text-[11px] text-foreground-muted">
                Preview reflects live state with proposed tokens injected.
              </span>
            </div>
          </div>
        </div>

        {/* Core Pillars */}
        <div className="mt-20">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Surgical AI Architecture
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {capabilities.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.title}
                  className="rounded-xl border border-border bg-surface/70 p-6 backdrop-blur-sm"
                >
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    {c.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                    {c.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Token Exhaustion Breakdown */}
        <div className="mt-20 rounded-2xl border border-border bg-surface/80 p-8">
          <div className="flex items-center gap-2 text-danger">
            <Flame className="h-5 w-5" />
            <h3 className="text-xl font-bold text-foreground">
              Say Goodbye to the Re-Prompting Death Spiral
            </h3>
          </div>
          <p className="mt-2 text-sm text-foreground-muted">
            Here is what happens when you try to fine-tune an AI-generated site via chatbot prompts alone:
          </p>

          <div className="mt-8 space-y-4">
            {comparisons.map((item, idx) => (
              <div
                key={idx}
                className="grid gap-3 rounded-lg border border-border/80 bg-surface-sunken/60 p-4 sm:grid-cols-3"
              >
                <div className="font-semibold text-sm text-foreground">
                  {item.scenario}
                </div>
                <div className="text-xs text-danger/90 leading-relaxed sm:text-sm">
                  <span className="font-semibold text-danger">Chatbot: </span>
                  {item.traditional}
                </div>
                <div className="text-xs text-emerald-500 font-medium leading-relaxed sm:text-sm">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Reframely: </span>
                  {item.reframely}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Experience smarter site reframing
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-foreground-muted">
            Save hours and keep your tokens where they belong—on major creative leaps.
          </p>
          <div className="mt-6 flex justify-center">
            <LandingPrimaryButton size="lg" onClick={goImport}>
              Try Reframely now <ArrowRight className="h-4 w-4" />
            </LandingPrimaryButton>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
