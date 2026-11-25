/**
 * Lightweight DistilGPT-2 Perplexity Inference Service
 * Runs quantized INT8 ONNX DistilGPT-2 (82M params, 6 layers, 50,257 GPT-2 BPE vocab)
 * locally via @huggingface/transformers to compute exact token-by-token log-probabilities,
 * Cross-Entropy Loss, Perplexity, and Top-5 expected alternative tokens.
 */

const {
  computeLogSoftmaxAtPosition,
  classifyTokenSurprise,
  computeSequencePerplexity
} = require('../js/perplexity-math.js');

const MODEL_ID = 'Xenova/distilgpt2';
const MODEL_META = {
  modelId: MODEL_ID,
  displayName: 'DistilGPT-2 (INT8)',
  params: '82M',
  layers: 6,
  vocabSize: 50257
};

const MAX_INPUT_CHARS = 480;
const MAX_TOKENS = 96;
const GPT2_BOS_ID = 50256; // <|endoftext|>

let tokenizerInstance = null;
let modelInstance = null;
let TensorClass = null;
let loadPromise = null;
let loadError = null;
let loadMs = null;

async function ensureModelLoaded() {
  if (tokenizerInstance && modelInstance && TensorClass) {
    return { tokenizer: tokenizerInstance, model: modelInstance, Tensor: TensorClass };
  }
  if (!loadPromise) {
    loadError = null;
    const t0 = Date.now();
    loadPromise = (async () => {
      try {
        const { AutoTokenizer, AutoModelForCausalLM, Tensor } = await import('@huggingface/transformers');
        const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
        const model = await AutoModelForCausalLM.from_pretrained(MODEL_ID, { dtype: 'q8' });
        tokenizerInstance = tokenizer;
        modelInstance = model;
        TensorClass = Tensor;
        loadMs = Date.now() - t0;
        console.log(`[Unprompted] ${MODEL_META.displayName} ready in ${loadMs}ms`);
        return { tokenizer, model, Tensor };
      } catch (err) {
        loadError = err;
        loadPromise = null;
        throw err;
      }
    })();
  }
  return loadPromise;
}

function getModelStatus() {
  return {
    ...MODEL_META,
    ready: Boolean(tokenizerInstance && modelInstance),
    loading: Boolean(loadPromise && !(tokenizerInstance && modelInstance)),
    loadMs,
    error: loadError ? String(loadError.message || loadError) : null
  };
}

/**
 * Formats a decoded GPT-2 token for safe display while preserving raw text for swaps.
 */
function formatDisplayToken(raw) {
  if (raw === '\n') return '↵';
  if (raw === '\t') return '⇥';
  if (/^\s+$/.test(raw)) return '␣'.repeat(Math.min(raw.length, 3));
  return raw;
}

/**
 * Computes exact per-token surprisal & overall perplexity for the given input text.
 * Prepends GPT-2's <|endoftext|> BOS token (50256) with explicit position_ids so
 * every token in the sentence is scored with authentic positional embeddings.
 *
 * @param {string} rawText
 */
async function evaluatePerplexity(rawText) {
  const cleaned = typeof rawText === 'string' ? rawText.trim() : '';
  if (!cleaned) {
    const err = new Error('Enter a sentence with at least 2 words to measure perplexity.');
    err.statusCode = 400;
    throw err;
  }

  const truncatedText = cleaned.slice(0, MAX_INPUT_CHARS);
  const { tokenizer, model, Tensor } = await ensureModelLoaded();

  const t0 = Date.now();
  const encoded = await tokenizer(truncatedText);
  const fullIds = Array.from(encoded.input_ids.data, Number);

  if (fullIds.length < 2) {
    const err = new Error('Type at least 2 tokens so DistilGPT-2 has context to predict the next token.');
    err.statusCode = 400;
    throw err;
  }

  const wasTruncated = fullIds.length > MAX_TOKENS || cleaned.length > MAX_INPUT_CHARS;
  const userIds = fullIds.length > MAX_TOKENS ? fullIds.slice(0, MAX_TOKENS) : fullIds;

  // Prepend <|endoftext|> BOS so position 0 is a proper document boundary
  const bosIds = [GPT2_BOS_ID, ...userIds];
  const seqWithBos = bosIds.length;
  const input_ids = new Tensor('int64', BigInt64Array.from(bosIds.map(BigInt)), [1, seqWithBos]);
  const attention_mask = new Tensor('int64', BigInt64Array.from(bosIds.map(() => 1n)), [1, seqWithBos]);
  const position_ids = new Tensor('int64', BigInt64Array.from(bosIds.map((_, i) => BigInt(i))), [1, seqWithBos]);

  const outputs = await model({ input_ids, attention_mask, position_ids });
  const logitsDims = outputs.logits.dims;
  const vocabSize = logitsDims[2];
  const logitsData = outputs.logits.data;

  const tokenResults = [];

  for (let u = 0; u < userIds.length; u++) {
    const id = userIds[u];
    const rawPiece = tokenizer.decode([id]);

    // Logits at bos-sequence index u predict bosIds[u + 1] === userIds[u]
    const offset = u * vocabSize;
    const stats = computeLogSoftmaxAtPosition(logitsData, offset, vocabSize, id, 5);
    const surprise = classifyTokenSurprise(stats.surprisalBits);

    const decodedAlts = stats.topAlternatives.map(alt => {
      const altText = tokenizer.decode([alt.id]);
      return {
        id: alt.id,
        text: altText,
        display: formatDisplayToken(altText),
        prob: Number(alt.prob.toFixed(6))
      };
    });

    tokenResults.push({
      index: u,
      id,
      text: rawPiece,
      display: formatDisplayToken(rawPiece),
      isContext: false,
      fromBos: u === 0,
      prob: Number(stats.prob.toFixed(6)),
      logProb: Number(stats.logProb.toFixed(5)),
      surprisalNats: Number(stats.surprisalNats.toFixed(4)),
      surprisalBits: Number(stats.surprisalBits.toFixed(3)),
      tokenPerplexity: Number(stats.tokenPerplexity.toFixed(2)),
      rank: stats.rank,
      surprise,
      topAlternatives: decodedAlts
    });
  }

  const summary = computeSequencePerplexity(tokenResults);
  const inferenceMs = Date.now() - t0;

  return {
    model: MODEL_META,
    text: truncatedText,
    truncated: wasTruncated,
    tokenCount: tokenResults.length,
    scoredCount: summary.scoredCount,
    perplexity: Number(summary.perplexity.toFixed(2)),
    meanNll: Number(summary.meanNll.toFixed(4)),
    meanBitsPerToken: Number(summary.meanBitsPerToken.toFixed(3)),
    geometricMeanProb: Number(summary.geometricMeanProb.toFixed(5)),
    mostSurprisingIndex: summary.mostSurprisingIndex,
    leastSurprisingIndex: summary.leastSurprisingIndex,
    band: summary.band,
    inferenceMs,
    tokens: tokenResults
  };
}

module.exports = {
  MODEL_META,
  ensureModelLoaded,
  getModelStatus,
  evaluatePerplexity
};
