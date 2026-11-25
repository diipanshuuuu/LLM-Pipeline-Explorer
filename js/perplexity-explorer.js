/**
 * Chapter 8: Perplexity Explorer (Powered by Real DistilGPT-2)
 * Calculates real token-level probabilities, surprisal heatmaps, Top-5 expected
 * alternatives with 1-click live token swapping, and an interactive visual
 * "How Perplexity Works" branching-factor explainer.
 */

const PPL_PRESETS = [
  {
    id: "predictable",
    label: "Predictable",
    text: "I went to the store to buy some milk and bread."
  },
  {
    id: "factual",
    label: "Factual",
    text: "The capital of France is Paris, and it is located in Europe."
  },
  {
    id: "surprising",
    label: "Plot Twist",
    text: "I went to the store to buy some gravity and trombones."
  },
  {
    id: "chaotic",
    label: "Chaotic",
    text: "Banana gravity elbow silently algebra trombone seven."
  }
];

class PerplexityExplorer {
  constructor(app) {
    this.app = app;
    this.inputText = PPL_PRESETS[0].text;
    this.result = null;
    this.previousPpl = null;
    this.lastDelta = null;
    this.selectedTokenIndex = -1;
    this.isLoading = false;
    this.errorMessage = null;
    this.hasInitializedFetch = false;
    this.simConfidencePct = 17; // 17% -> ~6-sided die default
    this._requestSeq = 0;
  }

  esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  formatProbPct(prob) {
    if (typeof prob !== "number" || !Number.isFinite(prob)) return "—";
    const pct = prob * 100;
    if (pct >= 10) return `${pct.toFixed(1)}%`;
    if (pct >= 1) return `${pct.toFixed(2)}%`;
    if (pct >= 0.01) return `${pct.toFixed(3)}%`;
    return `${pct.toExponential(1)}%`;
  }

  formatPpl(ppl) {
    if (typeof ppl !== "number" || !Number.isFinite(ppl)) return "—";
    if (ppl >= 1000) return Math.round(ppl).toLocaleString();
    if (ppl >= 100) return ppl.toFixed(1);
    return ppl.toFixed(2);
  }

