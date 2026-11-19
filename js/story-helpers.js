/**
 * Pure Visual-Story & Scroll-Spy Helpers
 * Decoupled from the DOM so scroll monotonicity and wheel geometry can be unit-tested cleanly.
 */

const WHEEL_SLICE_COLORS = [
  "#F97316", // Signal Orange
  "#10B981", // Emerald
  "#EAB308", // Marigold Gold
  "#0EA5E9", // Cerulean Sky
  "#EF4444", // Coral Red
  "#84CC16", // Bright Lime
  "#D97706", // Warm Amber
  "#78716C"  // Warm Stone (Other)
];

/**
 * Computes the active story chapter monotonically from section top offsets.
 * Unlike incremental IntersectionObserver callbacks (which only report entries whose
 * threshold changed and can momentarily bounce back to a previous leaving chapter),
 * checking the last section whose top has crossed the reading anchor line guarantees
 * strictly monotonic progression when scrolling down or up.
 *
 * @param {Array<{stage: number, top: number}>} sectionMetrics
 * @param {number} viewportHeight
 * @param {number} scrollY
 * @param {number} docHeight
 * @param {number} anchorRatio
 * @returns {number}
 */
function computeActiveStageFromLayout(
  sectionMetrics,
  viewportHeight,
  scrollY,
  docHeight,
  anchorRatio = 0.28
) {
  if (!Array.isArray(sectionMetrics) || sectionMetrics.length === 0) {
    return 1;
  }

  const ordered = sectionMetrics
    .slice()
    .sort((a, b) => a.stage - b.stage);

  if (scrollY <= 12) {
    return ordered[0].stage;
  }

  if (docHeight > 0 && viewportHeight > 0 && scrollY + viewportHeight >= docHeight - 16) {
    return ordered[ordered.length - 1].stage;
  }

  const anchorY = Math.max(96, Math.round((viewportHeight || 900) * anchorRatio));
  let activeStage = ordered[0].stage;

  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].top <= anchorY) {
      activeStage = ordered[i].stage;
    } else {
      break;
    }
  }

  return activeStage;
}

/**
 * Converts active candidate words and probabilities into 360-degree prize wheel slices.
 *
 * @param {Array<{token: string, status: string, normalizedProb?: number, rawProb?: number}>} candidates
 * @param {number} maxSlices
 * @returns {Array<{token: string, prob: number, startAngle: number, endAngle: number, midAngle: number, color: string, isOther: boolean}>}
 */
function buildPrizeWheelSlices(candidates, maxSlices = 7) {
  const active = (candidates || []).filter(c => c && c.status === "active");
  if (active.length === 0) {
    return [
      {
        token: "...",
        prob: 1,
        startAngle: 0,
        endAngle: 360,
        midAngle: 180,
        color: WHEEL_SLICE_COLORS[0],
        isOther: false
      }
    ];
  }

  const items = [];
  const primary = active.slice(0, maxSlices);
  primary.forEach((c, idx) => {
    const p = typeof c.normalizedProb === "number" ? c.normalizedProb : (c.rawProb || 0);
    items.push({
      token: c.token,
      prob: Math.max(0, p),
      color: WHEEL_SLICE_COLORS[idx % (WHEEL_SLICE_COLORS.length - 1)],
      isOther: false
    });
  });

  if (active.length > maxSlices) {
    const restProb = active.slice(maxSlices).reduce((sum, c) => {
      const p = typeof c.normalizedProb === "number" ? c.normalizedProb : (c.rawProb || 0);
      return sum + Math.max(0, p);
    }, 0);
    if (restProb > 0.005) {
      items.push({
        token: `+${active.length - maxSlices} more`,
        prob: restProb,
        color: WHEEL_SLICE_COLORS[WHEEL_SLICE_COLORS.length - 1],
        isOther: true
      });
    }
  }

  const totalProb = items.reduce((sum, it) => sum + it.prob, 0) || 1;
  let cursor = 0;

  return items.map((it, idx) => {
    const normalized = it.prob / totalProb;
    const sweep = idx === items.length - 1 ? 360 - cursor : normalized * 360;
    const startAngle = cursor;
    const endAngle = Math.min(360, cursor + sweep);
    cursor = endAngle;
    return {
      token: it.token,
      prob: normalized,
      startAngle,
      endAngle,
      midAngle: (startAngle + endAngle) / 2,
      color: it.color,
      isOther: it.isOther
    };
  });
}

