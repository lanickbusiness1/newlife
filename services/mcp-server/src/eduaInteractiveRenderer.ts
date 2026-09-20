export const EDUA_PHOTOSYNTHESIS_ARTIFACT = {
  assetId: "EDUA-ART-PHOTOSYNTHESIS-001",
  decisionId: "V4-DEC-042",
  renderer: "self_contained_html",
  bandwidthProfile: "low",
  persistence: "none",
  truthState: "INTERACTIVE_DEMO_ARTIFACT"
} as const;

export interface PhotosynthesisInputs {
  light: number;
  co2: number;
  water: number;
}

export interface PhotosynthesisArtifactRequest {
  language: "fr" | "en";
  learnerLevel: string;
  representationEventId: string;
}

export interface LearningOutcomeInput {
  learnerSessionId: string;
  representationEventId: string;
  preScore: number;
  postScore: number;
  interactions: number;
  evidenceRefs: string[];
}

export interface LearningOutcomeEvaluation {
  learnerSessionId: string;
  representationEventId: string;
  preScore: number;
  postScore: number;
  comprehensionDelta: number;
  masteryStatus: "improved" | "stable" | "regressed";
  interactions: number;
  evidenceRefs: string[];
  claim: "MEASURED_SESSION_OUTCOME_ONLY";
  remeCandidate: {
    status: "candidate_only";
    type: "learning_representation_effectiveness";
    hypothesis: string;
    requiresGateReview: true;
  };
}

function assertBoundedPercent(value: unknown, code: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(code);
  }
}

