import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const PRODUCTS = {
  sofa: {
    id: "sofa",
    name: "Modern Sofa",
    emoji: "🛋️",
    url: "./models/sofa.glb",
    surface: "floor",
    colors: [0x7a7f88, 0xb49b7d, 0x4f6d8a, 0x8b5e4a],
  },
  chair: {
    id: "chair",
    name: "Lounge Chair",
    emoji: "🪑",
    url: "./models/chair.glb",
    surface: "floor",
    colors: [0x9a795b, 0x6b7280, 0x57705b, 0x97665b],
  },
  table: {
    id: "table",
    name: "Coffee Table",
    emoji: "▰",
    url: "./models/table.glb",
    surface: "floor",
    colors: [0xa77a50, 0x6f4c35, 0xb68a61, 0x5d6670],
  },
  plant: {
    id: "plant",
    name: "Indoor Plant",
    emoji: "🌿",
    url: "./models/plant.glb",
    surface: "floor",
    colors: [0x4b8b5d, 0x3c7a57, 0x6c8f55, 0x4f7650],
  },
  curtain: {
    id: "curtain",
    name: "Curtain Set",
    emoji: "🪟",
    url: "./models/curtain.glb",
    surface: "wall",
    colors: [0xd8c5a5, 0xa9b6c7, 0x8fa49a, 0xc8a7ad, 0xe5e7eb],
  },
};

const MODEL_FRONT_OFFSET = Math.PI;

/*
 * Floor-placement validation.
 *
 * Some WebXR runtimes do not provide a reliable surface orientation for every
 * hit and return an upright rotation instead. Checking only the hit-pose normal
 * therefore lets a wall look like a floor. These limits add two independent
 * checks in local-floor space.
 */
const FLOOR_NORMAL_MIN_Y = 0.7;
const MIN_FLOOR_DISTANCE_BELOW_CAMERA = 0.4;

const els = {
  stage: document.querySelector("#stage"),
  uiOverlay: document.querySelector("#uiOverlay"),
  statusDot: document.querySelector("#statusDot"),
  statusTitle: document.querySelector("#statusTitle"),
  statusText: document.querySelector("#statusText"),
  startPanel: document.querySelector("#startPanel"),
  arButtonMount: document.querySelector("#arButtonMount"),
  supportMessage: document.querySelector("#supportMessage"),
  productRow: document.querySelector("#productRow"),
  tabs: [...document.querySelectorAll(".catalogue-tab")],
  cataloguePanel: document.querySelector("#cataloguePanel"),
  editPanel: document.querySelector("#editPanel"),
  selectedObjectName: document.querySelector("#selectedObjectName"),
  nextObjectButton: document.querySelector("#nextObjectButton"),
  toggleUiButton: document.querySelector("#toggleUiButton"),
  moveButton: document.querySelector("#moveButton"),
  rotateLeftButton: document.querySelector("#rotateLeftButton"),
  rotateRightButton: document.querySelector("#rotateRightButton"),
  scaleDownButton: document.querySelector("#scaleDownButton"),
  scaleUpButton: document.querySelector("#scaleUpButton"),
  colourButton: document.querySelector("#colourButton"),
  deleteButton: document.querySelector("#deleteButton"),
  curtainControls: document.querySelector("#curtainControls"),
  widthDownButton: document.querySelector("#widthDownButton"),
  widthUpButton: document.querySelector("#widthUpButton"),
  heightDownButton: document.querySelector("#heightDownButton"),
  heightUpButton: document.querySelector("#heightUpButton"),
  curtainToggleButton: document.querySelector("#curtainToggleButton"),
  sessionActions: document.querySelector("#sessionActions"),
  placeAnotherButton: document.querySelector("#placeAnotherButton"),
  clearButton: document.querySelector("#clearButton"),
  exitArButton: document.querySelector("#exitArButton"),
  toast: document.querySelector("#toast"),
  helpButton: document.querySelector("#helpButton"),
  helpModal: document.querySelector("#helpModal"),
  closeHelpButton: document.querySelector("#closeHelpButton"),
};

const state = {
  selectedProductId: "sofa",
  filter: "floor",
  selectedObject: null,
  placedObjects: [],
  editMode: "place", // place | move | edit
  xrSession: null,
  hitTestSource: null,
  hitTestSourceRequested: false,
  validHit: false,
  lastHitPosition: new THREE.Vector3(),
  lastHitQuaternion: new THREE.Quaternion(),
  lastSurfaceNormal: new THREE.Vector3(0, 1, 0),
  /*
   * WebXR Anchors
   */
  anchorsEnabled: null,

  /*
   * Real-world depth occlusion
   */
  occlusionMesh: null,
  occlusionReady: false,
  occlusionMessageShown: false,

  toastTimer: null,
  curtainAnimations: [],
  uiCollapsed: false,
  gesture: {
    active: false,
    mode: null,
    moved: false,
    lastX: 0,
    lastY: 0,
    startDistance: 0,
    startAngle: 0,
    startScale: new THREE.Vector3(1, 1, 1),
    startRotationY: 0,
  },
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  70,
  innerWidth / innerHeight,
  0.01,
  50,
);
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local-floor");
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
els.stage.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2.0));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
keyLight.position.set(2, 4, 1);
scene.add(keyLight);

const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.075, 0.095, 48).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({
    color: 0x2dd4bf,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.95,
  }),
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

const controller = renderer.xr.getController(0);
controller.addEventListener("select", onXRSelect);
scene.add(controller);

// Touch interaction helpers for direct manipulation of placed 3D objects.
const touchRaycaster = new THREE.Raycaster();
const touchPointer = new THREE.Vector2();

const loader = new GLTFLoader();
const modelCache = new Map();
// ==========================================
// CURTAIN OPEN / CLOSE SOUND
// ==========================================

const curtainSounds = {
  open: new Audio("./sounds/curtain-open.wav"),
  close: new Audio("./sounds/curtain-close.wav"),
};

Object.values(curtainSounds).forEach((sound) => {
  sound.preload = "auto";
  sound.volume = 0.55;
});

function playCurtainSound(open) {
  const sound = open ? curtainSounds.open : curtainSounds.close;

  sound.pause();
  sound.currentTime = 0;

  sound.play().catch(() => {
    // Some mobile browsers require user interaction first.
  });
}

function selectedProduct() {
  return PRODUCTS[state.selectedProductId];
}

function setStatus(title, text, type = "") {
  els.statusTitle.textContent = title;
  els.statusText.textContent = text;
  els.statusDot.className = `status-dot ${type}`.trim();
}

function toast(message, type = "") {
  clearTimeout(state.toastTimer);
  els.toast.textContent = message;
  els.toast.className = `toast show ${type}`.trim();
  state.toastTimer = setTimeout(() => {
    els.toast.className = "toast";
  }, 2600);
}

function renderProducts() {
  const items = Object.values(PRODUCTS).filter(
    (p) => p.surface === state.filter,
  );
  els.productRow.innerHTML = items
    .map(
      (p) => `
    <button class="product-button ${p.id === state.selectedProductId ? "active" : ""}" data-product="${p.id}" type="button">
      <span class="emoji">${p.emoji}</span>
      <strong>${p.name.replace("Modern ", "").replace("Lounge ", "")}</strong>
      <small>${p.surface === "floor" ? "Floor" : "Wall"}</small>
    </button>
  `,
    )
    .join("");

  els.productRow.querySelectorAll("[data-product]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedProductId = button.dataset.product;
      state.editMode = "place";
      updateMoveButton();
      renderProducts();
      const p = selectedProduct();
      setStatus(
        "Product selected",
        p.surface === "floor"
          ? "Scan a floor and tap the green reticle."
          : "Point at a wall and tap the green reticle.",
        "warn",
      );
    });
  });
}

