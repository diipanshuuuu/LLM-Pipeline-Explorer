/**
 * Application Orchestrator
 * Coordinates real-time input, 7-stage navigation, model updates, and sampling.
 */

class App {
  constructor() {
    window.app = this;
    this.math = new MathEngine();
    this.currentPrompt = "The quick brown fox jumps over the";
    this.tokens = [];
    this.activeStage = 1; // Stages 1 to 7
    this.isAutoPlaying = false;
    this.autoPlayInterval = null;

    // Hyperparameters
    this.hyperparams = {
      d_model: 8,
      n_heads: 2,
      n_layers: 4,
      temperature: 0.8,
      top_k: 10,
      top_p: 0.9,
      repetition_penalty: 1.15
    };

    // 7 Guided Stages Metadata
    this.stageList = [
      { id: 1, title: "Tokenization", sub: "Breaking Text into Pieces" },
      { id: 2, title: "Embeddings", sub: "3D Map of Meaning" },
      { id: 3, title: "Word Order", sub: "Positional Encoding (RoPE)" },
      { id: 4, title: "Self-Attention", sub: "Connecting Words for Context" },
      { id: 5, title: "Thinking Block", sub: "Norm + Skip Highway + FFN" },
      { id: 6, title: "Deep Layers", sub: "Stacking Layers & Scoring" },
      { id: 7, title: "Next Word", sub: "Temperature & Sampling" }
    ];

    this.stagesRenderer = new PipelineStages(this);
    window.pipelineStages = this.stagesRenderer;

    this.init();
  }

  init() {
    this.bindEvents();
    this.updateTokens();
    this.renderSidebar();
    this.renderActiveStage();
    this.updateVRAMCalculator();

    window.on3DTokenSelected = (token, idx) => {
      this.stagesRenderer.selectedTokenIndex = idx;
      this.renderActiveStage();
    };
  }

  bindEvents() {
    const input = document.getElementById("promptInput");
    if (input) {
      input.value = this.currentPrompt;
      input.addEventListener("input", (e) => {
        this.currentPrompt = e.target.value;
        this.handlePromptChange();
      });
    }
  }

  setPrompt(text) {
    this.currentPrompt = text;
    const input = document.getElementById("promptInput");
    if (input) input.value = text;
    this.handlePromptChange();
  }

  handlePromptChange() {
    this.updateTokens();
    this.renderActiveStage();
    this.updateVRAMCalculator();

    if (window.vectorView) {
      window.vectorView.updateTokens(this.tokens, this.hyperparams.d_model);
    }
  }

  updateTokens() {
    this.tokens = tokenizeBPE(this.currentPrompt);
    if (this.tokens.length === 0) {
      this.tokens = [formatToken("...", 0, [0x2e], "punct", [0, 0, 0])];
    }
    const badge = document.getElementById("tokenCountBadge");
    if (badge) {
      badge.textContent = `${this.tokens.length} Tokens`;
    }
  }

  renderSidebar() {
    const nav = document.getElementById("sidebarNav");
    if (!nav) return;

    nav.innerHTML = this.stageList.map(st => {
      const isActive = this.activeStage === st.id;
      const isCompleted = this.activeStage > st.id;
      return `
        <button class="sidebar-stage-btn ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}" onclick="if(window.app) window.app.setActiveStage(${st.id})">
          <span class="sidebar-step-num">${st.id}</span>
          <div class="sidebar-stage-title">
            <div style="font-weight:700;">${st.title}</div>
            <div style="font-size:11px; opacity:0.75;">${st.sub}</div>
          </div>
        </button>
      `;
    }).join("");
  }

