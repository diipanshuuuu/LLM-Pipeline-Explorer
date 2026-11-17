/**
 * Vocabulary & BPE Tokenizer Engine for LLM Pipeline Explainer
 * Handles Character, Word, and Sub-word (BPE) tokenization,
 * UTF-8 byte conversions, and semantic coordinate seeds.
 */

// Common vocabulary table with frequencies and semantic cluster hints
const VOCABULARY_LIST = [
  // Articles & Pronouns
  { id: 101, text: "The", bytes: [0x54, 0x68, 0x65], cluster: "grammar", vectorHint: [0.2, 0.1, 0.05] },
  { id: 102, text: "the", bytes: [0x74, 0x68, 0x65], cluster: "grammar", vectorHint: [0.2, 0.1, 0.05] },
  { id: 103, text: "a", bytes: [0x61], cluster: "grammar", vectorHint: [0.18, 0.08, 0.02] },
  { id: 104, text: "an", bytes: [0x61, 0x6e], cluster: "grammar", vectorHint: [0.19, 0.09, 0.03] },
  { id: 105, text: "this", bytes: [0x74, 0x68, 0x69, 0x73], cluster: "grammar", vectorHint: [0.22, 0.12, 0.06] },
  { id: 106, text: "that", bytes: [0x74, 0x68, 0x61, 0x74], cluster: "grammar", vectorHint: [0.21, 0.11, 0.07] },
  { id: 107, text: "it", bytes: [0x69, 0x74], cluster: "grammar", vectorHint: [0.15, 0.15, 0.1] },

  // Adjectives
  { id: 201, text: "quick", bytes: [0x71, 0x75, 0x69, 0x63, 0x6b], cluster: "speed", vectorHint: [0.8, -0.2, 0.5] },
  { id: 202, text: "fast", bytes: [0x66, 0x61, 0x73, 0x74], cluster: "speed", vectorHint: [0.82, -0.18, 0.48] },
  { id: 203, text: "swift", bytes: [0x73, 0x77, 0x69, 0x66, 0x74], cluster: "speed", vectorHint: [0.78, -0.15, 0.52] },
  { id: 204, text: "slow", bytes: [0x73, 0x6c, 0x6f, 0x77], cluster: "speed", vectorHint: [-0.65, -0.1, -0.4] },
  { id: 205, text: "lazy", bytes: [0x6c, 0x61, 0x7a, 0x79], cluster: "speed", vectorHint: [-0.7, -0.15, -0.45] },
  { id: 206, text: "brown", bytes: [0x62, 0x72, 0x6f, 0x77, 0x6e], cluster: "color", vectorHint: [0.1, 0.8, -0.3] },
  { id: 207, text: "red", bytes: [0x72, 0x65, 0x64], cluster: "color", vectorHint: [0.05, 0.85, -0.25] },
  { id: 208, text: "black", bytes: [0x62, 0x6c, 0x61, 0x63, 0x6b], cluster: "color", vectorHint: [0.12, 0.75, -0.35] },
  { id: 209, text: "white", bytes: [0x77, 0x68, 0x69, 0x74, 0x65], cluster: "color", vectorHint: [0.08, 0.78, -0.28] },
  { id: 210, text: "cunning", bytes: [0x63, 0x75, 0x6e, 0x6e, 0x69, 0x6e, 0x67], cluster: "mind", vectorHint: [0.4, 0.3, 0.7] },
  { id: 211, text: "sleepy", bytes: [0x73, 0x6c, 0x65, 0x65, 0x70, 0x79], cluster: "speed", vectorHint: [-0.68, -0.12, -0.42] },

  // Animals / Nouns
  { id: 301, text: "fox", bytes: [0x66, 0x6f, 0x78], cluster: "animal", vectorHint: [0.65, 0.6, 0.2] },
  { id: 302, text: "dog", bytes: [0x64, 0x6f, 0x67], cluster: "animal", vectorHint: [0.6, 0.58, 0.15] },
  { id: 303, text: "hound", bytes: [0x68, 0x6f, 0x75, 0x6e, 0x64], cluster: "animal", vectorHint: [0.62, 0.55, 0.18] },
  { id: 304, text: "wolf", bytes: [0x77, 0x6f, 0x6c, 0x66], cluster: "animal", vectorHint: [0.68, 0.59, 0.22] },
  { id: 305, text: "cat", bytes: [0x63, 0x61, 0x74], cluster: "animal", vectorHint: [0.55, 0.62, 0.12] },
  { id: 306, text: "rabbit", bytes: [0x72, 0x61, 0x62, 0x62, 0x69, 0x74], cluster: "animal", vectorHint: [0.58, 0.5, 0.25] },
  { id: 307, text: "bear", bytes: [0x62, 0x65, 0x61, 0x72], cluster: "animal", vectorHint: [0.7, 0.45, 0.1] },
  { id: 308, text: "bird", bytes: [0x62, 0x69, 0x72, 0x64], cluster: "animal", vectorHint: [0.52, 0.48, 0.35] },

  // Verbs / Actions
  { id: 401, text: "jumps", bytes: [0x6a, 0x75, 0x6d, 0x70, 0x73], cluster: "action", vectorHint: [-0.2, -0.6, 0.7] },
  { id: 402, text: "jump", bytes: [0x6a, 0x75, 0x6d, 0x70], cluster: "action", vectorHint: [-0.22, -0.58, 0.68] },
  { id: 403, text: "leaped", bytes: [0x6c, 0x65, 0x61, 0x70, 0x65, 0x64], cluster: "action", vectorHint: [-0.18, -0.62, 0.72] },
  { id: 404, text: "runs", bytes: [0x72, 0x75, 0x6e, 0x73], cluster: "action", vectorHint: [-0.15, -0.65, 0.65] },
  { id: 405, text: "sleeps", bytes: [0x73, 0x6c, 0x65, 0x65, 0x70, 0x73], cluster: "action", vectorHint: [-0.4, -0.3, -0.6] },
  { id: 406, text: "barks", bytes: [0x62, 0x61, 0x72, 0x6b, 0x73], cluster: "action", vectorHint: [0.1, -0.4, 0.4] },
  { id: 407, text: "chases", bytes: [0x63, 0x68, 0x61, 0x73, 0x65, 0x73], cluster: "action", vectorHint: [-0.1, -0.6, 0.68] },
  { id: 408, text: "watches", bytes: [0x77, 0x61, 0x74, 0x63, 0x68, 0x65, 0x73], cluster: "action", vectorHint: [0.05, -0.35, 0.3] },

  // Prepositions & Spatial
  { id: 501, text: "over", bytes: [0x6f, 0x76, 0x65, 0x72], cluster: "spatial", vectorHint: [-0.5, 0.2, 0.65] },
  { id: 502, text: "under", bytes: [0x75, 0x6e, 0x64, 0x65, 0x72], cluster: "spatial", vectorHint: [-0.52, 0.18, -0.65] },
  { id: 503, text: "above", bytes: [0x61, 0x62, 0x6f, 0x76, 0x65], cluster: "spatial", vectorHint: [-0.48, 0.22, 0.7] },
  { id: 504, text: "across", bytes: [0x61, 0x63, 0x72, 0x6f, 0x73, 0x73], cluster: "spatial", vectorHint: [-0.45, 0.25, 0.55] },
  { id: 505, text: "into", bytes: [0x69, 0x6e, 0x74, 0x6f], cluster: "spatial", vectorHint: [-0.4, 0.15, 0.4] },
  { id: 506, text: "near", bytes: [0x6e, 0x65, 0x61, 0x72], cluster: "spatial", vectorHint: [-0.35, 0.3, 0.2] },

  // Environment & Objects
  { id: 601, text: "fence", bytes: [0x66, 0x65, 0x6e, 0x63, 0x65], cluster: "object", vectorHint: [0.1, -0.1, -0.5] },
  { id: 602, text: "log", bytes: [0x6c, 0x6f, 0x67], cluster: "object", vectorHint: [0.15, -0.15, -0.45] },
  { id: 603, text: "river", bytes: [0x72, 0x69, 0x76, 0x65, 0x72], cluster: "nature", vectorHint: [-0.2, 0.4, -0.5] },
  { id: 604, text: "stream", bytes: [0x73, 0x74, 0x72, 0x65, 0x61, 0x6d], cluster: "nature", vectorHint: [-0.22, 0.42, -0.48] },
  { id: 605, text: "grass", bytes: [0x67, 0x72, 0x61, 0x73, 0x73], cluster: "nature", vectorHint: [-0.1, 0.6, -0.4] },
  { id: 606, text: "forest", bytes: [0x66, 0x6f, 0x72, 0x65, 0x73, 0x74], cluster: "nature", vectorHint: [-0.05, 0.65, -0.3] },
  { id: 607, text: "moon", bytes: [0x6d, 0x6f, 0x6f, 0x6e], cluster: "cosmos", vectorHint: [0.3, -0.5, 0.8] },
  { id: 608, text: "sun", bytes: [0x73, 0x75, 0x6e], cluster: "cosmos", vectorHint: [0.35, -0.45, 0.85] },
  { id: 609, text: "sky", bytes: [0x73, 0x6b, 0x79], cluster: "cosmos", vectorHint: [0.25, -0.4, 0.75] },
  { id: 610, text: "day", bytes: [0x64, 0x61, 0x79], cluster: "time", vectorHint: [0.1, -0.3, 0.5] },
  { id: 611, text: "night", bytes: [0x6e, 0x69, 0x67, 0x68, 0x74], cluster: "time", vectorHint: [0.15, -0.35, -0.5] },

  // AI & Tech terms
  { id: 701, text: "language", bytes: [0x6c, 0x61, 0x6e, 0x67, 0x75, 0x61, 0x67, 0x65], cluster: "tech", vectorHint: [0.6, -0.7, 0.2] },
  { id: 702, text: "model", bytes: [0x6d, 0x6f, 0x64, 0x65, 0x6c], cluster: "tech", vectorHint: [0.65, -0.68, 0.22] },
  { id: 703, text: "transformer", bytes: [0x74, 0x72, 0x61, 0x6e, 0x73, 0x66, 0x6f, 0x72, 0x6d, 0x65, 0x72], cluster: "tech", vectorHint: [0.7, -0.65, 0.25] },
  { id: 704, text: "attention", bytes: [0x61, 0x74, 0x74, 0x65, 0x6e, 0x74, 0x69, 0x6f, 0x6e], cluster: "tech", vectorHint: [0.68, -0.6, 0.3] },
  { id: 705, text: "predict", bytes: [0x70, 0x72, 0x65, 0x64, 0x69, 0x63, 0x74], cluster: "tech", vectorHint: [0.55, -0.62, 0.4] },
  { id: 706, text: "token", bytes: [0x74, 0x6f, 0x6b, 0x65, 0x6e], cluster: "tech", vectorHint: [0.62, -0.72, 0.18] },

  // Common sub-word syllables
  { id: 801, text: "ing", bytes: [0x69, 0x6e, 0x67], cluster: "subword", vectorHint: [-0.1, -0.2, 0.1] },
  { id: 802, text: "ed", bytes: [0x65, 0x64], cluster: "subword", vectorHint: [-0.12, -0.18, 0.08] },
  { id: 803, text: "ly", bytes: [0x6c, 0x79], cluster: "subword", vectorHint: [0.05, 0.1, 0.15] },
  { id: 804, text: "er", bytes: [0x65, 0x72], cluster: "subword", vectorHint: [-0.08, 0.05, 0.1] },
  { id: 805, text: "est", bytes: [0x65, 0x73, 0x74], cluster: "subword", vectorHint: [0.1, 0.12, 0.18] },
  { id: 806, text: "un", bytes: [0x75, 0x6e], cluster: "subword", vectorHint: [-0.2, -0.1, -0.2] },
  { id: 807, text: "re", bytes: [0x72, 0x65], cluster: "subword", vectorHint: [-0.15, -0.05, 0.2] },
  { id: 808, text: "pre", bytes: [0x70, 0x72, 0x65], cluster: "subword", vectorHint: [0.1, -0.15, 0.25] },
  { id: 809, text: "tion", bytes: [0x74, 0x69, 0x6f, 0x6e], cluster: "subword", vectorHint: [0.25, -0.3, 0.1] },

  // Punctuation
  { id: 901, text: ".", bytes: [0x2e], cluster: "punct", vectorHint: [0.0, 0.0, 0.0] },
  { id: 902, text: ",", bytes: [0x2c], cluster: "punct", vectorHint: [0.02, 0.01, 0.0] },
  { id: 903, text: "!", bytes: [0x21], cluster: "punct", vectorHint: [0.05, -0.1, 0.3] },
  { id: 904, text: "?", bytes: [0x3f], cluster: "punct", vectorHint: [0.1, -0.1, 0.35] }
];

