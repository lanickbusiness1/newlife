function response(text, actions = false) {
  return { text, actions };
}

function normalize(value) {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function createWelcomeMessage() {
  return response('Bonjour, je suis l’assistant guidé AfrIA Recruit™. Je peux expliquer la solution, le matching, la confidentialité ou vous orienter vers un échange avec l’équipe.');
}

export function answerInvestorQuestion(question) {
  const normalized = normalize(question);

  if (normalized.includes('matching') || normalized.includes('correspondance') || normalized.includes('score')) {
    return response('Le matching compare le besoin à des critères lisibles : compétences, expérience, contexte, disponibilité et exigences institutionnelles. Il prépare une recommandation explicable ; la décision finale reste humaine.');
  }

  if (normalized.includes('confidential') || normalized.includes('donnee') || normalized.includes('prive')) {
    return response('Cette présentation publique n’expose aucune donnée personnelle réelle. Un consentement explicite est requis avant tout partage de profil, puis chaque proposition reste soumise à une revue humaine.');
  }

  if (normalized.includes('pilote') || normalized.includes('rendez-vous') || normalized.includes('whatsapp') || normalized.includes('equipe')) {
    return response('Un échange de cadrage permet de définir un pilote contrôlé, ses critères de succès et ses règles de gouvernance avant toute mise en œuvre.', true);
  }

  if (normalized.includes('prix') || normalized.includes('cout') || normalized.includes('tarif') || normalized.includes('revenu')) {
    return response('Le modèle proposé suit une logique diagnostic, pilote contrôlé puis déploiement. Aucun tarif ni revenu non vérifié n’est affiché dans cette présentation.');
  }

  if (normalized.includes('recrut')) {
    return response('AfrIA Recruit™ aide à structurer un besoin, comparer des profils consentants selon des critères explicables et documenter une décision qui reste humaine.');
  }

  return response('Je peux vous aider sur le recrutement, le matching, la confidentialité, le modèle de pilote ou la prise de contact avec l’équipe.');
}
