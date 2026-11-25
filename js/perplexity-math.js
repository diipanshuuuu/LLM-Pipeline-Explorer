/**
 * Pure Perplexity & Surprisal Math Helpers
 * Shared between the Node.js DistilGPT-2 backend and the browser UI so all
 * calculations can be deterministically unit-tested with node:test.
 */

const PERPLEXITY_BANDS = [
  { max: 25,  key: "predictable", label: "Very Predictable", color: "#10B981", tone: "teal" },
  { max: 80,  key: "natural",     label: "Natural Flow",     color: "#34D399", tone: "teal" },
  { max: 250, key: "creative",    label: "Creative / Rare",  color: "#EAB308", tone: "amber" },
  { max: 800, key: "surprising",  label: "Surprising",       color: "#F97316", tone: "accent" },
  { max: Infinity, key: "chaotic", label: "Highly Chaotic",  color: "#EF4444", tone: "rose" }
];

/**
 * Computes exact numerically stable log-softmax at a single sequence position
 * over a flat logits buffer, returning the target token's probability,
 * surprisal (nats & bits), rank among all vocab tokens, and Top-K alternatives.
 *
 * @param {Float32Array|number[]} logitsData
 * @param {number} offset Starting index for this position (pos * vocabSize)
 * @param {number} vocabSize Vocabulary size (50257 for DistilGPT-2)
 * @param {number} targetId Actual next token ID
 * @param {number} topK Number of top expected alternatives to return
 */
function computeLogSoftmaxAtPosition(logitsData, offset, vocabSize, targetId, topK = 5) {
  let maxLogit = -Infinity;
  for (let v = 0; v < vocabSize; v++) {
    const val = logitsData[offset + v];
    if (val > maxLogit) maxLogit = val;
  }

  let sumExp = 0;
  for (let v = 0; v < vocabSize; v++) {
    sumExp += Math.exp(logitsData[offset + v] - maxLogit);
  }
  const logZ = maxLogit + Math.log(sumExp);

  const safeTargetId = Math.max(0, Math.min(vocabSize - 1, targetId));
  const targetLogit = logitsData[offset + safeTargetId];
  const logProb = targetLogit - logZ;
  const prob = Math.exp(logProb);
  const surprisalNats = Math.max(0, -logProb);
  const surprisalBits = surprisalNats / Math.LN2;
  const tokenPerplexity = Math.exp(Math.min(surprisalNats, 30));

  // Compute rank (1-based) and maintain Top-K highest logit tokens in O(V * K)
  let rank = 1;
  const topIds = [];
  const topLogits = [];

  for (let v = 0; v < vocabSize; v++) {
    const val = logitsData[offset + v];
    if (val > targetLogit) rank++;

    if (topLogits.length < topK || val > topLogits[topLogits.length - 1]) {
      let insertAt = topLogits.length;
      while (insertAt > 0 && val > topLogits[insertAt - 1]) {
        insertAt--;
      }
      topIds.splice(insertAt, 0, v);
      topLogits.splice(insertAt, 0, val);
      if (topIds.length > topK) {
        topIds.pop();
        topLogits.pop();
      }
    }
  }

  const topAlternatives = topIds.map((id, idx) => {
    const lp = topLogits[idx] - logZ;
    return {
      id,
      logProb: lp,
      prob: Math.exp(lp)
    };
  });

  return {
    logProb,
    prob,
    surprisalNats,
    surprisalBits,
    tokenPerplexity,
    rank,
    topAlternatives
  };
}

/**
 * Classifies a single token's surprisal (in bits, -log2(P)) into a visual heat tier.
 * Uses strictly warm charcoal / emerald / amber / signal orange / coral palette (zero purple).
 *
 * @param {number} bits
 * @returns {{level: string, label: string, color: string}}
 */
function classifyTokenSurprise(bits) {
  if (!Number.isFinite(bits) || bits <= 2.2) {
    return { level: "calm", label: "Expected", color: "#10B981" };
  }
  if (bits <= 4.8) {
    return { level: "mild", label: "Plausible", color: "#EAB308" };
  }
  if (bits <= 7.8) {
    return { level: "spicy", label: "Surprising", color: "#F97316" };
  }
  return { level: "shock", label: "Plot Twist", color: "#EF4444" };
}

/**
 * Classifies an overall sentence perplexity value into a verdict band.
 *
 * @param {number} ppl
 */
function classifyPerplexityBand(ppl) {
  const safePpl = Number.isFinite(ppl) && ppl >= 1 ? ppl : 1;
  for (let i = 0; i < PERPLEXITY_BANDS.length; i++) {
    if (safePpl < PERPLEXITY_BANDS[i].max) {
      return PERPLEXITY_BANDS[i];
    }
  }
  return PERPLEXITY_BANDS[PERPLEXITY_BANDS.length - 1];
}

/**
 * Aggregates per-token log-probabilities into exact sequence Cross-Entropy Loss & Perplexity.
 * First token (index 0) is treated as conditioning context (unscored).
 *
 * @param {Array<{isContext?: boolean, logProb?: number, prob?: number, surprisalNats?: number, surprisalBits?: number}>} tokens
 */