// Predefined BPE merge priority ranks
const BPE_MERGE_PAIRS = [
  ["t", "h"], ["th", "e"], ["T", "h"], ["Th", "e"],
  ["q", "u"], ["qu", "i"], ["qui", "c"], ["quic", "k"],
  ["b", "r"], ["br", "o"], ["bro", "w"], ["brow", "n"],
  ["f", "o"], ["fo", "x"],
  ["j", "u"], ["ju", "m"], ["jum", "p"], ["jump", "s"],
  ["o", "v"], ["ov", "e"], ["ove", "r"],
  ["l", "a"], ["la", "z"], ["laz", "y"],
  ["d", "o"], ["do", "g"],
  ["h", "o"], ["ho", "u"], ["hou", "n"], ["houn", "d"],
  ["w", "o"], ["wo", "l"], ["wol", "f"],
  ["f", "a"], ["fa", "s"], ["fas", "t"],
  ["s", "l"], ["sl", "e"], ["sle", "e"], ["slee", "p"], ["sleep", "y"], ["sleep", "s"],
  ["i", "n"], ["in", "g"],
  ["e", "d"], ["l", "y"],
  ["f", "e"], ["fe", "n"], ["fen", "c"], ["fenc", "e"],
  ["r", "i"], ["ri", "v"], ["riv", "e"], ["rive", "r"],
  ["m", "o"], ["mo", "o"], ["moo", "n"],
  ["t", "r"], ["tr", "a"], ["tra", "n"], ["tran", "s"], ["trans", "form"], ["transform", "er"],
  ["m", "o"], ["mo", "d"], ["mod", "e"], ["mode", "l"],
  ["a", "t"], ["at", "t"], ["att", "e"], ["atte", "n"], ["atten", "tion"]
];

