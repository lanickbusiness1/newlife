import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type View = 'overview' | 'dossiers' | 'instruction' | 'audit' | 'administration';

interface AuthClaims {
  sub: string;
  email: string;
  actorType: 'APPLICANT' | 'APDP_INTERNAL';
  roles: string[];
  permissions: string[];
}

interface Dossier {
  id: string;
  reference: string;
  request_type: string;
  status: string;
  applicant_id: string;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
}

interface Statistics {
  summary: {
    total: number;
    active: number;
    decided: number;
    awaiting_complement: number;
    average_decision_hours: number | string | null;
  };
  byStatus: Array<{ status: string; count: number }>;
  byRequestType: Array<{ request_type: string; count: number }>;
  monthlyIntake: Array<{ month: string; created: number }>;
  generatedAt: string;
}

interface AuditEntry {
  id: string;
  actor_type: string;
  action: string;
  resource_type: string;
  dossier_id?: string | null;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'Déposé',
  RECEIVED: 'Reçu',
  UNDER_COMPLETENESS_REVIEW: 'Contrôle de complétude',
  INCOMPLETE: 'Incomplet',
  COMPLEMENT_REQUESTED: 'Complément demandé',
  ADMISSIBLE: 'Recevable',
  ASSIGNED: 'Affecté',
  UNDER_INSTRUCTION: 'En instruction',
  UNDER_ANALYSIS: 'En analyse',
  PENDING_HIERARCHICAL_VALIDATION: 'Validation hiérarchique',
  DECISION_PREPARED: 'Décision préparée',
  DECIDED: 'Décidé',
  NOTIFIED: 'Notifié',
  CLOSED: 'Clos',
  ARCHIVED: 'Archivé',
};

const navigation: Array<{ id: View; label: string; glyph: string }> = [
  { id: 'overview', label: 'Vue exécutive', glyph: '◫' },
  { id: 'dossiers', label: 'Dossiers', glyph: '▤' },
  { id: 'instruction', label: 'Instruction', glyph: '⌁' },
  { id: 'audit', label: 'Audit & preuves', glyph: '◎' },
  { id: 'administration', label: 'Administration', glyph: '⚙' },
];

function decodeClaims(token: string): AuthClaims {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('Jeton invalide');
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return JSON.parse(atob(padded)) as AuthClaims;
}

