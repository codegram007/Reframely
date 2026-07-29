import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Code2,
  Download,
  GripVertical,
  Layers,
  MessageSquare,
  MonitorSmartphone,
  MousePointer2,
  Rocket,
  Sparkles,
  Upload,
  ChevronDown,
} from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/brand/theme-toggle';
import { cn } from '@/lib/utils';

/**
 * Marketing landing page for Vibestudio.
 *
 * Positioning: vibe coders, marketers, founders, freelancers, and business
 * owners who generate sites with AI — then polish them visually instead of
 * burning credits on endless re-prompts. Stock photos use Unsplash (free
 * license for commercial use); see STOCK constant.
 */

/** Unsplash images — free to use under the Unsplash License. */
const STOCK = {
  desk: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1400&q=80',
  collab: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
  laptop: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
  creative: 'https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1200&q=80',
  studio: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=1200&q=80',
} as const;
export function LandingPage() {
  const navigate = useNavigate();
  const goImport = () => navigate('/app', { state: { openImport: true } });

  return (
    <div className="landing-mesh relative min-h-screen overflow-x-hidden bg-canvas text-foreground">
      <AmbientField />
      <SiteNav onCta={goImport} />
      <main className="relative z-10">
        <Hero onCta={goImport} />
        <SocialProof />
        <HowItWorks />
        <Features />
        <AiSection onCta={goImport} />
        <Faq />
        <FinalCta onCta={goImport} />
      </main>
      <SiteFooter />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Ambient world layer                                                          */
/* -------------------------------------------------------------------------- */

function AmbientField() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="absolute -left-[12%] top-[-8%] h-[48vmin] w-[48vmin] animate-orb-drift-a rounded-full bg-accent/20 blur-[90px] dark:bg-accent/25" />
      <div className="absolute -right-[8%] top-[18%] h-[42vmin] w-[42vmin] animate-orb-drift-b rounded-full bg-accent/12 blur-[100px] dark:bg-accent/18" />
      <div className="absolute bottom-[-10%] left-[28%] h-[36vmin] w-[50vmin] animate-orb-drift-a rounded-full bg-accent/10 blur-[110px] [animation-delay:-6s] dark:bg-accent/14" />
      {/* Fine grain — barely there, reads as physical surface */}
      <div
        className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Landing CTAs (animated; theme-aware via CSS utilities)                       */
/* -------------------------------------------------------------------------- */

function LandingPrimaryButton({
  children,
  onClick,
  className,
  size = 'md',
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'landing-btn-primary inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-accent font-medium text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'md' && 'h-9 px-4 text-sm',
        size === 'lg' && 'h-11 px-6 text-sm',
        className,
      )}
    >
      <span className="relative z-[2] inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

function LandingGhostLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        'landing-btn-ghost inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium text-foreground-muted',
        className,
      )}
    >
      {children}
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/* Nav / footer                                                                 */
/* -------------------------------------------------------------------------- */