  setActiveStage(stageNum) {
    this.activeStage = Math.max(1, Math.min(7, stageNum));
    this.renderSidebar();
    this.renderActiveStage();
    if (typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  renderActiveStage() {
    const container = document.getElementById("activeStageContainer");
    if (!container) return;

    const renderMethod = this.stagesRenderer[`renderStage${this.activeStage}`];
    if (renderMethod) {
      renderMethod.call(this.stagesRenderer, container);
    }
  }

  updateHyperparam(key, value) {
    this.hyperparams[key] = parseFloat(value);

    if (key === "d_model" || key === "n_heads") {
      if (window.vectorView) {
        window.vectorView.updateTokens(this.tokens, this.hyperparams.d_model);
      }
    }

    this.renderActiveStage();
    this.updateVRAMCalculator();
  }

  sampleAndAppendToken() {
    let sampleResult = this.stagesRenderer.currentSampleResult;
    if (!sampleResult || !sampleResult.sampledToken) {
      // Recompute on the fly
      const lastToken = this.tokens[this.tokens.length - 1];
      const finalHidden = lastToken ? this.math.getTokenEmbedding(lastToken, this.hyperparams.d_model) : new Array(this.hyperparams.d_model).fill(0.1);
      const candidateLogits = this.math.computeLogits(finalHidden, VOCABULARY_LIST, this.hyperparams.d_model);
      sampleResult = this.math.sampleNextToken({
        candidateLogits,
        promptTokens: this.tokens,
        temperature: this.hyperparams.temperature,
        topK: this.hyperparams.top_k,
        topP: this.hyperparams.top_p,
        repetitionPenalty: this.hyperparams.repetition_penalty
      });
    }

    if (sampleResult && sampleResult.sampledToken) {
      this.appendCustomWord(sampleResult.sampledToken.token);
    }
  }

  appendCustomWord(word) {
    this.currentPrompt = (this.currentPrompt + " " + word).trim();
    const input = document.getElementById("promptInput");
    if (input) input.value = this.currentPrompt;

    this.handlePromptChange();
    this.stagesRenderer.selectedTokenIndex = this.tokens.length - 1;

    if (window.vectorView) {
      window.vectorView.selectTokenByIndex(this.tokens.length - 1);
    }
  }

  toggleAutoPlay() {
    this.isAutoPlaying = !this.isAutoPlaying;
    const btn = document.getElementById("btnAutoPlay");

    if (this.isAutoPlaying) {
      if (btn) btn.innerHTML = `<span>⏸ Pause</span>`;
      this.autoPlayInterval = setInterval(() => {
        if (this.tokens.length >= 24) {
          this.toggleAutoPlay();
          return;
        }
        this.sampleAndAppendToken();
      }, 1200);
    } else {
      if (btn) btn.innerHTML = `<span>&#9658; Auto-Play</span>`;
      if (this.autoPlayInterval) {
        clearInterval(this.autoPlayInterval);
        this.autoPlayInterval = null;
      }
    }
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
      if (p >= 1e9) return (p / 1e9).toFixed(2) + " Billion";
      if (p >= 1e6) return (p / 1e6).toFixed(1) + " Million";
      return p.toLocaleString();
    };

    const container = document.getElementById("vramCalcContainer");
    if (container) {
      container.innerHTML = `
        <div class="vram-calc-grid">
          <div class="vram-stat-card">
            <div class="vram-stat-title">Total Parameters</div>
            <div class="vram-stat-val text-blue mono">${formatParams(specs.totalParams)}</div>
          </div>
          <div class="vram-stat-card">
            <div class="vram-stat-title">FP16 Weights VRAM</div>
            <div class="vram-stat-val text-purple mono">${specs.fp16GB} GB</div>
          </div>
          <div class="vram-stat-card">
            <div class="vram-stat-title">Quantized INT4 VRAM</div>
            <div class="vram-stat-val text-green mono">${specs.int4GB} GB</div>
          </div>
          <div class="vram-stat-card">
            <div class="vram-stat-title">KV Cache (${seq_len} Tokens)</div>
            <div class="vram-stat-val text-amber mono">${specs.kvCacheMB} MB</div>
          </div>
        </div>
      `;
    }
  }
}

// Initialize immediately if DOM is ready, or on DOMContentLoaded
function startApp() {
  if (!window.app) {
    try {
      window.app = new App();
      console.log("LLM Pipeline Explainer initialized successfully.");
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