  render(container) {
    if (!container) return;
    const res = this.result;
    const modelPill = this.isLoading
      ? "Running DistilGPT-2..."
      : res
        ? `DistilGPT-2 · ${res.inferenceMs}ms`
        : "DistilGPT-2 (82M)";

    container.innerHTML = `
      <div class="stage-card ppl-stage-card">
        <div class="stage-header-compact stage-header-row">
          <div>
            <div class="stage-kicker">08 &middot; Perplexity Explorer (Real DistilGPT-2)</div>
            <h2 class="stage-title">How surprised is a real AI by your sentence?</h2>
          </div>
          <div class="ppl-header-badges">
            ${this.lastDelta ? `
              <span class="stage-live-meta mono tabular-nums ${this.lastDelta.pct <= 0 ? "is-teal" : "is-warn"}">
                ${this.lastDelta.pct <= 0 ? "↓" : "↑"} ${Math.abs(this.lastDelta.pct)}% PPL
              </span>
            ` : ""}
            <span class="stage-live-meta mono tabular-nums" id="pplModelStatusPill">${this.esc(modelPill)}</span>
          </div>
        </div>

        <p class="stage-beginner-note beginner-only">
          <strong>Perplexity</strong> is a live surprise score from a real language model (DistilGPT-2). Everyday sentences score low; unexpected plot twists make the meter jump. <span class="try-cue">Try this: click Plot Twist, then swap a red word.</span>
        </p>

        <div class="stage-visual-container">
          <!-- Live Input & Contrast Presets -->
          <div class="inset-panel ppl-input-panel">
            <div class="ppl-input-top">
              <label for="pplSentenceInput" class="section-label">Test Sentence (Scored Live by DistilGPT-2)</label>
              <button type="button" class="preset-btn" onclick="perplexityExplorer.syncFromHeroPrompt()">
                Use Hero Prompt
              </button>
            </div>
            <form class="ppl-input-form" onsubmit="event.preventDefault(); perplexityExplorer.evaluateInput();">
              <input
                type="text"
                id="pplSentenceInput"
                class="prompt-input ppl-text-input"
                value="${this.esc(this.inputText)}"
                placeholder="Type any sentence to measure its real DistilGPT-2 perplexity..."
                maxlength="480"
                oninput="perplexityExplorer.handleTextInput(this.value)"
              >
              <button type="submit" id="pplEvaluateBtn" class="btn btn-primary" ${this.isLoading ? "disabled" : ""}>
                ${this.isLoading ? "Scoring..." : "Score Sentence"}
              </button>
            </form>
            <div class="ppl-presets-row" role="group" aria-label="Perplexity comparison presets">
              <span class="presets-label">Compare:</span>
              ${PPL_PRESETS.map(p => `
                <button
                  type="button"
                  class="preset-btn ${this.inputText.trim() === p.text ? "is-active" : ""}"
                  onclick="perplexityExplorer.applyPreset('${p.id}')"
                >${this.esc(p.label)}</button>
              `).join("")}
            </div>
          </div>

          ${this.errorMessage ? `
            <div class="ppl-error-banner" role="alert">
              <span>${this.esc(this.errorMessage)}</span>
            </div>
          ` : ""}

          ${this.renderResultsBody()}

          <!-- Visual "How Perplexity Works" Interactive Explainer -->
          ${this.renderHowItWorks()}

          <div class="beginner-deep-nudge beginner-only">
            <span>Ready to see raw probabilities, Cross-Entropy loss (nats), BPE merges, and formulas?</span>
            <button type="button" class="btn btn-sm btn-secondary" onclick="if(window.app) app.setExperienceLevel('deep')">
              Switch to Deep Lab &rarr;
            </button>
          </div>
        </div>

        <details class="stage-deep-dive deep-only">
          <summary class="deep-dive-summary">
            <span>Math Formula &middot; Cross-Entropy &amp; Perplexity</span>
            <span class="mono">+</span>
          </summary>
          <div class="deep-dive-content">
            <pre class="formula-block">NLL (Cross-Entropy) = -(1 / N) &middot; &Sigma; ln P(x_t | x_&lt;t)
Perplexity (PPL)    = exp(NLL) = ( &Pi; 1 / P(x_t | x_&lt;t) )^(1/N)
Lower PPL = higher confidence &middot; PPL = k acts like guessing 1 of k equally likely words</pre>
          </div>
        </details>
      </div>
    `;

    if (!this.hasInitializedFetch && !this.result && !this.isLoading) {
      this.hasInitializedFetch = true;
      this.evaluateText(this.inputText, false);
    }
  }