// Build lookup map for fast O(1) query
const VOCAB_MAP = new Map();
VOCABULARY_LIST.forEach(item => {
  VOCAB_MAP.set(item.text.toLowerCase(), item);
  VOCAB_MAP.set(item.text, item);
});

// UTF-8 string to byte array helper
function stringToUtf8Bytes(str) {
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(str));
}

// Convert byte array to hexadecimal string representation: "[0x54, 0x68, 0x65]"
function bytesToHexArray(bytes) {
  return bytes.map(b => "0x" + b.toString(16).toUpperCase().padStart(2, '0'));
}

// Deterministic hash for unseen strings to assign stable ID and vector coordinates
function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/**
 * Tokenizer implementing Byte-Pair Encoding (BPE) simulation
 */
function tokenizeBPE(text) {
  if (!text || text.trim().length === 0) return [];

  // Match words, whitespaces, and punctuation
  const wordsAndPunct = text.match(/\w+|[^\w\s]|\s+/g) || [text];
  const tokens = [];

  for (const part of wordsAndPunct) {
    // If it's pure whitespace, preserve single space token
    if (/^\s+$/.test(part)) {
      continue; // Modern LLMs prepend   space symbol, skip blank runs for clarity
    }

    // Direct vocabulary hit
    if (VOCAB_MAP.has(part)) {
      const entry = VOCAB_MAP.get(part);
      tokens.push(formatToken(entry.text, entry.id, entry.bytes, entry.cluster, entry.vectorHint));
      continue;
    }

    // Lowercase hit
    const lower = part.toLowerCase();
    if (VOCAB_MAP.has(lower)) {
      const entry = VOCAB_MAP.get(lower);
      tokens.push(formatToken(part, entry.id, stringToUtf8Bytes(part), entry.cluster, entry.vectorHint));
      continue;
    }

    // Run simulated BPE merges on unknown words
    const subTokens = segmentBPEWord(part);
    for (const sub of subTokens) {
      if (VOCAB_MAP.has(sub)) {
        const entry = VOCAB_MAP.get(sub);
        tokens.push(formatToken(sub, entry.id, stringToUtf8Bytes(sub), entry.cluster, entry.vectorHint));
      } else {
        const id = 1000 + (hashString(sub) % 8999);
        const bytes = stringToUtf8Bytes(sub);
        tokens.push(formatToken(sub, id, bytes, "oov-split", null));
      }
    }
  }

  return tokens;
}

