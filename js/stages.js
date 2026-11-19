/**
 * Pipeline Stage Renderers — Single-Page Kid-Friendly Story Edition
 * Renders all 7 interactive chapters down one continuous scrolling page with
 * everyday analogies, hands-on toys, persistent 3D WebGL viewport, and optional deep-dive math.
 */

class PipelineStages {
  constructor(app) {
    window.pipelineStages = this;
    this.app = app;
    this.math = app.math;
    this.selectedTokenIndex = 0;

    // Stage 1 state
    this.tokenizerMode = "bpe"; // "bpe" | "word" | "char"
    this.bpeSampleWord = "transformer";
    this.bpeStepIndex = 0;

    // Stage 2 state
    this.compareWordA = "quick";
    this.compareWordB = "fast";
    this.vpMode = "arrows";
    this.vpAnchorsOn = true;
    this.vpAutoRotate = false;
    this._stage2Mounted = false;
    this._lastStage2TokenSig = "";

    // Stage 3 state
    this.ropeSelectedPos = 2;
    this.ropeMode = "rope"; // "rope" | "sinusoidal" | "none"
    this.ropeAppliedTo3D = false;

    // Stage 4 state
    this.selectedHeadIndex = 0;
    this.causalMaskEnabled = true;
    this.attnViewMode = "arcs"; // "arcs" | "matrix"
    this._lastAttnArgs = null;

    // Stage 5 state
    this.stage5Tab = "norm"; // "norm" | "skip" | "ffn"
    this.normSpikeValue = 2.5;
    this.skipConnectionEnabled = true;
    this.ffnArch = "swiglu"; // "swiglu" | "gelu"
    this.normType = "rmsnorm"; // "rmsnorm" | "layernorm"

    // Stage 6 state
    this.selectedLayer = 12;

    // Stage 7 state
    this.currentSampleResult = null;
  }

  esc(str) {
    return this.app.escapeHtml(str);
  }

  renderHandoff(inLabel, inVal, stepVal, outLabel, outVal) {
    return `
      <div class="handoff-bar" aria-label="Chapter data handoff">
        <div class="handoff-col">
          <span class="handoff-tag">What goes in &middot; ${this.esc(inLabel)}</span>
          <span class="handoff-val mono">${this.esc(inVal)}</span>
        </div>
        <span class="handoff-arrow" aria-hidden="true">&rarr;</span>
        <div class="handoff-col">
          <span class="handoff-tag">What this step does</span>
          <span class="handoff-val">${this.esc(stepVal)}</span>
        </div>
        <span class="handoff-arrow" aria-hidden="true">&rarr;</span>
        <div class="handoff-col">
          <span class="handoff-tag">What comes out &middot; ${this.esc(outLabel)}</span>
          <span class="handoff-val is-out mono">${this.esc(outVal)}</span>
        </div>
      </div>
    `;
  }

  renderTryThis(htmlText) {
    return `
      <div class="try-this-bar">
        <span class="try-this-lead">Play with it:</span>
        <span>${htmlText}</span>
      </div>
    `;
  }

  selectToken(idx) {
    this.selectedTokenIndex = idx;
    this.app.renderLiveTokenBar();
    this.app.renderStageById(1);
    this.updateStage2HandoffAndInspector();
    if (window.vectorView) {
      window.vectorView.selectTokenByIndex(idx);
    }
    this.app.renderStageById(4);
    this.app.renderStageById(5);
  }

  // ========================================================================
  // CHAPTER 1: Word Bricks (Tokenization & Live LEGO Merge Machine)
  // ========================================================================
  renderStage1(container) {
    const rawText = this.app.currentPrompt;
    const mode = this.tokenizerMode || "bpe";

    const bpeTokens = tokenizeBPE(rawText);
    const wordTokens = tokenizeWordLevel(rawText);
    const charTokens = tokenizeCharLevel(rawText);

    let displayTokens = bpeTokens;
    if (mode === "word") displayTokens = wordTokens;
    if (mode === "char") displayTokens = charTokens;

    const selectedIdx = Math.min(this.selectedTokenIndex, Math.max(0, displayTokens.length - 1));
    const activeToken = displayTokens[selectedIdx] || displayTokens[0] || { text: "...", id: 0, bytes: [0x2e] };

    const bpeCount = bpeTokens.length;
    const charCount = Math.max(1, charTokens.length);
    const savingsPct = Math.max(0, Math.round((1 - bpeCount / charCount) * 100));

    const steps = getBPEMergeSteps(this.bpeSampleWord || "transformer");
    const maxStep = Math.max(0, steps.length - 1);
    this.bpeStepIndex = Math.min(this.bpeStepIndex, maxStep);
    const currentStep = steps[this.bpeStepIndex] || steps[0];

    const idPreview = bpeTokens.slice(0, 4).map(t => `#${t.id}`).join(", ") + (bpeTokens.length > 4 ? ", ..." : "");

    container.innerHTML = `
      <div class="stage-card">
        <div class="stage-top-header">
          <div class="stage-kicker">Chapter 1 of 7 &middot; Word Bricks (Tokenization)</div>
          <h2 class="stage-title">Chopping your sentence into numbered LEGO bricks</h2>
          <div class="stage-summary-box">
            <strong>Imagine this:</strong> Computers can't read English letters the way your eyes do—they only understand numbers! So first, the AI snaps your sentence into familiar LEGO-like pieces (called <strong>tokens</strong>) and stamps each piece with a secret ID number from its giant dictionary.
          </div>
          ${this.renderHandoff(
            "Your sentence",
            `"${rawText.slice(0, 22)}${rawText.length > 22 ? "..." : ""}"`,
            "Snaps text into reusable LEGO word pieces",
            "Secret Brick IDs",
            `[${idPreview}]`
          )}
        </div>

        <div class="stage-visual-container">
          ${this.renderTryThis("Click any word brick below to peek at its secret ID number, or switch between <strong>Smart Bricks</strong> and <strong>Single Letters</strong> to see why grouping letters saves the AI tons of work.")}

          <div class="stage-toolbar-row">
            <span class="section-label">Your sentence snapped into ${displayTokens.length} bricks</span>
            <div class="segmented-group" role="group" aria-label="Brick slicing method">
              <button type="button" class="seg-btn ${mode === "bpe" ? "is-active" : ""}" onclick="pipelineStages.setTokenizerMode('bpe')">Smart Bricks / BPE (${bpeTokens.length})</button>
              <button type="button" class="seg-btn ${mode === "word" ? "is-active" : ""}" onclick="pipelineStages.setTokenizerMode('word')">Whole Words (${wordTokens.length})</button>
              <button type="button" class="seg-btn ${mode === "char" ? "is-active" : ""}" onclick="pipelineStages.setTokenizerMode('char')">Single Letters (${charTokens.length})</button>
            </div>
          </div>

          <div class="inset-panel">
            <div class="token-blocks-grid">
              ${displayTokens.map((t, idx) => `
                <button type="button" class="token-block ${idx === selectedIdx ? "active" : ""}" onclick="pipelineStages.selectToken(${idx})">
                  <span class="token-word">"${this.esc(t.text)}"</span>
                  <span class="token-id-sub tabular-nums">ID #${t.id}</span>
                </button>
              `).join("")}
            </div>
          </div>

          <div class="inspector-grid">
            <div class="stat-cell">
              <div class="stat-cell-label">Spotlight Brick &amp; Secret ID</div>
              <div class="stat-cell-value tabular-nums">"${this.esc(activeToken.text)}" &middot; #${activeToken.id}</div>
            </div>
            <div class="stat-cell">
              <div class="stat-cell-label">Computer Number Codes (UTF-8)</div>
              <div class="stat-cell-value tabular-nums">[${(activeToken.bytes || []).slice(0, 6).map(b => "0x" + b.toString(16).toUpperCase().padStart(2, "0")).join(" ")}]</div>
            </div>
            <div class="stat-cell">
              <div class="stat-cell-label">Bricks Saved vs 1-by-1 Letters</div>
              <div class="stat-cell-value tabular-nums">${bpeCount} bricks vs ${charCount} letters (${savingsPct}% fewer!)</div>
            </div>
          </div>

          <!-- Interactive BPE LEGO Glue Explorer -->
          <div class="inset-panel bpe-stepper-panel">
            <div class="stage-toolbar-row">
              <div>
                <div class="section-label">How does an AI invent Smart Bricks? Watch it glue letters together!</div>
                <div style="font-size:12px; color:var(--ink-muted);">Click <strong>Glue Next Pair</strong> to watch tiny single letters snap into bigger, reusable word pieces.</div>
              </div>
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <select aria-label="Choose word to glue" class="clean-select" onchange="pipelineStages.setBpeSampleWord(this.value)">
                  ${["transformer", "attention", "unbelievable", "sleeping", "quick"].map(w => `
                    <option value="${w}" ${this.bpeSampleWord === w ? "selected" : ""}>${w}</option>
                  `).join("")}
                </select>
                <button type="button" class="btn btn-sm" onclick="pipelineStages.stepBpe(-1)" ${this.bpeStepIndex <= 0 ? "disabled" : ""}>Undo</button>
                <button type="button" class="btn btn-sm btn-primary" onclick="pipelineStages.stepBpe(1)" ${this.bpeStepIndex >= maxStep ? "disabled" : ""}>Glue Next Pair</button>
                <button type="button" class="btn btn-sm" onclick="pipelineStages.resetBpeSteps()">Start Over</button>
              </div>
            </div>

            <div class="bpe-pieces-row">
              ${currentStep.pieces.map(piece => `
                <span class="bpe-piece ${currentStep.mergedToken === piece ? "is-merged" : ""}">"${this.esc(piece)}"</span>
              `).join("")}
            </div>
            <div style="font-size:12px; color:var(--ink-secondary); display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
              <span><strong>Glue Step ${this.bpeStepIndex} of ${maxStep}:</strong> ${this.esc(currentStep.description)}</span>
              <span class="mono tabular-nums">${currentStep.pieces.length} ${currentStep.pieces.length === 1 ? "brick" : "bricks"}</span>
            </div>
          </div>
        </div>

        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>Want the Nerdy AI Math? (BPE Dictionary &amp; Byte Fallback)</span>
            <span class="mono">+</span>
          </summary>
          <div class="deep-dive-content">
            <p>During training, Byte-Pair Encoding (BPE) scans billions of pages, finds the most common pair of letters standing next to each other, and glues them into one new brick until the dictionary reaches size |V|.</p>
            <pre class="formula-block">Dictionary size |V|: 50,257 (GPT-2) to 128,256 (LLaMA-3)
Sentence mapping:    text &rarr; [id_1, id_2, ..., id_N]
Weird emoji/symbol:  UTF-8 1-byte fallback (0x00 .. 0xFF)</pre>
          </div>
        </details>
      </div>
    `;
  }

