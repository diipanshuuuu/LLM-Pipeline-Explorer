const test = require('node:test');
const assert = require('node:assert/strict');

const {
  VOCABULARY_LIST,
  tokenizeBPE,
  tokenizeWordLevel,
  tokenizeCharLevel,
  getBPEMergeSteps,
  hashString
} = require('../js/vocabulary.js');
const { MathEngine } = require('../js/math-engine.js');

// Expose hashString globally as MathEngine.getTokenEmbedding checks typeof hashString
global.hashString = hashString;

test('BPE tokenization produces expected token IDs and merge steps', () => {
  const tokens = tokenizeBPE('The quick brown fox');
  assert.equal(tokens.length, 4);
  assert.equal(tokens[0].text, 'The');
  assert.equal(tokens[0].id, 101);
  assert.equal(tokens[3].text, 'fox');

  const steps = getBPEMergeSteps('transformer');
  assert.ok(steps.length > 2, 'Should record multiple iterative BPE merge steps');
  assert.equal(steps[0].pieces.length, 11);
  assert.ok(steps[steps.length - 1].pieces.length < steps[0].pieces.length);

  const words = tokenizeWordLevel('The quick fox');
  const chars = tokenizeCharLevel('The quick fox');
  assert.equal(words.length, 3);
  assert.equal(chars.length, 13);
});

test('MathEngine similarity, RoPE, and normalization invariants hold', () => {
  const engine = new MathEngine();
  const quickTok = VOCABULARY_LIST.find(v => v.text === 'quick');
  const fastTok = VOCABULARY_LIST.find(v => v.text === 'fast');
  const lazyTok = VOCABULARY_LIST.find(v => v.text === 'lazy');

  const vQuick = engine.getTokenEmbedding(quickTok, 8);
  const vFast = engine.getTokenEmbedding(fastTok, 8);
  const vLazy = engine.getTokenEmbedding(lazyTok, 8);

  const simSimilar = MathEngine.cosineSimilarity(vQuick, vFast);
  const simOpposite = MathEngine.cosineSimilarity(vQuick, vLazy);
  assert.ok(simSimilar > simOpposite, 'Similar words must have higher cosine similarity than antonyms');

  // RoPE preserves vector norm
  const rotated = MathEngine.applyRoPE(vQuick, 5, 8);
  assert.ok(Math.abs(MathEngine.norm(rotated) - MathEngine.norm(vQuick)) < 1e-6);

  // RMSNorm stabilizes a huge noise spike
  const spiked = vQuick.map((v, i) => (i === 2 ? v + 5.0 : v));
  const normed = MathEngine.rmsNorm(spiked);
  assert.ok(Math.abs(MathEngine.rmsNorm(normed.output).rms - 1.0) < 1e-3);
});

test('Attention causal mask zeroes future positions and rows sum to 1', () => {
  const engine = new MathEngine();
  const tokens = tokenizeBPE('The quick brown fox');
  const vecs = tokens.map(t => engine.getTokenEmbedding(t, 8));

  const attn = engine.computeAttention({
    tokens,
    tokenVectors: vecs,
    d_model: 8,
    n_heads: 2,
    causalMask: true
  });

  const weights = attn.headsData[0].attentionWeights;
  for (let i = 0; i < tokens.length; i++) {
    let rowSum = 0;
    for (let j = 0; j < tokens.length; j++) {
      rowSum += weights[i][j];
      if (j > i) {
        assert.equal(weights[i][j], 0, `Future token (${i},${j}) must be masked to 0`);
      }
    }
    assert.ok(Math.abs(rowSum - 1.0) < 1e-6, 'Attention row must sum to 1');
  }
});

test('Layer-sorted logits sort descending and Top-K/Top-P sampling filters properly', () => {
  const engine = new MathEngine();
  const tokens = tokenizeBPE('The quick brown fox jumps over the');
  const sortedLogits = engine.computeLayerSortedLogits(tokens, 12, VOCABULARY_LIST, 8);

  for (let i = 1; i < sortedLogits.length; i++) {
    assert.ok(sortedLogits[i - 1].rawLogit >= sortedLogits[i].rawLogit, 'Logits must be sorted descending');
  }

  const sampled = engine.sampleNextToken({
    candidateLogits: sortedLogits,
    promptTokens: tokens,
    temperature: 0.8,
    topK: 5,
    topP: 0.9,
    repetitionPenalty: 1.15
  });

  assert.ok(sampled.activeCount <= 5 && sampled.activeCount >= 1);
  assert.ok(sampled.sampledToken);
  const activeProbSum = sampled.candidates
    .filter(c => c.status === 'active')
    .reduce((acc, c) => acc + c.normalizedProb, 0);
  assert.ok(Math.abs(activeProbSum - 1.0) < 1e-5, 'Normalized probabilities of surviving words must sum to 1');
});

test('3D camera fit distance keeps full bounding sphere inside both axes across aspect ratios', () => {
  const { computeCameraFitDistance } = require('../js/three-viewport.js');
  const radius = 3.8;
  const fovDeg = 42;
  const vFov = (fovDeg * Math.PI) / 180;

  for (const aspect of [0.75, 1.0, 1.5]) {
    const dist = computeCameraFitDistance(radius, fovDeg, aspect, 1.36);
    const visibleHalfH = dist * Math.tan(vFov / 2);
    const visibleHalfW = visibleHalfH * aspect;
    assert.ok(visibleHalfH > radius * 1.2, `Vertical frustum half-height must fit sphere at aspect ${aspect}`);
    assert.ok(visibleHalfW > radius * 1.2, `Horizontal frustum half-width must fit sphere at aspect ${aspect}`);
  }
});