/**
 * Iteratively apply merge rules to split a word into subwords
 */
function segmentBPEWord(word) {
  let pieces = word.split('');
  let changed = true;

  while (changed && pieces.length > 1) {
    changed = false;
    let bestPairIndex = -1;
    let bestRank = Infinity;

    for (let i = 0; i < pieces.length - 1; i++) {
      const p1 = pieces[i];
      const p2 = pieces[i + 1];
      const rank = BPE_MERGE_PAIRS.findIndex(pair => pair[0] === p1 && pair[1] === p2);
      if (rank !== -1 && rank < bestRank) {
        bestRank = rank;
        bestPairIndex = i;
      }
    }

    if (bestPairIndex !== -1) {
      const merged = pieces[bestPairIndex] + pieces[bestPairIndex + 1];
      pieces.splice(bestPairIndex, 2, merged);
      changed = true;
    }
  }

  return pieces;
}

/**
 * Word-level Tokenizer (for comparison)
 */
function tokenizeWordLevel(text) {
  if (!text || text.trim().length === 0) return [];
  const words = text.match(/\b\w+\b|[^\w\s]/g) || [];
  return words.map((w, idx) => {
    const isVocab = VOCAB_MAP.has(w) || VOCAB_MAP.has(w.toLowerCase());
    return {
      text: w,
      id: isVocab ? (VOCAB_MAP.get(w)?.id || VOCAB_MAP.get(w.toLowerCase())?.id) : "[UNK]",
      isOOV: !isVocab,
      bytes: stringToUtf8Bytes(w)
    };
  });
}

