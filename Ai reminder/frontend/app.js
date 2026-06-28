const taskList = document.getElementById("task-list");
const taskForm = document.getElementById("task-form");
const toast = document.getElementById("toast");

const statTotal = document.getElementById("stat-total");
const statCompleted = document.getElementById("stat-completed");
const statPending = document.getElementById("stat-pending");
const statStreak = document.getElementById("stat-streak");
const coachMessage = document.getElementById("coach-message");
const speechSupported =
  "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const voiceBtn = document.getElementById("voice-btn");
const micTestBtn = document.getElementById("mic-test-btn");
const voiceStatus = document.getElementById("voice-status");
const voiceTranscript = document.getElementById("voice-transcript");
const handsFreeToggle = document.getElementById("hands-free-toggle");
const voiceGrid = document.getElementById("voice-grid");
const voiceLanguageSelect = document.getElementById("voice-language");
const toneButtons = document.getElementById("tone-buttons");
const voicePreviewBtn = document.getElementById("voice-preview-btn");
const voiceStopBtn = document.getElementById("voice-stop-btn");
const voiceDiagStatus = document.getElementById("voice-diag-status");
const voiceDiagList = document.getElementById("voice-diag-list");
const voiceSettings = document.getElementById("voice-settings");
const voiceTabBtn = document.getElementById("voice-tab-btn");

const API_BASE = (() => {
  const override = window.API_BASE || localStorage.getItem("apiBase");
  if (override) {
    return override.replace(/\/$/, "");
  }
  const { hostname, port, protocol } = window.location;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  if (isLocalhost && port && port !== "8000") {
    return `${protocol}//${hostname}:8000`;
  }
  return "";
})();