function SiteNav({ onCta }: { onCta: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-[background,border-color,box-shadow] duration-300',
        scrolled
          ? 'border-border/90 bg-canvas/70 shadow-sm backdrop-blur-xl dark:bg-canvas/75'
          : 'border-transparent bg-transparent backdrop-blur-0',
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="shrink-0 transition-transform duration-300 hover:scale-[1.02]" aria-label="Vibestudio home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-foreground-muted md:flex">
          {[
            ['#how', 'How it works'],
            ['#features', 'Features'],
            ['#ai', 'AI assistant'],
            ['#faq', 'FAQ'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="relative transition-colors hover:text-foreground after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-accent after:transition-transform after:duration-300 hover:after:scale-x-100"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/app"
            className="landing-btn-ghost hidden text-sm font-medium text-foreground-muted sm:inline-flex sm:h-9 sm:items-center sm:px-2"
          >
            Sign in
          </Link>
          <LandingPrimaryButton size="sm" onClick={onCta}>
            Import AI site
          </LandingPrimaryButton>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-border/80 bg-surface/50 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Logo />
        <p className="text-xs text-foreground-subtle">
          Edit AI-built sites visually — keep your credits for the big ideas.
        </p>
        <div className="flex gap-4 text-xs text-foreground-muted">
          <Link to="/app" className="transition-colors hover:text-foreground">
            Open app
          </Link>
          <a href="#faq" className="transition-colors hover:text-foreground">
            FAQ
          </a>
        </div>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Hero                                                                      */
/* -------------------------------------------------------------------------- */

function Hero({ onCta }: { onCta: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState({ x: 50, y: 40 });

  const onMove = (e: MouseEvent<HTMLElement>) => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSpot({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  };

  return (
    <section
      ref={stageRef}
      onMouseMove={onMove}
      className="relative overflow-hidden border-b border-border/70"
    >
      {/* Interactive light following cursor — soft, physical */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-500 dark:opacity-90"
        style={
          {
            background: `radial-gradient(520px circle at ${spot.x}% ${spot.y}%, hsl(var(--accent) / 0.16), transparent 55%)`,
          } as CSSProperties
        }
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 animate-orb-drift-a rounded-full bg-accent/20 blur-3xl dark:bg-accent/28"
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-10 lg:pt-20">
        <div className="animate-scale-in">
          <p className="landing-glass mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-2xs font-medium text-foreground-muted">
            <Sparkles className="h-3 w-3 animate-pulse-soft text-accent" />
            Built for vibe coders · marketers · founders · freelancers
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
            Stop burning AI credits to fix a site that already looks good.
            <span className="mt-1 block bg-gradient-to-r from-accent via-[hsl(268_88%_62%)] to-accent bg-clip-text text-transparent dark:from-[hsl(250_95%_78%)] dark:via-accent dark:to-[hsl(268_90%_70%)]">
              Import it. Style it yourself. Save ~80%.
            </span>
          </h1>
          <p className="mt-5 max-w-lg text-balance text-md text-foreground-muted sm:text-lg">
            You generated a beautiful site with AI — then spent the rest of your
            tokens re-prompting for every color, spacing, and copy tweak.
            Vibestudio imports that site into a full visual editor so you keep
            total control without another chat marathon.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <LandingPrimaryButton size="lg" onClick={onCta}>
              Import your AI site free
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </LandingPrimaryButton>
            <LandingGhostLink href="#how">See how credits stay yours</LandingGhostLink>
          </div>
          <p className="mt-4 text-xs text-foreground-subtle">
            Cut ~80% of edit prompts · Zip, GitHub, or URL · Full visual + code control
          </p>
        </div>

        <div className="animate-scale-in [animation-delay:140ms] lg:justify-self-end">
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}

function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-lg animate-hero-float lg:max-w-none">
      <div
        aria-hidden
        className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-accent/30 via-accent/5 to-accent/20 blur-2xl animate-border-glow dark:from-accent/40 dark:via-accent/10 dark:to-accent/25"
      />
      {/* Soft stock backdrop — Unsplash, free license */}
      <div className="pointer-events-none absolute -right-6 -top-8 z-0 hidden h-28 w-40 overflow-hidden rounded-xl opacity-40 shadow-md sm:block lg:-right-10 lg:h-32 lg:w-44">
        <StockImg src={STOCK.desk} alt="" className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-br from-canvas via-transparent to-accent/20" />
      </div>
      <div className="landing-glass relative z-[1] overflow-hidden rounded-xl shadow-lg">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent" />
        <div className="flex items-center gap-2 border-b border-border/80 bg-surface-sunken/80 px-3 py-2 backdrop-blur-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/80" />
          <span className="ml-2 flex-1 truncate rounded-md bg-surface/80 px-2 py-0.5 text-2xs text-foreground-subtle backdrop-blur">
            vibestudio · imported / pricing.html
          </span>
        </div>

        <div className="grid grid-cols-[48px_1fr] sm:grid-cols-[120px_1fr_100px]">
          <div className="hidden border-r border-border/80 bg-surface-sunken/60 p-2 backdrop-blur-sm sm:block">
            <p className="mb-2 px-1 text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
              Layers
            </p>
            {['Hero', 'Pricing', 'Footer'].map((label, i) => (
              <div
                key={label}
                className={cn(
                  'mb-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-2xs transition-colors',
                  i === 0
                    ? 'bg-accent-subtle text-accent shadow-xs'
                    : 'text-foreground-muted',
                )}
              >
                <Layers className="h-3 w-3 shrink-0 opacity-70" />
                {label}
              </div>
            ))}
          </div>

          <div className="relative bg-dotgrid p-3 sm:p-4">
            <div className="relative overflow-hidden rounded-md border border-border/90 bg-white/90 shadow-sm backdrop-blur-sm dark:bg-surface-raised/90">
              <div className="border-b border-dashed border-border-strong bg-surface-sunken/80 px-3 py-1.5 text-2xs text-foreground-subtle">
                Imported · 14 widgets · 0 rebuilds
              </div>
              <div className="space-y-2 p-3">
                <div className="relative rounded-md border-2 border-accent bg-accent-subtle/50 p-3 shadow-glow">
                  <span className="absolute -top-2 left-2 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground shadow-sm">
                    Section · Hero
                  </span>
                  <div className="h-2.5 w-2/3 rounded-sm bg-foreground/80" />
                  <div className="mt-2 h-2 w-full rounded-sm bg-foreground/20" />
                  <div className="mt-1 h-2 w-4/5 rounded-sm bg-foreground/20" />
                  <div className="mt-3 inline-flex h-6 items-center rounded bg-accent px-2 text-[10px] font-medium text-accent-foreground">
                    Get started
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 animate-float-y items-center justify-center rounded-sm border border-accent bg-surface text-accent shadow-sm">
                    <MousePointer2 className="h-2.5 w-2.5" />
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 opacity-70">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="rounded border border-border/80 bg-surface/50 p-2 backdrop-blur-sm"
                    >
                      <div className="h-1.5 w-1/2 rounded-sm bg-foreground/30" />
                      <div className="mt-1.5 h-1 w-full rounded-sm bg-foreground/10" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="landing-glass absolute bottom-5 right-4 flex max-w-[168px] animate-float-y items-start gap-1.5 rounded-lg p-2 sm:right-6 [animation-delay:-1.2s]">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 animate-pulse-soft text-accent" />
              <p className="text-[10px] leading-snug text-foreground-muted">
                Skip 12 re-prompts — drag the accent once
              </p>
            </div>
          </div>

          <div className="hidden border-l border-border/80 bg-surface/70 p-2 backdrop-blur-sm sm:block">
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
              Style
            </p>
            <div className="space-y-2">
              <div>
                <p className="text-[10px] text-foreground-subtle">Fill</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="h-4 w-4 rounded border border-border bg-accent shadow-[0_0_12px_hsl(var(--accent)/0.45)]" />
                  <span className="text-2xs text-foreground-muted">Accent</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-foreground-subtle">Padding</p>
                <div className="mt-0.5 h-5 rounded border border-border bg-surface-sunken/80" />
              </div>
              <div className="flex gap-1 pt-1">
                {['D', 'T', 'M'].map((bp, i) => (
                  <span
                    key={bp}
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded text-[10px] font-medium',
                      i === 0
                        ? 'bg-accent text-accent-foreground shadow-sm'
                        : 'bg-surface-sunken text-foreground-subtle',
                    )}
                  >
                    {bp}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-2xs text-foreground-subtle sm:text-left">
        Your AI export, now a real canvas — edit free of the chat box.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Social proof                                                              */
/* -------------------------------------------------------------------------- */

function SocialProof() {
  const slots = [
    { id: 's1', label: 'Logo slot' },
    { id: 's2', label: 'Logo slot' },
    { id: 's3', label: 'Logo slot' },
    { id: 's4', label: 'Logo slot' },
    { id: 's5', label: 'Logo slot' },
  ];
  return (
    <section className="relative border-b border-border/70 py-12">
      <Reveal>
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="text-center text-xs font-medium uppercase tracking-wider text-foreground-subtle">
            For vibe coders, marketers, business owners, freelancers &amp; entrepreneurs
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-5">
            {slots.map((s, i) => (
              <div
                key={s.id}
                className="landing-glass landing-glass-hover flex h-11 min-w-[108px] items-center justify-center rounded-lg px-4 text-2xs text-foreground-subtle"
                style={{ animationDelay: `${i * 80}ms` }}
                data-logo-slot={s.id}
              >
                {s.label}
              </div>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                k: 'stat-credits',
                v: '~80%',
                d: 'Fewer AI edit prompts — polish in the canvas, not the chat',
              },
              {
                k: 'stat-control',
                v: '100%',
                d: 'Visual control over layout, type, color & breakpoints',
              },
              {
                k: 'stat-export',
                v: '0',
                d: 'Framework lock-in — export clean HTML/CSS anytime',
              },
            ].map((stat) => (
              <div
                key={stat.k}
                data-stat-slot={stat.k}
                className="landing-glass landing-glass-hover rounded-xl px-4 py-4 text-center"
              >
                <p className="text-xl font-semibold tracking-tight text-accent">{stat.v}</p>
                <p className="mt-0.5 text-2xs text-foreground-subtle">{stat.d}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. How it works                                                              */
/* -------------------------------------------------------------------------- */

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Import the site AI already made',
      body: 'Zip from v0, Lovable, Cursor, or any static export — or paste a live URL. One import beats another 40 chat turns.',
      icon: Upload,
      image: STOCK.laptop,
      visual: (
        <div className="flex h-full flex-col justify-center gap-2 p-4">
          {['ai-export.zip', 'github.com/you/landing', 'mysite.vercel.app'].map((t) => (
            <div
              key={t}
              className="landing-glass flex items-center gap-2 rounded-md px-3 py-2 text-xs text-foreground-muted"
            >
              <Upload className="h-3.5 w-3.5 text-accent" />
              {t}
            </div>
          ))}
        </div>
      ),
    },
    {
      n: '02',
      title: 'Edit by hand — keep tokens for ideas',
      body: 'Colors, spacing, copy, mobile order: drag and style it yourself. Save the ~80% of prompts that were only “make the button bigger.”',
      icon: GripVertical,
      image: STOCK.studio,
      visual: (
        <div className="relative flex h-full items-center justify-center p-4">
          <div className="w-full rounded-md border-2 border-accent/80 bg-accent-subtle/40 p-3 shadow-glow backdrop-blur-sm">
            <div className="h-2 w-1/2 rounded bg-foreground/70" />
            <div className="mt-2 h-2 w-full rounded bg-foreground/15" />
            <div className="mt-3 h-7 w-20 rounded bg-accent shadow-[0_0_20px_hsl(var(--accent)/0.4)]" />
          </div>
          <span className="absolute right-6 top-6 animate-pulse-soft rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground shadow-sm">
            selected
          </span>
        </div>
      ),
    },
    {
      n: '03',
      title: 'Ship — or export and walk away',
      body: 'Preview for clients, or download clean HTML/CSS. Full power over how it looks; zero dependency on another AI quota.',
      icon: Rocket,
      image: STOCK.creative,
      visual: (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
          <div className="landing-glass rounded-lg px-4 py-3 text-center">
            <p className="text-2xs text-foreground-subtle">preview.vibestudio.app</p>
            <p className="mt-1 text-xs font-medium text-success">Live</p>
          </div>
          <div className="flex items-center gap-2 text-2xs text-foreground-muted">
            <Download className="h-3.5 w-3.5" /> export.zip
          </div>
        </div>
      ),
    },
  ];

  return (
    <section id="how" className="relative border-b border-border/70 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="From “one more prompt…” to “I just fixed it”"
            subtitle="AI is great at the first draft. Vibestudio is for everything after — without emptying your credit balance."
          />
        </Reveal>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {steps.map((step, i) => (
            <Reveal key={step.n} delayMs={i * 90}>
              <article className="landing-glass landing-glass-hover group flex h-full flex-col overflow-hidden rounded-2xl">
                <div className="relative min-h-[148px] overflow-hidden border-b border-border/70 bg-surface-sunken/40">
                  <StockImg
                    src={step.image}
                    alt=""
                    className="absolute inset-0 h-full w-full opacity-30 transition-opacity duration-500 group-hover:opacity-45 dark:opacity-25 dark:group-hover:opacity-40"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/70 to-surface/20 dark:from-surface dark:via-surface/80" />
                  <div className="relative">{step.visual}</div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="font-mono text-2xs font-medium text-accent">{step.n}</span>
                    <step.icon className="h-4 w-4 text-foreground-subtle transition-colors group-hover:text-accent" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{step.body}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Features                                                                  */
/* -------------------------------------------------------------------------- */

function Features() {
  const cards = [
    {
      icon: MousePointer2,
      title: 'Fix the layout without another prompt',
      body: 'Drag sections, rows, and widgets yourself. That alone replaces a dozen “move this up” messages.',
    },
    {
      icon: MonitorSmartphone,
      title: 'Own every breakpoint',
      body: 'Tune desktop, tablet, and mobile styles (and order) so mobile stacking doesn’t cost three more generations.',
    },
    {
      icon: Code2,
      title: 'Code when you want it — not when you’re forced',
      body: 'Open live HTML/CSS for surgical tweaks. Stay in control without living in the model chat.',
    },
    {
      icon: Sparkles,
      title: 'Use AI sparingly — where it still wins',
      body: 'Optional assistant for big moves (rebrand, new section) with preview-before-apply. Small polish stays free of tokens.',
    },
    {
      icon: Rocket,
      title: 'Share a preview, keep iterating',
      body: 'Send clients or co-founders a live look while you keep editing — no re-export loop from the AI tool.',
    },
    {
      icon: Download,
      title: 'Export and keep the files',
      body: 'Clean HTML/CSS zip. No lock-in. Your site isn’t trapped behind a chat history.',
    },
  ];

  return (
    <section id="features" className="relative border-b border-border/70 py-20 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent"
      />
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Why Vibestudio"
            title="Full creative power. Far fewer wasted credits."
            subtitle="You already paid for a great first draft. Don’t spend the rest of your quota nudging pixels in chat."
          />
        </Reveal>
        <Reveal delayMs={60}>
          <div className="relative mt-10 overflow-hidden rounded-2xl border border-border/80 shadow-md">
            <StockImg
              src={STOCK.collab}
              alt="Team collaborating on a laptop — freelancers and founders shipping sites"
              className="h-44 w-full sm:h-52"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/75 to-transparent dark:from-canvas dark:via-canvas/85" />
            <div className="absolute inset-y-0 left-0 flex max-w-md flex-col justify-center p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                Credit math
              </p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                Visual edits cost $0 in model tokens.
              </p>
              <p className="mt-2 text-sm text-foreground-muted">
                Re-prompting for every margin and headline is how credits disappear.
                Import once, then style freely.
              </p>
            </div>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c, i) => (
            <Reveal key={c.title} delayMs={i * 55}>
              <article className="landing-glass landing-glass-hover group h-full rounded-2xl p-5">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-subtle text-accent shadow-xs transition-transform duration-500 ease-out-expo group-hover:scale-110 group-hover:shadow-[0_0_24px_hsl(var(--accent)/0.35)]">
                  <c.icon className="h-4 w-4" />
                </div>
                <h3 className="text-md font-semibold tracking-tight text-foreground">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{c.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. AI assistant                                                              */
/* -------------------------------------------------------------------------- */

function AiSection({ onCta }: { onCta: () => void }) {
  return (
    <section id="ai" className="relative border-b border-border/70 py-20 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[50vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-[100px] dark:bg-accent/15"
      />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="AI when it matters"
            title="Save prompts for the big swings — not button padding"
            subtitle="Most day-to-day polish is free in the canvas. When you do want AI, use it once, preview the patch, then Accept — instead of a 15-message thread."
          />
        </Reveal>

        <Reveal delayMs={100}>
          <div className="mt-12 grid items-stretch gap-5 lg:grid-cols-2">
            <div className="landing-glass flex flex-col overflow-hidden rounded-2xl">
              <div className="flex items-center gap-2 border-b border-border/80 px-4 py-3 backdrop-blur-sm">
                <Sparkles className="h-4 w-4 animate-pulse-soft text-accent" />
                <span className="text-sm font-medium text-foreground">Assistant</span>
                <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-2xs font-medium text-accent">
                  Optional · preview first
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <ChatBubble role="user">
                  Rebrand: electric violet accent everywhere, and a sharper hero line for founders
                  who built this with AI.
                </ChatBubble>
                <ChatBubble role="assistant">
                  One patch: global accent token + hero headline. Preview on the canvas, then Accept
                  — one undo step. No 20-turn chat tax.
                </ChatBubble>
                <div className="rounded-xl border border-accent/35 bg-accent-subtle/40 p-3 backdrop-blur-sm dark:bg-accent-subtle/30">
                  <p className="text-2xs font-semibold uppercase tracking-wide text-accent">
                    Pending patch · 1 prompt
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-foreground-muted">
                    <li>· set_color_token · color-accent → #6d5efc</li>
                    <li>· update_props · hero-heading · content</li>
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <span className="rounded-md bg-accent px-2.5 py-1 text-2xs font-medium text-accent-foreground shadow-[0_0_16px_hsl(var(--accent)/0.4)]">
                      Accept
                    </span>
                    <span className="rounded-md border border-border bg-surface/80 px-2.5 py-1 text-2xs text-foreground-muted backdrop-blur">
                      Reject
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <BeforeAfter
                label="Re-prompt loop"
                accentClass="bg-sky-500"
                headline="Welcome to our platform"
                caption="Credits burning on tiny tweaks"
              />
              <BeforeAfter
                label="After Vibestudio"
                accentClass="bg-accent"
                headline="Ship the site you already started"
                highlight
                caption="Visual control · credits left for ideas"
              />
            </div>
          </div>
        </Reveal>

        <div className="mt-10 flex justify-center">
          <LandingPrimaryButton size="lg" onClick={onCta}>
            Import your AI site free
            <ArrowRight className="h-4 w-4" />
          </LandingPrimaryButton>
        </div>
      </div>
    </section>
  );
}

function ChatBubble({
  role,
  children,
}: {
  role: 'user' | 'assistant';
  children: ReactNode;
}) {
  const user = role === 'user';
  return (
    <div
      className={cn(
        'max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed shadow-xs',
        user
          ? 'ml-auto bg-accent text-accent-foreground shadow-[0_8px_24px_-8px_hsl(var(--accent)/0.5)]'
          : 'mr-auto border border-border/80 bg-surface-sunken/80 text-foreground-muted backdrop-blur-sm',
      )}
    >
      {children}
    </div>
  );
}

function BeforeAfter({
  label,
  accentClass,
  headline,
  highlight,
  caption,
}: {
  label: string;
  accentClass: string;
  headline: string;
  highlight?: boolean;
  caption?: string;
}) {
  return (
    <div
      className={cn(
        'landing-glass overflow-hidden rounded-2xl',
        highlight && 'ring-1 ring-accent/40 shadow-glow',
      )}
    >
      <div className="border-b border-border/80 px-3 py-1.5 text-2xs font-medium uppercase tracking-wide text-foreground-subtle">
        {label}
      </div>
      <div className="p-4">
        <div className="rounded-lg border border-border/80 bg-surface/60 p-3 backdrop-blur-sm">
          <p className="text-sm font-semibold tracking-tight text-foreground">{headline}</p>
          <p className="mt-1 text-2xs text-foreground-muted">
            {caption ?? 'Short supporting line of body copy.'}
          </p>
          <div
            className={cn(
              'mt-3 inline-block h-7 rounded px-3 text-2xs font-medium leading-7 text-white',
              accentClass,
              highlight && 'shadow-[0_0_20px_hsl(var(--accent)/0.45)]',
            )}
          >
            Primary button
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. FAQ                                                                       */
/* -------------------------------------------------------------------------- */

function Faq() {
  const items = [
    {
      q: 'Will this really save ~80% of my AI credits?',
      a: 'Most post-generation work is micro-edits — colors, spacing, copy, mobile order — that people burn tokens re-prompting. Vibestudio moves those into a free visual canvas. You still can use AI for bigger changes, but you don’t need a chat for every pixel. Results vary by workflow; the 80% figure reflects typical polish loops after an AI first draft.',
    },
    {
      q: 'I built my site with an AI tool — will import work?',
      a: 'Yes for static and mostly-static exports (HTML/CSS/JS, common AI site builders, template kits, GitHub pages). Zip the output, connect a repo, or paste a live URL. Complex app shells may map partially; interactivity often preserves as custom HTML.',
    },
    {
      q: 'Do I need to know how to code?',
      a: 'No. Vibe coders, marketers, and founders edit by selecting, dragging, and styling. Code view is optional for power users who want a scalpel.',
    },
    {
      q: 'Does this change my live production site?',
      a: 'No. Import is a non-destructive snapshot into your Vibestudio project. Production stays put until you deliberately deploy or replace it with an export.',
    },
    {
      q: 'Can I export and leave anytime?',
      a: 'Yes. Download clean HTML/CSS with no proprietary runtime. Your site isn’t locked to our chat history or credits.',
    },
  ];

  return (
    <section id="faq" className="relative border-b border-border/70 py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="FAQ"
            title="For people who already used AI to build"
            subtitle="Credits, control, and what happens to the site you already generated."
            center
          />
        </Reveal>
        <div className="mt-10 space-y-2.5">
          {items.map((item, i) => (
            <Reveal key={item.q} delayMs={i * 45}>
              <FaqItem question={item.q} answer={item.a} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cn(
        'landing-glass overflow-hidden rounded-xl transition-[box-shadow,border-color] duration-300',
        open && 'border-accent/30 shadow-[0_0_0_1px_hsl(var(--accent)/0.12),0_12px_40px_-16px_hsl(var(--accent)/0.25)]',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/[0.03]"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-foreground">{question}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-foreground-subtle transition-transform duration-300 ease-out-expo',
            open && 'rotate-180 text-accent',
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out-expo',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/80 px-5 py-4 text-sm leading-relaxed text-foreground-muted">
            {answer}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. Final CTA                                                                 */
/* -------------------------------------------------------------------------- */

function FinalCta({ onCta }: { onCta: () => void }) {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      <StockImg
        src={STOCK.desk}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12] dark:opacity-[0.08]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-canvas via-canvas/90 to-canvas"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[40vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 animate-orb-drift-b rounded-full bg-accent/15 blur-[80px]"
      />
      <Reveal>
        <div className="landing-glass relative mx-auto max-w-2xl rounded-3xl px-6 py-12 text-center sm:px-10">
          <MessageSquare className="mx-auto h-8 w-8 text-accent drop-shadow-[0_0_16px_hsl(var(--accent)/0.45)]" />
          <h2 className="mt-4 text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Keep the AI site. Stop the re-prompt tax.
          </h2>
          <p className="mt-3 text-md text-foreground-muted">
            Import what you already generated. Polish it visually. Save about 80% of the credits
            you’d spend asking the model to nudge pixels — and still own every detail of how it
            looks.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LandingPrimaryButton size="lg" onClick={onCta}>
              Import your AI site free
              <ArrowRight className="h-4 w-4" />
            </LandingPrimaryButton>
            <Link
              to="/app"
              className="landing-btn-ghost text-sm font-medium text-foreground-muted"
            >
              Or open the app
            </Link>
          </div>
          <p className="mt-4 text-xs text-foreground-subtle">
            Free to import · No credit card · Full control · Export anytime
          </p>
        </div>
      </Reveal>
    </section>
  );
}

function StockImg({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={cn('object-cover', className)}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Shared                                                                       */
/* -------------------------------------------------------------------------- */

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  center?: boolean;
}) {
  return (
    <div className={cn(center && 'text-center')}>
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>
      <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      <p className={cn('mt-3 max-w-2xl text-md text-foreground-muted', center && 'mx-auto')}>
        {subtitle}
      </p>
    </div>
  );
}

function Reveal({
  children,
  delayMs = 0,
  className,
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -48px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        'transition-[opacity,transform,filter] duration-700 ease-out-expo will-change-[opacity,transform]',
        visible
          ? 'translate-y-0 scale-100 opacity-100 blur-0'
          : 'translate-y-6 scale-[0.98] opacity-0 blur-[2px]',
        className,
      )}
      style={{ transitionDelay: visible ? `${delayMs}ms` : undefined }}
    >
      {children}
    </div>
  );
}
