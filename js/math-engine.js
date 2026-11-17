/**
 * Mathematical Engine for LLM Pipeline Explainer
 * Implements real matrix multiplications, cosine similarity, RoPE rotations,
 * LayerNorm / RMSNorm, scaled dot-product attention, SwiGLU, and Top-K/Top-P sampling.
 */

class MathEngine {
  constructor() {
    // Fixed seed weights cache to ensure deterministic, reproducible behaviors
    this.weightCache = new Map();
  }

  // Linear algebra primitives
  static dot(a, b) {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) sum += a[i] * b[i];
    return sum;
  }

  static norm(v) {
    return Math.sqrt(MathEngine.dot(v, v)) || 1e-12;
  }

  static cosineSimilarity(a, b) {
    const dot = MathEngine.dot(a, b);
    const denom = MathEngine.norm(a) * MathEngine.norm(b);
    return Math.max(-1, Math.min(1, dot / denom));
  }

  static angleBetween(a, b) {
    const cos = MathEngine.cosineSimilarity(a, b);
    return Math.acos(cos) * (180 / Math.PI);
  }

  static euclideanDistance(a, b) {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  static vectorAdd(a, b) {
    const len = Math.min(a.length, b.length);
    const out = new Array(len);
    for (let i = 0; i < len; i++) out[i] = a[i] + b[i];
    return out;
  }

  static vectorScale(v, s) {
    return v.map(x => x * s);
  }

  static matrixMultiply(A, B) {
    // A is M x K, B is K x N -> Out is M x N
    const M = A.length;
    const K = A[0].length;
    const N = B[0].length;
    const out = Array.from({ length: M }, () => new Array(N).fill(0));
    for (let i = 0; i < M; i++) {
      for (let j = 0; j < N; j++) {
        let sum = 0;
        for (let k = 0; k < K; k++) {
          sum += A[i][k] * B[k][j];
        }
        out[i][j] = sum;
      }
    }
    return out;
  }

  static matrixTranspose(M) {
    const rows = M.length;
    const cols = M[0].length;
    const out = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out[c][r] = M[r][c];
      }
    }
    return out;
  }

  static softmax(vec, temperature = 1.0) {
    if (temperature <= 0.001) {
      // Greedy argmax
      const maxIdx = vec.indexOf(Math.max(...vec));
      return vec.map((_, i) => (i === maxIdx ? 1.0 : 0.0));
    }
    const scaled = vec.map(v => v / temperature);
    const maxVal = Math.max(...scaled);
    const exps = scaled.map(v => Math.exp(v - maxVal));
    const sumExp = exps.reduce((a, b) => a + b, 0) || 1e-12;
    return exps.map(v => v / sumExp);
  }

  // Deterministic pseudo-random weight generator seeded by layer/matrix name
  getWeightMatrix(rows, cols, seedName = "W") {
    const key = `${seedName}_${rows}x${cols}`;
    if (this.weightCache.has(key)) return this.weightCache.get(key);

    let h = 0;
    for (let i = 0; i < seedName.length; i++) h = (h * 31 + seedName.charCodeAt(i)) >>> 0;

    const std = 1.0 / Math.sqrt(rows);
    const matrix = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        // Box-Muller normal distribution simulation
        h = (h * 1664525 + 1013904223) >>> 0;
        const u1 = Math.max(1e-7, (h >>> 0) / 4294967296);
        h = (h * 1664525 + 1013904223) >>> 0;
        const u2 = (h >>> 0) / 4294967296;
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        row.push(z0 * std);
      }
      matrix.push(row);
    }
    this.weightCache.set(key, matrix);
    return matrix;
  }

  // Deterministic high-dimensional token embedding generator
  getTokenEmbedding(token, d_model = 8) {
    if (!token) return new Array(d_model).fill(0.1);
    const text = token.text || "";
    // Generate deterministic vector based on token string and semantic hint
    const hint = token.vectorHint || [0.1, 0.1, 0.1];
    const vec = new Array(d_model);
    
    // Fallback deterministic string hash
    const getHash = (s) => {
      if (typeof hashString === "function") return hashString(s);
      let h = 2166136261 >>> 0;
      for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
      return h >>> 0;
    };

    let h = getHash(text + "_emb");

    for (let i = 0; i < d_model; i++) {
      h = (h * 1664525 + 1013904223) >>> 0;
      const randNorm = ((h >>> 0) / 4294967296) * 2 - 1;
      const hintContribution = hint[i % hint.length] * 0.75;
      vec[i] = hintContribution + randNorm * 0.25;
    }

    // Normalize embedding vector to unit or controlled sphere
    const norm = MathEngine.norm(vec);
    return vec.map(v => (norm > 0 ? v / norm : 0));
  }

  // Absolute Sinusoidal Positional Encoding (Vaswani et al. 2017)
  static sinusoidalPE(seqLength, d_model) {
    const PE = Array.from({ length: seqLength }, () => new Array(d_model).fill(0));
    for (let pos = 0; pos < seqLength; pos++) {
      for (let i = 0; i < Math.floor(d_model / 2); i++) {
        const denom = Math.pow(10000, (2 * i) / d_model);
        PE[pos][2 * i] = Math.sin(pos / denom);
        PE[pos][2 * i + 1] = Math.cos(pos / denom);
      }
      if (d_model % 2 !== 0) {
        const i = Math.floor(d_model / 2);
        const denom = Math.pow(10000, (2 * i) / d_model);
        PE[pos][2 * i] = Math.sin(pos / denom);
      }
    }
    return PE;
  }

  // Rotary Position Embedding (RoPE - Su et al. 2021)
  static applyRoPE(vec, pos, d_model) {
    const out = [...vec];
    for (let i = 0; i < Math.floor(d_model / 2); i++) {
      const theta = 1 / Math.pow(10000, (2 * i) / d_model);
      const angle = pos * theta;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const x0 = vec[2 * i];
      const x1 = vec[2 * i + 1];
      out[2 * i] = x0 * cosA - x1 * sinA;
      out[2 * i + 1] = x0 * sinA + x1 * cosA;
    }
    return out;
  }

  // Normalization: LayerNorm
  static layerNorm(vec, gamma = null, beta = null, eps = 1e-5) {
    const d = vec.length;
    const mean = vec.reduce((a, b) => a + b, 0) / d;
    const variance = vec.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / d;
    const std = Math.sqrt(variance + eps);

    const normalized = vec.map((x, i) => {
      const g = gamma ? gamma[i] : 1.0;
      const b = beta ? beta[i] : 0.0;
      return ((x - mean) / std) * g + b;
    });

    return {
      output: normalized,
      mean,
      variance,
      std,
      rms: Math.sqrt(vec.reduce((a, b) => a + b*b, 0) / d + eps)
    };
  }

  // Normalization: RMSNorm (LLaMA / Mistral standard)
  static rmsNorm(vec, gamma = null, eps = 1e-5) {
    const d = vec.length;
    const meanSquare = vec.reduce((a, b) => a + b * b, 0) / d;
    const rms = Math.sqrt(meanSquare + eps);

    const normalized = vec.map((x, i) => {
      const g = gamma ? gamma[i] : 1.0;
      return (x / rms) * g;
    });

    return {
      output: normalized,
      rms,
      meanSquare
    };
  }

  // Multi-Head Causal Self-Attention
  computeAttention({
    tokens,
    tokenVectors,
    d_model = 8,
    n_heads = 2,
    causalMask = true,
    useKVCache = false
  }) {
    const seqLen = tokenVectors.length;
    const d_k = Math.max(1, Math.floor(d_model / n_heads));

    // Projection weights W_Q, W_K, W_V, W_O
    const W_Q = this.getWeightMatrix(d_model, d_model, "W_Q");
    const W_K = this.getWeightMatrix(d_model, d_model, "W_K");
    const W_V = this.getWeightMatrix(d_model, d_model, "W_V");
    const W_O = this.getWeightMatrix(d_model, d_model, "W_O");

    // Project input vectors into Q, K, V matrices [seqLen x d_model]
    const Q = MathEngine.matrixMultiply(tokenVectors, W_Q);
    const K = MathEngine.matrixMultiply(tokenVectors, W_K);
    const V = MathEngine.matrixMultiply(tokenVectors, W_V);

    const headsData = [];

    for (let h = 0; h < n_heads; h++) {
      const offset = h * d_k;
      // Extract head slices [seqLen x d_k]
      const Q_h = Q.map(row => row.slice(offset, offset + d_k));
      const K_h = K.map(row => row.slice(offset, offset + d_k));
      const V_h = V.map(row => row.slice(offset, offset + d_k));

      // Scaled dot product: S = (Q_h * K_h^T) / sqrt(d_k)
      const rawScores = Array.from({ length: seqLen }, () => new Array(seqLen).fill(0));
      const attentionWeights = Array.from({ length: seqLen }, () => new Array(seqLen).fill(0));

      for (let i = 0; i < seqLen; i++) {
        for (let j = 0; j < seqLen; j++) {
          if (causalMask && j > i) {
            rawScores[i][j] = -Infinity;
          } else {
            const dot = MathEngine.dot(Q_h[i], K_h[j]);
            rawScores[i][j] = dot / Math.sqrt(d_k);
          }
        }

        // Softmax row i
        const rowScores = rawScores[i];
        if (causalMask) {
          // Softmax only up to position i
          const activeScores = rowScores.slice(0, i + 1);
          const activeSoftmax = MathEngine.softmax(activeScores, 1.0);
          for (let j = 0; j <= i; j++) {
            attentionWeights[i][j] = activeSoftmax[j];
          }
          for (let j = i + 1; j < seqLen; j++) {
            attentionWeights[i][j] = 0.0;
          }
        } else {
          const fullSoftmax = MathEngine.softmax(rowScores, 1.0);
          for (let j = 0; j < seqLen; j++) {
            attentionWeights[i][j] = fullSoftmax[j];
          }
        }
      }

      // Attention output for head: O_h = Softmax * V_h [seqLen x d_k]
      const O_h = MathEngine.matrixMultiply(attentionWeights, V_h);

      headsData.push({
        headIndex: h,
        d_k,
        Q_h,
        K_h,
        V_h,
        rawScores,
        attentionWeights,
        O_h
      });
    }

    // Concatenate head outputs horizontally: [seqLen x d_model]
    const O_concat = Array.from({ length: seqLen }, (_, r) => {
      const row = [];
      for (let h = 0; h < n_heads; h++) {
        row.push(...headsData[h].O_h[r]);
      }
      return row;
    });

    // Final projection with W_O
    const attentionOutput = MathEngine.matrixMultiply(O_concat, W_O);

    return {
      headsData,
      attentionOutput,
      W_Q, W_K, W_V, W_O,
      Q, K, V
    };
  }

  // FFN / SwiGLU operations
  static gelu(x) {
    return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * Math.pow(x, 3))));
  }

  static silu(x) {
    return x / (1 + Math.exp(-x));
  }

  computeFFN(arg1, arg2 = 8, arg3 = "swiglu") {
    let inputVector, d_model, architecture;
    if (Array.isArray(arg1)) {
      inputVector = arg1;
      d_model = arg2 || 8;
      architecture = arg3 || "swiglu";
    } else if (arg1 && typeof arg1 === "object") {
      inputVector = arg1.inputVector || [];
      d_model = arg1.d_model || 8;
      architecture = arg1.architecture || "swiglu";
    } else {
      inputVector = new Array(8).fill(0.1);
      d_model = 8;
      architecture = "swiglu";
    }
    if (architecture === "swiglu") {
      const d_ff = Math.floor((8 / 3) * d_model);
      const W_gate = this.getWeightMatrix(d_model, d_ff, "W_gate");
      const W_up = this.getWeightMatrix(d_model, d_ff, "W_up");
      const W_down = this.getWeightMatrix(d_ff, d_model, "W_down");

      // gate = silu(x * W_gate)
      const gateLinear = MathEngine.matrixMultiply([inputVector], W_gate)[0];
      const gateActivated = gateLinear.map(MathEngine.silu);

      // up = x * W_up
      const up = MathEngine.matrixMultiply([inputVector], W_up)[0];

      // element-wise product: gate * up
      const hidden = gateActivated.map((g, i) => g * up[i]);

      // output = hidden * W_down
      const output = MathEngine.matrixMultiply([hidden], W_down)[0];

      return {
        architecture: "SwiGLU",
        d_ff,
        gateLinear,
        gateActivated,
        up,
        hidden,
        output
      };
    } else {
      // Standard GELU MLP
      const d_ff = 4 * d_model;
      const W1 = this.getWeightMatrix(d_model, d_ff, "W1_mlp");
      const W2 = this.getWeightMatrix(d_ff, d_model, "W2_mlp");

      const hiddenLinear = MathEngine.matrixMultiply([inputVector], W1)[0];
      const hiddenActivated = hiddenLinear.map(MathEngine.gelu);
      const output = MathEngine.matrixMultiply([hiddenActivated], W2)[0];

      return {
        architecture: "GELU MLP",
        d_ff,
        hiddenLinear,
        hiddenActivated,
        output
      };
    }
  }

  // LM Head Logits calculation & Vocabulary projection
  computeLogits(finalHiddenState, vocabularyList, d_model = 8) {
    const W_U = this.getWeightMatrix(d_model, vocabularyList.length, "W_U");
    const rawLogits = MathEngine.matrixMultiply([finalHiddenState], W_U)[0];

    return vocabularyList.map((vocabItem, i) => {
      // Add slight semantic bonus if token aligns with context
      const semanticDot = MathEngine.dot(
        finalHiddenState.slice(0, 3),
        vocabItem.vectorHint || [0, 0, 0]
      );
      const logit = rawLogits[i] * 1.5 + semanticDot * 2.2;
      return {
        token: vocabItem.text,
        id: vocabItem.id,
        cluster: vocabItem.cluster,
        rawLogit: logit
      };
    });
  }

  // Sampling pipeline: Repetition Penalty, Temperature, Top-K, Top-P (Nucleus)
  sampleNextToken({
    candidateLogits,
    promptTokens = [],
    temperature = 0.8,
    topK = 10,
    topP = 0.9,
    repetitionPenalty = 1.15
  }) {
    const promptSet = new Set(promptTokens.map(t => t.text.toLowerCase()));

    // 1. Repetition penalty
    const penalized = candidateLogits.map(cand => {
      let l = cand.rawLogit;
      if (promptSet.has(cand.token.toLowerCase())) {
        l = l > 0 ? l / repetitionPenalty : l * repetitionPenalty;
      }
      return { ...cand, penalizedLogit: l };
    });

    // 2. Sort descending by penalized logit
    penalized.sort((a, b) => b.penalizedLogit - a.penalizedLogit);

    // 3. Temperature scaling and initial Softmax
    const logitsArray = penalized.map(c => c.penalizedLogit);
    const initialProbs = MathEngine.softmax(logitsArray, temperature);
    penalized.forEach((c, idx) => {
      c.rawProb = initialProbs[idx];
      c.status = "active";
      c.strikeReason = "";
    });

    // 4. Top-K filtering
    for (let i = topK; i < penalized.length; i++) {
      penalized[i].status = "cut-top-k";
      penalized[i].strikeReason = `Cut by Top-K (Rank ${i + 1} > ${topK})`;
    }

    // 5. Top-P (Nucleus) filtering on Top-K survivors
    let cumulativeProb = 0;
    let crossedNucleus = false;
    for (let i = 0; i < Math.min(topK, penalized.length); i++) {
      cumulativeProb += penalized[i].rawProb;
      penalized[i].cumulativeProb = cumulativeProb;
      if (crossedNucleus) {
        penalized[i].status = "cut-top-p";
        penalized[i].strikeReason = `Cut by Top-P (Cum. ${(cumulativeProb * 100).toFixed(1)}% > ${(topP * 100).toFixed(0)}%)`;
      } else if (cumulativeProb >= topP) {
        // Keep this token as the boundary, cut subsequent ones
        crossedNucleus = true;
      }
    }

    // 6. Re-normalize surviving tokens
    const survivors = penalized.filter(c => c.status === "active");
    const survivorProbSum = survivors.reduce((sum, c) => sum + c.rawProb, 0) || 1e-12;
    survivors.forEach(c => {
      c.normalizedProb = c.rawProb / survivorProbSum;
    });

    penalized.forEach(c => {
      if (c.status !== "active") c.normalizedProb = 0;
    });

    // 7. Sample one token from normalized distribution
    let sampledToken = null;
    if (survivors.length > 0) {
      if (temperature <= 0.001) {
        // Greedy argmax
        sampledToken = survivors[0];
      } else {
        const rand = Math.random();
        let running = 0;
        for (const cand of survivors) {
          running += cand.normalizedProb;
          if (rand <= running) {
            sampledToken = cand;
            break;
          }
        }
        if (!sampledToken) sampledToken = survivors[survivors.length - 1];
      }
    } else {
      sampledToken = penalized[0];
    }

    return {
      candidates: penalized,
      sampledToken,
      activeCount: survivors.length,
      topK,
      topP,
      temperature,
      repetitionPenalty
    };
  }

  // Model Parameter & VRAM Calculator
  static calculateModelSpecs({
    d_model = 4096,
    n_layers = 32,
    n_heads = 32,
    vocab_size = 32000,
    seq_len = 2048,
    architecture = "swiglu",
    isTied = false
  }) {
    const d_k = d_model / n_heads;
    const d_ff = architecture === "swiglu" ? Math.floor((8 / 3) * d_model) : 4 * d_model;

    // Parameters
    const embedParams = vocab_size * d_model;
    const attnParamsPerLayer = 4 * d_model * d_model; // W_Q, W_K, W_V, W_O
    const ffnParamsPerLayer = architecture === "swiglu" 
      ? 3 * d_model * d_ff // Gate, Up, Down
      : 2 * d_model * d_ff; // W1, W2
    const normParamsPerLayer = 2 * d_model; // Pre-attn norm + Pre-ffn norm
    const unembedParams = isTied ? 0 : d_model * vocab_size;

    const layerParams = attnParamsPerLayer + ffnParamsPerLayer + normParamsPerLayer;
    const totalParams = embedParams + (n_layers * layerParams) + unembedParams;

    // Memory footprints (Bytes)
    const fp32Bytes = totalParams * 4;
    const fp16Bytes = totalParams * 2;
    const int8Bytes = totalParams * 1;
    const int4Bytes = totalParams * 0.5;

    // KV Cache Memory per batch=1 (Bytes in FP16)
    // 2 (K and V) * n_layers * n_heads * d_k * seq_len * 2 bytes
    const kvCacheBytesFP16 = 2 * n_layers * n_heads * d_k * seq_len * 2;

    return {
      totalParams,
      embedParams,
      layerParams,
      attnParamsPerLayer,
      ffnParamsPerLayer,
      normParamsPerLayer,
      unembedParams,
      d_ff,
      d_k,
      fp32GB: (fp32Bytes / (1024 ** 3)).toFixed(2),
      fp16GB: (fp16Bytes / (1024 ** 3)).toFixed(2),
      int8GB: (int8Bytes / (1024 ** 3)).toFixed(2),
      int4GB: (int4Bytes / (1024 ** 3)).toFixed(2),
      kvCacheMB: (kvCacheBytesFP16 / (1024 ** 2)).toFixed(2)
    };
  }
}


if (typeof window !== "undefined") window.MathEngine = MathEngine;
if (typeof global !== "undefined") global.MathEngine = MathEngine;
