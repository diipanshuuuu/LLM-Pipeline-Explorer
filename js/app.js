/**
 * Application Orchestrator — Visual Scrollytelling Edition
 * Fixes scroll-spy flicker with strictly monotonic geometry tracking,
 * manages dark-first dual theming, and keeps all 7 visual chapters live in sync.
 */

const DEFAULT_PROMPT = "The quick brown fox jumps over the";
const THEME_STORAGE_KEY = "unprompted-theme";
const LEVEL_STORAGE_KEY = "unprompted-level";

class App {
  constructor() {
    window.app = this;
    this.math = new MathEngine();
    this.currentPrompt = DEFAULT_PROMPT;
    this.tokens = [];
    this.activeStage = 1;
    this.theme = "dark";
    this.experienceLevel = "beginner";
    this.isAutoPlaying = false;
    this.autoPlayInterval = null;
    this.lastSampledWord = null;
    this.lastSampledMeta = null;

    // Monotonic scroll-spy state
    this._scrollRafId = 0;
    this._scrollLockTarget = null;
    this._scrollLockTimer = null;
    this._heroPulseStep = 0;
    this._heroPulseTimers = [];
    this.spotlightExpanded = false;
    this.exploredStages = new Set();
    this._toastTimer = null;

    this.hyperparams = {
      d_model: 8,
      n_heads: 2,
      n_layers: 4,
      temperature: 0.8,
      top_k: 10,
      top_p: 0.9,
      repetition_penalty: 1.15
    };

    this.stageList = [
      { id: 1, title: "Tokenization", sub: "Word Bricks · BPE" },
      { id: 2, title: "Embeddings", sub: "3D Vector Map" },
      { id: 3, title: "Position (RoPE)", sub: "Seat Clocks" },
      { id: 4, title: "Self-Attention", sub: "Clue Detective" },
      { id: 5, title: "Transformer Block", sub: "Norm · Skip · FFN" },
      { id: 6, title: "Layers & Logits", sub: "12 Thinking Floors" },
      { id: 7, title: "Sampling", sub: "Softmax Wheel" },
      { id: 8, title: "Perplexity", sub: "DistilGPT-2 Lab" }
    ];

    this.stagesRenderer = new PipelineStages(this);
    window.pipelineStages = this.stagesRenderer;
    this.perplexityExplorer = typeof PerplexityExplorer !== "undefined" ? new PerplexityExplorer(this) : null;
    window.perplexityExplorer = this.perplexityExplorer;

    this.init();
  }

  init() {
    this.initTheme();
    this.initExperienceLevel();
    this.bindEvents();
    this.updateTokens();
    // Default spotlight to the last word so Detective clue strings are rich immediately
    this.stagesRenderer.selectedTokenIndex = Math.max(0, this.tokens.length - 1);
    this.renderLiveTokenBar();
    this.renderSidebar();
    this.renderAllStages();
    this.updateHeroVisualPipeline();
    this.updateStoryConnectors();
    this.updateExploredHUD();
    this.updateVRAMCalculator();
    this.setupScrollSpy();

    window.on3DTokenSelected = (token, idx) => {
      this.stagesRenderer.selectedTokenIndex = idx;
      this.renderLiveTokenBar();
      this.stagesRenderer.updateStage2Inspector();
      this.renderStageById(1);
      this.renderStageById(4);
      this.renderStageById(5);
      this.updateHeroVisualPipeline();
      this.updateStoryConnectors();
    };
  }