function computeSequencePerplexity(tokens) {
  const scored = (tokens || [])
    .map((tok, index) => ({ tok, index }))
    .filter(item => item.tok && !item.tok.isContext && typeof item.tok.logProb === "number");

  if (scored.length === 0) {
    return {
      scoredCount: 0,
      meanNll: 0,
      meanBitsPerToken: 0,
      perplexity: 1,
      geometricMeanProb: 1,
      mostSurprisingIndex: -1,
      leastSurprisingIndex: -1,
      band: classifyPerplexityBand(1)
    };
  }

  let totalNll = 0;
  let mostIdx = scored[0].index;
  let leastIdx = scored[0].index;
  let maxNll = -Infinity;
  let minNll = Infinity;

  for (let i = 0; i < scored.length; i++) {
    const { tok, index } = scored[i];
    const nll = Math.max(0, -tok.logProb);
    totalNll += nll;
    if (nll > maxNll) {
      maxNll = nll;
      mostIdx = index;
    }
    if (nll < minNll) {
      minNll = nll;
      leastIdx = index;
    }
  }

  const meanNll = totalNll / scored.length;
  const meanBitsPerToken = meanNll / Math.LN2;
  const perplexity = Math.exp(Math.min(meanNll, 20));
  const geometricMeanProb = Math.exp(-meanNll);

  return {
    scoredCount: scored.length,
    meanNll,
    meanBitsPerToken,
    perplexity,
    geometricMeanProb,
    mostSurprisingIndex: mostIdx,
    leastSurprisingIndex: leastIdx,
    band: classifyPerplexityBand(perplexity)
  };
}

/**
 * Computes the intuitive "weighted die / branching factor" analogy for
 * the interactive How Perplexity Works explainer.
 *
 * If an AI assigns average probability p to each correct next token,
 * PPL = exp(-ln(p)) = 1 / p (equivalent to choosing uniformly among 1/p words).
 *
 * @param {number} avgProb Probability in (0, 1]
 */
function simulateBranchingPerplexity(avgProb) {
  const clampedProb = Math.max(0.01, Math.min(1.0, Number(avgProb) || 0.25));
  const nll = -Math.log(clampedProb);
  const bits = nll / Math.LN2;
  const perplexity = 1 / clampedProb;
  const equivalentChoices = Math.max(1, Math.round(perplexity));

  let analogy = "Coin flip between 2 words";
  if (perplexity <= 1.25) analogy = "100% certain — 1 obvious word";
  else if (perplexity <= 2.6) analogy = "Coin flip — ~2 likely words";
  else if (perplexity <= 7.5) analogy = `Like rolling a ${equivalentChoices}-sided die`;
  else if (perplexity <= 25) analogy = `Picking 1 of ${equivalentChoices} candidates`;
  else analogy = `Stumped — ${equivalentChoices} equally blurry guesses`;

  return {
    prob: clampedProb,
    probPct: Math.round(clampedProb * 100),
    nll,
    bits,
    perplexity,
    equivalentChoices,
    analogy,
    band: classifyPerplexityBand(perplexity)
  };
}

/**
 * Maps a Perplexity score logarithmically onto a [0, 1] gauge arc fraction
 * so both low values (PPL 5..50) and high values (PPL 500..2000) read clearly.
 *
 * @param {number} ppl
 * @returns {number}
 */
function perplexityToGaugeRatio(ppl) {
  const safe = Math.max(1, Number(ppl) || 1);
  // log10(1) = 0 -> 0%, log10(1500) ≈ 3.176 -> 100%
  return Math.max(0.03, Math.min(1, Math.log10(safe) / Math.log10(1500)));
}

/**
 * Replaces a single decoded token inside a token array and joins them cleanly.
 *
 * @param {Array<{text: string}>} tokens
 * @param {number} targetIndex
 * @param {string} replacementText
 * @returns {string}
 */
function replaceDecodedToken(tokens, targetIndex, replacementText) {
  if (!Array.isArray(tokens) || targetIndex < 0 || targetIndex >= tokens.length) {
    return "";
  }
  return tokens
    .map((t, idx) => (idx === targetIndex ? replacementText : t.text))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

if (typeof window !== "undefined") {
  window.PERPLEXITY_BANDS = PERPLEXITY_BANDS;
  window.computeLogSoftmaxAtPosition = computeLogSoftmaxAtPosition;
  window.classifyTokenSurprise = classifyTokenSurprise;
  window.classifyPerplexityBand = classifyPerplexityBand;
  window.computeSequencePerplexity = computeSequencePerplexity;
  window.simulateBranchingPerplexity = simulateBranchingPerplexity;
  window.perplexityToGaugeRatio = perplexityToGaugeRatio;
  window.replaceDecodedToken = replaceDecodedToken;
}

if (typeof global !== "undefined") {
  global.PERPLEXITY_BANDS = PERPLEXITY_BANDS;
  global.computeLogSoftmaxAtPosition = computeLogSoftmaxAtPosition;
  global.classifyTokenSurprise = classifyTokenSurprise;
  global.classifyPerplexityBand = classifyPerplexityBand;
  global.computeSequencePerplexity = computeSequencePerplexity;
  global.simulateBranchingPerplexity = simulateBranchingPerplexity;
  global.perplexityToGaugeRatio = perplexityToGaugeRatio;
  global.replaceDecodedToken = replaceDecodedToken;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PERPLEXITY_BANDS,
    computeLogSoftmaxAtPosition,
    classifyTokenSurprise,
    classifyPerplexityBand,
    computeSequencePerplexity,
    simulateBranchingPerplexity,
    perplexityToGaugeRatio,
    replaceDecodedToken
  };
}