function requiredText(value: unknown, code: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(code);
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function computePhotosynthesisRate(input: PhotosynthesisInputs): number {
  if (!input || typeof input !== "object") {
    throw new Error("EDUA_PHOTOSYNTHESIS_INVALID_INPUT");
  }

  assertBoundedPercent(input.light, "EDUA_PHOTOSYNTHESIS_INVALID_LIGHT");
  assertBoundedPercent(input.co2, "EDUA_PHOTOSYNTHESIS_INVALID_CO2");
  assertBoundedPercent(input.water, "EDUA_PHOTOSYNTHESIS_INVALID_WATER");

  return Math.min(input.light, input.co2, input.water);
}

export function evaluateLearningOutcome(input: LearningOutcomeInput): LearningOutcomeEvaluation {
  if (!input || typeof input !== "object") {
    throw new Error("EDUA_OUTCOME_INVALID_INPUT");
  }

  requiredText(input.learnerSessionId, "EDUA_OUTCOME_INVALID_SESSION");
  requiredText(input.representationEventId, "EDUA_OUTCOME_INVALID_REPRESENTATION_EVENT");
  assertBoundedPercent(input.preScore, "EDUA_OUTCOME_INVALID_PRE_SCORE");
  assertBoundedPercent(input.postScore, "EDUA_OUTCOME_INVALID_POST_SCORE");

  if (!Number.isInteger(input.interactions) || input.interactions < 0 || input.interactions > 10000) {
    throw new Error("EDUA_OUTCOME_INVALID_INTERACTIONS");
  }

  if (!Array.isArray(input.evidenceRefs) || input.evidenceRefs.length === 0 ||
      input.evidenceRefs.some(ref => typeof ref !== "string" || !ref.trim())) {
    throw new Error("EDUA_OUTCOME_EVIDENCE_REQUIRED");
  }

  const comprehensionDelta = Math.round((input.postScore - input.preScore) * 100) / 100;
  const masteryStatus =
    comprehensionDelta >= 10 ? "improved" :
    comprehensionDelta <= -10 ? "regressed" :
    "stable";

  return {
    learnerSessionId: input.learnerSessionId,
    representationEventId: input.representationEventId,
    preScore: input.preScore,
    postScore: input.postScore,
    comprehensionDelta,
    masteryStatus,
    interactions: input.interactions,
    evidenceRefs: unique(input.evidenceRefs),
    claim: "MEASURED_SESSION_OUTCOME_ONLY",
    remeCandidate: {
      status: "candidate_only",
      type: "learning_representation_effectiveness",
      hypothesis: masteryStatus === "improved"
        ? "This representation may have contributed to improved session comprehension; causal effectiveness requires repeated controlled evidence."
        : "This representation did not produce a material positive session delta; adaptation should be tested before promotion.",
      requiresGateReview: true
    }
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderPhotosynthesisArtifact(input: PhotosynthesisArtifactRequest): string {
  if (!input || typeof input !== "object") {
    throw new Error("EDUA_ARTIFACT_INVALID_INPUT");
  }
  if (input.language !== "fr" && input.language !== "en") {
    throw new Error("EDUA_ARTIFACT_INVALID_LANGUAGE");
  }
  requiredText(input.learnerLevel, "EDUA_ARTIFACT_INVALID_LEVEL");
  requiredText(input.representationEventId, "EDUA_ARTIFACT_INVALID_EVENT");

  const isFr = input.language === "fr";
  const title = isFr ? "Comprendre la photosynthèse" : "Understand photosynthesis";
  const intro = isFr
    ? "Modifie la lumière, le CO₂ et l’eau. Le facteur le plus faible limite ici le taux simplifié de photosynthèse."
    : "Change light, CO₂ and water. In this simplified model, the lowest factor limits the photosynthesis rate.";
  const caveat = isFr
    ? "Modèle pédagogique simplifié : il ne remplace pas un modèle physiologique ou agronomique."
    : "Simplified learning model: it is not a physiological or agronomic model.";
  const quizQuestion = isFr
    ? "Si la lumière est forte mais que l’eau est très faible, que se passe-t-il ?"
    : "If light is high but water is very low, what happens?";
  const correctAnswer = isFr
    ? "L’eau devient le facteur limitant."
    : "Water becomes the limiting factor.";
  const wrongAnswer = isFr
    ? "Observe le facteur le plus faible : il limite le processus dans ce modèle."
    : "Look at the lowest factor: it limits the process in this model.";
  const eventId = escapeHtml(input.representationEventId);
  const learnerLevel = escapeHtml(input.learnerLevel);

  return `<!doctype html>
<html lang="${input.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${title}</title>
<style>
:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#2e241b;background:#fff8ec}
*{box-sizing:border-box}
body{margin:0;padding:16px}
main{max-width:860px;margin:0 auto}
.hero{background:linear-gradient(135deg,#ffd166,#ef8354);padding:20px;border-radius:22px;box-shadow:0 8px 24px rgba(70,45,20,.12)}
h1{font-size:clamp(1.55rem,5vw,2.5rem);margin:0 0 8px}
p{line-height:1.5}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:16px 0}
.card{background:#fff;border:1px solid #ead8bf;border-radius:18px;padding:16px}
label{font-weight:700;display:flex;justify-content:space-between;gap:8px}
input[type=range]{width:100%;accent-color:#a44a1f}
.rate{font-size:2.4rem;font-weight:800}
.meter{height:16px;background:#f0e5d4;border-radius:999px;overflow:hidden}
.meter>div{height:100%;width:50%;background:linear-gradient(90deg,#6a994e,#386641);transition:width .2s ease}
.flow{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;font-weight:700;margin:12px 0}
.node{padding:9px 12px;border-radius:999px;background:#fff;border:1px solid #d9c4a5}
.quiz button,.measure button{border:0;border-radius:12px;padding:10px 14px;font-weight:700;cursor:pointer;background:#7f4f24;color:#fff}
.quiz label{display:block;font-weight:500;margin:8px 0}
small,.caveat{color:#684f3a}
.outcome{margin-top:10px;padding:10px;border-radius:12px;background:#fff3cd;min-height:44px}
.score-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
input[type=number]{width:100%;padding:10px;border:1px solid #cdb89b;border-radius:10px;font-size:1rem}
footer{margin:18px 0;font-size:.84rem;color:#7c6957}
@media(max-width:520px){body{padding:10px}.hero{padding:16px}.score-row{grid-template-columns:1fr}}
</style>
</head>
<body>
<main data-representation-event="${eventId}" data-learner-level="${learnerLevel}">
<section class="hero">
<h1>${title}</h1>
<p>${intro}</p>
<p class="caveat"><strong>Note :</strong> ${caveat}</p>
</section>

<section class="grid" aria-label="Variables de simulation">
<div class="card">
<label for="light"><span>${isFr ? "Lumière" : "Light"}</span><output id="light-value">70%</output></label>
<input id="light" type="range" min="0" max="100" value="70">
</div>
<div class="card">
<label for="co2"><span>CO₂</span><output id="co2-value">70%</output></label>
<input id="co2" type="range" min="0" max="100" value="70">
</div>
<div class="card">
<label for="water"><span>${isFr ? "Eau" : "Water"}</span><output id="water-value">70%</output></label>
<input id="water" type="range" min="0" max="100" value="70">
</div>
</section>

<section class="card" aria-live="polite">
<div>${isFr ? "Taux simplifié de photosynthèse" : "Simplified photosynthesis rate"}</div>
<div class="rate"><span id="photosynthesis-rate">70</span>%</div>
<div class="meter"><div id="rate-meter"></div></div>
<p id="limiting-factor"></p>
<div class="flow" aria-label="Photosynthesis flow">
<span class="node">${isFr ? "Lumière" : "Light"}</span>
<span>+</span><span class="node">CO₂</span>
<span>+</span><span class="node">H₂O</span>
<span>→</span><span class="node">${isFr ? "Glucose + O₂" : "Glucose + O₂"}</span>
</div>
</section>

<section class="card quiz">
<h2>${isFr ? "Teste ta compréhension" : "Check your understanding"}</h2>
<form id="quiz-form">
<p>${quizQuestion}</p>
<label><input type="radio" name="answer" value="water"> ${correctAnswer}</label>
<label><input type="radio" name="answer" value="light"> ${isFr ? "La lumière reste toujours le seul facteur important." : "Light always remains the only important factor."}</label>
<button type="submit">${isFr ? "Vérifier" : "Check"}</button>
</form>
<div id="quiz-feedback" class="outcome" aria-live="polite"></div>
</section>

<section class="card measure">
<h2>${isFr ? "Mesure de compréhension" : "Comprehension measure"}</h2>
<p>${isFr ? "Saisis un score avant et après l’activité (0–100). Ces données restent dans ton navigateur pour cette démo." : "Enter a score before and after the activity (0–100). These demo values stay in your browser."}</p>
<div class="score-row">
<label for="pre-score">${isFr ? "Avant" : "Before"}<input id="pre-score" type="number" min="0" max="100" value="40"></label>
<label for="post-score">${isFr ? "Après" : "After"}<input id="post-score" type="number" min="0" max="100" value="70"></label>
</div>
<button id="measure-btn" type="button">${isFr ? "Calculer le progrès" : "Measure progress"}</button>
<div id="measure-feedback" class="outcome" aria-live="polite"></div>
</section>

<noscript><section class="card"><strong>${isFr ? "Mode sans JavaScript :" : "No-JavaScript mode:"}</strong> ${isFr ? "la photosynthèse transforme l’énergie lumineuse, le CO₂ et l’eau en matière organique et libère de l’oxygène. Dans cette démo simplifiée, le facteur le plus faible limite le taux affiché." : "photosynthesis uses light energy, CO₂ and water to produce organic matter and releases oxygen. In this simplified demo, the lowest factor limits the displayed rate."}</section></noscript>

<footer>EDUA V2 · V4-DEC-042 · ${eventId} · INTERACTIVE_DEMO_ARTIFACT</footer>
</main>
<script>
(function(){
  const ids=["light","co2","water"];
  let interactions=0;
  function value(id){return Number(document.getElementById(id).value)}
  function update(){
    const values={light:value("light"),co2:value("co2"),water:value("water")};
    ids.forEach(id=>{document.getElementById(id+"-value").textContent=values[id]+"%"});
    const rate=Math.min(values.light,values.co2,values.water);
    document.getElementById("photosynthesis-rate").textContent=String(rate);
    document.getElementById("rate-meter").style.width=rate+"%";
    const min=Math.min(values.light,values.co2,values.water);
    const limiting=ids.filter(id=>values[id]===min).map(id=>id==="light"?"${isFr ? "lumière" : "light"}":id==="co2"?"CO₂":"${isFr ? "eau" : "water"}").join(", ");
    document.getElementById("limiting-factor").textContent="${isFr ? "Facteur limitant : " : "Limiting factor: "}"+limiting;
  }
  ids.forEach(id=>document.getElementById(id).addEventListener("input",()=>{interactions++;update()}));
  document.getElementById("quiz-form").addEventListener("submit",function(e){
    e.preventDefault();interactions++;
    const selected=new FormData(e.currentTarget).get("answer");
    document.getElementById("quiz-feedback").textContent=selected==="water"?"${isFr ? "Correct. L’eau limite alors le processus dans ce modèle." : "Correct. Water then limits the process in this model."}":"${wrongAnswer}";
  });
  document.getElementById("measure-btn").addEventListener("click",function(){
    interactions++;
    const pre=Number(document.getElementById("pre-score").value);
    const post=Number(document.getElementById("post-score").value);
    if(!Number.isFinite(pre)||!Number.isFinite(post)||pre<0||pre>100||post<0||post>100){
      document.getElementById("measure-feedback").textContent="${isFr ? "Scores invalides : utilise 0 à 100." : "Invalid scores: use 0 to 100."}";return;
    }
    const delta=Math.round((post-pre)*100)/100;
    const state=delta>=10?"improved":delta<=-10?"regressed":"stable";
    const label=state==="improved"?"${isFr ? "amélioration mesurée" : "measured improvement"}":state==="regressed"?"${isFr ? "baisse mesurée" : "measured decrease"}":"${isFr ? "variation stable" : "stable change"}";
    document.getElementById("measure-feedback").textContent=label+" : "+(delta>=0?"+":"")+delta+" points · "+interactions+" interactions. ${isFr ? "Ce résultat décrit seulement cette session, sans prouver une causalité." : "This result describes only this session and does not prove causality."}";
  });
  update();
})();
</script>
</body>
</html>`;
}