  initTheme() {
    let initial = "dark";
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "light" || saved === "dark") {
        initial = saved;
      }
    } catch (e) {
      initial = "dark";
    }
    this.applyTheme(initial, false);
  }

  initExperienceLevel() {
    let initial = "beginner";
    try {
      const saved = localStorage.getItem(LEVEL_STORAGE_KEY);
      initial = typeof normalizeExperienceLevel === "function"
        ? normalizeExperienceLevel(saved)
        : (saved === "deep" ? "deep" : "beginner");
    } catch (e) {
      initial = "beginner";
    }
    this.applyExperienceLevel(initial, false);
  }

  setExperienceLevel(level) {
    const normalized = typeof normalizeExperienceLevel === "function"
      ? normalizeExperienceLevel(level)
      : (level === "deep" ? "deep" : "beginner");
    this.applyExperienceLevel(normalized, true);
    this.showMicroToast(
      normalized === "deep" ? "Deep Lab mode: full controls & math unlocked" : "Beginner mode: clean guided view",
      normalized === "deep" ? "accent" : "teal"
    );
  }

  applyExperienceLevel(level, persist = true) {
    this.experienceLevel = level;
    document.documentElement.setAttribute("data-level", level);

    if (persist) {
      try {
        localStorage.setItem(LEVEL_STORAGE_KEY, level);
      } catch (e) {
        // Ignore storage restrictions
      }
    }

    const begBtn = document.getElementById("levelBeginnerBtn");
    const deepBtn = document.getElementById("levelDeepBtn");
    if (begBtn) {
      begBtn.classList.toggle("is-active", level === "beginner");
      begBtn.setAttribute("aria-pressed", String(level === "beginner"));
    }
    if (deepBtn) {
      deepBtn.classList.toggle("is-active", level === "deep");
      deepBtn.setAttribute("aria-pressed", String(level === "deep"));
    }

    if (this.tokens && this.tokens.length) {
      this.updateHeroVisualPipeline();
      this.updateStoryConnectors();
      this.renderAllStages();
    }
  }

  setTheme(theme) {
    const normalized = theme === "light" ? "light" : "dark";
    this.applyTheme(normalized, true);
  }

  toggleTheme() {
    this.setTheme(this.theme === "dark" ? "light" : "dark");
  }

  applyTheme(theme, persist = true) {
    this.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");

    if (persist) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch (e) {
        // Ignore storage restrictions
      }
    }

    const darkBtn = document.getElementById("themeDarkBtn");
    const lightBtn = document.getElementById("themeLightBtn");
    if (darkBtn) {
      darkBtn.classList.toggle("is-active", theme === "dark");
      darkBtn.setAttribute("aria-pressed", String(theme === "dark"));
    }
    if (lightBtn) {
      lightBtn.classList.toggle("is-active", theme === "light");
      lightBtn.setAttribute("aria-pressed", String(theme === "light"));
    }

    if (window.vectorView && typeof window.vectorView.setTheme === "function") {
      window.vectorView.setTheme(theme);
    }
    if (this.stagesRenderer) {
      if (typeof this.stagesRenderer.drawStage3Canvas === "function") {
        this.stagesRenderer.drawStage3Canvas();
      }
      if (typeof this.stagesRenderer.realignStage4Arcs === "function") {
        this.stagesRenderer.realignStage4Arcs();
      }
      if (typeof this.stagesRenderer.updateStage2Inspector === "function") {
        this.stagesRenderer.updateStage2Inspector();
      }
    }
  }

  bindEvents() {
    const input = document.getElementById("promptInput");
    if (input) {
      input.value = this.currentPrompt;
      input.addEventListener("input", (e) => {
        this.currentPrompt = e.target.value;
        this.lastSampledWord = null;
        this.lastSampledMeta = null;
        this.handlePromptChange();
      });
    }

    window.addEventListener("resize", () => {
      if (this.stagesRenderer && typeof this.stagesRenderer.realignStage4Arcs === "function") {
        this.stagesRenderer.realignStage4Arcs();
      }
      this.scheduleScrollSpySync();
    });
  }

  /**
   * Strictly monotonic scroll-spy using section bounding rects and a fixed reading anchor.
   * Prevents the IntersectionObserver bug where a leaving upper chapter momentarily
   * steals focus back during downward scrolling.
   */
  setupScrollSpy() {
    const releaseLockOnManualScroll = () => {
      if (this._scrollLockTarget !== null) {
        this._scrollLockTarget = null;
        if (this._scrollLockTimer) {
          clearTimeout(this._scrollLockTimer);
          this._scrollLockTimer = null;
        }
      }
    };

    window.addEventListener("wheel", releaseLockOnManualScroll, { passive: true });
    window.addEventListener("touchstart", releaseLockOnManualScroll, { passive: true });
    window.addEventListener("keydown", (e) => {
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Space", "Home", "End"].includes(e.code)) {
        releaseLockOnManualScroll();
      }
    }, { passive: true });

    window.addEventListener("scroll", () => {
      this.scheduleScrollSpySync();
    }, { passive: true });

    this.syncScrollSpyNow();
  }

  scheduleScrollSpySync() {
    if (this._scrollRafId) return;
    this._scrollRafId = requestAnimationFrame(() => {
      this._scrollRafId = 0;
      this.syncScrollSpyNow();
    });
  }

  syncScrollSpyNow() {
    const sections = Array.from(document.querySelectorAll(".chapter-section[data-stage]"));
    if (!sections.length) return;

    const metrics = sections.map(sec => ({
      stage: parseInt(sec.getAttribute("data-stage"), 10),
      top: sec.getBoundingClientRect().top
    }));

    const viewportH = window.innerHeight || document.documentElement.clientHeight || 900;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const docH = Math.max(
      document.body ? document.body.scrollHeight : 0,
      document.documentElement ? document.documentElement.scrollHeight : 0
    );

    const computedStage = computeActiveStageFromLayout(metrics, viewportH, scrollY, docH, 0.28);

    // If user clicked a sidebar chapter, keep that chapter highlighted until smooth scroll arrives
    if (this._scrollLockTarget !== null) {
      const targetMetric = metrics.find(m => m.stage === this._scrollLockTarget);
      const arrived = computedStage === this._scrollLockTarget ||
        (targetMetric && Math.abs(targetMetric.top - 84) < 28);
      if (arrived) {
        this._scrollLockTarget = null;
        if (this._scrollLockTimer) {
          clearTimeout(this._scrollLockTimer);
          this._scrollLockTimer = null;
        }
      } else {
        return;
      }
    }

    if (computedStage !== this.activeStage) {
      this.activeStage = computedStage;
      this.updateSidebarActiveState();
    }
  }

  setPrompt(text) {
    this.currentPrompt = text;
    this.lastSampledWord = null;
    this.lastSampledMeta = null;
    const input = document.getElementById("promptInput");
    if (input) input.value = text;
    this.updateTokens();
    this.stagesRenderer.selectedTokenIndex = Math.max(0, this.tokens.length - 1);
    this.renderLiveTokenBar();
    this.renderAllStages();
    this.updateHeroVisualPipeline();
    this.updateStoryConnectors();
    this.updateVRAMCalculator();
  }

  resetPrompt() {
    if (this.isAutoPlaying) {
      this.toggleAutoPlay();
    }
    this.setPrompt(DEFAULT_PROMPT);
  }

  handlePromptChange() {
    this.updateTokens();
    if (this.stagesRenderer.selectedTokenIndex >= this.tokens.length) {
      this.stagesRenderer.selectedTokenIndex = Math.max(0, this.tokens.length - 1);
    }
    this.renderLiveTokenBar();
    this.renderAllStages();
    this.updateHeroVisualPipeline();
    this.updateStoryConnectors();
    this.updateVRAMCalculator();
  }

  updateTokens() {
    this.tokens = tokenizeBPE(this.currentPrompt);
    if (this.tokens.length === 0) {
      this.tokens = [formatToken("...", 0, [0x2e], "punct", [0, 0, 0])];
    }
    const badge = document.getElementById("tokenCountBadge");
    if (badge) {
      const charCount = (this.currentPrompt || "").length;
      badge.textContent = `${this.tokens.length} ${this.tokens.length === 1 ? "token" : "tokens"} · ${charCount} chars`;
    }
  }

  markStageExplored(stageNum) {
    const n = parseInt(stageNum, 10);
    if (!n || n < 1 || n > this.stageList.length) return;
    if (!this.exploredStages.has(n)) {
      this.exploredStages.add(n);
      this.updateExploredHUD();
    }
  }

  updateExploredHUD() {
    const total = this.stageList.length;
    const textEl = document.getElementById("sidebarExploredText");
    if (textEl) {
      textEl.textContent = `${this.exploredStages.size} / ${total}`;
    }
    const dotsEl = document.getElementById("sidebarExploredDots");
    if (dotsEl) {
      dotsEl.innerHTML = this.stageList.map(st => `
        <span class="explored-dot ${this.exploredStages.has(st.id) ? "is-done" : ""}" title="Stage ${st.id}: ${st.title}"></span>
      `).join("");
    }
  }

  showMicroToast(message, tone = "teal") {
    const toast = document.getElementById("microToast");
    if (!toast) return;
    toast.className = `micro-toast is-${tone} is-visible`;
    toast.textContent = message;
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 1800);
  }

  stepSpotlightToken(delta) {
    if (!this.tokens.length || !window.pipelineStages) return;
    const current = Math.min(this.stagesRenderer.selectedTokenIndex, this.tokens.length - 1);
    const nextIdx = Math.max(0, Math.min(this.tokens.length - 1, current + delta));
    window.pipelineStages.selectToken(nextIdx);
  }

  toggleSpotlightExpanded() {
    this.spotlightExpanded = !this.spotlightExpanded;
    this.renderLiveTokenBar();
  }

  renderLiveTokenBar() {
    const bar = document.getElementById("liveTokenBar");
    if (!bar) return;

    const total = this.tokens.length;
    const selectedIdx = Math.min(this.stagesRenderer.selectedTokenIndex, Math.max(0, total - 1));
    const COMPACT_THRESHOLD = 9;

    if (total <= COMPACT_THRESHOLD) {
      this.spotlightExpanded = false;
    }

    const isLong = total > COMPACT_THRESHOLD;
    const useWindow = isLong && !this.spotlightExpanded && typeof computeSpotlightWindow === "function";
    const win = useWindow
      ? computeSpotlightWindow(total, selectedIdx, 7)
      : {
          isCollapsed: false,
          indices: this.tokens.map((_, i) => i),
          hiddenBefore: 0,
          hiddenAfter: 0
        };

    const renderChip = (idx) => {
      const t = this.tokens[idx];
      if (!t) return "";
      return `
        <button
          type="button"
          class="live-token-chip ${idx === selectedIdx ? "is-selected" : ""}"
          onclick="if(window.pipelineStages) window.pipelineStages.selectToken(${idx})"
          title="Spotlight word #${idx + 1} (${this.escapeHtml(t.text)})"
        >
          <span class="chip-idx">${idx + 1}</span>
          <span>${this.escapeHtml(t.text)}</span>
        </button>
      `;
    };

    bar.classList.toggle("is-expanded", isLong && this.spotlightExpanded);

    bar.innerHTML = `
      <div class="live-token-controls">
        <span class="live-token-prefix">Spotlight word:</span>
        ${isLong ? `
          <div class="spotlight-nav-group" role="group" aria-label="Step through spotlight words">
            <button
              type="button"
              class="spotlight-nav-btn"
              onclick="if(window.app) window.app.stepSpotlightToken(-1)"
              ${selectedIdx <= 0 ? "disabled" : ""}
              aria-label="Previous spotlight word"
              title="Previous word"
            >&lsaquo;</button>
            <span class="spotlight-counter mono tabular-nums">${selectedIdx + 1}/${total}</span>
            <button
              type="button"
              class="spotlight-nav-btn"
              onclick="if(window.app) window.app.stepSpotlightToken(1)"
              ${selectedIdx >= total - 1 ? "disabled" : ""}
              aria-label="Next spotlight word"
              title="Next word"
            >&rsaquo;</button>
          </div>
        ` : ""}
      </div>

      <div class="live-token-rail ${isLong && this.spotlightExpanded ? "is-expanded" : ""}">
        ${win.hiddenBefore > 0 ? `
          <button
            type="button"
            class="live-token-ellipsis"
            onclick="if(window.app) window.app.stepSpotlightToken(-5)"
            title="Show ${win.hiddenBefore} earlier ${win.hiddenBefore === 1 ? "word" : "words"}"
          >&laquo; +${win.hiddenBefore}</button>
        ` : ""}
        ${win.indices.map(renderChip).join("")}
        ${win.hiddenAfter > 0 ? `
          <button
            type="button"
            class="live-token-ellipsis"
            onclick="if(window.app) window.app.stepSpotlightToken(5)"
            title="Show ${win.hiddenAfter} later ${win.hiddenAfter === 1 ? "word" : "words"}"
          >+${win.hiddenAfter} &raquo;</button>
        ` : ""}
      </div>

      ${isLong ? `
        <button
          type="button"
          class="spotlight-toggle-btn"
          onclick="if(window.app) window.app.toggleSpotlightExpanded()"
          aria-expanded="${this.spotlightExpanded ? "true" : "false"}"
        >${this.spotlightExpanded ? "Compact" : `All ${total}`}</button>
      ` : ""}
    `;
  }

  runHeroPulseDemo() {
    this._heroPulseTimers.forEach(t => clearTimeout(t));
    this._heroPulseTimers = [];
    const btn = document.getElementById("heroPulseBtn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="mono">Thinking...</span>`;
    }

    [1, 2, 3, 4].forEach((step, idx) => {
      const timer = setTimeout(() => {
        this._heroPulseStep = step;
        this.highlightHeroPulseStep(step);
      }, idx * 420);
      this._heroPulseTimers.push(timer);
    });

    const finishTimer = setTimeout(() => {
      this._heroPulseStep = 0;
      this.sampleAndAppendToken();
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6,4 20,12 6,20"/></svg><span>Watch It Think</span>`;
      }
      this.highlightHeroPulseStep(0);
    }, 1780);
    this._heroPulseTimers.push(finishTimer);
  }

  highlightHeroPulseStep(step) {
    const strip = document.getElementById("heroVisualPipeline");
    if (!strip) return;
    strip.querySelectorAll("[data-hero-step]").forEach(node => {
      const s = parseInt(node.getAttribute("data-hero-step"), 10);
      node.classList.toggle("is-pulsing", s === step);
      node.classList.toggle("is-done", step > 0 && s < step);
    });
  }

  updateHeroVisualPipeline() {
    const strip = document.getElementById("heroVisualPipeline");
    if (!strip || !this.tokens.length) return;

    const selectedIdx = Math.min(this.stagesRenderer.selectedTokenIndex, Math.max(0, this.tokens.length - 1));
    const focusTok = this.tokens[selectedIdx] || this.tokens[0];
    const focusVec = this.math.getTokenEmbedding(focusTok, this.hyperparams.d_model);
    const topPred = this.math.computeLayerSortedLogits(this.tokens, 12, VOCABULARY_LIST, this.hyperparams.d_model)[0];

    const isBeginner = this.experienceLevel !== "deep";
    const nextWord = this.escapeHtml(topPred ? topPred.token : "...");

    strip.innerHTML = `
      <button type="button" class="hero-flow-node" data-hero-step="1" onclick="window.app.setActiveStage(1)">
        <span class="hero-flow-head">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8V5h4v3M13 8V5h4v3"/></svg>
          <span class="hero-flow-step">1 · Tokenization</span>
        </span>
        <span class="hero-flow-visual mono">"${this.escapeHtml(focusTok.text)}" &rarr; #${focusTok.id}</span>
        <span class="hero-flow-caption tabular-nums">${isBeginner ? `${this.tokens.length} word bricks` : `${this.tokens.length} tokens (BPE)`}</span>
      </button>
      <div class="hero-wire" aria-hidden="true"><span class="wire-packet"></span></div>
      <button type="button" class="hero-flow-node" data-hero-step="2" onclick="window.app.setActiveStage(2)">
        <span class="hero-flow-head">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z"/><path d="M12 22V12M12 12l9-5M12 12L3 7"/></svg>
          <span class="hero-flow-step">2–3 · Embeddings</span>
        </span>
        <span class="hero-flow-visual ${isBeginner ? "" : "mono"}">${isBeginner ? "3D Meaning Map" : `[${focusVec[0].toFixed(1)}, ${focusVec[1].toFixed(1)}]`}</span>
        <span class="hero-flow-caption tabular-nums">${isBeginner ? "+ Word Order (RoPE)" : `${selectedIdx * 36}° position`}</span>
      </button>
      <div class="hero-wire" aria-hidden="true"><span class="wire-packet delay-1"></span></div>
      <button type="button" class="hero-flow-node" data-hero-step="3" onclick="window.app.setActiveStage(4)">
        <span class="hero-flow-head">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><circle cx="12" cy="6" r="3"/><path d="M8 15.5L11 8.5M16 15.5L13 8.5"/></svg>
          <span class="hero-flow-step">4–6 · Self-Attention</span>
        </span>
        <span class="hero-flow-visual">${isBeginner ? "Connect Clues" : "12 Layers"}</span>
        <span class="hero-flow-caption">${isBeginner ? "12 rounds of thinking" : "Block + Logits"}</span>
      </button>
      <div class="hero-wire" aria-hidden="true"><span class="wire-packet delay-2"></span></div>
      <button type="button" class="hero-flow-node is-accent" data-hero-step="4" onclick="window.app.setActiveStage(7)">
        <span class="hero-flow-head">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 4"/></svg>
          <span class="hero-flow-step">7–8 · Next Word</span>
        </span>
        <span class="hero-flow-visual mono">"${nextWord}"</span>
        <span class="hero-flow-caption">${isBeginner ? "Spin & measure surprise" : "Softmax + Perplexity"}</span>
      </button>
    `;
    if (this._heroPulseStep > 0) {
      this.highlightHeroPulseStep(this._heroPulseStep);
    }
  }

  updateStoryConnectors() {
    if (!this.tokens.length) return;
    const selectedIdx = Math.min(this.stagesRenderer.selectedTokenIndex, Math.max(0, this.tokens.length - 1));
    const focusTok = this.tokens[selectedIdx] || this.tokens[0];
    const focusVec = this.math.getTokenEmbedding(focusTok, this.hyperparams.d_model);
    const wordEsc = this.escapeHtml(focusTok.text);
    const isBeginner = this.experienceLevel !== "deep";

    const bridges = [
      { id: "connector-1-2", chip: `"${wordEsc}" #${focusTok.id}`, text: isBeginner ? "Place it on the 3D Meaning Map" : "Embeddings" },
      { id: "connector-2-3", chip: isBeginner ? "Meaning mapped" : `[${focusVec[0].toFixed(1)}, ${focusVec[1].toFixed(1)}]`, text: isBeginner ? "Tag its word order (RoPE)" : "Positional Encoding (RoPE)" },
      { id: "connector-3-4", chip: `Seat #${selectedIdx + 1}`, text: isBeginner ? "Look back for clues (Self-Attention)" : "Self-Attention" },
      { id: "connector-4-5", chip: `"${wordEsc}" + clues`, text: isBeginner ? "Clean & think (Transformer Block)" : "Transformer Block" },
      { id: "connector-5-6", chip: "Round 1 done", text: isBeginner ? "Repeat 12 times (Layers & Logits)" : "Layer Stack & Logits" },
      { id: "connector-6-7", chip: isBeginner ? "Word scores ready" : "Logits Ready", text: isBeginner ? "Spin the next word (Softmax)" : "Softmax & Sampling" },
      { id: "connector-7-8", chip: isBeginner ? "Test a real AI" : "P(x_t | x_&lt;t)", text: isBeginner ? "Measure surprise (Perplexity)" : "Perplexity (DistilGPT-2)" }
    ];

    bridges.forEach((b, idx) => {
      const el = document.getElementById(b.id);
      if (el) {
        el.innerHTML = `
          <div class="connector-track-pulse" style="animation-delay:${(idx * 0.35).toFixed(2)}s;"></div>
          <div class="connector-pill-wrap">
            <span class="connector-arrow" aria-hidden="true">&darr;</span>
            <span class="connector-token mono">${b.chip}</span>
            <span class="connector-sep" aria-hidden="true">&rarr;</span>
            <span class="connector-text">${b.text}</span>
          </div>
        `;
      }
    });
  }

  renderSidebar() {
    const nav = document.getElementById("sidebarNav");
    if (nav) {
      nav.innerHTML = this.stageList.map(st => `
        <button
          type="button"
          class="sidebar-stage-btn"
          data-sidebar-stage="${st.id}"
          onclick="if(window.app) window.app.setActiveStage(${st.id})"
          aria-current="false"
        >
          <span class="sidebar-step-num">${st.id}</span>
          <span class="sidebar-stage-copy">
            <span class="sidebar-stage-name">${st.title}</span>
            <span class="sidebar-stage-sub">${st.sub}</span>
          </span>
        </button>
      `).join("");
    }
    this.updateSidebarActiveState();
  }

  updateSidebarActiveState() {
    const progressEl = document.getElementById("sidebarProgressText");
    if (progressEl) {
      progressEl.textContent = `${this.activeStage} / ${this.stageList.length}`;
    }
    const progressFill = document.getElementById("sidebarProgressFill");
    if (progressFill) {
      progressFill.style.width = `${Math.round((this.activeStage / this.stageList.length) * 100)}%`;
    }

    const nav = document.getElementById("sidebarNav");
    if (!nav) return;

    const buttons = nav.querySelectorAll("[data-sidebar-stage]");
    buttons.forEach(btn => {
      const stId = parseInt(btn.getAttribute("data-sidebar-stage"), 10);
      const isActive = this.activeStage === stId;
      const isCompleted = this.activeStage > stId;
      btn.classList.toggle("active", isActive);
      btn.classList.toggle("completed", isCompleted);
      btn.setAttribute("aria-current", isActive ? "step" : "false");
    });
  }

  setActiveStage(stageNum) {
    const clamped = Math.max(1, Math.min(this.stageList.length, stageNum));
    this.activeStage = clamped;
    this.updateSidebarActiveState();

    // Lock scroll-spy briefly so smooth scrolling doesn't flash intermediate chapters
    this._scrollLockTarget = clamped;
    if (this._scrollLockTimer) clearTimeout(this._scrollLockTimer);
    this._scrollLockTimer = setTimeout(() => {
      this._scrollLockTarget = null;
      this._scrollLockTimer = null;
      this.syncScrollSpyNow();
    }, 850);

    const target = document.getElementById(`stage-${clamped}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  renderStageById(stageNum) {
    const container = document.getElementById(`stage-${stageNum}`);
    if (!container) return;
    if (stageNum === 8 && this.perplexityExplorer) {
      this.perplexityExplorer.render(container);
      return;
    }
    const renderMethod = this.stagesRenderer[`renderStage${stageNum}`];
    if (renderMethod) {
      renderMethod.call(this.stagesRenderer, container);
    }
  }

  renderAllStages() {
    for (let i = 1; i <= this.stageList.length; i++) {
      this.renderStageById(i);
    }
  }

  renderActiveStage(stageNum) {
    if (typeof stageNum === "number") {
      this.renderStageById(stageNum);
    } else {
      this.renderAllStages();
    }
  }

  updateHyperparam(key, value, skipFullRender = false) {
    this.hyperparams[key] = parseFloat(value);

    if ((key === "d_model" || key === "n_heads") && window.vectorView) {
      window.vectorView.updateTokens(this.tokens, this.hyperparams.d_model);
    }

    if (!skipFullRender) {
      this.renderAllStages();
    }
    this.updateHeroVisualPipeline();
    this.updateVRAMCalculator();
  }

  sampleAndAppendToken() {
    const candidateLogits = this.math.computeLayerSortedLogits(
      this.tokens,
      this.stagesRenderer.selectedLayer || 12,
      VOCABULARY_LIST,
      this.hyperparams.d_model
    );
    const sampleResult = this.math.sampleNextToken({
      candidateLogits,
      promptTokens: this.tokens,
      temperature: this.hyperparams.temperature,
      topK: this.hyperparams.top_k,
      topP: this.hyperparams.top_p,
      repetitionPenalty: this.hyperparams.repetition_penalty
    });

    if (sampleResult && sampleResult.sampledToken) {
      this.lastSampledWord = sampleResult.sampledToken.token;
      const pct = Math.round((sampleResult.sampledToken.normalizedProb || sampleResult.sampledToken.rawProb || 0) * 100);
      this.lastSampledMeta = {
        word: sampleResult.sampledToken.token,
        probPct: pct,
        survivors: sampleResult.activeCount,
        temperature: this.hyperparams.temperature,
        manual: false
      };
      this.appendCustomWord(sampleResult.sampledToken.token, true);
    }
  }

  appendCustomWord(word, fromSample = false) {
    this.lastSampledWord = word;
    if (!fromSample) {
      this.lastSampledMeta = {
        word,
        probPct: null,
        survivors: null,
        temperature: this.hyperparams.temperature,
        manual: true
      };
    }
    this.currentPrompt = (this.currentPrompt + " " + word).trim();
    const input = document.getElementById("promptInput");
    if (input) input.value = this.currentPrompt;

    this.updateTokens();
    this.stagesRenderer.selectedTokenIndex = Math.max(0, this.tokens.length - 1);
    this.markStageExplored(7);
    this.showMicroToast(`+ "${word}" added`, "teal");
    this.renderLiveTokenBar();
    this.renderAllStages();
    this.updateHeroVisualPipeline();
    this.updateStoryConnectors();
    this.updateVRAMCalculator();

    if (window.vectorView) {
      window.vectorView.selectTokenByIndex(this.tokens.length - 1);
    }
  }

  toggleAutoPlay() {
    this.isAutoPlaying = !this.isAutoPlaying;
    const btn = document.getElementById("btnAutoPlay");

    if (this.isAutoPlaying) {
      if (btn) btn.textContent = "Pause Auto-Write";
      this.autoPlayInterval = setInterval(() => {
        if (this.tokens.length >= 24) {
          this.toggleAutoPlay();
          return;
        }
        this.sampleAndAppendToken();
      }, 1200);
    } else {
      if (btn) btn.textContent = "Auto-Write";
      if (this.autoPlayInterval) {
        clearInterval(this.autoPlayInterval);
        this.autoPlayInterval = null;
      }
    }
    this.renderStageById(7);
  }

  updateVRAMCalculator() {
    const preset = document.getElementById("calcPresetSelect")?.value || "custom";
    let d_model = this.hyperparams.d_model;
    let n_layers = this.hyperparams.n_layers;
    let n_heads = this.hyperparams.n_heads;
    let vocab_size = VOCABULARY_LIST.length;
    let seq_len = this.tokens.length;

    if (preset === "llama3-8b") {
      d_model = 4096; n_layers = 32; n_heads = 32; vocab_size = 128256; seq_len = 8192;
    } else if (preset === "llama3-70b") {
      d_model = 8192; n_layers = 80; n_heads = 64; vocab_size = 128256; seq_len = 8192;
    } else if (preset === "mistral-7b") {
      d_model = 4096; n_layers = 32; n_heads = 32; vocab_size = 32000; seq_len = 4096;
    } else if (preset === "gpt2") {
      d_model = 768; n_layers = 12; n_heads = 12; vocab_size = 50257; seq_len = 1024;
    }

    const specs = MathEngine.calculateModelSpecs({
      d_model, n_layers, n_heads, vocab_size, seq_len, architecture: "swiglu"
    });

    const formatParams = (p) => {
      if (p >= 1e9) return (p / 1e9).toFixed(2) + "B";
      if (p >= 1e6) return (p / 1e6).toFixed(1) + "M";
      return p.toLocaleString();
    };

    const container = document.getElementById("vramCalcContainer");
    if (container) {
      container.innerHTML = `
        <div class="vram-calc-grid">
          <div class="vram-stat-card">
            <div class="vram-stat-title">Brain Connections</div>
            <div class="vram-stat-val tabular-nums">${formatParams(specs.totalParams)}</div>
          </div>
          <div class="vram-stat-card">
            <div class="vram-stat-title">GPU Memory (FP16)</div>
            <div class="vram-stat-val tabular-nums">${specs.fp16GB} GB</div>
          </div>
          <div class="vram-stat-card">
            <div class="vram-stat-title">Compressed (INT4)</div>
            <div class="vram-stat-val tabular-nums">${specs.int4GB} GB</div>
          </div>
          <div class="vram-stat-card">
            <div class="vram-stat-title">Short-Term Memory (${seq_len.toLocaleString()} words)</div>
            <div class="vram-stat-val tabular-nums">${specs.kvCacheMB} MB</div>
          </div>
        </div>
      `;
    }
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

function startApp() {
  if (!window.app) {
    try {
      window.app = new App();
      console.log("Unprompted initialized.");
    } catch (err) {
      console.error("Error initializing App:", err);
    }
  }
}

if (document.readyState === "complete" || document.readyState === "interactive") {
  startApp();
} else if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("DOMContentLoaded", startApp);
}