function selectFilter(filter) {
  state.filter = filter;
  els.tabs.forEach((tab) =>
    tab.classList.toggle("active", tab.dataset.filter === filter),
  );
  const first = Object.values(PRODUCTS).find((p) => p.surface === filter);
  if (first) state.selectedProductId = first.id;
  state.editMode = "place";
  updateMoveButton();
  renderProducts();
}
function setUiCollapsed(collapsed) {
  state.uiCollapsed = Boolean(collapsed);

  // Make the selected-object panel compact
  els.editPanel.classList.toggle("ui-collapsed", state.uiCollapsed);

  // Hide catalogue
  els.cataloguePanel.classList.toggle("ui-collapsed-hidden", state.uiCollapsed);

  // Hide bottom buttons
  els.sessionActions.classList.toggle("ui-collapsed-hidden", state.uiCollapsed);

  if (els.toggleUiButton) {
    els.toggleUiButton.textContent = state.uiCollapsed ? "Show UI" : "Hide UI";

    els.toggleUiButton.setAttribute(
      "aria-expanded",
      String(!state.uiCollapsed),
    );
  }
}

function showEditPanel(object) {
  state.selectedObject = object;

  if (!object) {
    // Restore normal UI when there is no object
    if (state.uiCollapsed) {
      setUiCollapsed(false);
    }

    els.editPanel.classList.add("hidden");

    return;
  }

  els.editPanel.classList.remove("hidden");

  els.selectedObjectName.textContent = object.userData.instanceLabel;

  const isCurtain = object.userData.productId === "curtain";

  els.curtainControls.classList.toggle("hidden", !isCurtain);

  if (isCurtain) {
    els.curtainToggleButton.textContent = object.userData.curtainOpen
      ? "Close curtains"
      : "Open curtains";
  }
}

function updateMoveButton() {
  els.moveButton.classList.toggle("active", state.editMode === "move");
}

function makeMaterialsEditable(root, product) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.frustumCulled = false;
    const old = child.material;
    const oldColor = old && old.color ? old.color.getHex() : product.colors[0];
    child.material = new THREE.MeshStandardMaterial({
      color: oldColor,
      roughness: 0.78,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
  });
}

function cloneWithIndependentMaterials(source) {
  const clone = source.clone(true);
  clone.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material = Array.isArray(child.material)
        ? child.material.map((material) => material.clone())
        : child.material.clone();
    }
  });
  return clone;
}

async function loadModel(productId) {
  if (modelCache.has(productId))
    return cloneWithIndependentMaterials(modelCache.get(productId));
  const product = PRODUCTS[productId];
  const gltf = await loader.loadAsync(product.url);
  makeMaterialsEditable(gltf.scene, product);
  gltf.scene.updateMatrixWorld(true);
  modelCache.set(productId, gltf.scene);
  return cloneWithIndependentMaterials(gltf.scene);
}

function tintObject(root, color) {
  root.traverse((child) => {
    if (!child.isMesh) return;

    // Change only the curtain fabric, not the metal rail.
    if (
      root.userData.productId === "curtain" &&
      !child.userData.isCurtainFabric
    ) {
      return;
    }

    if (child.material?.color) {
      child.material.color.setHex(color);
    }
  });
}

function curtainFabricCandidate(root) {
  const candidates = [];

  root.traverse((child) => {
    const position = child.geometry?.getAttribute?.("position");

    if (!child.isMesh || !position || position.count < 6) {
      return;
    }

    child.geometry.computeBoundingBox();

    const size = new THREE.Vector3();
    child.geometry.boundingBox.getSize(size);

    const dimensions = [
      Math.abs(size.x),
      Math.abs(size.y),
      Math.abs(size.z),
    ].sort((a, b) => b - a);

    // The fabric is the largest two-dimensional surface.
    // This separates it from the long, thin metal rail.
    candidates.push({
      child,
      surfaceArea: dimensions[0] * dimensions[1],
    });
  });

  candidates.sort((a, b) => b.surfaceArea - a.surfaceArea);

  return candidates[0]?.child ?? null;
}

function geometryForCurtainSide(sourceGeometry, dividerX, side) {
  const source = sourceGeometry.index
    ? sourceGeometry.toNonIndexed()
    : sourceGeometry.clone();

  const position = source.getAttribute("position");
  const selectedVertices = [];

  // Check every triangle and place it in the left or right panel.
  for (let vertex = 0; vertex + 2 < position.count; vertex += 3) {
    const centreX =
      (position.getX(vertex) +
        position.getX(vertex + 1) +
        position.getX(vertex + 2)) /
      3;

    const belongsToSide =
      side === "left" ? centreX <= dividerX : centreX > dividerX;

    if (belongsToSide) {
      selectedVertices.push(vertex, vertex + 1, vertex + 2);
    }
  }

  if (!selectedVertices.length) {
    source.dispose();
    return null;
  }

  const result = new THREE.BufferGeometry();

  for (const [name, attribute] of Object.entries(source.attributes)) {
    const ArrayType = attribute.array?.constructor ?? Float32Array;

    const values = new ArrayType(selectedVertices.length * attribute.itemSize);

    let targetIndex = 0;

    for (const sourceIndex of selectedVertices) {
      for (let component = 0; component < attribute.itemSize; component += 1) {
        values[targetIndex] =
          attribute.array[sourceIndex * attribute.itemSize + component];

        targetIndex += 1;
      }
    }

    result.setAttribute(
      name,
      new THREE.BufferAttribute(
        values,
        attribute.itemSize,
        attribute.normalized,
      ),
    );
  }

  result.computeBoundingBox();
  result.computeBoundingSphere();

  source.dispose();

  return result;
}

function cloneMaterial(material) {
  return Array.isArray(material)
    ? material.map((entry) => entry.clone())
    : material.clone();
}

function configureCurtainParts(root) {
  root.userData.curtainParts = null;
  root.userData.curtainClosed = null;

  // Find the fabric part of the actual curtain.glb model.
  const fabricSource = curtainFabricCandidate(root);
  const parent = fabricSource?.parent;
  const sourceBox = fabricSource?.geometry?.boundingBox;

  if (!fabricSource || !parent || !sourceBox) {
    console.error("Curtain fabric geometry was not found in curtain.glb.");

    return false;
  }

  // Find the horizontal centre of the curtain.
  const dividerX = (sourceBox.min.x + sourceBox.max.x) / 2;

  // Divide the single curtain mesh into left and right meshes.
  const leftGeometry = geometryForCurtainSide(
    fabricSource.geometry,
    dividerX,
    "left",
  );

  const rightGeometry = geometryForCurtainSide(
    fabricSource.geometry,
    dividerX,
    "right",
  );

  if (!leftGeometry || !rightGeometry) {
    leftGeometry?.dispose();
    rightGeometry?.dispose();

    console.error(
      "Curtain fabric could not be divided into left and right panels.",
    );

    return false;
  }

  // Keep the transform from the original curtain mesh.
  const panelContainer = new THREE.Group();

  panelContainer.name = "CurtainPanelContainer";
  panelContainer.position.copy(fabricSource.position);
  panelContainer.quaternion.copy(fabricSource.quaternion);
  panelContainer.scale.copy(fabricSource.scale);
  panelContainer.visible = fabricSource.visible;

  const left = new THREE.Mesh(
    leftGeometry,
    cloneMaterial(fabricSource.material),
  );

  const right = new THREE.Mesh(
    rightGeometry,
    cloneMaterial(fabricSource.material),
  );

  left.name = "LeftCurtain";
  right.name = "RightCurtain";

  left.frustumCulled = false;
  right.frustumCulled = false;

  // Used when changing curtain colours.
  left.userData.isCurtainFabric = true;
  right.userData.isCurtainFabric = true;

  // Find the centre and width of each panel.
  const leftCentreX =
    (leftGeometry.boundingBox.min.x + leftGeometry.boundingBox.max.x) / 2;

  const rightCentreX =
    (rightGeometry.boundingBox.min.x + rightGeometry.boundingBox.max.x) / 2;

  const leftHalfWidth =
    (leftGeometry.boundingBox.max.x - leftGeometry.boundingBox.min.x) / 2;

  const rightHalfWidth =
    (rightGeometry.boundingBox.max.x - rightGeometry.boundingBox.min.x) / 2;

  // Centre each panel's geometry around its own origin.
  leftGeometry.translate(-leftCentreX, 0, 0);
  rightGeometry.translate(-rightCentreX, 0, 0);

  leftGeometry.computeBoundingBox();
  leftGeometry.computeBoundingSphere();

  rightGeometry.computeBoundingBox();
  rightGeometry.computeBoundingSphere();

  left.position.x = leftCentreX;
  right.position.x = rightCentreX;

  panelContainer.add(left, right);

  parent.add(panelContainer);

  // Remove the old combined fabric mesh.
  // The metal curtain rail remains in the model.
  parent.remove(fabricSource);

  root.userData.curtainParts = {
    left,
    right,
    panelContainer,
  };

  // Save the fully closed curtain position and scale.
  root.userData.curtainClosed = {
    leftX: left.position.x,
    rightX: right.position.x,

    leftScaleX: left.scale.x,
    rightScaleX: right.scale.x,

    leftHalfWidth,
    rightHalfWidth,
  };

  root.updateMatrixWorld(true);

  console.info("Curtain panels configured from curtain.glb geometry.");

  return true;
}