function apiUrl(path) {
  if (!API_BASE) {
    return path;
  }
  return `${API_BASE}${path}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function speakWithSettings(message, settings) {
  if (!speechSupported) {
    return;
  }
  const voice = pickVoice(settings);
  const utterance = new SpeechSynthesisUtterance(message);
  if (settings.language) {
    utterance.lang = settings.language;
  }
  if (voice) {
    utterance.voice = voice;
  }
  if (settings.tone) {
    const tone = TONE_PRESETS[settings.tone];
    if (tone) {
      utterance.rate = tone.rate;
      utterance.pitch = tone.pitch;
      utterance.volume = tone.volume;
    }
  }
  window.speechSynthesis.speak(utterance);
}

function speakMessage(message) {
  const settings = getVoiceSettings();
  speakWithSettings(message, settings);
}

function speakPrompt(message) {
  lastPrompt = message;
  ignoreResultsUntil = Date.now() + Math.min(6000, Math.max(1200, message.length * 35));
  stopPreview();
  speakMessage(message);
}

const VOICE_PRESETS = [
  {
    id: "jerry",
    label: "Jerry",
    traits: ["direct", "motivating"],
    languages: ["en", "hi", "bn", "or"],
    previewText: {
      en: "Hi, I am Jerry. Let us knock out your next task.",
      hi: "नमस्ते, मैं जेरी हूँ। चलिए आपका अगला काम पूरा करते हैं।",
      bn: "হ্যালো, আমি জেরি। চলুন আপনার পরের কাজটি শেষ করি।",
      or: "ନମସ୍କାର, ମୁଁ ଜେରି। ଆମେ ଆପଣଙ୍କର ପରବର୍ତ୍ତୀ କାମଟି ସମାପ୍ତ କରିବା।",
    },
    match: ["jerry", "ryan", "david", "guy"],
  },
  {
    id: "nova",
    label: "Nova",
    traits: ["warm", "friendly"],
    languages: ["en", "es", "hi", "bn", "or"],
    previewText: {
      en: "Hey! I am Nova. We can do this together.",
      es: "Hola, soy Nova. Podemos lograrlo juntos.",
      hi: "नमस्ते, मैं नोवा हूँ। हम इसे साथ में कर सकते हैं।",
      bn: "হ্যালো, আমি নোভা। আমরা এটা একসাথে করতে পারি।",
      or: "ନମସ୍କାର, ମୁଁ ନୋଭା। ଆମେ ଏହା ସହିତ କରିପାରିବୁ।",
    },
    match: ["aria", "jenny", "samantha", "zira"],
  },
  {
    id: "atlas",
    label: "Atlas",
    traits: ["calm", "structured"],
    languages: ["en", "fr", "hi", "bn", "or"],
    previewText: {
      en: "Hello, I am Atlas. Focus on one task at a time.",
      fr: "Bonjour, je suis Atlas. Concentrons-nous sur une tâche.",
      hi: "नमस्ते, मैं एटलस हूँ। एक समय में एक काम पर ध्यान दें।",
      bn: "হ্যালো, আমি অ্যাটলাস। এক সময়ে এক কাজেই মন দিন।",
      or: "ନମସ୍କାର, ମୁଁ ଆଟଲାସ। ଗୋଟିଏ ସମୟରେ ଗୋଟିଏ କାମରେ ଧ୍ୟାନ ଦିଅନ୍ତୁ।",
    },
    match: ["mark", "thomas", "alan", "pierre"],
  },
  {
    id: "luna",
    label: "Luna",
    traits: ["gentle", "supportive"],
    languages: ["en", "hi", "bn", "or"],
    previewText: {
      en: "Hi, I am Luna. I will keep your routine steady.",
      hi: "नमस्ते, मैं लूना हूँ। आपकी दिनचर्या को स्थिर रखें।",
      bn: "হ্যালো, আমি লুনা। আপনার রুটিন স্থির রাখবো।",
      or: "ନମସ୍କାର, ମୁଁ ଲୁନା। ଆପଣଙ୍କ ରୁଟିନ୍‌କୁ ଷ୍ଟେଡି ରଖିବି।",
    },
    match: ["susan", "heera", "kat", "sarah"],
  },
  {
    id: "blaze",
    label: "Blaze",
    traits: ["energetic", "bold"],
    languages: ["en", "es", "hi", "bn", "or"],
    previewText: {
      en: "Yo, I am Blaze. Let us move fast and finish strong.",
      es: "Soy Blaze. Vamos rápido y terminamos fuerte.",
      hi: "नमस्ते, मैं ब्लेज़ हूँ। तेज़ चलते हैं और मजबूती से खत्म करते हैं।",
      bn: "হ্যালো, আমি ব্লেজ। দ্রুত এগোই আর শক্তভাবে শেষ করি।",
      or: "ନମସ୍କାର, ମୁଁ ବ୍ଲେଜ୍। ଶୀଘ୍ର ଆଗକୁ ବଢ଼ିବା ଏବଂ ଭଲଭାବେ ସମାପ୍ତ କରିବା।",
    },
    match: ["steffan", "guy", "pablo", "diego"],
  },
  {
    id: "sage",
    label: "Sage",
    traits: ["professional", "clear"],
    languages: ["en", "fr", "hi", "bn", "or"],
    previewText: {
      en: "Hello, I am Sage. Your plan is ready to execute.",
      fr: "Bonjour, je suis Sage. Votre plan est prêt.",
      hi: "नमस्ते, मैं सेज हूँ। आपकी योजना तैयार है।",
      bn: "হ্যালো, আমি সেজ। আপনার পরিকল্পনা প্রস্তুত।",
      or: "ନମସ୍କାର, ମୁଁ ସେଜ୍। ଆପଣଙ୍କର ଯୋଜନା ପ୍ରସ୍ତୁତ।",
    },
    match: ["aria", "julie", "claude", "michelle"],
  },
];

const LANGUAGE_LABELS = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  or: "Odia",
  es: "Spanish",
  fr: "French",
};

const TONE_PRESETS = {
  friendly: { label: "Friendly", rate: 1.05, pitch: 1.1, volume: 1 },
  professional: { label: "Professional", rate: 0.98, pitch: 1.0, volume: 1 },
  calm: { label: "Calm", rate: 0.9, pitch: 0.95, volume: 0.95 },
};

const LANGUAGE_MESSAGES = {
  en: {
    remindFirst: "Sir, I am {name}. Please do your task properly: {task}.",
    remindRepeat: "Sir, I am {name}. Please do your task properly.",
    completed: "Thank you sir for doing your task.",
    intro: "Sir, I am {name}.",
    pendingSummary: "Pending tasks are: {tasks}.",
    pendingReminder: "Sir, your task is pending.",
    noPending: "Sir, you have no pending tasks.",
  },
  hi: {
    remindFirst: "सर, मैं {name} हूँ। कृपया अपना काम ठीक से करें: {task}।",
    remindRepeat: "सर, मैं {name} हूँ। कृपया अपना काम ठीक से करें।",
    completed: "सर, आपका काम पूरा करने के लिए धन्यवाद।",
    intro: "सर, मैं {name} हूँ।",
    pendingSummary: "बाकी कार्य हैं: {tasks}।",
    pendingReminder: "सर, आपका कार्य बाकी है।",
    noPending: "सर, कोई भी कार्य बाकी नहीं है।",
  },
  bn: {
    remindFirst: "স্যার, আমি {name}। অনুগ্রহ করে আপনার কাজ ঠিকভাবে করুন: {task}।",
    remindRepeat: "স্যার, আমি {name}। অনুগ্রহ করে আপনার কাজ ঠিকভাবে করুন।",
    completed: "স্যার, আপনার কাজ শেষ করার জন্য ধন্যবাদ।",
    intro: "স্যার, আমি {name}।",
    pendingSummary: "বাকি কাজগুলো হলো: {tasks}।",
    pendingReminder: "স্যার, আপনার কাজ বাকি আছে।",
    noPending: "স্যার, কোনো কাজ বাকি নেই।",
  },
  or: {
    remindFirst: "ସାର୍, ମୁଁ {name}। ଦୟାକରି ଆପଣଙ୍କର କାମଟି ଭଲଭାବେ କରନ୍ତୁ: {task}।",
    remindRepeat: "ସାର୍, ମୁଁ {name}। ଦୟାକରି ଆପଣଙ୍କର କାମଟି ଭଲଭାବେ କରନ୍ତୁ।",
    completed: "ସାର୍, ଆପଣଙ୍କ କାମ ସମାପ୍ତ କରିଥିବା ପାଇଁ ଧନ୍ୟବାଦ।",
    intro: "ସାର୍, ମୁଁ {name}।",
    pendingSummary: "ବାକି କାମଗୁଡିକ ହେଲା: {tasks}।",
    pendingReminder: "ସାର୍, ଆପଣଙ୍କ କାମ ବାକି ଅଛି।",
    noPending: "ସାର୍, କିଛି କାମ ବାକି ନାହିଁ।",
  },
  es: {
    remindFirst: "Señor, soy {name}. Por favor haga su tarea correctamente: {task}.",
    remindRepeat: "Señor, soy {name}. Por favor haga su tarea correctamente.",
    completed: "Gracias, señor, por hacer su tarea.",
    intro: "Señor, soy {name}.",
    pendingSummary: "Las tareas pendientes son: {tasks}.",
    pendingReminder: "Señor, su tarea está pendiente.",
    noPending: "Señor, no tiene tareas pendientes.",
  },
  fr: {
    remindFirst: "Monsieur, je suis {name}. Veuillez faire votre tâche correctement : {task}.",
    remindRepeat: "Monsieur, je suis {name}. Veuillez faire votre tâche correctement.",
    completed: "Merci, monsieur, d'avoir fait votre tâche.",
    intro: "Monsieur, je suis {name}.",
    pendingSummary: "Les tâches en attente sont : {tasks}.",
    pendingReminder: "Monsieur, votre tâche est en attente.",
    noPending: "Monsieur, vous n'avez aucune tâche en attente.",
  },
};

function getVoiceSettings() {
  const raw = localStorage.getItem("voiceSettings");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.voiceId && parsed.language && parsed.tone) {
        return parsed;
      }
    } catch (err) {
      // ignore
    }
  }
  return {
    voiceId: VOICE_PRESETS[0].id,
    language: VOICE_PRESETS[0].languages[0],
    tone: "friendly",
  };
}

function saveVoiceSettings(settings) {
  localStorage.setItem("voiceSettings", JSON.stringify(settings));
}

function getPresetById(id) {
  return VOICE_PRESETS.find((preset) => preset.id === id) || VOICE_PRESETS[0];
}

function getAvailableVoices() {
  return window.speechSynthesis.getVoices();
}

function checkLanguageSupport(lang) {
  const voices = getAvailableVoices();
  const prefix = lang.toLowerCase();
  return voices.some((voice) => voice.lang.toLowerCase().startsWith(prefix));
}

function updateDiagnostics() {
  if (!voiceDiagList || !voiceDiagStatus) {
    return;
  }
  const voices = getAvailableVoices();
  if (!voices.length) {
    voiceDiagStatus.textContent =
      "No system voices found yet. Try refreshing the page.";
    voiceDiagList.innerHTML = "";
    return;
  }

  const settings = getVoiceSettings();
  const preset = getPresetById(settings.voiceId);
  const languages = preset.languages;
  voiceDiagList.innerHTML = "";
  languages.forEach((lang) => {
    const item = document.createElement("li");
    item.className = "voice-diag-item";
    const label = document.createElement("span");
    label.textContent = `${LANGUAGE_LABELS[lang] || lang.toUpperCase()} (${lang})`;
    const badge = document.createElement("span");
    badge.className = "voice-diag-badge";
    if (checkLanguageSupport(lang)) {
      badge.classList.add("ok");
      badge.textContent = "Available";
    } else {
      badge.classList.add("warn");
      badge.textContent = "Missing OS voice";
    }
    item.appendChild(label);
    item.appendChild(badge);
    voiceDiagList.appendChild(item);
  });

  const currentOk = checkLanguageSupport(settings.language);
  voiceDiagStatus.textContent = currentOk
    ? "Selected language is supported by your system."
    : "Selected language is missing a system voice. It may fall back to English.";
}

function pickVoice(settings) {
  const preset = getPresetById(settings.voiceId);
  const voices = getAvailableVoices();
  if (!voices.length) {
    return null;
  }
  const langPrefix = settings.language ? settings.language.toLowerCase() : "";
  const matches = preset.match || [];
  const byName = voices.find((voice) => {
    if (langPrefix && !voice.lang.toLowerCase().startsWith(langPrefix)) {
      return false;
    }
    return matches.some((term) => voice.name.toLowerCase().includes(term));
  });
  if (byName) {
    return byName;
  }
  if (langPrefix) {
    return voices.find((voice) => voice.lang.toLowerCase().startsWith(langPrefix)) || null;
  }
  return voices[0] || null;
}

function buildVoiceGrid() {
  if (!voiceGrid) {
    return;
  }
  const settings = getVoiceSettings();
  voiceGrid.innerHTML = "";
  VOICE_PRESETS.forEach((preset) => {
    const card = document.createElement("div");
    card.className = "voice-card-option";
    if (preset.id === settings.voiceId) {
      card.classList.add("active");
    }
    const title = document.createElement("h4");
    title.textContent = preset.label;
    const traits = document.createElement("div");
    traits.className = "voice-traits";
    preset.traits.forEach((trait) => {
      const chip = document.createElement("span");
      chip.textContent = trait;
      traits.appendChild(chip);
    });
    const preview = document.createElement("button");
    preview.className = "btn ghost";
    preview.type = "button";
    preview.textContent = "Preview";
    preview.addEventListener("click", (event) => {
      event.stopPropagation();
      previewVoice(preset.id);
    });
    card.appendChild(title);
    card.appendChild(traits);
    card.appendChild(preview);
    card.addEventListener("click", () => {
      updateVoiceSelection(preset.id);
    });
    voiceGrid.appendChild(card);
  });
}

function buildLanguageOptions() {
  if (!voiceLanguageSelect) {
    return;
  }
  const settings = getVoiceSettings();
  const preset = getPresetById(settings.voiceId);
  voiceLanguageSelect.innerHTML = "";
  preset.languages.forEach((lang) => {
    const option = document.createElement("option");
    option.value = lang;
    option.textContent = LANGUAGE_LABELS[lang] || lang.toUpperCase();
    voiceLanguageSelect.appendChild(option);
  });
  voiceLanguageSelect.value = settings.language || preset.languages[0];
  updateDiagnostics();
}

function buildToneButtons() {
  if (!toneButtons) {
    return;
  }
  const settings = getVoiceSettings();
  toneButtons.innerHTML = "";
  Object.entries(TONE_PRESETS).forEach(([key, tone]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tone-btn";
    button.textContent = tone.label;
    if (key === settings.tone) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => {
      updateTone(key);
    });
    toneButtons.appendChild(button);
  });
}

function updateVoiceSelection(voiceId) {
  const settings = getVoiceSettings();
  settings.voiceId = voiceId;
  const preset = getPresetById(voiceId);
  if (!preset.languages.includes(settings.language)) {
    settings.language = preset.languages[0];
  }
  saveVoiceSettings(settings);
  buildVoiceGrid();
  buildLanguageOptions();
  buildToneButtons();
  previewVoice(voiceId);
  updateDiagnostics();
}

function updateLanguage(lang) {
  const settings = getVoiceSettings();
  settings.language = lang;
  saveVoiceSettings(settings);
  updateDiagnostics();
}

function updateTone(toneKey) {
  const settings = getVoiceSettings();
  settings.tone = toneKey;
  saveVoiceSettings(settings);
  buildToneButtons();
  previewVoice(settings.voiceId);
}

function previewVoice(voiceId) {
  if (!speechSupported) {
    showToast("Voice preview is not supported in this browser.");
    return;
  }
  stopPreview();
  const settings = getVoiceSettings();
  const previewSettings = { ...settings, voiceId: voiceId || settings.voiceId };
  const preset = getPresetById(previewSettings.voiceId);
  const lang = preset.languages.includes(previewSettings.language)
    ? previewSettings.language
    : preset.languages[0];
  previewSettings.language = lang;
  const text = preset.previewText[lang] || preset.previewText.en || "Hello.";
  speakWithSettings(text, previewSettings);
}

function stopPreview() {
  if (!speechSupported) {
    return;
  }
  window.speechSynthesis.cancel();
}

function getLanguageMessage(language) {
  return LANGUAGE_MESSAGES[language] || LANGUAGE_MESSAGES.en;
}

function buildReminderMessage(taskTitle, isRepeat) {
  const settings = getVoiceSettings();
  const preset = getPresetById(settings.voiceId);
  const langKey = settings.language || "en";
  const messageSet = getLanguageMessage(langKey);
  const template = isRepeat ? messageSet.remindRepeat : messageSet.remindFirst;
  return template
    .replace("{name}", preset.label)
    .replace("{task}", taskTitle);
}

function buildCompletedMessage() {
  const settings = getVoiceSettings();
  const langKey = settings.language || "en";
  const messageSet = getLanguageMessage(langKey);
  return messageSet.completed;
}

function buildIntroMessage() {
  const settings = getVoiceSettings();
  const preset = getPresetById(settings.voiceId);
  const langKey = settings.language || "en";
  const messageSet = getLanguageMessage(langKey);
  return messageSet.intro.replace("{name}", preset.label);
}

function buildPendingMessages(tasks) {
  const settings = getVoiceSettings();
  const langKey = settings.language || "en";
  const messageSet = getLanguageMessage(langKey);
  const pending = tasks.filter((task) => !task.completed_today && task.enabled);
  if (!pending.length) {
    return [messageSet.noPending];
  }
  const titles = pending.slice(0, 4).map((task) => task.title);
  const summary = messageSet.pendingSummary.replace("{tasks}", titles.join(", "));
  const reminder = messageSet.pendingReminder;
  return [summary, reminder];
}

function parseTime(input) {
  const raw = input.toLowerCase();
  if (raw.includes("noon")) {
    return "12:00";
  }
  if (raw.includes("midnight")) {
    return "00:00";
  }

  const cleaned = raw
    .toLowerCase()
    .replace(/a\.m\.|am/g, " am")
    .replace(/p\.m\.|pm/g, " pm")
    .replace(/[^0-9apm: ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const match = cleaned.match(/(\d{1,2})(?:[: ](\d{1,2}))?\s*(am|pm)?/);
  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  let minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3];

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }
  if (minute > 59 || hour > 23) {
    return null;
  }

  if (meridiem === "pm" && hour < 12) {
    hour += 12;
  }
  if (meridiem === "am" && hour === 12) {
    hour = 0;
  }

  if (hour < 0 || hour > 23) {
    return null;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function extractInterval(text) {
  const match = text.match(
    /(?:every|interval|remind me every)\s+(\d+)\s*(?:second|seconds|sec)/i
  );
  if (!match) {
    return { interval: null, text };
  }
  const interval = Number(match[1]);
  const trimmed = text.replace(match[0], "").trim();
  return { interval: Number.isNaN(interval) ? null : interval, text: trimmed };
}

function extractCategory(text) {
  const match = text.match(/(?:category|for)\s+([a-z0-9 ]+)/i);
  if (!match) {
    return { category: null, text };
  }
  const category = match[1].trim();
  const trimmed = text.replace(match[0], "").trim();
  return { category: category || null, text: trimmed };
}

function extractTime(text) {
  const match = text.match(
    /(?:\bat\b|@)\s+([0-9: apm\.]+)/i
  );
  if (!match) {
    return { time: null, text };
  }
  const time = parseTime(match[1]);
  const trimmed = text.replace(match[0], "").trim();
  return { time, text: trimmed };
}

function cleanCommandPrefix(text) {
  return text
    .replace(
      /^(add task|add|create task|create|new task|schedule|remind me to|remind me)\s+/i,
      ""
    )
    .trim();
}

function parseVoiceCommand(text) {
  let working = text.toLowerCase().replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim();
  working = cleanCommandPrefix(working);

  const intervalResult = extractInterval(working);
  working = intervalResult.text;

  const timeResult = extractTime(working);
  working = timeResult.text;

  const categoryResult = extractCategory(working);
  working = categoryResult.text;

  const title = working.trim();
  if (!title) {
    return { error: "I did not catch the task name." };
  }
  if (!timeResult.time) {
    return { error: "I did not catch the time. Try saying 'at 3 pm'." };
  }

  return {
    title,
    category: categoryResult.category || "General",
    time: timeResult.time,
    reminder_interval: intervalResult.interval || 10,
  };
}

async function createTaskFromVoice(payload) {
  await fetchJSON("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const tasks = await fetchJSON("/api/tasks");
  await refresh();
  const intro = buildIntroMessage();
  const [summary, reminder] = buildPendingMessages(tasks);
  speakMessage(intro);
  speakMessage(summary);
  speakMessage(reminder);
}

function normalizeCategory(text) {
  if (!text) {
    return null;
  }
  const cleaned = text.toLowerCase();
  if (cleaned.includes("study")) {
    return "Study";
  }
  if (cleaned.includes("workout") || cleaned.includes("work out") || cleaned.includes("exercise")) {
    return "Workout";
  }
  if (cleaned.includes("coding") || cleaned.includes("code") || cleaned.includes("coading")) {
    return "Coding";
  }
  return null;
}

function startGuidedFlow() {
  guidedFlow = {
    step: 0,
    data: {
      title: "",
      category: "",
      time: "",
      reminder_interval: 10,
    },
  };
  voiceTranscript.textContent = "";
  const prompt = "What task do you want to add?";
  showToast(prompt);
  speakPrompt(prompt);
  setListeningState(true);
  if (voiceStatus) {
    voiceStatus.textContent = prompt;
  }
}

function stopGuidedFlow(message) {
  guidedFlow = null;
  if (message) {
    showToast(message);
    speakMessage(message);
  }
}

async function handleGuidedResponse(text) {
  if (!guidedFlow) {
    return;
  }

  const cleaned = text.toLowerCase().trim();
  if (!cleaned || cleaned === lastPrompt.toLowerCase()) {
    return;
  }
  if (cleaned.includes("cancel") || cleaned.includes("stop")) {
    stopGuidedFlow("Okay, cancelled.");
    return;
  }

  if (guidedFlow.step === 0) {
    let working = text
      .toLowerCase()
      .replace(/[.,!?]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    working = cleanCommandPrefix(working);
    const intervalResult = extractInterval(working);
    working = intervalResult.text;
    const timeResult = extractTime(working);
    working = timeResult.text;
    const categoryResult = extractCategory(working);
    working = categoryResult.text;
    const titleCandidate = working.trim();
    guidedFlow.data.title = titleCandidate || text.trim();
    guidedFlow.step = 1;
    const prompt = "Which category? Study, workout, or coding.";
    showToast(prompt);
    speakPrompt(prompt);
    if (voiceStatus) {
      voiceStatus.textContent = prompt;
    }
    return;
  }

  if (guidedFlow.step === 1) {
    const category = normalizeCategory(cleaned);
    if (!category) {
      const prompt = "Please say study, workout, or coding.";
      showToast(prompt);
      speakPrompt(prompt);
      if (voiceStatus) {
        voiceStatus.textContent = prompt;
      }
      return;
    }
    guidedFlow.data.category = category;
    guidedFlow.step = 2;
    const prompt = "What time should I remind you?";
    showToast(prompt);
    speakPrompt(prompt);
    if (voiceStatus) {
      voiceStatus.textContent = prompt;
    }
    return;
  }

  if (guidedFlow.step === 2) {
    const time = parseTime(cleaned);
    if (!time) {
      const prompt = "Please say a time, for example 3 pm or 14 30.";
      showToast(prompt);
      speakPrompt(prompt);
      if (voiceStatus) {
        voiceStatus.textContent = prompt;
      }
      return;
    }
    guidedFlow.data.time = time;
    guidedFlow.step = 3;
    const prompt = "Reminder interval in seconds?";
    showToast(prompt);
    speakPrompt(prompt);
    if (voiceStatus) {
      voiceStatus.textContent = prompt;
    }
    return;
  }

  if (guidedFlow.step === 3) {
    const match = cleaned.match(/(\d+)/);
    const interval = match ? Number(match[1]) : NaN;
    if (!interval || interval < 1) {
      const prompt = "Please say a number of seconds, like 30.";
      showToast(prompt);
      speakPrompt(prompt);
      if (voiceStatus) {
        voiceStatus.textContent = prompt;
      }
      return;
    }
    guidedFlow.data.reminder_interval = interval;
    const payload = { ...guidedFlow.data };
    guidedFlow = null;
    await createTaskFromVoice(payload);
    const confirmation = `Added ${payload.title} at ${payload.time}.`;
    showToast(confirmation);
    speakMessage(confirmation);
  }
}

async function fetchJSON(url, options) {
  const endpoint = url.startsWith("http") ? url : `${API_BASE}${url}`;
  const res = await fetch(endpoint, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Request failed");
  }
  return res.json();
}

async function loadStats() {
  const stats = await fetchJSON("/api/stats");
  statTotal.textContent = stats.total_tasks;
  statCompleted.textContent = stats.completed_today;
  statPending.textContent = stats.pending_today;
  statStreak.textContent = stats.streak;
  coachMessage.textContent = stats.coach_message;
}

function taskTemplate(task) {
  const template = document.getElementById("task-item-template");
  const node = template.content.cloneNode(true);
  const item = node.querySelector(".task-item");
  const title = node.querySelector(".task-title");
  const meta = node.querySelector(".task-meta");
  const time = node.querySelector(".task-time");

  title.textContent = task.title;
  meta.textContent = `${task.category} \u2022 every ${task.reminder_interval} sec`;
  time.textContent = task.time;

  if (task.completed_today) {
    item.classList.add("done");
    node.querySelector(".complete").textContent = "Completed";
  }

  node.querySelector(".complete").addEventListener("click", async () => {
    if (task.completed_today) {
      await fetchJSON(`/api/tasks/${task.id}/uncomplete`, { method: "POST" });
      showToast("Marked as pending");
    } else {
      await fetchJSON(`/api/tasks/${task.id}/complete`, { method: "POST" });
      const message = buildCompletedMessage();
      showToast(message);
      stopPreview();
      speakMessage(message);
    }
    await refresh();
  });

  node.querySelector(".delete").addEventListener("click", async () => {
    await fetchJSON(`/api/tasks/${task.id}`, { method: "DELETE" });
    showToast("Task deleted");
    await refresh();
  });

  node.querySelector(".edit").addEventListener("click", async () => {
    const titleInput = window.prompt("Task name", task.title);
    if (!titleInput) {
      return;
    }
    const categoryInput = window.prompt("Category", task.category);
    if (!categoryInput) {
      return;
    }
    const timeInput = window.prompt("Time (HH:MM)", task.time);
    if (!timeInput) {
      return;
    }
    const intervalInput = window.prompt(
      "Reminder interval in seconds",
      task.reminder_interval
    );
    const intervalValue = Number(intervalInput);
    if (!intervalValue || intervalValue < 1) {
      showToast("Invalid interval");
      return;
    }

    await fetchJSON(`/api/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: titleInput,
        category: categoryInput,
        time: timeInput,
        reminder_interval: intervalValue,
      }),
    });
    showToast("Task updated");
    await refresh();
  });

  return node;
}

