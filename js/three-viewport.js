/**
 * 3D Vector Space Viewport using Three.js
 * Implements interactive 3D coordinate plotting, orbit controls, origin vector arrows,
 * point clouds, raycasting node selection, cosine similarity connecting arcs, and HUD metrics.
 */

class VectorSpace3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    if (typeof THREE === "undefined") {
      console.warn("Three.js not available");
      this.container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:#9CA3AF; font-size:13px; font-family:'JetBrains Mono', monospace;">3D Vector space initializing...</div>`;
      return;
    }

    this.mode = "arrows"; // "arrows" or "points"
    this.showAnchors = true;
    this.autoRotate = false;
    this.selectedTokens = []; // Max 2 tokens for pairwise cosine similarity

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
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
      this.animate = this.animate.bind(this);
      requestAnimationFrame(this.animate);
    } catch (e) {
      console.error("WebGL 3D Viewport error:", e);
      this.container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:#F43F5E; font-size:12px; font-family:'JetBrains Mono', monospace;">WebGL not supported or blocked in this browser.</div>`;
    }
  }

  initScene() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 500;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0B0F19); // Theme background
    this.scene.fog = new THREE.FogExp2(0x0B0F19, 0.035);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(7, 5, 9);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.container.appendChild(this.renderer.domElement);

    // 4. HTML Labels Overlay Container
    this.labelsContainer = document.createElement("div");
    this.labelsContainer.className = "three-labels-container";
    this.container.appendChild(this.labelsContainer);

    // 5. Controls
    if (THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxDistance = 25;
      this.controls.minDistance = 2;
    }

    // 6. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x06B6D4, 1.2);
    dirLight1.position.set(5, 10, 7);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x8B5CF6, 0.8);
    dirLight2.position.set(-5, -5, -5);
    this.scene.add(dirLight2);

    // 7. Coordinate Grid & Axes
    const gridHelper = new THREE.GridHelper(10, 20, 0x1F2937, 0x111827);
    gridHelper.position.y = -0.01;
    this.scene.add(gridHelper);

    // Custom Glowing 3D Axes
    this.createAxes();

    // 8. Groups
    this.scene.add(this.anchorNodesGroup);
    this.scene.add(this.tokenNodesGroup);
    this.scene.add(this.vectorLinesGroup);
    this.scene.add(this.similarityArcGroup);

    // Origin Sphere
    const originGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const originMat = new THREE.MeshBasicMaterial({ color: 0x9CA3AF, wireframe: true });
    const originMesh = new THREE.Mesh(originGeo, originMat);
    this.scene.add(originMesh);

    // Render background semantic anchors
    this.renderBackgroundAnchors();
  }

  createAxes() {
    const axesLen = 4.5;
    // X (Red/Rose)
    const xGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-axesLen, 0, 0), new THREE.Vector3(axesLen, 0, 0)]);
    const xMat = new THREE.LineBasicMaterial({ color: 0xF43F5E, transparent: true, opacity: 0.4 });
    this.scene.add(new THREE.Line(xGeo, xMat));

    // Y (Emerald Green)
    const yGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -axesLen, 0), new THREE.Vector3(0, axesLen, 0)]);
    const yMat = new THREE.LineBasicMaterial({ color: 0x10B981, transparent: true, opacity: 0.4 });
    this.scene.add(new THREE.Line(yGeo, yMat));

    // Z (Cyan)
    const zGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -axesLen), new THREE.Vector3(0, 0, axesLen)]);
    const zMat = new THREE.LineBasicMaterial({ color: 0x06B6D4, transparent: true, opacity: 0.4 });
    this.scene.add(new THREE.Line(zGeo, zMat));
  }

  renderBackgroundAnchors() {
    this.anchorNodesGroup.clear();
    const anchorGeo = new THREE.SphereGeometry(0.08, 12, 12);

    BACKGROUND_ANCHORS.forEach(anchor => {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(anchor.color || "#4B5563"),
        transparent: true,
        opacity: 0.35
      });
      const mesh = new THREE.Mesh(anchorGeo, mat);
      const scale = 3.6;
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

  updateTokens(tokens, d_model = 8, ropeAngleOffset = 0) {
    if (!this.tokenNodesGroup || !this.scene) return;
    this.tokens = tokens;
    this.tokenNodesGroup.clear();
    this.vectorLinesGroup.clear();
    this.similarityArcGroup.clear();
    this.labelsContainer.innerHTML = "";
    this.nodeMeshes = [];

    // Filter interactive objects to keep anchors
    this.interactiveObjects = this.interactiveObjects.filter(obj => obj.userData?.isAnchor);

    const scale = 4.0;
    const origin = new THREE.Vector3(0, 0, 0);

    // Color gradient palette for sequence order
    const colors = [
      0x06B6D4, // Cyan
      0x3B82F6, // Blue
      0x8B5CF6, // Purple
      0xEC4899, // Pink
      0x10B981, // Emerald
      0xF59E0B, // Amber
      0x14B8A6, // Teal
      0x6366F1  // Indigo
    ];

    tokens.forEach((token, index) => {
      let [x, y, z] = token.vectorHint || [0, 0, 0];

      // If RoPE is activated, rotate subspace X-Z or X-Y based on sequence position
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
      const colorHex = colors[index % colors.length];

      // 1. Sphere Mesh
      const sphereGeo = new THREE.SphereGeometry(0.18, 24, 24);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.8
      });
      const nodeMesh = new THREE.Mesh(sphereGeo, sphereMat);
      nodeMesh.position.copy(pos);
      nodeMesh.userData = {
        isToken: true,
        token: token,
        tokenIndex: index,
        pos3D: pos,
        colorHex: colorHex
      };
      this.tokenNodesGroup.add(nodeMesh);
      this.nodeMeshes.push(nodeMesh);
      this.interactiveObjects.push(nodeMesh);

      // Outer Halo Ring
      const ringGeo = new THREE.RingGeometry(0.24, 0.28, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.lookAt(this.camera.position);
      this.tokenNodesGroup.add(ring);
      nodeMesh.userData.haloRing = ring;

      // 2. Vector Arrow (if mode == 'arrows')
      if (this.mode === "arrows") {
        const dir = pos.clone().normalize();
        const length = pos.length();
        if (length > 0.05) {
          const arrowHelper = new THREE.ArrowHelper(dir, origin, length, colorHex, 0.35, 0.2);
          this.vectorLinesGroup.add(arrowHelper);
        }
      } else {
        // Drop line to floor plane
        const dropPoints = [pos, new THREE.Vector3(pos.x, 0, pos.z)];
        const dropGeo = new THREE.BufferGeometry().setFromPoints(dropPoints);
        const dropMat = new THREE.LineDashedMaterial({
          color: colorHex,
          dashSize: 0.1,
          gapSize: 0.05,
          transparent: true,
          opacity: 0.35
        });
        const dropLine = new THREE.Line(dropGeo, dropMat);
        dropLine.computeLineDistances();
        this.vectorLinesGroup.add(dropLine);
      }

      // 3. HTML 2D Label
      const label = document.createElement("div");
      label.className = "three-node-label";
      label.style.backgroundColor = "rgba(17, 24, 39, 0.9)";
      label.style.border = `1px solid #${colorHex.toString(16).padStart(6, '0')}`;
      label.style.color = `#${colorHex.toString(16).padStart(6, '0')}`;
      label.innerHTML = `[${index}] "${token.text}"`;
      label.onclick = (e) => {
        e.stopPropagation();
        this.handleNodeClick(nodeMesh);
      };
      this.labelsContainer.appendChild(label);
      nodeMesh.userData.domLabel = label;
    });

    // Re-render pairwise arc if two tokens were previously selected
    this.refreshPairwiseArc();
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
        const clicked = intersects[0].object;
        this.handleNodeClick(clicked);
      }
    });
  }

  handleNodeClick(mesh) {
    if (!mesh.userData) return;

    if (mesh.userData.isToken) {
      // Toggle selection (maintain up to 2 selected tokens)
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
    }
  }

  selectTokenByIndex(index) {
    if (!this.nodeMeshes) return;
    const mesh = this.nodeMeshes.find(m => m.userData.tokenIndex === index);
    if (mesh) {
      this.selectedTokens = [mesh];
      this.refreshPairwiseArc();
    }
  }

  refreshPairwiseArc() {
    this.similarityArcGroup.clear();

    // Reset halos
    this.nodeMeshes.forEach(m => {
      if (m.userData.haloRing) {
        m.userData.haloRing.scale.set(1, 1, 1);
        m.userData.haloRing.material.opacity = 0.5;
      }
      if (m.userData.domLabel) {
        m.userData.domLabel.style.transform = "scale(1)";
      }
    });

    this.selectedTokens.forEach(m => {
      if (m.userData.haloRing) {
        m.userData.haloRing.scale.set(1.5, 1.5, 1.5);
        m.userData.haloRing.material.opacity = 1.0;
      }
      if (m.userData.domLabel) {
        m.userData.domLabel.style.transform = "scale(1.15)";
      }
    });

    const hudCard = document.getElementById("vectorSpaceHUD");

    if (this.selectedTokens.length === 2) {
      const meshA = this.selectedTokens[0];
      const meshB = this.selectedTokens[1];
      const posA = meshA.position;
      const posB = meshB.position;

      // Draw connecting arc in 3D
      const numPoints = 32;
      const points = [];
      for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        // Interpolate along sphere or direct bezier arc
        const p = new THREE.Vector3().lerpVectors(posA, posB, t);
        const arcLift = Math.sin(t * Math.PI) * 0.8;
        p.y += arcLift;
        points.push(p);
      }

      const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
      const arcMat = new THREE.LineBasicMaterial({
        color: 0x10B981,
        linewidth: 3,
        transparent: true,
        opacity: 0.95
      });
      const arcLine = new THREE.Line(arcGeo, arcMat);
      this.similarityArcGroup.add(arcLine);

      // Compute pairwise math
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
            <span class="hud-title">Pairwise Cosine Metric</span>
            <button onclick="if(window.vectorView){ window.vectorView.selectedTokens = []; window.vectorView.refreshPairwiseArc(); }" class="hud-close-btn">&times; Clear</button>
          </div>
          <div class="hud-token-pair">
            <span class="hud-token-pill hud-token-a">"${tokenA.text}"</span>
            <span class="hud-arrow">&harr;</span>
            <span class="hud-token-pill hud-token-b">"${tokenB.text}"</span>
          </div>
          <div class="hud-grid">
            <div class="hud-stat-card">
              <div class="hud-stat-label">Cosine Similarity:</div>
              <div class="hud-stat-val ${cosSim > 0.5 ? 'text-green' : cosSim < 0 ? 'text-rose' : 'text-blue'}">
                ${cosSim.toFixed(4)}
              </div>
            </div>
            <div class="hud-stat-card">
              <div class="hud-stat-label">Angle (&theta;):</div>
              <div class="hud-stat-val text-purple">${angleDeg.toFixed(1)}&deg;</div>
            </div>
            <div class="hud-stat-card">
              <div class="hud-stat-label">Dot Product (u &middot; v):</div>
              <div class="hud-stat-val">${dotProd.toFixed(3)}</div>
            </div>
            <div class="hud-stat-card">
              <div class="hud-stat-label">Euclidean Dist:</div>
              <div class="hud-stat-val">${dist.toFixed(3)}</div>
            </div>
          </div>
          <div class="hud-footer-note">
            ${cosSim > 0.7 ? '● High semantic similarity (clustered vectors)' : cosSim < 0 ? '● Opposite direction in latent space' : '● Independent conceptual axes'}
          </div>
        `;
        hudCard.classList.remove("hidden");
      }
    } else if (this.selectedTokens.length === 1) {
      const mesh = this.selectedTokens[0];
      const token = mesh.userData.token;
      if (hudCard) {
        hudCard.innerHTML = `
          <div class="hud-header">
            <span class="hud-title">Vector Selected</span>
            <button onclick="if(window.vectorView){ window.vectorView.selectedTokens = []; window.vectorView.refreshPairwiseArc(); }" class="hud-close-btn">&times;</button>
          </div>
          <div style="font-size:12px; margin-bottom:4px;">Token: <strong class="text-blue">"${token.text}"</strong> <span class="mono" style="opacity:0.7;">(ID: #${token.id})</span></div>
          <div class="hud-footer-note">Click any second token to measure real-time 3D Cosine Similarity & Angle.</div>
        `;
        hudCard.classList.remove("hidden");
      }
    } else {
      if (hudCard) hudCard.classList.add("hidden");
    }
  }

  triggerTokenSelectedCallback(token, index) {
    if (window.on3DTokenSelected) {
      window.on3DTokenSelected(token, index);
    }
  }

  handleResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  toggleMode(mode) {
    this.mode = mode; // "arrows" or "points"
    if (this.tokens) {
      this.updateTokens(this.tokens);
    }
  }

  toggleAnchors(show) {
    this.showAnchors = show;
    this.anchorNodesGroup.visible = show;
  }

  resetCamera() {
    if (this.controls) {
      this.controls.reset();
      this.camera.position.set(7, 5, 9);
      this.controls.target.set(0, 0, 0);
    }
  }

  animate() {
    requestAnimationFrame(this.animate);

    if (this.controls) {
      this.controls.autoRotate = this.autoRotate;
      this.controls.update();
    }

    // Update 2D labels positions in screen space
    if (this.nodeMeshes && this.camera && this.renderer) {
      const halfW = this.renderer.domElement.clientWidth / 2;
      const halfH = this.renderer.domElement.clientHeight / 2;

      this.nodeMeshes.forEach(mesh => {
        if (!mesh.userData.domLabel) return;
        const tempV = mesh.position.clone();
        tempV.project(this.camera);

        // Check if node is in front of camera
        if (tempV.z < 1) {
          const x = (tempV.x * halfW) + halfW;
          const y = -(tempV.y * halfH) + halfH;
          mesh.userData.domLabel.style.left = `${x + 10}px`;
          mesh.userData.domLabel.style.top = `${y - 12}px`;
          mesh.userData.domLabel.style.display = "block";
        } else {
          mesh.userData.domLabel.style.display = "none";
        }

        // Keep halo facing camera
        if (mesh.userData.haloRing) {
          mesh.userData.haloRing.lookAt(this.camera.position);
        }
      });
    }

    this.renderer.render(this.scene, this.camera);
  }
}

if (typeof window !== "undefined") {
  window.VectorSpace3D = VectorSpace3D;
  window.initThreeViewport = function(containerId) {
    if (typeof VectorSpace3D !== "undefined") {
      window.vectorView = new VectorSpace3D(containerId || "threeViewportContainer");
      return window.vectorView;
    }
  };
}

if (typeof global !== "undefined") {
  global.VectorSpace3D = VectorSpace3D;
}