  setTokenizerMode(mode) {
    this.tokenizerMode = mode;
    this.app.renderStageById(1);
  }

  setBpeSampleWord(word) {
    this.bpeSampleWord = word || "transformer";
    this.bpeStepIndex = 0;
    this.app.renderStageById(1);
  }

  stepBpe(delta) {
    const steps = getBPEMergeSteps(this.bpeSampleWord || "transformer");
    this.bpeStepIndex = Math.max(0, Math.min(steps.length - 1, this.bpeStepIndex + delta));
    this.app.renderStageById(1);
  }

  resetBpeSteps() {
    this.bpeStepIndex = 0;
    this.app.renderStageById(1);
  }

  // ========================================================================
  // CHAPTER 2: 3D Meaning Map (Persistent WebGL Embeddings + Twin Tester)
  // ========================================================================
  buildStage2HandoffHtml() {
    const tokens = this.app.tokens;
    const hp = this.app.hyperparams;
    const focusTok = tokens[Math.min(this.selectedTokenIndex, Math.max(0, tokens.length - 1))] || tokens[0];
    const focusVec = this.math.getTokenEmbedding(focusTok, hp.d_model);
    const vecSnippet = `[${focusVec.slice(0, 3).map(v => (v >= 0 ? "+" : "") + v.toFixed(2)).join(", ")}, ...]`;

    return this.renderHandoff(
      "From Chapter 1",
      `Brick #${focusTok.id} ("${focusTok.text}")`,
      "Looks up its GPS spot on the meaning map",
      "8 Meaning Clues",
      vecSnippet
    );
  }

  renderStage2(container) {
    const tokens = this.app.tokens;
    const hp = this.app.hyperparams;
    const tokenSig = tokens.map(t => `${t.id}:${t.text}`).join("|") + `@${hp.d_model}:${this.ropeAppliedTo3D ? 1 : 0}`;
    const existingViewport = container.querySelector("#threeViewportContainer");

    if (existingViewport && this._stage2Mounted) {
      // Zero-flicker live update: preserve the mounted 3D WebGL canvas!
      this.updateStage2HandoffAndInspector();
      this.syncStage2ToolbarButtons();
      if (window.vectorView) {
        window.vectorView.mode = this.vpMode;
        window.vectorView.toggleAnchors(this.vpAnchorsOn);
        if (this._lastStage2TokenSig !== tokenSig) {
          this._lastStage2TokenSig = tokenSig;
          window.vectorView.updateTokens(tokens, hp.d_model, this.ropeAppliedTo3D ? 25 : 0);
          window.vectorView.fitCameraToScene();
        }
        window.vectorView.requestRender();
      }
      return;
    }

    const vocabOptions = this.getComparableWordList();

    container.innerHTML = `
      <div class="stage-card">
        <div class="stage-top-header">
          <div class="stage-kicker">Chapter 2 of 7 &middot; 3D Meaning Map (Embeddings)</div>
          <h2 class="stage-title">Placing every word on a 3D treasure map of meaning</h2>
          <div class="stage-summary-box">
            <strong>Imagine this:</strong> A brick number like #42 doesn't tell the AI what a word actually means. So the AI looks up a secret GPS address for each brick on a 3D map. Words with similar meanings—like <em>quick</em> and <em>fast</em>, or <em>fox</em> and <em>dog</em>—live in the same neighborhood!
          </div>
          <div id="stage2HandoffSlot">${this.buildStage2HandoffHtml()}</div>
        </div>

        <div class="stage-visual-container">
          ${this.renderTryThis("Drag inside the dark 3D map to spin it around! Then click <strong>fox vs dog</strong> and <strong>fox vs transformer</strong> on the right to see how close neighbors have a tiny angle between them.")}
          <div class="stage2-split">
            <!-- Left: Interactive 3D Meaning Map -->
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div class="viewport-clean" id="threeViewportContainer" data-testid="three-viewport">
                <div class="viewport-toolbar">
                  <div class="viewport-toolbar-group">
                    <button type="button" id="vpModeArrows" class="vp-btn ${this.vpMode === "arrows" ? "is-active" : ""}" onclick="pipelineStages.setViewportMode('arrows')">Arrows</button>
                    <button type="button" id="vpModePoints" class="vp-btn ${this.vpMode === "points" ? "is-active" : ""}" onclick="pipelineStages.setViewportMode('points')">Dots</button>
                    <button type="button" id="vpAnchorsBtn" class="vp-btn ${this.vpAnchorsOn ? "is-active" : ""}" onclick="pipelineStages.toggleViewportAnchors()">Neighbors</button>
                  </div>
                  <div class="viewport-toolbar-group">
                    <button type="button" id="vpRotateBtn" class="vp-btn ${this.vpAutoRotate ? "is-active" : ""}" onclick="pipelineStages.toggleViewportRotate()">Spin Map</button>
                    <button type="button" class="vp-btn" onclick="if(window.vectorView) vectorView.resetCamera()">Reset View</button>
                  </div>
                </div>
                <div id="vectorSpaceHUD" class="vector-hud-container hidden"></div>
              </div>
              <div class="viewport-help-bar">
                <span>Drag to spin &middot; Scroll to zoom &middot; Click any 2 word labels to measure how close they are</span>
                <span class="mono">Neighborhoods: Animals &middot; Speed &middot; Actions &middot; Helpers</span>
              </div>
            </div>

            <!-- Right: Word Twin Tester + 8 Secret Personality Bars -->
            <div class="inset-panel similarity-panel" id="stage2Inspector">
              <div class="section-label">Word Twin Tester &amp; Meaning Scoreboard</div>

              <div class="select-pair-row">
                <select id="compareWordASelect" aria-label="First word to compare" class="clean-select" onchange="pipelineStages.setComparePair(this.value, pipelineStages.compareWordB)">
                  ${vocabOptions.map(w => `<option value="${this.esc(w)}" ${this.compareWordA.toLowerCase() === w.toLowerCase() ? "selected" : ""}>"${this.esc(w)}"</option>`).join("")}
                </select>
                <span class="mono" style="font-size:12px; color:var(--ink-muted);">vs</span>
                <select id="compareWordBSelect" aria-label="Second word to compare" class="clean-select" onchange="pipelineStages.setComparePair(pipelineStages.compareWordA, this.value)">
                  ${vocabOptions.map(w => `<option value="${this.esc(w)}" ${this.compareWordB.toLowerCase() === w.toLowerCase() ? "selected" : ""}>"${this.esc(w)}"</option>`).join("")}
                </select>
              </div>

              <div class="presets-list">
                <button type="button" class="preset-btn" onclick="pipelineStages.setComparePair('quick', 'fast')">quick vs fast</button>
                <button type="button" class="preset-btn" onclick="pipelineStages.setComparePair('fox', 'dog')">fox vs dog</button>
                <button type="button" class="preset-btn" onclick="pipelineStages.setComparePair('quick', 'lazy')">quick vs lazy</button>
                <button type="button" class="preset-btn" onclick="pipelineStages.setComparePair('fox', 'transformer')">fox vs transformer</button>
              </div>

              <div id="stage2SimilarityReadout"></div>
              <div id="stage2VectorDNA"></div>
            </div>
          </div>
        </div>

        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>Want the Nerdy AI Math? (Embedding Matrix &amp; Cosine Similarity)</span>
            <span class="mono">+</span>
          </summary>
          <div class="deep-dive-content">
            <p>Each brick ID pulls out one row from a giant lookup table called the Embedding Matrix <strong>E</strong>. Real models like LLaMA-3 give every word 4,096 secret numbers instead of 3—we shrink it to 3D here so human eyes can explore it!</p>
            <pre class="formula-block">GPS lookup:         e_i = E[token_id]
Twin score (cos):   cos(&theta;) = (u &middot; v) / (||u|| &times; ||v||)
Meaning:            +1.0 = exact twins, 0.0 = strangers, -1.0 = opposites</pre>
          </div>
        </details>
      </div>
    `;

    this._stage2Mounted = true;
    this._lastStage2TokenSig = tokenSig;
    this.updateStage2Inspector();

    setTimeout(() => {
      const Ctor = window.VectorSpace3D || (typeof VectorSpace3D !== "undefined" ? VectorSpace3D : null);
      if (!window.vectorView && Ctor) {
        window.vectorView = new Ctor("threeViewportContainer");
      } else if (window.vectorView && window.vectorView.renderer) {
        const mount = document.getElementById("threeViewportContainer");
        if (mount) {
          window.vectorView.mountTo(mount);
        }
      }
      if (window.vectorView) {
        window.vectorView.mode = this.vpMode;
        window.vectorView.toggleAnchors(this.vpAnchorsOn);
        window.vectorView.updateTokens(tokens, hp.d_model, this.ropeAppliedTo3D ? 25 : 0);
        window.vectorView.fitCameraToScene();
        window.vectorView.requestRender();
      }
    }, 30);
  }

  updateStage2HandoffAndInspector() {
    const slot = document.getElementById("stage2HandoffSlot");
    if (slot) {
      slot.innerHTML = this.buildStage2HandoffHtml();
    }
    const vocabOptions = this.getComparableWordList();
    const simAEl = document.getElementById("compareWordASelect");
    const simBEl = document.getElementById("compareWordBSelect");
    if (simAEl) {
      simAEl.innerHTML = vocabOptions.map(w => `<option value="${this.esc(w)}" ${this.compareWordA.toLowerCase() === w.toLowerCase() ? "selected" : ""}>"${this.esc(w)}"</option>`).join("");
    }
    if (simBEl) {
      simBEl.innerHTML = vocabOptions.map(w => `<option value="${this.esc(w)}" ${this.compareWordB.toLowerCase() === w.toLowerCase() ? "selected" : ""}>"${this.esc(w)}"</option>`).join("");
    }
    this.updateStage2Inspector();
  }

  syncStage2ToolbarButtons() {
    const arrows = document.getElementById("vpModeArrows");
    const points = document.getElementById("vpModePoints");
    const anchors = document.getElementById("vpAnchorsBtn");
    const rotate = document.getElementById("vpRotateBtn");
    if (arrows) arrows.classList.toggle("is-active", this.vpMode === "arrows");
    if (points) points.classList.toggle("is-active", this.vpMode === "points");
    if (anchors) anchors.classList.toggle("is-active", this.vpAnchorsOn);
    if (rotate) rotate.classList.toggle("is-active", this.vpAutoRotate);
  }

