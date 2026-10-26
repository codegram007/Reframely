import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Github, Loader2 } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/auth/auth-provider';
import { supabase } from '@/lib/supabase';

export function LoginPage() {
  const { loading, session } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!loading && session) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/app'} replace />;
  }

  const handleGithubSignIn = async () => {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/app`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GitHub authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) setMessage('Check your email to confirm your account, then sign in.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-10 text-foreground">
      <section className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-lg">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <h1 className="text-center text-xl font-semibold">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-1 text-center text-sm text-foreground-muted">
          {mode === 'login' ? 'Sign in to open your projects.' : 'Start editing your first imported site.'}
        </p>

        {/* GitHub OAuth Provider Button */}
        <Button
          type="button"
          variant="secondary"
          className="mt-6 w-full flex items-center justify-center gap-2 border-border-strong hover:bg-surface-sunken"
          disabled={submitting}
          onClick={() => void handleGithubSignIn()}
        >
          <Github className="h-4 w-4" />
          Continue with GitHub
        </Button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface px-2 text-foreground-muted">Or continue with email</span>
          </div>
        </div>

        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="block space-y-1.5 text-sm">
            <span>Email</span>
            <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span>Password</span>
            <Input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          {message && <p className="text-sm text-success" role="status">{message}</p>}
          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'login' ? 'Sign in' : 'Sign up'}
          </Button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface px-2 text-foreground-muted">Or</span>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={submitting}
          onClick={async () => {
            setSubmitting(true);
            try {
              await supabase.auth.signInWithPassword({
                email: 'designer@reframely.local',
                password: 'demo-password',
              });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          Explore with Demo Account
        </Button>

        <button
          type="button"
          className="mt-5 w-full text-center text-sm text-accent hover:underline"
          onClick={() => {
            setMode((current) => current === 'login' ? 'signup' : 'login');
            setError(null);
            setMessage(null);
          }}
        >
          {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>
      </section>
    </main>
  );
}
