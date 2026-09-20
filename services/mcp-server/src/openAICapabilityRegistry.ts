export const OPENAI_CAPABILITY_REGISTRY_VERSION = "2026-09-20";

export type CapabilityExecutionPolicy =
  | "AUTO_RENDER"
  | "AUTO_DRAFT"
  | "SUGGEST"
  | "ACTION_GATED";

export type OpenAICapabilityClass =
  | "writing_ui"
  | "code_preview"
  | "structured_output"
  | "image"
  | "video"
  | "audio"
  | "perception"
  | "research"
  | "computation"
  | "integration"
  | "action"
  | "app_ui"
  | "safety"
  | "evaluation"
  | "retrieval";

export interface OpenAICapability {
  id: string;
  name: string;
  class: OpenAICapabilityClass;
  description: string;
  providerBacked: boolean;
  actionGated: boolean;
  sourceRef: string;
}

export interface GenesisCreationRecipe {
  id: string;
  name: string;
  description: string;
  requiredCapabilities: string[];
  optionalCapabilities?: string[];
  defaultPolicy: CapabilityExecutionPolicy;
  tags: string[];
}

export interface CreationIntentSignals {
  dynamicProcess?: boolean;
  causal?: boolean;
  educational?: boolean;
  interactionHelpful?: boolean;
  memorization?: boolean;
  handwrittenRequested?: boolean;
  procedural?: boolean;
  checklist?: boolean;
  visual?: boolean;
  quantitative?: boolean;
  thresholds?: boolean;
  comparative?: boolean;
  hierarchical?: boolean;
  ecosystem?: boolean;
  spatial?: boolean;
  currentInformation?: boolean;
  multiSourceResearch?: boolean;
  citationsRequired?: boolean;
  internalFiles?: boolean;
  codePrototype?: boolean;
  interactiveUi?: boolean;
  machineReadable?: boolean;
  strictSchema?: boolean;
  audioInput?: boolean;
  audioOutput?: boolean;
  multiSpeaker?: boolean;
  actionItems?: boolean;
  realtime?: boolean;
  translation?: boolean;
  externalSystemAction?: boolean;
  mutation?: boolean;
  storyMotion?: boolean;
  narration?: boolean;
  imageCreation?: boolean;
  imageEdit?: boolean;
  dataAnalysis?: boolean;
  safetyReview?: boolean;
  qualityEvaluation?: boolean;
  semanticRetrieval?: boolean;
}

export interface CreationCapabilityRequest {
  intent: string;
  objective: string;
  domain:
    | "education"
    | "finance"
    | "government"
    | "health"
    | "agriculture"
    | "industry"
    | "humanitarian"
    | "enterprise"
    | "general";
  signals: CreationIntentSignals;
}

export interface CreationCapabilityRecommendation {
  registryVersion: string;
  primaryRecipe: GenesisCreationRecipe;
  alternativeRecipes: GenesisCreationRecipe[];
  primitiveCapabilities: OpenAICapability[];
  confidence: number;
  policy: CapabilityExecutionPolicy;
  triggerReasons: string[];
  guardrails: string[];
  truthState: "CAPABILITY_RECOMMENDATION_ONLY";
}

