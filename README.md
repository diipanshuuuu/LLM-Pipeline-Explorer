# Unprompted — Inside How AI Predicts Every Word

An interactive, beginner-friendly 3D field guide opening the black box of modern **Large Language Models (LLMs)**—showing how sentences become numbered tokens, 3D meaning maps, self-attention clues, next-word probabilities, and live **DistilGPT-2 Perplexity**.

---

## The 8 Guided Pipeline Stages

1. **Stage 1: Breaking Text into Pieces (Tokenization)**
   * Real-time Byte-Pair Encoding (BPE) sub-word tokenizer with UTF-8 byte breakdown (`[0x54, 0x68, 0x65]`), token IDs, and vocabulary lookups.
   * Interactive comparison across Character-level, Word-level, and Sub-word (BPE) tokenization with compression ratios.
   * Explains iterative pair merging, vocabulary tables ($V$), and out-of-vocabulary (OOV) byte-fallback handling.

2. **Stage 2: Turning Words into a 3D Map of Meaning (Embeddings)**
   * High-dimensional dense vector embeddings ($V \times d_{model}$) projected down to 3D via PCA/t-SNE.
   * Interactive WebGL/Three.js 3D vector space viewport with orbit, pan, and zoom controls.
   * Origin Vector Arrow Mode vs. Point Cloud Mode.
   * Click any two words to draw a glowing 3D arc displaying real-time Cosine Similarity ($\cos \theta$), angle ($\theta^\circ$), Euclidean distance, and dot product.
   * Semantic clustering across categories (Animals, Speed, Actions, Colors/Grammar).

3. **Stage 3: Tracking Word Order (Positional Encoding / RoPE)**
   * Toggle between Modern Rotary Position Embedding (RoPE) and Classic Sinusoidal Encoding.
   * Interactive 2D subspace rotation dial canvas and RoPE rotation applicator to the 3D vector space.
   * Shows how position $m$ rotates embedding dimension pairs by angle $m \cdot \theta_i$ preserving relative distance.

4. **Stage 4: Connecting Words for Context (Self-Attention)**
   * Linear projections: Query ($Q = X W_Q$), Key ($K = X W_K$), and Value ($V = X W_V$) split across attention heads ($d_k = d_{model} / n_{heads}$).
   * Dynamic SVG Bezier attention curves linking query words to attended words.
   * Interactive Causal Masking toggle ($-\infty$ upper-triangular mask) showing why future tokens are blocked during generation.
   * Attention Head switcher comparing Grammar/Context heads vs Subject/Action heads.

5. **Stage 5: Stabilising & Thinking (Norm + Skip Highway + FFN)**
   * **Pre-Normalization**: RMSNorm vs LayerNorm with an interactive "Inject Noise Spike" slider demonstrating activation stabilization in real time.
   * **Residual Highway**: Identity skip connection ($x + \text{Attention}(\text{Norm}(x))$) with toggle showing how gradients flow without vanishing.
   * **Feed-Forward Network (FFN)**: Modern SwiGLU gating vs standard GELU MLP, demonstrating intermediate expansion ($d_{model} \to d_{ff} \to d_{model}$) for factual knowledge memory retrieval.

6. **Stage 6: Stacking Layers & Scoring Every Word (Deep Layers & Logits)**
   * Layer scrubber slider (Layer 1 to 12) illustrating representation depth (Syntax $\to$ Semantic Roles $\to$ Next-Word Prediction).
   * Unembedding Matrix ($W_U \in \mathbb{R}^{d_{model} \times |V|}$) linear projection generating raw unnormalized Logits across the dictionary.

7. **Stage 7: Picking the Next Word (Temperature, Top-K & Top-P Sampling)**
   * Real-time sliders for Creativity (Temperature $T$), Top-K cutoff, and Top-P (Nucleus) mass threshold.
   * Horizontal probability bars for top candidate next words with real-time fade-out / strikethrough for eliminated candidates.
   * One-click word selection, "🎲 Roll & Add Word" sampling, and autoregressive generation loops.

---

## 💻 Tech Stack

* **Frontend**: HTML5, Modern CSS (Slate Dark `#0F172A` theme, CSS Grid & Flexbox, JetBrains Mono & Plus Jakarta Sans typography).
* **3D Graphics**: Three.js & OrbitControls (stored locally in `/js`, zero CDN dependencies, ad-blocker immune).
* **Math & Linear Algebra Engine**: Custom deterministic linear algebra library implementing real dot products, matrix multiplications, cosine similarities, RMSNorm/LayerNorm, attention projections, SwiGLU activations, and nucleus sampling.

---

## 🚀 Running Locally

No build tools or package managers required. Simply start any local HTTP server:

```bash
# Using Python 3
python3 -m http.server 8080

# Or using Node http-server / npx serve
npx serve .
```

Open [http://localhost:8080](http://localhost:8080) in your browser.
