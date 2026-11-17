/**
 * Pipeline Stage Renderers
 * 7 Guided Stages following strict 3-part beginner-friendly template:
 * 1. Top: Title & Everyday Analogy
 * 2. Middle: Live Interactive Visual
 * 3. Bottom: Collapsible "Under the Hood: Math & Parameters" + Navigation Buttons
 */

class PipelineStages {
  constructor(app) {
    window.pipelineStages = this;
    this.app = app;
    this.math = app.math;
    this.selectedTokenIndex = 0;
    this.tokenizerMode = "bpe"; // "bpe" | "word" | "char"

    // Stage 2 state
    this.compareWordA = "quick";
    this.compareWordB = "fast";

    // Stage 3 state (RoPE)
    this.ropeSelectedPos = 3;
    this.ropeMode = "rope"; // "rope" | "sinusoidal"

    // Stage 4 state (Attention)
    this.selectedHeadIndex = 0;
    this.causalMaskEnabled = true;

    // Stage 5 state (Norm, Skip, FFN)
    this.normSpikeValue = 0.0;
    this.skipConnectionEnabled = true;
    this.ffnArch = "swiglu"; // "swiglu" | "gelu"
    this.normType = "rmsnorm"; // "rmsnorm" | "layernorm"

    // Stage 6 state (Layers & Logits)
    this.selectedLayer = 4;

    // Stage 7 state
    this.currentSampleResult = null;
  }

  // ==========================================
  // STAGE 1: Breaking Text into Pieces (Tokenization)
  // ==========================================
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
    const charCount = charTokens.length;
    const savingsPct = charCount > 0 ? Math.round((1 - bpeCount / charCount) * 100) : 0;