function labelFor(productId) {
  const count =
    state.placedObjects.filter((o) => o.userData.productId === productId)
      .length + 1;
  return `${PRODUCTS[productId].name} ${count}`;
}

async function createPlacedObject(productId) {
  const product = PRODUCTS[productId];
  const root = await loadModel(productId);
  root.name = `${productId}-${Date.now()}`;
  root.userData.productId = productId;
  root.userData.instanceLabel = labelFor(productId);
  root.userData.colorIndex = 0;
  root.userData.baseScale = new THREE.Vector3(1, 1, 1);
  root.userData.curtainOpen = false;
  root.userData.widthFactor = 1;
  root.userData.heightFactor = 1;
  /*
   * WebXR anchor information.
   */
  root.userData.xrAnchor = null;

  root.userData.anchorPending = false;

  root.userData.needsReanchor = false;

  root.userData.anchorRevision = 0;
  if (productId === "curtain") configureCurtainParts(root);
  return root;
}
/* ==========================================================
   WEBXR ANCHORING
   Keeps placed furniture attached to the physical room.
   ========================================================== */

/*
 * Delete the current XR anchor without deleting
 * the actual Three.js model.
 */
function releaseObjectAnchor(object) {
  if (!object) return;

  /*
   * Incrementing the revision makes any old
   * asynchronous anchor request invalid.
   */
  object.userData.anchorRevision = (object.userData.anchorRevision || 0) + 1;

  const anchor = object.userData.xrAnchor;

  if (anchor) {
    try {
      anchor.delete();
    } catch (error) {
      console.warn("Could not delete XR anchor:", error);
    }
  }

  object.userData.xrAnchor = null;
}

/*
 * Tell the system that this object's current
 * position should become its new real-world anchor.
 */
function requestObjectReanchor(object) {
  if (!object) return;

  releaseObjectAnchor(object);

  object.userData.needsReanchor = true;
}

/*
 * Create the XRAnchor during an active XRFrame.
 *
 * XRFrame.createAnchor() must be called while the
 * XR frame is active, which is why this happens
 * from onXRFrame().
 */
function createAnchorForObject(frame, object, referenceSpace) {
  if (!object) return;

  if (
    !state.anchorsEnabled ||
    !object.userData.needsReanchor ||
    object.userData.anchorPending
  ) {
    return;
  }

  if (typeof frame.createAnchor !== "function") {
    state.anchorsEnabled = false;

    object.userData.needsReanchor = false;

    return;
  }

  /*
   * Remember which request this is.
   *
   * If the user moves the object while the
   * anchor is being created, this revision
   * will no longer match.
   */
  const revision = object.userData.anchorRevision;

  const position = object.position.clone();

  object.userData.anchorPending = true;

  /*
   * The anchor itself only needs the object's
   * real-world position.
   *
   * The furniture's Y rotation remains controlled
   * separately by your gesture code.
   */
  const transform = new XRRigidTransform({
    x: position.x,
    y: position.y,
    z: position.z,
  });

  frame
    .createAnchor(transform, referenceSpace)
    .then((anchor) => {
      object.userData.anchorPending = false;

      /*
       * Object was deleted or moved while
       * the anchor was being created.
       */
      if (
        !state.placedObjects.includes(object) ||
        revision !== object.userData.anchorRevision
      ) {
        try {
          anchor.delete();
        } catch (_) {
          // Ignore.
        }

        return;
      }

      object.userData.xrAnchor = anchor;

      object.userData.needsReanchor = false;

      console.log("XR anchor created for:", object.userData.instanceLabel);
    })
    .catch((error) => {
      object.userData.anchorPending = false;

      if (revision === object.userData.anchorRevision) {
        object.userData.needsReanchor = false;
      }

      console.warn("XR anchor could not be created:", error);
    });
}

/*
 * Update every anchored object's position
 * using the physical-world anchor.
 */
function updateAnchoredObjects(frame) {
  const referenceSpace = renderer.xr.getReferenceSpace();

  if (!referenceSpace) return;

  /*
   * Detect anchor support once the XR frame exists.
   */
  if (state.anchorsEnabled === null) {
    state.anchorsEnabled = typeof frame.createAnchor === "function";

    console.log(
      "WebXR Anchors:",
      state.anchorsEnabled ? "supported" : "not supported",
    );
  }

  for (const object of state.placedObjects) {
    /*
     * Create/recreate anchor when required.
     */
    if (object.userData.needsReanchor) {
      createAnchorForObject(frame, object, referenceSpace);
    }

    const anchor = object.userData.xrAnchor;

    if (!anchor) {
      continue;
    }

    /*
     * Ask WebXR where the physical anchor
     * currently is.
     */
    const pose = frame.getPose(anchor.anchorSpace, referenceSpace);

    if (!pose) {
      continue;
    }

    /*
     * Update ONLY the position.
     *
     * Do not copy the anchor rotation because
     * Room AR furniture must remain upright.
     */
    object.position.set(
      pose.transform.position.x,
      pose.transform.position.y,
      pose.transform.position.z,
    );

    object.updateMatrixWorld(true);
  }
}

function setObjectAtCurrentHit(object) {
  const product = PRODUCTS[object.userData.productId];

  object.position.copy(state.lastHitPosition);

  // ========================================
  // CURTAIN / WALL OBJECT
  // ========================================

  if (product.surface === "wall") {
    const normal = state.lastSurfaceNormal.clone().normalize();

    const yaw = normalizeAngle(
      Math.atan2(normal.x, normal.z),
    );

    /*
      Curtain remains completely upright.

      X = 0
      Y = wall direction
      Z = 0
    */
    object.rotation.set(0, yaw, 0);

    object.position.addScaledVector(normal, 0.025);
  }

  // ========================================
  // FLOOR FURNITURE
  // ========================================
  else if (!object.userData.keepRotationOnMove) {
    /*
      Get user's current camera position.
    */
    const viewerPosition = new THREE.Vector3();

    getActiveXRCamera().getWorldPosition(viewerPosition);

    /*
      Direction from furniture to user.
    */
    const toViewer = viewerPosition.sub(object.position);

    /*
      Ignore vertical camera difference.
      This keeps the model straight.
    */
    toViewer.y = 0;

    let yaw = 0;

    if (toViewer.lengthSq() > 0.000001) {
      yaw = normalizeAngle(
        Math.atan2(toViewer.x, toViewer.z) + MODEL_FRONT_OFFSET,
      );
    }

    /*
      IMPORTANT:

      X = 0 → upright
      Y = rotate toward user
      Z = 0 → upright

      Room AR will NEVER tilt or flip.
    */
    object.rotation.set(0, yaw, 0);
  }

  object.updateMatrixWorld(true);
}

