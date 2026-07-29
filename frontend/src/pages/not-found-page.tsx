import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <p className="text-4xl font-semibold tracking-tight text-foreground">404</p>
      <p className="max-w-sm text-sm text-foreground-muted">
        We couldn't find that page. It may have been moved or never existed.
      </p>
      <Link to="/">
        <Button variant="secondary">Back to projects</Button>
      </Link>
    </div>
  );
}