/**
 * Character-level Tokenizer (for comparison)
 */
function tokenizeCharLevel(text) {
  if (!text) return [];
  return text.split('').map((ch, idx) => ({
    text: ch === ' ' ? '␣' : ch,
    id: ch.charCodeAt(0),
    bytes: stringToUtf8Bytes(ch)
  }));
}

/**
 * Standardize token object schema
 */
function formatToken(text, id, bytes, cluster, vectorHint) {
  return {
    text,
    id,
    bytes: bytes || stringToUtf8Bytes(text),
    hexBytes: bytesToHexArray(bytes || stringToUtf8Bytes(text)),
    cluster: cluster || "general",
    vectorHint: vectorHint || generateDeterministicVectorHint(text)
  };
}

/**
 * Generate 3D semantic vector coordinates if not hardcoded
 */
function generateDeterministicVectorHint(str) {
  const h1 = hashString(str + "_x") / 0xFFFFFFFF;
  const h2 = hashString(str + "_y") / 0xFFFFFFFF;
  const h3 = hashString(str + "_z") / 0xFFFFFFFF;
  const x = (h1 * 2 - 1) * 0.8;
  const y = (h2 * 2 - 1) * 0.8;
  const z = (h3 * 2 - 1) * 0.8;
  const mag = Math.sqrt(x*x + y*y + z*z) || 1;
  return [x / mag, y / mag, z / mag];
}

