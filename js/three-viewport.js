/**
 * 3D Vector Space Viewport using Three.js
 * Implements interactive 3D coordinate plotting, orbit controls, origin vector arrows,
 * point clouds, raycasting node selection, cosine similarity connecting arcs, and HUD metrics.
 * Uses software-WebGL detection and on-demand rendering to remain crisp and responsive.
 */

const _projVec = typeof THREE !== "undefined" ? new THREE.Vector3() : null;

function detectSoftwareWebGL() {
  try {
    const probeCanvas = document.createElement("canvas");
    const gl = probeCanvas.getContext("webgl2") || probeCanvas.getContext("webgl");
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || "");
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch (e) {
    return true;
  }
}

function computeCameraFitDistance(radius, fovDeg, aspect, padding = 1.36) {
  const safeRadius = Math.max(1, Number(radius) || 3.6);
  const safeFov = Math.max(20, Math.min(100, Number(fovDeg) || 42));
  const safeAspect = Math.max(0.45, Number(aspect) || 1);
  const vFov = (safeFov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * safeAspect);
  const limitingFov = Math.min(vFov, hFov);
  return (safeRadius / Math.sin(limitingFov / 2)) * padding;
}

class VectorSpace3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    if (typeof THREE === "undefined") {
      this.container.innerHTML = `<div class="viewport-fallback">3D Vector Space requires WebGL support.</div>`;
      return;
    }

    this.isSoftwareGl = detectSoftwareWebGL();
    this.mode = "arrows"; // "arrows" | "points"
    this.showAnchors = true;
    this.autoRotate = false;
    this.selectedTokens = []; // Max 2 tokens for pairwise cosine similarity
    this.ropeAngleOffset = 0;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.resizeObserver = null;
    this.userInteracted = false;
    this.frameId = 0;
    this.renderBusy = false;
    this.renderDirty = false;
    this.contextLost = false;
    this.plotScale = 3.0;
    this.axesLen = 3.4;

    try {
      this.raycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2();
      this.tokenNodesGroup = new THREE.Group();
      this.anchorNodesGroup = new THREE.Group();
      this.vectorLinesGroup = new THREE.Group();
      this.similarityArcGroup = new THREE.Group();
      this.labelsContainer = null;

      this.nodeMeshes = [];
      this.interactiveObjects = [];

      this.initScene();
      this.bindEvents();
      this.observeContainer();
      this.fitCameraToScene();
      this.requestRender();
    } catch (e) {
      console.error("WebGL 3D Viewport error:", e);
      this.container.innerHTML = `<div class="viewport-fallback">WebGL could not be initialized in this browser.</div>`;
    }
  }

  getContainerSize() {
    if (!this.container) return { width: 520, height: 460 };
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(220, Math.round(rect.width || this.container.clientWidth || 520));
    const height = Math.max(280, Math.round(rect.height || this.container.clientHeight || 460));
    return { width, height };
  }

  initScene() {
    const { width, height } = this.getContainerSize();

    this.scene = new THREE.Scene();
    const isLight = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light";
    const bgHex = isLight ? 0x181816 : 0x0E0E0C;
    this.scene.background = new THREE.Color(bgHex);
    this.scene.fog = new THREE.FogExp2(bgHex, 0.015);

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    this.camera.position.set(8.5, 6.2, 10.6);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(width, height, true);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    if ("outputColorSpace" in this.renderer && THREE.SRGBColorSpace) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.renderer.domElement.className = "three-canvas";
    this.renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.contextLost = true;
    });
    this.renderer.domElement.addEventListener("webglcontextrestored", () => {
      this.contextLost = false;
      this.requestRender();
    });

    this.container.insertBefore(this.renderer.domElement, this.container.firstChild);

    // Semantic DOM labels layer
    this.labelsContainer = document.createElement("div");
    this.labelsContainer.className = "three-labels-container";
    this.container.insertBefore(this.labelsContainer, this.renderer.domElement.nextSibling);

    if (THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = !this.isSoftwareGl;
      this.controls.dampingFactor = 0.07;
      this.controls.maxDistance = 28;
      this.controls.minDistance = 4.5;
      this.controls.addEventListener("start", () => {
        this.userInteracted = true;
      });
      this.controls.addEventListener("change", () => this.requestRender());
    }

    // Warm/Neutral 3-point lighting rig
    const hemiLight = new THREE.HemisphereLight(0xFEF3C7, 0x1C1B18, 0.85);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xFFFBEB, 1.15);
    keyLight.position.set(6, 10, 7);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xFB923C, 0.72);
    rimLight.position.set(-6, -4, -6);
    this.scene.add(rimLight);

    // Subtle spatial floor grid sized to match vector bounds
    const gridHelper = new THREE.GridHelper(7.2, 16, 0x3D3B35, 0x24231F);
    gridHelper.position.y = -0.02;
    this.scene.add(gridHelper);

    this.createAxes();

    this.scene.add(this.anchorNodesGroup);
    this.scene.add(this.tokenNodesGroup);
    this.scene.add(this.vectorLinesGroup);
    this.scene.add(this.similarityArcGroup);

    const originGeo = new THREE.SphereGeometry(0.11, 16, 16);
    const originMat = new THREE.MeshStandardMaterial({
      color: 0xCBD5E1,
      roughness: 0.3,
      metalness: 0.6
    });
    const originMesh = new THREE.Mesh(originGeo, originMat);
    this.scene.add(originMesh);

    this.renderBackgroundAnchors();
  }

  createAxes() {
    const axesLen = this.axesLen;
    const axisSpecs = [
      { pts: [new THREE.Vector3(-axesLen, 0, 0), new THREE.Vector3(axesLen, 0, 0)], color: 0xF87171 },
      { pts: [new THREE.Vector3(0, -axesLen, 0), new THREE.Vector3(0, axesLen, 0)], color: 0x34D399 },
      { pts: [new THREE.Vector3(0, 0, -axesLen), new THREE.Vector3(0, 0, axesLen)], color: 0x38BDF8 }
    ];
    axisSpecs.forEach(({ pts, color }) => {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.42 });
      this.scene.add(new THREE.Line(geo, mat));
    });
  }

  renderBackgroundAnchors() {
    this.anchorNodesGroup.clear();
    const anchorGeo = new THREE.SphereGeometry(0.08, 12, 12);

    (BACKGROUND_ANCHORS || []).forEach(anchor => {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(anchor.color || "#64748B"),
        transparent: true,
        opacity: 0.42
      });
      const mesh = new THREE.Mesh(anchorGeo, mat);
      const scale = this.plotScale;
      mesh.position.set(anchor.pos[0] * scale, anchor.pos[1] * scale, anchor.pos[2] * scale);
      mesh.userData = {
        isAnchor: true,
        text: anchor.text,
        cluster: anchor.cluster,
        rawPos: anchor.pos
      };
      this.anchorNodesGroup.add(mesh);
      this.interactiveObjects.push(mesh);
    });
  }

  observeContainer() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (typeof ResizeObserver !== "undefined" && this.container) {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      this.resizeObserver.observe(this.container);
    }
  }

  mountTo(containerOrId) {
    const nextContainer = typeof containerOrId === "string"
      ? document.getElementById(containerOrId)
      : containerOrId;
    if (!nextContainer || !this.renderer) return;

    this.container = nextContainer;
    if (!nextContainer.contains(this.renderer.domElement)) {
      nextContainer.insertBefore(this.renderer.domElement, nextContainer.firstChild);
    }
    if (this.labelsContainer && !nextContainer.contains(this.labelsContainer)) {
      nextContainer.insertBefore(this.labelsContainer, this.renderer.domElement.nextSibling);
    }
    this.observeContainer();
    this.handleResize();
    if (!this.userInteracted) {
      this.fitCameraToScene();
    }
    this.requestRender();
  }

  fitCameraToScene() {
    if (!this.camera) return;
    const { width, height } = this.getContainerSize();
    const aspect = width / height;

    let maxRadius = this.axesLen + 0.35;
    if (this.nodeMeshes && this.nodeMeshes.length > 0) {
      this.nodeMeshes.forEach(mesh => {
        const distFromOrigin = mesh.position.length() + 0.65;
        if (distFromOrigin > maxRadius) maxRadius = distFromOrigin;
      });
    }

    const fitDist = computeCameraFitDistance(maxRadius, this.camera.fov, aspect, 1.36);
    const dir = new THREE.Vector3(0.58, 0.42, 0.70).normalize();
    this.camera.position.copy(dir.multiplyScalar(fitDist));
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    if (this.controls) {
      // Shift target slightly down so graph sits visually centered below the top toolbar
      this.controls.target.set(0, -0.15, 0);
      this.controls.update();
    } else {
      this.camera.lookAt(0, -0.15, 0);
    }
  }

  updateTokens(tokens, d_model = 8, ropeAngleOffset = 0) {
    if (!this.tokenNodesGroup || !this.scene) return;
    this.tokens = tokens || [];
    this.ropeAngleOffset = ropeAngleOffset;
    this.tokenNodesGroup.clear();
    this.vectorLinesGroup.clear();
    this.similarityArcGroup.clear();
    if (this.labelsContainer) this.labelsContainer.innerHTML = "";
    this.nodeMeshes = [];
    this.selectedTokens = [];

    this.interactiveObjects = this.interactiveObjects.filter(obj => obj.userData && obj.userData.isAnchor);

    const scale = this.plotScale;
    const origin = new THREE.Vector3(0, 0, 0);

    const palette = [
      0xFB923C, // Signal Orange
      0x34D399, // Emerald
      0xFACC15, // Marigold Gold
      0x38BDF8, // Cerulean Sky
      0xA3E635, // Bright Lime
      0x2DD4BF, // Teal
      0xF87171, // Coral Red
      0xF59E0B  // Warm Amber
    ];

    const sphereGeo = new THREE.SphereGeometry(0.18, 20, 20);
    const ringGeo = new THREE.RingGeometry(0.24, 0.29, 24);

    this.tokens.forEach((token, index) => {
      let [x, y, z] = token.vectorHint || [0, 0, 0];

      if (ropeAngleOffset > 0) {
        const theta = (index * ropeAngleOffset * Math.PI) / 180;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const newX = x * cosT - z * sinT;
        const newZ = x * sinT + z * cosT;
        x = newX;
        z = newZ;
      }

      const pos = new THREE.Vector3(x * scale, y * scale, z * scale);
      const colorHex = palette[index % palette.length];
      const hexStr = "#" + colorHex.toString(16).padStart(6, "0");

      const sphereMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.45,
        roughness: 0.25,
        metalness: 0.5
      });
      const nodeMesh = new THREE.Mesh(sphereGeo, sphereMat);
      nodeMesh.position.copy(pos);
      nodeMesh.userData = {
        isToken: true,
        token,
        tokenIndex: index,
        pos3D: pos,
        colorHex
      };
      this.tokenNodesGroup.add(nodeMesh);
      this.nodeMeshes.push(nodeMesh);
      this.interactiveObjects.push(nodeMesh);

      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.lookAt(this.camera.position);
      this.tokenNodesGroup.add(ring);
      nodeMesh.userData.haloRing = ring;

      if (this.mode === "arrows") {
        const length = pos.length();
        if (length > 0.05) {
          const dir = pos.clone().normalize();
          const arrowHelper = new THREE.ArrowHelper(dir, origin, length, colorHex, 0.34, 0.18);
          this.vectorLinesGroup.add(arrowHelper);
        }
      } else {
        const dropPoints = [pos, new THREE.Vector3(pos.x, 0, pos.z)];
        const dropGeo = new THREE.BufferGeometry().setFromPoints(dropPoints);
        const dropMat = new THREE.LineDashedMaterial({
          color: colorHex,
          dashSize: 0.12,
          gapSize: 0.06,
          transparent: true,
          opacity: 0.45
        });
        const dropLine = new THREE.Line(dropGeo, dropMat);
        dropLine.computeLineDistances();
        this.vectorLinesGroup.add(dropLine);
      }

      if (this.labelsContainer) {
        const label = document.createElement("button");
        label.type = "button";
        label.className = "three-node-label";
        label.style.borderColor = hexStr;
        label.style.color = hexStr;
        label.textContent = `${index}: "${token.text}"`;
        label.title = `Click to select "${token.text}"`;
        label.onclick = (e) => {
          e.stopPropagation();
          this.handleNodeClick(nodeMesh);
        };
        this.labelsContainer.appendChild(label);
        nodeMesh.userData.domLabel = label;
      }
    });

    // Keep the 3D meaning map clean and unobstructed on initial load;
    // clicking any 2 word labels opens the pairwise arc & angle HUD.
    this.selectedTokens = [];

    this.refreshPairwiseArc();
    if (!this.userInteracted) {
      this.fitCameraToScene();
    }
    this.requestRender();
  }

  bindEvents() {
    window.addEventListener("resize", () => this.handleResize());

    this.renderer.domElement.addEventListener("click", (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.interactiveObjects);

      if (intersects.length > 0) {
        this.handleNodeClick(intersects[0].object);
      }
    });
  }

  handleNodeClick(mesh) {
    if (!mesh || !mesh.userData) return;

    if (mesh.userData.isToken) {
      const existingIdx = this.selectedTokens.indexOf(mesh);
      if (existingIdx !== -1) {
        this.selectedTokens.splice(existingIdx, 1);
      } else {
        if (this.selectedTokens.length >= 2) {
          this.selectedTokens.shift();
        }
        this.selectedTokens.push(mesh);
      }
      this.refreshPairwiseArc();
      this.triggerTokenSelectedCallback(mesh.userData.token, mesh.userData.tokenIndex);
      this.requestRender();
    }
  }

  selectTokenByIndex(index) {
    if (!this.nodeMeshes) return;
    const mesh = this.nodeMeshes.find(m => m.userData.tokenIndex === index);
    if (mesh) {
      this.selectedTokens = [mesh];
      this.refreshPairwiseArc();
      this.requestRender();
    }
  }

  selectPairByWords(wordA, wordB) {
    if (!this.nodeMeshes || !wordA || !wordB) return;
    const a = String(wordA).toLowerCase();
    const b = String(wordB).toLowerCase();
    const meshA = this.nodeMeshes.find(m => m.userData.token && m.userData.token.text.toLowerCase() === a);
    const meshB = this.nodeMeshes.find(m => m.userData.token && m.userData.token.text.toLowerCase() === b);
    if (meshA && meshB && meshA !== meshB) {
      this.selectedTokens = [meshA, meshB];
      this.refreshPairwiseArc();
      this.requestRender();
    }
  }

  clearSelection() {
    this.selectedTokens = [];
    this.refreshPairwiseArc();
    this.requestRender();
  }

  refreshPairwiseArc() {
    this.similarityArcGroup.clear();

    this.nodeMeshes.forEach(m => {
      if (m.userData.haloRing) {
        m.userData.haloRing.scale.set(1, 1, 1);
        m.userData.haloRing.material.opacity = 0.55;
      }
      if (m.userData.domLabel) {
        m.userData.domLabel.classList.remove("is-selected");
      }
    });

    this.selectedTokens.forEach(m => {
      if (m.userData.haloRing) {
        m.userData.haloRing.scale.set(1.55, 1.55, 1.55);
        m.userData.haloRing.material.opacity = 1.0;
      }
      if (m.userData.domLabel) {
        m.userData.domLabel.classList.add("is-selected");
      }
    });

    const hudCard = document.getElementById("vectorSpaceHUD");

    if (this.selectedTokens.length === 2) {
      const meshA = this.selectedTokens[0];
      const meshB = this.selectedTokens[1];
      const posA = meshA.position;
      const posB = meshB.position;

      const numPoints = 32;
      const points = [];
      for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const p = new THREE.Vector3().lerpVectors(posA, posB, t);
        p.y += Math.sin(t * Math.PI) * 0.75;
        points.push(p);
      }

      const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
      const arcMat = new THREE.LineBasicMaterial({
        color: 0x34D399,
        transparent: true,
        opacity: 0.95
      });
      this.similarityArcGroup.add(new THREE.Line(arcGeo, arcMat));

      const tokenA = meshA.userData.token;
      const tokenB = meshB.userData.token;
      const vecA = tokenA.vectorHint || [posA.x, posA.y, posA.z];
      const vecB = tokenB.vectorHint || [posB.x, posB.y, posB.z];

      const cosSim = MathEngine.cosineSimilarity(vecA, vecB);
      const angleDeg = MathEngine.angleBetween(vecA, vecB);
      const dist = MathEngine.euclideanDistance(vecA, vecB);
      const dotProd = MathEngine.dot(vecA, vecB);

      if (hudCard) {
        hudCard.innerHTML = `
          <div class="hud-header">
            <span class="hud-title">3D Angle & Similarity</span>
            <button type="button" onclick="if(window.vectorView) window.vectorView.clearSelection()" class="hud-close-btn" aria-label="Clear selection">&times; Clear</button>
          </div>
          <div class="hud-token-pair">
            <span class="hud-token-a">"${tokenA.text}"</span>
            <span aria-hidden="true">&harr;</span>
            <span class="hud-token-b">"${tokenB.text}"</span>
          </div>
          <div class="hud-grid">
            <div class="hud-stat-card">
              <div class="hud-stat-label">Cosine Sim.</div>
              <div class="hud-stat-val tabular-nums">${cosSim.toFixed(3)}</div>
            </div>
            <div class="hud-stat-card">
              <div class="hud-stat-label">Angle</div>
              <div class="hud-stat-val tabular-nums">${angleDeg.toFixed(1)}&deg;</div>
            </div>
            <div class="hud-stat-card">
              <div class="hud-stat-label">Dot Product</div>
              <div class="hud-stat-val tabular-nums">${dotProd.toFixed(2)}</div>
            </div>
            <div class="hud-stat-card">
              <div class="hud-stat-label">Distance</div>
              <div class="hud-stat-val tabular-nums">${dist.toFixed(2)}</div>
            </div>
          </div>
          <div class="hud-footer-note">
            ${cosSim > 0.65 ? "Close neighbors in meaning" : cosSim < 0 ? "Pointing in opposite directions" : "Distinct conceptual directions"}
          </div>
        `;
        hudCard.classList.remove("hidden");
      }
    } else if (this.selectedTokens.length === 1) {
      const token = this.selectedTokens[0].userData.token;
      if (hudCard) {
        hudCard.innerHTML = `
          <div class="hud-header">
            <span class="hud-title">1st Word Selected</span>
            <button type="button" onclick="if(window.vectorView) window.vectorView.clearSelection()" class="hud-close-btn" aria-label="Clear selection">&times;</button>
          </div>
          <div style="font-size:12px; color:#E2E8F0; margin-bottom:4px;">Selected: <strong>"${token.text}"</strong> <span class="mono" style="opacity:0.75;">(#${token.id})</span></div>
          <div class="hud-footer-note">Click any second word node to measure angle and similarity.</div>
        `;
        hudCard.classList.remove("hidden");
      }
    } else if (hudCard) {
      hudCard.classList.add("hidden");
    }
  }

  triggerTokenSelectedCallback(token, index) {
    if (window.on3DTokenSelected) {
      window.on3DTokenSelected(token, index);
    }
  }

  handleResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    if (!document.body.contains(this.container)) return;
    const { width, height } = this.getContainerSize();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, true);
    if (!this.userInteracted) {
      this.fitCameraToScene();
    }
    this.requestRender();
  }

  setMode(mode) {
    this.toggleMode(mode);
  }

  toggleMode(mode) {
    this.mode = mode === "points" ? "points" : "arrows";
    if (this.tokens) {
      this.updateTokens(this.tokens, 8, this.ropeAngleOffset);
    }
  }

  toggleAnchors(show) {
    if (typeof show === "boolean") {
      this.showAnchors = show;
    } else {
      this.showAnchors = !this.showAnchors;
    }
    if (this.anchorNodesGroup) {
      this.anchorNodesGroup.visible = this.showAnchors;
    }
    this.requestRender();
    return this.showAnchors;
  }

  toggleAutoRotate(enable) {
    this.autoRotate = typeof enable === "boolean" ? enable : !this.autoRotate;
    if (this.controls) {
      this.controls.autoRotate = this.autoRotate && !this.isSoftwareGl;
    }
    if (this.autoRotate) {
      this.requestRender();
    }
    return this.autoRotate;
  }

  resetCamera() {
    this.userInteracted = false;
    if (this.controls) {
      this.controls.reset();
    }
    this.fitCameraToScene();
    this.requestRender();
  }

  setTheme(theme) {
    if (!this.scene) return;
    const isLight = theme === "light";
    const bgHex = isLight ? 0x181816 : 0x0E0E0C;
    this.scene.background = new THREE.Color(bgHex);
    this.scene.fog = new THREE.FogExp2(bgHex, 0.015);
    this.requestRender();
  }

  updateProjectedLabels() {
    if (!this.nodeMeshes || !this.camera || !this.renderer || !_projVec) return;
    const { width, height } = this.getContainerSize();
    const halfW = width / 2;
    const halfH = height / 2;
    const padX = 8;
    const padTop = 52;
    const padBottom = 10;

    this.nodeMeshes.forEach(mesh => {
      const label = mesh.userData.domLabel;
      if (!label) return;
      _projVec.copy(mesh.position).project(this.camera);

      const inFrustum = (
        _projVec.z >= -1 &&
        _projVec.z <= 1 &&
        _projVec.x >= -1.02 &&
        _projVec.x <= 1.02 &&
        _projVec.y >= -1.02 &&
        _projVec.y <= 1.02
      );

      if (inFrustum) {
        label.style.display = "block";
        const labelW = label.offsetWidth || 72;
        const labelH = label.offsetHeight || 22;
        const rawX = (_projVec.x * halfW) + halfW + 10;
        const rawY = -(_projVec.y * halfH) + halfH - 12;
        const clampedX = Math.max(padX, Math.min(width - labelW - padX, rawX));
        const clampedY = Math.max(padTop, Math.min(height - labelH - padBottom, rawY));
        label.style.left = `${Math.round(clampedX)}px`;
        label.style.top = `${Math.round(clampedY)}px`;
      } else {
        label.style.display = "none";
      }

      if (mesh.userData.haloRing) {
        mesh.userData.haloRing.lookAt(this.camera.position);
      }
    });
  }

  afterDraw(cb) {
    try {
      const gl = this.renderer.getContext();
      if (typeof gl.fenceSync === "function" && typeof gl.SYNC_GPU_COMMANDS_COMPLETE !== "undefined") {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            this.frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            this.frameId = window.setTimeout(cb, 80);
          }
        };
        this.frameId = window.setTimeout(poll, 5);
        return;
      }
    } catch (e) {
      // Fallback below
    }
    this.frameId = window.setTimeout(cb, 80);
  }

  requestRender() {
    if (this.contextLost || !this.renderer || !this.scene || !this.camera) return;
    if (this.renderBusy) {
      this.renderDirty = true;
      return;
    }
    this.renderBusy = true;
    this.frameId = requestAnimationFrame(() => {
      this.renderDirty = false;
      if (this.controls) {
        this.controls.autoRotate = this.autoRotate && !this.isSoftwareGl;
        this.controls.update();
      }
      this.updateProjectedLabels();
      this.renderer.render(this.scene, this.camera);

      const done = () => {
        this.renderBusy = false;
        if (this.renderDirty || (this.autoRotate && !this.isSoftwareGl)) {
          this.requestRender();
        }
      };

      if (this.isSoftwareGl) {
        this.afterDraw(done);
      } else {
        done();
      }
    });
  }
}

if (typeof window !== "undefined") {
  window.VectorSpace3D = VectorSpace3D;
  window.computeCameraFitDistance = computeCameraFitDistance;
  window.initThreeViewport = function(containerId) {
    if (typeof VectorSpace3D !== "undefined") {
      window.vectorView = new VectorSpace3D(containerId || "threeViewportContainer");
      return window.vectorView;
    }
  };
}

if (typeof global !== "undefined") {
  global.VectorSpace3D = VectorSpace3D;
  global.computeCameraFitDistance = computeCameraFitDistance;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    VectorSpace3D,
    computeCameraFitDistance
  };
}
