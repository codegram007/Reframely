import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type AspectRatio = 'free' | '1:1' | '4:3' | '16:9' | '3:2';

const RATIOS: { value: AspectRatio; label: string; ratio: number | null }[] = [
  { value: 'free', label: 'Free', ratio: null },
  { value: '1:1', label: '1:1', ratio: 1 },
  { value: '4:3', label: '4:3', ratio: 4 / 3 },
  { value: '3:2', label: '3:2', ratio: 3 / 2 },
  { value: '16:9', label: '16:9', ratio: 16 / 9 },
];

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
} // fractions 0..1 of the image

/**
 * A simple aspect-ratio-constrained cropper. Renders the source image
 * with a draggable crop rectangle overlay; on apply, draws the cropped
 * region to a canvas and returns a data URL. Fully client-side.
 */
export function ImageCropper({
  src,
  onApply,
  onCancel,
}: {
  src: string;
  onApply: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState<AspectRatio>('free');
  const [crop, setCrop] = useState<CropRect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const drag = useRef<{ startX: number; startY: number; orig: CropRect; mode: 'move' } | null>(null);

  // Re-fit the crop box when the aspect ratio changes.
  useEffect(() => {
    const r = RATIOS.find((x) => x.value === ratio)?.ratio ?? null;
    if (r === null) return;
    setCrop((c) => {
      // Constrain height from width using the container's pixel aspect.
      const el = containerRef.current;
      const img = imgRef.current;
      if (!el || !img) return c;
      const pxW = c.w * img.clientWidth;
      const pxH = pxW / r;
      const fracH = Math.min(1 - c.y, pxH / img.clientHeight);
      return { ...c, h: fracH };
    });
  }, [ratio]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, orig: crop, mode: 'move' };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !imgRef.current) return;
    const img = imgRef.current;
    const dx = (e.clientX - drag.current.startX) / img.clientWidth;
    const dy = (e.clientY - drag.current.startY) / img.clientHeight;
    const o = drag.current.orig;
    const x = Math.max(0, Math.min(1 - o.w, o.x + dx));
    const y = Math.max(0, Math.min(1 - o.h, o.y + dy));
    setCrop({ ...o, x, y });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const apply = () => {
    const img = imgRef.current;
    if (!img) return;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const sx = crop.x * nw;
    const sy = crop.y * nh;
    const sw = crop.w * nw;
    const sh = crop.h * nh;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    onApply(canvas.toDataURL('image/png'));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-0.5 rounded-md border border-border bg-surface-sunken p-0.5">
        {RATIOS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setRatio(r.value)}
            className={cn(
              'flex-1 rounded px-1 py-1 text-2xs font-medium transition-colors',
              ratio === r.value ? 'bg-surface text-foreground shadow-xs' : 'text-foreground-muted hover:text-foreground',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div
        ref={containerRef}
        className="relative select-none overflow-hidden rounded-md border border-border"
      >
        <img ref={imgRef} src={src} alt="" draggable={false} className="block max-h-64 w-full object-contain" />
        {/* Crop window: a bright-bordered box over a dimmed image. The
            image inside the box reads at full brightness thanks to the
            large spread box-shadow dimming everything outside it. */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="absolute cursor-move touch-none border-2 border-accent"
          style={{
            left: `${crop.x * 100}%`,
            top: `${crop.y * 100}%`,
            width: `${crop.w * 100}%`,
            height: `${crop.h * 100}%`,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
          }}
        >
          {/* Corner handles (visual affordance; whole box drags to move) */}
          {['-top-1 -left-1', '-top-1 -right-1', '-bottom-1 -left-1', '-bottom-1 -right-1'].map((pos) => (
            <span key={pos} className={cn('absolute h-2 w-2 rounded-full bg-accent', pos)} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel} className="flex-1">
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={apply} className="flex-1">
          <Check className="h-3.5 w-3.5" />
          Apply crop
        </Button>
      </div>
    </div>
  );
}
