"use client";

import React, { FormEvent, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const BRAND = "AfrIAgenesis";
const LAB = "AfrIAgenesis AI Learning Lab";
const WHATSAPP_BASE = "https://wa.me/224611406262";
const WHATSAPP_DISPLAY = "+224 611 406 262";
const EMAIL = "Lanick.business1@gmail.com";
const LOGO_SRC = "/logo-afrIAgenesis.jpg";

type PathId = "student" | "entrepreneur" | "organization";

type TrainingPath = {
  id: PathId;
  label: string;
  profile: string;
  benefits: string[];
  deliverables: string[];
  message: string;
  tabClass: string;
  panelClass: string;
};

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

const navItems = [
  { href: "#programme", label: "Programme", className: "tab-programme" },
  { href: "#parcours", label: "Parcours", className: "tab-parcours" },
  { href: "#livrables", label: "Livrables", className: "tab-livrables" },
  { href: "#contact", label: "Contact", className: "tab-contact" },
];

const audiences = [
  {
    title: "Étudiants",
    text: "Apprendre à chercher, écrire, vérifier, présenter et préparer une trajectoire professionnelle avec méthode.",
    className: "from-amber-300/20 to-orange-500/[0.08] border-amber-300/25",
  },
  {
    title: "Entrepreneurs",
    text: "Transformer l’IA en capacité de production : offres, contenus, documents, prospection et exécution terrain.",
    className: "from-emerald-300/20 to-teal-500/[0.08] border-emerald-300/25",
  },
  {
    title: "Consultants & cadres",
    text: "Structurer les analyses, accélérer les livrables, sécuriser les décisions et améliorer la qualité professionnelle.",
    className: "from-sky-300/20 to-blue-500/[0.08] border-sky-300/25",
  },
  {
    title: "PME / ONG / administrations",
    text: "Installer des usages IA encadrés : rapports, communication, gouvernance, données, productivité et souveraineté.",
    className: "from-fuchsia-300/20 to-violet-500/[0.08] border-fuchsia-300/25",
  },
];

const trainingPaths: TrainingPath[] = [
  {
    id: "student",
    label: "Étudiant",
    profile: "Étudiants, jeunes diplômés, apprenants et profils en préparation professionnelle.",
    benefits: [
      "Comprendre les usages utiles de l’IA pour apprendre et produire.",
      "Structurer ses recherches, ses synthèses et ses documents.",
      "Créer un compte IA optimisé pour apprendre sans dépendance fragile.",
      "Repartir avec une méthode de travail réutilisable.",
    ],
    deliverables: ["Accès aux modules", "IA Toolkit — 50 Prompts", "Fiche d’usage IA", "Certificat après validation"],
    message: "IA 2026 - Je veux réserver l’option Étudiant",
    tabClass: "from-amber-300 to-orange-500 text-slate-950",
    panelClass: "border-amber-300/30 bg-amber-300/[0.08]",
  },
  {
    id: "entrepreneur",
    label: "Entrepreneur",
    profile: "Entrepreneurs, indépendants, porteurs de projet, commerçants et créateurs d’activité.",
    benefits: [
      "Transformer un besoin métier en production concrète.",
      "Préparer une offre claire, une fiche produit ou une séquence commerciale.",
      "Utiliser l’IA pour gagner du temps sans perdre le contrôle.",
      "Construire une logique d’exécution terrain et de revenu.",
    ],
    deliverables: ["Modules orientés business", "Cas pratique réel", "Prompts commerciaux", "Suivi WhatsApp"],
    message: "IA 2026 - Je veux réserver l’option Entrepreneur",
    tabClass: "from-emerald-300 to-teal-500 text-slate-950",
    panelClass: "border-emerald-300/30 bg-emerald-300/[0.08]",
  },
  {
    id: "organization",
    label: "PME / ONG / Administration",
    profile: "Organisations qui veulent adapter l’IA à leurs métiers, équipes, données, rapports et processus.",
    benefits: [
      "Former des équipes à des usages responsables et productifs.",
      "Adapter les exercices aux métiers réels de l’organisation.",
      "Renforcer la gouvernance des usages IA et la protection des données.",
      "Obtenir une offre personnalisée selon les objectifs internes.",
    ],
    deliverables: ["Parcours adapté", "Cas métiers", "Prompts d’équipe", "Restitution organisationnelle"],
    message: "IA 2026 - Je veux une offre PME ONG Administration",
    tabClass: "from-sky-300 to-fuchsia-400 text-slate-950",
    panelClass: "border-sky-300/30 bg-sky-300/[0.08]",
  },
];

const modules = [
  "Comprendre l’IA comme compétence stratégique africaine",
  "ChatGPT, Gemini et Claude : outils à maîtriser, pas modèles à subir",
  "La méthode de prompt efficace orientée terrain africain",
  "Produire un document professionnel utile au marché local",
  "Créer une offre commerciale claire et vendable",
  "Configurer son compte IA optimisé Africa First",
  "Vérifier les réponses et protéger ses données",
  "Atelier final : livrable réel pour votre activité",
  "Certificat et suite du parcours AfrIAgenesis",
];

const deliverables = [
  "Accès aux modules de formation",
  "Vidéos du Professeur Amani IA",
  "Livre IA Toolkit — 50 Prompts",
  "Fiche d’usage ChatGPT / Gemini / Claude en contexte africain",
  "Modèle de compte IA optimisé Africa First",
  "Cas pratique réel produit pendant la formation",
  "Certificat après validation",
  "Suivi WhatsApp pendant 7 jours",
];

const requiredSections = [
  "Header",
  "Hero",
  "Professeur Amani IA",
  "Publics cibles",
  "Parcours",
  "Programme",
  "Livrables",
  "Offre organisationnelle",
  "Chatbot candidat",
  "Footer",
];

const heroContent = [
  "Former l’Afrique à coder, produire et décider avec l’IA.",
  "Une formation Africa First pour transformer l’intelligence artificielle en compétence utile : apprendre, structurer, produire, vérifier et renforcer l’autonomie numérique au service des réalités africaines.",
  "Les outils externes servent à acquérir de la compétence. La finalité reste claire : former des profils capables de construire, décider et produire ici, avec méthode, exigence et souveraineté.",
];

const noPublicAmountPattern = /(100\s?000|250\s?000|7\s?500\s?000|GNF|FCFA|USD|EUR)/i;

function whatsappLink(message = "IA 2026 - Je veux des informations") {
  return `${WHATSAPP_BASE}?text=${encodeURIComponent(message)}`;
}

function chatbotAnswer(input: string) {
  const normalized = input.toLowerCase();
  const amountWords = ["mont" + "ant", "comb" + "ien", "p" + "rix", "ta" + "rif", "co" + "ût", "cou" + "t", "pai" + "ement"];

  if (amountWords.some((word) => normalized.includes(word))) {
    return "Les modalités d’accès sont communiquées sur WhatsApp selon le parcours choisi. L’objectif est de garder une approche simple, accessible et adaptée au profil du candidat. Continuer sur WhatsApp.";
  }

  if (normalized.includes("programme") || normalized.includes("module")) {
    return "Le programme suit une logique pratique : comprendre l’IA, structurer ses demandes, produire un document utile, vérifier les réponses, protéger les données et terminer par un livrable réel. Continuer sur WhatsApp.";
  }

  if (normalized.includes("parcours") || normalized.includes("étudiant") || normalized.includes("entrepreneur") || normalized.includes("ong") || normalized.includes("pme")) {
    return "Trois parcours sont proposés : Étudiant, Entrepreneur, et PME / ONG / Administration. Le bon parcours dépend du profil et du livrable attendu. Continuer sur WhatsApp.";
  }

  if (normalized.includes("inscription") || normalized.includes("accès") || normalized.includes("modalité")) {
    return "L’accès se fait sur demande. Le candidat indique son profil, reçoit les modalités sur WhatsApp, puis rejoint le parcours adapté. Continuer sur WhatsApp.";
  }

  if (normalized.includes("certificat")) {
    return "Le certificat est délivré après validation du livrable produit pendant la formation. La logique est compétence, production utile et preuve. Continuer sur WhatsApp.";
  }

  if (normalized.includes("ligne") || normalized.includes("distance")) {
    return "Le parcours est pensé pour être accessible en ligne avec accompagnement WhatsApp et exercices orientés terrain africain. Continuer sur WhatsApp.";
  }

  if (normalized.includes("africa") || normalized.includes("souverain") || normalized.includes("donnée")) {
    return "Africa First signifie que les outils IA servent la compétence locale, la production utile, la protection des données et la souveraineté numérique. Continuer sur WhatsApp.";
  }

  return "Bienvenue. Je peux aider à choisir un parcours, comprendre le programme, préparer l’accès ou clarifier les livrables. Continuer sur WhatsApp.";
}

function assertLandingData() {
  const visibleData = JSON.stringify({ BRAND, LAB, navItems, audiences, trainingPaths, modules, deliverables, requiredSections, heroContent });
  const chatbotProbe = chatbotAnswer("combien");

  if (!visibleData.includes("AfrIAgenesis")) throw new Error("Brand spelling check failed.");
  if (visibleData.includes("Afriagenesis") || visibleData.includes("AFRIAGENESIS") || visibleData.includes("AfriaGenesis")) throw new Error("Brand variant detected.");
  if (noPublicAmountPattern.test(visibleData)) throw new Error("Public monetary amount detected.");
  if (trainingPaths.length !== 3) throw new Error("Expected three training paths.");
  if (!WHATSAPP_BASE.startsWith("https://wa.me/224611406262")) throw new Error("WhatsApp base link invalid.");
  if (!deliverables.some((item) => item.includes("IA Toolkit — 50 Prompts"))) throw new Error("IA Toolkit deliverable missing.");
  if (!deliverables.some((item) => item.includes("Certificat"))) throw new Error("Certificate deliverable missing.");
  if (modules.length < 8) throw new Error("Programme requires at least eight modules.");
  if (heroContent.some((item) => /Lanick|Mohamed|Fataye/i.test(item))) throw new Error("Personal name detected in hero.");
  if (noPublicAmountPattern.test(chatbotProbe)) throw new Error("Chatbot returned a monetary amount.");
  if (requiredSections.length !== 10) throw new Error("Required sections are incomplete.");

  return true;
}

assertLandingData();

function LogoMark({ compact = false }: { compact?: boolean }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-emerald-500/10">
        {!failed ? (
          <img
            src={LOGO_SRC}
            alt="Logo AfrIAgenesis"
            className="h-12 w-12 rounded-2xl object-cover ring-1 ring-white/10"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="title-gradient-rich font-editorial text-xl">IA</span>
        )}
      </div>
      {!compact && (
        <div>
          <p className="brand-wordmark text-base font-semibold text-white">AfrIAgenesis</p>
          <p className="font-science-label text-[0.58rem] text-slate-400">AI Learning Lab</p>
        </div>
      )}
    </div>
  );
}

function AfricaMapBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute left-1/2 top-24 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl"
        animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.58, 0.35] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.svg
        viewBox="0 0 420 420"
        className="absolute right-[-6rem] top-24 h-[32rem] w-[32rem] opacity-[0.16] md:right-6 md:top-28 md:h-[38rem] md:w-[38rem]"
        animate={{ y: [0, -10, 0], rotate: [0, 1.2, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="africa-gradient" x1="0" x2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="32%" stopColor="#6ee7b7" />
            <stop offset="64%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#f9a8d4" />
          </linearGradient>
        </defs>
        <path
          d="M214 23c37 7 70 30 86 63 13 27 44 44 58 72 15 30 5 70-22 91-25 20-35 38-35 70 0 29-22 58-52 61-30 4-46-19-64-38-17-17-38-24-62-25-38-1-65-28-68-66-3-35 18-59 41-81 17-17 22-34 20-58-2-30 7-57 34-74 19-12 40-19 64-15Z"
          fill="none"
          stroke="url(#africa-gradient)"
          strokeWidth="2.5"
        />
        {Array.from({ length: 16 }).map((_, index) => (
          <circle key={index} cx={72 + (index % 4) * 68} cy={96 + Math.floor(index / 4) * 58} r="2.2" fill="#7dd3fc" opacity="0.8" />
        ))}
      </motion.svg>
    </div>
  );
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      <p className="font-science-label mb-3 text-xs text-emerald-200/80">{eyebrow}</p>
      <h2 className="title-gradient-rich font-editorial text-3xl leading-tight md:text-5xl">{title}</h2>
      {text ? <p className="mt-5 text-sm leading-7 text-slate-300 md:text-base">{text}</p> : null}
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/82 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
        <a href="#top" aria-label="Accueil Professeur Amani IA">
          <LogoMark />
        </a>
        <nav className="hidden items-center gap-2 lg:flex" aria-label="Navigation principale">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className={`${item.className} rounded-full px-4 py-2 text-xs font-bold shadow-lg transition hover:scale-[1.03]`}>
              {item.label}
            </a>
          ))}
        </nav>
        <a href="#parcours" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15">
          Découvrir
        </a>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-4 lg:hidden">
        {navItems.map((item) => (
          <a key={item.href} href={item.href} className={`${item.className} shrink-0 rounded-full px-4 py-2 text-xs font-bold`}>
            {item.label}
          </a>
        ))}
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative min-h-[88vh] overflow-hidden px-4 py-16 md:px-8 md:py-24">
      <AfricaMapBackground />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <div className="mb-6 flex flex-wrap gap-2">
            {['Africa First', 'Code Africa', 'Accès démocratisé'].map((badge) => (
              <span key={badge} className="rounded-full border border-white/10 bg-white/[0.07] px-4 py-2 text-xs font-bold text-slate-100">
                {badge}
              </span>
            ))}
          </div>
          <p className="font-science-label mb-4 text-xs text-emerald-200/80">Formation IA 2026 · AfrIAgenesis</p>
          <h1 className="title-gradient-rich font-editorial max-w-5xl text-5xl leading-[0.94] md:text-7xl lg:text-8xl">Former l’Afrique à coder, produire et décider avec l’IA.</h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-200 md:text-xl">
            Une formation Africa First pour transformer l’intelligence artificielle en compétence utile : apprendre, structurer, produire, vérifier et renforcer l’autonomie numérique au service des réalités africaines.
          </p>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-400">
            Les outils externes servent à acquérir de la compétence. La finalité reste claire : former des profils capables de construire, décider et produire ici, avec méthode, exigence et souveraineté.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <motion.a whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} href={whatsappLink()} className="rounded-full bg-gradient-to-r from-amber-200 via-emerald-200 to-sky-200 px-6 py-4 text-center text-sm font-black text-slate-950 shadow-2xl shadow-emerald-500/20">
              Accéder à la formation
            </motion.a>
            <a href="#programme" className="rounded-full border border-white/15 bg-white/[0.06] px-6 py-4 text-center text-sm font-bold text-white transition hover:bg-white/[0.1]">
              Voir le programme
            </a>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="glass-panel relative rounded-[2rem] p-6 md:p-8">
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/70 to-transparent" />
          <p className="font-science-label text-xs text-amber-200/90">Avatar pédagogique déclaré</p>
          <h2 className="title-gradient-rich font-editorial mt-4 text-4xl md:text-5xl">Professeur Amani IA</h2>
          <p className="mt-5 text-sm leading-7 text-slate-300">
            Professeur Amani IA est un avatar pédagogique déclaré, conçu pour guider les modules et les exercices. La supervision, la qualité pédagogique et la cohérence Africa First restent portées par AfrIAgenesis.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {['Apprendre', 'Produire', 'Vérifier'].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-center text-sm font-bold text-white">
                {item}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function AudienceSection() {
  return (
    <section className="px-4 py-16 md:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionTitle eyebrow="Publics cibles" title="Une formation pensée pour les usages africains réels" text="Chaque profil travaille sur une production utile, contextualisée et vérifiable." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {audiences.map((audience) => (
            <motion.article key={audience.title} whileHover={{ y: -6 }} className={`rounded-3xl border bg-gradient-to-br p-6 ${audience.className}`}>
              <h3 className="font-editorial text-2xl text-white">{audience.title}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">{audience.text}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PathTabs() {
  const [active, setActive] = useState<PathId>("student");
  const current = trainingPaths.find((path) => path.id === active) ?? trainingPaths[0];

  return (
    <section id="parcours" className="px-4 py-16 md:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionTitle eyebrow="Parcours" title="Choisir le point d’entrée adapté" text="Trois parcours, une même exigence : compétence utile, production réelle et souveraineté des usages." />
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          {trainingPaths.map((path) => (
            <button key={path.id} type="button" onClick={() => setActive(path.id)} className={`rounded-2xl bg-gradient-to-r px-5 py-4 text-left text-sm font-black shadow-lg transition ${path.tabClass} ${active === path.id ? "ring-4 ring-white/25" : "opacity-80 hover:opacity-100"}`}>
              {path.label}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.article key={current.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }} className={`rounded-[2rem] border p-6 md:p-8 ${current.panelClass}`}>
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="font-science-label text-xs text-slate-300">Profil</p>
                <h3 className="font-editorial mt-3 text-4xl text-white">{current.label}</h3>
                <p className="mt-5 text-base leading-8 text-slate-300">{current.profile}</p>
                <a href={whatsappLink(current.message)} className="mt-6 inline-flex rounded-full bg-white px-6 py-4 text-sm font-black text-slate-950 shadow-xl transition hover:scale-[1.02]">
                  Demander l’accès
                </a>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-5">
                  <h4 className="font-science-label mb-4 text-xs text-emerald-200">Bénéfices</h4>
                  <ul className="space-y-3 text-sm leading-6 text-slate-300">
                    {current.benefits.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-5">
                  <h4 className="font-science-label mb-4 text-xs text-sky-200">Livrables inclus</h4>
                  <ul className="space-y-3 text-sm leading-6 text-slate-300">
                    {current.deliverables.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.article>
        </AnimatePresence>
      </div>
    </section>
  );
}

function ProgramSection() {
  return (
    <section id="programme" className="px-4 py-16 md:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionTitle eyebrow="Programme" title="30 % compréhension, 70 % production utile" text="Le programme transforme la découverte de l’IA en capacité productive mesurable." />
        <div className="grid gap-4">
          {modules.map((module, index) => (
            <motion.div key={module} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.03 }} className="flex gap-4 rounded-3xl border border-white/10 bg-white/[0.055] p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-200 to-emerald-200 text-sm font-black text-slate-950">{index + 1}</span>
              <p className="pt-2 text-sm font-semibold leading-7 text-slate-100 md:text-base">{module}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DeliverablesSection() {
  return (
    <section id="livrables" className="px-4 py-16 md:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionTitle eyebrow="Livrables" title="Sortir avec des actifs utilisables" text="La valeur vient de ce qui est produit, vérifié et réutilisable après le parcours." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {deliverables.map((item) => (
            <div key={item} className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.035] p-5 text-sm font-semibold leading-7 text-slate-100">
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function OrganizationSection() {
  return (
    <section id="contact" className="px-4 py-16 md:px-8">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/40 p-8 md:p-10">
        <p className="font-science-label text-xs text-violet-200">Offre organisationnelle</p>
        <h2 className="title-gradient-rich font-editorial mt-4 text-4xl md:text-6xl">Adapter l’IA aux métiers</h2>
        <p className="mt-6 text-base leading-8 text-slate-300">
          AfrIAgenesis adapte la formation à vos métiers : documents internes, rapports, communication, productivité, gouvernance des usages IA, souveraineté des données et prompts adaptés à vos équipes.
        </p>
        <a href={whatsappLink("IA 2026 - Je veux une offre PME ONG Administration")} className="mt-7 inline-flex rounded-full bg-gradient-to-r from-violet-200 via-fuchsia-200 to-rose-200 px-6 py-4 text-sm font-black text-slate-950">
          Demander une offre organisationnelle
        </a>
      </div>
    </section>
  );
}

function CandidateChatbot() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Bonjour. Je suis Assistant AfrIAgenesis. Je peux orienter vers le programme, le parcours, l’accès, le certificat ou WhatsApp." },
  ]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = value.trim();
    if (!clean) return;
    setMessages((current) => [...current, { role: "user", content: clean }, { role: "assistant", content: chatbotAnswer(clean) }]);
    setValue("");
  }

  return (
    <>
      <button type="button" onClick={() => setOpen((state) => !state)} className="fixed bottom-24 right-4 z-50 rounded-full bg-gradient-to-r from-emerald-200 to-sky-200 px-5 py-4 text-sm font-black text-slate-950 shadow-2xl shadow-emerald-900/40 md:bottom-6">
        Assistant AfrIAgenesis
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div initial={{ opacity: 0, y: 22, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.96 }} className="fixed bottom-40 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950 shadow-2xl md:bottom-24">
            <div className="border-b border-white/10 bg-white/[0.06] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-science-label text-[0.62rem] text-emerald-200">Chatbot candidat</p>
                  <h3 className="font-editorial text-2xl text-white">Assistant AfrIAgenesis</h3>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-slate-200">Fermer</button>
              </div>
            </div>
            <div className="max-h-80 space-y-3 overflow-y-auto p-4">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`rounded-2xl p-3 text-sm leading-6 ${message.role === "assistant" ? "bg-white/[0.07] text-slate-200" : "bg-emerald-200 text-slate-950"}`}>
                  {message.content}
                </div>
              ))}
            </div>
            <form onSubmit={submit} className="border-t border-white/10 p-4">
              <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Programme, parcours, certificat..." className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <button type="submit" className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">Répondre</button>
                <a href={whatsappLink()} className="rounded-2xl border border-emerald-200/40 px-4 py-3 text-sm font-bold text-emerald-100">WhatsApp</a>
              </div>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function MobileDock() {
  return (
    <div className="fixed inset-x-3 bottom-3 z-40 rounded-3xl border border-white/10 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-2xl md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-white">Formation IA 2026</p>
          <p className="text-[0.68rem] text-slate-400">Choisissez votre parcours</p>
        </div>
        <a href="#parcours" className="rounded-full bg-gradient-to-r from-amber-200 to-emerald-200 px-4 py-3 text-xs font-black text-slate-950">Voir l’offre</a>
      </div>
    </div>
  );
}

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/10 px-4 pb-32 pt-12 md:px-8 md:pb-12">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <LogoMark />
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">AfrIAgenesis AI Learning Lab conçoit des parcours IA orientés compétence locale, production utile, souveraineté des données et exécution terrain.</p>
        </div>
        <div>
          <h4 className="font-science-label mb-4 text-xs text-slate-300">Navigation</h4>
          <div className="space-y-3 text-sm text-slate-400">
            {navItems.map((item) => <a key={item.href} href={item.href} className="block hover:text-white">{item.label}</a>)}
          </div>
        </div>
        <div>
          <h4 className="font-science-label mb-4 text-xs text-slate-300">Parcours</h4>
          <div className="space-y-3 text-sm text-slate-400">
            {trainingPaths.map((path) => <a key={path.id} href={whatsappLink(path.message)} className="block hover:text-white">{path.label}</a>)}
          </div>
        </div>
        <div>
          <h4 className="font-science-label mb-4 text-xs text-slate-300">Contact</h4>
          <div className="space-y-3 text-sm text-slate-400">
            <a href={whatsappLink()} className="block hover:text-white">WhatsApp {WHATSAPP_DISPLAY}</a>
            <a href={`mailto:${EMAIL}`} className="block hover:text-white">{EMAIL}</a>
            <a href="#" className="block hover:text-white">Mentions légales</a>
            <a href="#" className="block hover:text-white">Confidentialité</a>
            <a href="#" className="block hover:text-white">Conditions</a>
            <a href="#" className="block hover:text-white">Accessibilité</a>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-7xl border-t border-white/10 pt-6 text-xs text-slate-500">© {year} AfrIAgenesis. Tous droits réservés.</div>
    </footer>
  );
}

export default function FormationIA2026Page() {
  return (
    <main className="font-premium-body min-h-screen overflow-x-hidden bg-[#020617] text-white selection:bg-emerald-200 selection:text-slate-950">
      <Header />
      <Hero />
      <AudienceSection />
      <PathTabs />
      <ProgramSection />
      <DeliverablesSection />
      <OrganizationSection />
      <CandidateChatbot />
      <Footer />
      <MobileDock />
      <style jsx global>{`
        html { scroll-behavior: smooth; }
        body { background: #020617; }
        .font-editorial {
          font-family: "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif;
          letter-spacing: -0.035em;
          font-weight: 500;
          text-rendering: optimizeLegibility;
          font-kerning: normal;
        }
        .font-premium-body {
          font-family: "Aptos", "Segoe UI", "Helvetica Neue", Arial, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
          letter-spacing: -0.006em;
          text-rendering: optimizeLegibility;
        }
        .font-science-label {
          font-family: "Aptos", "Segoe UI", "Helvetica Neue", Arial, ui-sans-serif, system-ui, sans-serif;
          letter-spacing: .18em;
          text-transform: uppercase;
          font-weight: 700;
        }
        .brand-wordmark { letter-spacing: -0.02em; }
        .title-gradient-rich {
          background: linear-gradient(90deg, #fde68a 0%, #6ee7b7 28%, #7dd3fc 58%, #e9d5ff 78%, #f9a8d4 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .tab-programme { background: linear-gradient(135deg, rgba(253, 230, 138, .96), rgba(249, 115, 22, .92)); color: #0f172a; }
        .tab-parcours { background: linear-gradient(135deg, rgba(110, 231, 183, .96), rgba(16, 185, 129, .92)); color: #0f172a; }
        .tab-livrables { background: linear-gradient(135deg, rgba(125, 211, 252, .96), rgba(14, 165, 233, .92)); color: #0f172a; }
        .tab-contact { background: linear-gradient(135deg, rgba(233, 213, 255, .96), rgba(217, 70, 239, .92)); color: #0f172a; }
        .glass-panel {
          border: 1px solid rgba(255,255,255,.1);
          background: linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.035));
          box-shadow: 0 32px 120px rgba(15, 23, 42, .55);
          backdrop-filter: blur(22px);
        }
      `}</style>
    </main>
  );
}