async function api<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.error ?? `Erreur API ${response.status}`);
  return body as T;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function Login({ onAuthenticated }: { onAuthenticated: (token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Connexion refusée');
      onAuthenticated(body.accessToken as string);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Connexion impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="seal">AP</div>
        <p className="eyebrow">République du Bénin · Autorité de protection des données</p>
        <h1>L’instruction réglementaire, traçable de bout en bout.</h1>
        <p className="login-copy">
          Réception, recevabilité, instruction, décision humaine et preuve d’audit dans un cockpit institutionnel souverain.
        </p>
        <div className="trust-row">
          <span>Décision humaine</span><span>Zero Trust</span><span>Evidence Ledger</span>
        </div>
      </section>
      <section className="login-panel">
        <div className="panel-heading">
          <span className="signal-dot" />
          <span>Accès sécurisé APDP BJ</span>
        </div>
        <form onSubmit={submit}>
          <label>
            Adresse professionnelle
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" required />
          </label>
          <label>
            Mot de passe
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" minLength={10} required />
          </label>
          {error && <div className="error-banner">{error}</div>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Vérification…' : 'Entrer dans le cockpit'}</button>
        </form>
        <p className="security-note">Session JWT courte · rotation des jetons · permissions RBAC/ABAC</p>
      </section>
    </main>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill status-${status.toLowerCase()}`}>{statusLabels[status] ?? status}</span>;
}

function Metric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}

function DossierDrawer({ dossier, token, onClose }: { dossier: Dossier; token: string; onClose: () => void }) {
  const [details, setDetails] = useState<Record<string, unknown[]>>({ documents: [], events: [], assignments: [], decisions: [] });

  useEffect(() => {
    const safe = async (path: string) => {
      try {
        const response = await api<{ items: unknown[] }>(path, token);
        return response.items;
      } catch {
        return [];
      }
    };
    Promise.all([
      safe(`/v1/dossiers/${dossier.id}/documents`),
      safe(`/v1/dossiers/${dossier.id}/events`),
      safe(`/v1/dossiers/${dossier.id}/assignments`),
      safe(`/v1/dossiers/${dossier.id}/decisions`),
    ]).then(([documents, events, assignments, decisions]) => setDetails({ documents, events, assignments, decisions }));
  }, [dossier.id, token]);

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <button className="drawer-close" onClick={onClose} aria-label="Fermer">×</button>
        <p className="eyebrow">Dossier institutionnel</p>
        <h2>{dossier.reference}</h2>
        <StatusPill status={dossier.status} />
        <dl className="detail-grid">
          <div><dt>Type</dt><dd>{dossier.request_type}</dd></div>
          <div><dt>Créé</dt><dd>{formatDate(dossier.created_at)}</dd></div>
          <div><dt>Mis à jour</dt><dd>{formatDate(dossier.updated_at)}</dd></div>
          <div><dt>Identifiant</dt><dd className="mono">{dossier.id}</dd></div>
        </dl>
        <div className="evidence-grid">
          <article><strong>{details.documents.length}</strong><span>Documents</span></article>
          <article><strong>{details.events.length}</strong><span>Événements</span></article>
          <article><strong>{details.assignments.length}</strong><span>Affectations</span></article>
          <article><strong>{details.decisions.length}</strong><span>Décisions</span></article>
        </div>
        <h3>Chronologie</h3>
        <div className="timeline">
          {details.events.length === 0 && <p className="muted">Aucun événement visible avec ce rôle.</p>}
          {details.events.slice(-8).reverse().map((entry, index) => {
            const event = entry as { event_type?: string; from_status?: string; to_status?: string; created_at?: string };
            return (
              <div className="timeline-item" key={`${event.event_type}-${index}`}>
                <span />
                <div><strong>{event.event_type ?? 'Événement'}</strong><p>{event.from_status ?? '—'} → {event.to_status ?? '—'}</p><small>{event.created_at ? formatDate(event.created_at) : ''}</small></div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('apdp-access-token') ?? '');
  const [view, setView] = useState<View>('overview');
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [selected, setSelected] = useState<Dossier | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [requestType, setRequestType] = useState('AUTORISATION_TRAITEMENT');

  const claims = useMemo(() => token ? decodeClaims(token) : null, [token]);
  const canCreate = claims?.permissions.includes('DOSSIER_CREATE') || claims?.roles.includes('SYSTEM_ADMIN');

  async function refresh() {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const dossierResponse = await api<{ items: Dossier[] }>('/v1/dossiers?limit=100', token);
      setDossiers(dossierResponse.items);
      try {
        setStatistics(await api<Statistics>('/v1/statistics', token));
      } catch {
        setStatistics(null);
      }
      if (claims?.permissions.includes('AUDIT_READ') || claims?.roles.includes('SYSTEM_ADMIN')) {
        const auditResponse = await api<{ items: AuditEntry[] }>('/v1/audit?limit=100', token);
        setAuditEntries(auditResponse.items);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Chargement impossible');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void refresh(); }, [token]);

  function authenticate(nextToken: string) {
    sessionStorage.setItem('apdp-access-token', nextToken);
    setToken(nextToken);
  }

  function logout() {
    sessionStorage.removeItem('apdp-access-token');
    setToken('');
  }

  async function createDossier(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/v1/dossiers', token, { method: 'POST', body: JSON.stringify({ requestType }) });
      setShowCreate(false);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Création impossible');
    }
  }

  if (!token || !claims) return <Login onAuthenticated={authenticate} />;

  const summary = statistics?.summary;
  const activeDossiers = dossiers.filter((item) => !['CLOSED', 'ARCHIVED'].includes(item.status));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><div className="mini-seal">AP</div><div><strong>APDP BJ</strong><span>Instruction OS</span></div></div>
        <nav>{navigation.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}><span>{item.glyph}</span>{item.label}</button>)}</nav>
        <div className="sidebar-foot"><div className="system-state"><span />Système opérationnel</div><small>V0.3 · Evidence Ledger actif</small></div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">Cockpit institutionnel souverain</p><h1>{navigation.find((item) => item.id === view)?.label}</h1></div>
          <div className="user-zone"><button className="icon-button" onClick={() => void refresh()} aria-label="Actualiser">↻</button><div><strong>{claims.email}</strong><span>{claims.roles[0] ?? claims.actorType}</span></div><button className="ghost-button" onClick={logout}>Déconnexion</button></div>
        </header>

        {error && <div className="error-banner workspace-error">{error}</div>}
        {busy && <div className="progress-line" />}

        {view === 'overview' && (
          <>
            <section className="hero-strip"><div><span className="live-badge">LIVE</span><h2>Vue consolidée de l’instruction</h2><p>Charge, délais, recevabilité et décisions sous contrôle.</p></div><div className="hero-score"><strong>{activeDossiers.length}</strong><span>dossiers actifs</span></div></section>
            <section className="metrics">
              <Metric label="Dossiers enregistrés" value={summary?.total ?? dossiers.length} note="Registre transactionnel" />
              <Metric label="Instruction active" value={summary?.active ?? activeDossiers.length} note="Hors clos et archives" />
              <Metric label="Décisions prononcées" value={summary?.decided ?? dossiers.filter((item) => item.status === 'DECIDED').length} note="Validation humaine" />
              <Metric label="Compléments attendus" value={summary?.awaiting_complement ?? dossiers.filter((item) => item.status === 'COMPLEMENT_REQUESTED').length} note="Relance prioritaire" />
            </section>
            <section className="dashboard-grid">
              <article className="panel wide-panel"><div className="panel-title"><div><p className="eyebrow">Pipeline</p><h3>Distribution des dossiers</h3></div><span>{statistics ? `Actualisé ${formatDate(statistics.generatedAt)}` : 'Vue selon permissions'}</span></div><div className="status-bars">{(statistics?.byStatus ?? []).map((item) => { const max = Math.max(...(statistics?.byStatus ?? [{ count: 1 }]).map((row) => Number(row.count))); return <div className="status-bar" key={item.status}><span>{statusLabels[item.status] ?? item.status}</span><div><i style={{ width: `${Math.max(6, Number(item.count) / max * 100)}%` }} /></div><strong>{item.count}</strong></div>; })}{!statistics && <p className="muted">Les statistiques consolidées sont réservées aux profils autorisés.</p>}</div></article>
              <article className="panel"><div className="panel-title"><div><p className="eyebrow">Contrôle</p><h3>Intégrité opérationnelle</h3></div></div><ul className="control-list"><li><span className="ok">✓</span>Décision finale strictement humaine</li><li><span className="ok">✓</span>RBAC et ABAC actifs</li><li><span className="ok">✓</span>Journal d’audit horodaté</li><li><span className="ok">✓</span>Empreintes documentaires SHA-256</li></ul></article>
            </section>
            <DossierTable title="Dossiers récents" dossiers={dossiers.slice(0, 8)} onSelect={setSelected} />
          </>
        )}

        {view === 'dossiers' && <><div className="section-actions"><div><p className="eyebrow">Registre</p><h2>Tous les dossiers accessibles</h2></div>{canCreate && <button className="primary-button compact" onClick={() => setShowCreate(true)}>+ Nouveau dossier</button>}</div><DossierTable title="Registre des demandes" dossiers={dossiers} onSelect={setSelected} /></>}

        {view === 'instruction' && <><div className="section-actions"><div><p className="eyebrow">Portefeuille</p><h2>Instruction et validation</h2></div><span className="count-chip">{activeDossiers.length} actifs</span></div><DossierTable title="Flux d’instruction" dossiers={activeDossiers} onSelect={setSelected} /></>}

        {view === 'audit' && <section className="panel"><div className="panel-title"><div><p className="eyebrow">Evidence Ledger</p><h3>Journal d’audit global</h3></div><span>{auditEntries.length} entrées visibles</span></div><div className="audit-list">{auditEntries.map((entry) => <div key={entry.id}><span className="audit-icon">◎</span><div><strong>{entry.action}</strong><p>{entry.actor_type} · {entry.resource_type}</p></div><time>{formatDate(entry.created_at)}</time></div>)}{auditEntries.length === 0 && <p className="muted">Aucune entrée visible avec ce niveau d’autorisation.</p>}</div></section>}

        {view === 'administration' && <section className="admin-grid"><article className="panel"><p className="eyebrow">Identité</p><h3>Contexte de session</h3><dl className="detail-grid"><div><dt>Acteur</dt><dd>{claims.actorType}</dd></div><div><dt>Rôles</dt><dd>{claims.roles.join(', ')}</dd></div><div><dt>Permissions</dt><dd>{claims.permissions.length}</dd></div><div><dt>Session</dt><dd>JWT courte durée</dd></div></dl></article><article className="panel"><p className="eyebrow">Architecture</p><h3>Socle actif</h3><ul className="control-list"><li><span className="ok">✓</span>API Fastify</li><li><span className="ok">✓</span>PostgreSQL transactionnel</li><li><span className="ok">✓</span>Workflow canonique</li><li><span className="ok">✓</span>Production Assurance CI</li></ul></article></section>}
      </main>

      {selected && <DossierDrawer dossier={selected} token={token} onClose={() => setSelected(null)} />}
      {showCreate && <div className="modal-backdrop"><form className="modal" onSubmit={createDossier}><button type="button" className="drawer-close" onClick={() => setShowCreate(false)}>×</button><p className="eyebrow">Nouvelle demande</p><h2>Créer un dossier</h2><label>Type de demande<input value={requestType} onChange={(event) => setRequestType(event.target.value)} minLength={3} required /></label><button className="primary-button" type="submit">Créer le brouillon</button></form></div>}
    </div>
  );
}

function DossierTable({ title, dossiers, onSelect }: { title: string; dossiers: Dossier[]; onSelect: (dossier: Dossier) => void }) {
  return <section className="panel table-panel"><div className="panel-title"><div><p className="eyebrow">Suivi opérationnel</p><h3>{title}</h3></div><span>{dossiers.length} dossier(s)</span></div><div className="table-wrap"><table><thead><tr><th>Référence</th><th>Type de demande</th><th>Statut</th><th>Dernière mise à jour</th><th /></tr></thead><tbody>{dossiers.map((dossier) => <tr key={dossier.id} onClick={() => onSelect(dossier)}><td><strong>{dossier.reference}</strong><small className="mono">{dossier.id.slice(0, 8)}</small></td><td>{dossier.request_type}</td><td><StatusPill status={dossier.status} /></td><td>{formatDate(dossier.updated_at)}</td><td><button className="row-action">Ouvrir →</button></td></tr>)}{dossiers.length === 0 && <tr><td colSpan={5} className="empty-cell">Aucun dossier accessible.</td></tr>}</tbody></table></div></section>;
}

createRoot(document.getElementById('root')!).render(<App />);
