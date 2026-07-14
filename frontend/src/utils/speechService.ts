export interface SpeechOptions {
  lang?: string;
  voiceType?: string;
  rate?: number;
  volume?: number;
  pitch?: number;
  seniorMode?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
  /** Speech category for priority ordering */
  category?: SpeechCategory;
  /** Higher priority wins; lower-priority speech won't interrupt higher */
  priority?: number;
  /** Dedupe key — same key won't repeat within cooldown window */
  dedupeKey?: string;
  /** Called after voice is resolved with actual result */
  onVoiceResolved?: (result: VoiceResolveResult) => void;
}

export type SpeechCategory =
  | 'navigation_warning'   // off-route, safety — highest
  | 'navigation_turn'      // turn-by-turn instructions
  | 'arrival'              // station arrival
  | 'next_station'         // continue to next station
  | 'ambient_narration'    // auto spot narration along the way
  | 'chat'                 // normal chat TTS
  | 'test';                // voice preview/test

export interface VoicePreset {
  id: string;
  label: string;
  genderPreference: 'male' | 'female';
  preferredVoiceNames: string[];
  preferredKeywords: string[];
  excludedKeywords: string[];
  lang: string;
  defaultRate: number;
  defaultPitch: number;
  fallbackStrategy: string;
}

export interface VoiceResolveResult {
  voice: SpeechSynthesisVoice | null;
  requestedPreset: string;
  resolvedVoiceName: string;
  resolvedVoiceLang: string;
  fallbackUsed: boolean;
  fallbackReason: string;
  genderMatched: boolean;
}

/** Priority constants — higher number = higher priority */
export const SPEECH_PRIORITY: Record<SpeechCategory, number> = {
  navigation_warning: 100,
  navigation_turn: 90,
  arrival: 80,
  next_station: 70,
  ambient_narration: 50,
  chat: 30,
  test: 20,
};

const SPEECH_DEDUP_MS = 3000;
const AMBIENT_DEDUP_MS = 120_000; // 2 min — trip-level dedup for ambient narration
const COOLDOWN_MS = 600;

type SpeechVoice = SpeechSynthesisVoice;

const clamp = (value: number | undefined, min: number, max: number, fallback: number) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(Math.max(next, min), max);
};

// ============================================================
// VOICE_PRESETS — the single source of truth for all 4 voices
// ============================================================

