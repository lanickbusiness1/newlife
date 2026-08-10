"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.6 },
};

const glowFrame =
  "relative overflow-hidden before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:p-px before:content-[''] before:bg-[linear-gradient(120deg,rgba(148,163,184,0.14),rgba(125,211,252,0.24),rgba(196,181,253,0.18),rgba(148,163,184,0.1))] before:[mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[mask-composite:xor] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor]";

const valueCards = [
  { title: "Commandes envisagées", desc: "La maquette propose quatre actions par table : appeler, service, addition, annuler." },
  { title: "Parcours QR envisagé", desc: "Le concept illustre une expérience mobile liée à une table et à une session." },
  { title: "Collecte à tester", desc: "Les champs proposés incluent le prénom, le contact et un consentement explicite." },
  { title: "Tableau de bord envisagé", desc: "Temps de réponse, scans, conversion et tables actives sont des indicateurs à valider." },
] as const;

const contactCards = [
  { title: "Statut", value: "Concept interne • site pilote et rattachement institutionnel à confirmer." },
  { title: "Email", value: "contact@afriagenesis.ai" },
  { title: "Téléphone", value: "Non publié • prise de contact via le formulaire configuré." },
] as const;

const kpis = [
  ["Temps moyen de réponse", "À mesurer"],
  ["Scans QR", "À mesurer"],
  ["Leads consentis", "À mesurer"],
  ["Conversion scan → lead", "À mesurer"],
] as const;

const validationAxes = [
  {
    name: "Exploitation",
    role: "Hypothèse à tester",
    statement: "Mesurer si le dispositif réduit réellement les demandes perdues et le temps de réponse.",
  },
  {
    name: "Équipe de service",
    role: "Hypothèse à tester",
    statement: "Vérifier l’adoption par le personnel, la charge opérationnelle et la clarté des notifications.",
  },
  {
    name: "Client pilote",
    role: "Validation requise",
    statement: "Établir le consentement, la valeur perçue et l’économie du pilote avant toute revendication commerciale.",
  },
] as const;

const videoEmbedUrl = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL || "";
const formWebhookUrl = process.env.NEXT_PUBLIC_FORM_WEBHOOK || "";

type ChatStep = "start" | "pilot" | "demo";
type FormDataState = {
  fullName: string;
  company: string;
  email: string;
  whatsapp: string;
  country: string;
  message: string;
  consent: boolean;
};

function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <div className={`flex items-center justify-center rounded-full bg-gradient-to-br from-sky-300 via-violet-300 to-emerald-300 text-slate-950 shadow-lg shadow-sky-300/10 ${small ? "h-12 w-12 text-xs font-bold" : "h-14 w-14 text-sm font-bold"}`}>
      AG
    </div>
  );
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mb-10 max-w-3xl space-y-3">
      <div className="text-sm uppercase tracking-[0.2em] text-sky-200">{eyebrow}</div>
      <h2 className="text-3xl font-semibold md:text-4xl">{title}</h2>
      {description ? <p className="text-sm leading-7 text-slate-400">{description}</p> : null}
    </div>
  );
}

