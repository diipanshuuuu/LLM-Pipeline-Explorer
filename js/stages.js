/**
 * Pipeline Stage Renderers — Visual-First Interactive Story Edition
 * Leads every chapter with bespoke, hands-on visual toys and diagrams,
 * keeping text concise and easy to understand while preserving real Transformer math.
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
    this._bpePlayTimer = null;

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
    this.orderSwapped = false;
    this._clockPlayTimer = null;

    // Stage 4 state
    this.selectedHeadIndex = 0;
    this.causalMaskEnabled = true;
    this.attnViewMode = "arcs"; // "arcs" | "matrix"
    this._lastAttnArgs = null;
    this._attnTourTimer = null;

    // Stage 5 state
    this.stage5Tab = "norm"; // "norm" | "skip" | "ffn"
    this.normSpikeValue = 3.0;
    this.spikeBarIndex = 2;
    this.skipConnectionEnabled = true;
    this.ffnArch = "swiglu"; // "swiglu" | "gelu"
    this.normType = "rmsnorm"; // "rmsnorm" | "layernorm"
    this.selectedBulbIndex = -1;

    // Stage 6 state
    this.selectedLayer = 12;
    this._elevatorTimer = null;

    // Stage 7 state
    this.currentSampleResult = null;
    this.wheelRotationDeg = 0;
    this.isWheelSpinning = false;
  }

  esc(str) {
    return this.app.escapeHtml(str);
  }

  isLightTheme() {
    return this.app && this.app.theme === "light";
  }

  selectToken(idx) {
    this.selectedTokenIndex = idx;
    this.app.markStageExplored(1);
    this.app.renderLiveTokenBar();
    this.app.renderStageById(1);
    this.updateStage2Inspector();
    if (window.vectorView) {
      window.vectorView.selectTokenByIndex(idx);
    }
    this.app.renderStageById(4);
    this.app.renderStageById(5);
    this.app.updateHeroVisualPipeline();
    this.app.updateStoryConnectors();
  }

  // ========================================================================
  // CHAPTER 1: Word Bricks (Visual LEGO Bricks + Animated Glue Machine)
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
    const comp = typeof computeCompressionStats === "function"
      ? computeCompressionStats(charCount, bpeCount)
      : { savedPct: Math.max(0, Math.round((1 - bpeCount / charCount) * 100)), brickWidthPct: Math.max(12, Math.round((bpeCount / charCount) * 100)) };

    const steps = getBPEMergeSteps(this.bpeSampleWord || "transformer");
    const maxStep = Math.max(0, steps.length - 1);
    this.bpeStepIndex = Math.min(this.bpeStepIndex, maxStep);
    const currentStep = steps[this.bpeStepIndex] || steps[0];

    const brickColors = ["is-orange", "is-teal", "is-amber", "is-lime", "is-rose", "is-sky"];

    container.innerHTML = `
      <div class="stage-card">
        <div class="stage-header-compact stage-header-row">
          <div>
            <div class="stage-kicker">01 &middot; Tokenization (Word Bricks)</div>
            <h2 class="stage-title">Chop text into token IDs</h2>
          </div>
          <span class="stage-live-pill mono tabular-nums">${displayTokens.length} tokens</span>
        </div>

        <div class="stage-visual-container">
          <div class="stage-toolbar-row">
            <span class="section-label">Tap a token</span>
            <div class="segmented-group" role="group" aria-label="Tokenization method">
              <button type="button" class="seg-btn ${mode === "bpe" ? "is-active" : ""}" onclick="pipelineStages.setTokenizerMode('bpe')">BPE (${bpeTokens.length})</button>
              <button type="button" class="seg-btn ${mode === "word" ? "is-active" : ""}" onclick="pipelineStages.setTokenizerMode('word')">Word (${wordTokens.length})</button>
              <button type="button" class="seg-btn ${mode === "char" ? "is-active" : ""}" onclick="pipelineStages.setTokenizerMode('char')">Char (${charTokens.length})</button>
            </div>
          </div>

          <!-- Visual LEGO Brick Conveyor -->
          <div class="inset-panel brick-stage-panel">
            <div class="lego-bricks-grid">
              ${displayTokens.map((t, idx) => {
                const tint = brickColors[idx % brickColors.length];
                return `
                  <button type="button" class="lego-brick ${tint} ${idx === selectedIdx ? "active" : ""}" style="--stagger:${idx};" onclick="pipelineStages.selectToken(${idx})">
                    <span class="lego-studs" aria-hidden="true"><span></span><span></span></span>
                    <span class="lego-word">"${this.esc(t.text)}"</span>
                    <span class="lego-id tabular-nums">#${t.id}</span>
                  </button>
                `;
              }).join("")}
            </div>

            <!-- Visual Transformation Strip + Compression Gauge -->
            <div class="visual-bridge-strip">
              <div class="bridge-node">
                <span class="bridge-label">Token</span>
                <span class="bridge-val mono">"${this.esc(activeToken.text)}"</span>
              </div>
              <span class="bridge-arrow" aria-hidden="true">&rarr;</span>
              <div class="bridge-node is-accent">
                <span class="bridge-label">Token ID</span>
                <span class="bridge-val mono tabular-nums">#${activeToken.id}</span>
              </div>
              <span class="bridge-arrow" aria-hidden="true">&rarr;</span>
              <div class="bridge-node">
                <span class="bridge-label">UTF-8 Bytes</span>
                <span class="bridge-val mono tabular-nums">${(activeToken.bytes || []).slice(0, 4).map(b => b.toString(16).toUpperCase().padStart(2, "0")).join(" ")}</span>
              </div>
              <div class="compression-gauge">
                <div class="compression-meta">
                  <span class="bridge-label">${charCount} chars &rarr; ${bpeCount} tokens</span>
                  <span class="mono tabular-nums compression-pct">-${comp.savedPct}%</span>
                </div>
                <div class="compression-track" aria-hidden="true">
                  <div class="compression-fill" style="width:${comp.brickWidthPct}%;"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Interactive BPE LEGO Glue Machine -->
          <div class="inset-panel bpe-stepper-panel">
            <div class="stage-toolbar-row">
              <div class="section-label">BPE Merge Lab (Byte-Pair Encoding)</div>
              <div class="inline-controls">
                <select aria-label="Choose word to merge" class="clean-select compact-select" onchange="pipelineStages.setBpeSampleWord(this.value)">
                  ${["transformer", "attention", "unbelievable", "sleeping", "quick"].map(w => `
                    <option value="${w}" ${this.bpeSampleWord === w ? "selected" : ""}>${w}</option>
                  `).join("")}
                </select>
                <button type="button" class="btn btn-sm btn-primary" onclick="pipelineStages.toggleBpeAutoPlay()">
                  ${this._bpePlayTimer ? "Pause" : "Play BPE"}
                </button>
                <button type="button" class="btn btn-sm" onclick="pipelineStages.stepBpe(1)" ${this.bpeStepIndex >= maxStep ? "disabled" : ""}>+ Merge</button>
                <button type="button" class="btn btn-sm btn-ghost" onclick="pipelineStages.resetBpeSteps()">Reset</button>
              </div>
            </div>

            <div class="bpe-pieces-row">
              ${currentStep.pieces.map((piece, i) => `
                <span class="bpe-piece ${currentStep.mergedToken === piece ? "is-merged" : ""}">"${this.esc(piece)}"</span>
                ${i < currentStep.pieces.length - 1 ? `<span class="bpe-plus" aria-hidden="true">+</span>` : ""}
              `).join("")}
            </div>
            <div class="bpe-footer-meta">
              <div class="bpe-step-dots" role="group" aria-label="BPE merge steps">
                ${steps.map((_, i) => `
                  <button
                    type="button"
                    class="bpe-step-dot ${i === this.bpeStepIndex ? "is-active" : i < this.bpeStepIndex ? "is-done" : ""}"
                    onclick="pipelineStages.setBpeStep(${i})"
                    title="Step ${i}"
                    aria-label="Merge step ${i}"
                  ></button>
                `).join("")}
              </div>
              <span class="mono tabular-nums bpe-count-pill">${currentStep.mergedToken ? `Merged "${this.esc(currentStep.mergedToken)}" · ` : ""}${currentStep.pieces.length} ${currentStep.pieces.length === 1 ? "token" : "tokens"}</span>
            </div>
          </div>
        </div>

        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>Math Formula &middot; BPE</span>
            <span class="mono">+</span>
          </summary>
          <div class="deep-dive-content">
            <pre class="formula-block">text &rarr; [id_1, id_2, ..., id_N]   (|V| = 50k–128k tokens)</pre>
          </div>
        </details>
      </div>
    `;
  }

  setTokenizerMode(mode) {
    this.tokenizerMode = mode;
    this.app.markStageExplored(1);
    this.app.renderStageById(1);
  }

  setBpeSampleWord(word) {
    this.stopBpeAutoPlay();
    this.bpeSampleWord = word || "transformer";
    this.bpeStepIndex = 0;
    this.app.markStageExplored(1);
    this.app.renderStageById(1);
  }

  setBpeStep(idx) {
    this.stopBpeAutoPlay();
    const steps = getBPEMergeSteps(this.bpeSampleWord || "transformer");
    this.bpeStepIndex = Math.max(0, Math.min(steps.length - 1, parseInt(idx, 10) || 0));
    this.app.markStageExplored(1);
    this.app.renderStageById(1);
  }

  stepBpe(delta) {
    const steps = getBPEMergeSteps(this.bpeSampleWord || "transformer");
    this.bpeStepIndex = Math.max(0, Math.min(steps.length - 1, this.bpeStepIndex + delta));
    this.app.markStageExplored(1);
    this.app.renderStageById(1);
  }

  resetBpeSteps() {
    this.stopBpeAutoPlay();
    this.bpeStepIndex = 0;
    this.app.renderStageById(1);
  }

  stopBpeAutoPlay() {
    if (this._bpePlayTimer) {
      clearInterval(this._bpePlayTimer);
      this._bpePlayTimer = null;
    }
  }

  toggleBpeAutoPlay() {
    this.app.markStageExplored(1);
    if (this._bpePlayTimer) {
      this.stopBpeAutoPlay();
      this.app.renderStageById(1);
      return;
    }
    const steps = getBPEMergeSteps(this.bpeSampleWord || "transformer");
    if (this.bpeStepIndex >= steps.length - 1) {
      this.bpeStepIndex = 0;
    }
    this._bpePlayTimer = setInterval(() => {
      const s = getBPEMergeSteps(this.bpeSampleWord || "transformer");
      if (this.bpeStepIndex >= s.length - 1) {
        this.stopBpeAutoPlay();
      } else {
        this.bpeStepIndex += 1;
      }
      this.app.renderStageById(1);
    }, 650);
    this.app.renderStageById(1);
  }

  // ========================================================================
  // CHAPTER 2: 3D Meaning Map (Persistent WebGL Map + Visual Twin Compass)
  // ========================================================================
  renderStage2(container) {
    const tokens = this.app.tokens;
    const hp = this.app.hyperparams;
    const tokenSig = tokens.map(t => `${t.id}:${t.text}`).join("|") + `@${hp.d_model}:${this.ropeAppliedTo3D ? 1 : 0}`;
    const existingViewport = container.querySelector("#threeViewportContainer");

    if (existingViewport && this._stage2Mounted) {
      this.updateStage2Inspector();
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
        <div class="stage-header-compact stage-header-row">
          <div>
            <div class="stage-kicker">02 &middot; Embeddings (3D Meaning Map)</div>
            <h2 class="stage-title">Map tokens to 3D vectors</h2>
          </div>
          <span class="stage-live-pill mono">Embeddings</span>
        </div>

        <div class="stage-visual-container">
          <div class="stage2-split">
            <!-- Left: Interactive 3D Meaning Map -->
            <div class="stage2-map-col">
              <div class="viewport-clean" id="threeViewportContainer" data-testid="three-viewport">
                <div class="viewport-toolbar">
                  <div class="viewport-toolbar-group">
                    <button type="button" id="vpModeArrows" class="vp-btn ${this.vpMode === "arrows" ? "is-active" : ""}" onclick="pipelineStages.setViewportMode('arrows')">Vectors</button>
                    <button type="button" id="vpModePoints" class="vp-btn ${this.vpMode === "points" ? "is-active" : ""}" onclick="pipelineStages.setViewportMode('points')">Points</button>
                    <button type="button" id="vpAnchorsBtn" class="vp-btn ${this.vpAnchorsOn ? "is-active" : ""}" onclick="pipelineStages.toggleViewportAnchors()">Neighbors</button>
                  </div>
                  <div class="viewport-toolbar-group">
                    <button type="button" id="vpRotateBtn" class="vp-btn ${this.vpAutoRotate ? "is-active" : ""}" onclick="pipelineStages.toggleViewportRotate()">Spin</button>
                    <button type="button" class="vp-btn" onclick="if(window.vectorView) vectorView.resetCamera()">Reset</button>
                  </div>
                </div>
                <div id="vectorSpaceHUD" class="vector-hud-container hidden"></div>
              </div>
              <div class="viewport-help-bar">
                <span class="kbd-chip">Drag</span>
                <span class="kbd-chip">Zoom</span>
                <span class="kbd-chip">Click 2 tokens</span>
              </div>
            </div>

            <!-- Right: Visual Twin Compass & 4-Trait Visual Bars -->
            <div class="inset-panel similarity-panel" id="stage2Inspector">
              <div class="section-label">Cosine Similarity Compass</div>

              <div class="select-pair-row">
                <select id="compareWordASelect" aria-label="First word to compare" class="clean-select" onchange="pipelineStages.setComparePair(this.value, pipelineStages.compareWordB)">
                  ${vocabOptions.map(w => `<option value="${this.esc(w)}" ${this.compareWordA.toLowerCase() === w.toLowerCase() ? "selected" : ""}>"${this.esc(w)}"</option>`).join("")}
                </select>
                <span class="mono muted-vs">vs</span>
                <select id="compareWordBSelect" aria-label="Second word to compare" class="clean-select" onchange="pipelineStages.setComparePair(pipelineStages.compareWordA, this.value)">
                  ${vocabOptions.map(w => `<option value="${this.esc(w)}" ${this.compareWordB.toLowerCase() === w.toLowerCase() ? "selected" : ""}>"${this.esc(w)}"</option>`).join("")}
                </select>
              </div>

              <div class="presets-list">
                <button type="button" class="preset-btn" onclick="pipelineStages.setComparePair('quick', 'fast')">quick vs fast</button>
                <button type="button" class="preset-btn" onclick="pipelineStages.setComparePair('fox', 'dog')">fox vs dog</button>
                <button type="button" class="preset-btn" onclick="pipelineStages.setComparePair('quick', 'lazy')">quick vs lazy</button>
                <button type="button" class="preset-btn" onclick="pipelineStages.setComparePair('fox', 'transformer')">fox vs AI</button>
              </div>

              <div id="stage2SimilarityReadout"></div>
              <div id="stage2VectorDNA"></div>
            </div>
          </div>
        </div>

        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>Math Formula &middot; Cosine Similarity</span>
            <span class="mono">+</span>
          </summary>
          <div class="deep-dive-content">
            <pre class="formula-block">e_i = E[token_id]   &middot;   cos(&theta;) = (u &middot; v) / (||u|| &times; ||v||)</pre>
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
    this.app.markStageExplored(2);
    if (window.vectorView) {
      window.vectorView.setMode(mode);
    }
    this.syncStage2ToolbarButtons();
  }

  toggleViewportAnchors() {
    this.vpAnchorsOn = !this.vpAnchorsOn;
    this.app.markStageExplored(2);
    if (window.vectorView) {
      window.vectorView.toggleAnchors(this.vpAnchorsOn);
    }
    this.syncStage2ToolbarButtons();
  }

  toggleViewportRotate() {
    this.vpAutoRotate = !this.vpAutoRotate;
    this.app.markStageExplored(2);
    if (window.vectorView) {
      window.vectorView.toggleAutoRotate(this.vpAutoRotate);
    }
    this.syncStage2ToolbarButtons();
  }

  setComparePair(wA, wB) {
    this.compareWordA = wA;
    this.compareWordB = wB;
    this.app.markStageExplored(2);
    this.updateStage2Inspector();
    if (window.vectorView && typeof window.vectorView.selectPairByWords === "function") {
      window.vectorView.selectPairByWords(wA, wB);
    }
  }

  updateStage2Inspector() {
    const hp = this.app.hyperparams;
    const tokens = this.app.tokens;
    const wordA = this.compareWordA || "quick";
    const wordB = this.compareWordB || "fast";

    const vocabOptions = this.getComparableWordList();
    const simAEl = document.getElementById("compareWordASelect");
    const simBEl = document.getElementById("compareWordBSelect");
    if (simAEl) {
      simAEl.innerHTML = vocabOptions.map(w => `<option value="${this.esc(w)}" ${wordA.toLowerCase() === w.toLowerCase() ? "selected" : ""}>"${this.esc(w)}"</option>`).join("");
      simAEl.value = wordA;
    }
    if (simBEl) {
      simBEl.innerHTML = vocabOptions.map(w => `<option value="${this.esc(w)}" ${wordB.toLowerCase() === w.toLowerCase() ? "selected" : ""}>"${this.esc(w)}"</option>`).join("");
      simBEl.value = wordB;
    }

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
      ? "Twins"
      : cosSim > 0.15
        ? "Close"
        : cosSim > -0.2
          ? "90° Apart"
          : "Opposites";

    const simColor = cosSim > 0.65 ? "var(--teal)" : cosSim < -0.1 ? "var(--rose)" : "var(--accent-primary)";
    const meterPct = Math.round(((cosSim + 1) / 2) * 100);

    const rad = (Math.min(180, Math.max(4, angleDeg)) * Math.PI) / 180;
    const cx = 86;
    const cy = 78;
    const r = 58;
    const gx = cx + Math.cos(-rad) * r;
    const gy = cy + Math.sin(-rad) * r;
    const isLight = this.isLightTheme();
    const colA = isLight ? "#EA580C" : "#FB923C";
    const colB = isLight ? "#059669" : "#34D399";
    const colCenter = isLight ? "#181816" : "#F5F4EE";
    const colArc = isLight ? "#78766D" : "#A8A29E";

    const simEl = document.getElementById("stage2SimilarityReadout");
    if (simEl) {
      simEl.innerHTML = `
        <div class="compass-card">
          <div class="compass-top-row">
            <svg width="176" height="92" viewBox="0 0 186 92" aria-label="Angle gauge showing ${angleDeg.toFixed(1)} degrees" style="flex-shrink:0;">
              <path d="M 28 78 A 58 58 0 0 1 144 78" fill="none" stroke="${colArc}" stroke-opacity="0.22" stroke-width="2" stroke-dasharray="4 4"/>
              <line x1="${cx}" y1="${cy}" x2="${cx + r}" y2="${cy}" stroke="${colA}" stroke-width="3.2" stroke-linecap="round"/>
              <line x1="${cx}" y1="${cy}" x2="${gx.toFixed(1)}" y2="${gy.toFixed(1)}" stroke="${colB}" stroke-width="3.2" stroke-linecap="round"/>
              <path d="M ${cx + 26} ${cy} A 26 26 0 0 0 ${(cx + Math.cos(-rad) * 26).toFixed(1)} ${(cy + Math.sin(-rad) * 26).toFixed(1)}" fill="none" stroke="${colArc}" stroke-width="1.6"/>
              <circle cx="${cx}" cy="${cy}" r="4" fill="${colCenter}"/>
              <text x="${cx + r - 2}" y="${cy + 13}" font-size="11" font-family="JetBrains Mono" text-anchor="end" fill="${colA}">${this.esc(wordA.slice(0, 8))}</text>
              <text x="${Math.min(180, Math.max(6, gx + (gx >= cx ? 6 : -6))).toFixed(1)}" y="${Math.max(13, gy - 4).toFixed(1)}" font-size="11" font-family="JetBrains Mono" text-anchor="${gx >= cx ? "start" : "end"}" fill="${colB}">${this.esc(wordB.slice(0, 8))}</text>
            </svg>
            <div class="compass-stats">
              <div class="mono tabular-nums compass-score" style="color:${simColor};">${angleDeg.toFixed(0)}&deg;</div>
              <div class="compass-verdict">${verdict}</div>
              <div class="mono tabular-nums compass-sub">Similarity ${cosSim.toFixed(2)}</div>
            </div>
          </div>

          <!-- Visual Opposites-to-Twins Spectrum -->
          <div class="spectrum-wrap">
            <div class="spectrum-bar">
              <div class="spectrum-dot" style="left:${Math.max(4, Math.min(96, meterPct))}%; background:${simColor};"></div>
            </div>
            <div class="spectrum-labels">
              <span>Opposites</span>
              <span>Unrelated</span>
              <span>Twins</span>
            </div>
          </div>
        </div>
      `;
    }

    const selectedIdx = Math.min(this.selectedTokenIndex, Math.max(0, tokens.length - 1));
    const activeTok = tokens[selectedIdx] || tokens[0];
    const activeVec = this.math.getTokenEmbedding(activeTok, hp.d_model);
    const dimHints = ["Topic", "Speed", "Action", "Nature"];

    const dnaEl = document.getElementById("stage2VectorDNA");
    if (dnaEl) {
      dnaEl.innerHTML = `
        <div class="dna-header">
          <span>Embedding vector <strong class="mono">"${this.esc(activeTok.text)}"</strong></span>
          <span class="mono muted-mini">4 of ${hp.d_model} dims</span>
        </div>
        <div class="vector-dna-list">
          ${activeVec.slice(0, 4).map((val, i) => {
            const pct = Math.min(48, Math.abs(val) * 56);
            const left = val >= 0 ? 50 : 50 - pct;
            const color = val >= 0 ? "var(--accent-primary)" : "var(--amber)";
            return `
              <div class="dna-row" style="grid-template-columns: 56px 1fr 48px;">
                <span class="dna-label">${dimHints[i]}</span>
                <div class="dna-track">
                  <div class="dna-zero"></div>
                  <div class="dna-bar" style="left:${left.toFixed(1)}%; width:${pct.toFixed(1)}%; background:${color};"></div>
                </div>
                <span class="tabular-nums dna-val">${val >= 0 ? "+" : ""}${val.toFixed(2)}</span>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }
  }

  // ========================================================================
  // CHAPTER 3: Word Order Clocks (Clock Dial + Visual Story Flip Card)
  // ========================================================================
  renderStage3(container) {
    const tokens = this.app.tokens;
    const mode = this.ropeMode || "rope";
    this.ropeSelectedPos = Math.min(this.ropeSelectedPos, Math.max(0, tokens.length - 1));
    const tokenAtPos = tokens[this.ropeSelectedPos] || tokens[0];

    container.innerHTML = `
      <div class="stage-card">
        <div class="stage-header-compact stage-header-row">
          <div>
            <div class="stage-kicker">03 &middot; Positional Encoding (RoPE)</div>
            <h2 class="stage-title">Rotate vectors by position</h2>
          </div>
          <span id="stage3AnglePill" class="stage-live-pill mono tabular-nums">#${this.ropeSelectedPos + 1} &middot; ${this.ropeSelectedPos * 36}&deg;</span>
        </div>

        <div class="stage-visual-container">
          <div class="stage-toolbar-row">
            <div class="slot-chips-row" id="ropeSlotChips" role="group" aria-label="Pick a word position">
              ${tokens.slice(0, 10).map((t, idx) => `
                <button type="button" class="slot-chip-btn ${idx === this.ropeSelectedPos ? "is-active" : ""}" data-rope-pos="${idx}" onclick="pipelineStages.setRoPEPosition(${idx})">
                  <span class="seat-num">#${idx + 1}</span>
                  <span>"${this.esc(t.text)}"</span>
                </button>
              `).join("")}
            </div>

            <div class="segmented-group" role="group" aria-label="Positional encoding method">
              <button type="button" class="seg-btn ${mode === "rope" ? "is-active" : ""}" onclick="pipelineStages.setRoPEMode('rope')">RoPE</button>
              <button type="button" class="seg-btn ${mode === "sinusoidal" ? "is-active" : ""}" onclick="pipelineStages.setRoPEMode('sinusoidal')">Sinusoidal</button>
              <button type="button" class="seg-btn ${mode === "none" ? "is-active" : ""}" onclick="pipelineStages.setRoPEMode('none')">None</button>
            </div>
          </div>

          <div class="rope-stage-grid">
            <div class="canvas-frame">
              <canvas id="ropeDialCanvas" class="dial-canvas" width="460" height="280"></canvas>
              <div class="canvas-slider-row">
                <button type="button" class="btn btn-sm btn-primary" onclick="pipelineStages.toggleClockPlay()">
                  ${this._clockPlayTimer ? "Pause" : "Spin"}
                </button>
                <input id="ropePosSlider" type="range" min="0" max="${Math.max(0, tokens.length - 1)}" value="${this.ropeSelectedPos}" oninput="pipelineStages.setRoPEPosition(this.value)" aria-label="Word seat position">
                <span id="ropePosReadout" class="mono tabular-nums">#${this.ropeSelectedPos + 1} (${this.ropeSelectedPos * 36}&deg;)</span>
              </div>
            </div>

            <div class="inset-panel story-order-panel">
              <div id="ropeExplainPanel"></div>
              <div class="order-action-row">
                <button type="button" class="btn btn-sm btn-secondary" onclick="pipelineStages.toggleOrderSwap()">
                  Swap &harr;
                </button>
                <button type="button" class="btn btn-sm btn-primary" onclick="pipelineStages.applyRoPETo3D()">
                  ${this.ropeAppliedTo3D ? "3D Spin: ON &uarr;" : "Send to 3D &uarr;"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>Math Formula &middot; RoPE</span>
            <span class="mono">+</span>
          </summary>
          <div class="deep-dive-content">
            <pre class="formula-block">x'_2i = x_2i cos(m&theta;) &minus; x_(2i+1) sin(m&theta;)
x'_(2i+1) = x_2i sin(m&theta;) + x_(2i+1) cos(m&theta;)</pre>
          </div>
        </details>
      </div>
    `;

    this.updateStage3Visuals();
  }

  setRoPEMode(mode) {
    this.ropeMode = mode;
    this.app.markStageExplored(3);
    this.app.renderStageById(3);
  }

  setRoPEPosition(pos) {
    this.ropeSelectedPos = parseInt(pos, 10) || 0;
    this.app.markStageExplored(3);
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
    this.app.markStageExplored(3);
    if (window.vectorView) {
      window.vectorView.updateTokens(this.app.tokens, this.app.hyperparams.d_model, this.ropeAppliedTo3D ? 25 : 0);
      window.vectorView.fitCameraToScene();
      window.vectorView.requestRender();
    }
    this.app.renderStageById(3);
    this.app.setActiveStage(2);
  }

  toggleOrderSwap() {
    this.orderSwapped = !this.orderSwapped;
    this.app.markStageExplored(3);
    this.updateStage3Visuals();
  }

  toggleClockPlay() {
    this.app.markStageExplored(3);
    if (this._clockPlayTimer) {
      clearInterval(this._clockPlayTimer);
      this._clockPlayTimer = null;
      this.app.renderStageById(3);
      return;
    }
    this._clockPlayTimer = setInterval(() => {
      const len = Math.max(1, this.app.tokens.length);
      this.setRoPEPosition((this.ropeSelectedPos + 1) % len);
    }, 650);
    this.app.renderStageById(3);
  }

  updateStage3Visuals() {
    const tokens = this.app.tokens;
    const pos = Math.min(this.ropeSelectedPos, Math.max(0, tokens.length - 1));
    const tok = tokens[pos] || tokens[0];

    const readout = document.getElementById("ropePosReadout");
    if (readout) {
      readout.innerHTML = `#${pos + 1} (${pos * 36}&deg;)`;
    }
    const pill = document.getElementById("stage3AnglePill");
    if (pill) {
      pill.innerHTML = `#${pos + 1} &middot; ${pos * 36}&deg;`;
    }

    const panel = document.getElementById("ropeExplainPanel");
    if (panel) {
      const firstWord = this.orderSwapped ? "Fox" : "Dog";
      const secondWord = this.orderSwapped ? "dog" : "fox";
      const firstClass = this.orderSwapped ? "is-b" : "is-a";
      const secondClass = this.orderSwapped ? "is-a" : "is-b";

      if (this.ropeMode === "none") {
        panel.innerHTML = `
          <div class="order-visual-demo is-broken">
            <div class="order-demo-head is-danger">Order OFF &middot; Word Soup</div>
            <div class="order-scene-row is-flipped-pop">
              <span class="order-pill">? ${firstWord.toLowerCase()}</span>
              <span class="order-pill">? chases</span>
              <span class="order-pill">? ${secondWord}</span>
            </div>
            <div class="order-equals-badge is-danger">Swap makes zero difference</div>
          </div>
        `;
      } else {
        const modeTitle = this.ropeMode === "sinusoidal"
          ? `Wave #${pos + 1}`
          : `Seat #${pos + 1} · ${pos * 36}°`;
        panel.innerHTML = `
          <div class="order-visual-demo">
            <div class="order-demo-head">${modeTitle}</div>
            <div class="order-scene-row is-flipped-pop">
              <span class="order-pill ${firstClass}">0&deg; ${firstWord}</span>
              <span class="order-arrow">&rarr;</span>
              <span class="order-pill">36&deg; chases</span>
              <span class="order-arrow">&rarr;</span>
              <span class="order-pill ${secondClass}">72&deg; ${secondWord}</span>
            </div>
            <button type="button" class="order-comic-strip is-clickable" onclick="pipelineStages.toggleOrderSwap()" title="Click to swap order">
              <span class="comic-actor ${firstClass}">${firstWord}</span>
              <span class="comic-motion" aria-hidden="true">━━▶</span>
              <span class="comic-actor ${secondClass}">${secondWord.charAt(0).toUpperCase() + secondWord.slice(1)}</span>
            </button>
            <div class="order-selected-stat">
              <strong class="mono">"${this.esc(tok.text)}"</strong>
              <span class="mono tabular-nums">+${pos * 36}&deg;</span>
            </div>
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
      const colors = ["#38BDF8", "#2DD4BF", "#FBBF24"];

      ctx.strokeStyle = "#263348";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padX, padY + plotH / 2);
      ctx.lineTo(w - padX, padY + plotH / 2);
      ctx.stroke();

      for (let dim = 0; dim < 3; dim++) {
        ctx.beginPath();
        ctx.strokeStyle = colors[dim];
        ctx.lineWidth = 2.4;
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
      ctx.strokeStyle = "#F8FAFC";
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
        ctx.arc(cursorX, py, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = colors[dim];
        ctx.fill();
      }

      ctx.fillStyle = "#F1F5F9";
      ctx.font = "600 12px 'JetBrains Mono', monospace";
      ctx.fillText(`Seat #${activePos + 1}: "${tokens[activePos]?.text || ""}"`, Math.min(w - 170, Math.max(padX, cursorX - 36)), 18);
      return;
    }

    if (this.ropeMode === "none") {
      const cx = w / 2;
      const cy = h / 2;
      ctx.strokeStyle = "#475569";
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 86, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      tokens.forEach((t, i) => {
        const ox = cx + ((i % 3) - 1) * 24;
        const oy = cy + (Math.floor(i / 3) - 1) * 22;
        ctx.beginPath();
        ctx.arc(ox, oy, 7, 0, Math.PI * 2);
        ctx.fillStyle = i === activePos ? "#F87171" : "#64748B";
        ctx.fill();
        ctx.fillStyle = "#F1F5F9";
        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.fillText(`"${t.text}"`, ox + 10, oy + 4);
      });

      ctx.fillStyle = "#F87171";
      ctx.font = "600 12px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText("No seat clocks — every word floats in one pile!", 18, 22);
      return;
    }

    const cx = w / 2;
    const cy = h / 2 + 4;
    const radius = Math.min(cx, cy) - 44;

    // Outer & inner clock rings
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#3F3D36";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.56, 0, Math.PI * 2);
    ctx.strokeStyle = "#262520";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Swept angle sector highlight from 12 o'clock to active seat
    const stepRad = (36 * Math.PI) / 180;
    if (activePos > 0) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius * 0.56, -Math.PI / 2, activePos * stepRad - Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = "rgba(249, 115, 22, 0.18)";
      ctx.fill();
    }

    // 12 o'clock reference
    ctx.strokeStyle = "rgba(168, 162, 158, 0.28)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - radius);
    ctx.stroke();
    ctx.setLineDash([]);

    tokens.forEach((t, i) => {
      const angle = i * stepRad - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      const isSelected = i === activePos;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.strokeStyle = isSelected ? "#FB923C" : "rgba(168, 162, 158, 0.32)";
      ctx.lineWidth = isSelected ? 3.5 : 1.3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 7.5 : 4.2, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#34D399" : "#78716C";
      ctx.fill();

      const lx = cx + (radius + 18) * Math.cos(angle);
      const ly = cy + (radius + 18) * Math.sin(angle);
      ctx.fillStyle = isSelected ? "#FFFFFF" : "#A8A29E";
      ctx.font = isSelected ? "bold 12px 'JetBrains Mono', monospace" : "11px 'JetBrains Mono', monospace";
      ctx.textAlign = Math.cos(angle) > 0.2 ? "left" : Math.cos(angle) < -0.2 ? "right" : "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`#${i + 1} ${t.text}`, lx, ly);
    });

    // Center hub
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#F5F4EE";
    ctx.fill();

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  // ========================================================================
  // CHAPTER 4: Word Detective (Interactive Clue Board + Auto-Tour)
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

    const topClue = attendedTokens.find(x => x.index !== selectedIdx) || attendedTokens[0];

    const stackedColors = ["#F97316", "#10B981", "#EAB308", "#0EA5E9", "#EF4444", "#84CC16"];

    container.innerHTML = `
      <div class="stage-card">
        <div class="stage-header-compact stage-header-row">
          <div>
            <div class="stage-kicker">04 &middot; Self-Attention (Word Detective)</div>
            <h2 class="stage-title">Weight clues from past tokens</h2>
          </div>
          <span class="stage-live-pill mono">${topClue ? `"${this.esc(topClue.token)}" ${Math.round(topClue.weight * 100)}%` : "Self"}</span>
        </div>

        <div class="stage-visual-container">
          <div class="stage-toolbar-row">
            <div class="segmented-group" role="group" aria-label="Attention head">
              <button type="button" class="seg-btn ${this.selectedHeadIndex === 0 ? "is-active" : ""}" onclick="pipelineStages.setAttnHead(0)">Head 1 · Syntax</button>
              <button type="button" class="seg-btn ${this.selectedHeadIndex === 1 ? "is-active" : ""}" onclick="pipelineStages.setAttnHead(1)">Head 2 · Semantics</button>
            </div>

            <div class="inline-controls">
              <button type="button" class="btn btn-sm btn-primary" onclick="pipelineStages.toggleAttnTour()">
                ${this._attnTourTimer ? "Stop" : "Auto-Scan"}
              </button>
              <div class="segmented-group" role="group" aria-label="Attention view mode">
                <button type="button" class="seg-btn ${this.attnViewMode === "arcs" ? "is-active" : ""}" onclick="pipelineStages.setAttnViewMode('arcs')">Arcs</button>
                <button type="button" class="seg-btn ${this.attnViewMode === "matrix" ? "is-active" : ""}" onclick="pipelineStages.setAttnViewMode('matrix')">Matrix</button>
              </div>
              <button type="button" class="btn btn-sm ${this.causalMaskEnabled ? "btn-teal" : ""}" onclick="pipelineStages.toggleCausalMask()">
                ${this.causalMaskEnabled ? "Causal Mask: ON" : "Causal Mask: OFF"}
              </button>
            </div>
          </div>

          ${this.attnViewMode === "arcs" ? `
            <div class="detective-board" id="attnStageArea">
              <div class="detective-legend">
                <span class="legend-chip"><span class="quick-dot is-orange"></span>Query (Q): "${this.esc(currentToken.text)}"</span>
                <span class="legend-chip"><span class="quick-dot is-teal"></span>Keys (K)</span>
                ${this.causalMaskEnabled && selectedIdx < tokens.length - 1 ? `<span class="legend-chip">⊘ Future masked</span>` : ""}
              </div>
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
                    >
                      <span>"${this.esc(t.text)}"</span>
                      ${!isFutureMasked ? `<span class="word-weight-sub tabular-nums">${Math.round(w * 100)}%</span>` : `<span class="word-weight-sub">⊘</span>`}
                    </button>
                  `;
                }).join("")}
              </div>
              <svg class="attention-bezier-svg" id="attentionBezierSVG" aria-hidden="true"></svg>
            </div>
          ` : `
            <div class="inset-panel attn-matrix-wrap">
              <div class="section-label" style="margin-bottom:8px;">Clue Grid</div>
              <table class="attn-matrix-table">
                <thead>
                  <tr>
                    <th>Row &rarr; Col</th>
                    ${tokens.map((t, j) => `<th>${j + 1}:"${this.esc(t.text)}"</th>`).join("")}
                  </tr>
                </thead>
                <tbody>
                  ${tokens.map((rowTok, i) => `
                    <tr>
                      <th class="${i === selectedIdx ? "is-selected-row" : ""}">${i + 1}:"${this.esc(rowTok.text)}"</th>
                      ${tokens.map((_, j) => {
                        const blocked = this.causalMaskEnabled && j > i;
                        const val = (weightsMatrix[i] && weightsMatrix[i][j]) || 0;
                        const pct = Math.round(val * 100);
                        const bgAlpha = Math.max(0.08, val * 0.85);
                        return blocked
                          ? `<td class="attn-matrix-cell is-blocked">&mdash;</td>`
                          : `<td class="attn-matrix-cell tabular-nums" onclick="pipelineStages.selectToken(${i})" style="background:rgba(249, 115, 22, ${bgAlpha.toFixed(2)}); color:${val > 0.42 ? "#FFFFFF" : "var(--ink-primary)"};">${pct}%</td>`;
                      }).join("")}
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `}

          <div class="inset-panel">
            <div class="stage-toolbar-row" style="margin-bottom:8px;">
              <span class="section-label">Attention Weights (100%) &middot; <span class="mono">"${this.esc(currentToken.text)}"</span></span>
              <span class="mono tabular-nums" style="font-size:11px; color:var(--ink-muted);">Tap row to inspect</span>
            </div>
            <div class="attn-stacked-bar" aria-hidden="true">
              ${attendedTokens.slice(0, 6).map((item, idx) => `
                <span class="attn-stacked-seg" style="width:${Math.max(4, Math.round(item.weight * 100))}%; background:${item.index === selectedIdx ? "var(--accent-primary)" : stackedColors[(idx + 1) % stackedColors.length]};" title="${this.esc(item.token)}: ${Math.round(item.weight * 100)}%"></span>
              `).join("")}
            </div>
            <div class="clue-bars-grid">
              ${attendedTokens.slice(0, 6).map(item => `
                <button type="button" class="attn-item-row is-clickable" onclick="pipelineStages.selectToken(${item.index})">
                  <span class="mono" style="font-size:12.5px; font-weight:600; color:${item.index === selectedIdx ? "var(--accent-primary)" : "var(--ink-primary)"};">"${this.esc(item.token)}"</span>
                  <span class="attn-progress-bar">
                    <span class="attn-progress-fill" style="display:block; width:${Math.max(3, Math.round(item.weight * 100))}%; background:${item.index === selectedIdx ? "var(--accent-primary)" : "var(--teal)"};"></span>
                  </span>
                  <span class="mono tabular-nums" style="text-align:right; font-size:12px; font-weight:600;">${Math.round(item.weight * 100)}%</span>
                </button>
              `).join("")}
            </div>
          </div>
        </div>

        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>Math Formula &middot; Self-Attention</span>
            <span class="mono">+</span>
          </summary>
          <div class="deep-dive-content">
            <pre class="formula-block">Attention(Q, K, V) = softmax((Q &middot; K^T) / &radic;d_k + Mask) &middot; V</pre>
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
    const height = 96;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const srcRect = srcBtn.getBoundingClientRect();
    const x1 = srcRect.left - svgRect.left + srcRect.width / 2;
    const isLight = this.isLightTheme();
    const selfStroke = isLight ? "#EA580C" : "#FB923C";
    const clueStroke = isLight ? "#059669" : "#34D399";

    const paths = [];
    buttons.forEach((btn, j) => {
      if (this.causalMaskEnabled && j > selectedIdx) return;
      const weight = rawWeights[j] || 0;
      if (weight < 0.01) return;
      const dstRect = btn.getBoundingClientRect();
      const x2 = dstRect.left - svgRect.left + dstRect.width / 2;
      const dist = Math.abs(x1 - x2);
      const curveDepth = Math.min(height - 8, Math.max(30, dist * 0.34 + 26));
      const strokeColor = j === selectedIdx ? selfStroke : clueStroke;
      const strokeWidth = Math.max(2, weight * 12);
      const opacity = Math.max(0.35, Math.min(0.95, weight * 2.3));

      if (j === selectedIdx) {
        const dSelf = `M ${x1 - 9} 4 C ${x1 - 16} 42, ${x1 + 16} 42, ${x1 + 9} 4`;
        paths.push(`<path d="${dSelf}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth.toFixed(1)}" opacity="${opacity.toFixed(2)}" stroke-linecap="round"/>`);
      } else {
        // Direction from clue word (x2) INTO asking word (x1) so signal particles visibly feed into the active word!
        const dClue = `M ${x2.toFixed(1)} 4 Q ${((x1 + x2) / 2).toFixed(1)} ${curveDepth.toFixed(1)} ${x1.toFixed(1)} 4`;
        const pathId = `clue-arc-${j}`;
        paths.push(`<path id="${pathId}" class="clue-arc-path" d="${dClue}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth.toFixed(1)}" opacity="${opacity.toFixed(2)}" stroke-linecap="round"/>`);
        if (weight > 0.08) {
          const dur = Math.max(0.9, 2.3 - weight * 1.4).toFixed(2);
          paths.push(`
            <circle r="${Math.min(5.2, 2.8 + weight * 4).toFixed(1)}" fill="${strokeColor}">
              <animateMotion dur="${dur}s" repeatCount="indefinite" path="${dClue}"/>
            </circle>
          `);
        }
      }
      paths.push(`<circle cx="${x2.toFixed(1)}" cy="5" r="3.6" fill="${strokeColor}" opacity="${opacity.toFixed(2)}"/>`);
    });

    svg.innerHTML = paths.join("");
  }

  toggleAttnTour() {
    this.app.markStageExplored(4);
    if (this._attnTourTimer) {
      clearInterval(this._attnTourTimer);
      this._attnTourTimer = null;
      this.app.renderStageById(4);
      return;
    }
    this._attnTourTimer = setInterval(() => {
      const len = Math.max(1, this.app.tokens.length);
      const next = (this.selectedTokenIndex + 1) % len;
      this.selectToken(next);
    }, 900);
    this.app.renderStageById(4);
  }

  setAttnHead(idx) {
    this.selectedHeadIndex = idx;
    this.app.markStageExplored(4);
    this.app.renderStageById(4);
  }

  setAttnViewMode(mode) {
    this.attnViewMode = mode;
    this.app.markStageExplored(4);
    this.app.renderStageById(4);
  }

  toggleCausalMask() {
    this.causalMaskEnabled = !this.causalMaskEnabled;
    this.app.markStageExplored(4);
    this.app.renderStageById(4);
  }

  // ========================================================================
  // CHAPTER 5: 3 Brain Chores (Equalizer, SVG Bypass Highway, Glowing Bulbs)
  // ========================================================================
  renderStage5(container) {
    const activeTab = this.stage5Tab || "norm";
    const tokens = this.app.tokens;
    const activeTok = tokens[Math.min(this.selectedTokenIndex, Math.max(0, tokens.length - 1))] || tokens[0];

    container.innerHTML = `
      <div class="stage-card">
        <div class="stage-header-compact stage-header-row">
          <div>
            <div class="stage-kicker">05 &middot; Transformer Block</div>
            <h2 class="stage-title">Norm &middot; Residual &middot; Feed-Forward</h2>
          </div>
          <span class="stage-live-pill mono">"${this.esc(activeTok.text)}"</span>
        </div>

        <div class="stage-visual-container">
          <!-- Interactive 3-Station Visual Selector -->
          <div class="block-stepper" role="tablist" aria-label="Transformer block sub-layers">
            <button type="button" role="tab" aria-selected="${activeTab === "norm"}" class="block-step-btn ${activeTab === "norm" ? "is-active" : ""}" onclick="pipelineStages.setStage5Tab('norm')">
              <span class="block-step-kicker">01 · Normalization</span>
              <span class="block-step-title">RMSNorm Limiter</span>
            </button>
            <button type="button" role="tab" aria-selected="${activeTab === "skip"}" class="block-step-btn ${activeTab === "skip" ? "is-active" : ""}" onclick="pipelineStages.setStage5Tab('skip')">
              <span class="block-step-kicker">02 · Residual Skip</span>
              <span class="block-step-title">Bypass Highway</span>
            </button>
            <button type="button" role="tab" aria-selected="${activeTab === "ffn"}" class="block-step-btn ${activeTab === "ffn" ? "is-active" : ""}" onclick="pipelineStages.setStage5Tab('ffn')">
              <span class="block-step-kicker">03 · Feed-Forward (FFN)</span>
              <span class="block-step-title">Memory Neurons</span>
            </button>
          </div>

          ${activeTab === "norm" ? `
            <div class="inset-panel">
              <div class="stage-toolbar-row" style="margin-bottom:12px;">
                <span class="section-label">Tap any bar to spike &middot; <span id="spikeBarTag" class="mono">d${this.spikeBarIndex}</span></span>
                <div class="segmented-group" role="group" aria-label="Normalization method">
                  <button type="button" class="seg-btn ${this.normType === "rmsnorm" ? "is-active" : ""}" onclick="pipelineStages.setNormType('rmsnorm')">RMSNorm</button>
                  <button type="button" class="seg-btn ${this.normType === "layernorm" ? "is-active" : ""}" onclick="pipelineStages.setNormType('layernorm')">LayerNorm</button>
                </div>
              </div>

              <div class="spike-control-row">
                <label for="normSpikeSlider">Spike:</label>
                <input id="normSpikeSlider" type="range" min="-5.0" max="5.0" step="0.5" value="${this.normSpikeValue}" oninput="pipelineStages.setNormSpike(this.value)">
                <span id="normSpikeReadout" class="mono tabular-nums spike-val">+${this.normSpikeValue.toFixed(1)}</span>
                <button type="button" class="btn btn-sm btn-secondary" onclick="pipelineStages.blastRandomSpike()">Blast!</button>
                <span id="normRmsReadout" class="mono tabular-nums spike-rms"></span>
              </div>

              <div class="norm-compare-grid">
                <div class="bar-chart-card">
                  <div class="eq-title is-danger">Before &middot; Raw</div>
                  <div id="normBeforeChart" class="eq-bars-stage"></div>
                </div>
                <div class="bar-chart-card">
                  <div class="eq-title is-safe">After &middot; ${this.normType === "rmsnorm" ? "RMSNorm" : "LayerNorm"}</div>
                  <div id="normAfterChart" class="eq-bars-stage"></div>
                </div>
              </div>
            </div>
          ` : activeTab === "skip" ? `
            <div class="inset-panel skip-visual-panel">
              <div class="skip-diagram-row">
                <span class="section-label">Residual Connection &middot; <span class="mono">"${this.esc(activeTok.text)}"</span></span>
                <button type="button" class="btn btn-sm ${this.skipConnectionEnabled ? "btn-teal" : "btn-danger"}" onclick="pipelineStages.toggleSkip()">
                  ${this.skipConnectionEnabled ? "Residual: ON" : "Residual: CUT"}
                </button>
              </div>

              <!-- Live Animated SVG Circuit Diagram -->
              <div class="skip-svg-wrap">
                <svg viewBox="0 0 620 175" class="skip-svg" role="img" aria-label="Animated residual connection diagram">
                  <path d="M 122 92 C 160 22, 430 22, 476 80" fill="none"
                    stroke="${this.skipConnectionEnabled ? "var(--teal)" : "var(--rose)"}"
                    stroke-width="${this.skipConnectionEnabled ? "4" : "2.5"}"
                    stroke-dasharray="${this.skipConnectionEnabled ? "0" : "7 6"}"
                    stroke-linecap="round"/>
                  ${this.skipConnectionEnabled ? `
                    <circle r="5.5" fill="var(--teal)">
                      <animateMotion dur="1.7s" repeatCount="indefinite" path="M 122 92 C 160 22, 430 22, 476 80"/>
                    </circle>
                    <circle r="4" fill="var(--teal)" opacity="0.65">
                      <animateMotion dur="1.7s" begin="0.85s" repeatCount="indefinite" path="M 122 92 C 160 22, 430 22, 476 80"/>
                    </circle>
                  ` : ""}
                  <text x="300" y="24" text-anchor="middle" font-size="12" font-weight="700"
                    fill="${this.skipConnectionEnabled ? "var(--teal)" : "var(--rose)"}">
                    ${this.skipConnectionEnabled ? "Residual Skip: 100% Intact" : "Residual Cut: Signal Fades"}
                  </text>

                  <path d="M 126 108 L 464 108" fill="none" stroke="var(--accent-primary)" stroke-width="3"/>
                  <circle r="4.5" fill="var(--accent-primary)">
                    <animateMotion dur="1.9s" repeatCount="indefinite" path="M 126 108 L 464 108"/>
                  </circle>
                  <line x1="504" y1="108" x2="534" y2="108" stroke="${this.skipConnectionEnabled ? "var(--teal)" : "var(--rose)"}" stroke-width="3"/>

                  <rect x="16" y="82" width="110" height="52" rx="10" fill="var(--bg-surface)" stroke="var(--accent-primary)" stroke-width="2"/>
                  <text x="71" y="104" text-anchor="middle" font-size="11" fill="var(--ink-muted)">Input x</text>
                  <text x="71" y="122" text-anchor="middle" font-size="13" font-weight="700" font-family="JetBrains Mono" fill="var(--ink-primary)">"${this.esc(activeTok.text.slice(0, 9))}"</text>

                  <rect x="218" y="80" width="164" height="56" rx="10" fill="var(--bg-surface)" stroke="var(--border-strong)" stroke-width="2"/>
                  <text x="300" y="104" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink-primary)">Sublayer(x)</text>
                  <text x="300" y="122" text-anchor="middle" font-size="11" fill="var(--ink-muted)">Attention / FFN</text>

                  <circle cx="484" cy="108" r="20" fill="${this.skipConnectionEnabled ? "var(--teal-soft)" : "var(--rose-soft)"}" stroke="${this.skipConnectionEnabled ? "var(--teal)" : "var(--rose)"}" stroke-width="2.5"/>
                  <text x="484" y="114" text-anchor="middle" font-size="19" font-weight="700" fill="${this.skipConnectionEnabled ? "var(--teal)" : "var(--rose)"}">${this.skipConnectionEnabled ? "+" : "!"}</text>

                  <rect x="534" y="82" width="74" height="52" rx="10" fill="var(--bg-surface)" stroke="${this.skipConnectionEnabled ? "var(--teal)" : "var(--rose)"}" stroke-width="2" opacity="${this.skipConnectionEnabled ? "1" : "0.55"}"/>
                  <text x="571" y="104" text-anchor="middle" font-size="11" fill="var(--ink-muted)">Out</text>
                  <text x="571" y="122" text-anchor="middle" font-size="13" font-weight="700" font-family="JetBrains Mono" fill="${this.skipConnectionEnabled ? "var(--teal)" : "var(--rose)"}">${this.skipConnectionEnabled ? "100%" : "28%"}</text>
                </svg>
              </div>
              <div id="skipStatusText" class="signal-health-bar"></div>
            </div>
          ` : `
            <div class="inset-panel">
              <div class="stage-toolbar-row" style="margin-bottom:12px;">
                <div class="section-label">Feed-Forward Neurons (FFN) &middot; <span class="mono">"${this.esc(activeTok.text)}"</span></div>
                <div class="segmented-group" role="group" aria-label="FFN activation architecture">
                  <button type="button" class="seg-btn ${this.ffnArch === "swiglu" ? "is-active" : ""}" onclick="pipelineStages.setFFNArch('swiglu')">SwiGLU</button>
                  <button type="button" class="seg-btn ${this.ffnArch === "gelu" ? "is-active" : ""}" onclick="pipelineStages.setFFNArch('gelu')">GELU</button>
                </div>
              </div>
              <div id="ffnNeuronsChart" class="bulb-grid"></div>
              <div id="ffnBulbDetail" class="bulb-detail-bar"></div>
            </div>
          `}
        </div>

        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>Math Formula &middot; RMSNorm / Residual / SwiGLU</span>
            <span class="mono">+</span>
          </summary>
          <div class="deep-dive-content">
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
    this.app.markStageExplored(5);
    this.app.renderStageById(5);
  }

  selectSpikeBar(idx) {
    this.spikeBarIndex = Math.max(0, Math.min(7, parseInt(idx, 10) || 0));
    this.app.markStageExplored(5);
    const tag = document.getElementById("spikeBarTag");
    if (tag) tag.textContent = `d${this.spikeBarIndex}`;
    this.updateStage5Visuals();
  }

  setNormSpike(val) {
    this.normSpikeValue = parseFloat(val) || 0;
    this.app.markStageExplored(5);
    const slider = document.getElementById("normSpikeSlider");
    if (slider) slider.value = String(this.normSpikeValue);
    this.updateStage5Visuals();
  }

  blastRandomSpike() {
    const choices = [4.5, -4.5, 5.0, -3.5, 3.5, 0.0];
    const next = choices.find(v => Math.abs(v - this.normSpikeValue) > 1.2) || 4.5;
    this.spikeBarIndex = (this.spikeBarIndex + 1) % 8;
    const tag = document.getElementById("spikeBarTag");
    if (tag) tag.textContent = `d${this.spikeBarIndex}`;
    this.setNormSpike(next);
  }

  selectMemoryBulb(idx) {
    this.selectedBulbIndex = idx;
    this.app.markStageExplored(5);
    this.updateStage5Visuals();
  }

  setNormType(type) {
    this.normType = type;
    this.app.markStageExplored(5);
    this.app.renderStageById(5);
  }

  toggleSkip() {
    this.skipConnectionEnabled = !this.skipConnectionEnabled;
    this.app.markStageExplored(5);
    this.app.renderStageById(5);
  }

  setFFNArch(arch) {
    this.ffnArch = arch;
    this.app.markStageExplored(5);
    this.app.renderStageById(5);
  }

  updateStage5Visuals() {
    const hp = this.app.hyperparams;
    const tokens = this.app.tokens;
    const selectedIdx = Math.min(this.selectedTokenIndex, Math.max(0, tokens.length - 1));
    const tok = tokens[selectedIdx] || tokens[0];
    const rawVector = this.math.getTokenEmbedding(tok, hp.d_model);
    const targetIdx = Math.min(this.spikeBarIndex, rawVector.length - 1);
    const spikedVector = rawVector.map((v, i) => (i === targetIdx ? v + this.normSpikeValue : v));

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
      rmsReadout.textContent = `RMS ${beforeNormStats.rms.toFixed(2)} → ${afterNormCheck.rms.toFixed(2)}`;
    }

    const renderEqualizer = (elId, vec, maxScale, isBefore) => {
      const el = document.getElementById(elId);
      if (!el) return;
      const limitPct = Math.min(82, Math.round((2.0 / maxScale) * 100));
      el.innerHTML = `
        <div class="eq-limit-line" style="bottom:${limitPct}%;">
          <span>Limit</span>
        </div>
        <div class="eq-columns">
          ${vec.map((val, i) => {
            const hPct = Math.max(8, Math.min(100, Math.round((Math.abs(val) / maxScale) * 100)));
            const isSpiked = Math.abs(val) > 2.0;
            const isTarget = i === targetIdx;
            const barColor = isSpiked && isBefore ? "var(--rose)" : isBefore ? "var(--accent-primary)" : "var(--teal)";
            return `
              <button type="button" class="eq-col is-clickable ${isTarget ? "is-target" : ""}" onclick="pipelineStages.selectSpikeBar(${i})" title="Spike d${i}: ${val.toFixed(2)}">
                <span class="eq-bar-slot">
                  <span class="eq-bar-fill" style="height:${hPct}%; background:${barColor};"></span>
                </span>
                <span class="mono eq-bar-val tabular-nums">${val.toFixed(1)}</span>
                <span class="mono eq-bar-idx">d${i}</span>
              </button>
            `;
          }).join("")}
        </div>
      `;
    };

    const sharedScale = Math.max(2.6, ...spikedVector.map(Math.abs), ...normResult.output.map(Math.abs));
    renderEqualizer("normBeforeChart", spikedVector, sharedScale, true);
    renderEqualizer("normAfterChart", normResult.output, sharedScale, false);

    const skipEl = document.getElementById("skipStatusText");
    if (skipEl) {
      const pct = this.skipConnectionEnabled ? 100 : 28;
      skipEl.innerHTML = `
        <span class="mono tabular-nums signal-health-label ${this.skipConnectionEnabled ? "is-safe" : "is-danger"}">Signal ${pct}%</span>
        <span class="signal-health-track">
          <span class="signal-health-fill ${this.skipConnectionEnabled ? "is-safe" : "is-danger"}" style="width:${pct}%;"></span>
        </span>
      `;
    }

    const ffnInput = this.skipConnectionEnabled
      ? MathEngine.vectorAdd(rawVector, normResult.output)
      : normResult.output;
    const ffnResult = this.math.computeFFN({
      inputVector: ffnInput,
      d_model: hp.d_model,
      architecture: this.ffnArch
    });

    const neurons = (ffnResult.hidden || ffnResult.hiddenActivated || []).slice(0, 12);
    const maxN = Math.max(0.25, ...neurons.map(Math.abs));
    const factTags = ["Animals", "Speed", "Actions", "Colors", "Places", "Grammar", "Time", "Nature", "Objects", "Stories", "Tech", "Rhythm"];
    const neuronsEl = document.getElementById("ffnNeuronsChart");
    if (neuronsEl) {
      neuronsEl.innerHTML = neurons.map((n, i) => {
        const intensity = Math.min(1, Math.abs(n) / maxN);
        const pct = Math.round(intensity * 100);
        const isLit = intensity > 0.42;
        const isPicked = this.selectedBulbIndex === i;
        return `
          <button type="button" class="bulb-card ${isLit ? "is-lit" : ""} ${isPicked ? "is-picked" : ""}" onclick="pipelineStages.selectMemoryBulb(${i})" title="${factTags[i]}: ${n.toFixed(3)}">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" fill="${isLit ? "currentColor" : "none"}" fill-opacity="${isLit ? "0.28" : "0"}"/>
            </svg>
            <span class="bulb-name">${factTags[i]}</span>
            <span class="bulb-mini-bar" aria-hidden="true"><span style="width:${Math.max(8, pct)}%;"></span></span>
            <span class="mono tabular-nums bulb-pct">${pct}%</span>
          </button>
        `;
      }).join("");
    }
    const detailEl = document.getElementById("ffnBulbDetail");
    if (detailEl) {
      if (this.selectedBulbIndex >= 0 && this.selectedBulbIndex < neurons.length) {
        const val = neurons[this.selectedBulbIndex];
        const pct = Math.round(Math.min(1, Math.abs(val) / maxN) * 100);
        detailEl.innerHTML = `<strong class="mono">${factTags[this.selectedBulbIndex]}</strong> &middot; <span class="mono tabular-nums">${pct}%</span> &middot; ${pct > 42 ? "LIT" : "QUIET"}`;
      } else {
        detailEl.textContent = `Tap any bulb · ${ffnResult.d_ff} neurons (${ffnResult.architecture})`;
      }
    }
  }

  // ========================================================================
  // CHAPTER 6: 12 Thinking Floors (Visual Elevator Shaft + Live Word Race)
  // ========================================================================
  renderStage6(container) {
    container.innerHTML = `
      <div class="stage-card">
        <div class="stage-header-compact stage-header-row">
          <div>
            <div class="stage-kicker">06 &middot; Layer Stack &amp; Logits (12 Floors)</div>
            <h2 class="stage-title">Refine logits across 12 layers</h2>
          </div>
          <span id="layerReadout" class="stage-live-pill mono tabular-nums">Layer ${this.selectedLayer} / 12</span>
        </div>

        <div class="stage-visual-container">
          <div class="stage-toolbar-row">
            <span class="section-label">Layer Elevator</span>
            <div class="inline-controls">
              <button type="button" class="btn btn-sm btn-primary" onclick="pipelineStages.rideElevatorAnimation()">
                ${this._elevatorTimer ? "Stop" : "Run L1 → L12"}
              </button>
              <button type="button" class="preset-btn" onclick="pipelineStages.setSelectedLayer(1)">L1</button>
              <button type="button" class="preset-btn" onclick="pipelineStages.setSelectedLayer(6)">L6</button>
              <button type="button" class="preset-btn" onclick="pipelineStages.setSelectedLayer(12)">L12</button>
            </div>
          </div>

          <div class="elevator-stage-grid">
            <!-- Left: Visual 12-Story Building Elevator with Sliding Car Rail -->
            <div class="inset-panel elevator-building">
              <div class="elevator-roof">Output Logits</div>
              <div class="elevator-body-row">
                <div class="elevator-rail" aria-hidden="true">
                  <div id="elevatorCarMarker" class="elevator-car-marker" style="top:${Math.round(((12 - this.selectedLayer) / 11) * 90)}%;"></div>
                </div>
                <div class="elevator-shaft" id="layerTowerButtons" role="group" aria-label="Choose transformer layer">
                  ${Array.from({ length: 12 }, (_, idx) => {
                    const l = 12 - idx;
                    const zone = l >= 9 ? "Semantics" : l >= 5 ? "Context" : "Syntax";
                    return `
                      <button type="button" class="elevator-floor-btn ${l === this.selectedLayer ? "is-active" : l < this.selectedLayer ? "is-passed" : ""}" data-layer="${l}" onclick="pipelineStages.setSelectedLayer(${l})">
                        <span class="mono floor-num">L${l}</span>
                        <span class="floor-zone">${zone}</span>
                        <span class="elevator-car-indicator" aria-hidden="true">${l === this.selectedLayer ? "●" : ""}</span>
                      </button>
                    `;
                  }).join("")}
                </div>
              </div>
              <input id="layerDepthSlider" type="range" min="1" max="12" step="1" value="${this.selectedLayer}" oninput="pipelineStages.setSelectedLayer(this.value)" aria-label="Transformer layer slider" style="margin-top:10px;">
            </div>

            <!-- Right: Visual Next-Word Race -->
            <div class="inset-panel race-panel">
              <div class="race-header-row">
                <span class="section-label">Top 6 Logits</span>
                <span id="layerZoneBadge" class="race-zone-tag"></span>
              </div>
              <div id="layerRoleReadout" class="clarity-meter-box"></div>
              <div id="logitsLeaderboardBody" class="race-lanes"></div>
            </div>
          </div>
        </div>

        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>Math Formula &middot; Stacked Layers &amp; Logits</span>
            <span class="mono">+</span>
          </summary>
          <div class="deep-dive-content">
            <pre class="formula-block">h^(l) = Floor_l(h^(l-1))   &middot;   logits z = RMSNorm(h^(L)) &middot; W_U</pre>
          </div>
        </details>
      </div>
    `;

    this.updateStage6Visuals();
  }

  setSelectedLayer(l) {
    this.selectedLayer = parseInt(l, 10) || 1;
    this.app.markStageExplored(6);
    const slider = document.getElementById("layerDepthSlider");
    if (slider) slider.value = String(this.selectedLayer);
    this.updateStage6Visuals();
  }

  rideElevatorAnimation() {
    this.app.markStageExplored(6);
    if (this._elevatorTimer) {
      clearInterval(this._elevatorTimer);
      this._elevatorTimer = null;
      this.app.renderStageById(6);
      return;
    }
    this.selectedLayer = 1;
    this.app.renderStageById(6);
    this._elevatorTimer = setInterval(() => {
      if (this.selectedLayer >= 12) {
        clearInterval(this._elevatorTimer);
        this._elevatorTimer = null;
        this.app.renderStageById(6);
        return;
      }
      this.selectedLayer += 1;
      this.setSelectedLayer(this.selectedLayer);
    }, 320);
  }

  updateStage6Visuals() {
    const hp = this.app.hyperparams;
    const tokens = this.app.tokens;
    const layer = this.selectedLayer;

    const readout = document.getElementById("layerReadout");
    if (readout) readout.textContent = `Layer ${layer} / 12`;

    const carMarker = document.getElementById("elevatorCarMarker");
    if (carMarker) {
      carMarker.style.top = `${Math.round(((12 - layer) / 11) * 90)}%`;
    }

    const tower = document.getElementById("layerTowerButtons");
    if (tower) {
      Array.from(tower.querySelectorAll("[data-layer]")).forEach(btn => {
        const l = parseInt(btn.getAttribute("data-layer"), 10);
        btn.classList.toggle("is-active", l === layer);
        btn.classList.toggle("is-passed", l < layer);
        const ind = btn.querySelector(".elevator-car-indicator");
        if (ind) ind.textContent = l === layer ? "●" : "";
      });
    }

    const sortedLogits = this.math.computeLayerSortedLogits(tokens, layer, VOCABULARY_LIST, hp.d_model).slice(0, 6);
    const topWord = sortedLogits[0];
    const zoneBadge = document.getElementById("layerZoneBadge");
    if (zoneBadge) {
      zoneBadge.textContent = layer <= 4 ? "Fuzzy" : layer <= 8 ? "Focusing" : "Sharp";
    }

    const clarityPct = Math.round((layer / 12) * 100);
    const roleReadout = document.getElementById("layerRoleReadout");
    if (roleReadout) {
      roleReadout.innerHTML = `
        <div class="clarity-meta">
          <span class="mono">Leader: <strong>"${this.esc(topWord?.token || "")}"</strong></span>
          <span class="mono tabular-nums" style="color:var(--teal);">${clarityPct}% clarity</span>
        </div>
        <div class="clarity-track" aria-hidden="true">
          <div class="clarity-fill" style="width:${clarityPct}%;"></div>
        </div>
      `;
    }

    const maxLogit = Math.max(1, ...sortedLogits.map(c => c.rawLogit));
    const minLogit = Math.min(0, ...sortedLogits.map(c => c.rawLogit));
    const span = Math.max(0.5, maxLogit - minLogit);

    const body = document.getElementById("logitsLeaderboardBody");
    if (body) {
      body.innerHTML = sortedLogits.map((c, idx) => {
        const barPct = Math.max(10, Math.round(((c.rawLogit - minLogit) / span) * 100));
        const encodedWord = encodeURIComponent(c.token);
        return `
          <button type="button" class="race-lane is-clickable ${idx === 0 ? "is-leader" : ""}" onclick="app.appendCustomWord(decodeURIComponent('${encodedWord}'))" title="Add '${this.esc(c.token)}' to prompt">
            <span class="race-lane-meta">
              <span class="mono tabular-nums race-rank">#${idx + 1}</span>
              <span class="mono race-word">"${this.esc(c.token)}"</span>
              <span class="race-cluster">${this.esc(c.cluster)}</span>
              <span class="mono tabular-nums race-score">${c.rawLogit.toFixed(2)}</span>
            </span>
            <span class="race-track">
              <span class="race-bar" style="display:block; width:${barPct}%; background:${idx === 0 ? "var(--teal)" : "var(--accent-primary)"};"></span>
            </span>
          </button>
        `;
      }).join("");
    }
  }

  // ========================================================================
  // CHAPTER 7: Real Interactive SVG Prize Wheel + Word Picker
  // ========================================================================
  renderStage7(container) {
    const hp = this.app.hyperparams;
    const lastMeta = this.app.lastSampledMeta;

    container.innerHTML = `
      <div class="stage-card">
        <div class="stage-header-compact stage-header-row">
          <div>
            <div class="stage-kicker">07 &middot; Softmax &amp; Sampling (Prize Wheel)</div>
            <h2 class="stage-title">Spin probabilities for next token</h2>
          </div>
          ${lastMeta ? `
            <span id="stage7LastPickedBanner" class="stage-live-pill is-teal mono">
              + "${this.esc(lastMeta.word)}"${lastMeta.probPct ? ` · ${lastMeta.probPct}%` : ""}
            </span>
          ` : `<span class="stage-live-pill mono">Softmax Wheel</span>`}
        </div>

        <div class="stage-visual-container">
          <!-- Live Fill-in-the-blank Sentence -->
          <div class="sentence-preview-box" id="stage7SentencePreview"></div>

          <!-- Two-Column Wheel + Clickable Slices -->
          <div class="wheel-stage-split">
            <div class="inset-panel wheel-panel">
              <div class="wheel-visual-stage">
                <div class="wheel-pointer" aria-hidden="true"></div>
                <svg id="prizeWheelSvg" class="prize-wheel-svg" viewBox="0 0 280 280" role="img" aria-label="Interactive Softmax probability prize wheel"></svg>
                <button type="button" class="wheel-spin-hub" onclick="pipelineStages.spinWheelAndAppend()" aria-label="Spin prize wheel">SPIN</button>
              </div>
              <div class="wheel-cta-row">
                <button type="button" id="rollSampleBtn" class="btn btn-primary" onclick="pipelineStages.spinWheelAndAppend()">
                  ${this.isWheelSpinning ? "Spinning..." : "Sample Token"}
                </button>
                <button type="button" class="btn btn-secondary" onclick="app.toggleAutoPlay()">
                  ${this.app.isAutoPlaying ? "Pause" : "Auto-Write"}
                </button>
              </div>
            </div>

            <div class="inset-panel wheel-slices-panel">
              <div class="stage-toolbar-row" style="margin-bottom:10px;">
                <span class="section-label">Softmax Probabilities (tap to add)</span>
                <span id="activeSurvivorCount" class="mono tabular-nums" style="font-size:12px; color:var(--teal); font-weight:600;"></span>
              </div>
              <div id="candBarsContainer" class="cand-bars-container"></div>
            </div>
          </div>

          <!-- Sampling Controls -->
          <div class="inset-panel">
            <div class="stage-toolbar-row" style="margin-bottom:12px;">
              <span class="section-label">Sampling Controls</span>
              <div class="presets-list">
                <button type="button" class="preset-btn" onclick="pipelineStages.applySamplingPreset(0.15, 3, 0.7)">Safe</button>
                <button type="button" class="preset-btn" onclick="pipelineStages.applySamplingPreset(0.8, 10, 0.9)">Balanced</button>
                <button type="button" class="preset-btn" onclick="pipelineStages.applySamplingPreset(1.35, 18, 0.98)">Wild</button>
              </div>
            </div>

            <div class="sampling-sliders-grid">
              <div class="slider-block">
                <div class="slider-head">
                  <label for="tempSlider">Temperature</label>
                  <span id="tempReadout" class="mono tabular-nums">${hp.temperature.toFixed(2)}</span>
                </div>
                <input id="tempSlider" type="range" min="0.00" max="1.50" step="0.05" value="${hp.temperature}" oninput="pipelineStages.updateSamplingSlider('temperature', this.value)">
                <div id="tempHint" class="slider-hint"></div>
              </div>

              <div class="slider-block">
                <div class="slider-head">
                  <label for="topKSlider">Top-K</label>
                  <span id="topKReadout" class="mono tabular-nums">${hp.top_k}</span>
                </div>
                <input id="topKSlider" type="range" min="1" max="20" step="1" value="${hp.top_k}" oninput="pipelineStages.updateSamplingSlider('top_k', this.value)">
                <div class="slider-hint">Keep top K tokens</div>
              </div>

              <div class="slider-block">
                <div class="slider-head">
                  <label for="topPSlider">Top-P (Nucleus)</label>
                  <span id="topPReadout" class="mono tabular-nums">${Math.round(hp.top_p * 100)}%</span>
                </div>
                <input id="topPSlider" type="range" min="0.10" max="1.00" step="0.05" value="${hp.top_p}" oninput="pipelineStages.updateSamplingSlider('top_p', this.value)">
                <div class="slider-hint">Trim low-prob tail</div>
              </div>
            </div>
          </div>

          <div class="stage-bottom-links">
            <button type="button" class="btn btn-ghost" onclick="app.resetPrompt()">Reset</button>
            <a href="#top" class="btn btn-ghost" style="text-decoration:none;">Top &uarr;</a>
          </div>
        </div>

        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>Math Formula &middot; Softmax / Top-K / Top-P</span>
            <span class="mono">+</span>
          </summary>
          <div class="deep-dive-content">
            <pre class="formula-block">P(w_i) = exp(z_i / T) / &sum;_j exp(z_j / T)
Top-K keeps top K &middot; Top-P keeps smallest set &ge; P</pre>
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

  spinWheelAndAppend() {
    if (this.isWheelSpinning) return;
    const hp = this.app.hyperparams;
    const tokens = this.app.tokens;
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

    if (!sampleResult || !sampleResult.sampledToken) return;

    const winner = sampleResult.sampledToken;
    const slices = buildPrizeWheelSlices(sampleResult.candidates || [], 7);
    const matchSlice = slices.find(s => !s.isOther && s.token === winner.token) || slices[slices.length - 1];
    const targetMid = matchSlice ? matchSlice.midAngle : 0;

    // Spin 2 full rotations + land winner slice under top pointer (0 deg)
    const desiredMod = (360 - targetMid + 360) % 360;
    const currentMod = ((this.wheelRotationDeg % 360) + 360) % 360;
    const delta = ((desiredMod - currentMod) + 360) % 360;
    this.wheelRotationDeg += 720 + delta;
    this.isWheelSpinning = true;

    const wheelEl = document.getElementById("prizeWheelSvg");
    const pointerEl = document.querySelector(".wheel-pointer");
    const spinBtn = document.getElementById("rollSampleBtn");
    if (spinBtn) spinBtn.textContent = "Spinning...";
    if (pointerEl) pointerEl.classList.add("is-ticking");
    if (wheelEl) {
      wheelEl.style.transition = "transform 0.72s cubic-bezier(0.16, 1, 0.3, 1)";
      wheelEl.style.transform = `rotate(${this.wheelRotationDeg.toFixed(1)}deg)`;
    }

    setTimeout(() => {
      this.isWheelSpinning = false;
      if (pointerEl) pointerEl.classList.remove("is-ticking");
      this.app.lastSampledWord = winner.token;
      const pct = Math.round((winner.normalizedProb || winner.rawProb || 0) * 100);
      this.app.lastSampledMeta = {
        word: winner.token,
        probPct: pct,
        survivors: sampleResult.activeCount,
        temperature: hp.temperature,
        manual: false
      };
      this.app.appendCustomWord(winner.token, true);
    }, 760);
  }

  renderPrizeWheelSvg(candidates) {
    const svg = document.getElementById("prizeWheelSvg");
    if (!svg) return;

    const slices = buildPrizeWheelSlices(candidates, 7);
    const cx = 140;
    const cy = 140;
    const r = 126;

    const polarToXY = (deg, rad) => {
      const a = ((deg - 90) * Math.PI) / 180;
      return {
        x: cx + rad * Math.cos(a),
        y: cy + rad * Math.sin(a)
      };
    };

    const parts = [];
    slices.forEach(slice => {
      const sweep = slice.endAngle - slice.startAngle;
      if (sweep >= 359.5) {
        parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${slice.color}" stroke="var(--bg-surface)" stroke-width="2"/>`);
      } else {
        const p1 = polarToXY(slice.startAngle, r);
        const p2 = polarToXY(slice.endAngle, r);
        const largeArc = sweep > 180 ? 1 : 0;
        const d = `M ${cx} ${cy} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`;
        parts.push(`<path d="${d}" fill="${slice.color}" stroke="var(--bg-surface)" stroke-width="2"/>`);
      }

      if (sweep >= 22) {
        const labelPos = polarToXY(slice.midAngle, r * 0.60);
        const pct = Math.round(slice.prob * 100);
        const textAngle = slice.midAngle > 180 ? slice.midAngle + 90 : slice.midAngle - 90;
        const shortWord = slice.token.length > 7 && !slice.isOther ? slice.token.slice(0, 6) + "…" : slice.token;
        const labelColor = (slice.color === "#EAB308" || slice.color === "#84CC16") ? "#181816" : "#FFFFFF";
        parts.push(`
          <g transform="translate(${labelPos.x.toFixed(1)}, ${labelPos.y.toFixed(1)}) rotate(${textAngle.toFixed(1)})">
            <text text-anchor="middle" dominant-baseline="central" fill="${labelColor}" font-size="${sweep > 48 ? 11.5 : 10}" font-weight="700" font-family="JetBrains Mono, monospace">
              ${this.esc(shortWord)} ${pct}%
            </text>
          </g>
        `);
      }
    });

    // Subtle center axle backing behind the stationary HTML SPIN button
    parts.push(`<circle cx="${cx}" cy="${cy}" r="22" fill="var(--bg-surface)" stroke="var(--border-strong)" stroke-width="2.5"/>`);

    svg.innerHTML = parts.join("");
    svg.style.transition = "none";
    svg.style.transform = `rotate(${this.wheelRotationDeg.toFixed(1)}deg)`;
  }

  updateStage7Visuals() {
    const hp = this.app.hyperparams;
    const tokens = this.app.tokens;

    const tempReadout = document.getElementById("tempReadout");
    if (tempReadout) tempReadout.textContent = hp.temperature.toFixed(2);
    const tempHint = document.getElementById("tempHint");
    if (tempHint) {
      tempHint.textContent = hp.temperature <= 0.05
        ? "Locked #1"
        : hp.temperature < 0.45
          ? "Safe"
          : hp.temperature > 1.0
            ? "Wild"
            : "Balanced";
    }
    const topKReadout = document.getElementById("topKReadout");
    if (topKReadout) topKReadout.textContent = `${hp.top_k}`;
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

    this.renderPrizeWheelSvg(sampleResult.candidates || []);

    const survivorEl = document.getElementById("activeSurvivorCount");
    if (survivorEl) {
      survivorEl.textContent = `${sampleResult.activeCount} active`;
    }

    const candidates = (sampleResult.candidates || []).slice(0, 8);
    const topActive = candidates.find(c => c.status === "active") || candidates[0];
    const previewEl = document.getElementById("stage7SentencePreview");
    if (previewEl) {
      const topPct = topActive ? Math.round((topActive.normalizedProb || topActive.rawProb) * 100) : 0;
      previewEl.innerHTML = `
        <span class="preview-sentence">${this.esc(this.app.currentPrompt)}</span>
        <span class="sentence-preview-blank">${topActive ? `"${this.esc(topActive.token)}" ${topPct}%` : "___"}</span>
      `;
    }

    const sliceColors = (typeof WHEEL_SLICE_COLORS !== "undefined" && WHEEL_SLICE_COLORS) || ["#F97316", "#10B981", "#EAB308", "#0EA5E9", "#EF4444", "#84CC16", "#D97706", "#78716C"];
    const container = document.getElementById("candBarsContainer");
    if (container) {
      let activeColorIdx = 0;
      container.innerHTML = candidates.map(c => {
        const isCut = c.status !== "active";
        const displayPct = isCut ? Math.round(c.rawProb * 100) : Math.round((c.normalizedProb || c.rawProb) * 100);
        const isWinner = !isCut && this.app.lastSampledWord && this.app.lastSampledWord === c.token;
        const encodedWord = encodeURIComponent(c.token);
        const barColor = isCut
          ? "var(--border-strong)"
          : activeColorIdx < 7
            ? sliceColors[activeColorIdx++]
            : sliceColors[7];
        return `
          <button
            type="button"
            class="cand-bar-row ${isCut ? "cut" : ""} ${isWinner ? "is-winner" : ""}"
            ${isCut ? "disabled" : `onclick="app.appendCustomWord(decodeURIComponent('${encodedWord}'))"`}
          >
            <span class="cand-word-label">
              <span class="cand-swatch" style="background:${barColor};"></span>
              "${this.esc(c.token)}"
            </span>
            <span class="cand-bar-fill-track">
              <span class="cand-bar-fill" style="display:block; width:${Math.max(3, displayPct)}%; background:${barColor}; opacity:${isCut ? 0.35 : 1};"></span>
            </span>
            <span class="cand-prob-label tabular-nums">${isCut ? "0%" : `${displayPct}%`}</span>
            ${isCut ? `<span class="cand-cut-reason">${this.esc(c.strikeReason)}</span>` : `<span class="cand-add-hint">+ Add</span>`}
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
