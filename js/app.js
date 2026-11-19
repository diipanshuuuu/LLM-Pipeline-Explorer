/**
 * Application Orchestrator — Single-Page Interactive Story Edition
 * Keeps all 7 chapters rendered live on one scrolling page with scroll-spy navigation,
 * instant cross-chapter updates, and persistent 3D viewport state.
 */

const DEFAULT_PROMPT = "The quick brown fox jumps over the";

class App {
  constructor() {
    window.app = this;
    this.math = new MathEngine();
    this.currentPrompt = DEFAULT_PROMPT;
    this.tokens = [];
    this.activeStage = 1;
    this.isAutoPlaying = false;
    this.autoPlayInterval = null;
    this.lastSampledWord = null;
    this.lastSampledMeta = null;
    this.scrollObserver = null;

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
      { id: 1, title: "Word Bricks", sub: "Chop text into IDs" },
      { id: 2, title: "3D Meaning Map", sub: "Put words in space" },
      { id: 3, title: "Word Order", sub: "Spin position clocks" },
      { id: 4, title: "Word Detective", sub: "Connect sentence clues" },
      { id: 5, title: "3 Brain Chores", sub: "Calm, copy & recall" },
      { id: 6, title: "12 Thinking Floors", sub: "Sharpen word scores" },
      { id: 7, title: "Pick Next Word", sub: "Spin the word wheel" }
    ];

    this.stagesRenderer = new PipelineStages(this);
    window.pipelineStages = this.stagesRenderer;

    this.init();
  }

  init() {
    this.bindEvents();
    this.updateTokens();
    // Default selected word to the last word so Stage 4 Detective arcs look rich right away
    this.stagesRenderer.selectedTokenIndex = Math.max(0, this.tokens.length - 1);
    this.renderLiveTokenBar();
    this.renderSidebar();
    this.renderAllStages();
    this.updateVRAMCalculator();
    this.setupScrollSpy();

    window.on3DTokenSelected = (token, idx) => {
      this.stagesRenderer.selectedTokenIndex = idx;
      this.renderLiveTokenBar();
      this.stagesRenderer.updateStage2Inspector();
      this.renderStageById(1);
      this.renderStageById(4);
      this.renderStageById(5);
    };
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
    });
  }

  setupScrollSpy() {
    if (typeof IntersectionObserver === "undefined") return;
    if (this.scrollObserver) this.scrollObserver.disconnect();

    const sections = document.querySelectorAll(".chapter-section[data-stage]");
    if (!sections.length) return;

    this.scrollObserver = new IntersectionObserver((entries) => {
      let bestStage = null;
      let bestRatio = 0;
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= bestRatio) {
          bestRatio = entry.intersectionRatio;
          bestStage = parseInt(entry.target.getAttribute("data-stage"), 10);
        }
      });
      if (bestStage && bestStage !== this.activeStage) {
        this.activeStage = bestStage;
        this.renderSidebar();
      }
    }, {
      rootMargin: "-18% 0px -55% 0px",
      threshold: [0.05, 0.25, 0.5]
    });

    sections.forEach(sec => this.scrollObserver.observe(sec));
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
      badge.textContent = `${this.tokens.length} ${this.tokens.length === 1 ? "piece" : "pieces"} · ${charCount} letters`;
    }
  }

  renderLiveTokenBar() {
    const bar = document.getElementById("liveTokenBar");
    if (!bar) return;

    const selectedIdx = Math.min(this.stagesRenderer.selectedTokenIndex, Math.max(0, this.tokens.length - 1));
    bar.innerHTML = `
      <span class="live-token-prefix">Pick a word to spotlight:</span>
      ${this.tokens.map((t, idx) => `
        <button
          type="button"
          class="live-token-chip ${idx === selectedIdx ? "is-selected" : ""}"
          onclick="if(window.pipelineStages) window.pipelineStages.selectToken(${idx})"
          title="Spotlight word #${idx + 1} (${t.text})"
        >
          <span class="chip-idx">${idx + 1}</span>
          <span>${this.escapeHtml(t.text)}</span>
        </button>
      `).join("")}
    `;
  }

  renderSidebar() {
    const nav = document.getElementById("sidebarNav");
    const progressEl = document.getElementById("sidebarProgressText");
    if (progressEl) {
      progressEl.textContent = `Chapter ${this.activeStage} / ${this.stageList.length}`;
    }
    const progressFill = document.getElementById("sidebarProgressFill");
    if (progressFill) {
      progressFill.style.width = `${Math.round((this.activeStage / this.stageList.length) * 100)}%`;
    }
    if (!nav) return;

    nav.innerHTML = this.stageList.map(st => {
      const isActive = this.activeStage === st.id;
      const isCompleted = this.activeStage > st.id;
      return `
        <button
          type="button"
          class="sidebar-stage-btn ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}"
          onclick="if(window.app) window.app.setActiveStage(${st.id})"
          aria-current="${isActive ? "step" : "false"}"
        >
          <span class="sidebar-step-num">${st.id}</span>
          <span class="sidebar-stage-copy">
            <span class="sidebar-stage-name">${st.title}</span>
            <span class="sidebar-stage-sub">${st.sub}</span>
          </span>
        </button>
      `;
    }).join("");
  }

  setActiveStage(stageNum) {
    this.activeStage = Math.max(1, Math.min(7, stageNum));
    this.renderSidebar();
    const target = document.getElementById(`stage-${this.activeStage}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  renderStageById(stageNum) {
    const container = document.getElementById(`stage-${stageNum}`);
    if (!container) return;
    const renderMethod = this.stagesRenderer[`renderStage${stageNum}`];
    if (renderMethod) {
      renderMethod.call(this.stagesRenderer, container);
    }
  }

  renderAllStages() {
    for (let i = 1; i <= 7; i++) {
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
    this.renderLiveTokenBar();
    this.renderAllStages();
    this.updateVRAMCalculator();

    if (window.vectorView) {
      window.vectorView.selectTokenByIndex(this.tokens.length - 1);
    }
  }

  toggleAutoPlay() {
    this.isAutoPlaying = !this.isAutoPlaying;
    const btn = document.getElementById("btnAutoPlay");

    if (this.isAutoPlaying) {
      if (btn) btn.textContent = "Pause Auto-Play";
      this.autoPlayInterval = setInterval(() => {
        if (this.tokens.length >= 24) {
          this.toggleAutoPlay();
          return;
        }
        this.sampleAndAppendToken();
      }, 1200);
    } else {
      if (btn) btn.textContent = "Auto-Play";
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
            <div class="vram-stat-title">Brain Connections (Parameters)</div>
            <div class="vram-stat-val tabular-nums">${formatParams(specs.totalParams)}</div>
          </div>
          <div class="vram-stat-card">
            <div class="vram-stat-title">Standard GPU Memory (FP16)</div>
            <div class="vram-stat-val tabular-nums">${specs.fp16GB} GB</div>
          </div>
          <div class="vram-stat-card">
            <div class="vram-stat-title">Compressed Memory (INT4)</div>
            <div class="vram-stat-val tabular-nums">${specs.int4GB} GB</div>
          </div>
          <div class="vram-stat-card">
            <div class="vram-stat-title">Short-Term Scratchpad (${seq_len.toLocaleString()} words)</div>
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
      console.log("Transformer Lab single-page story initialized.");
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