// Background anchor words for 3D Vector Space
const BACKGROUND_ANCHORS = [
  { text: "animal", cluster: "animal", pos: [0.65, 0.62, 0.18], color: "#10B981" },
  { text: "wolf", cluster: "animal", pos: [0.68, 0.59, 0.22], color: "#10B981" },
  { text: "hound", cluster: "animal", pos: [0.62, 0.55, 0.18], color: "#10B981" },
  { text: "cat", cluster: "animal", pos: [0.55, 0.62, 0.12], color: "#10B981" },
  { text: "bird", cluster: "animal", pos: [0.52, 0.48, 0.35], color: "#10B981" },
  { text: "speed", cluster: "speed", pos: [0.85, -0.2, 0.5], color: "#06B6D4" },
  { text: "swift", cluster: "speed", pos: [0.78, -0.15, 0.52], color: "#06B6D4" },
  { text: "slow", cluster: "speed", pos: [-0.65, -0.1, -0.4], color: "#06B6D4" },
  { text: "lazy", cluster: "speed", pos: [-0.7, -0.15, -0.45], color: "#06B6D4" },
  { text: "leap", cluster: "action", pos: [-0.18, -0.62, 0.72], color: "#8B5CF6" },
  { text: "run", cluster: "action", pos: [-0.15, -0.65, 0.65], color: "#8B5CF6" },
  { text: "sleep", cluster: "action", pos: [-0.4, -0.3, -0.6], color: "#8B5CF6" },
  { text: "nature", cluster: "nature", pos: [-0.1, 0.6, -0.4], color: "#EC4899" },
  { text: "forest", cluster: "nature", pos: [-0.05, 0.65, -0.3], color: "#EC4899" },
  { text: "river", cluster: "nature", pos: [-0.2, 0.4, -0.5], color: "#EC4899" },
  { text: "moon", cluster: "cosmos", pos: [0.3, -0.5, 0.8], color: "#F59E0B" },
  { text: "sun", cluster: "cosmos", pos: [0.35, -0.45, 0.85], color: "#F59E0B" },
  { text: "sky", cluster: "cosmos", pos: [0.25, -0.4, 0.75], color: "#F59E0B" },
  { text: "over", cluster: "spatial", pos: [-0.5, 0.2, 0.65], color: "#3B82F6" },
  { text: "under", cluster: "spatial", pos: [-0.52, 0.18, -0.65], color: "#3B82F6" },
  { text: "grammar", cluster: "grammar", pos: [0.2, 0.1, 0.05], color: "#9CA3AF" },
  { text: "tech", cluster: "tech", pos: [0.7, -0.65, 0.25], color: "#F43F5E" }
];


function getBPEMergeSteps(word) {
  let pieces = word.split('');
  const steps = [{
    step: 0,
    pieces: [...pieces],
    description: "Initial character / UTF-8 byte pieces"
  }];

  let changed = true;
  let stepCount = 0;

  while (changed && pieces.length > 1) {
    changed = false;
    let bestPairIndex = -1;
    let bestRank = Infinity;

    for (let i = 0; i < pieces.length - 1; i++) {
      const p1 = pieces[i];
      const p2 = pieces[i + 1];
      const rank = BPE_MERGE_PAIRS.findIndex(pair => pair[0] === p1 && pair[1] === p2);
      if (rank !== -1 && rank < bestRank) {
        bestRank = rank;
        bestPairIndex = i;
      }
    }

    if (bestPairIndex !== -1) {
      stepCount++;
      const merged = pieces[bestPairIndex] + pieces[bestPairIndex + 1];
      const pair = [pieces[bestPairIndex], pieces[bestPairIndex + 1]];
      pieces.splice(bestPairIndex, 2, merged);
      steps.push({
        step: stepCount,
        pieces: [...pieces],
        mergedPair: pair,
        mergedToken: merged,
        description: "Merged frequent pair ('" + pair[0] + "', '" + pair[1] + "') -> '" + merged + "'"
      });
      changed = true;
    }
  }

  return steps;
}

if (typeof window !== "undefined") {
  window.tokenizeBPE = tokenizeBPE;
  window.tokenizeWordLevel = tokenizeWordLevel;
  window.tokenizeCharLevel = tokenizeCharLevel;
  window.VOCABULARY_LIST = VOCABULARY_LIST;
  window.BACKGROUND_ANCHORS = BACKGROUND_ANCHORS;
  window.getBPEMergeSteps = getBPEMergeSteps;
  window.hashString = hashString;
  window.formatToken = formatToken;
}

if (typeof global !== "undefined") {
  global.VOCABULARY_LIST = VOCABULARY_LIST;
  global.BACKGROUND_ANCHORS = BACKGROUND_ANCHORS;
  global.tokenizeBPE = tokenizeBPE;
  global.tokenizeWordLevel = tokenizeWordLevel;
  global.tokenizeCharLevel = tokenizeCharLevel;
  global.formatToken = formatToken;
  global.getBPEMergeSteps = getBPEMergeSteps;
  global.hashString = hashString;
}