export const OPENAI_CAPABILITY_REGISTRY: OpenAICapability[] = [
  {
    id: "writing_block",
    name: "Writing block",
    class: "writing_ui",
    description: "Editable long-form or reusable writing surface inside ChatGPT.",
    providerBacked: false,
    actionGated: false,
    sourceRef: "openai-help-writing-code-blocks"
  },
  {
    id: "code_block",
    name: "Code block",
    class: "writing_ui",
    description: "Editable code surface with supported preview and execution actions.",
    providerBacked: false,
    actionGated: false,
    sourceRef: "openai-help-writing-code-blocks"
  },
  {
    id: "python_execution",
    name: "Python execution",
    class: "computation",
    description: "Run supported Python code in a sandboxed code workspace.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-help-writing-code-blocks"
  },
  {
    id: "html_preview",
    name: "HTML preview",
    class: "code_preview",
    description: "Preview supported HTML pages directly from code.",
    providerBacked: false,
    actionGated: false,
    sourceRef: "openai-help-writing-code-blocks"
  },
  {
    id: "react_preview",
    name: "React preview",
    class: "code_preview",
    description: "Preview supported React components.",
    providerBacked: false,
    actionGated: false,
    sourceRef: "openai-help-writing-code-blocks"
  },
  {
    id: "svg_preview",
    name: "SVG preview",
    class: "code_preview",
    description: "Preview generated SVG graphics.",
    providerBacked: false,
    actionGated: false,
    sourceRef: "openai-help-writing-code-blocks"
  },
  {
    id: "mermaid_preview",
    name: "Mermaid diagram preview",
    class: "code_preview",
    description: "Preview Mermaid diagrams for flows, architectures and sequences.",
    providerBacked: false,
    actionGated: false,
    sourceRef: "openai-help-writing-code-blocks"
  },
  {
    id: "vega_preview",
    name: "Vega chart preview",
    class: "code_preview",
    description: "Preview data visualizations expressed in Vega.",
    providerBacked: false,
    actionGated: false,
    sourceRef: "openai-help-writing-code-blocks"
  },
  {
    id: "vega_lite_preview",
    name: "Vega-Lite chart preview",
    class: "code_preview",
    description: "Preview concise declarative data visualizations.",
    providerBacked: false,
    actionGated: false,
    sourceRef: "openai-help-writing-code-blocks"
  },
  {
    id: "interactive_chart",
    name: "Interactive chart",
    class: "code_preview",
    description: "Rich interactive bar, line, pie or scatter chart surface in ChatGPT.",
    providerBacked: false,
    actionGated: false,
    sourceRef: "openai-chatgpt-release-notes-2026-06-08"
  },
  {
    id: "structured_output_json_schema",
    name: "Structured Outputs / JSON Schema",
    class: "structured_output",
    description: "Schema-constrained machine-readable model output.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-structured-outputs"
  },
  {
    id: "function_calling",
    name: "Function calling",
    class: "integration",
    description: "Strongly typed calls into application-defined functions.",
    providerBacked: true,
    actionGated: true,
    sourceRef: "openai-api-responses-tools"
  },
  {
    id: "image_generation",
    name: "Image generation",
    class: "image",
    description: "Generate images from textual or multimodal instructions.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-image-generation"
  },
  {
    id: "image_edit",
    name: "Image editing",
    class: "image",
    description: "Edit or transform an existing image.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-image-edit"
  },
  {
    id: "image_inpaint",
    name: "Image inpainting / mask edit",
    class: "image",
    description: "Modify selected image regions using a mask.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-image-edit"
  },
  {
    id: "image_transparent_background",
    name: "Transparent image output",
    class: "image",
    description: "Generate supported image outputs with transparent background.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-image-generation"
  },
  {
    id: "vision_image_understanding",
    name: "Vision / image understanding",
    class: "perception",
    description: "Analyze visual content supplied as image input.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-image-input"
  },
  {
    id: "video_generation",
    name: "Video generation",
    class: "video",
    description: "Generate video from a prompt.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-videos"
  },
  {
    id: "video_reference_generation",
    name: "Reference-guided video generation",
    class: "video",
    description: "Generate video guided by optional reference assets.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-videos"
  },
  {
    id: "video_remix",
    name: "Video remix",
    class: "video",
    description: "Create a refreshed version of an existing generated video.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-videos"
  },
  {
    id: "text_to_speech",
    name: "Text to speech",
    class: "audio",
    description: "Generate natural-sounding speech from text.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-audio-speech"
  },
  {
    id: "speech_to_text",
    name: "Speech to text",
    class: "audio",
    description: "Transcribe spoken audio into text.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-audio-transcription"
  },
  {
    id: "speaker_diarization",
    name: "Speaker diarization",
    class: "audio",
    description: "Transcribe audio with speaker labels when supported.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-audio-transcription"
  },
  {
    id: "realtime_speech_to_speech",
    name: "Realtime speech-to-speech",
    class: "audio",
    description: "Low-latency spoken conversation with audio input and output.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-realtime"
  },
  {
    id: "realtime_multimodal",
    name: "Realtime multimodal interaction",
    class: "audio",
    description: "Realtime text, image and audio interaction through low-latency interfaces.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-realtime"
  },
  {
    id: "realtime_translation",
    name: "Realtime translation",
    class: "audio",
    description: "Streaming speech-to-speech translation capability.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-model-catalog-realtime-translate"
  },
  {
    id: "custom_voice",
    name: "Custom voice",
    class: "audio",
    description: "Custom voice output for eligible customers with consent requirements.",
    providerBacked: true,
    actionGated: true,
    sourceRef: "openai-api-custom-voices"
  },
  {
    id: "file_pdf_understanding",
    name: "File and PDF understanding",
    class: "perception",
    description: "Analyze files and PDFs supplied to supported models.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-quickstart-files"
  },
  {
    id: "web_search",
    name: "Web search",
    class: "research",
    description: "Retrieve current public web information for grounded responses.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-responses-tools"
  },
  {
    id: "file_search",
    name: "File search",
    class: "research",
    description: "Search relevant content from uploaded files and vector stores.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-responses-tools"
  },
  {
    id: "deep_research",
    name: "Deep research",
    class: "research",
    description: "Plan, search, compare evidence and produce structured cited research.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-help-deep-research"
  },
  {
    id: "code_interpreter",
    name: "Code Interpreter",
    class: "computation",
    description: "Run Python for calculations, analysis and generated outputs.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-responses-tools"
  },
  {
    id: "computer_use",
    name: "Computer Use",
    class: "action",
    description: "Interact with graphical interfaces when authorized.",
    providerBacked: true,
    actionGated: true,
    sourceRef: "openai-api-model-tools"
  },
  {
    id: "remote_mcp",
    name: "Remote MCP",
    class: "integration",
    description: "Connect models to external tools exposed through MCP servers.",
    providerBacked: true,
    actionGated: true,
    sourceRef: "openai-api-responses-tools"
  },
  {
    id: "connected_apps",
    name: "Connected apps / connectors",
    class: "integration",
    description: "Search, reference or act in supported connected services subject to permissions.",
    providerBacked: true,
    actionGated: true,
    sourceRef: "openai-help-apps"
  },
  {
    id: "app_rich_ui",
    name: "Rich app UI",
    class: "app_ui",
    description: "Interactive app-provided cards, maps, playlists or other rich in-chat experiences.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-help-apps"
  },
  {
    id: "moderation_text_image",
    name: "Text and image moderation",
    class: "safety",
    description: "Classify text and image inputs for potentially harmful content.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-moderation"
  },
  {
    id: "evals_graders",
    name: "Evals and graders",
    class: "evaluation",
    description: "Programmatically evaluate model or artifact quality against defined criteria.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-evals-graders"
  },
  {
    id: "embeddings_vector_search",
    name: "Embeddings and vector retrieval",
    class: "retrieval",
    description: "Represent content semantically for retrieval and similarity workflows.",
    providerBacked: true,
    actionGated: false,
    sourceRef: "openai-api-model-catalog-embeddings"
  }
];