function collides(object, ignore = object) {
  const box = new THREE.Box3().setFromObject(object);
  // Slightly contract the box to avoid false positives from surfaces merely touching.
  const shrink = 0.008;
  box.min.addScalar(shrink);
  box.max.addScalar(-shrink);
  return state.placedObjects.some((other) => {
    if (other === ignore) return false;
    const otherBox = new THREE.Box3().setFromObject(other);
    return box.intersectsBox(otherBox);
  });
}

async function placeSelectedProduct() {
  if (!state.validHit) {
    toast(
      "No valid surface. Move the phone until the green reticle appears.",
      "error",
    );
    return;
  }
  const productId = state.selectedProductId;
  try {
    setStatus("Loading model", PRODUCTS[productId].name, "warn");
    const object = await createPlacedObject(productId);
    setObjectAtCurrentHit(object);
    scene.add(object);
    object.updateMatrixWorld(true);

    if (collides(object)) {
      scene.remove(object);
      toast(
        "That position overlaps another object. Choose another location.",
        "error",
      );
      setStatus(
        "Placement blocked",
        "Move the reticle to a clear location.",
        "bad",
      );
      return;
    }

    state.placedObjects.push(object);
    /*
     * Ask WebXR to lock this object's current
     * position to the physical room.
     *
     * The actual XRAnchor will be created in
     * the next XR animation frame.
     */
    requestObjectReanchor(object);

    showEditPanel(object);
    state.editMode = "edit";
    updateMoveButton();
    els.sessionActions.classList.remove("hidden");
    toast(`${PRODUCTS[productId].name} placed.`, "success");
    setStatus(
      "Object placed",
      "Edit it below, or choose Place another.",
      "good",
    );
  } catch (error) {
    console.error(error);
    toast("Could not load the 3D model.", "error");
    setStatus(
      "Model error",
      "Check the GLB file and network connection.",
      "bad",
    );
  }
}

function moveSelectedToHit() {
  const object = state.selectedObject;
  if (!object || !state.validHit) {
    toast("Find a valid surface before moving the object.", "error");
    return;
  }
  const oldPos = object.position.clone();
  const oldRot = object.rotation.clone();
  object.userData.keepRotationOnMove = object.userData.productId !== "curtain";
  setObjectAtCurrentHit(object);
  object.userData.keepRotationOnMove = false;

  if (collides(object)) {
    object.position.copy(oldPos);
    object.rotation.copy(oldRot);
    object.updateMatrixWorld(true);
    toast("Move rejected because it would overlap another object.", "error");
    return;
  }
  /*
   * IMPORTANT:
   *
   * The furniture has moved, therefore its
   * previous physical anchor is no longer valid.
   */
  requestObjectReanchor(object);

  state.editMode = "edit";
  updateMoveButton();
  toast("Object moved.", "success");
  setStatus("Object moved", "Continue editing or place another item.", "good");
}

function rotateSelected(delta) {
  if (!state.selectedObject) return;
  const object = state.selectedObject;
  const old = object.rotation.y;
  object.rotation.y += delta;
  object.updateMatrixWorld(true);
  if (collides(object)) {
    object.rotation.y = old;
    toast("Rotation blocked by another object.", "error");
  }
}

function scaleSelected(factor) {
  if (!state.selectedObject) return;
  const object = state.selectedObject;
  const old = object.scale.clone();
  const next = THREE.MathUtils.clamp(object.scale.x * factor, 0.45, 2.25);
  if (object.userData.productId === "curtain") {
    object.scale.multiplyScalar(factor);
    object.scale.x = THREE.MathUtils.clamp(object.scale.x, 0.65, 1.5);
    object.scale.y = THREE.MathUtils.clamp(object.scale.y, 0.65, 1.5);
    object.scale.z = 1;
  } else {
    object.scale.setScalar(next);
  }
  object.updateMatrixWorld(true);
  if (collides(object)) {
    object.scale.copy(old);
    toast("Resize blocked by another object.", "error");
  }
}

function cycleColour() {
  const object = state.selectedObject;
  if (!object) return;
  const product = PRODUCTS[object.userData.productId];
  object.userData.colorIndex =
    (object.userData.colorIndex + 1) % product.colors.length;
  tintObject(object, product.colors[object.userData.colorIndex]);
  toast("Colour changed.", "success");
}

function resizeCurtain(axis, factor) {
  const object = state.selectedObject;
  if (!object || object.userData.productId !== "curtain") return;
  const old = object.scale.clone();
  if (axis === "x")
    object.scale.x = THREE.MathUtils.clamp(object.scale.x * factor, 0.55, 1.75);
  if (axis === "y")
    object.scale.y = THREE.MathUtils.clamp(object.scale.y * factor, 0.55, 1.65);
  object.updateMatrixWorld(true);
  if (collides(object)) {
    object.scale.copy(old);
    toast("Curtain resize blocked by another object.", "error");
  }
}

function animateCurtain(open) {
  const object = state.selectedObject;

  if (!object || object.userData.productId !== "curtain") {
    return;
  }

  const parts = object.userData.curtainParts;
  const closed = object.userData.curtainClosed;

  if (!parts?.left || !parts?.right || !closed) {
    toast("The curtain model could not be prepared for animation.", "error");

    return;
  }

  // Stop the previous animation if the button is pressed quickly.
  state.curtainAnimations = state.curtainAnimations.filter(
    (animation) => animation.root !== object,
  );

  // Current panel positions.
  const startLeft = parts.left.position.x;
  const startRight = parts.right.position.x;

  // Current panel widths.
  const startLeftScaleX = parts.left.scale.x;
  const startRightScaleX = parts.right.scale.x;

  // The opened panel will use 30% of its closed width.
  const openWidth = 0.3;

  const targetLeftScaleX = open
    ? closed.leftScaleX * openWidth
    : closed.leftScaleX;

  const targetRightScaleX = open
    ? closed.rightScaleX * openWidth
    : closed.rightScaleX;

  // Move the left curtain towards the left.
  const targetLeft = open
    ? closed.leftX -
      closed.leftHalfWidth * (closed.leftScaleX - targetLeftScaleX)
    : closed.leftX;

  // Move the right curtain towards the right.
  const targetRight = open
    ? closed.rightX +
      closed.rightHalfWidth * (closed.rightScaleX - targetRightScaleX)
    : closed.rightX;

  playCurtainSound(open);

  state.curtainAnimations.push({
    root: object,

    left: parts.left,
    right: parts.right,

    startLeft,
    startRight,

    targetLeft,
    targetRight,

    startLeftScaleX,
    startRightScaleX,

    targetLeftScaleX,
    targetRightScaleX,

    startTime: performance.now(),
    duration: 1200,
  });

  object.userData.curtainOpen = open;

  els.curtainToggleButton.textContent = open
    ? "Close curtains"
    : "Open curtains";
}

function updateCurtainAnimations(now) {
  state.curtainAnimations = state.curtainAnimations.filter((animation) => {
    const progress = Math.min(
      1,
      (now - animation.startTime) / animation.duration,
    );

    // Smooth animation.
    const eased = progress * progress * (3 - 2 * progress);

    // Gather and move the left curtain.
    animation.left.scale.x = THREE.MathUtils.lerp(
      animation.startLeftScaleX,
      animation.targetLeftScaleX,
      eased,
    );

    animation.left.position.x = THREE.MathUtils.lerp(
      animation.startLeft,
      animation.targetLeft,
      eased,
    );

    // Gather and move the right curtain.
    animation.right.scale.x = THREE.MathUtils.lerp(
      animation.startRightScaleX,
      animation.targetRightScaleX,
      eased,
    );

    animation.right.position.x = THREE.MathUtils.lerp(
      animation.startRight,
      animation.targetRight,
      eased,
    );

    return progress < 1;
  });
}