  getComparableWordList() {
    const set = new Set();
    this.app.tokens.forEach(t => set.add(t.text));
    ["quick", "fast", "slow", "lazy", "fox", "dog", "cat", "brown", "red", "jumps", "sleeps", "transformer", "attention"].forEach(w => set.add(w));
    return Array.from(set);
  }

  setViewportMode(mode) {
    this.vpMode = mode;
    if (window.vectorView) {
      window.vectorView.setMode(mode);
    }
    this.syncStage2ToolbarButtons();
  }

  toggleViewportAnchors() {
    this.vpAnchorsOn = !this.vpAnchorsOn;
    if (window.vectorView) {
      window.vectorView.toggleAnchors(this.vpAnchorsOn);
    }
    this.syncStage2ToolbarButtons();
  }

  toggleViewportRotate() {
    this.vpAutoRotate = !this.vpAutoRotate;
    if (window.vectorView) {
      window.vectorView.toggleAutoRotate(this.vpAutoRotate);
    }
    this.syncStage2ToolbarButtons();
  }

  setComparePair(wA, wB) {
    this.compareWordA = wA;
    this.compareWordB = wB;
    this.updateStage2Inspector();
  }

  updateStage2Inspector() {
    const hp = this.app.hyperparams;
    const tokens = this.app.tokens;
    const wordA = this.compareWordA || "quick";
    const wordB = this.compareWordB || "fast";

    const findTok = (word) => {
      const fromVocab = VOCABULARY_LIST.find(v => v.text.toLowerCase() === word.toLowerCase());
      if (fromVocab) return fromVocab;
      const fromPrompt = tokens.find(t => t.text.toLowerCase() === word.toLowerCase());
      if (fromPrompt) return fromPrompt;
      return formatToken(word, 999, [0x61], "custom", null);
    };

    const vecA = this.math.getTokenEmbedding(findTok(wordA), hp.d_model);
    const vecB = this.math.getTokenEmbedding(findTok(wordB), hp.d_model);
    const cosSim = MathEngine.cosineSimilarity(vecA, vecB);
    const angleDeg = MathEngine.angleBetween(vecA, vecB);

    const verdict = cosSim > 0.65
      ? "Almost twins! They live right next door."
      : cosSim > 0.15
        ? "Friendly neighbors in a similar area."
        : cosSim > -0.2
          ? "Total strangers pointing different ways (~90°)."
          : "Opposites on the map! (>90° apart)";

    const simColor = cosSim > 0.65 ? "var(--teal)" : cosSim < -0.1 ? "var(--rose)" : "var(--accent-primary)";

    const rad = (Math.min(180, Math.max(5, angleDeg)) * Math.PI) / 180;
    const gx = 90 + Math.cos(-rad) * 58;
    const gy = 74 + Math.sin(-rad) * 58;
    const largeArc = angleDeg > 180 ? 1 : 0;

    const simAEl = document.getElementById("compareWordASelect");
    const simBEl = document.getElementById("compareWordBSelect");
    if (simAEl) simAEl.value = wordA;
    if (simBEl) simBEl.value = wordB;

    const simEl = document.getElementById("stage2SimilarityReadout");
    if (simEl) {
      simEl.innerHTML = `
        <div class="stat-cell" style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <svg width="118" height="72" viewBox="0 0 180 88" aria-label="Angle gauge showing ${angleDeg.toFixed(1)} degrees" style="flex-shrink:0;">
            <line x1="82" y1="74" x2="144" y2="74" stroke="#2563EB" stroke-width="3" stroke-linecap="round"/>
            <line x1="82" y1="74" x2="${(gx - 8).toFixed(1)}" y2="${gy.toFixed(1)}" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/>
            <path d="M 108 74 A 26 26 0 ${largeArc} 0 ${(82 + Math.cos(-rad) * 26).toFixed(1)} ${(74 + Math.sin(-rad) * 26).toFixed(1)}" fill="none" stroke="#64748B" stroke-width="1.5" stroke-dasharray="3 2"/>
            <circle cx="82" cy="74" r="3.5" fill="#14181F"/>
            <text x="147" y="78" font-size="11" font-family="JetBrains Mono" fill="#2563EB">${this.esc(wordA.slice(0, 6))}</text>
            <text x="${(gx - 8 + (gx >= 90 ? 4 : -34)).toFixed(1)}" y="${Math.max(12, gy - 4).toFixed(1)}" font-size="11" font-family="JetBrains Mono" fill="#0D9488">${this.esc(wordB.slice(0, 6))}</text>
          </svg>
          <div style="min-width:0; flex:1;">
            <div class="mono tabular-nums" style="font-size:20px; font-weight:700; color:${simColor};">${cosSim.toFixed(3)}</div>
            <div class="mono tabular-nums" style="font-size:12px; color:var(--ink-secondary);">Map Angle: ${angleDeg.toFixed(1)}&deg;</div>
            <div style="font-size:12px; color:var(--ink-muted); margin-top:2px;">${verdict}</div>
          </div>
        </div>
      `;
    }

    const selectedIdx = Math.min(this.selectedTokenIndex, Math.max(0, tokens.length - 1));
    const activeTok = tokens[selectedIdx] || tokens[0];
    const activeVec = this.math.getTokenEmbedding(activeTok, hp.d_model);

    const dnaEl = document.getElementById("stage2VectorDNA");
    const dimHints = ["Topic", "Speed", "Action", "Nature", "Helper", "Thing", "Size", "Vibe"];
    if (dnaEl) {
      dnaEl.innerHTML = `
        <div style="font-size:12px; font-weight:600; color:var(--ink-secondary); margin-bottom:6px;">
          Secret meaning bars inside <span class="mono">"${this.esc(activeTok.text)}"</span>:
        </div>
        <div class="vector-dna-list">
          ${activeVec.map((val, i) => {
            const pct = Math.min(48, Math.abs(val) * 55);
            const left = val >= 0 ? 50 : 50 - pct;
            const color = val >= 0 ? "var(--accent-primary)" : "var(--amber)";
            const hint = dimHints[i] || `d${i}`;
            return `
              <div class="dna-row" style="grid-template-columns: 62px 1fr 48px;" title="Feature d${i} (${hint}): ${val.toFixed(3)}">
                <span style="color:var(--ink-muted); font-size:10.5px;">${hint}</span>
                <div class="dna-track">
                  <div class="dna-zero"></div>
                  <div class="dna-bar" style="left:${left.toFixed(1)}%; width:${pct.toFixed(1)}%; background:${color};"></div>
                </div>
                <span class="tabular-nums" style="text-align:right; color:var(--ink-primary);">${val >= 0 ? "+" : ""}${val.toFixed(2)}</span>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }
  }

  // ========================================================================
  // CHAPTER 3: Word Order Clocks (RoPE & Positional Encoding)
  // ========================================================================
  renderStage3(container) {
    const tokens = this.app.tokens;
    const mode = this.ropeMode || "rope";
    this.ropeSelectedPos = Math.min(this.ropeSelectedPos, Math.max(0, tokens.length - 1));
    const tokenAtPos = tokens[this.ropeSelectedPos] || tokens[0];

    container.innerHTML = `
      <div class="stage-card">
        <div class="stage-top-header">
          <div class="stage-kicker">Chapter 3 of 7 &middot; Word Order Clocks (Position)</div>
          <h2 class="stage-title">Giving every word a spinning seat-number clock</h2>
          <div class="stage-summary-box">
            <strong>Imagine this:</strong> "Dog chases fox" and "Fox chases dog" have the exact same words—only the <strong>order</strong> tells you who is running! To remember who came first, modern AI spins a tiny clock hand on each word (called <strong>RoPE</strong>): Seat #0 starts at 12 o'clock, Seat #1 clicks forward one notch, and so on.
          </div>
          ${this.renderHandoff(
            "From Chapter 2",
            `${tokens.length} floating word locations`,
            "Stamps each word's seat number with a clock angle",
            "Ordered Words",
            `"${tokenAtPos.text}" @ ${this.ropeSelectedPos * 36}°`
          )}
        </div>

        <div class="stage-visual-container">
          ${this.renderTryThis("Click any word seat below to watch its clock hand spin! Then click <strong>No Order (Word Soup!)</strong> to see what goes wrong if the AI forgets word order.")}

          <div class="stage-toolbar-row">
            <span class="section-label">How the AI remembers seat order</span>
            <div class="segmented-group" role="group" aria-label="Word order method">
              <button type="button" class="seg-btn ${mode === "rope" ? "is-active" : ""}" onclick="pipelineStages.setRoPEMode('rope')">Spinning Clocks (RoPE)</button>
              <button type="button" class="seg-btn ${mode === "sinusoidal" ? "is-active" : ""}" onclick="pipelineStages.setRoPEMode('sinusoidal')">Music Waves (Classic)</button>
              <button type="button" class="seg-btn ${mode === "none" ? "is-active" : ""}" onclick="pipelineStages.setRoPEMode('none')">No Order (Word Soup!)</button>
            </div>
          </div>

          <div class="slot-chips-row" id="ropeSlotChips" role="group" aria-label="Pick a word seat">
            ${tokens.map((t, idx) => `
              <button type="button" class="slot-chip-btn ${idx === this.ropeSelectedPos ? "is-active" : ""}" data-rope-pos="${idx}" onclick="pipelineStages.setRoPEPosition(${idx})">
                <span style="opacity:0.7;">Seat #${idx + 1}</span>
                <span>"${this.esc(t.text)}"</span>
              </button>
            `).join("")}
          </div>

          <div class="rope-stage-grid">
            <div class="canvas-frame">
              <canvas id="ropeDialCanvas" class="dial-canvas" width="460" height="290"></canvas>
              <div style="width:100%; display:flex; align-items:center; justify-content:space-between; gap:12px; color:#CBD5E1; font-size:12px;">
                <label for="ropePosSlider" style="white-space:nowrap;">Slide seat:</label>
                <input id="ropePosSlider" type="range" min="0" max="${Math.max(0, tokens.length - 1)}" value="${this.ropeSelectedPos}" oninput="pipelineStages.setRoPEPosition(this.value)" style="flex:1;">
                <span id="ropePosReadout" class="mono tabular-nums" style="color:#F8FAFC; white-space:nowrap;">Seat #${this.ropeSelectedPos + 1} "${this.esc(tokenAtPos.text)}" (${this.ropeSelectedPos * 36}&deg;)</span>
              </div>
            </div>

            <div class="inset-panel" style="display:flex; flex-direction:column; justify-content:space-between; gap:14px;">
              <div id="ropeExplainPanel"></div>
              <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <button type="button" class="btn btn-sm btn-primary" onclick="pipelineStages.applyRoPETo3D()">
                  ${this.ropeAppliedTo3D ? "Clock Spin ON in 3D Map ↑" : "See This Spin on the 3D Map ↑"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>Want the Nerdy AI Math? (Rotary Position Embeddings / RoPE)</span>
            <span class="mono">+</span>
          </summary>
          <div class="deep-dive-content">
            <p>RoPE pairs numbers (x<sub>2i</sub>, x<sub>2i+1</sub>) inside each word and rotates them by angle m &times; &theta;<sub>i</sub>, where m is the word's seat index. Because it uses rotation, two words always know how many seats apart they are!</p>
            <pre class="formula-block">x'_2i     = x_2i &middot; cos(m&theta;_i) &minus; x_(2i+1) &middot; sin(m&theta;_i)
x'_(2i+1) = x_2i &middot; sin(m&theta;_i) + x_(2i+1) &middot; cos(m&theta;_i)
Cool trick: &lt;Rotate(q, m), Rotate(k, n)&gt; only depends on distance (m &minus; n)</pre>
          </div>
        </details>
      </div>
    `;

    this.updateStage3Visuals();
  }

