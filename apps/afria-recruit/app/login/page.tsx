import Link from 'next/link';
import { LoginForm } from '../../components/auth/LoginForm';

export default function LoginPage() {
  return <main className="login-page"><section className="login-shell"><Link className="candidate-brand" href="/"><span className="candidate-brand-mark">A</span><span><strong>AfrIA</strong>genesis® <small>AfrIA Recruit™</small></span></Link><p className="eyebrow">Candidate OS™</p><h1>Accéder à mon espace carrière</h1><p>Vos documents et preuves restent dans votre espace authentifié.</p><LoginForm /></section></main>;
}