function deleteSelected() {
  const object = state.selectedObject;
  if (!object) return;
  /*
   * Remove physical XR anchor first.
   */
  releaseObjectAnchor(object);

  scene.remove(object);
  state.placedObjects = state.placedObjects.filter((o) => o !== object);
  state.selectedObject = state.placedObjects.at(-1) || null;
  showEditPanel(state.selectedObject);
  if (!state.placedObjects.length) els.sessionActions.classList.add("hidden");
  toast("Object deleted.");
}

function clearRoom() {
  state.placedObjects.forEach((object) => {
    releaseObjectAnchor(object);

    scene.remove(object);
  });
  state.placedObjects = [];
  state.selectedObject = null;
  showEditPanel(null);
  els.sessionActions.classList.add("hidden");
  state.editMode = "place";
  updateMoveButton();
  toast("Room cleared.");
}

function selectNextObject() {
  if (!state.placedObjects.length) return;
  const currentIndex = state.selectedObject
    ? state.placedObjects.indexOf(state.selectedObject)
    : -1;
  const next =
    state.placedObjects[(currentIndex + 1) % state.placedObjects.length];
  showEditPanel(next);
  state.editMode = "edit";
  updateMoveButton();
  toast(`Selected ${next.userData.instanceLabel}.`);
}

function onXRSelect() {
  if (!state.xrSession) return;
  if (state.editMode === "move") moveSelectedToHit();
  else if (state.editMode === "place") placeSelectedProduct();
}

function isValidFloorHit(viewerPose) {
  /*
   * A floor normal should mostly point upward.
   * 0.7 allows slightly imperfect or noisy plane detection.
   */
  const normalIsFacingUp =
    state.lastSurfaceNormal.y >= FLOOR_NORMAL_MIN_Y;

  const cameraPosition = new THREE.Vector3();

  if (viewerPose) {
    cameraPosition.set(
      viewerPose.transform.position.x,
      viewerPose.transform.position.y,
      viewerPose.transform.position.z,
    );
  } else {
    getActiveXRCamera().getWorldPosition(cameraPosition);
  }

  /*
   * A floor hit must be below the phone.
   * This prevents most wall hits from being accepted.
   */
  const distanceBelowCamera =
    cameraPosition.y - state.lastHitPosition.y;

  const isBelowCamera =
    distanceBelowCamera >=
    MIN_FLOOR_DISTANCE_BELOW_CAMERA;

  return normalIsFacingUp && isBelowCamera;
}

function evaluateHitPose(pose, viewerPose) {
  state.lastHitPosition.setFromMatrixPosition(
    new THREE.Matrix4().fromArray(pose.transform.matrix),
  );
  state.lastHitQuaternion.setFromRotationMatrix(
    new THREE.Matrix4().fromArray(pose.transform.matrix),
  );
  state.lastSurfaceNormal
    .set(0, 1, 0)
    .applyQuaternion(state.lastHitQuaternion)
    .normalize();

  const product = selectedProduct();
  if (state.editMode === "edit") {
    reticle.visible = false;
    state.validHit = false;
    return;
  }
  const horizontal = isValidFloorHit(viewerPose);
  const vertical = Math.abs(state.lastSurfaceNormal.y) < 0.4;
  state.validHit = product.surface === "floor" ? horizontal : vertical;

  reticle.visible = state.validHit;
  if (state.validHit) {
    reticle.matrix.fromArray(pose.transform.matrix);
    reticle.material.color.setHex(
      product.surface === "floor" ? 0x2dd4bf : 0xf59e0b,
    );
    if (state.editMode === "move") {
      setStatus(
        "Move mode",
        "Tap the valid reticle to move the selected object.",
        "warn",
      );
    } else if (state.editMode === "place") {
      setStatus(
        product.surface === "floor" ? "Floor detected" : "Wall detected",
        `Tap to place ${product.name}.`,
        "good",
      );
    }
  } else if (state.editMode === "place" || state.editMode === "move") {
    const prompt =
      product.surface === "floor"
        ? "Aim downward at the floor, not at a wall or furniture."
        : "Aim at a vertical wall surface.";
    setStatus("Scanning surface", prompt, "warn");
  }
}

/* ==========================================================
   REAL-WORLD DEPTH OCCLUSION
   ========================================================== */

function updateDepthOcclusion() {
  /*
   * This method exists in newer Three.js versions.
   */
  if (typeof renderer.xr.hasDepthSensing !== "function") {
    return;
  }

  /*
   * The browser/device has not provided
   * environment depth.
   */
  if (!renderer.xr.hasDepthSensing()) {
    return;
  }

  /*
   * We only create the Three.js depth mesh once.
   */
  if (state.occlusionMesh) {
    return;
  }

  const depthMesh = renderer.xr.getDepthSensingMesh();

  if (!depthMesh) {
    return;
  }

  /*
   * Render the real-world depth before
   * rendering the furniture.
   *
   * The depth mesh writes to the depth
   * buffer but should not draw visible colour.
   */
  depthMesh.renderOrder = -10000;

  depthMesh.frustumCulled = false;

  if (depthMesh.material) {
    /*
     * Do not draw a visible depth image.
     */
    depthMesh.material.colorWrite = false;

    /*
     * But DO write the real environment
     * depth values.
     */
    depthMesh.material.depthWrite = true;

    depthMesh.material.depthTest = true;

    /*
     * Ensure the screen-facing depth
     * geometry is rendered.
     */
    depthMesh.material.side = THREE.DoubleSide;
  }

  scene.add(depthMesh);

  state.occlusionMesh = depthMesh;

  state.occlusionReady = true;

  if (!state.occlusionMessageShown) {
    state.occlusionMessageShown = true;

    toast("Real-world occlusion enabled.", "success");

    console.log("WebXR depth occlusion enabled.");
  }
}

function onXRFrame(_time, frame) {
  const session = renderer.xr.getSession();
  if (!session) return;

  if (!state.hitTestSourceRequested) {
    session
      .requestReferenceSpace("viewer")
      .then((referenceSpace) => {
        session
          .requestHitTestSource({
            space: referenceSpace,

            /*
             * Keep the request limited to tracked planes. Surface orientation
             * is still verified below because some runtimes fall back to an
             * upright normal when native orientation data is unavailable.
             */
            entityTypes: ["plane"],
          })
          .then((source) => {
            state.hitTestSource = source;
          });
      })
      .catch((error) => {
        console.error(error);
        setStatus(
          "Hit-test unavailable",
          "This device could not create a hit-test source.",
          "bad",
        );
      });
    session.addEventListener(
      "end",
      () => {
        state.hitTestSourceRequested = false;

        state.hitTestSource = null;

        state.xrSession = null;

        state.validHit = false;

        reticle.visible = false;

        /* ==========================
       REMOVE OCCLUSION
       ========================== */

        if (state.occlusionMesh) {
          scene.remove(state.occlusionMesh);

          state.occlusionMesh = null;
        }

        state.occlusionReady = false;

        state.occlusionMessageShown = false;

        state.anchorsEnabled = null;

        setUiCollapsed(false);

        els.startPanel.classList.remove("hidden");

        els.cataloguePanel.classList.add("hidden");

        els.editPanel.classList.add("hidden");

        els.sessionActions.classList.add("hidden");

        setStatus("AR session ended", "You can start another session.", "");
      },

      {
        once: true,
      },
    );
    state.hitTestSourceRequested = true;
  }

  if (state.hitTestSource) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const hitTestResults = frame.getHitTestResults(state.hitTestSource);
    if (hitTestResults.length) {
      const pose = hitTestResults[0].getPose(referenceSpace);
      const viewerPose = frame.getViewerPose(referenceSpace);
      if (pose) evaluateHitPose(pose, viewerPose);
    } else {
      reticle.visible = false;
      state.validHit = false;
      if (state.editMode === "place" || state.editMode === "move")
        setStatus(
          "Scanning room",
          "Move your phone slowly and keep a surface in view.",
          "warn",
        );
    }
  }
}