    container.innerHTML = `
      <div class="stage-card">
        <!-- 1. TOP: Title & Analogy -->
        <div class="stage-top-header">
          <span class="stage-badge">Stage 1 of 7</span>
          <h2 class="stage-title">Breaking Text into Pieces (Tokenization)</h2>
          <div class="stage-analogy-box">
            <strong>Analogy:</strong> Like breaking a sentence into Lego bricks with ID numbers.
            Computers cannot read letters or words directly, so an AI chops text into small puzzle pieces called <strong>Tokens</strong> and assigns each one a unique number.
          </div>
        </div>

        <!-- 2. MIDDLE: Interactive Visual -->
        <div class="stage-visual-container">
          <!-- Mode Switcher -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <span style="font-size:12px; font-weight:700; color:var(--text-dim); text-transform:uppercase;">Compare Slicing Methods:</span>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-sm ${mode === 'bpe' ? 'btn-blue' : ''}" onclick="pipelineStages.setTokenizerMode('bpe')">Sub-word BPE (Modern AI)</button>
              <button class="btn btn-sm ${mode === 'word' ? 'btn-blue' : ''}" onclick="pipelineStages.setTokenizerMode('word')">Whole Words</button>
              <button class="btn btn-sm ${mode === 'char' ? 'btn-blue' : ''}" onclick="pipelineStages.setTokenizerMode('char')">Characters</button>
            </div>
          </div>

          <!-- Token Blocks Ribbon -->
          <div class="token-blocks-box">
            ${displayTokens.map((t, idx) => `
              <div class="token-block ${idx === selectedIdx ? 'active' : ''}" onclick="pipelineStages.selectToken(${idx})">
                <span class="token-word">"${t.text}"</span>
                <span class="token-id-sub">#${t.id}</span>
              </div>
            `).join('')}
          </div>

          <!-- Active Token Inspector Card -->
          <div class="token-inspector-card">
            <div>
              <span style="font-size:11px; color:var(--text-dim); font-weight:700; text-transform:uppercase;">Selected Token:</span>
              <span class="mono" style="font-size:16px; font-weight:700; color:var(--blue); margin-left:6px;">"${activeToken.text}"</span>
              <span class="mono" style="font-size:13px; color:var(--text-muted); margin-left:6px;">(ID #${activeToken.id})</span>
            </div>
            <div style="display:flex; align-items:center; gap:14px; font-size:12px; color:var(--text-muted);">
              <div>UTF-8 Bytes: <span class="mono text-purple">[${(activeToken.bytes || []).map(b => '0x' + b.toString(16).toUpperCase()).join(', ')}]</span></div>
              <div>Length: <span class="mono text-green">${activeToken.text.length} chars</span></div>
            </div>
          </div>

          <div style="font-size:13px; color:var(--text-muted); line-height:1.5; background:var(--bg-input); padding:12px 16px; border-radius:10px; border:1px solid var(--border);">
            💡 <strong>Why Modern LLMs Use Sub-words (BPE):</strong> This sentence takes only <strong>${bpeCount} BPE tokens</strong> compared to <strong>${charCount} character tokens</strong> (a ${savingsPct}% reduction in length). Sub-words allow LLMs to read huge books quickly while gracefully handling rare or misspelled words by splitting them into smaller pieces.
          </div>
        </div>

        <!-- 3. BOTTOM: Deep Dive & Navigation -->
        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>🔬 Under the Hood: Math & Vocabulary Lookups</span>
            <span class="mono">&#9662;</span>
          </summary>
          <div class="deep-dive-content">
            <p>During pre-training, Byte-Pair Encoding (BPE) counts the most frequent adjacent character pairs across billions of text documents and merges them iteratively to construct a fixed vocabulary table $V$.</p>
            <code>Vocabulary Size |V|: ~50,257 (GPT-2) to ~128,256 (LLaMA-3)
Algorithm: Iterative Pair Merge (c_1, c_2) -> c_merged
Fall-back for Unknown Characters: Direct UTF-8 1-byte fallback tokens (0x00 to 0xFF)</code>
            <p>Every word in your prompt is mapped to an integer index: $x \to [id_1, id_2, \dots, id_N] \in \mathbb{Z}^N$.</p>
          </div>
        </details>

        <div class="stage-nav-row">
          <span></span>
          <button class="btn btn-blue" onclick="app.setActiveStage(2)">
            Next: 3D Map of Meaning &rarr;
          </button>
        </div>
      </div>
    `;
  }

  selectToken(idx) {
    this.selectedTokenIndex = idx;
    this.app.renderActiveStage();
  }

  setTokenizerMode(mode) {
    this.tokenizerMode = mode;
    this.app.renderActiveStage();
  }

  // ==========================================
  // STAGE 2: 3D Map of Meaning (Embeddings)
  // ==========================================
  renderStage2(container) {
    const tokens = this.app.tokens;
    const hp = this.app.hyperparams;

    const wordA = this.compareWordA || (tokens[0] ? tokens[0].text : "quick");
    const wordB = this.compareWordB || (tokens[1] ? tokens[1].text : "fast");

    let tokA = VOCABULARY_LIST.find(v => v.text.toLowerCase() === wordA.toLowerCase());
    if (!tokA) tokA = formatToken(wordA, 901, [0x61], "custom", [0.4, 0.2, 0.1]);

    let tokB = VOCABULARY_LIST.find(v => v.text.toLowerCase() === wordB.toLowerCase());
    if (!tokB) tokB = formatToken(wordB, 902, [0x62], "custom", [0.42, 0.19, 0.12]);

    const vecA = this.math.getTokenEmbedding(tokA, hp.d_model);
    const vecB = this.math.getTokenEmbedding(tokB, hp.d_model);
    const cosSim = MathEngine.cosineSimilarity(vecA, vecB);
    const angleDeg = MathEngine.angleBetween(vecA, vecB);
    const simPct = Math.max(0, Math.min(100, Math.round(((cosSim + 1) / 2) * 100)));

    container.innerHTML = `
      <div class="stage-card">
        <!-- 1. TOP: Title & Analogy -->
        <div class="stage-top-header">
          <span class="stage-badge">Stage 2 of 7</span>
          <h2 class="stage-title">Turning Words into a 3D Map of Meaning (Embeddings)</h2>
          <div class="stage-analogy-box">
            <strong>Analogy:</strong> Giving every word GPS coordinates so similar words live in the same neighbourhood.
            In this virtual world, words that mean similar things (like "quick" and "fast") are placed right next to each other.
          </div>
        </div>

        <!-- 2. MIDDLE: Interactive Visual -->
        <div class="stage-visual-container">
          <!-- 3D Viewport -->
          <div class="viewport-clean" id="threeViewportContainer">
            <div class="viewport-toolbar">
              <button class="btn btn-sm" onclick="if(window.vectorView) vectorView.setMode('arrows')">Vectors (Arrows)</button>
              <button class="btn btn-sm" onclick="if(window.vectorView) vectorView.setMode('points')">Dots (Points)</button>
              <button class="btn btn-sm" onclick="if(window.vectorView) vectorView.toggleAnchors()">Toggle Anchors</button>
              <button class="btn btn-sm" onclick="if(window.vectorView) vectorView.resetCamera()">Reset View</button>
            </div>
            <div id="vectorSpaceHUD" class="vector-hud-container hidden"></div>
          </div>

          <!-- Semantic Cluster Legend & Quick Pairs -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; background:var(--bg-input); padding:12px 16px; border-radius:10px; border:1px solid var(--border);">
            <div style="display:flex; align-items:center; gap:12px; font-size:12px;">
              <span style="font-weight:700; color:var(--text-dim); text-transform:uppercase;">Semantic Clusters:</span>
              <span style="color:#10B981;">● Animals</span>
              <span style="color:#F59E0B;">● Speed</span>
              <span style="color:#8B5CF6;">● Actions</span>
              <span style="color:#06B6D4;">● Grammar</span>
            </div>
            <div style="font-size:12px; color:var(--text-muted);">
              🖱️ Drag to rotate &bull; Scroll to zoom &bull; Click any 2 words to measure angle
            </div>
          </div>

          <!-- Quick Comparison Pair Tester -->
          <div style="background:var(--bg-input); border:1px solid var(--border); border-radius:12px; padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
              <span style="font-size:12px; font-weight:700; color:var(--text-dim); text-transform:uppercase;">Quick Word Similarity Check:</span>
              <div style="display:flex; gap:6px;">
                <button class="preset-pill" onclick="pipelineStages.setComparePair('quick', 'fast')">quick vs fast</button>
                <button class="preset-pill" onclick="pipelineStages.setComparePair('fox', 'dog')">fox vs dog</button>
                <button class="preset-pill" onclick="pipelineStages.setComparePair('brown', 'red')">brown vs red</button>
                <button class="preset-pill" onclick="pipelineStages.setComparePair('fox', 'algebra')">fox vs algebra</button>
              </div>
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap;">
              <div class="mono" style="font-size:15px; font-weight:700;">
                <span class="text-blue">"${wordA}"</span> &harr; <span class="text-green">"${wordB}"</span>
              </div>
              <div style="display:flex; align-items:center; gap:16px;">
                <span class="mono" style="font-size:14px; color:var(--text-muted);">Angle: <strong class="text-purple">${angleDeg.toFixed(1)}&deg;</strong></span>
                <span class="mono" style="font-size:18px; font-weight:800; color:${cosSim > 0.7 ? 'var(--green)' : cosSim < 0.3 ? 'var(--rose)' : 'var(--blue)'};">
                  ${simPct}% Match (${cosSim.toFixed(3)})
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. BOTTOM: Deep Dive & Navigation -->
        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>🔬 Under the Hood: High-Dimensional Latent Spaces & Cosine Math</span>
            <span class="mono">&#9662;</span>
          </summary>
          <div class="deep-dive-content">
            <p>Every token ID is looked up in an Embedding Matrix $E \in \mathbb{R}^{|V| \times d_{model}}$ to retrieve a high-dimensional vector. In production models (like LLaMA-3), $d_{model} = 4096$ or $8192$.</p>
            <code>Embedding Lookup: e_i = E[token_id_i]
Cosine Similarity: cos(theta) = (u · v) / (||u|| * ||v||)
Total Embedding Parameters: |V| * d_model = 128,256 * 4096 = 525,336,576 parameters</code>
            <p>We project these 4096-dimensional vectors down to 3D coordinates using PCA and t-SNE dimensionality reduction so they can be viewed in your browser.</p>
          </div>
        </details>

        <div class="stage-nav-row">
          <button class="btn" onclick="app.setActiveStage(1)">&larr; Previous: Tokenization</button>
          <button class="btn btn-blue" onclick="app.setActiveStage(3)">Next: Tracking Word Order &rarr;</button>
        </div>
      </div>
    `;

    setTimeout(() => {
      const Ctor = window.VectorSpace3D || (typeof VectorSpace3D !== "undefined" ? VectorSpace3D : null);
      if (!window.vectorView && Ctor) {
        window.vectorView = new Ctor("threeViewportContainer");
      } else if (window.vectorView && window.vectorView.renderer) {
        const mount = document.getElementById("threeViewportContainer");
        if (mount && !mount.contains(window.vectorView.renderer.domElement)) {
          mount.appendChild(window.vectorView.renderer.domElement);
          mount.appendChild(window.vectorView.labelsContainer);
          window.vectorView.handleResize();
        }
      }
      if (window.vectorView && typeof window.vectorView.updateTokens === "function") {
        window.vectorView.updateTokens(tokens, hp.d_model);
      }
    }, 50);
  }

  setComparePair(wA, wB) {
    this.compareWordA = wA;
    this.compareWordB = wB;
    this.app.renderActiveStage();
  }

  // ==========================================
  // STAGE 3: Tracking Word Order (Positional Encoding / RoPE)
  // ==========================================
  renderStage3(container) {
    const tokens = this.app.tokens;
    const mode = this.ropeMode || "rope";
    const selectedPos = Math.min(this.ropeSelectedPos, Math.max(0, tokens.length - 1));
    const tokenAtPos = tokens[selectedPos] || tokens[0];

    container.innerHTML = `
      <div class="stage-card">
        <!-- 1. TOP: Title & Analogy -->
        <div class="stage-top-header">
          <span class="stage-badge">Stage 3 of 7</span>
          <h2 class="stage-title">Tracking Word Order (Positional Encoding / RoPE)</h2>
          <div class="stage-analogy-box">
            <strong>Analogy:</strong> "Dog bites man" and "Man bites dog" contain the exact same words—the AI needs timestamps or angles to know what order words appear in.
            Without positional data, a Transformer treats a sentence as an unordered soup of words.
          </div>
        </div>

        <!-- 2. MIDDLE: Interactive Visual -->
        <div class="stage-visual-container">
          <!-- Architecture Toggle -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <span style="font-size:12px; font-weight:700; color:var(--text-dim); text-transform:uppercase;">Positional Method:</span>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-sm ${mode === 'rope' ? 'btn-blue' : ''}" onclick="pipelineStages.setRoPEMode('rope')">Rotary Position Embedding (RoPE · Modern)</button>
              <button class="btn btn-sm ${mode === 'sinusoidal' ? 'btn-blue' : ''}" onclick="pipelineStages.setRoPEMode('sinusoidal')">Sinusoidal (Classic Vaswani)</button>
            </div>
          </div>

          <!-- RoPE Clock / Dial Visualizer -->
          <div class="rope-canvas-wrap">
            <canvas id="ropeDialCanvas" class="dial-canvas" width="380" height="280"></canvas>
            
            <div class="rope-stepper-box">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:12px; color:var(--text-muted);">Step Through Words:</span>
                <input type="range" min="0" max="${Math.max(0, tokens.length - 1)}" value="${selectedPos}" oninput="pipelineStages.setRoPEPosition(this.value)" style="width:140px;">
              </div>
              <div class="mono" style="font-size:13px; font-weight:700;">
                Position ${selectedPos}: <span class="text-blue">"${tokenAtPos.text}"</span>
                (Rotation: <span class="text-purple">${(selectedPos * 36).toFixed(0)}&deg;</span>)
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; background:var(--bg-input); padding:12px 16px; border-radius:10px; border:1px solid var(--border);">
            <div style="font-size:13px; color:var(--text-muted);">
              💡 <strong>How RoPE Works:</strong> Pairs of numbers in the word vector are rotated in 2D circles like clock hands. Words further along in the sentence rotate by larger angles ($m \\times \\theta$), letting attention compute relative distances with zero extra parameters!
            </div>
            <button class="btn btn-sm" onclick="pipelineStages.applyRoPETo3D()">Apply Rotation to 3D Space</button>
          </div>
        </div>

        <!-- 3. BOTTOM: Deep Dive & Navigation -->
        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>🔬 Under the Hood: Complex Rotations & Relative Distance Math</span>
            <span class="mono">&#9662;</span>
          </summary>
          <div class="deep-dive-content">
            <p>RoPE (Rotary Position Embedding) represents each 2D dimension pair $(x_{2i}, x_{2i+1})$ as a complex number and rotates it by angle $m \\theta_i$:</p>
            <code>R_{Theta, m}^d = diag(R_{m*theta_1}, R_{m*theta_2}, ..., R_{m*theta_{d/2}})
where theta_i = 10000^{-2(i-1)/d}
Inner product property: <R_m q, R_n k> = g(q, k, m - n)</code>
            <p>Because the inner product depends strictly on relative offset $(m - n)$, RoPE enables models to generalize naturally to long context windows.</p>
          </div>
        </details>

        <div class="stage-nav-row">
          <button class="btn" onclick="app.setActiveStage(2)">&larr; Previous: Embeddings</button>
          <button class="btn btn-blue" onclick="app.setActiveStage(4)">Next: Connecting Words (Attention) &rarr;</button>
        </div>
      </div>
    `;

    setTimeout(() => this.drawRoPEDial(), 40);
  }

  setRoPEMode(mode) {
    this.ropeMode = mode;
    this.app.renderActiveStage();
  }

  setRoPEPosition(pos) {
    this.ropeSelectedPos = parseInt(pos, 10);
    this.drawRoPEDial();
  }

  applyRoPETo3D() {
    if (window.vectorView) {
      window.vectorView.updateTokens(this.app.tokens, this.app.hyperparams.d_model, 25);
    }
  }

  drawRoPEDial() {
    const canvas = document.getElementById("ropeDialCanvas");
    if (!canvas || typeof canvas.getContext !== "function") return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 25;

    // Outer dial circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Concentric guideline
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.6, 0, 2 * Math.PI);
    ctx.strokeStyle = "#1E293B";
    ctx.stroke();

    // Center point
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
    ctx.fillStyle = "#38BDF8";
    ctx.fill();

    const tokens = this.app.tokens;
    tokens.forEach((t, i) => {
      const angle = (i * (2 * Math.PI / Math.max(1, tokens.length))) - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);

      const isSelected = i === this.ropeSelectedPos;

      // Pointer line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.strokeStyle = isSelected ? "#38BDF8" : "rgba(100, 116, 139, 0.4)";
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.stroke();

      // Node
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 7 : 4, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? "#4ADE80" : "#64748B";
      ctx.fill();

      // Label
      ctx.fillStyle = isSelected ? "#FFF" : "#94A3B8";
      ctx.font = isSelected ? "bold 12px 'JetBrains Mono', monospace" : "11px 'JetBrains Mono', monospace";
      ctx.fillText(`${i}:"${t.text}"`, x + (x > cx ? 6 : -45), y + (y > cy ? 12 : -6));
    });
  }

  // ==========================================
  // STAGE 4: Connecting Words for Context (Self-Attention)
  // ==========================================
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

    // BUG FIX: computeAttention() returns headsData (not heads)
    const headsData = attnResult.headsData || [];
    const activeHeadIndex = Math.min(this.selectedHeadIndex, Math.max(0, headsData.length - 1));
    const activeHeadData = headsData[activeHeadIndex] || headsData[0];
    const rawWeights = (activeHeadData && activeHeadData.attentionWeights) ? (activeHeadData.attentionWeights[selectedIdx] || []) : [];

    const attendedTokens = tokens.slice(0, selectedIdx + 1).map((t, idx) => ({
      index: idx,
      token: t.text,
      weight: rawWeights[idx] || 0
    })).sort((a, b) => b.weight - a.weight);

    container.innerHTML = `
      <div class="stage-card">
        <!-- 1. TOP: Title & Analogy -->
        <div class="stage-top-header">
          <span class="stage-badge">Stage 4 of 7</span>
          <h2 class="stage-title">Connecting Words for Context (Self-Attention)</h2>
          <div class="stage-analogy-box">
            <strong>Analogy:</strong> Highlighting clues in a sentence.
            When reading the word "jumps", the AI looks back at "fox" to know WHO is jumping, and at "over" to know WHERE the action goes.
          </div>
        </div>

        <!-- 2. MIDDLE: Interactive Visual -->
        <div class="stage-visual-container">
          <!-- Controls Bar -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:12px; font-weight:700; color:var(--text-dim); text-transform:uppercase;">Attention Head:</span>
              <div style="display:flex; gap:6px;">
                <button class="btn btn-sm ${this.selectedHeadIndex === 0 ? 'btn-blue' : ''}" onclick="pipelineStages.setAttnHead(0)">Head 1 (Grammar & Context)</button>
                <button class="btn btn-sm ${this.selectedHeadIndex === 1 ? 'btn-blue' : ''}" onclick="pipelineStages.setAttnHead(1)">Head 2 (Subject & Action)</button>
              </div>
            </div>
            <button class="btn btn-sm ${this.causalMaskEnabled ? 'btn-primary' : ''}" onclick="pipelineStages.toggleCausalMask()">
              ${this.causalMaskEnabled ? '🔒 Causal Mask: ON (Future Blocked)' : '⚠️ Causal Mask: OFF (Sees Future)'}
            </button>
          </div>

          <!-- Sentence Ribbon -->
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:2px;">Click any word to inspect its attention:</div>
          <div class="sentence-ribbon">
            ${tokens.map((t, idx) => `
              <div class="word-pill-attn ${idx === selectedIdx ? 'active' : (idx <= selectedIdx && (rawWeights[idx] || 0) > 0.15 ? 'connected' : '')}" onclick="pipelineStages.selectToken(${idx})">
                "${t.text}"
              </div>
            `).join('')}
          </div>

          <!-- SVG Connecting Bezier Arcs -->
          <svg class="attention-bezier-svg" id="attentionBezierSVG">
            ${tokens.map((_, j) => {
              if (j > selectedIdx) return '';
              const w = 600;
              const h = 70;
              const n = tokens.length;
              const x1 = (selectedIdx + 0.5) * (w / n);
              const x2 = (j + 0.5) * (w / n);
              const y = h - 10;
              const arc = Math.min(h - 15, Math.abs(x1 - x2) * 0.4 + 10);
              const weight = rawWeights[j] || 0;
              const opacity = Math.max(0.15, weight);
              const strokeColor = j === selectedIdx ? '#C084FC' : '#38BDF8';
              return `<path d="M${x1} ${y} Q${(x1+x2)/2} ${y-arc} ${x2} ${y}" fill="none" stroke="${strokeColor}" stroke-width="${Math.max(1, weight * 5)}" opacity="${opacity}"/>`;
            }).join('')}
          </svg>

          <!-- Attended Breakdown -->
          <div class="attn-breakdown-card">
            <div style="font-size:12px; font-weight:700; color:var(--text-dim); text-transform:uppercase; margin-bottom:12px;">
              What "${currentToken.text}" attends to in this head:
            </div>
            ${attendedTokens.map(item => `
              <div class="attn-item-row">
                <span class="mono" style="width:90px; font-weight:700; color:${item.index === selectedIdx ? '#C084FC' : '#38BDF8'}; font-size:13px;">"${item.token}"</span>
                <div class="attn-progress-bar">
                  <div class="attn-progress-fill" style="width:${Math.round(item.weight * 100)}%; background:${item.index === selectedIdx ? '#C084FC' : '#38BDF8'};"></div>
                </div>
                <span class="mono" style="width:50px; text-align:right; font-size:12px; font-weight:700;">${Math.round(item.weight * 100)}%</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 3. BOTTOM: Deep Dive & Navigation -->
        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>🔬 Under the Hood: Q, K, V Projections & Causal Masking Math</span>
            <span class="mono">&#9662;</span>
          </summary>
          <div class="deep-dive-content">
            <p>Input tokens are multiplied by learnable projection weights to generate Query (Q), Key (K), and Value (V) matrices:</p>
            <code>Attention(Q, K, V) = softmax((Q * K^T) / sqrt(d_k) + M) * V