  renderResultsBody() {
    if (this.isLoading && !this.result) {
      return `
        <div class="inset-panel ppl-loading-box" aria-live="polite">
          <span class="ppl-spinner" aria-hidden="true"></span>
          <span>Loading quantized DistilGPT-2 (82M) &amp; computing 50,257-vocab logits...</span>
        </div>
      `;
    }

    if (!this.result) return "";

    const res = this.result;
    const band = res.band || classifyPerplexityBand(res.perplexity);
    const ratio = perplexityToGaugeRatio(res.perplexity);
    const arcLen = 251.33; // Half-circle radius 80 -> pi * 80
    const dashOffset = (arcLen * (1 - ratio)).toFixed(1);
    const needleAngle = -90 + ratio * 180;
    const branchChoices = Math.max(1, Math.round(res.perplexity));

    const mostTok = res.mostSurprisingIndex >= 0 ? res.tokens[res.mostSurprisingIndex] : null;
    const selectedTok = (this.selectedTokenIndex >= 0 && this.selectedTokenIndex < res.tokens.length)
      ? res.tokens[this.selectedTokenIndex]
      : mostTok || res.tokens[1] || res.tokens[0];

    const scoredTokens = res.tokens.filter(t => !t.isContext);
    const maxBits = Math.max(8, ...scoredTokens.map(t => t.surprisalBits || 0));
    const isBeginner = !this.app || this.app.experienceLevel !== "deep";
    const formatChipSub = (prob) => {
      if (isBeginner && typeof formatBeginnerProbLabel === "function") {
        return formatBeginnerProbLabel(prob);
      }
      return this.formatProbPct(prob);
    };

    return `
      <!-- Live Gauge + Plain-English Summary / Deep Telemetry -->
      <div class="ppl-metrics-grid ${this.isLoading ? "is-updating" : ""}">
        <div class="inset-panel ppl-gauge-card">
          <div class="ppl-gauge-wrap">
            <svg viewBox="0 0 220 128" class="ppl-gauge-svg" role="img" aria-label="Perplexity gauge reading ${this.formatPpl(res.perplexity)}">
              <path d="M 30 108 A 80 80 0 0 1 190 108" fill="none" stroke="var(--bg-subtle)" stroke-width="14" stroke-linecap="round"/>
              <path
                d="M 30 108 A 80 80 0 0 1 190 108"
                fill="none"
                stroke="${band.color}"
                stroke-width="14"
                stroke-linecap="round"
                stroke-dasharray="${arcLen}"
                stroke-dashoffset="${dashOffset}"
                class="ppl-gauge-arc"
              />
              <g transform="translate(110, 108) rotate(${needleAngle.toFixed(1)})">
                <line x1="0" y1="0" x2="0" y2="-66" stroke="var(--ink-primary)" stroke-width="2.5" stroke-linecap="round"/>
                <circle cx="0" cy="0" r="5" fill="${band.color}" stroke="var(--bg-surface)" stroke-width="2"/>
              </g>
              <text x="24" y="124" font-size="10" font-family="IBM Plex Mono" fill="var(--ink-muted)">1</text>
              <text x="110" y="18" text-anchor="middle" font-size="10" font-family="IBM Plex Mono" fill="var(--ink-muted)">~40</text>
              <text x="196" y="124" text-anchor="end" font-size="10" font-family="IBM Plex Mono" fill="var(--ink-muted)">1500+</text>
            </svg>
            <div class="ppl-gauge-readout">
              <div class="ppl-big-number mono tabular-nums" id="pplMainScore" style="color:${band.color};">${this.formatPpl(res.perplexity)}</div>
              <div class="ppl-band-label" style="color:${band.color};">${this.esc(band.label)}</div>
              <div class="ppl-branch-caption">
                &asymp; choosing from <strong class="mono tabular-nums">${branchChoices.toLocaleString()}</strong> words per step
              </div>
            </div>
          </div>
        </div>

        <div class="inset-panel ppl-stats-panel">
          <div class="ppl-kpi-row">
            <div class="ppl-kpi-box deep-only">
              <span class="ppl-kpi-label">Cross-Entropy Loss</span>
              <span class="ppl-kpi-val mono tabular-nums">${res.meanNll.toFixed(2)} <small>nats</small></span>
            </div>
            <div class="ppl-kpi-box deep-only">
              <span class="ppl-kpi-label">Avg Surprise</span>
              <span class="ppl-kpi-val mono tabular-nums">${res.meanBitsPerToken.toFixed(2)} <small>bits</small></span>
            </div>
            <button
              type="button"
              class="ppl-kpi-box ppl-kpi-btn"
              onclick="perplexityExplorer.selectToken(${res.mostSurprisingIndex})"
              title="Inspect the most surprising token"
            >
              <span class="ppl-kpi-label">Biggest Plot Twist</span>
              <span class="ppl-kpi-val mono" style="color:var(--rose);">
                ${mostTok ? `"${this.esc(mostTok.display.trim() || mostTok.display)}"` : "—"}
              </span>
            </button>
          </div>

          <div class="ppl-beginner-summary beginner-only">
            <div class="ppl-beginner-summary-title">What this score means</div>
            <p class="ppl-beginner-summary-copy">
              Think of Perplexity like rolling a fair die at every word. A score of <strong class="mono tabular-nums">${this.formatPpl(res.perplexity)}</strong> means DistilGPT-2 feels as uncertain as picking from roughly <strong>${branchChoices.toLocaleString()} equally likely words</strong>.
            </p>
            <p class="ppl-beginner-summary-tip">
              Green words were easy to guess; orange and red words caught the AI off guard. Tap any word below to see what DistilGPT-2 expected instead.
            </p>
          </div>

          <div class="ppl-sparkline-box deep-only">
            <div class="stage-toolbar-row" style="margin-bottom:6px;">
              <span class="section-label">Token Surprisal Profile (-log₂ P)</span>
              <span class="mono tabular-nums muted-mini">${res.scoredCount} scored tokens &middot; 50,257 vocab</span>
            </div>
            <div class="ppl-spark-bars" role="group" aria-label="Per-token surprisal bars">
              ${scoredTokens.map(t => {
                const hPct = Math.max(10, Math.min(100, Math.round((t.surprisalBits / maxBits) * 100)));
                const isSel = selectedTok && selectedTok.index === t.index;
                return `
                  <button
                    type="button"
                    class="ppl-spark-col ${isSel ? "is-selected" : ""}"
                    onclick="perplexityExplorer.selectToken(${t.index})"
                    title="${this.esc(t.display)}: ${t.surprisalBits.toFixed(1)} bits (${this.formatProbPct(t.prob)})"
                  >
                    <span class="ppl-spark-slot">
                      <span class="ppl-spark-fill" style="height:${hPct}%; background:${t.surprise.color};"></span>
                    </span>
                    <span class="ppl-spark-lbl mono">${this.esc((t.display.trim() || t.display).slice(0, 5))}</span>
                  </button>
                `;
              }).join("")}
            </div>
          </div>
        </div>
      </div>

      <!-- Interactive Token Surprisal Heatmap -->
      <div class="inset-panel ppl-heatmap-panel">
        <div class="stage-toolbar-row" style="margin-bottom:10px;">
          <span class="section-label">Word Surprise Map (tap any word to inspect &amp; swap)</span>
          <div class="ppl-heat-legend" aria-hidden="true">
            <span class="ppl-leg-item"><span class="ppl-leg-dot" style="background:#10B981;"></span>Expected</span>
            <span class="ppl-leg-item"><span class="ppl-leg-dot" style="background:#EAB308;"></span>Plausible</span>
            <span class="ppl-leg-item"><span class="ppl-leg-dot" style="background:#F97316;"></span>Surprising</span>
            <span class="ppl-leg-item"><span class="ppl-leg-dot" style="background:#EF4444;"></span>Plot Twist</span>
          </div>
        </div>

        <div class="ppl-token-heatmap" id="pplTokenHeatmap" role="group" aria-label="DistilGPT-2 token surprisal heatmap">
          ${res.tokens.map(t => {
            const isSel = selectedTok && selectedTok.index === t.index;
            if (t.isContext) {
              return `
                <button
                  type="button"
                  class="ppl-tok-chip is-context ${isSel ? "is-selected" : ""}"
                  onclick="perplexityExplorer.selectToken(${t.index})"
                  title="Starting context token (unscored)"
                >
                  <span class="ppl-tok-text mono">${this.esc(t.display)}</span>
                  <span class="ppl-tok-sub mono">Start</span>
                </button>
              `;
            }
            return `
              <button
                type="button"
                class="ppl-tok-chip is-${t.surprise.level} ${isSel ? "is-selected" : ""}"
                onclick="perplexityExplorer.selectToken(${t.index})"
                data-ppl-idx="${t.index}"
                title="Token '${this.esc(t.display)}' · P=${this.formatProbPct(t.prob)} · Rank #${t.rank.toLocaleString()}"
              >
                <span class="ppl-tok-text mono">${this.esc(t.display)}</span>
                <span class="ppl-tok-sub mono tabular-nums">${this.esc(formatChipSub(t.prob))}</span>
              </button>
            `;
          }).join("")}
        </div>

        ${this.renderTokenInspector(selectedTok, res)}
      </div>
    `;
  }

