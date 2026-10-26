import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  ChevronDown,
  ArrowRight,
  Search,
} from 'lucide-react';
import {
  SiteNav,
  SiteFooter,
  AmbientField,
  LandingPrimaryButton,
} from '@/pages/landing-page';
import { cn } from '@/lib/utils';

export function FaqPage() {
  const navigate = useNavigate();
  const goImport = () => navigate('/app', { state: { openImport: true } });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const categories = [
    { id: 'all', name: 'All Questions' },
    { id: 'general', name: 'General & Concepts' },
    { id: 'import', name: 'Importing Sites' },
    { id: 'editor', name: 'Visual Editing' },
    { id: 'export', name: 'Export & Deploy' },
  ];

  const faqs = [
    {
      category: 'general',
      q: 'What is Reframely and who is it built for?',
      a: 'Reframely is a visual design and reframing tool built for vibe coders, developers, founders, and marketers who use AI tools (such as v0, bolt.new, Lovable, or Cursor) to build web applications. Rather than repeatedly re-prompting an AI for tiny CSS or layout tweaks, Reframely allows you to edit and restructure your sites directly on a live visual canvas without burning tokens.',
    },
    {
      category: 'general',
      q: 'Do I need to pay or spend AI credits to make visual edits?',
      a: 'No! Visual editing in Reframely is completely free, client-side, and unlimited. You can nudge padding, adjust margins, reorder sections, test responsive breakpoints, and change typography infinitely without spending a single token or penny.',
    },
    {
      category: 'import',
      q: 'What types of websites and files can I import?',
      a: 'Reframely supports three frictionless import methods: (1) Direct .zip upload of any static HTML/CSS/JS or Vite/React build, (2) Direct GitHub URL to any public repository, and (3) Live URL snapshotting, which runs a headless Chromium pass to capture rendered HTML, styles, and viewport layouts.',
    },
    {
      category: 'import',
      q: 'Will importing my site break my interactive JavaScript or React state?',
      a: 'Reframely parses your site into a clean Abstract Syntax Tree (AST) while preserving your underlying structure. Visual editing modifies the presentation layer and JSX structure. When you export, you receive idiomatic, clean React components without extraneous wrapper code.',
    },
    {
      category: 'editor',
      q: 'How does the bi-directional code sync work?',
      a: 'Reframely integrates a full Monaco editor (the core engine behind VS Code) directly into your workspace. When you change an element on the visual canvas, the JSX and Tailwind code updates automatically. Conversely, if you write code directly in the Monaco editor, the visual preview updates immediately.',
    },
    {
      category: 'editor',
      q: 'Can I design for mobile, tablet, and desktop independently?',
      a: 'Yes. Reframely features dedicated viewport modes for Mobile (375px), Tablet (768px), and Desktop (1280px). You can specify responsive overrides that respect Tailwind CSS mobile-first breakpoint rules without breaking your desktop view.',
    },
    {
      category: 'export',
      q: 'Is there any vendor lock-in when I export my project?',
      a: 'None at all. Your exported project is a standard Vite + React + Tailwind package with normal package.json scripts. You can run `npm install` and `npm run dev` on your own machine, push it to GitHub, or deploy it to Vercel, Netlify, Cloudflare Pages, or AWS.',
    },
    {
      category: 'export',
      q: 'Can I deploy my site directly to a live preview URL?',
      a: 'Yes. With one click from the editor, Reframely provisions a dedicated preview URL (e.g. on your preview domain) that you can immediately share with stakeholders, clients, or test on real mobile devices.',
    },
  ];

  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory =
      activeCategory === 'all' || faq.category === activeCategory;
    const matchesSearch =
      faq.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.a.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="landing-mesh relative min-h-screen overflow-x-hidden bg-canvas text-foreground">
      <AmbientField />
      <SiteNav onCta={goImport} />

      <main className="relative z-10 mx-auto max-w-4xl px-5 py-16 sm:px-8">
        {/* Header */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1 text-xs font-medium text-accent">
            <HelpCircle className="h-3.5 w-3.5" /> Answers & Guidance
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-foreground-muted sm:text-lg">
            Everything you need to know about importing, reframing, and deploying your websites with Reframely.
          </p>
        </div>

        {/* Search & Categories */}
        <div className="mt-12 space-y-5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
            <input
              type="text"
              placeholder="Search questions (e.g., tokens, import, deploy, pricing)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface/80 py-3 pl-10 pr-4 text-sm text-foreground shadow-xs outline-none transition-all placeholder:text-foreground-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(c.id)}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors',
                  activeCategory === c.id
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-surface-sunken text-foreground-muted hover:text-foreground',
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* FAQs Accordion */}
        <div className="mt-8 divide-y divide-border/60 rounded-2xl border border-border bg-surface/80 shadow-sm">
          {filteredFaqs.length === 0 ? (
            <div className="p-8 text-center text-sm text-foreground-muted">
              No matching questions found. Try a different search term.
            </div>
          ) : (
            filteredFaqs.map((faq, idx) => {
              const isOpen = expandedIndex === idx;
              return (
                <div key={idx} className="transition-colors">
                  <button
                    type="button"
                    onClick={() => setExpandedIndex(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-surface-sunken/40 sm:p-6"
                  >
                    <span className="text-base font-semibold text-foreground sm:text-lg">
                      {faq.q}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-5 w-5 shrink-0 text-foreground-muted transition-transform duration-200',
                        isOpen && 'rotate-180 text-accent',
                      )}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-6 pt-1 text-sm leading-relaxed text-foreground-muted sm:px-6 sm:text-base">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Support Callout */}
        <div className="mt-16 rounded-2xl border border-border bg-surface/70 p-8 text-center sm:p-10">
          <h3 className="text-xl font-bold text-foreground sm:text-2xl">
            Have a question not answered here?
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-foreground-muted">
            Launch Reframely and start exploring. You can import any site and test all features instantly.
          </p>
          <div className="mt-6 flex justify-center">
            <LandingPrimaryButton size="lg" onClick={goImport}>
              Open Reframely workspace <ArrowRight className="h-4 w-4" />
            </LandingPrimaryButton>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
