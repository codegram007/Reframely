import { useRef, useState, type DragEvent } from 'react';
import { UploadCloud, FileArchive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ZipTabProps {
  onSubmit: (file: File) => void;
}

/** Upload-a-zip tab: click-to-browse or drag-and-drop a .zip. */
export function ZipTab({ onSubmit }: ZipTabProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pick(f: File | undefined | null) {
    if (!f) return;
    if (!/\.zip$/i.test(f.name)) {
      setError('Please choose a .zip archive.');
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          dragging
            ? 'border-accent bg-accent-subtle'
            : 'border-border-strong bg-surface-sunken hover:border-accent/50',
        )}
      >
        <span
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl',
            dragging ? 'bg-accent text-accent-foreground' : 'bg-surface text-foreground-muted',
          )}
        >
          <UploadCloud className="h-5 w-5" />
        </span>
        <span className="text-sm font-medium text-foreground">
          Drop a .zip here, or <span className="text-accent">browse</span>
        </span>
        <span className="text-xs text-foreground-subtle">Static HTML / CSS / JS bundle</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />

      {file && (
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
          <FileArchive className="h-4 w-4 shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{file.name}</span>
          <span className="shrink-0 text-xs tabular-nums text-foreground-subtle">
            {(file.size / 1024 / 1024).toFixed(1)} MB
          </span>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <Button variant="primary" disabled={!file} onClick={() => file && onSubmit(file)}>
        Import
      </Button>
    </div>
  );
}