where d_k = d_model / n_heads = ${hp.d_model} / ${hp.n_heads} = ${Math.floor(hp.d_model / hp.n_heads)}
Causal Mask M_ij = 0 (if j <= i), -Infinity (if j > i)</code>
            <p>During text generation, past Key and Value vectors are saved in a <strong>KV Cache</strong> so the model only calculates Q, K, V for the newest token.</p>
          </div>
        </details>

        <div class="stage-nav-row">
          <button class="btn" onclick="app.setActiveStage(3)">&larr; Previous: Word Order</button>
          <button class="btn btn-blue" onclick="app.setActiveStage(5)">Next: Stabilising & Thinking &rarr;</button>
        </div>
      </div>
    `;
  }

  setAttnHead(idx) {
    this.selectedHeadIndex = idx;
    this.app.renderActiveStage();
  }

  toggleCausalMask() {
    this.causalMaskEnabled = !this.causalMaskEnabled;
    this.app.renderActiveStage();
  }

  // ==========================================
  // STAGE 5: Stabilising & Thinking (Norm + Skip + FFN)
  // ==========================================
  renderStage5(container) {
    const hp = this.app.hyperparams;
    const tokens = this.app.tokens;
    const rawVector = this.math.getTokenEmbedding(tokens[0] || { text: "quick" }, hp.d_model);

    // Apply simulated noise spike
    const spikedVector = rawVector.map((v, i) => (i === 2 ? v + this.normSpikeValue : v));
    const normResult = this.normType === "rmsnorm"
      ? MathEngine.rmsNorm(spikedVector)
      : MathEngine.layerNorm(spikedVector);

    const ffnResult = this.math.computeFFN({
      inputVector: normResult.output,
      d_model: hp.d_model,
      architecture: this.ffnArch
    });

    container.innerHTML = `
      <div class="stage-card">
        <!-- 1. TOP: Title & Analogy -->
        <div class="stage-top-header">
          <span class="stage-badge">Stage 5 of 7</span>
          <h2 class="stage-title">Stabilising & Thinking (Norm + Skip + FFN)</h2>
          <div class="stage-analogy-box">
            <strong>Analogy:</strong> Keeping numbers balanced (RMSNorm), keeping a backup copy of the original thought (Skip Connection), and checking the AI's built-in fact memory (Feed-Forward Network).
          </div>
        </div>

        <!-- 2. MIDDLE: Interactive Visual -->
        <div class="stage-visual-container">
          <div class="block-flow-diagram">
            <!-- Step 1: Pre-Norm -->
            <div class="flow-step-box">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="flow-step-tag text-blue">1. Pre-Normalization (${this.normType === 'rmsnorm' ? 'RMSNorm' : 'LayerNorm'})</span>
                <div style="display:flex; gap:6px;">
                  <button class="btn btn-sm ${this.normType === 'rmsnorm' ? 'btn-blue' : ''}" onclick="pipelineStages.setNormType('rmsnorm')">RMSNorm (Modern)</button>
                  <button class="btn btn-sm ${this.normType === 'layernorm' ? 'btn-blue' : ''}" onclick="pipelineStages.setNormType('layernorm')">LayerNorm</button>
                </div>
              </div>

              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; font-size:12px;">
                <span>Inject Noise Spike into Dimension #2: <strong class="mono text-rose">${this.normSpikeValue > 0 ? '+' : ''}${this.normSpikeValue.toFixed(1)}</strong></span>
                <span class="mono text-green">RMS Stabilized: ${normResult.rms.toFixed(3)}</span>
              </div>
              <input type="range" min="-5.0" max="5.0" step="0.5" value="${this.normSpikeValue}" oninput="pipelineStages.setNormSpike(this.value)" style="width:100%;">
            </div>

            <!-- Step 2: Residual Highway -->
            <div class="flow-step-box" style="border-color:${this.skipConnectionEnabled ? 'var(--blue)' : 'var(--border)'};">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <span class="flow-step-tag text-purple">2. Residual Skip Highway</span>
                  <div style="font-size:13px; color:var(--text-muted); margin-top:2px;">
                    Formula: <span class="mono text-blue">x + SubLayer(Norm(x))</span>
                  </div>
                </div>
                <button class="btn btn-sm ${this.skipConnectionEnabled ? 'btn-primary' : ''}" onclick="pipelineStages.toggleSkip()">
                  ${this.skipConnectionEnabled ? '✓ Highway Active' : '✕ Highway Disabled'}
                </button>
              </div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:8px;">
                ${this.skipConnectionEnabled ? '🟢 Signals bypass the block cleanly, allowing gradients to flow back without vanishing!' : '⚠️ Without skip connections, deep neural networks suffer from vanishing gradients and cannot train.'}
              </div>
            </div>

            <!-- Step 3: FFN / SwiGLU -->
            <div class="flow-step-box">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="flow-step-tag text-green">3. Feed-Forward Network (${this.ffnArch.toUpperCase()})</span>
                <div style="display:flex; gap:6px;">
                  <button class="btn btn-sm ${this.ffnArch === 'swiglu' ? 'btn-blue' : ''}" onclick="pipelineStages.setFFNArch('swiglu')">SwiGLU (LLaMA/Mistral)</button>
                  <button class="btn btn-sm ${this.ffnArch === 'gelu' ? 'btn-blue' : ''}" onclick="pipelineStages.setFFNArch('gelu')">Standard GELU</button>
                </div>
              </div>
              <div style="font-size:13px; color:var(--text-muted);">
                Expands vector from dimension <span class="mono text-blue">${hp.d_model}</span> to intermediate memory dimension <span class="mono text-purple">${ffnResult.d_ff}</span> and compresses back down. FFN layers store the model's factual knowledge!
              </div>
            </div>
          </div>
        </div>

        <!-- 3. BOTTOM: Deep Dive & Navigation -->
        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>🔬 Under the Hood: RMSNorm, ResNet Skip Math & SwiGLU Gating</span>
            <span class="mono">&#9662;</span>
          </summary>
          <div class="deep-dive-content">
            <p>RMSNorm computes the Root Mean Square of activations without tracking mean $\mu$, speeding up computation by ~7%:</p>
            <code>RMSNorm(x) = (x / RMS(x)) * gamma