function isInteractiveUI(target) {
  return Boolean(
    target?.closest?.(
      "button, a, .catalogue-panel, .edit-panel, .session-actions, .start-panel, .modal-backdrop",
    ),
  );
}

function getTouchDistance(t1, t2) {
  return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}

function getTouchAngle(t1, t2) {
  return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function getActiveXRCamera() {
  const xrCamera = renderer.xr.getCamera(camera);
  if (xrCamera?.isArrayCamera && xrCamera.cameras?.length)
    return xrCamera.cameras[0];
  return xrCamera || camera;
}

function findPlacedRoot(object) {
  let current = object;
  while (current) {
    if (state.placedObjects.includes(current)) return current;
    current = current.parent;
  }
  return null;
}

function pickPlacedObject(clientX, clientY) {
  if (!state.placedObjects.length) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  touchPointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  touchPointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

  const xrCamera = getActiveXRCamera();
  touchRaycaster.setFromCamera(touchPointer, xrCamera);
  const meshes = [];
  state.placedObjects.forEach((root) =>
    root.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    }),
  );
  const hit = touchRaycaster.intersectObjects(meshes, false)[0];
  return hit ? findPlacedRoot(hit.object) : null;
}

function applyGestureMove(dx, dy) {
  const object = state.selectedObject;
  if (!object) return;
  /*
   * Disconnect the old location anchor.
   */
  if (object.userData.xrAnchor) {
    releaseObjectAnchor(object);
  }

  // Save old transform so collision checks can safely reject a drag step.
  const oldPosition = object.position.clone();
  const speed = THREE.MathUtils.clamp(
    object.position.distanceTo(getActiveXRCamera().position) * 0.0016,
    0.0008,
    0.0045,
  );

  if (object.userData.productId === "curtain") {
    // Curtains move only along their own wall plane: local X for left/right, world Y for up/down.
    const wallRight = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(object.quaternion)
      .normalize();
    object.position.addScaledVector(wallRight, dx * speed);
    object.position.y += -dy * speed;
  } else {
    // Furniture stays on the same floor height while following the viewer's horizontal axes.
    const xrCamera = getActiveXRCamera();
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(
      xrCamera.quaternion,
    );
    cameraRight.y = 0;
    if (cameraRight.lengthSq() < 1e-6) cameraRight.set(1, 0, 0);
    cameraRight.normalize();

    const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      xrCamera.quaternion,
    );
    cameraForward.y = 0;
    if (cameraForward.lengthSq() < 1e-6) cameraForward.set(0, 0, -1);
    cameraForward.normalize();

    object.position.addScaledVector(cameraRight, dx * speed);
    object.position.addScaledVector(cameraForward, -dy * speed);
  }

  object.updateMatrixWorld(true);
  if (collides(object)) {
    object.position.copy(oldPosition);
    object.updateMatrixWorld(true);
  }
}

function applyPinchAndTwist(t1, t2) {
  const object = state.selectedObject;

  if (!object) return;

  const gesture = state.gesture;

  // ========================================
  // CURRENT GESTURE VALUES
  // ========================================

  const distance = Math.max(20, getTouchDistance(t1, t2));

  const angle = getTouchAngle(t1, t2);

  // ========================================
  // PINCH = ZOOM
  // ========================================

  const scaleFactor = THREE.MathUtils.clamp(
    distance / Math.max(20, gesture.startDistance),

    0.45,
    2.25,
  );

  // ========================================
  // TWIST = LEFT / RIGHT ROTATION
  // ========================================

  const angleDelta = normalizeAngle(angle - gesture.startAngle);

  /*
    Save old values so we can restore them
    if the object hits another object.
  */
  const oldScale = object.scale.clone();

  const oldRotationY = object.rotation.y;

  // ========================================
  // CURTAIN
  // ========================================

  if (object.userData.productId === "curtain") {
    object.scale.x = THREE.MathUtils.clamp(
      gesture.startScale.x * scaleFactor,

      0.55,
      1.75,
    );

    object.scale.y = THREE.MathUtils.clamp(
      gesture.startScale.y * scaleFactor,

      0.55,
      1.65,
    );

    object.scale.z = gesture.startScale.z;
  }

  // ========================================
  // FLOOR FURNITURE
  // ========================================
  else {
    const uniform = THREE.MathUtils.clamp(
      gesture.startScale.x * scaleFactor,

      0.45,
      2.25,
    );

    object.scale.setScalar(uniform);
  }

  // ========================================
  // ROTATE LEFT / RIGHT ONLY
  // ========================================

  object.rotation.y = normalizeAngle(gesture.startRotationY - angleDelta);

  /*
    DO NOT modify:

      object.rotation.x
      object.rotation.z

    Room furniture must remain upright.
  */

  object.updateMatrixWorld(true);

  // ========================================
  // COLLISION PROTECTION
  // ========================================

  if (collides(object)) {
    object.scale.copy(oldScale);

    object.rotation.y = oldRotationY;

    object.updateMatrixWorld(true);
  }
}

function onGestureTouchStart(event) {
  if (!state.xrSession || isInteractiveUI(event.target)) return;
  if (state.editMode === "place" || state.editMode === "move") return;

  const touches = event.touches;
  if (!touches.length) return;

  if (touches.length === 1) {
    const picked = pickPlacedObject(touches[0].clientX, touches[0].clientY);
    if (picked) {
      showEditPanel(picked);
      state.editMode = "edit";
      updateMoveButton();
      toast(
        `Selected ${picked.userData.instanceLabel}. Drag to move, pinch to resize, twist to rotate.`,
      );
    }
    if (!state.selectedObject) return;

    state.gesture.active = true;
    state.gesture.mode = "move";
    state.gesture.moved = false;
    state.gesture.lastX = touches[0].clientX;
    state.gesture.lastY = touches[0].clientY;
  } else if (touches.length >= 2 && state.selectedObject) {
    state.gesture.active = true;
    state.gesture.mode = "pinch-rotate";
    state.gesture.moved = false;
    state.gesture.startDistance = getTouchDistance(touches[0], touches[1]);
    state.gesture.startAngle = getTouchAngle(touches[0], touches[1]);
    state.gesture.startScale.copy(state.selectedObject.scale);
    state.gesture.startRotationY = state.selectedObject.rotation.y;
  }

  if (state.gesture.active) event.preventDefault();
}

function onGestureTouchMove(event) {
  if (
    !state.gesture.active ||
    !state.selectedObject ||
    isInteractiveUI(event.target)
  )
    return;

  if (event.touches.length === 1 && state.gesture.mode === "move") {
    const touch = event.touches[0];
    const dx = touch.clientX - state.gesture.lastX;
    const dy = touch.clientY - state.gesture.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 1.5) state.gesture.moved = true;
    applyGestureMove(dx, dy);
    state.gesture.lastX = touch.clientX;
    state.gesture.lastY = touch.clientY;
    setStatus(
      "Gesture move",
      "Drag with one finger to reposition the selected object.",
      "good",
    );
  } else if (event.touches.length >= 2) {
    if (state.gesture.mode !== "pinch-rotate") {
      state.gesture.mode = "pinch-rotate";

      state.gesture.startDistance = getTouchDistance(
        event.touches[0],
        event.touches[1],
      );

      state.gesture.startAngle = getTouchAngle(
        event.touches[0],
        event.touches[1],
      );

      state.gesture.startScale.copy(state.selectedObject.scale);

      state.gesture.startRotationY = state.selectedObject.rotation.y;
    }

    state.gesture.moved = true;

    applyPinchAndTwist(event.touches[0], event.touches[1]);

    setStatus(
      "Gesture edit",
      "Pinch = zoom • twist = rotate left/right.",
      "good",
    );
  }

  event.preventDefault();
}