  setRoPEMode(mode) {
    this.ropeMode = mode;
    this.app.renderStageById(3);
  }

  setRoPEPosition(pos) {
    this.ropeSelectedPos = parseInt(pos, 10) || 0;
    const slider = document.getElementById("ropePosSlider");
    if (slider) slider.value = String(this.ropeSelectedPos);
    const chips = document.getElementById("ropeSlotChips");
    if (chips) {
      Array.from(chips.querySelectorAll("[data-rope-pos]")).forEach(btn => {
        const idx = parseInt(btn.getAttribute("data-rope-pos"), 10);
        btn.classList.toggle("is-active", idx === this.ropeSelectedPos);
      });
    }
    this.updateStage3Visuals();
  }

  applyRoPETo3D() {
    this.ropeAppliedTo3D = !this.ropeAppliedTo3D;
    if (window.vectorView) {
      window.vectorView.updateTokens(this.app.tokens, this.app.hyperparams.d_model, this.ropeAppliedTo3D ? 25 : 0);
      window.vectorView.fitCameraToScene();
      window.vectorView.requestRender();
    }
    this.app.renderStageById(3);
    this.app.setActiveStage(2);
  }

  updateStage3Visuals() {
    const tokens = this.app.tokens;
    const pos = Math.min(this.ropeSelectedPos, Math.max(0, tokens.length - 1));
    const tok = tokens[pos] || tokens[0];

    const readout = document.getElementById("ropePosReadout");
    if (readout) {
      readout.innerHTML = `Seat #${pos + 1} "${this.esc(tok.text)}" (${pos * 36}&deg;)`;
    }

    const panel = document.getElementById("ropeExplainPanel");
    if (panel) {
      if (this.ropeMode === "none") {
        panel.innerHTML = `
          <div class="section-label" style="margin-bottom:8px;">Uh-oh! Word Soup Mode</div>
          <p style="font-size:13px; color:var(--ink-secondary); margin-bottom:10px;">
            Without seat numbers, all your words get dumped into one messy pile—the AI has no clue who came first!
          </p>
          <div class="stat-cell" style="margin-bottom:8px;">
            <div class="stat-cell-label">"dog chases fox" vs "fox chases dog"</div>
            <div class="stat-cell-value" style="color:var(--rose);">Look 100% identical to the AI!</div>
          </div>
          <p style="font-size:12px; color:var(--ink-muted);">Click <strong>Spinning Clocks (RoPE)</strong> to put every word back in its right seat.</p>
        `;
      } else if (this.ropeMode === "sinusoidal") {
        const pe = MathEngine.sinusoidalPE(tokens.length, 6)[pos] || [];
        panel.innerHTML = `
          <div class="section-label" style="margin-bottom:8px;">Music Wave Stamp at Seat #${pos + 1}</div>
          <p style="font-size:13px; color:var(--ink-secondary); margin-bottom:10px;">
            Older AIs (from 2017) added wavy musical ripples of different speeds onto <strong>"${this.esc(tok.text)}"</strong> so every seat gets a unique barcode:
          </p>
          <div class="stat-cell">
            <div class="stat-cell-label">Wave stamp added to this word</div>
            <div class="mono tabular-nums" style="font-size:12px; color:var(--ink-primary); margin-top:4px;">
              [${pe.map(v => (v >= 0 ? "+" : "") + v.toFixed(2)).join(", ")}]
            </div>
          </div>
        `;
      } else {
        panel.innerHTML = `
          <div class="section-label" style="margin-bottom:8px;">Clock Hand for Seat #${pos + 1}</div>
          <p style="font-size:13px; color:var(--ink-secondary); margin-bottom:10px;">
            The word <strong>"${this.esc(tok.text)}"</strong> sits in Seat <strong>#${pos + 1}</strong>, so its clock hand turns <strong>${pos * 36}&deg;</strong>. Every step down the line clicks another 36&deg; forward—so neighbors are always easy to spot!
          </p>
          <div class="stat-cell">
            <div class="stat-cell-label">Steps from the first word ("${this.esc(tokens[0].text)}")</div>
            <div class="stat-cell-value tabular-nums">${pos} ${pos === 1 ? "seat" : "seats"} away (${pos * 36}&deg; turn)</div>
          </div>
        `;
      }
    }

    this.drawStage3Canvas();
  }

  drawStage3Canvas() {
    const canvas = document.getElementById("ropeDialCanvas");
    if (!canvas || typeof canvas.getContext !== "function") return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const tokens = this.app.tokens;
    const activePos = Math.min(this.ropeSelectedPos, Math.max(0, tokens.length - 1));

    if (this.ropeMode === "sinusoidal") {
      const padX = 36;
      const padY = 28;
      const plotW = w - padX * 2;
      const plotH = h - padY * 2;
      const pe = MathEngine.sinusoidalPE(Math.max(8, tokens.length), 6);
      const colors = ["#38BDF8", "#34D399", "#FBBF24"];

      ctx.strokeStyle = "#1E293B";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padX, padY + plotH / 2);
      ctx.lineTo(w - padX, padY + plotH / 2);
      ctx.stroke();

      for (let dim = 0; dim < 3; dim++) {
        ctx.beginPath();
        ctx.strokeStyle = colors[dim];
        ctx.lineWidth = 2;
        const steps = 60;
        for (let s = 0; s <= steps; s++) {
          const p = (s / steps) * Math.max(1, tokens.length - 1);
          const denom = Math.pow(10000, (2 * dim) / 6);
          const val = Math.sin(p / denom);
          const px = padX + (s / steps) * plotW;
          const py = padY + plotH / 2 - val * (plotH * 0.38);
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      const cursorX = padX + (activePos / Math.max(1, tokens.length - 1)) * plotW;
      ctx.strokeStyle = "#FFFFFF";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cursorX, padY);
      ctx.lineTo(cursorX, h - padY);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let dim = 0; dim < 3; dim++) {
        const val = pe[activePos] ? pe[activePos][dim * 2] : 0;
        const py = padY + plotH / 2 - val * (plotH * 0.38);
        ctx.beginPath();
        ctx.arc(cursorX, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = colors[dim];
        ctx.fill();
      }

      ctx.fillStyle = "#E2E8F0";
      ctx.font = "600 12px 'JetBrains Mono', monospace";
      ctx.fillText(`Seat #${activePos + 1}: "${tokens[activePos]?.text || ""}"`, Math.min(w - 165, Math.max(padX, cursorX - 35)), 18);
      return;
    }

    if (this.ropeMode === "none") {
      const cx = w / 2;
      const cy = h / 2;
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 88, 0, Math.PI * 2);
      ctx.stroke();

      tokens.forEach((t, i) => {
        const ox = cx + ((i % 3) - 1) * 18;
        const oy = cy + (Math.floor(i / 3) - 1) * 18;
        ctx.beginPath();
        ctx.arc(ox, oy, 7, 0, Math.PI * 2);
        ctx.fillStyle = i === activePos ? "#F87171" : "#64748B";
        ctx.fill();
        ctx.fillStyle = "#E2E8F0";
        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.fillText(`"${t.text}"`, ox + 10, oy + 4);
      });

      ctx.fillStyle = "#F87171";
      ctx.font = "600 12px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText("All seats jumbled together — word order is lost!", 18, 24);
      return;
    }