where RMS(x) = sqrt((1/d) * sum(x_i^2) + eps)
SwiGLU(x) = (swish(x * W_gate) ⊗ (x * W_up)) * W_down</code>
            <p>The SwiGLU gated activation lets the model dynamically filter knowledge before passing representations to the next layer.</p>
          </div>
        </details>

        <div class="stage-nav-row">
          <button class="btn" onclick="app.setActiveStage(4)">&larr; Previous: Self-Attention</button>
          <button class="btn btn-blue" onclick="app.setActiveStage(6)">Next: Stacking Layers & Scoring &rarr;</button>
        </div>
      </div>
    `;
  }

  setNormSpike(val) {
    this.normSpikeValue = parseFloat(val);
    this.app.renderActiveStage();
  }

  setNormType(type) {
    this.normType = type;
    this.app.renderActiveStage();
  }

  toggleSkip() {
    this.skipConnectionEnabled = !this.skipConnectionEnabled;
    this.app.renderActiveStage();
  }

  setFFNArch(arch) {
    this.ffnArch = arch;
    this.app.renderActiveStage();
  }

  // ==========================================
  // STAGE 6: Stacking Layers & Scoring Every Word (Deep Layers & Logits)
  // ==========================================
  renderStage6(container) {
    const hp = this.app.hyperparams;
    const tokens = this.app.tokens;
    const lastToken = tokens[tokens.length - 1] || { text: "the" };

    const finalHidden = this.math.getTokenEmbedding(lastToken, hp.d_model);
    const candidateLogits = this.math.computeLogits(finalHidden, VOCABULARY_LIST, hp.d_model);
    const topLogits = candidateLogits.slice(0, 8);

    container.innerHTML = `
      <div class="stage-card">
        <!-- 1. TOP: Title & Analogy -->
        <div class="stage-top-header">
          <span class="stage-badge">Stage 6 of 7</span>
          <h2 class="stage-title">Stacking Layers & Scoring Every Word (Deep Layers & Logits)</h2>
          <div class="stage-analogy-box">
            <strong>Analogy:</strong> Reading a sentence multiple times.
            Early layers check basic grammar and punctuation, middle layers connect themes, and final layers decide what idea should come next.
          </div>
        </div>

        <!-- 2. MIDDLE: Interactive Visual -->
        <div class="stage-visual-container">
          <!-- Layer Depth Scrubber -->
          <div class="layer-scrubber-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:13px; font-weight:700;">Inspect Network Depth: Layer <span class="mono text-blue">${this.selectedLayer}</span> of 12</span>
              <span class="mono text-purple" style="font-size:12px;">
                ${this.selectedLayer <= 3 ? 'Syntax & Surface Features' : this.selectedLayer <= 8 ? 'Semantic Roles & Relationships' : 'Next-Token Predictive Abstraction'}
              </span>
            </div>
            <input type="range" min="1" max="12" value="${this.selectedLayer}" oninput="pipelineStages.setSelectedLayer(this.value)" style="width:100%;">
            <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-dim); margin-top:4px;">
              <span>Layer 1 (Grammar)</span>
              <span>Layer 6 (Context)</span>
              <span>Layer 12 (Next Word)</span>
            </div>
          </div>

          <!-- Unembedding Logits Preview Table -->
          <div style="background:var(--bg-input); border:1px solid var(--border); border-radius:14px; padding:18px;">
            <div style="font-size:12px; font-weight:700; color:var(--text-dim); text-transform:uppercase; margin-bottom:8px;">
              Unembedding Projection (LM Head): Raw Vocabulary Scores for Next Word
            </div>
            <table class="logits-preview-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Candidate Word</th>
                  <th>Cluster</th>
                  <th>Raw Score (Logit)</th>
                </tr>
              </thead>
              <tbody>
                ${topLogits.map((c, i) => `
                  <tr>
                    <td class="mono" style="color:var(--text-dim);">#${i + 1}</td>
                    <td class="mono" style="font-weight:700; color:#FFF;">"${c.token}"</td>
                    <td><span style="font-size:11px; color:var(--text-muted); background:var(--bg-card); padding:2px 6px; border-radius:4px;">${c.cluster}</span></td>
                    <td class="mono text-blue" style="font-weight:700;">${c.rawLogit.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 3. BOTTOM: Deep Dive & Navigation -->
        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>🔬 Under the Hood: Depth Stacking & Linear Projection to Vocabulary</span>
            <span class="mono">&#9662;</span>
          </summary>
          <div class="deep-dive-content">
            <p>Modern LLMs stack between 32 and 128 Transformer Blocks. The final layer's hidden state $h^{(L)}$ is multiplied by the Unembedding Matrix $W_U \in \mathbb{R}^{d_{model} \times |V|}$:</p>
            <code>h^{(l)} = TransformerBlock_l(h^{(l-1)})
z = RMSNorm(h^{(L)}) * W_U   where z in R^{|V|}</code>
            <p>These raw scores $z$ are called <strong>Logits</strong>. Next, they are converted into probabilities using Temperature scaling and Softmax.</p>
          </div>
        </details>

        <div class="stage-nav-row">
          <button class="btn" onclick="app.setActiveStage(5)">&larr; Previous: Stabilising & Thinking</button>
          <button class="btn btn-blue" onclick="app.setActiveStage(7)">Next: Picking the Next Word &rarr;</button>
        </div>
      </div>
    `;
  }

  setSelectedLayer(l) {
    this.selectedLayer = parseInt(l, 10);
    this.app.renderActiveStage();
  }

  // ==========================================
  // STAGE 7: Picking the Next Word (Sampling)
  // ==========================================
  renderStage7(container) {
    const hp = this.app.hyperparams;
    const tokens = this.app.tokens;
    const lastToken = tokens[tokens.length - 1] || { text: "the" };

    const finalHidden = this.math.getTokenEmbedding(lastToken, hp.d_model);
    const candidateLogits = this.math.computeLogits(finalHidden, VOCABULARY_LIST, hp.d_model);

    // BUG FIX: sampleNextToken() returns candidates (not penalized)
    const sampleResult = this.math.sampleNextToken({
      candidateLogits,
      promptTokens: tokens,
      temperature: hp.temperature,
      topK: hp.top_k,
      topP: hp.top_p,
      repetitionPenalty: hp.repetition_penalty
    });
    this.currentSampleResult = sampleResult;

    const candidates = (sampleResult && sampleResult.candidates) ? sampleResult.candidates.slice(0, 8) : [];
    const sampledWord = sampleResult.sampledToken ? sampleResult.sampledToken.token : "dog";

    container.innerHTML = `
      <div class="stage-card">
        <!-- 1. TOP: Title & Analogy -->
        <div class="stage-top-header">
          <span class="stage-badge">Stage 7 of 7</span>
          <h2 class="stage-title">Picking the Next Word (Temperature, Top-K & Top-P)</h2>
          <div class="stage-analogy-box">
            <strong>Analogy:</strong> Rolling a weighted dice.
            The AI doesn't simply pick the highest-scoring word every time—Temperature and Top-K/Top-P control whether it acts like a cautious librarian or a wild creative poet.
          </div>
        </div>

        <!-- 2. MIDDLE: Interactive Visual -->
        <div class="stage-visual-container">
          <!-- Parameter Sliders -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; background:var(--bg-input); padding:16px; border-radius:14px; border:1px solid var(--border);">
            <div>
              <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                <span>Creativity (Temperature):</span>
                <span class="mono text-amber font-bold">${hp.temperature.toFixed(2)}</span>
              </div>
              <input type="range" min="0.1" max="1.5" step="0.05" value="${hp.temperature}" oninput="app.updateHyperparam('temperature', this.value)" style="width:100%;">
              <div style="font-size:10px; color:var(--text-dim); margin-top:2px;">${hp.temperature < 0.4 ? 'Strict & Factual' : hp.temperature > 1.0 ? 'Wild & Surprising' : 'Balanced'}</div>
            </div>

            <div>
              <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                <span>Top-K Cutoff:</span>
                <span class="mono text-blue font-bold">${hp.top_k} words</span>
              </div>
              <input type="range" min="1" max="20" step="1" value="${hp.top_k}" oninput="app.updateHyperparam('top_k', this.value)" style="width:100%;">
              <div style="font-size:10px; color:var(--text-dim); margin-top:2px;">Keeps only the top K candidate words</div>
            </div>

            <div>
              <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                <span>Top-P (Nucleus):</span>
                <span class="mono text-green font-bold">${(hp.top_p * 100).toFixed(0)}% mass</span>
              </div>
              <input type="range" min="0.1" max="1.0" step="0.05" value="${hp.top_p}" oninput="app.updateHyperparam('top_p', this.value)" style="width:100%;">
              <div style="font-size:10px; color:var(--text-dim); margin-top:2px;">Cuts tail once cumulative probability is met</div>
            </div>
          </div>

          <!-- Top Candidate Probability Bars -->
          <div class="cand-bars-container">
            <div style="font-size:12px; font-weight:700; color:var(--text-dim); text-transform:uppercase; margin-bottom:4px;">
              Top Candidate Next Words (Click any word to append):
            </div>
            ${candidates.map(c => {
              const isCut = c.status !== "active";
              const probPct = Math.round(c.rawProb * 100);
              return `
                <div class="cand-bar-row ${isCut ? 'cut' : ''}" onclick="if(!'${isCut}' || '${isCut}' === 'false') app.appendCustomWord('${c.token}')">
                  <span class="cand-word-label">"${c.token}"</span>
                  <div class="cand-bar-fill-track">
                    <div class="cand-bar-fill" style="width:${probPct}%; opacity:${isCut ? 0.3 : 1};"></div>
                  </div>
                  <span class="cand-prob-label">${probPct}%</span>
                  ${isCut ? `<span style="font-size:10px; color:var(--rose);">${c.strikeReason}</span>` : ''}
                </div>
              `;
            }).join('')}
          </div>

          <!-- Generation Action Controls -->
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="app.sampleAndAppendToken()">
              <span>🎲 Roll & Add Word ("${sampledWord}")</span>
            </button>
            <button class="btn btn-secondary" onclick="app.toggleAutoPlay()">
              <span>${this.app.isAutoPlaying ? '⏸ Pause' : '▶ Auto-Generate Sentence'}</span>
            </button>
            <button class="btn btn-sm" onclick="app.setPrompt('The quick brown fox jumps over the')" style="margin-left:auto;">
              <span>↺ Reset Sentence</span>
            </button>
          </div>
        </div>

        <!-- 3. BOTTOM: Deep Dive & Navigation -->
        <details class="stage-deep-dive">
          <summary class="deep-dive-summary">
            <span>🔬 Under the Hood: Softmax Scaling, Nucleus Math & Repetition Penalties</span>
            <span class="mono">&#9662;</span>
          </summary>
          <div class="deep-dive-content">
            <p>The final logits $z_i$ are scaled by Temperature $T$ and converted to normalized probabilities via the Softmax function:</p>
            <code>P(w_i) = exp(z_i / T) / sum(exp(z_j / T))
Top-K: Keeps indices i <= K, zeroing all others.
Top-P (Nucleus): Smallest set V^(p) such that sum_{i in V^(p)} P(w_i) >= p.</code>
            <p>Tokens already appearing in the prompt receive a repetition penalty to avoid repetitive degenerate loops.</p>
          </div>
        </details>

        <div class="stage-nav-row">
          <button class="btn" onclick="app.setActiveStage(6)">&larr; Previous: Deep Layers</button>
          <button class="btn btn-primary" onclick="app.sampleAndAppendToken()">
            ✨ Generate Next Word &rarr;
          </button>
        </div>
      </div>
    `;
  }
}

if (typeof window !== "undefined") {
  window.PipelineStages = PipelineStages;
}

if (typeof global !== "undefined") {
  global.PipelineStages = PipelineStages;
}