function onGestureTouchEnd(event) {
  if (!state.gesture.active) return;

  // Transition smoothly from two fingers back to one finger.
  if (event.touches.length === 1 && state.selectedObject) {
    state.gesture.mode = "move";
    state.gesture.lastX = event.touches[0].clientX;
    state.gesture.lastY = event.touches[0].clientY;
    event.preventDefault();
    return;
  }

  if (event.touches.length === 0) {
    /*
     * If dragging removed the anchor,
     * lock the object at its new position.
     */
    if (state.selectedObject && !state.selectedObject.userData.xrAnchor) {
      requestObjectReanchor(state.selectedObject);
    }

    if (state.gesture.moved) {
      toast("Object position locked.", "success");
    }

    state.gesture.active = false;

    state.gesture.mode = null;

    state.gesture.moved = false;

    event.preventDefault();
  }
}

// Pointer-event gesture input is used on Android/WebXR because DOM Overlay touches are
// not guaranteed to target the WebGL canvas. Listening at document level (capture phase)
// lets us receive touches that land on the AR DOM overlay while still ignoring real UI controls.
const gesturePointers = new Map();

function pointerSnapshot() {
  return [...gesturePointers.values()];
}

function beginOneFingerGesture(point) {
  const picked = pickPlacedObject(point.clientX, point.clientY);
  if (picked) {
    showEditPanel(picked);
    state.editMode = "edit";
    updateMoveButton();
    toast(
      `Selected ${picked.userData.instanceLabel}. Drag to move, pinch to resize, twist to rotate.`,
    );
  }
  if (!state.selectedObject) return false;

  state.gesture.active = true;
  state.gesture.mode = "move";
  state.gesture.moved = false;
  state.gesture.lastX = point.clientX;
  state.gesture.lastY = point.clientY;
  return true;
}

function beginTwoFingerGesture(points) {
  if (!state.selectedObject || points.length < 2) {
    return false;
  }

  const [p1, p2] = points;

  state.gesture.active = true;

  state.gesture.mode = "pinch-rotate";

  state.gesture.moved = false;

  // Initial finger distance
  state.gesture.startDistance = Math.hypot(
    p2.clientX - p1.clientX,

    p2.clientY - p1.clientY,
  );

  // Initial finger angle
  state.gesture.startAngle = Math.atan2(
    p2.clientY - p1.clientY,

    p2.clientX - p1.clientX,
  );

  // Initial object scale
  state.gesture.startScale.copy(state.selectedObject.scale);

  // Only Y rotation is used in Room AR
  state.gesture.startRotationY = state.selectedObject.rotation.y;

  return true;
}
function onGesturePointerDown(event) {
  if (event.pointerType !== "touch") return;
  if (!state.xrSession || isInteractiveUI(event.target)) return;
  if (state.editMode === "place" || state.editMode === "move") return;

  gesturePointers.set(event.pointerId, {
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
  });

  const points = pointerSnapshot();
  if (points.length === 1) beginOneFingerGesture(points[0]);
  else if (points.length >= 2) beginTwoFingerGesture(points);

  if (state.gesture.active) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function onGesturePointerMove(event) {
  if (event.pointerType !== "touch" || !gesturePointers.has(event.pointerId))
    return;

  gesturePointers.set(event.pointerId, {
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
  });

  if (!state.gesture.active || !state.selectedObject) return;
  const points = pointerSnapshot();

  if (points.length === 1) {
    const point = points[0];
    if (state.gesture.mode !== "move") {
      state.gesture.mode = "move";
      state.gesture.lastX = point.clientX;
      state.gesture.lastY = point.clientY;
    }
    const dx = point.clientX - state.gesture.lastX;
    const dy = point.clientY - state.gesture.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 1.5) state.gesture.moved = true;
    applyGestureMove(dx, dy);
    state.gesture.lastX = point.clientX;
    state.gesture.lastY = point.clientY;
    setStatus(
      "Gesture move",
      "Drag with one finger to reposition the selected object.",
      "good",
    );
  } else if (points.length >= 2) {
    if (state.gesture.mode !== "pinch-rotate") beginTwoFingerGesture(points);
    const [p1, p2] = points;
    state.gesture.moved = true;
    applyPinchAndTwist(p1, p2);
    setStatus(
      "Gesture edit",
      "Pinch = zoom • twist = rotate left/right.",
      "good",
    );
  }

  event.preventDefault();
  event.stopPropagation();
}

function onGesturePointerEnd(event) {
  if (event.pointerType !== "touch" || !gesturePointers.has(event.pointerId))
    return;
  gesturePointers.delete(event.pointerId);

  const points = pointerSnapshot();
  if (points.length === 1 && state.selectedObject) {
    state.gesture.mode = "move";
    state.gesture.lastX = points[0].clientX;
    state.gesture.lastY = points[0].clientY;
  } else if (points.length === 0) {
    /*
     * Re-anchor after one-finger dragging.
     */
    if (state.selectedObject && !state.selectedObject.userData.xrAnchor) {
      requestObjectReanchor(state.selectedObject);
    }

    if (state.gesture.active && state.gesture.moved) {
      toast("Object position locked.", "success");
    }

    state.gesture.active = false;

    state.gesture.mode = null;

    state.gesture.moved = false;
  }

  if (state.editMode === "edit") {
    event.preventDefault();
    event.stopPropagation();
  }
}

function bindGestureControls() {
  // Important: use document-level capture instead of renderer.domElement. In immersive WebXR
  // with DOM Overlay, Android Chrome often sends touch/pointer input to the overlay rather
  // than to the WebGL canvas, which made the previous gesture implementation appear inactive.
  if (window.PointerEvent) {
    document.addEventListener("pointerdown", onGesturePointerDown, {
      passive: false,
      capture: true,
    });
    document.addEventListener("pointermove", onGesturePointerMove, {
      passive: false,
      capture: true,
    });
    document.addEventListener("pointerup", onGesturePointerEnd, {
      passive: false,
      capture: true,
    });
    document.addEventListener("pointercancel", onGesturePointerEnd, {
      passive: false,
      capture: true,
    });
  } else {
    // Fallback for older browsers.
    document.addEventListener("touchstart", onGestureTouchStart, {
      passive: false,
      capture: true,
    });
    document.addEventListener("touchmove", onGestureTouchMove, {
      passive: false,
      capture: true,
    });
    document.addEventListener("touchend", onGestureTouchEnd, {
      passive: false,
      capture: true,
    });
    document.addEventListener("touchcancel", onGestureTouchEnd, {
      passive: false,
      capture: true,
    });
  }
}

