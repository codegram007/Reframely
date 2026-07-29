import { useMemo, useState } from 'react';
import {
  Star, Heart, Check, X, Plus, Minus, ArrowRight, ArrowLeft, ArrowUp, ArrowDown,
  ChevronRight, ChevronDown, Menu, Search, Home, User, Settings, Mail, Phone,
  MapPin, Calendar, Clock, Bell, Bookmark, Camera, Image, Video, Music, File,
  Folder, Download, Upload, Share2, Link, Lock, Unlock, Eye, Trash2, Edit, Copy,
  Zap, Award, Gift, ShoppingCart, CreditCard, TrendingUp, BarChart, PieChart,
  Globe, Wifi, Cloud, Sun, Moon, Coffee, Rocket, Flag, Shield, ThumbsUp,
  MessageCircle, Send, Play, Pause, Github, Twitter, Linkedin, Facebook,
  type LucideIcon,
} from 'lucide-react';
import type { IconWidgetProps, WidgetNode } from '@/lib/schema';
import { useTreeStore } from '@/stores/tree-store';
import { ContentField } from './content-field';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/editor/style/controls';
import { cn } from '@/lib/utils';

/** Curated lucide icons for the picker — imported by name so the bundle
 *  only ships these, not the whole icon set. */
const ICON_MAP: Record<string, LucideIcon> = {
  Star, Heart, Check, X, Plus, Minus, ArrowRight, ArrowLeft, ArrowUp, ArrowDown,
  ChevronRight, ChevronDown, Menu, Search, Home, User, Settings, Mail, Phone,
  MapPin, Calendar, Clock, Bell, Bookmark, Camera, Image, Video, Music, File,
  Folder, Download, Upload, Share2, Link, Lock, Unlock, Eye, Trash2, Edit, Copy,
  Zap, Award, Gift, ShoppingCart, CreditCard, TrendingUp, BarChart, PieChart,
  Globe, Wifi, Cloud, Sun, Moon, Coffee, Rocket, Flag, Shield, ThumbsUp,
  MessageCircle, Send, Play, Pause, Github, Twitter, Linkedin, Facebook,
};
const ICON_NAMES = Object.keys(ICON_MAP);

/** Resolve a stored icon id (e.g. 'lucide:Star' or 'Star') to a component. */
function iconComponentFor(id: string): LucideIcon | null {
  const name = id.replace(/^lucide:/, '');
  const pascal = name.charAt(0).toUpperCase() + name.slice(1);
  return ICON_MAP[pascal] ?? null;
}

/** Icon content: a bundled lucide picker + size + accessible label. */
export function IconContent({ node }: { node: WidgetNode }) {
  const setProps = useTreeStore((s) => s.setProps);
  const setStyleSessionBegin = useTreeStore((s) => s.beginStyleSession);
  const commitSession = useTreeStore((s) => s.commitStyleSession);
  const props = node.props as IconWidgetProps;
  const [query, setQuery] = useState('');

  const currentName = props.icon.replace(/^lucide:/, '');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ICON_NAMES;
    return ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
  }, [query]);

  const pick = (name: string) => {
    // Store as a lucide id, and drop any imported verbatim SVG so the
    // picked icon renders. (svg took precedence in codegen.)
    setProps(node.id, { icon: `lucide:${name}`, svg: undefined });
  };

  return (
    <div className="flex flex-col gap-3">
      <ContentField label="Icon">
        {props.svg && (
          <p className="mb-1 rounded-md bg-warning/10 px-2 py-1 text-2xs text-foreground-muted">
            This icon was imported as inline SVG. Picking one below replaces it.
          </p>
        )}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons…"
          className="mb-2 h-8"
        />
        <div className="grid max-h-52 grid-cols-8 gap-1 overflow-y-auto rounded-md border border-border bg-surface-sunken p-1.5">
          {filtered.map((name) => {
            const Ico = iconComponentFor(name);
            if (!Ico) return null;
            const active = currentName === name && !props.svg;
            return (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => pick(name)}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground-muted hover:bg-surface hover:text-foreground',
                )}
              >
                <Ico className="h-4 w-4" />
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-8 py-3 text-center text-2xs text-foreground-subtle">
              No icons match “{query}”.
            </p>
          )}
        </div>
      </ContentField>

      <ContentField label="Size">
        <NumberInput
          value={props.size ?? null}
          onCommit={(v) => setProps(node.id, { size: v })}
          onPreview={(v) => setProps(node.id, { size: v })}
          onSessionStart={setStyleSessionBegin}
          onSessionEnd={commitSession}
        />
      </ContentField>

      <ContentField label="Accessible label" hint="Leave empty for decorative icons (hidden from screen readers).">
        <Input
          key={props.ariaLabel ?? ''}
          defaultValue={props.ariaLabel ?? ''}
          onBlur={(e) => setProps(node.id, { ariaLabel: e.target.value.trim() || undefined })}
          placeholder="e.g. Favorite"
          className="h-8"
        />
      </ContentField>
    </div>
  );
}