export const GENESIS_CREATION_RECIPE_REGISTRY: GenesisCreationRecipe[] = [
  {
    id: "visualize_learning",
    name: "Visualize Learning",
    description: "Interactive explanatory representation of a concept or process.",
    requiredCapabilities: ["code_block", "html_preview"],
    optionalCapabilities: ["svg_preview", "mermaid_preview", "image_generation", "interactive_chart"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["education", "dynamic", "causal", "interactive"]
  },
  {
    id: "handwritten_note",
    name: "Handwritten Note",
    description: "Study-note visual that resembles a handwritten learning sheet.",
    requiredCapabilities: ["image_generation"],
    optionalCapabilities: ["writing_block"],
    defaultPolicy: "AUTO_DRAFT",
    tags: ["memory", "study", "visual"]
  },
  {
    id: "sticky_board",
    name: "Sticky Board",
    description: "Visual checklist or action board made of discrete sticky-note tasks.",
    requiredCapabilities: ["html_preview"],
    optionalCapabilities: ["image_generation", "writing_block"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["procedure", "checklist", "action"]
  },
  {
    id: "info_chart",
    name: "Info Chart",
    description: "Compact visual explanation of thresholds, ranges, categories or metrics.",
    requiredCapabilities: ["interactive_chart"],
    optionalCapabilities: ["vega_lite_preview", "svg_preview"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["numeric", "threshold", "comparison"]
  },
  {
    id: "infographic",
    name: "Infographic",
    description: "Visual synthesis of a multi-part topic or system.",
    requiredCapabilities: ["html_preview"],
    optionalCapabilities: ["svg_preview", "image_generation"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["hierarchy", "ecosystem", "synthesis"]
  },
  {
    id: "concept_map",
    name: "Concept Map",
    description: "Relationship map between concepts and sub-concepts.",
    requiredCapabilities: ["mermaid_preview"],
    optionalCapabilities: ["svg_preview"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["relationships", "learning", "hierarchy"]
  },
  {
    id: "mind_map",
    name: "Mind Map",
    description: "Radial or tree-like exploration of a topic.",
    requiredCapabilities: ["html_preview"],
    optionalCapabilities: ["svg_preview", "mermaid_preview"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["brainstorm", "hierarchy", "learning"]
  },
  {
    id: "flowchart",
    name: "Flowchart",
    description: "Flow-based representation of a process or decision logic.",
    requiredCapabilities: ["mermaid_preview"],
    optionalCapabilities: ["svg_preview"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["process", "logic", "decision"]
  },
  {
    id: "timeline",
    name: "Timeline",
    description: "Chronological or sequential representation.",
    requiredCapabilities: ["html_preview"],
    optionalCapabilities: ["mermaid_preview"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["sequence", "history", "process"]
  },
  {
    id: "process_map",
    name: "Process Map",
    description: "Operational steps, roles and transitions.",
    requiredCapabilities: ["mermaid_preview"],
    optionalCapabilities: ["html_preview"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["process", "operations"]
  },
  {
    id: "decision_tree",
    name: "Decision Tree",
    description: "Branching choices and consequences.",
    requiredCapabilities: ["mermaid_preview"],
    optionalCapabilities: ["html_preview"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["decision", "logic"]
  },
  {
    id: "comparison_matrix",
    name: "Comparison Matrix",
    description: "Structured side-by-side comparison across dimensions.",
    requiredCapabilities: ["writing_block"],
    optionalCapabilities: ["html_preview"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["comparison", "decision"]
  },
  {
    id: "flashcards",
    name: "Flashcards",
    description: "Recall-oriented cards for memorization.",
    requiredCapabilities: ["html_preview"],
    optionalCapabilities: ["writing_block", "text_to_speech"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["memory", "study"]
  },
  {
    id: "quiz",
    name: "Quiz",
    description: "Interactive assessment of understanding.",
    requiredCapabilities: ["html_preview"],
    optionalCapabilities: ["structured_output_json_schema"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["assessment", "education"]
  },
  {
    id: "worksheet",
    name: "Worksheet",
    description: "Editable learning or work exercise sheet.",
    requiredCapabilities: ["writing_block"],
    optionalCapabilities: ["html_preview"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["education", "practice"]
  },
  {
    id: "study_guide",
    name: "Study Guide",
    description: "Structured revision document with concepts and checkpoints.",
    requiredCapabilities: ["writing_block"],
    optionalCapabilities: ["flashcards", "text_to_speech"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["education", "memory"]
  },
  {
    id: "annotated_diagram",
    name: "Annotated Diagram",
    description: "Labeled visual explanation of a system, object or process.",
    requiredCapabilities: ["svg_preview"],
    optionalCapabilities: ["image_generation"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["visual", "explanation"]
  },
  {
    id: "labeled_image",
    name: "Labeled Image",
    description: "Image with explanatory labels or callouts.",
    requiredCapabilities: ["image_generation"],
    optionalCapabilities: ["image_edit"],
    defaultPolicy: "AUTO_DRAFT",
    tags: ["visual", "image"]
  },
  {
    id: "storyboard",
    name: "Storyboard",
    description: "Sequence of visual frames for a narrative or process.",
    requiredCapabilities: ["image_generation"],
    optionalCapabilities: ["video_generation"],
    defaultPolicy: "AUTO_DRAFT",
    tags: ["story", "motion"]
  },
  {
    id: "comic_explainer",
    name: "Comic Explainer",
    description: "Multi-panel illustrated explanation.",
    requiredCapabilities: ["image_generation"],
    optionalCapabilities: ["writing_block"],
    defaultPolicy: "AUTO_DRAFT",
    tags: ["education", "story", "image"]
  },
  {
    id: "poster",
    name: "Poster",
    description: "Single-page visual communication artifact.",
    requiredCapabilities: ["image_generation"],
    optionalCapabilities: ["svg_preview"],
    defaultPolicy: "AUTO_DRAFT",
    tags: ["visual", "communication"]
  },
  {
    id: "interactive_simulation",
    name: "Interactive Simulation",
    description: "Manipulable bounded model showing how variables affect an outcome.",
    requiredCapabilities: ["code_block", "html_preview"],
    optionalCapabilities: ["react_preview", "interactive_chart"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["dynamic", "causal", "interactive"]
  },
  {
    id: "calculator",
    name: "Calculator",
    description: "Interactive numeric calculator based on explicit formulas or bounded operations.",
    requiredCapabilities: ["code_block", "html_preview"],
    optionalCapabilities: ["code_interpreter"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["numeric", "interactive"]
  },
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Multi-metric operational or analytical view.",
    requiredCapabilities: ["html_preview", "interactive_chart"],
    optionalCapabilities: ["react_preview", "vega_lite_preview"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["data", "operations", "decision"]
  },
  {
    id: "data_story",
    name: "Data Story",
    description: "Narrative plus charts explaining a dataset or trend.",
    requiredCapabilities: ["code_interpreter", "interactive_chart"],
    optionalCapabilities: ["writing_block", "vega_lite_preview"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["data", "analysis", "story"]
  },
  {
    id: "chart_pack",
    name: "Chart Pack",
    description: "A coordinated set of charts for trends and comparisons.",
    requiredCapabilities: ["interactive_chart"],
    optionalCapabilities: ["vega_preview", "vega_lite_preview", "code_interpreter"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["data", "numeric", "comparison"]
  },
  {
    id: "map_explorer",
    name: "Map Explorer",
    description: "Interactive spatial exploration when a map provider is available.",
    requiredCapabilities: ["app_rich_ui"],
    optionalCapabilities: ["html_preview"],
    defaultPolicy: "SUGGEST",
    tags: ["spatial", "map"]
  },
  {
    id: "evidence_panel",
    name: "Evidence Panel",
    description: "Claims, citations, contradictions and source lineage in one view.",
    requiredCapabilities: ["writing_block"],
    optionalCapabilities: ["file_search", "web_search"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["evidence", "research"]
  },
  {
    id: "executive_brief",
    name: "Executive Brief",
    description: "Concise editable brief with decisions, evidence and next actions.",
    requiredCapabilities: ["writing_block"],
    optionalCapabilities: ["interactive_chart"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["executive", "decision"]
  },
  {
    id: "one_pager",
    name: "One Pager",
    description: "Single-page concise explanatory or commercial document.",
    requiredCapabilities: ["writing_block"],
    optionalCapabilities: ["image_generation", "interactive_chart"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["document", "summary"]
  },
  {
    id: "editable_document",
    name: "Editable Document",
    description: "Reusable long-form editable document.",
    requiredCapabilities: ["writing_block"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["document", "writing"]
  },
  {
    id: "prototype_html",
    name: "HTML Prototype",
    description: "Executable interactive mini-app or UI prototype in HTML.",
    requiredCapabilities: ["code_block", "html_preview"],
    optionalCapabilities: ["svg_preview"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["prototype", "code", "interactive"]
  },
  {
    id: "prototype_react",
    name: "React Prototype",
    description: "Interactive component prototype using React preview.",
    requiredCapabilities: ["code_block", "react_preview"],
    optionalCapabilities: ["html_preview"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["prototype", "code", "interactive"]
  },
  {
    id: "voice_explainer",
    name: "Voice Explainer",
    description: "Spoken explanation or audio lesson.",
    requiredCapabilities: ["text_to_speech"],
    optionalCapabilities: ["writing_block"],
    defaultPolicy: "AUTO_DRAFT",
    tags: ["audio", "narration", "learning"]
  },
  {
    id: "narrated_visual",
    name: "Narrated Visual",
    description: "Visual artifact combined with generated narration.",
    requiredCapabilities: ["image_generation", "text_to_speech"],
    optionalCapabilities: ["video_generation"],
    defaultPolicy: "AUTO_DRAFT",
    tags: ["audio", "visual"]
  },
  {
    id: "video_explainer",
    name: "Video Explainer",
    description: "Short explanatory video built from an evidence-backed script.",
    requiredCapabilities: ["video_generation"],
    optionalCapabilities: ["text_to_speech", "image_generation"],
    defaultPolicy: "AUTO_DRAFT",
    tags: ["video", "motion", "education"]
  },
  {
    id: "research_report",
    name: "Research Report",
    description: "Cited multi-source report built from current or complex evidence.",
    requiredCapabilities: ["deep_research", "web_search", "writing_block"],
    optionalCapabilities: ["file_search"],
    defaultPolicy: "AUTO_DRAFT",
    tags: ["research", "citations"]
  },
  {
    id: "meeting_digest",
    name: "Meeting Digest",
    description: "Transcript, speakers, summary, decisions and action items.",
    requiredCapabilities: ["speech_to_text", "speaker_diarization", "writing_block"],
    optionalCapabilities: ["structured_output_json_schema"],
    defaultPolicy: "AUTO_DRAFT",
    tags: ["audio", "meeting", "actions"]
  },
  {
    id: "transcript_timeline",
    name: "Transcript Timeline",
    description: "Chronological representation of a recorded conversation.",
    requiredCapabilities: ["speech_to_text", "html_preview"],
    optionalCapabilities: ["speaker_diarization"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["audio", "timeline"]
  },
  {
    id: "action_checklist",
    name: "Action Checklist",
    description: "Operational checklist generated from decisions or procedures.",
    requiredCapabilities: ["writing_block"],
    optionalCapabilities: ["connected_apps", "remote_mcp"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["action", "procedure"]
  },
  {
    id: "structured_json",
    name: "Structured JSON Contract",
    description: "Strict machine-readable output aligned to a JSON Schema.",
    requiredCapabilities: ["structured_output_json_schema"],
    optionalCapabilities: ["function_calling"],
    defaultPolicy: "AUTO_RENDER",
    tags: ["machine", "schema", "api"]
  }
];

const capabilityById = new Map(
  OPENAI_CAPABILITY_REGISTRY.map(item => [item.id, item] as const)
);
const recipeById = new Map(
  GENESIS_CREATION_RECIPE_REGISTRY.map(item => [item.id, item] as const)
);

function recipe(id: string): GenesisCreationRecipe {
  const found = recipeById.get(id);
  if (!found) throw new Error(`GENESIS_RECIPE_NOT_FOUND:${id}`);
  return found;
}

function addScore(
  scores: Map<string, number>,
  reasons: Map<string, string[]>,
  id: string,
  score: number,
  reason: string
) {
  scores.set(id, (scores.get(id) ?? 0) + score);
  const current = reasons.get(id) ?? [];
  current.push(reason);
  reasons.set(id, current);
}

function confidenceFromScore(score: number): number {
  if (score >= 120) return 0.97;
  if (score >= 100) return 0.94;
  if (score >= 80) return 0.9;
  if (score >= 60) return 0.78;
  if (score >= 40) return 0.68;
  return 0.55;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function collectPrimitiveCapabilities(
  recipes: GenesisCreationRecipe[],
  request: CreationCapabilityRequest
): OpenAICapability[] {
  const ids = recipes.flatMap(item => [
    ...item.requiredCapabilities,
    ...(item.optionalCapabilities ?? [])
  ]);

  const s = request.signals;

  if (s.currentInformation) ids.push("web_search");
  if (s.multiSourceResearch) ids.push("deep_research", "web_search");
  if (s.internalFiles) ids.push("file_search", "file_pdf_understanding");
  if (s.codePrototype) ids.push("code_block", "html_preview", "react_preview");
  if (s.machineReadable || s.strictSchema) ids.push("structured_output_json_schema");
  if (s.audioInput) ids.push("speech_to_text");
  if (s.multiSpeaker) ids.push("speaker_diarization");
  if (s.audioOutput || s.narration) ids.push("text_to_speech");
  if (s.realtime) ids.push("realtime_multimodal");
  if (s.realtime && s.audioInput && s.audioOutput) ids.push("realtime_speech_to_speech");
  if (s.translation && s.realtime) ids.push("realtime_translation");
  if (s.externalSystemAction) ids.push("function_calling", "remote_mcp", "connected_apps");
  if (s.interactiveUi && s.externalSystemAction) ids.push("computer_use");
  if (s.imageCreation) ids.push("image_generation");
  if (s.imageEdit) ids.push("image_edit", "image_inpaint");
  if (s.storyMotion) ids.push("video_generation");
  if (s.dataAnalysis) ids.push("code_interpreter", "interactive_chart");
  if (s.safetyReview) ids.push("moderation_text_image");
  if (s.qualityEvaluation) ids.push("evals_graders");
  if (s.semanticRetrieval) ids.push("embeddings_vector_search");

  return unique(ids)
    .map(id => capabilityById.get(id))
    .filter((item): item is OpenAICapability => Boolean(item));
}

function evaluateRecipes(request: CreationCapabilityRequest) {
  const scores = new Map<string, number>();
  const reasons = new Map<string, string[]>();
  const s = request.signals;

  if (s.handwrittenRequested) {
    addScore(scores, reasons, "handwritten_note", 140, "Explicit handwritten-style request.");
  }
  if (s.memorization) {
    addScore(scores, reasons, "handwritten_note", 45, "Memorization benefits from a compact study note.");
    addScore(scores, reasons, "flashcards", 55, "Recall practice detected.");
    addScore(scores, reasons, "study_guide", 35, "Revision-oriented objective detected.");
  }
  if (s.dynamicProcess) {
    addScore(scores, reasons, "visualize_learning", 80, "Dynamic process detected.");
    addScore(scores, reasons, "interactive_simulation", 70, "Manipulable process representation may help.");
    addScore(scores, reasons, "flowchart", 25, "Process flow is a safe fallback.");
  }
  if (s.causal) {
    addScore(scores, reasons, "visualize_learning", 40, "Causal relationships detected.");
    addScore(scores, reasons, "interactive_simulation", 30, "Causal variables may benefit from manipulation.");
  }
  if (s.educational) {
    addScore(scores, reasons, "visualize_learning", 25, "Educational intent detected.");
    addScore(scores, reasons, "infographic", 20, "Visual synthesis can support learning.");
    addScore(scores, reasons, "quiz", 15, "Assessment may reinforce understanding.");
  }
  if (s.interactionHelpful) {
    addScore(scores, reasons, "visualize_learning", 25, "Interaction is explicitly useful.");
    addScore(scores, reasons, "interactive_simulation", 35, "Interactive manipulation requested.");
  }
  if (s.procedural) {
    addScore(scores, reasons, "sticky_board", 75, "Procedural content detected.");
    addScore(scores, reasons, "process_map", 55, "Operational sequence detected.");
    addScore(scores, reasons, "action_checklist", 45, "Action-oriented procedure detected.");
  }
  if (s.checklist) {
    addScore(scores, reasons, "sticky_board", 70, "Checklist request detected.");
    addScore(scores, reasons, "action_checklist", 60, "Checklist can be rendered as an action list.");
  }
  if (s.thresholds) {
    addScore(scores, reasons, "info_chart", 100, "Threshold/range interpretation detected.");
  }
  if (s.quantitative) {
    addScore(scores, reasons, "info_chart", 50, "Quantitative content detected.");
    addScore(scores, reasons, "chart_pack", 45, "Chart representation fits quantitative evidence.");
    addScore(scores, reasons, "dashboard", 35, "Multiple metrics can support a dashboard.");
    addScore(scores, reasons, "calculator", 30, "Numeric interaction may be useful when a formula exists.");
  }
  if (s.comparative) {
    addScore(scores, reasons, "comparison_matrix", 65, "Comparison intent detected.");
    addScore(scores, reasons, "info_chart", 40, "Visual comparison detected.");
    addScore(scores, reasons, "chart_pack", 30, "Charts can expose relative differences.");
  }
  if (s.hierarchical) {
    addScore(scores, reasons, "infographic", 70, "Hierarchical topic structure detected.");
    addScore(scores, reasons, "concept_map", 60, "Concept hierarchy detected.");
    addScore(scores, reasons, "mind_map", 50, "Exploratory hierarchy detected.");
  }
  if (s.ecosystem) {
    addScore(scores, reasons, "infographic", 70, "Ecosystem / multi-part system detected.");
    addScore(scores, reasons, "concept_map", 45, "Relationships between components detected.");
    addScore(scores, reasons, "mind_map", 45, "System decomposition detected.");
  }
  if (s.spatial) {
    addScore(scores, reasons, "map_explorer", 100, "Spatial intent detected.");
    addScore(scores, reasons, "annotated_diagram", 35, "Diagram is a provider-independent fallback.");
  }
  if (s.currentInformation && s.multiSourceResearch) {
    addScore(scores, reasons, "research_report", 140, "Current multi-source research with citations detected.");
    addScore(scores, reasons, "evidence_panel", 50, "Evidence comparison is useful.");
  } else if (s.currentInformation) {
    addScore(scores, reasons, "research_report", 70, "Current information requires grounded research.");
  } else if (s.internalFiles) {
    addScore(scores, reasons, "research_report", 70, "Internal evidence synthesis detected.");
    addScore(scores, reasons, "evidence_panel", 60, "Internal evidence can be shown with lineage.");
  }
  if (s.codePrototype && s.interactiveUi) {
    addScore(scores, reasons, "prototype_react", 130, "Interactive UI prototype detected.");
    addScore(scores, reasons, "prototype_html", 115, "HTML prototype is a portable alternative.");
  } else if (s.codePrototype) {
    addScore(scores, reasons, "prototype_html", 110, "Executable code prototype detected.");
    addScore(scores, reasons, "prototype_react", 90, "React may be useful for componentized UI.");
  }
  if (s.machineReadable && s.strictSchema) {
    addScore(scores, reasons, "structured_json", 150, "Strict machine-readable contract detected.");
  } else if (s.machineReadable) {
    addScore(scores, reasons, "structured_json", 100, "Machine-readable output requested.");
  }
  if (s.audioInput && s.multiSpeaker && s.actionItems) {
    addScore(scores, reasons, "meeting_digest", 150, "Multi-speaker meeting with action extraction detected.");
    addScore(scores, reasons, "transcript_timeline", 70, "Chronological transcript is a useful alternative.");
  } else if (s.audioInput) {
    addScore(scores, reasons, "transcript_timeline", 80, "Audio input detected.");
  }
  if (s.realtime && s.translation) {
    addScore(scores, reasons, "voice_explainer", 55, "Realtime translated voice experience detected.");
  }
  if (s.narration && s.visual) {
    addScore(scores, reasons, "narrated_visual", 110, "Visual plus narration requested.");
  } else if (s.narration || s.audioOutput) {
    addScore(scores, reasons, "voice_explainer", 100, "Spoken delivery requested.");
  }
  if (s.storyMotion) {
    addScore(scores, reasons, "video_explainer", 125, "Motion/storytelling request detected.");
    addScore(scores, reasons, "storyboard", 70, "Storyboard is a useful pre-video artifact.");
  }
  if (s.imageCreation) {
    addScore(scores, reasons, "labeled_image", 70, "Image creation requested.");
    addScore(scores, reasons, "poster", 40, "Single visual communication artifact may fit.");
  }
  if (s.dataAnalysis) {
    addScore(scores, reasons, "data_story", 110, "Data analysis request detected.");
    addScore(scores, reasons, "dashboard", 80, "Metrics may benefit from an operational dashboard.");
    addScore(scores, reasons, "chart_pack", 70, "Multiple charts can expose trends.");
  }
  if (s.externalSystemAction) {
    addScore(scores, reasons, "action_checklist", 70, "External system action requires an explicit action plan.");
  }

  if (scores.size === 0) {
    addScore(scores, reasons, "editable_document", 35, "No stronger representation signal detected.");
    if (s.visual) addScore(scores, reasons, "infographic", 25, "Visual preference detected.");
  }

  return { scores, reasons };
}

export function recommendCreationCapabilities(
  request: CreationCapabilityRequest
): CreationCapabilityRecommendation {
  if (!request || typeof request !== "object") {
    throw new Error("CAPABILITY_RECOMMENDATION_INVALID_REQUEST");
  }
  if (typeof request.intent !== "string" || !request.intent.trim()) {
    throw new Error("CAPABILITY_RECOMMENDATION_INVALID_INTENT");
  }
  if (typeof request.objective !== "string" || !request.objective.trim()) {
    throw new Error("CAPABILITY_RECOMMENDATION_INVALID_OBJECTIVE");
  }
  if (!request.signals || typeof request.signals !== "object") {
    throw new Error("CAPABILITY_RECOMMENDATION_INVALID_SIGNALS");
  }

  const { scores, reasons } = evaluateRecipes(request);
  const ranked = [...scores.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));

  const primaryId = ranked[0]![0];
  const primaryScore = ranked[0]![1];
  const primaryRecipe = recipe(primaryId);
  const alternativeRecipes = ranked
    .slice(1, 4)
    .map(([id]) => recipe(id))
    .filter(item => item.id !== primaryRecipe.id);

  // Ensure materially useful alternatives for seed educational modes.
  if (request.signals.handwrittenRequested && request.signals.dynamicProcess &&
      !alternativeRecipes.some(item => item.id === "interactive_simulation")) {
    alternativeRecipes.unshift(recipe("interactive_simulation"));
  }
  if (request.signals.hierarchical && request.signals.ecosystem) {
    for (const id of ["concept_map", "mind_map"]) {
      if (!alternativeRecipes.some(item => item.id === id) && primaryRecipe.id !== id) {
        alternativeRecipes.push(recipe(id));
      }
    }
  }

  const confidence = confidenceFromScore(primaryScore);
  let policy: CapabilityExecutionPolicy;
  if (request.signals.externalSystemAction || request.signals.mutation) {
    policy = "ACTION_GATED";
  } else if (confidence >= 0.85) {
    policy = primaryRecipe.defaultPolicy;
  } else {
    policy = "SUGGEST";
  }

  const selectedRecipes = [primaryRecipe, ...alternativeRecipes.slice(0, 3)];
  const primitiveCapabilities = collectPrimitiveCapabilities(selectedRecipes, request);
  const guardrails: string[] = [];

  if (request.domain === "health") {
    guardrails.push("HEALTH_CONTEXT_REQUIRES_NON_DIAGNOSTIC_BOUNDARY");
  }
  if (request.signals.externalSystemAction || request.signals.mutation) {
    guardrails.push("EXTERNAL_MUTATION_REQUIRES_AUTHORIZATION");
  }
  if (primitiveCapabilities.some(item => item.providerBacked)) {
    guardrails.push("PROVIDER_AVAILABILITY_AND_COST_APPLY");
  }
  if (primitiveCapabilities.some(item => item.actionGated)) {
    guardrails.push("ACTION_CAPABILITY_REQUIRES_APPROVAL_WHEN_APPLICABLE");
  }

  return {
    registryVersion: OPENAI_CAPABILITY_REGISTRY_VERSION,
    primaryRecipe,
    alternativeRecipes: alternativeRecipes.slice(0, 3),
    primitiveCapabilities,
    confidence,
    policy,
    triggerReasons: unique(reasons.get(primaryRecipe.id) ?? []),
    guardrails,
    truthState: "CAPABILITY_RECOMMENDATION_ONLY"
  };
}