async function loadTasks() {
  const tasks = await fetchJSON("/api/tasks");
  taskList.innerHTML = "";

  if (tasks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "task-item";
    empty.textContent = "No tasks yet. Add one to get started.";
    taskList.appendChild(empty);
    return;
  }

  tasks.forEach((task) => {
    taskList.appendChild(taskTemplate(task));
  });

  return tasks;
}

async function refresh() {
  await Promise.all([loadTasks(), loadStats()]);
}

let reminderPolling = false;
let reminderHistory = { date: "", counts: {} };
async function pollReminders() {
  if (reminderPolling) {
    return;
  }
  reminderPolling = true;
  try {
    const due = await fetchJSON("/api/reminders/due");
    if (Array.isArray(due) && due.length) {
      const today = new Date().toISOString().slice(0, 10);
      if (reminderHistory.date !== today) {
        reminderHistory = { date: today, counts: {} };
      }
      due.forEach((item) => {
        const count = reminderHistory.counts[item.id] || 0;
        const message = buildReminderMessage(item.title, count > 0);
        reminderHistory.counts[item.id] = count + 1;
        showToast(message);
        speakMessage(message);
      });
    }
  } catch (err) {
    // Ignore reminder errors to avoid blocking the UI.
  } finally {
    reminderPolling = false;
  }
}

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(taskForm);
  const payload = Object.fromEntries(formData.entries());
  payload.reminder_interval = Number(payload.reminder_interval);

  await fetchJSON("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  taskForm.reset();
  showToast("Task added. You got this.");
  const tasks = await fetchJSON("/api/tasks");
  await refresh();
  const intro = buildIntroMessage();
  const [summary, reminder] = buildPendingMessages(tasks);
  speakMessage(intro);
  speakMessage(summary);
  speakMessage(reminder);
});