/**
 * Computes a clean sliding window of spotlight word indices so the token bar
 * never becomes cluttered as sentences grow longer.
 *
 * @param {number} totalCount
 * @param {number} selectedIndex
 * @param {number} maxVisible
 * @returns {{isCollapsed: boolean, start: number, end: number, indices: number[], hiddenBefore: number, hiddenAfter: number}}
 */
function computeSpotlightWindow(totalCount, selectedIndex, maxVisible = 7) {
  const safeTotal = Math.max(0, Math.floor(totalCount || 0));
  if (safeTotal === 0) {
    return { isCollapsed: false, start: 0, end: -1, indices: [], hiddenBefore: 0, hiddenAfter: 0 };
  }

  const limit = Math.max(3, Math.floor(maxVisible || 7));
  const clampedSelected = Math.max(0, Math.min(safeTotal - 1, Math.floor(selectedIndex || 0)));

  if (safeTotal <= limit) {
    const indices = [];
    for (let i = 0; i < safeTotal; i++) indices.push(i);
    return {
      isCollapsed: false,
      start: 0,
      end: safeTotal - 1,
      indices,
      hiddenBefore: 0,
      hiddenAfter: 0
    };
  }

  const half = Math.floor(limit / 2);
  const start = Math.max(0, Math.min(safeTotal - limit, clampedSelected - half));
  const end = start + limit - 1;
  const indices = [];
  for (let i = start; i <= end; i++) indices.push(i);

  return {
    isCollapsed: true,
    start,
    end,
    indices,
    hiddenBefore: start,
    hiddenAfter: safeTotal - 1 - end
  };
}

/**
 * Computes visual compression bar percentages comparing raw characters to BPE bricks.
 *
 * @param {number} charCount
 * @param {number} brickCount
 * @returns {{savedPct: number, brickWidthPct: number}}
 */
function computeCompressionStats(charCount, brickCount) {
  const safeChars = Math.max(1, Math.floor(charCount || 0));
  const safeBricks = Math.max(1, Math.floor(brickCount || 0));
  const savedPct = Math.max(0, Math.min(99, Math.round((1 - safeBricks / safeChars) * 100)));
  const brickWidthPct = Math.max(12, Math.min(100, Math.round((safeBricks / safeChars) * 100)));
  return { savedPct, brickWidthPct };
}

if (typeof window !== "undefined") {
  window.computeActiveStageFromLayout = computeActiveStageFromLayout;
  window.buildPrizeWheelSlices = buildPrizeWheelSlices;
  window.computeSpotlightWindow = computeSpotlightWindow;
  window.computeCompressionStats = computeCompressionStats;
  window.WHEEL_SLICE_COLORS = WHEEL_SLICE_COLORS;
}

if (typeof global !== "undefined") {
  global.computeActiveStageFromLayout = computeActiveStageFromLayout;
  global.buildPrizeWheelSlices = buildPrizeWheelSlices;
  global.computeSpotlightWindow = computeSpotlightWindow;
  global.computeCompressionStats = computeCompressionStats;
  global.WHEEL_SLICE_COLORS = WHEEL_SLICE_COLORS;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    computeActiveStageFromLayout,
    buildPrizeWheelSlices,
    computeSpotlightWindow,
    computeCompressionStats,
    WHEEL_SLICE_COLORS
  };
}
