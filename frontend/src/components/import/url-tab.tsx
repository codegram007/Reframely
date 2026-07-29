import { useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface UrlTabProps {
  /** Validate the raw input; return an error string or null. */
  validate: (value: string) => string | null;
  onSubmit: (value: string) => void;
  placeholder: string;
  hint: string;
  cta: string;
}

/** Shared single-URL form used by the GitHub and live-site tabs. */
export function UrlTab({ validate, onSubmit, placeholder, hint, cta }: UrlTabProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    const err = validate(trimmed);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onSubmit(trimmed);
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <Input
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : (
        <p className="text-xs text-foreground-subtle">{hint}</p>
      )}
      <Button type="submit" variant="primary" disabled={value.trim().length === 0}>
        {cta}
      </Button>
    </form>
  );
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidGitHubUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      (u.hostname === 'github.com' || u.hostname === 'www.github.com') &&
      u.pathname.replace(/^\/+|\/+$/g, '').split('/').length >= 2
    );
  } catch {
    return false;
  }
}