refresh();
pollReminders();
setInterval(pollReminders, 2000);

if (voiceLanguageSelect) {
  voiceLanguageSelect.addEventListener("change", (event) => {
    updateLanguage(event.target.value);
    previewVoice();
  });
}

if (voicePreviewBtn) {
  voicePreviewBtn.addEventListener("click", () => previewVoice());
}

if (voiceStopBtn) {
  voiceStopBtn.addEventListener("click", () => stopPreview());
}

function initVoiceUI() {
  buildVoiceGrid();
  buildLanguageOptions();
  buildToneButtons();
  updateDiagnostics();
}

if (speechSupported) {
  window.speechSynthesis.onvoiceschanged = () => {
    initVoiceUI();
  };
}

initVoiceUI();

function setVoicePanelState(collapsed) {
  if (!voiceSettings || !voiceTabBtn) {
    return;
  }
  voiceSettings.classList.toggle("collapsed", collapsed);
  voiceTabBtn.textContent = collapsed ? "Expand" : "Collapse";
  localStorage.setItem("voicePanelCollapsed", collapsed ? "1" : "0");
}

if (voiceSettings && voiceTabBtn) {
  const saved = localStorage.getItem("voicePanelCollapsed");
  setVoicePanelState(saved !== "0");
  voiceTabBtn.addEventListener("click", () => {
    const isCollapsed = voiceSettings.classList.contains("collapsed");
    setVoicePanelState(!isCollapsed);
  });
}

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognizer = null;
let listening = false;
let micPermissionChecked = false;
let voiceMode = "command";
let testTranscript = "";
let handsFreeEnabled = false;
let wakeArmedUntil = 0;
let activeSource = null;
let guidedFlow = null;
let ignoreResultsUntil = 0;
let lastPrompt = "";