export const VOICE_PRESETS: Record<string, VoicePreset> = {
  '温柔女声': {
    id: 'gentle-female',
    label: '温柔女声',
    genderPreference: 'female',
    preferredVoiceNames: ['Microsoft Xiaoxiao', 'Xiaoxiao', '晓晓', 'Microsoft Xiaoyi', 'Xiaoyi', '晓伊', 'Huihui', 'Tingting'],
    preferredKeywords: ['female', 'woman', 'girl', 'xiaoxiao', 'xiaoyi', 'huihui', 'tingting', 'mei'],
    excludedKeywords: ['male', 'man', 'boy', 'yunxi', 'yunyang', 'yunjian', 'kangkang'],
    lang: 'zh-CN',
    defaultRate: 0.95,
    defaultPitch: 1.05,
    fallbackStrategy: 'preferred-name -> keyword -> female-heuristic -> Chinese fallback -> any voice',
  },
  '亲切男声': {
    id: 'warm-male',
    label: '亲切男声',
    genderPreference: 'male',
    preferredVoiceNames: ['Microsoft Yunxi', 'Yunxi', '云希', 'Microsoft Kangkang', 'Kangkang', '康康', 'Microsoft Yunyang', 'Yunyang', '云扬'],
    preferredKeywords: ['male', 'man', 'boy', 'yunxi', 'kangkang', 'yunyang'],
    excludedKeywords: ['female', 'woman', 'girl', 'xiaoxiao', 'xiaoyi', 'yaoyao', 'huihui', 'tingting'],
    lang: 'zh-CN',
    defaultRate: 1.0,
    defaultPitch: 1.0,
    fallbackStrategy: 'preferred-name -> keyword -> male-heuristic -> Chinese fallback -> any voice',
  },
  '活力女声': {
    id: 'lively-female',
    label: '活力女声',
    genderPreference: 'female',
    preferredVoiceNames: ['Microsoft Yaoyao', 'Yaoyao', '瑶瑶', 'Microsoft Xiaoyi', 'Xiaoyi', '晓伊', 'Microsoft Xiaoxiao', 'Xiaoxiao', '晓晓'],
    preferredKeywords: ['female', 'woman', 'girl', 'yaoyao', 'xiaoyi', 'xiaoxiao', 'lively'],
    excludedKeywords: ['male', 'man', 'boy', 'yunxi', 'yunyang', 'yunjian', 'kangkang'],
    lang: 'zh-CN',
    defaultRate: 1.12,
    defaultPitch: 1.1,
    fallbackStrategy: 'preferred-name -> keyword -> female-heuristic -> Chinese fallback -> any voice',
  },
  '沉稳男声': {
    id: 'steady-male',
    label: '沉稳男声',
    genderPreference: 'male',
    preferredVoiceNames: ['Microsoft Yunyang', 'Yunyang', '云扬', 'Microsoft Yunjian', 'Yunjian', '云健', 'Microsoft Yunxi', 'Yunxi', '云希'],
    preferredKeywords: ['male', 'man', 'baritone', 'deep', 'steady', 'yunyang', 'yunjian', 'yunxi'],
    excludedKeywords: ['female', 'woman', 'girl', 'xiaoxiao', 'xiaoyi', 'yaoyao', 'huihui', 'tingting'],
    lang: 'zh-CN',
    defaultRate: 0.9,
    defaultPitch: 0.95,
    fallbackStrategy: 'preferred-name -> keyword -> male-heuristic -> Chinese fallback -> any voice',
  },
};

/** Heuristic female-indicating keywords in voice names */
const FEMALE_HINTS = ['female', 'woman', 'girl', 'xiaoxiao', 'xiaoyi', 'huihui', 'yaoyao', 'tingting', 'mei', 'tongtong', 'shasha', 'wanwan', '晓晓', '晓伊', '瑶瑶'];

/** Heuristic male-indicating keywords in voice names */
const MALE_HINTS = ['male', 'man', 'boy', 'yunxi', 'kangkang', 'yunyang', 'yunjian', 'qiang', 'feng', 'dong', 'gang', 'xiong', '云希', '康康', '云扬', '云健'];

// ============================================================
// Voice loading
// ============================================================

const loadVoices = (callback: (voices: SpeechVoice[]) => void) => {
  const synth = window.speechSynthesis;
  const current = synth.getVoices();
  if (current.length > 0) {
    callback(current);
    return;
  }

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    if (typeof synth.removeEventListener === 'function') {
      synth.removeEventListener('voiceschanged', finish);
    } else if (synth.onvoiceschanged === finish) {
      synth.onvoiceschanged = null;
    }
    callback(synth.getVoices());
  };

  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', finish, { once: true });
  } else {
    synth.onvoiceschanged = finish;
  }
  window.setTimeout(finish, 350);
};

// ============================================================
// resolveVoice — single entry point for all voice resolution
// ============================================================