    const cx = w / 2;
    const cy = h / 2 + 6;
    const radius = Math.min(cx, cy) - 46;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
    ctx.strokeStyle = "#1E293B";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - radius);
    ctx.stroke();
    ctx.setLineDash([]);

    const stepRad = (36 * Math.PI) / 180;
    tokens.forEach((t, i) => {
      const angle = i * stepRad - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      const isSelected = i === activePos;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.strokeStyle = isSelected ? "#38BDF8" : "rgba(148, 163, 184, 0.35)";
      ctx.lineWidth = isSelected ? 3 : 1.25;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 7 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#34D399" : "#64748B";
      ctx.fill();

      const lx = cx + (radius + 16) * Math.cos(angle);
      const ly = cy + (radius + 16) * Math.sin(angle);
      ctx.fillStyle = isSelected ? "#FFFFFF" : "#94A3B8";
      ctx.font = isSelected ? "bold 12px 'JetBrains Mono', monospace" : "11px 'JetBrains Mono', monospace";
      ctx.textAlign = Math.cos(angle) > 0.2 ? "left" : Math.cos(angle) < -0.2 ? "right" : "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${i + 1}:${t.text}`, lx, ly);
    });
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  // ========================================================================
  // CHAPTER 4: Word Detective (Self-Attention Strings & Grid)
  // ========================================================================
  renderStage4(container) {
    const tokens = this.app.tokens;
    const hp = this.app.hyperparams;
    const selectedIdx = Math.min(this.selectedTokenIndex, Math.max(0, tokens.length - 1));
    const currentToken = tokens[selectedIdx] || tokens[0];

    const tokenVectors = tokens.map(t => this.math.getTokenEmbedding(t, hp.d_model));
    const attnResult = this.math.computeAttention({
      tokens,
      tokenVectors,
      d_model: hp.d_model,
      n_heads: hp.n_heads,
      causalMask: this.causalMaskEnabled
    });

    const headsData = attnResult.headsData || [];
    const activeHeadIndex = Math.min(this.selectedHeadIndex, Math.max(0, headsData.length - 1));
    const activeHeadData = headsData[activeHeadIndex] || headsData[0];
    const weightsMatrix = activeHeadData ? activeHeadData.attentionWeights : [];
    const rawWeights = weightsMatrix[selectedIdx] || [];
    this._lastAttnArgs = { selectedIdx, rawWeights };

    const visibleIndices = this.causalMaskEnabled
      ? tokens.slice(0, selectedIdx + 1)
      : tokens;

    const attendedTokens = visibleIndices.map((t, idx) => ({
      index: idx,
      token: t.text,
      weight: rawWeights[idx] || 0
    })).sort((a, b) => b.weight - a.weight);

    const topTwo = attendedTokens.slice(0, 2);
    const topTwoSummary = topTwo.length >= 2
      ? `<strong>"${this.esc(topTwo[0].token)}"</strong> (${Math.round(topTwo[0].weight * 100)}%) and <strong>"${this.esc(topTwo[1].token)}"</strong> (${Math.round(topTwo[1].weight * 100)}%)`
      : topTwo.length === 1
        ? `itself (<strong>"${this.esc(topTwo[0].token)}"</strong>, 100%)`
        : "earlier words";
    const futureHiddenCount = this.causalMaskEnabled ? Math.max(0, tokens.length - 1 - selectedIdx) : 0;

    container.innerHTML = `
      <div class="stage-card">
        <div class="stage-top-header">
          <div class="stage-kicker">Chapter 4 of 7 &middot; Word Detective (Self-Attention)</div>
          <h2 class="stage-title">Playing Word Detective to connect clues</h2>
          <div class="stage-summary-box">
            <strong>Imagine this:</strong> A word by itself can be tricky—what does "jumps" mean without knowing <em>who</em> is jumping? Here, every word acts like a detective looking back through earlier words and tying glowing strings to its biggest clues!
          </div>
          ${this.renderHandoff(
            "From Chapter 3",
            `${tokens.length} ordered word vectors`,
            "Ties glowing clue strings between related words",
            "Clue-Rich Word",
            `"${currentToken.text}" → ${topTwo[0] ? `"${topTwo[0].token}" (${Math.round(topTwo[0].weight * 100)}%)` : "blended"}`
          )}
        </div>

        <div class="stage-visual-container">
          ${this.renderTryThis("Click any word in the sentence below! Thicker teal strings mean stronger clues. Try toggling <strong>No Peeking Ahead</strong> to see how the AI stops words from cheating by reading the future.")}

          <div class="stage-toolbar-row">
            <div class="segmented-group" role="group" aria-label="Choose Detective">
              <button type="button" class="seg-btn ${this.selectedHeadIndex === 0 ? "is-active" : ""}" onclick="pipelineStages.setAttnHead(0)">Detective 1: Grammar &amp; Flow</button>
              <button type="button" class="seg-btn ${this.selectedHeadIndex === 1 ? "is-active" : ""}" onclick="pipelineStages.setAttnHead(1)">Detective 2: Who &amp; Action</button>
            </div>

            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
              <div class="segmented-group" role="group" aria-label="Clue View Mode">
                <button type="button" class="seg-btn ${this.attnViewMode === "arcs" ? "is-active" : ""}" onclick="pipelineStages.setAttnViewMode('arcs')">Clue Strings</button>
                <button type="button" class="seg-btn ${this.attnViewMode === "matrix" ? "is-active" : ""}" onclick="pipelineStages.setAttnViewMode('matrix')">Clue Grid</button>
              </div>
              <button type="button" class="btn btn-sm ${this.causalMaskEnabled ? "btn-teal" : ""}" onclick="pipelineStages.toggleCausalMask()">
                ${this.causalMaskEnabled ? "No Peeking Ahead: ON" : "No Peeking Ahead: OFF"}
              </button>
            </div>
          </div>

          <div class="live-insight-bar">
            <strong>Detective Report:</strong> Right now, <strong>"${this.esc(currentToken.text)}"</strong> is gathering its strongest clues from ${topTwoSummary}.
            ${futureHiddenCount > 0 ? `The ${futureHiddenCount} word${futureHiddenCount === 1 ? "" : "s"} after it are greyed out so it can't cheat by peeking ahead!` : "Because it can see every word up to here, it blends clues from the whole sentence."}
          </div>

          ${this.attnViewMode === "arcs" ? `
            <div class="attn-stage-area" id="attnStageArea">
              <div style="font-size:12px; color:var(--ink-muted);">Blue = detective word · Teal = biggest clue words it is grabbing:</div>
              <div class="sentence-ribbon" id="attnTokenRibbon">
                ${tokens.map((t, idx) => {
                  const w = rawWeights[idx] || 0;
                  const isFutureMasked = this.causalMaskEnabled && idx > selectedIdx;
                  const isConnected = !isFutureMasked && idx !== selectedIdx && w > 0.12;
                  return `
                    <button
                      type="button"
                      class="word-pill-attn ${idx === selectedIdx ? "active" : ""} ${isConnected ? "connected" : ""} ${isFutureMasked ? "is-masked" : ""}"
                      data-attn-idx="${idx}"
                      onclick="pipelineStages.selectToken(${idx})"
                    >"${this.esc(t.text)}"</button>
                  `;
                }).join("")}
              </div>
              <svg class="attention-bezier-svg" id="attentionBezierSVG" aria-hidden="true"></svg>
            </div>
          ` : `
            <div class="inset-panel attn-matrix-wrap">
              <div class="section-label" style="margin-bottom:8px;">Full Detective Clue Grid (Row = Asking word, Column = Clue word)</div>
              <table class="attn-matrix-table">
                <thead>
                  <tr>
                    <th>Asking &darr; / Clue &rarr;</th>
                    ${tokens.map((t, j) => `<th>${j + 1}:"${this.esc(t.text)}"</th>`).join("")}
                  </tr>
                </thead>
                <tbody>
                  ${tokens.map((rowTok, i) => `
                    <tr>
                      <th style="text-align:left; background:${i === selectedIdx ? "var(--accent-primary-soft)" : "transparent"};">${i + 1}:"${this.esc(rowTok.text)}"</th>
                      ${tokens.map((_, j) => {
                        const blocked = this.causalMaskEnabled && j > i;
                        const val = (weightsMatrix[i] && weightsMatrix[i][j]) || 0;
                        const pct = Math.round(val * 100);
                        const bgAlpha = Math.max(0.06, val * 0.85);
                        return blocked
                          ? `<td class="attn-matrix-cell is-blocked">Hidden</td>`
                          : `<td class="attn-matrix-cell tabular-nums" onclick="pipelineStages.selectToken(${i})" style="background:rgba(37, 99, 235, ${bgAlpha.toFixed(2)}); color:${val > 0.45 ? "#FFFFFF" : "var(--ink-primary)"};">${pct}%</td>`;
                      }).join("")}
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `}

          <div class="inset-panel">
            <div class="section-label" style="margin-bottom:12px;">
              How much attention <span class="mono">"${this.esc(currentToken.text)}"</span> pays to each word (always adds up to 100%)
            </div>
            ${attendedTokens.map(item => `
              <div class="attn-item-row">
                <span class="mono" style="font-size:13px; font-weight:600; color:${item.index === selectedIdx ? "var(--accent-primary)" : "var(--ink-primary)"};">"${this.esc(item.token)}"</span>
                <div class="attn-progress-bar">
                  <div class="attn-progress-fill" style="width:${Math.round(item.weight * 100)}%; background:${item.index === selectedIdx ? "var(--accent-primary)" : "var(--teal)"};"></div>
                </div>
                <span class="mono tabular-nums" style="text-align:right; font-size:12px; font-weight:600;">${Math.round(item.weight * 100)}%</span>
              </div>
            `).join("")}
          </div>
        </div>

        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>Want the Nerdy AI Math? (Query, Key, Value &amp; Causal Mask)</span>
            <span class="mono">+</span>
          </summary>
          <div class="deep-dive-content">
            <p>Each word makes three mini-vectors: a <strong>Query</strong> ("what clue am I hunting for?"), a <strong>Key</strong> ("what clue am I holding?"), and a <strong>Value</strong> ("here is the info I'll share if we match!").</p>
            <pre class="formula-block">Attention(Q, K, V) = softmax((Q &middot; K^T) / &radic;d_k + Mask) &middot; V
Head width d_k     = d_model / n_heads = ${hp.d_model} / ${hp.n_heads} = ${Math.floor(hp.d_model / hp.n_heads)}
No-Peeking Mask    = 0 for past words, -&infin; for future words</pre>
          </div>
        </details>
      </div>
    `;

    if (this.attnViewMode === "arcs") {
      requestAnimationFrame(() => this.alignAttentionArcs(selectedIdx, rawWeights));
    }
  }

  realignStage4Arcs() {
    if (this.attnViewMode === "arcs" && this._lastAttnArgs) {
      this.alignAttentionArcs(this._lastAttnArgs.selectedIdx, this._lastAttnArgs.rawWeights);
    }
  }

  alignAttentionArcs(selectedIdx, rawWeights) {
    const svg = document.getElementById("attentionBezierSVG");
    const ribbon = document.getElementById("attnTokenRibbon");
    if (!svg || !ribbon) return;

    const buttons = Array.from(ribbon.querySelectorAll("[data-attn-idx]"));
    const srcBtn = buttons[selectedIdx];
    if (!srcBtn) return;

    const svgRect = svg.getBoundingClientRect();
    const width = Math.max(300, svgRect.width || 600);
    const height = 92;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const srcRect = srcBtn.getBoundingClientRect();
    const x1 = srcRect.left - svgRect.left + srcRect.width / 2;

    const paths = [];
    buttons.forEach((btn, j) => {
      if (this.causalMaskEnabled && j > selectedIdx) return;
      const weight = rawWeights[j] || 0;
      if (weight < 0.01) return;
      const dstRect = btn.getBoundingClientRect();
      const x2 = dstRect.left - svgRect.left + dstRect.width / 2;
      const dist = Math.abs(x1 - x2);
      const curveDepth = Math.min(height - 10, Math.max(28, dist * 0.34 + 24));
      const strokeColor = j === selectedIdx ? "#2563EB" : "#0D9488";
      const strokeWidth = Math.max(2, weight * 11);
      const opacity = Math.max(0.35, Math.min(0.95, weight * 2.2));

      if (j === selectedIdx) {
        paths.push(`<path d="M ${x1 - 8} 4 C ${x1 - 14} 38, ${x1 + 14} 38, ${x1 + 8} 4" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth.toFixed(1)}" opacity="${opacity.toFixed(2)}" stroke-linecap="round"/>`);
      } else {
        paths.push(`<path d="M ${x1} 4 Q ${(x1 + x2) / 2} ${curveDepth} ${x2} 4" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth.toFixed(1)}" opacity="${opacity.toFixed(2)}" stroke-linecap="round"/>`);
      }
      paths.push(`<circle cx="${x2}" cy="5" r="3.2" fill="${strokeColor}" opacity="${opacity.toFixed(2)}"/>`);
    });

    svg.innerHTML = paths.join("");
  }

  setAttnHead(idx) {
    this.selectedHeadIndex = idx;
    this.app.renderStageById(4);
  }

  setAttnViewMode(mode) {
    this.attnViewMode = mode;
    this.app.renderStageById(4);
  }

  toggleCausalMask() {
    this.causalMaskEnabled = !this.causalMaskEnabled;
    this.app.renderStageById(4);
  }

  // ========================================================================
  // CHAPTER 5: 3 Quick Brain Chores (Norm, Photocopy Shortcut & Fact Cabinet)
  // ========================================================================
  renderStage5(container) {
    const activeTab = this.stage5Tab || "norm";
    const tokens = this.app.tokens;
    const activeTok = tokens[Math.min(this.selectedTokenIndex, Math.max(0, tokens.length - 1))] || tokens[0];

    container.innerHTML = `
      <div class="stage-card">
        <div class="stage-top-header">
          <div class="stage-kicker">Chapter 5 of 7 &middot; Inside One Thinking Floor</div>
          <h2 class="stage-title">3 quick brain chores that keep thinking sharp</h2>
          <div class="stage-summary-box">
            <strong>Imagine this:</strong> Right after playing Word Detective, each thinking floor does three super-fast chores before passing the word upstairs: <strong>(1)</strong> calm down any wild numbers, <strong>(2)</strong> keep a photocopy of the original word so nothing gets erased, and <strong>(3)</strong> check its giant fact cabinet.
          </div>
          ${this.renderHandoff(
            "From Chapter 4",
            `Clue-blended "${activeTok.text}"`,
            "Calm → Photocopy → Fact Check",
            "Smarter Word",
            "Ready to go upstairs"
          )}
        </div>

        <div class="stage-visual-container">
          ${this.renderTryThis("Click each of the <strong>3 brain chores below</strong> to test what happens if numbers get too huge, if the photocopy shortcut breaks, or when fact neurons light up!")}

          <!-- Interactive 3-Chore Tabs -->
          <div class="block-stepper" role="tablist" aria-label="Three brain chores">
            <button type="button" role="tab" aria-selected="${activeTab === "norm"}" class="block-step-btn ${activeTab === "norm" ? "is-active" : ""}" onclick="pipelineStages.setStage5Tab('norm')">
              <span class="block-step-kicker">Chore 1 &middot; Volume Knob</span>
              <span class="block-step-title">1. Calm Wild Numbers</span>
              <span class="block-step-desc">Turns down giant spikes so math never explodes</span>
            </button>
            <button type="button" role="tab" aria-selected="${activeTab === "skip"}" class="block-step-btn ${activeTab === "skip" ? "is-active" : ""}" onclick="pipelineStages.setStage5Tab('skip')">
              <span class="block-step-kicker">Chore 2 &middot; Backup Lane</span>
              <span class="block-step-title">2. Keep a Photocopy</span>
              <span class="block-step-desc">Adds sticky notes instead of erasing the page</span>
            </button>
            <button type="button" role="tab" aria-selected="${activeTab === "ffn"}" class="block-step-btn ${activeTab === "ffn" ? "is-active" : ""}" onclick="pipelineStages.setStage5Tab('ffn')">
              <span class="block-step-kicker">Chore 3 &middot; Fact Cabinet</span>
              <span class="block-step-title">3. Check Fact Cabinet</span>
              <span class="block-step-desc">Lights up memory neurons to recall world facts</span>
            </button>
          </div>

          ${activeTab === "norm" ? `
            <div class="inset-panel">
              <div class="stage-toolbar-row" style="margin-bottom:12px;">
                <div>
                  <div class="section-label">Wild Spike Tamer: Drag the slider to blast a giant number into Bar #2</div>
                  <div style="font-size:12px; color:var(--ink-muted);">Watch the right-hand chart stay calm and balanced even when the left bar goes crazy!</div>
                </div>
                <div class="segmented-group" role="group" aria-label="Volume knob style">
                  <button type="button" class="seg-btn ${this.normType === "rmsnorm" ? "is-active" : ""}" onclick="pipelineStages.setNormType('rmsnorm')">RMSNorm (Fast)</button>
                  <button type="button" class="seg-btn ${this.normType === "layernorm" ? "is-active" : ""}" onclick="pipelineStages.setNormType('layernorm')">LayerNorm</button>
                </div>
              </div>

              <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px; flex-wrap:wrap;">
                <label for="normSpikeSlider" style="font-size:13px; font-weight:600; white-space:nowrap;">Blast Spike (d2):</label>
                <input id="normSpikeSlider" type="range" min="-5.0" max="5.0" step="0.5" value="${this.normSpikeValue}" oninput="pipelineStages.setNormSpike(this.value)" style="flex:1; min-width:160px;">
                <span id="normSpikeReadout" class="mono tabular-nums" style="font-size:13px; font-weight:600; min-width:56px; text-align:right;">+${this.normSpikeValue.toFixed(1)}</span>
                <span id="normRmsReadout" class="mono tabular-nums" style="font-size:12px; color:var(--teal); font-weight:600;"></span>
              </div>

              <div class="norm-compare-grid">
                <div class="bar-chart-card">
                  <div style="font-size:12px; font-weight:600; color:var(--rose); margin-bottom:8px;">Before Calming (Wild Spike!)</div>
                  <div id="normBeforeChart" class="vector-dna-list"></div>
                </div>
                <div class="bar-chart-card">
                  <div style="font-size:12px; font-weight:600; color:var(--teal); margin-bottom:8px;">After ${this.normType === "rmsnorm" ? "RMSNorm" : "LayerNorm"} (Nice &amp; Balanced)</div>
                  <div id="normAfterChart" class="vector-dna-list"></div>
                </div>
              </div>
            </div>
          ` : activeTab === "skip" ? `
            <div class="inset-panel" style="display:flex; flex-direction:column; gap:14px;">
              <div class="skip-diagram-row">
                <div>
                  <div class="section-label">Photocopy Shortcut: <span class="mono">New Thought = Original Word + Fresh Clues</span></div>
                  <div style="font-size:13px; color:var(--ink-secondary); margin-top:4px;">Just like adding sticky notes to your homework instead of erasing the whole page!</div>
                </div>
                <button type="button" class="btn btn-sm ${this.skipConnectionEnabled ? "btn-teal" : ""}" onclick="pipelineStages.toggleSkip()">
                  ${this.skipConnectionEnabled ? "Photocopy Lane: ON (Safe)" : "Photocopy Lane: OFF (Memory Fades!)"}
                </button>
              </div>
              <div class="live-insight-bar" id="skipStatusText"></div>
              <div class="inspector-grid">
                <div class="stat-cell">
                  <div class="stat-cell-label">Original Word Memory</div>
                  <div class="stat-cell-value tabular-nums" style="color:${this.skipConnectionEnabled ? "var(--teal)" : "var(--rose)"};">${this.skipConnectionEnabled ? "100% Safe" : "Fading Away!"}</div>
                </div>
                <div class="stat-cell">
                  <div class="stat-cell-label">Spotlight Word</div>
                  <div class="stat-cell-value">"${this.esc(activeTok.text)}"</div>
                </div>
                <div class="stat-cell">
                  <div class="stat-cell-label">Superpower Unlocked</div>
                  <div class="stat-cell-value" style="font-size:12.5px; font-family:var(--font-body); font-weight:500;">Lets AI stack 32–80+ floors</div>
                </div>
              </div>
            </div>
          ` : `
            <div class="inset-panel">
              <div class="stage-toolbar-row" style="margin-bottom:12px;">
                <div>
                  <div class="section-label">Giant Fact Cabinet (Feed-Forward Memory)</div>
                  <div id="ffnSummaryText" style="font-size:12.5px; color:var(--ink-secondary); margin-top:2px;"></div>
                </div>
                <div class="segmented-group" role="group" aria-label="Fact cabinet design">
                  <button type="button" class="seg-btn ${this.ffnArch === "swiglu" ? "is-active" : ""}" onclick="pipelineStages.setFFNArch('swiglu')">SwiGLU (Smart Gate)</button>
                  <button type="button" class="seg-btn ${this.ffnArch === "gelu" ? "is-active" : ""}" onclick="pipelineStages.setFFNArch('gelu')">Classic GELU</button>
                </div>
              </div>
              <div style="font-size:12px; color:var(--ink-muted); margin-bottom:8px;">Tall teal bars are the exact memory lightbulbs switching ON when the AI sees <strong>"${this.esc(activeTok.text)}"</strong>:</div>
              <div id="ffnNeuronsChart" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(42px, 1fr)); gap:6px; align-items:end; height:88px; padding-top:8px;"></div>
            </div>
          `}
        </div>

        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>Want the Nerdy AI Math? (RMSNorm, Residuals &amp; SwiGLU FFN)</span>
            <span class="mono">+</span>
          </summary>
          <div class="deep-dive-content">
            <p>RMSNorm keeps every vector's average energy near 1.0, Residual Skip Connections add x back in so gradients flow cleanly through dozens of layers, and SwiGLU acts like a gated lookup table storing factual knowledge.</p>
            <pre class="formula-block">RMSNorm(x) = (x / &radic;(mean(x&sup2;) + &epsilon;)) &times; &gamma;
Residual:    h = x + Sublayer(RMSNorm(x))
SwiGLU(x)  = (silu(x &middot; W_gate) &odot; (x &middot; W_up)) &middot; W_down</pre>
          </div>
        </details>
      </div>
    `;

    this.updateStage5Visuals();
  }

  setStage5Tab(tab) {
    this.stage5Tab = tab;
    this.app.renderStageById(5);
  }

  setNormSpike(val) {
    this.normSpikeValue = parseFloat(val) || 0;
    this.updateStage5Visuals();
  }

  setNormType(type) {
    this.normType = type;
    this.app.renderStageById(5);
  }

  toggleSkip() {
    this.skipConnectionEnabled = !this.skipConnectionEnabled;
    this.app.renderStageById(5);
  }

  setFFNArch(arch) {
    this.ffnArch = arch;
    this.app.renderStageById(5);
  }

  updateStage5Visuals() {
    const hp = this.app.hyperparams;
    const tokens = this.app.tokens;
    const selectedIdx = Math.min(this.selectedTokenIndex, Math.max(0, tokens.length - 1));
    const tok = tokens[selectedIdx] || tokens[0];
    const rawVector = this.math.getTokenEmbedding(tok, hp.d_model);
    const spikedVector = rawVector.map((v, i) => (i === 2 ? v + this.normSpikeValue : v));

    const normResult = this.normType === "rmsnorm"
      ? MathEngine.rmsNorm(spikedVector)
      : MathEngine.layerNorm(spikedVector);
    const beforeNormStats = MathEngine.rmsNorm(spikedVector);
    const afterNormCheck = MathEngine.rmsNorm(normResult.output);

    const spikeReadout = document.getElementById("normSpikeReadout");
    if (spikeReadout) {
      spikeReadout.textContent = `${this.normSpikeValue >= 0 ? "+" : ""}${this.normSpikeValue.toFixed(1)}`;
    }
    const rmsReadout = document.getElementById("normRmsReadout");
    if (rmsReadout) {
      rmsReadout.textContent = `Volume before: ${beforeNormStats.rms.toFixed(2)} → after: ${afterNormCheck.rms.toFixed(2)}`;
    }

    const renderBars = (elId, vec, maxScale, highlightColor) => {
      const el = document.getElementById(elId);
      if (!el) return;
      el.innerHTML = vec.map((val, i) => {
        const pct = Math.min(48, (Math.abs(val) / maxScale) * 48);
        const left = val >= 0 ? 50 : 50 - pct;
        const color = i === 2 && Math.abs(this.normSpikeValue) >= 1.5 ? highlightColor : "var(--accent-primary)";
        return `
          <div class="dna-row">
            <span style="color:var(--ink-muted);">d${i}</span>
            <div class="dna-track">
              <div class="dna-zero"></div>
              <div class="dna-bar" style="left:${left.toFixed(1)}%; width:${pct.toFixed(1)}%; background:${color};"></div>
            </div>
            <span class="tabular-nums" style="text-align:right;">${val >= 0 ? "+" : ""}${val.toFixed(2)}</span>
          </div>
        `;
      }).join("");
    };

    const sharedScale = Math.max(2.0, ...spikedVector.map(Math.abs), ...normResult.output.map(Math.abs));
    renderBars("normBeforeChart", spikedVector, sharedScale, "var(--rose)");
    renderBars("normAfterChart", normResult.output, sharedScale, "var(--teal)");

    const skipEl = document.getElementById("skipStatusText");
    if (skipEl) {
      skipEl.textContent = this.skipConnectionEnabled
        ? "Photocopy shortcut is ON: the original word rides straight through while new clues are added on top!"
        : "Photocopy shortcut is OFF: after passing through lots of floors, the AI starts forgetting what the original word even was.";
    }

    const ffnInput = this.skipConnectionEnabled
      ? MathEngine.vectorAdd(rawVector, normResult.output)
      : normResult.output;
    const ffnResult = this.math.computeFFN({
      inputVector: ffnInput,
      d_model: hp.d_model,
      architecture: this.ffnArch
    });

    const ffnSummary = document.getElementById("ffnSummaryText");
    if (ffnSummary) {
      ffnSummary.textContent = `Opens "${tok.text}" from ${hp.d_model} numbers into ${ffnResult.d_ff} fact lightbulbs (${ffnResult.architecture}), grabs useful memories, and packs it back to ${hp.d_model}.`;
    }

    const neurons = (ffnResult.hidden || ffnResult.hiddenActivated || []).slice(0, 14);
    const maxN = Math.max(0.25, ...neurons.map(Math.abs));
    const neuronsEl = document.getElementById("ffnNeuronsChart");
    if (neuronsEl) {
      neuronsEl.innerHTML = neurons.map((n, i) => {
        const hPct = Math.max(12, Math.round((Math.abs(n) / maxN) * 100));
        const active = Math.abs(n) > maxN * 0.45;
        return `
          <div style="display:flex; flex-direction:column; align-items:center; gap:3px; height:100%; justify-content:flex-end;">
            <div style="width:100%; height:${hPct}%; background:${active ? "var(--teal)" : "var(--border-strong)"}; border-radius:4px 4px 2px 2px;" title="Memory Bulb ${i}: ${n.toFixed(3)}"></div>
            <span class="mono" style="font-size:10px; color:var(--ink-muted);">m${i}</span>
          </div>
        `;
      }).join("");
    }
  }

  // ========================================================================
  // CHAPTER 6: 12-Floor Thinking Elevator (Deep Layers & Word Scores)
  // ========================================================================
  renderStage6(container) {
    container.innerHTML = `
      <div class="stage-card">
        <div class="stage-top-header">
          <div class="stage-kicker">Chapter 6 of 7 &middot; 12-Floor Thinking Elevator (Deep Layers)</div>
          <h2 class="stage-title">Riding a 12-floor thinking elevator to score every word</h2>
          <div class="stage-summary-box">
            <strong>Imagine this:</strong> One quick thought isn't enough to understand a whole story! So the AI sends your sentence up a 12-floor elevator, running Word Detective + 3 Brain Chores on <em>every single floor</em>. Ground floors check simple spelling and grammar; top floors understand the whole idea and give every word in the dictionary a score!
          </div>
          ${this.renderHandoff(
            "From Chapter 5",
            "1 floor of thinking",
            "Rides up 12 floors to sharpen the idea",
            "Dictionary Scores",
            "Top next-word guesses ranked"
          )}
        </div>

        <div class="stage-visual-container">
          ${this.renderTryThis("Click <strong>Floor 1 (First Guess)</strong> and then <strong>Floor 12 (Top Floor)</strong> to watch the AI's favorite next word jump clearly to the top of the scoreboard!")}

          <div class="inset-panel">
            <div class="stage-toolbar-row" style="margin-bottom:10px;">
              <label for="layerDepthSlider" class="section-label">Elevator Floor: <span id="layerReadout" class="mono tabular-nums" style="color:var(--accent-primary);">Floor ${this.selectedLayer} of 12</span></label>
              <div class="presets-list">
                <button type="button" class="preset-btn" onclick="pipelineStages.setSelectedLayer(1)">Floor 1 (First Guess)</button>
                <button type="button" class="preset-btn" onclick="pipelineStages.setSelectedLayer(6)">Floor 6 (Halfway Up)</button>
                <button type="button" class="preset-btn" onclick="pipelineStages.setSelectedLayer(12)">Floor 12 (Top Floor)</button>
              </div>
            </div>

            <input id="layerDepthSlider" type="range" min="1" max="12" step="1" value="${this.selectedLayer}" oninput="pipelineStages.setSelectedLayer(this.value)">

            <div class="layer-tower" id="layerTowerButtons" role="group" aria-label="Choose elevator floor">
              ${Array.from({ length: 12 }, (_, idx) => {
                const l = idx + 1;
                return `<button type="button" class="layer-pill-btn ${l === this.selectedLayer ? "is-active" : l < this.selectedLayer ? "is-passed" : ""}" data-layer="${l}" onclick="pipelineStages.setSelectedLayer(${l})">F${l}</button>`;
              }).join("")}
            </div>
          </div>

          <div class="live-insight-bar" id="layerRoleReadout"></div>

          <div class="inset-panel">
            <div class="stage-toolbar-row" style="margin-bottom:10px;">
              <span class="section-label">Top 8 Dictionary Word Scores on This Floor</span>
              <span style="font-size:12px; color:var(--ink-muted);">Higher score = AI likes this next word more</span>
            </div>
            <table class="logits-preview-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Next Word Guess</th>
                  <th>Neighborhood</th>
                  <th>How Confident</th>
                  <th style="text-align:right;">Raw Score</th>
                </tr>
              </thead>
              <tbody id="logitsLeaderboardBody"></tbody>
            </table>
          </div>
        </div>

        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>Want the Nerdy AI Math? (Stacked Layers &amp; Unembedding Logits)</span>
            <span class="mono">+</span>
          </summary>
          <div class="deep-dive-content">
            <p>Each floor repeats the Transformer block. At the top floor L, the final hidden vector is multiplied by the Unembedding Matrix W<sub>U</sub> to compute one raw score (called a <strong>logit</strong>) for every word in the entire dictionary.</p>
            <pre class="formula-block">h^(l) = Floor_l(h^(l-1))
logits z = RMSNorm(h^(L)) &middot; W_U   (1 score for every word in |V|)</pre>
          </div>
        </details>
      </div>
    `;

    this.updateStage6Visuals();
  }

  setSelectedLayer(l) {
    this.selectedLayer = parseInt(l, 10) || 1;
    const slider = document.getElementById("layerDepthSlider");
    if (slider) slider.value = String(this.selectedLayer);
    this.updateStage6Visuals();
  }

  updateStage6Visuals() {
    const hp = this.app.hyperparams;
    const tokens = this.app.tokens;
    const layer = this.selectedLayer;

    const readout = document.getElementById("layerReadout");
    if (readout) readout.textContent = `Floor ${layer} of 12`;

    const tower = document.getElementById("layerTowerButtons");
    if (tower) {
      Array.from(tower.querySelectorAll("[data-layer]")).forEach(btn => {
        const l = parseInt(btn.getAttribute("data-layer"), 10);
        btn.classList.toggle("is-active", l === layer);
        btn.classList.toggle("is-passed", l < layer);
      });
    }

    const sortedLogits = this.math.computeLayerSortedLogits(tokens, layer, VOCABULARY_LIST, hp.d_model).slice(0, 8);
    const topWord = sortedLogits[0];
    const roleReadout = document.getElementById("layerRoleReadout");
    if (roleReadout) {
      const stageDesc = layer <= 3
        ? "<strong>Ground Floors (1–3):</strong> Just getting started—checking basic grammar, so lots of guesses are still tied together."
        : layer <= 8
          ? "<strong>Middle Floors (4–8):</strong> Putting the story clues together so words that fit the topic climb higher!"
          : "<strong>Top Floors (9–12):</strong> Crystal clear! The AI separates its favorite next words way ahead of bad guesses.";
      roleReadout.innerHTML = `${stageDesc}${topWord ? ` #1 favorite right now: <strong>"${this.esc(topWord.token)}"</strong> (score ${topWord.rawLogit.toFixed(2)}).` : ""}`;
    }

    const maxLogit = Math.max(1, ...sortedLogits.map(c => c.rawLogit));
    const minLogit = Math.min(0, ...sortedLogits.map(c => c.rawLogit));
    const span = Math.max(0.5, maxLogit - minLogit);

    const tbody = document.getElementById("logitsLeaderboardBody");
    if (tbody) {
      tbody.innerHTML = sortedLogits.map((c, idx) => {
        const barPct = Math.max(8, Math.round(((c.rawLogit - minLogit) / span) * 100));
        return `
          <tr>
            <td class="mono tabular-nums" style="color:var(--ink-muted);">#${idx + 1}</td>
            <td class="mono" style="font-weight:600; color:var(--ink-primary);">"${this.esc(c.token)}"</td>
            <td style="font-size:12px; color:var(--ink-secondary);">${this.esc(c.cluster)}</td>
            <td style="width:32%;">
              <div class="attn-progress-bar">
                <div class="attn-progress-fill" style="width:${barPct}%; background:${idx === 0 ? "var(--teal)" : "var(--accent-primary)"};"></div>
              </div>
            </td>
            <td class="mono tabular-nums" style="text-align:right; font-weight:600;">${c.rawLogit.toFixed(2)}</td>
          </tr>
        `;
      }).join("");
    }
  }

  // ========================================================================
  // CHAPTER 7: Spin the Word Wheel (Temperature, Top-K & Top-P)
  // ========================================================================
  renderStage7(container) {
    const hp = this.app.hyperparams;
    const lastMeta = this.app.lastSampledMeta;

    container.innerHTML = `
      <div class="stage-card">
        <div class="stage-top-header">
          <div class="stage-kicker">Chapter 7 of 7 &middot; Pick the Next Word (Sampling)</div>
          <h2 class="stage-title">Spinning the weighted prize wheel to pick the next word!</h2>
          <div class="stage-summary-box">
            <strong>Imagine this:</strong> At the top floor, the AI turns those word scores into slice sizes on a prize wheel that adds up to 100%. Turn the <strong>Wildness (Temperature)</strong> dial low for safe guesses or high for silly surprises, cross out weak choices, and spin! Then the new word joins your sentence and the entire 7-chapter journey starts all over again!
          </div>
          ${this.renderHandoff(
            "From Chapter 6",
            "Top-floor word scores",
            "Turns scores into % slices & spins the wheel",
            "Next Word!",
            "Added to your sentence"
          )}
        </div>

        <div class="stage-visual-container">
          ${this.renderTryThis("Try clicking <strong>Play It Safe</strong> vs <strong>Super Silly</strong> to watch the bars grow and shrink, then click <strong>Roll &amp; Add Next Word</strong> (or click any word bar yourself) to keep writing your story!")}

          <!-- Live Fill-in-the-blank Sentence Preview -->
          <div class="sentence-preview-box" id="stage7SentencePreview"></div>

          ${lastMeta ? `
            <div class="live-insight-bar" id="stage7LastPickedBanner">
              <strong>Boom! Added "${this.esc(lastMeta.word)}" to your sentence!</strong>
              ${lastMeta.manual
                ? "You picked that word yourself! Scroll up anytime—every single chapter above already updated with your new word."
                : `The prize wheel landed on it from ${lastMeta.survivors} choices (${lastMeta.probPct}% slice at Wildness ${lastMeta.temperature.toFixed(2)}). Every chapter above just updated!`}
            </div>
          ` : ""}

          <div class="inset-panel">
            <div class="stage-toolbar-row" style="margin-bottom:14px;">
              <span class="section-label">Prize Wheel Dials (How adventurous should the AI be?)</span>
              <div class="presets-list">
                <button type="button" class="preset-btn" onclick="pipelineStages.applySamplingPreset(0.15, 3, 0.7)">Play It Safe</button>
                <button type="button" class="preset-btn" onclick="pipelineStages.applySamplingPreset(0.8, 10, 0.9)">Just Right</button>
                <button type="button" class="preset-btn" onclick="pipelineStages.applySamplingPreset(1.35, 18, 0.98)">Super Silly</button>
              </div>
            </div>

            <div class="sampling-sliders-grid">
              <div class="slider-block">
                <div class="slider-head">
                  <label for="tempSlider">Wildness (Temperature)</label>
                  <span id="tempReadout" class="mono tabular-nums">${hp.temperature.toFixed(2)}</span>
                </div>
                <input id="tempSlider" type="range" min="0.00" max="1.50" step="0.05" value="${hp.temperature}" oninput="pipelineStages.updateSamplingSlider('temperature', this.value)">
                <div id="tempHint" class="slider-hint"></div>
              </div>

              <div class="slider-block">
                <div class="slider-head">
                  <label for="topKSlider">Top-K Shortlist</label>
                  <span id="topKReadout" class="mono tabular-nums">${hp.top_k} words</span>
                </div>
                <input id="topKSlider" type="range" min="1" max="20" step="1" value="${hp.top_k}" oninput="pipelineStages.updateSamplingSlider('top_k', this.value)">
                <div class="slider-hint">Only lets the top K favorite words onto the wheel</div>
              </div>

              <div class="slider-block">
                <div class="slider-head">
                  <label for="topPSlider">Top-P Cutoff</label>
                  <span id="topPReadout" class="mono tabular-nums">${Math.round(hp.top_p * 100)}%</span>
                </div>
                <input id="topPSlider" type="range" min="0.10" max="1.00" step="0.05" value="${hp.top_p}" oninput="pipelineStages.updateSamplingSlider('top_p', this.value)">
                <div class="slider-hint">Crosses out tiny leftover slices past this %</div>
              </div>
            </div>
          </div>

          <div class="inset-panel">
            <div class="stage-toolbar-row" style="margin-bottom:10px;">
              <span class="section-label">Words on the Prize Wheel (click any active word to add it!)</span>
              <span id="activeSurvivorCount" class="mono tabular-nums" style="font-size:12px; color:var(--teal); font-weight:600;"></span>
            </div>
            <div id="candBarsContainer" class="cand-bars-container"></div>
          </div>

          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <button type="button" id="rollSampleBtn" class="btn btn-primary" onclick="app.sampleAndAppendToken()">
              Roll &amp; Add Next Word
            </button>
            <button type="button" class="btn btn-secondary" onclick="app.toggleAutoPlay()">
              ${this.app.isAutoPlaying ? "Pause Auto-Write" : "Auto-Write Story"}
            </button>
            <button type="button" class="btn btn-ghost" onclick="app.resetPrompt()">
              Reset Sentence
            </button>
            <a href="#top" class="btn btn-ghost" style="margin-left:auto; text-decoration:none;">
              Back to Top &uarr;
            </a>
          </div>
        </div>

        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>Want the Nerdy AI Math? (Softmax Temperature, Top-K &amp; Top-P)</span>
            <span class="mono">+</span>
          </summary>
          <div class="deep-dive-content">
            <p>Raw scores z<sub>i</sub> are divided by Temperature T before Softmax converts them into wheel percentages. Low T gives almost the whole wheel to the #1 word; high T gives surprise words bigger slices!</p>
            <pre class="formula-block">P(w_i) = exp(z_i / T) / &sum;_j exp(z_j / T)
Top-K: Keep only the top K words, set the rest to 0%
Top-P: Keep the smallest top group totaling &ge; P, then rescale to 100%</pre>
          </div>
        </details>
      </div>
    `;

    this.updateStage7Visuals();
  }

  applySamplingPreset(temp, topK, topP) {
    this.app.hyperparams.temperature = temp;
    this.app.hyperparams.top_k = topK;
    this.app.hyperparams.top_p = topP;
    this.app.renderStageById(7);
  }

  updateSamplingSlider(key, val) {
    this.app.updateHyperparam(key, val, true);
    this.updateStage7Visuals();
  }

  updateStage7Visuals() {
    const hp = this.app.hyperparams;
    const tokens = this.app.tokens;

    const tempReadout = document.getElementById("tempReadout");
    if (tempReadout) tempReadout.textContent = hp.temperature.toFixed(2);
    const tempHint = document.getElementById("tempHint");
    if (tempHint) {
      tempHint.textContent = hp.temperature <= 0.05
        ? "Robot mode: always picks #1"
        : hp.temperature < 0.45
          ? "Safe & predictable"
          : hp.temperature > 1.0
            ? "Silly & full of surprises!"
            : "Fun & balanced";
    }
    const topKReadout = document.getElementById("topKReadout");
    if (topKReadout) topKReadout.textContent = `${hp.top_k} ${hp.top_k === 1 ? "word" : "words"}`;
    const topPReadout = document.getElementById("topPReadout");
    if (topPReadout) topPReadout.textContent = `${Math.round(hp.top_p * 100)}%`;

    const candidateLogits = this.math.computeLayerSortedLogits(
      tokens,
      this.selectedLayer || 12,
      VOCABULARY_LIST,
      hp.d_model
    );
    const sampleResult = this.math.sampleNextToken({
      candidateLogits,
      promptTokens: tokens,
      temperature: hp.temperature,
      topK: hp.top_k,
      topP: hp.top_p,
      repetitionPenalty: hp.repetition_penalty
    });
    this.currentSampleResult = sampleResult;

    const survivorEl = document.getElementById("activeSurvivorCount");
    if (survivorEl) {
      survivorEl.textContent = `${sampleResult.activeCount} words on the wheel`;
    }

    const candidates = (sampleResult.candidates || []).slice(0, 10);
    const topActive = candidates.find(c => c.status === "active") || candidates[0];
    const previewEl = document.getElementById("stage7SentencePreview");
    if (previewEl) {
      const topPct = topActive ? Math.round((topActive.normalizedProb || topActive.rawProb) * 100) : 0;
      previewEl.innerHTML = `
        <span style="font-size:12px; color:var(--ink-muted); display:block; margin-bottom:4px;">Your sentence so far + the AI's favorite next word:</span>
        <span>${this.esc(this.app.currentPrompt)}</span>
        <span class="sentence-preview-blank">${topActive ? `"${this.esc(topActive.token)}" (${topPct}%)` : "___"}</span>
      `;
    }

    const container = document.getElementById("candBarsContainer");
    if (container) {
      container.innerHTML = candidates.map(c => {
        const isCut = c.status !== "active";
        const displayPct = isCut ? Math.round(c.rawProb * 100) : Math.round((c.normalizedProb || c.rawProb) * 100);
        const isWinner = !isCut && this.app.lastSampledWord && this.app.lastSampledWord === c.token;
        const encodedWord = encodeURIComponent(c.token);
        return `
          <button
            type="button"
            class="cand-bar-row ${isCut ? "cut" : ""} ${isWinner ? "is-winner" : ""}"
            ${isCut ? "disabled" : `onclick="app.appendCustomWord(decodeURIComponent('${encodedWord}'))"`}
          >
            <span class="cand-word-label">"${this.esc(c.token)}"</span>
            <span class="cand-bar-fill-track">
              <span class="cand-bar-fill" style="display:block; width:${Math.max(2, displayPct)}%; opacity:${isCut ? 0.35 : 1};"></span>
            </span>
            <span class="cand-prob-label tabular-nums">${isCut ? "0%" : `${displayPct}%`}</span>
            ${isCut ? `<span class="cand-cut-reason">${this.esc(c.strikeReason)}</span>` : `<span style="font-size:11px; color:var(--teal); font-weight:600;">On Wheel</span>`}
          </button>
        `;
      }).join("");
    }
  }
}

if (typeof window !== "undefined") {
  window.PipelineStages = PipelineStages;
}

if (typeof global !== "undefined") {
  global.PipelineStages = PipelineStages;
}