export default function Page() {
  const [chatOpen, setChatOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [formSent, setFormSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chatStep, setChatStep] = useState<ChatStep>("start");
  const [formData, setFormData] = useState<FormDataState>({ fullName: "", company: "", email: "", whatsapp: "", country: "", message: "", consent: false });

  const chatMessages = useMemo(() => {
    if (chatStep === "pilot") return ["Bonjour. Quel type de site voulez-vous équiper ?", "Je veux explorer un pilote de 10 tables.", "Ce scénario permet de cadrer les hypothèses, les mesures et les conditions d’un éventuel pilote."] as const;
    if (chatStep === "demo") return ["Bonjour. Souhaitez-vous une démonstration produit ou une estimation économique ?", "Je veux une démonstration complète.", "Parfait. Utilisez le formulaire ci-dessous et notre équipe vous recontactera avec un créneau de démonstration."] as const;
    return ["Bonjour. Voulez-vous explorer un pilote, des mesures économiques ou un scénario multisite ?", "Je veux comprendre le concept et ses hypothèses.", "Ce guide présente les parcours proposés ; toute validation commerciale reste humaine."] as const;
  }, [chatStep]);

  const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const updateField = (key: keyof FormDataState, value: string | boolean) => setFormData((prev) => ({ ...prev, [key]: value }));

  const submitForm = async () => {
    if (!formData.fullName || !formData.email || !formData.whatsapp || !formData.consent) {
      alert("Merci de renseigner le nom, l’email, le WhatsApp et d’accepter d’être contacté.");
      return;
    }
    if (!formWebhookUrl) {
      alert("Formulaire de démonstration non configuré. Aucune donnée n’a été envoyée.");
      return;
    }
    try {
      setIsSubmitting(true);
      const response = await fetch(formWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "gdiz-smart-service-node-landing", submittedAt: new Date().toISOString(), ...formData }),
      });
      if (!response.ok) throw new Error("Webhook submission failed");
      setFormSent(true);
      scrollToId("contact");
    } catch (error) {
      console.error(error);
      alert("La demande n’a pas pu être envoyée. Vérifiez le webhook ou réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 selection:bg-sky-300/20">
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        <AnimatePresence>
          {chatOpen && (
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.25 }} className={`hidden max-w-sm rounded-3xl bg-slate-900/95 p-4 shadow-2xl shadow-black/40 md:block ${glowFrame}`}>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-300 font-semibold text-slate-950 shadow-lg shadow-sky-300/20">IA</div>
                <div><div className="font-semibold">Guide de parcours</div><div className="text-xs text-slate-400">Scénarios statiques • aucune décision automatisée</div></div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="max-w-[90%] rounded-2xl bg-slate-800 px-4 py-3 text-slate-200">{chatMessages[0]}</div>
                <div className="ml-auto max-w-[85%] rounded-2xl bg-sky-300 px-4 py-3 text-slate-950">{chatMessages[1]}</div>
                <div className="max-w-[90%] rounded-2xl bg-slate-800 px-4 py-3 text-slate-200">{chatMessages[2]}</div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => setChatStep("pilot")} className="rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-200 transition hover:border-sky-300/40">Pilote 10 tables</button>
                <button onClick={() => setChatStep("demo")} className="rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-200 transition hover:border-sky-300/40">Demander une démo</button>
                <button onClick={() => scrollToId("contact")} className="rounded-full bg-sky-300 px-3 py-2 text-xs font-medium text-slate-950">Aller au formulaire</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={() => setChatOpen((prev) => !prev)} className="rounded-full bg-sky-300 px-6 py-3 font-semibold text-slate-950 shadow-xl shadow-sky-300/20 transition hover:-translate-y-0.5">{chatOpen ? "Fermer le guide" : "Ouvrir le guide"}</button>
      </div>

      <AnimatePresence>
        {videoOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className={`w-full max-w-4xl rounded-[2rem] bg-slate-900 p-6 shadow-2xl shadow-black/40 ${glowFrame}`}>
              <div className="mb-4 flex items-center justify-between">
                <div><div className="text-sm text-slate-400">Vidéo de démonstration</div><div className="text-xl font-semibold">GDIZ Smart Service Node</div></div>
                <button onClick={() => setVideoOpen(false)} className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200">Fermer</button>
              </div>
              <div className={`aspect-video rounded-[1.5rem] bg-slate-950 p-4 ${glowFrame}`}>
                {videoEmbedUrl ? <iframe title="GDIZ Smart Service Node demo video" src={videoEmbedUrl} className="h-full w-full rounded-[1.25rem]" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /> : <div className="flex h-full items-center justify-center rounded-[1.25rem] border border-dashed border-slate-700 text-center text-sm text-slate-400">Démonstration non configurée</div>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="relative overflow-hidden border-b border-slate-800 bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,0.18),transparent_30%),radial-gradient(circle_at_top_left,rgba(196,181,253,0.14),transparent_25%),linear-gradient(to_bottom,#0b1020,#111827)]">
        <div className="absolute inset-0 opacity-25"><div className="absolute left-10 top-16 h-32 w-32 rounded-full bg-sky-300 blur-3xl" /><div className="absolute right-12 top-24 h-40 w-40 rounded-full bg-violet-300 blur-3xl" /></div>
        <header className="relative mx-auto max-w-7xl px-6 py-8 md:px-10">
          <div className={`flex flex-col gap-5 rounded-[2rem] bg-slate-900/50 p-4 backdrop-blur md:flex-row md:items-center md:justify-between md:p-5 ${glowFrame}`}>
            <div className="flex items-center gap-4"><BrandMark /><div><div className="text-lg font-semibold">AfrIAgenesis</div><div className="text-sm text-slate-400">GDIZ Smart Service Node • Executive Product Landing</div></div></div>
            <div className="flex flex-wrap gap-3 text-sm">
              <button onClick={() => scrollToId("video")} className="rounded-full border border-slate-700 px-4 py-2 text-slate-200 transition hover:border-sky-300/40">Vidéo</button>
              <button onClick={() => scrollToId("chatbot")} className="rounded-full border border-slate-700 px-4 py-2 text-slate-200 transition hover:border-sky-300/40">Chatbot</button>
              <button onClick={() => scrollToId("reviews")} className="rounded-full border border-slate-700 px-4 py-2 text-slate-200 transition hover:border-sky-300/40">Avis</button>
              <button onClick={() => scrollToId("contact")} className="rounded-full border border-slate-700 px-4 py-2 text-slate-200 transition hover:border-sky-300/40">Contact</button>
            </div>
          </div>
        </header>
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pb-16 pt-4 md:px-10 md:pb-24 lg:grid-cols-[1.06fr_0.94fr]">
          <motion.div {...fadeUp} className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-sky-300/10 px-4 py-2 text-sm text-sky-200"><span className="h-2 w-2 rounded-full bg-sky-300" />Product • Service • CRM • Monetization</div>
            <div className="space-y-5">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">Et si chaque table devenait un point d’accès au service et à l’expérience client ?</h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">Cette maquette explore un node physique, un parcours mobile, des scénarios guidés et un tableau d’indicateurs. Ces capacités restent à tester sur un pilote autorisé.</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <button onClick={() => { setChatOpen(true); setChatStep("pilot"); scrollToId("contact"); }} className="rounded-2xl bg-sky-300 px-6 py-3 font-medium text-slate-950 shadow-lg shadow-sky-300/20 transition hover:-translate-y-0.5">Demander un pilote 10 tables</button>
              <button onClick={() => setVideoOpen(true)} className="rounded-2xl border border-slate-700 bg-slate-900/50 px-6 py-3 font-medium text-slate-100 transition hover:border-sky-300/40">Voir la vidéo de démonstration</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {valueCards.map((item, index) => (
                <motion.div key={item.title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: index * 0.06 }} className={`rounded-2xl bg-slate-900/70 p-4 shadow-xl shadow-black/10 ${glowFrame}`}>
                  <div className="text-lg font-semibold text-sky-200">{item.title}</div><div className="mt-2 text-sm leading-6 text-slate-400">{item.desc}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
          <motion.div {...fadeUp} className="grid gap-5">
            <div className={`rounded-[2rem] bg-slate-900/80 p-5 shadow-2xl shadow-black/30 ${glowFrame}`}>
              <div className="mb-4 flex items-center justify-between"><div><div className="text-sm text-slate-400">Produit</div><div className="text-xl font-semibold">Node physique • maquette</div></div><div className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs text-amber-200">CONCEPT — NON DÉPLOYÉ</div></div>
              <div className={`rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 ${glowFrame}`}>
                <div className={`mx-auto max-w-sm rounded-[2rem] bg-black/40 p-5 shadow-2xl shadow-black/40 ${glowFrame}`}>
                  <div className="mb-4 flex items-center justify-between"><div className="text-sm text-slate-400">GDIZ Table Node</div><div className="h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_20px_rgba(134,239,172,0.55)]" /></div>
                  <div className="grid grid-cols-2 gap-4">{["Call", "Drink", "Bill", "Cancel"].map((label) => <div key={label} className={`flex aspect-square items-center justify-center rounded-full bg-slate-950 text-center text-sm font-medium text-slate-200 ${glowFrame}`}>{label}</div>)}</div>
                  <div className={`mt-5 rounded-2xl bg-slate-950 p-4 text-center text-sm text-slate-400 ${glowFrame}`}>QR unique par table • USB-C • LED • Device ID</div>
                </div>
              </div>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <div id="video" className={`rounded-[2rem] bg-slate-900/80 p-5 ${glowFrame}`}>
                <div className="mb-4 text-sm text-slate-400">Vidéo de démonstration</div>
                <div className={`aspect-video rounded-2xl bg-slate-950 p-4 ${glowFrame}`}>
                  <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 text-center text-slate-400"><div className="text-lg font-medium text-slate-200">Parcours conceptuel</div><div className="mt-2 max-w-sm text-sm leading-6">Appui bouton → notification proposée → collecte consentie → indicateurs à mesurer.</div><button onClick={() => setVideoOpen(true)} className="mt-5 rounded-full bg-sky-300 px-5 py-2 font-medium text-slate-950 shadow-lg shadow-sky-300/20">Voir l’état de la vidéo</button></div>
                </div>
              </div>
              <div className={`rounded-[2rem] bg-slate-900/80 p-5 ${glowFrame}`}>
                <div className="mb-4 text-sm text-slate-400">Mesures pilote — non disponibles</div>
                <div className="space-y-4">{kpis.map(([label, value]) => <div key={label} className={`flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3 ${glowFrame}`}><span className="text-sm text-slate-400">{label}</span><span className="font-semibold text-sky-200">{value}</span></div>)}</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <motion.section {...fadeUp} className="border-y border-slate-800 bg-slate-900/45">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10">
          <SectionHeader eyebrow="Hypothèse produit" title="Une interface physique-to-digital dont les effets restent à mesurer." />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">{[["Service", "Hypothèse : réduire les demandes perdues sans alourdir la coordination."],["Expérience", "Hypothèse : rendre l’attente plus lisible depuis un smartphone."],["Donnée", "Collecte proposée uniquement avec consentement explicite et finalité définie."],["Économie", "Pistes à valider : fidélité, promotion, upsell et réachat."]].map(([title, desc]) => <div key={title} className={`rounded-3xl bg-slate-950 p-6 shadow-xl shadow-black/20 ${glowFrame}`}><h3 className="text-xl font-semibold text-slate-50">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-400">{desc}</p></div>)}</div>
        </div>
      </motion.section>

      <motion.section id="chatbot" {...fadeUp} className="mx-auto max-w-7xl px-6 py-16 md:px-10">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className={`rounded-[2rem] bg-slate-900 p-6 ${glowFrame}`}><div className="text-sm uppercase tracking-[0.2em] text-sky-200">Guide de démonstration</div><h2 className="mt-3 text-3xl font-semibold">Des scénarios guidés pour explorer le concept.</h2><p className="mt-4 text-sm leading-7 text-slate-400">Ce composant présente des réponses prédéfinies. Il ne qualifie pas les prospects, ne prend aucune décision et ne remplace pas un conseiller humain.</p></div>
          <div className={`rounded-[2rem] bg-slate-900 p-6 ${glowFrame}`}><div className="space-y-3 rounded-2xl bg-slate-950 p-4"><div className="max-w-[88%] rounded-2xl bg-slate-800 px-4 py-3 text-sm text-slate-200">Quel scénario souhaitez-vous explorer : 5 tables, 10 tables ou multisite ?</div><div className="ml-auto max-w-[80%] rounded-2xl bg-sky-300 px-4 py-3 text-sm text-slate-950">L’hypothèse de 10 tables.</div><div className="max-w-[88%] rounded-2xl bg-slate-800 px-4 py-3 text-sm text-slate-200">Le guide peut présenter les mesures proposées ; un humain doit ensuite valider la faisabilité et le cadre du pilote.</div><div className="flex flex-wrap gap-3 pt-2"><button onClick={() => { setChatOpen(true); setChatStep("pilot"); }} className="rounded-full bg-sky-300 px-4 py-2 text-sm font-medium text-slate-950">Ouvrir le guide</button><button onClick={() => scrollToId("contact")} className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200">Aller au formulaire</button></div></div></div>
        </div>
      </motion.section>

      <motion.section id="reviews" {...fadeUp} className="mx-auto max-w-7xl px-6 py-16 md:px-10">
        <SectionHeader eyebrow="Validation requise" title="Trois hypothèses à éprouver avant toute preuve commerciale." />
        <div className="grid gap-6 lg:grid-cols-3">{validationAxes.map((axis) => <div key={axis.name} className={`rounded-3xl bg-slate-900 p-6 ${glowFrame}`}><div className="text-base leading-8 text-slate-200">{axis.statement}</div><div className="mt-6 border-t border-slate-800 pt-4"><div className="font-semibold text-sky-200">{axis.name}</div><div className="text-sm text-slate-400">{axis.role}</div></div></div>)}</div>
      </motion.section>

      <motion.section id="contact" {...fadeUp} className="mx-auto max-w-7xl px-6 pb-20 md:px-10">
        <div className={`rounded-[2rem] bg-slate-900 p-6 shadow-2xl shadow-black/20 ${glowFrame}`}>
          <div className="text-sm uppercase tracking-[0.2em] text-sky-200">Réserver une démo</div><h2 className="mt-3 text-3xl font-semibold">Parlons pilote, déploiement ou partenariat.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <input value={formData.fullName} onChange={(e) => updateField("fullName", e.target.value)} className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 outline-none transition focus:border-sky-300/40" placeholder="Nom complet" />
            <input value={formData.company} onChange={(e) => updateField("company", e.target.value)} className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 outline-none transition focus:border-sky-300/40" placeholder="Entreprise" />
            <input value={formData.email} onChange={(e) => updateField("email", e.target.value)} className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 outline-none transition focus:border-sky-300/40" placeholder="Email" />
            <input value={formData.whatsapp} onChange={(e) => updateField("whatsapp", e.target.value)} className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 outline-none transition focus:border-sky-300/40" placeholder="WhatsApp" />
            <input value={formData.country} onChange={(e) => updateField("country", e.target.value)} className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 outline-none transition focus:border-sky-300/40 md:col-span-2" placeholder="Ville / Pays" />
            <textarea value={formData.message} onChange={(e) => updateField("message", e.target.value)} className="min-h-[140px] rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 outline-none transition focus:border-sky-300/40 md:col-span-2" placeholder="Décrivez votre besoin : restaurant, hôtel, lounge, multisite, pilote, nombre de tables..." />
          </div>
          <div className="mt-5 flex items-start gap-3 text-sm text-slate-400"><input type="checkbox" checked={formData.consent} onChange={(e) => updateField("consent", e.target.checked)} className="mt-1" /><span>J’accepte d’être contacté pour une démonstration, une offre pilote et des informations produit.</span></div>
          <div className="mt-6 flex flex-wrap gap-4"><button onClick={submitForm} disabled={isSubmitting || !formWebhookUrl} className="rounded-2xl bg-sky-300 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-sky-300/20 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "Envoi en cours..." : formWebhookUrl ? "Envoyer ma demande" : "Formulaire non configuré"}</button><button onClick={() => { setChatOpen(true); setChatStep("demo"); }} className="rounded-2xl border border-slate-700 px-6 py-3 font-medium text-slate-100">Ouvrir le guide</button></div>
        </div>
        {formSent && <div className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-4 text-sm text-emerald-100">Merci. Votre demande a été envoyée au point de contact configuré.</div>}
      </motion.section>

      <footer className="border-t border-slate-800 bg-[linear-gradient(to_right,#131a2b,#0f172a,#1a1b33)]">
        <div className="mx-auto max-w-7xl px-6 py-8 md:px-10"><div className={`grid gap-6 rounded-[2rem] bg-slate-900/40 p-6 md:grid-cols-[0.9fr_1.1fr] ${glowFrame}`}><div className="flex items-start gap-4"><BrandMark small /><div><div className="font-semibold text-slate-100">AfrIAgenesis • GDIZ Smart Service Node</div><div className="mt-1 text-sm text-slate-400">Concept de service et d’expérience client à valider.</div></div></div><div><div className="text-sm uppercase tracking-[0.2em] text-sky-200">Contact & statut</div><div className="mt-4 grid gap-3 md:grid-cols-3">{contactCards.map((item) => <div key={item.title} className={`rounded-2xl bg-slate-950 p-4 ${glowFrame}`}><div className="text-sm font-medium text-slate-100">{item.title}</div><div className="mt-2 text-sm leading-6 text-slate-400">{item.value}</div></div>)}</div></div></div></div>
      </footer>
    </main>
  );
}