  renderTokenInspector(tok, res) {
    if (!tok) return "";
    if (tok.isContext) {
      return `
        <div class="ppl-inspector-card">
          <div class="ppl-inspector-context-note">
            <span class="mono" style="font-weight:700; color:var(--ink-primary);">"${this.esc(tok.display)}"</span>
            <span>is the first token (no earlier context yet, so DistilGPT-2 starts scoring from token #2). Tap any colored token to inspect &amp; swap!</span>
          </div>
        </div>
      `;
    }

    const prefixTokens = res.tokens.slice(Math.max(0, tok.index - 5), tok.index).map(t => t.text).join("");
    const prefixDisplay = tok.index === 0
      ? "<BOS> "
      : (tok.index > 5 ? "…" : "") + prefixTokens;

    return `
      <div class="ppl-inspector-card" id="pplTokenInspector">
        <div class="ppl-inspector-left">
          <div class="ppl-inspector-head">
            <span class="section-label">Selected Token #${tok.index + 1}</span>
            <span class="ppl-tier-pill mono" style="color:${tok.surprise.color}; border-color:${tok.surprise.color};">${this.esc(tok.surprise.label)}</span>
          </div>
          <div class="ppl-context-preview mono">
            <span class="ppl-ctx-before">${this.esc(prefixDisplay)}</span><span class="ppl-ctx-target" style="border-color:${tok.surprise.color}; color:${tok.surprise.color};">${this.esc(tok.display)}</span>
          </div>
          <div class="ppl-beginner-verdict beginner-only">
            ${tok.prob >= 0.12
              ? `DistilGPT-2 expected <strong>"${this.esc(tok.display.trim() || tok.display)}"</strong> right here.`
              : tok.prob >= 0.02
                ? `<strong>"${this.esc(tok.display.trim() || tok.display)}"</strong> makes sense, though the AI had a few stronger favorites on the right.`
                : `<strong>"${this.esc(tok.display.trim() || tok.display)}"</strong> surprised DistilGPT-2! Click any guess on the right to swap it in and watch the surprise score drop.`}
          </div>
          <div class="ppl-tok-stats-grid deep-only">
            <div class="ppl-mini-stat">
              <span class="ppl-mini-lbl">Probability P</span>
              <span class="ppl-mini-val mono tabular-nums">${this.formatProbPct(tok.prob)}</span>
            </div>
            <div class="ppl-mini-stat">
              <span class="ppl-mini-lbl">Vocab Rank</span>
              <span class="ppl-mini-val mono tabular-nums">#${tok.rank.toLocaleString()} <small>/ 50,257</small></span>
            </div>
            <div class="ppl-mini-stat">
              <span class="ppl-mini-lbl">Surprisal</span>
              <span class="ppl-mini-val mono tabular-nums">${tok.surprisalBits.toFixed(2)} <small>bits</small></span>
            </div>
            <div class="ppl-mini-stat">
              <span class="ppl-mini-lbl">Token PPL (1/P)</span>
              <span class="ppl-mini-val mono tabular-nums">${this.formatPpl(tok.tokenPerplexity)}</span>
            </div>
          </div>
        </div>

        <div class="ppl-inspector-right">
          <div class="stage-toolbar-row" style="margin-bottom:8px;">
            <span class="section-label">DistilGPT-2 Expected Instead (click to swap)</span>
            <span class="muted-mini mono">Top 5</span>
          </div>
          <div class="ppl-alts-list">
            ${(tok.topAlternatives || []).map((alt, i) => {
              const widthPct = Math.max(5, Math.min(100, Math.round(alt.prob * 100)));
              const isSame = alt.id === tok.id;
              const encodedAlt = encodeURIComponent(alt.text);
              return `
                <button
                  type="button"
                  class="ppl-alt-row ${isSame ? "is-match" : ""}"
                  onclick="perplexityExplorer.swapSelectedToken(${tok.index}, decodeURIComponent('${encodedAlt}'))"
                  title="Swap '${this.esc(tok.display)}' with '${this.esc(alt.display)}' and re-score"
                >
                  <span class="mono ppl-alt-rank">#${i + 1}</span>
                  <span class="mono ppl-alt-word">"${this.esc(alt.display)}"</span>
                  <span class="ppl-alt-track">
                    <span class="ppl-alt-fill" style="width:${widthPct}%; background:${i === 0 ? "var(--teal)" : "var(--accent-primary)"};"></span>
                  </span>
                  <span class="mono tabular-nums ppl-alt-prob">${this.formatProbPct(alt.prob)}</span>
                  <span class="ppl-alt-cta">${isSame ? "Actual ✓" : "Swap ↻"}</span>
                </button>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `;
  }

  renderHowItWorks() {
    const res = this.result;
    const sim = simulateBranchingPerplexity(this.simConfidencePct / 100);
    const visibleDoors = Math.min(24, sim.equivalentChoices);
    const overflowDoors = Math.max(0, sim.equivalentChoices - visibleDoors);

    const liveGeoProb = res ? `${(res.geometricMeanProb * 100).toFixed(1)}%` : "—";
    const liveNll = res ? `${res.meanNll.toFixed(2)} nats` : "—";
    const livePpl = res ? this.formatPpl(res.perplexity) : "—";

    return `
      <div class="inset-panel ppl-explainer-panel">
        <div class="stage-toolbar-row" style="margin-bottom:12px;">
          <span class="section-label">How Perplexity Works (Live 3-Step Breakdown)</span>
          <span class="mono muted-mini">Lower PPL = Less Surprised</span>
        </div>

        <!-- 3-Step Live Math Story Strip -->
        <div class="ppl-steps-strip">
          <div class="ppl-step-card">
            <div class="ppl-step-num mono">01 · Score Each Token</div>
            <div class="ppl-step-title">Ask: "How likely was that word?"</div>
            <div class="ppl-step-live mono tabular-nums">Avg P = ${liveGeoProb}</div>
            <div class="ppl-step-hint">DistilGPT-2 predicts all 50,257 words, then checks the probability of the actual next token.</div>
          </div>

          <div class="ppl-step-card">
            <div class="ppl-step-num mono">02 · Average Surprise</div>
            <div class="ppl-step-title">Cross-Entropy Loss (-ln P)</div>
            <div class="ppl-step-live mono tabular-nums">Loss = ${liveNll}</div>
            <div class="ppl-step-hint">Unlikely words get huge penalties. Averaging those penalties gives the Cross-Entropy Loss.</div>
          </div>

          <div class="ppl-step-card is-highlight">
            <div class="ppl-step-num mono">03 · Un-Log to Branching Factor</div>
            <div class="ppl-step-title">Perplexity = e^(Loss)</div>
            <div class="ppl-step-live mono tabular-nums">PPL = ${livePpl}</div>
            <div class="ppl-step-hint">PPL turns log-loss back into a human count: how many equally likely words the AI is torn between.</div>
          </div>
        </div>

        <!-- Interactive Branching-Factor Intuition Toy -->
        <div class="ppl-toy-box">
          <div class="stage-toolbar-row" style="margin-bottom:10px;">
            <div class="ppl-toy-title">
              <strong>Intuition Lab:</strong> Perplexity = Effective Die Size (<span class="mono">1 / P</span>)
            </div>
            <div class="presets-list">
              <button type="button" class="preset-btn ${this.simConfidencePct === 95 ? "is-active" : ""}" onclick="perplexityExplorer.setSimConfidence(95)">Certain 95%</button>
              <button type="button" class="preset-btn ${this.simConfidencePct === 50 ? "is-active" : ""}" onclick="perplexityExplorer.setSimConfidence(50)">Coin Flip 50%</button>
              <button type="button" class="preset-btn ${this.simConfidencePct === 17 ? "is-active" : ""}" onclick="perplexityExplorer.setSimConfidence(17)">6-Sided Die 17%</button>
              <button type="button" class="preset-btn ${this.simConfidencePct === 5 ? "is-active" : ""}" onclick="perplexityExplorer.setSimConfidence(5)">Stumped 5%</button>
            </div>
          </div>

          <div class="ppl-toy-slider-row">
            <label for="pplConfidenceSlider">Model Confidence P:</label>
            <input
              id="pplConfidenceSlider"
              type="range"
              min="2"
              max="95"
              step="1"
              value="${this.simConfidencePct}"
              oninput="perplexityExplorer.setSimConfidence(this.value)"
            >
            <span id="pplSimProbOut" class="mono tabular-nums ppl-sim-val">${sim.probPct}%</span>
            <span class="mono muted-mini">&rarr;</span>
            <span id="pplSimOut" class="mono tabular-nums ppl-sim-ppl" style="color:${sim.band.color};">PPL ${sim.perplexity.toFixed(1)}</span>
          </div>

          <div class="ppl-doors-stage" id="pplDoorsStage">
            <div class="ppl-doors-grid" aria-hidden="true">
              ${Array.from({ length: visibleDoors }, (_, i) => `
                <span class="ppl-door-chip ${i === 0 ? "is-target" : ""}" style="${i === 0 ? `border-color:${sim.band.color}; color:${sim.band.color};` : ""}">w${i + 1}</span>
              `).join("")}
              ${overflowDoors > 0 ? `<span class="ppl-door-more mono">+${overflowDoors} more</span>` : ""}
            </div>
            <div class="ppl-doors-caption" id="pplDoorsCaption">
              <strong style="color:${sim.band.color};">${this.esc(sim.analogy)}</strong>
              <span class="mono tabular-nums muted-mini deep-only">&middot; Loss = ${sim.nll.toFixed(2)} nats (${sim.bits.toFixed(2)} bits)</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  handleTextInput(val) {
    this.inputText = val;
  }

  syncFromHeroPrompt() {
    if (this.app && this.app.currentPrompt) {
      this.inputText = this.app.currentPrompt;
      this.evaluateText(this.inputText, true);
    }
  }

  applyPreset(presetId) {
    const found = PPL_PRESETS.find(p => p.id === presetId);
    if (!found) return;
    this.inputText = found.text;
    this.lastDelta = null;
    this.evaluateText(this.inputText, true);
  }

  evaluateInput() {
    const input = document.getElementById("pplSentenceInput");
    if (input) {
      this.inputText = input.value;
    }
    this.lastDelta = null;
    this.evaluateText(this.inputText, true);
  }

  selectToken(idx) {
    if (!this.result || !this.result.tokens || idx < 0 || idx >= this.result.tokens.length) return;
    this.selectedTokenIndex = idx;
    if (this.app) this.app.markStageExplored(8);
    this.rerenderStage();
  }

  swapSelectedToken(tokenIndex, replacementText) {
    if (!this.result || !this.result.tokens) return;
    const prevPpl = this.result.perplexity;
    const nextSentence = replaceDecodedToken(this.result.tokens, tokenIndex, replacementText);
    if (!nextSentence) return;
    this.previousPpl = prevPpl;
    this.inputText = nextSentence;
    this.evaluateText(nextSentence, true, true);
  }

  setSimConfidence(val) {
    const num = Math.max(2, Math.min(95, parseInt(val, 10) || 17));
    this.simConfidencePct = num;
    if (this.app) this.app.markStageExplored(8);

    // Fast in-place DOM update while dragging slider (avoids re-rendering whole stage)
    const slider = document.getElementById("pplConfidenceSlider");
    if (slider) slider.value = String(num);
    const sim = simulateBranchingPerplexity(num / 100);
    const probOut = document.getElementById("pplSimProbOut");
    const pplOut = document.getElementById("pplSimOut");
    const doorsStage = document.getElementById("pplDoorsStage");
    if (probOut) probOut.textContent = `${sim.probPct}%`;
    if (pplOut) {
      pplOut.textContent = `PPL ${sim.perplexity.toFixed(1)}`;
      pplOut.style.color = sim.band.color;
    }
    if (doorsStage) {
      const visibleDoors = Math.min(24, sim.equivalentChoices);
      const overflowDoors = Math.max(0, sim.equivalentChoices - visibleDoors);
      doorsStage.innerHTML = `
        <div class="ppl-doors-grid" aria-hidden="true">
          ${Array.from({ length: visibleDoors }, (_, i) => `
            <span class="ppl-door-chip ${i === 0 ? "is-target" : ""}" style="${i === 0 ? `border-color:${sim.band.color}; color:${sim.band.color};` : ""}">w${i + 1}</span>
          `).join("")}
          ${overflowDoors > 0 ? `<span class="ppl-door-more mono">+${overflowDoors} more</span>` : ""}
        </div>
        <div class="ppl-doors-caption" id="pplDoorsCaption">
          <strong style="color:${sim.band.color};">${this.esc(sim.analogy)}</strong>
          <span class="mono tabular-nums muted-mini deep-only">&middot; Loss = ${sim.nll.toFixed(2)} nats (${sim.bits.toFixed(2)} bits)</span>
        </div>
      `;
    }
  }

  async evaluateText(text, markExplored = false, isSwap = false) {
    const seq = ++this._requestSeq;
    const trimmed = String(text || "").trim();
    if (!trimmed) {
      this.errorMessage = "Enter a sentence with at least 2 words to measure perplexity.";
      this.isLoading = false;
      this.rerenderStage();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    if (markExplored && this.app) {
      this.app.markStageExplored(8);
    }
    this.rerenderStage();

    try {
      const resp = await fetch("/api/perplexity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed })
      });
      const data = await resp.json();
      if (seq !== this._requestSeq) return;

      if (!resp.ok) {
        this.errorMessage = data && data.error ? data.error : "Could not calculate perplexity.";
        this.isLoading = false;
        this.rerenderStage();
        return;
      }

      if (isSwap && typeof this.previousPpl === "number" && this.previousPpl > 0) {
        const pctChange = Math.round(((data.perplexity - this.previousPpl) / this.previousPpl) * 100);
        this.lastDelta = { from: this.previousPpl, to: data.perplexity, pct: pctChange };
        if (this.app) {
          const sign = pctChange <= 0 ? "" : "+";
          this.app.showMicroToast(
            `PPL ${this.formatPpl(this.previousPpl)} → ${this.formatPpl(data.perplexity)} (${sign}${pctChange}%)`,
            pctChange <= 0 ? "teal" : "accent"
          );
        }
      } else {
        this.lastDelta = null;
      }

      this.result = data;
      this.selectedTokenIndex = data.mostSurprisingIndex >= 0 ? data.mostSurprisingIndex : Math.min(1, data.tokens.length - 1);
      this.isLoading = false;
      this.errorMessage = null;
      this.rerenderStage();
    } catch (err) {
      if (seq !== this._requestSeq) return;
      this.isLoading = false;
      this.errorMessage = "Network error contacting local DistilGPT-2 service.";
      this.rerenderStage();
    }
  }

  rerenderStage() {
    const container = document.getElementById("stage-8");
    if (container) {
      this.render(container);
    }
  }
}

if (typeof window !== "undefined") {
  window.PerplexityExplorer = PerplexityExplorer;
}