export const resolveVoice = (
  voiceType: string | undefined,
  availableVoices: SpeechVoice[],
): VoiceResolveResult => {
  const preset = voiceType ? VOICE_PRESETS[voiceType] : undefined;
  const zhVoices = availableVoices.filter(v =>
    v.lang.toLowerCase().startsWith('zh-CN') ||
    v.lang.toLowerCase().startsWith('zh-Hans') ||
    v.lang.toLowerCase().startsWith('zh-TW') ||
    v.lang.toLowerCase().startsWith('zh-HK') ||
    v.lang.toLowerCase().startsWith('zh'),
  );
  const candidates = zhVoices.length > 0
    ? zhVoices
    : availableVoices.filter(v => v.lang.toLowerCase().startsWith('zh') || v.lang.toLowerCase().startsWith('cmn'));

  const genderMatches = (voice: SpeechVoice | null, gender: 'male' | 'female') => {
    if (!voice) return false;
    const haystack = `${voice.name} ${voice.voiceURI}`.toLowerCase();
    const hints = gender === 'male' ? MALE_HINTS : FEMALE_HINTS;
    const excluded = gender === 'male' ? FEMALE_HINTS : MALE_HINTS;
    return hints.some(hint => haystack.includes(hint.toLowerCase()))
      && !excluded.some(hint => haystack.includes(hint.toLowerCase()));
  };

  const isExcluded = (voice: SpeechVoice, presetValue: VoicePreset) => {
    const haystack = `${voice.name} ${voice.voiceURI} ${voice.lang}`.toLowerCase();
    return presetValue.excludedKeywords.some(kw => haystack.includes(kw.toLowerCase()));
  };

  const fallbackResult = (reason: string, usedVoice: SpeechVoice | null, presetValue?: VoicePreset): VoiceResolveResult => ({
    voice: usedVoice,
    requestedPreset: presetValue?.label || voiceType || '未指定',
    resolvedVoiceName: usedVoice?.name || '无可用语音',
    resolvedVoiceLang: usedVoice?.lang || '—',
    fallbackUsed: true,
    fallbackReason: reason,
    genderMatched: presetValue ? genderMatches(usedVoice, presetValue.genderPreference) : false,
  });

  if (!preset) {
    // No matching preset — return best available Chinese voice
    const best = candidates[0] || availableVoices[0] || null;
    return fallbackResult(`未找到音色预设 "${voiceType || '未指定'}"`, best);
  }

  if (candidates.length === 0) {
    const any = availableVoices[0] || null;
    return fallbackResult('设备未提供任何中文语音', any, preset);
  }

  // Step 1: try exact name match
  const byName = candidates.find(v =>
    !isExcluded(v, preset) &&
    preset.preferredVoiceNames.some(name =>
      v.name.toLowerCase().includes(name.toLowerCase()),
    ),
  );
  if (byName) {
    return {
      voice: byName,
      requestedPreset: preset.label,
      resolvedVoiceName: byName.name,
      resolvedVoiceLang: byName.lang,
      fallbackUsed: false,
      fallbackReason: '',
      genderMatched: genderMatches(byName, preset.genderPreference),
    };
  }

  // Step 2: try keyword match
  const byKeyword = candidates.find(v => {
    const haystack = `${v.name} ${v.voiceURI} ${v.lang}`.toLowerCase();
    return !isExcluded(v, preset) && preset.preferredKeywords.some(kw => haystack.includes(kw.toLowerCase()));
  });
  if (byKeyword) {
    return {
      voice: byKeyword,
      requestedPreset: preset.label,
      resolvedVoiceName: byKeyword.name,
      resolvedVoiceLang: byKeyword.lang,
      fallbackUsed: false,
      fallbackReason: '',
      genderMatched: genderMatches(byKeyword, preset.genderPreference),
    };
  }

  // Step 3: gender-based heuristic match
  if (preset.genderPreference === 'female') {
    const femaleVoice = candidates.find(v => {
      return genderMatches(v, 'female') && !isExcluded(v, preset);
    });
    if (femaleVoice) {
      // Found a Chinese female voice — close enough
      return {
        voice: femaleVoice,
        requestedPreset: preset.label,
        resolvedVoiceName: femaleVoice.name,
        resolvedVoiceLang: femaleVoice.lang,
        fallbackUsed: true,
        fallbackReason: `未精确匹配"${preset.label}"的预设名称，已使用同性别中文语音`,
        genderMatched: true,
      };
    }
  }

  if (preset.genderPreference === 'male') {
    const maleVoice = candidates.find(v => {
      return genderMatches(v, 'male') && !isExcluded(v, preset);
    });
    if (maleVoice) {
      return {
        voice: maleVoice,
        requestedPreset: preset.label,
        resolvedVoiceName: maleVoice.name,
        resolvedVoiceLang: maleVoice.lang,
        fallbackUsed: true,
        fallbackReason: `未精确匹配"${preset.label}"的预设名称，已使用同性别中文语音`,
        genderMatched: true,
      };
    }
  }

  // Step 4: ultimate fallback — any Chinese voice
  const anyZH = candidates[0];
  return fallbackResult(
    `当前设备未提供"${preset.label}"对应${preset.genderPreference === 'male' ? '男' : '女'}声，已使用可用中文语音`,
    anyZH,
    preset,
  );
};

