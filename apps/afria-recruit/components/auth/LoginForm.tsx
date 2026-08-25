'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '../../lib/supabase/browser-client';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const client = createBrowserSupabaseClient();
    if (!client) {
      setError('La connexion n’est pas configurée sur cet environnement.');
      setBusy(false);
      return;
    }

    const { data, error: authError } = await client.auth.signInWithPassword({ email, password });
    if (authError || !data.session?.access_token) {
      setError('Email ou mot de passe invalide.');
      setBusy(false);
      return;
    }

    const sessionResponse = await fetch('/api/auth/session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: data.session.access_token }),
    });
    if (!sessionResponse.ok) {
      setError('La session sécurisée n’a pas pu être créée.');
      setBusy(false);
      return;
    }

    router.push('/candidate/dashboard');
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Mot de passe<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {error ? <div className="candidate-alert error" role="alert">{error}</div> : null}
      <button className="candidate-button primary" type="submit" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
    </form>
  );
}