function setListeningState(active) {
  listening = active;
  if (!voiceBtn) {
    return;
  }
  voiceBtn.classList.toggle("voice-active", active);
  voiceBtn.textContent = active ? "Stop Listening" : "Start Listening";
  if (active) {
    if (guidedFlow && lastPrompt) {
      voiceStatus.textContent = lastPrompt;
      return;
    }
    voiceStatus.textContent =
      voiceMode === "test"
        ? "Mic test: say a short phrase."
          : handsFreeEnabled
          ? "Hands-free on. Say 'hey jerry' to start."
          : "Listening... say your task.";
  } else {
    voiceStatus.textContent =
      "Say: \"Add task drink water at 3 pm every 60 seconds\".";
  }
}

function hasWakeWord(text) {
  return /\bhey\s+jerry\b/i.test(text) || /\bhey\b/i.test(text);
}

function stripWakeWord(text) {
  return text
    .replace(/\bhey\s+jerry\b/i, "")
    .replace(/\bhey\b/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isWakeWindowActive() {
  return wakeArmedUntil && Date.now() <= wakeArmedUntil;
}

function armWakeWindow() {
  wakeArmedUntil = Date.now() + 8000;
  const prompt = "I'm listening. Say the task.";
  showToast(prompt);
  speakPrompt(prompt);
}

function startRecognizer(source) {
  if (!recognizer) {
    return;
  }
  activeSource = source;
  try {
    recognizer.start();
  } catch (err) {
    // Ignore duplicate start errors.
  }
}

async function handleVoiceText(text) {
  voiceTranscript.textContent = `Heard: "${text}"`;
  const parsed = parseVoiceCommand(text);
  if (parsed.error) {
    showToast(parsed.error);
    speakMessage(parsed.error);
    return;
  }

  try {
    await createTaskFromVoice(parsed);
    const confirmation = `Added ${parsed.title} at ${parsed.time}.`;
    showToast(confirmation);
    speakMessage(confirmation);
  } catch (err) {
    showToast("Could not add the task. Please try again.");
  }
}

if (voiceBtn) {
  if (!SpeechRecognition) {
    voiceBtn.disabled = true;
    voiceStatus.textContent = "Voice commands not supported in this browser.";
  } else {
    recognizer = new SpeechRecognition();
    recognizer.lang = "en-US";
    recognizer.interimResults = true;
    recognizer.continuous = true;

    recognizer.addEventListener("result", (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      voiceTranscript.textContent = `Heard: "${transcript.trim()}"`;
      if (!event.results[event.results.length - 1].isFinal) {
        return;
      }

      const finalText = transcript.trim();
      if (Date.now() < ignoreResultsUntil) {
        return;
      }
      if (voiceMode === "test") {
        testTranscript = finalText;
        if (testTranscript) {
          const message = `Mic test heard: ${testTranscript}`;
          showToast(message);
          speakMessage(message);
        }
        voiceMode = "command";
        return;
      }

      if (guidedFlow) {
        handleGuidedResponse(finalText);
        return;
      }

      if (handsFreeEnabled) {
        if (isWakeWindowActive()) {
          wakeArmedUntil = 0;
          handleGuidedResponse(finalText);
          return;
        }
        if (hasWakeWord(finalText)) {
          const remainder = stripWakeWord(finalText);
          if (remainder) {
            startGuidedFlow();
            handleGuidedResponse(remainder);
          } else {
            startGuidedFlow();
          }
        }
        return;
      }

      handleVoiceText(finalText);
    });

    recognizer.addEventListener("start", () => setListeningState(true));
    recognizer.addEventListener("end", () => {
      if (voiceMode === "test" && !testTranscript) {
        showToast("Mic test: no speech detected.");
        voiceMode = "command";
      }
      testTranscript = "";
      setListeningState(false);
      if (handsFreeEnabled) {
        startRecognizer("handsfree");
      } else {
        activeSource = null;
      }
    });
    recognizer.addEventListener("error", (event) => {
      if (voiceMode === "test") {
        voiceMode = "command";
      }
      setListeningState(false);
      showToast(`Voice error: ${event.error}`);
    });

    async function requestMicPermission() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return true;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        return true;
      } catch (err) {
        showToast("Microphone permission denied.");
        voiceStatus.textContent = "Microphone permission denied. Please allow access.";
        return false;
      }
    }

    voiceBtn.addEventListener("click", async () => {
      if (!micPermissionChecked) {
        micPermissionChecked = true;
        const ok = await requestMicPermission();
        if (!ok) {
          return;
        }
      }

      if (listening) {
        recognizer.stop();
      } else {
        voiceMode = "command";
        startRecognizer("manual");
      }
    });

    if (micTestBtn) {
      micTestBtn.addEventListener("click", async () => {
        if (!micPermissionChecked) {
          micPermissionChecked = true;
          const ok = await requestMicPermission();
          if (!ok) {
            return;
          }
        }
        if (listening) {
          recognizer.stop();
        }
        voiceMode = "test";
        testTranscript = "";
        startRecognizer("test");
        setTimeout(() => {
          if (listening) {
            recognizer.stop();
          }
        }, 4000);
      });
    }

    if (handsFreeToggle) {
      handsFreeToggle.addEventListener("change", async () => {
        handsFreeEnabled = handsFreeToggle.checked;
        if (!handsFreeEnabled) {
          if (activeSource === "handsfree") {
            recognizer.stop();
          }
          wakeArmedUntil = 0;
          guidedFlow = null;
          return;
        }

        if (!micPermissionChecked) {
          micPermissionChecked = true;
          const ok = await requestMicPermission();
          if (!ok) {
            handsFreeToggle.checked = false;
            handsFreeEnabled = false;
            return;
          }
        }

        if (!listening) {
          startRecognizer("handsfree");
        }
        voiceStatus.textContent = "Hands-free on. Say 'hey jerry' to start.";
      });
    }
  }
}