// ============================================================
// SpeechService singleton
// ============================================================

let currentSpeechPriority = -1;
const recentSpeechKeys = new Map<string, number>();
let lastSpeechAt = 0;

const flushStaleDedupKeys = () => {
  const now = Date.now();
  for (const [key, ts] of recentSpeechKeys) {
    if (now - ts > SPEECH_DEDUP_MS * 3) recentSpeechKeys.delete(key);
  }
};

export const speechService = {
  isSupported() {
    return typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && 'SpeechSynthesisUtterance' in window;
  },

  cancel() {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
    currentSpeechPriority = -1;
  },

  /** Cancel only if current speech priority is below the given threshold */
  cancelIfBelow(priority: number) {
    if (currentSpeechPriority >= 0 && currentSpeechPriority < priority) {
      this.cancel();
    }
  },

  speak(text: string, options: SpeechOptions = {}): boolean {
    if (!text?.trim() || !this.isSupported()) return false;

    const priority = options.priority ?? SPEECH_PRIORITY[options.category || 'chat'];
    const dedupeKey = options.dedupeKey;

    // Dedup check — longer window for ambient narration (trip-level dedup)
    if (dedupeKey) {
      flushStaleDedupKeys();
      const lastTs = recentSpeechKeys.get(dedupeKey);
      const windowMs = dedupeKey.startsWith('ambient:') ? AMBIENT_DEDUP_MS : SPEECH_DEDUP_MS;
      if (lastTs && Date.now() - lastTs < windowMs) {
        return false; // already spoken recently
      }
    }

    // Cooldown check (prevent rapid-fire)
    if (Date.now() - lastSpeechAt < COOLDOWN_MS && priority < SPEECH_PRIORITY.navigation_warning) {
      return false;
    }

    // Priority check — don't interrupt higher-priority speech
    if (priority < currentSpeechPriority) return false;

    // OK to speak — cancel current, set new priority
    window.speechSynthesis.cancel();
    currentSpeechPriority = priority;
    lastSpeechAt = Date.now();
    if (dedupeKey) recentSpeechKeys.set(dedupeKey, Date.now());

    loadVoices((voices) => {
      const voiceResult = resolveVoice(options.voiceType, voices);
      const preset = options.voiceType ? VOICE_PRESETS[options.voiceType] : undefined;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.lang || 'zh-CN';

      // Apply preset-specific rate/pitch, overridden by explicit options
      const effectiveRate = options.rate ?? preset?.defaultRate ?? 1;
      const effectivePitch = options.pitch ?? preset?.defaultPitch ?? 1;

      utterance.rate = options.seniorMode
        ? Math.min(clamp(effectiveRate, 0.5, 2, 1), 0.82)
        : clamp(effectiveRate, 0.5, 2, 1);
      utterance.volume = clamp(options.volume, 0, 1, 0.9);
      utterance.pitch = clamp(effectivePitch, 0, 2, 1);

      if (voiceResult.voice) utterance.voice = voiceResult.voice;

      const resetPriority = () => { currentSpeechPriority = -1; };

      utterance.onstart = () => {
        options.onStart?.();
      };
      utterance.onend = () => {
        resetPriority();
        options.onEnd?.();
      };
      utterance.onerror = () => {
        resetPriority();
        options.onError?.();
      };

      // Fire voice resolution callback
      if (options.onVoiceResolved) {
        options.onVoiceResolved(voiceResult);
      }

      window.speechSynthesis.speak(utterance);
    });

    return true;
  },

  /** Resolve voice synchronously if voices are already loaded; async otherwise */
  resolveVoiceAsync(
    voiceType: string | undefined,
    callback: (result: VoiceResolveResult) => void,
  ) {
    loadVoices((voices) => {
      callback(resolveVoice(voiceType, voices));
    });
  },
};