function bindUI() {
  els.tabs.forEach((tab) =>
    tab.addEventListener("click", () => selectFilter(tab.dataset.filter)),
  );
  els.moveButton.addEventListener("click", () => {
    if (!state.selectedObject) return;
    state.editMode = state.editMode === "move" ? "edit" : "move";
    updateMoveButton();
    if (state.editMode === "move") {
      state.selectedProductId = state.selectedObject.userData.productId;
      state.filter = PRODUCTS[state.selectedProductId].surface;
      renderProducts();
      els.tabs.forEach((tab) =>
        tab.classList.toggle("active", tab.dataset.filter === state.filter),
      );
      toast("Move mode: tap a new valid surface.");
    }
  });
  els.rotateLeftButton.addEventListener("click", () =>
    rotateSelected(THREE.MathUtils.degToRad(15)),
  );
  els.rotateRightButton.addEventListener("click", () =>
    rotateSelected(THREE.MathUtils.degToRad(-15)),
  );
  els.scaleDownButton.addEventListener("click", () => scaleSelected(0.9));
  els.scaleUpButton.addEventListener("click", () => scaleSelected(1.1));
  els.colourButton.addEventListener("click", cycleColour);

  els.deleteButton.addEventListener("click", deleteSelected);

  els.nextObjectButton.addEventListener("click", selectNextObject);

  /* Hide / Show Room AR interface */
  els.toggleUiButton.addEventListener("click", () => {
    setUiCollapsed(!state.uiCollapsed);
  });
  els.widthDownButton.addEventListener("click", () => resizeCurtain("x", 0.9));
  els.widthUpButton.addEventListener("click", () => resizeCurtain("x", 1.1));
  els.heightDownButton.addEventListener("click", () => resizeCurtain("y", 0.9));
  els.heightUpButton.addEventListener("click", () => resizeCurtain("y", 1.1));
  els.curtainToggleButton.addEventListener("click", () =>
    animateCurtain(!state.selectedObject?.userData.curtainOpen),
  );
  els.placeAnotherButton.addEventListener("click", () => {
    state.editMode = "place";
    updateMoveButton();
    showEditPanel(state.selectedObject);
    toast(`Place mode: ${selectedProduct().name}.`);
  });
  els.clearButton.addEventListener("click", clearRoom);
  els.exitArButton.addEventListener("click", async () => {
    if (state.xrSession) {
      try {
        await state.xrSession.end();
      } catch (error) {
        console.warn(error);
      }
    }
  });
  els.helpButton.addEventListener("click", () =>
    els.helpModal.classList.remove("hidden"),
  );
  els.closeHelpButton.addEventListener("click", () =>
    els.helpModal.classList.add("hidden"),
  );
  els.helpModal.addEventListener("click", (event) => {
    if (event.target === els.helpModal) els.helpModal.classList.add("hidden");
  });
  // Prevent DOM overlay taps from also becoming XR select events.
  els.uiOverlay.addEventListener("beforexrselect", (event) =>
    event.preventDefault(),
  );
}

async function setupARButton() {
  const compatibility = window.RoomARCompatibility;

  const basicSupport = compatibility
    ? await compatibility.check()
    : Boolean(
        navigator.xr &&
          (await navigator.xr
            .isSessionSupported("immersive-ar")
            .catch(() => false))
      );

  if (!basicSupport) return;

  /*
   * Basic WebXR support does not guarantee that the device can start
   * a Room AR session with hit testing.
   */
  if (compatibility) {
    compatibility.show(
      "checking",
      "Basic WebXR support detected",
      "Tap ENTER AR to complete the compatibility check.",
      false
    );
  }

  setStatus(
    "Compatibility check required",
    "Tap ENTER AR to verify this device.",
    "warn"
  );

  const sessionOptions = {
    requiredFeatures: ["hit-test"],

    optionalFeatures: [
      "dom-overlay",
      "local-floor",
      "anchors",
      "depth-sensing"
    ],

    domOverlay: {
      root: els.uiOverlay
    },

    depthSensing: {
      usagePreference: ["gpu-optimized"],
      dataFormatPreference: ["float32", "luminance-alpha"]
    }
  };

  const button = document.createElement("button");
  button.id = "ARButton";
  button.type = "button";
  button.textContent = "ENTER AR";

  els.arButtonMount.appendChild(button);

  let currentSession = null;
  let startingSession = false;

  button.addEventListener("click", async () => {
    /*
     * End the current session if AR is already running.
     */
    if (currentSession) {
      try {
        await currentSession.end();
      } catch (error) {
        console.warn("Could not end AR session:", error);
      }

      return;
    }

    if (startingSession) return;

    startingSession = true;
    button.disabled = true;
    button.textContent = "CHECKING AR…";

    if (compatibility) {
      compatibility.show(
        "checking",
        "Checking full Room AR compatibility…",
        "The browser is testing surface detection and camera access.",
        false
      );
    }

    setStatus(
      "Starting Room AR",
      "Checking camera and surface-detection support.",
      "warn"
    );

    try {
      /*
       * This is the real compatibility test.
       * The session must support hit testing.
       */
      const session = await navigator.xr.requestSession(
        "immersive-ar",
        sessionOptions
      );

      renderer.xr.setReferenceSpaceType("local");

      session.addEventListener(
        "end",
        () => {
          currentSession = null;
          state.xrSession = null;

          button.disabled = false;
          button.textContent = "ENTER AR";

          els.startPanel.classList.remove("hidden");
          els.cataloguePanel.classList.add("hidden");
          els.editPanel.classList.add("hidden");
          els.sessionActions.classList.add("hidden");

          if (compatibility) {
            compatibility.show(
              "checking",
              "Room AR session ended",
              "Tap ENTER AR when you want to start again.",
              false
            );
          }

          setStatus(
            "Ready for AR",
            "Tap ENTER AR to start another session.",
            ""
          );
        },
        { once: true }
      );

      await renderer.xr.setSession(session);

      currentSession = session;
      state.xrSession = session;

      button.disabled = false;
      button.textContent = "EXIT AR";

      if (compatibility) {
        compatibility.show(
          "success",
          "Room AR started successfully",
          "This device supports the required Room AR features.",
          false
        );
      }
    } catch (error) {
      console.error("Room AR session could not start:", error);

      const unsupported = error?.name === "NotSupportedError";

      const permissionDenied =
        error?.name === "NotAllowedError" ||
        error?.name === "SecurityError";

      if (unsupported) {
        if (compatibility) {
          compatibility.show(
            "error",
            "Room AR is not supported on this device",
            "The browser was detected, but this phone cannot start the required AR surface-detection session. You can still use Marker AR.",
            true
          );
        }

        button.textContent = "AR NOT SUPPORTED";
        button.disabled = true;

        setStatus(
          "Room AR unavailable",
          "Required surface detection is not supported.",
          "bad"
        );
      } else if (permissionDenied) {
        if (compatibility) {
          compatibility.show(
            "error",
            "Camera or AR permission was denied",
            "Allow camera and AR permissions in Chrome, then try again.",
            true
          );
        }

        button.textContent = "TRY AR AGAIN";
        button.disabled = false;

        setStatus(
          "Permission required",
          "Allow camera and AR access.",
          "bad"
        );
      } else {
        if (compatibility) {
          compatibility.show(
            "error",
            "Room AR could not start",
            "Update Chrome and Google Play Services for AR, then try again. This device may not support Room AR.",
            true
          );
        }

        button.textContent = "TRY AR AGAIN";
        button.disabled = false;

        setStatus(
          "AR startup failed",
          "This device could not start Room AR.",
          "bad"
        );
      }
    } finally {
      startingSession = false;
    }
  });

  renderer.xr.addEventListener("sessionstart", () => {
    state.xrSession = renderer.xr.getSession();

    setUiCollapsed(false);

    els.startPanel.classList.add("hidden");
    els.cataloguePanel.classList.remove("hidden");

    if (state.placedObjects.length) {
      els.sessionActions.classList.remove("hidden");
    }

    state.editMode = "place";
    updateMoveButton();

    setStatus(
      "Scanning room",
      "Move your phone slowly to detect a floor.",
      "warn"
    );
  });
}

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

bindUI();
bindGestureControls();
renderProducts();
els.cataloguePanel.classList.add("hidden");
setupARButton();
renderer.setAnimationLoop((time, frame) => {
  if (frame) {
    /*
     * Existing plane/hit detection.
     */
    onXRFrame(time, frame);

    /*
     * Keep previously placed furniture
     * physically locked to the room.
     */
    updateAnchoredObjects(frame);

    /*
     * Add real-world depth into the
     * Three.js depth buffer.
     */
    updateDepthOcclusion();
  }

  updateCurtainAnimations(time);

  renderer.render(scene, camera);
});
