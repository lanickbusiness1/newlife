import Link from 'next/link';
import { CandidateHeader } from '../../../components/candidate/CandidateHeader';

export default function InterviewCoachPage() {
  return <main className="candidate-page"><CandidateHeader /><section className="candidate-shell candidate-hero compact"><p className="eyebrow">Étape suivante</p><h1>Interview Coach™</h1><p className="candidate-lead">Le moteur d’entretien contextualisé sera activé dans le lot suivant. Il ne prétendra jamais prédire exactement les questions d’un employeur.</p><Link className="candidate-button secondary" href="/candidate/cv-optimizer">Retour au CV Optimizer</Link></section></main>;
}
