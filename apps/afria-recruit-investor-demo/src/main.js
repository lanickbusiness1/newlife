import { createClient } from '@supabase/supabase-js';
import { answerInvestorQuestion, createWelcomeMessage } from './assistant.js';
import { loadInvestorKpis } from './kpi.js';
import './styles.css';

const whatsappUrl = 'https://wa.me/2290161107373?text=Bonjour%2C%20je%20d%C3%A9couvre%20le%20concept%20AfrIA%20Recruit%E2%84%A2%20et%20je%20souhaite%20%C3%A9changer%20avec%20l%E2%80%99%C3%A9quipe%20AfrIAgenesis%C2%AE.';
const emailUrl = 'mailto:Lanick.business1@gmail.com?subject=AfrIA%20Recruit%20%E2%80%94%20Demande%20de%20cadrage';

function element(selector) {
  const value = document.querySelector(selector);
  if (!value) throw new Error(`Missing required interface element: ${selector}`);
  return value;
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function metricText(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat('fr-FR').format(value) : '—';
}

function renderKpis(kpis) {
  const values = {
    '#candidates': kpis.candidates,
    '#needs': kpis.institutionalNeeds,
    '#matches': kpis.activeMatches,
    '#placements': kpis.placements,
    '#pipeline': kpis.pipeline,
  };

  for (const [selector, value] of Object.entries(values)) {
    element(selector).textContent = metricText(value);
  }

  const status = element('#data-status');
  status.dataset.mode = kpis.mode;
  status.querySelector('span:last-child').textContent = kpis.status;

  const warning = element('#data-warning');
  warning.hidden = !kpis.warning;
  warning.textContent = kpis.warning ?? '';
}

function unavailableKpis() {
  return {
    mode: 'DEGRADED',
    candidates: null,
    institutionalNeeds: null,
    activeMatches: null,
    placements: null,
    pipeline: null,
    status: 'Indicateurs temporairement indisponibles',
    warning: 'Aucune valeur de remplacement n’est affichée.',
  };
}

function readPublicDataConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    || import.meta.env.VITE_SUPABASE_ANON_KEY
    || ''
  ).trim();

  if (!url || !key) return null;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? { url: parsed.toString(), key } : null;
  } catch {
    return null;
  }
}

async function initializeKpis() {
  const config = readPublicDataConfig();
  if (!config) {
    renderKpis(unavailableKpis());
    return;
  }

  const supabase = createClient(config.url, config.key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  renderKpis(await loadInvestorKpis(supabase));
}

function initializeNavigation() {
  element('#launch-demo').addEventListener('click', () => scrollToSection('interactive-demo'));
  document.querySelectorAll('[data-scroll]').forEach((button) => {
    button.addEventListener('click', () => scrollToSection(button.dataset.scroll));
  });
}

function initializeScenario() {
  const choices = [...document.querySelectorAll('.choice')];
  const consentGate = element('#consent-gate');
  const verificationGate = element('#verification-gate');
  const runButton = element('#run-match');
  const selection = element('#demo-select');
  const result = element('#demo-result');
  const progress = [...document.querySelectorAll('.progress-step')];
  let selectedRole = '';

  function updateGate() {
    runButton.disabled = !(selectedRole && consentGate.checked && verificationGate.checked);
  }

  choices.forEach((choice) => {
    choice.addEventListener('click', () => {
      selectedRole = choice.dataset.role;
      choices.forEach((candidate) => {
        const selected = candidate === choice;
        candidate.classList.toggle('selected', selected);
        candidate.setAttribute('aria-pressed', String(selected));
      });
      updateGate();
    });
  });

  consentGate.addEventListener('change', updateGate);
  verificationGate.addEventListener('change', updateGate);

  runButton.addEventListener('click', () => {
    if (runButton.disabled) return;
    element('#selected-role').textContent = selectedRole;
    selection.hidden = true;
    result.hidden = false;
    progress[1]?.classList.add('active');
  });

  element('#human-review').addEventListener('click', () => {
    progress[2]?.classList.add('active');
    showToast('Revue humaine documentée — aucune décision automatisée');
  });

  element('#reset-demo').addEventListener('click', () => {
    selectedRole = '';
    consentGate.checked = false;
    verificationGate.checked = false;
    selection.hidden = false;
    result.hidden = true;
    choices.forEach((choice) => {
      choice.classList.remove('selected');
      choice.setAttribute('aria-pressed', 'false');
    });
    progress.slice(1).forEach((step) => step.classList.remove('active'));
    updateGate();
  });
}

function showToast(message) {
  const toast = element('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.setTimeout(() => toast.classList.remove('visible'), 2600);
}

function initializeAssistant() {
  const panel = element('#assistant-panel');
  const launcher = element('#assistant-launcher');
  const messages = element('#assistant-messages');
  const input = element('#assistant-input');

  function addMessage(role, content) {
    const message = document.createElement('article');
    message.className = `assistant-message ${role}`;

    const paragraph = document.createElement('p');
    paragraph.textContent = content.text;
    message.append(paragraph);

    if (content.actions) {
      const actions = document.createElement('div');
      actions.className = 'contact-actions';

      const whatsapp = document.createElement('a');
      whatsapp.href = whatsappUrl;
      whatsapp.target = '_blank';
      whatsapp.rel = 'noopener noreferrer';
      whatsapp.textContent = 'WhatsApp';

      const email = document.createElement('a');
      email.href = emailUrl;
      email.textContent = 'Email';

      actions.append(whatsapp, email);
      message.append(actions);
    }

    messages.append(message);
    messages.scrollTop = messages.scrollHeight;
  }

  function resetConversation() {
    messages.replaceChildren();
    addMessage('bot', createWelcomeMessage());
  }

  function openAssistant() {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    window.setTimeout(() => input.focus(), 0);
  }

  function closeAssistant() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }

  launcher.addEventListener('click', () => {
    if (panel.hidden) openAssistant();
    else closeAssistant();
  });
  element('#assistant-close').addEventListener('click', closeAssistant);
  element('#assistant-clear').addEventListener('click', resetConversation);

  document.querySelectorAll('[data-question]').forEach((button) => {
    button.addEventListener('click', () => addMessage('bot', answerInvestorQuestion(button.dataset.question)));
  });

  element('#assistant-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const question = input.value.trim().slice(0, 240);
    if (!question) return;

    addMessage('user', { text: question, actions: false });
    addMessage('bot', answerInvestorQuestion(question));
    input.value = '';
  });

  resetConversation();
}

initializeNavigation();
initializeScenario();
initializeAssistant();
initializeKpis().catch(() => renderKpis(unavailableKpis()));
