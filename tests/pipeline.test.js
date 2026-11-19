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

test('Monotonic scroll-spy never jumps backward while scrolling downward through chapters', () => {
  const { computeActiveStageFromLayout } = require('../js/story-helpers.js');

  // Simulated document offsets for 7 chapters spaced 850px apart
  const sectionDocTops = [
    { stage: 1, docTop: 480 },
    { stage: 2, docTop: 1330 },
    { stage: 3, docTop: 2180 },
    { stage: 4, docTop: 3030 },
    { stage: 5, docTop: 3880 },
    { stage: 6, docTop: 4730 },
    { stage: 7, docTop: 5580 }
  ];
  const viewportH = 900;
  const docH = 6500;

  let prevStage = 1;
  const visited = new Set();

  for (let scrollY = 0; scrollY <= docH - viewportH; scrollY += 40) {
    const metrics = sectionDocTops.map(s => ({ stage: s.stage, top: s.docTop - scrollY }));
    const active = computeActiveStageFromLayout(metrics, viewportH, scrollY, docH);
    assert.ok(
      active >= prevStage,
      `Scroll guide jumped backward from chapter ${prevStage} to ${active} at scrollY=${scrollY}`
    );
    prevStage = active;
    visited.add(active);
  }

  for (let st = 1; st <= 7; st++) {
    assert.ok(visited.has(st), `Expected chapter ${st} to become active while scrolling down`);
  }
});

test('Prize wheel slices cover full 360 degrees and group overflow words cleanly', () => {
  const { buildPrizeWheelSlices } = require('../js/story-helpers.js');

  const candidates = [
    { token: 'lazy', status: 'active', normalizedProb: 0.35 },
    { token: 'dog', status: 'active', normalizedProb: 0.25 },
    { token: 'fence', status: 'active', normalizedProb: 0.15 },
    { token: 'river', status: 'active', normalizedProb: 0.10 },
    { token: 'log', status: 'active', normalizedProb: 0.06 },
    { token: 'cat', status: 'active', normalizedProb: 0.04 },
    { token: 'grass', status: 'active', normalizedProb: 0.03 },
    { token: 'moon', status: 'active', normalizedProb: 0.02 },
    { token: 'sky', status: 'cut', normalizedProb: 0 }
  ];

  const slices = buildPrizeWheelSlices(candidates, 6);
  assert.equal(slices.length, 7, 'Should include top 6 slices plus 1 grouped other slice');
  assert.equal(slices[0].startAngle, 0);
  assert.equal(slices[slices.length - 1].endAngle, 360);
  assert.equal(slices[slices.length - 1].isOther, true);

  for (let i = 1; i < slices.length; i++) {
    assert.ok(Math.abs(slices[i].startAngle - slices[i - 1].endAngle) < 1e-6, 'Slices must be contiguous');
  }
});

test('Color palettes exclude purple, violet, and magenta tones', () => {
  const { WHEEL_SLICE_COLORS } = require('../js/story-helpers.js');
  const { BACKGROUND_ANCHORS } = require('../js/vocabulary.js');

  const isPurpleOrMagentaHex = (hex) => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (delta < 0.08) return false;
    let hue = 0;
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
    // Purple / Violet / Magenta band is roughly 255deg..330deg
    return hue >= 255 && hue <= 330;
  };

  for (const hex of WHEEL_SLICE_COLORS) {
    assert.equal(isPurpleOrMagentaHex(hex), false, `Wheel slice color ${hex} must not be purple/magenta`);
  }
  for (const anchor of BACKGROUND_ANCHORS) {
    assert.equal(isPurpleOrMagentaHex(anchor.color), false, `3D anchor color ${anchor.color} must not be purple/magenta`);
  }
});

test('Spotlight word window keeps long sentences compact and centered around active word', () => {
  const { computeSpotlightWindow } = require('../js/story-helpers.js');

  const shortWin = computeSpotlightWindow(6, 3, 7);
  assert.equal(shortWin.isCollapsed, false);
  assert.deepEqual(shortWin.indices, [0, 1, 2, 3, 4, 5]);
  assert.equal(shortWin.hiddenBefore, 0);
  assert.equal(shortWin.hiddenAfter, 0);

  const midWin = computeSpotlightWindow(24, 12, 7);
  assert.equal(midWin.isCollapsed, true);
  assert.equal(midWin.indices.length, 7);
  assert.deepEqual(midWin.indices, [9, 10, 11, 12, 13, 14, 15]);
  assert.equal(midWin.hiddenBefore, 9);
  assert.equal(midWin.hiddenAfter, 8);

  const endWin = computeSpotlightWindow(24, 23, 7);
  assert.equal(endWin.isCollapsed, true);
  assert.deepEqual(endWin.indices, [17, 18, 19, 20, 21, 22, 23]);
  assert.equal(endWin.hiddenBefore, 17);
  assert.equal(endWin.hiddenAfter, 0);
});

test('Compression stats compute bounded visual savings for token gauge', () => {
  const { computeCompressionStats } = require('../js/story-helpers.js');

  const stats = computeCompressionStats(34, 7);
  assert.equal(stats.savedPct, 79);
  assert.equal(stats.brickWidthPct, 21);

  const clamped = computeCompressionStats(1, 5);
  assert.equal(clamped.savedPct, 0);
  assert.equal(clamped.brickWidthPct, 100);
});




