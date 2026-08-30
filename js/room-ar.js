import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PRODUCTS = {
  sofa: {
    id: 'sofa', name: 'Modern Sofa', emoji: '🛋️', url: './models/sofa.glb', surface: 'floor',
    colors: [0x7a7f88, 0xb49b7d, 0x4f6d8a, 0x8b5e4a]
  },
  chair: {
    id: 'chair', name: 'Lounge Chair', emoji: '🪑', url: './models/chair.glb', surface: 'floor',
    colors: [0x9a795b, 0x6b7280, 0x57705b, 0x97665b]
  },
  table: {
    id: 'table', name: 'Coffee Table', emoji: '▰', url: './models/table.glb', surface: 'floor',
    colors: [0xa77a50, 0x6f4c35, 0xb68a61, 0x5d6670]
  },
  plant: {
    id: 'plant', name: 'Indoor Plant', emoji: '🌿', url: './models/plant.glb', surface: 'floor',
    colors: [0x4b8b5d, 0x3c7a57, 0x6c8f55, 0x4f7650]
  },
  curtain: {
    id: 'curtain', name: 'Curtain Set', emoji: '🪟', url: './models/curtain.glb', surface: 'wall',
    colors: [0xd8c5a5, 0xa9b6c7, 0x8fa49a, 0xc8a7ad, 0xe5e7eb]
  }
};

const els = {
  stage: document.querySelector('#stage'),
  uiOverlay: document.querySelector('#uiOverlay'),
  statusDot: document.querySelector('#statusDot'),
  statusTitle: document.querySelector('#statusTitle'),
  statusText: document.querySelector('#statusText'),
  startPanel: document.querySelector('#startPanel'),
  arButtonMount: document.querySelector('#arButtonMount'),
  supportMessage: document.querySelector('#supportMessage'),
  productRow: document.querySelector('#productRow'),
  tabs: [...document.querySelectorAll('.catalogue-tab')],
  cataloguePanel: document.querySelector('#cataloguePanel'),
  editPanel: document.querySelector('#editPanel'),
  selectedObjectName: document.querySelector('#selectedObjectName'),
  nextObjectButton: document.querySelector('#nextObjectButton'),
  moveButton: document.querySelector('#moveButton'),
  rotateLeftButton: document.querySelector('#rotateLeftButton'),
  rotateRightButton: document.querySelector('#rotateRightButton'),
  scaleDownButton: document.querySelector('#scaleDownButton'),
  scaleUpButton: document.querySelector('#scaleUpButton'),
  colourButton: document.querySelector('#colourButton'),
  deleteButton: document.querySelector('#deleteButton'),
  curtainControls: document.querySelector('#curtainControls'),
  widthDownButton: document.querySelector('#widthDownButton'),
  widthUpButton: document.querySelector('#widthUpButton'),
  heightDownButton: document.querySelector('#heightDownButton'),
  heightUpButton: document.querySelector('#heightUpButton'),
  curtainToggleButton: document.querySelector('#curtainToggleButton'),
  sessionActions: document.querySelector('#sessionActions'),
  placeAnotherButton: document.querySelector('#placeAnotherButton'),
  clearButton: document.querySelector('#clearButton'),
  exitArButton: document.querySelector('#exitArButton'),
  toast: document.querySelector('#toast'),
  helpButton: document.querySelector('#helpButton'),
  helpModal: document.querySelector('#helpModal'),
  closeHelpButton: document.querySelector('#closeHelpButton')
};

const state = {
  selectedProductId: 'sofa',
  filter: 'floor',
  selectedObject: null,
  placedObjects: [],
  editMode: 'place', // place | move | edit
  xrSession: null,
  hitTestSource: null,
  hitTestSourceRequested: false,
  validHit: false,
  lastHitPosition: new THREE.Vector3(),
  lastHitQuaternion: new THREE.Quaternion(),
  lastSurfaceNormal: new THREE.Vector3(0, 1, 0),
  toastTimer: null,
  curtainAnimations: [],
  gesture: {
    active: false,
    mode: null,
    moved: false,
    lastX: 0,
    lastY: 0,
    startDistance: 0,
    startAngle: 0,
    startScale: new THREE.Vector3(1, 1, 1),
    startRotationY: 0
  }
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 50);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
els.stage.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2.0));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
keyLight.position.set(2, 4, 1);
scene.add(keyLight);

const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.075, 0.095, 48).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x2dd4bf, side: THREE.DoubleSide, transparent: true, opacity: 0.95 })
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

const controller = renderer.xr.getController(0);
controller.addEventListener('select', onXRSelect);
scene.add(controller);

// Touch interaction helpers for direct manipulation of placed 3D objects.
const touchRaycaster = new THREE.Raycaster();
const touchPointer = new THREE.Vector2();

const loader = new GLTFLoader();
const modelCache = new Map();

function selectedProduct() {
  return PRODUCTS[state.selectedProductId];
}

function setStatus(title, text, type = '') {
  els.statusTitle.textContent = title;
  els.statusText.textContent = text;
  els.statusDot.className = `status-dot ${type}`.trim();
}

function toast(message, type = '') {
  clearTimeout(state.toastTimer);
  els.toast.textContent = message;
  els.toast.className = `toast show ${type}`.trim();
  state.toastTimer = setTimeout(() => {
    els.toast.className = 'toast';
  }, 2600);
}

function renderProducts() {
  const items = Object.values(PRODUCTS).filter(p => p.surface === state.filter);
  els.productRow.innerHTML = items.map(p => `
    <button class="product-button ${p.id === state.selectedProductId ? 'active' : ''}" data-product="${p.id}" type="button">
      <span class="emoji">${p.emoji}</span>
      <strong>${p.name.replace('Modern ', '').replace('Lounge ', '')}</strong>
      <small>${p.surface === 'floor' ? 'Floor' : 'Wall'}</small>
    </button>
  `).join('');

  els.productRow.querySelectorAll('[data-product]').forEach(button => {
    button.addEventListener('click', () => {
      state.selectedProductId = button.dataset.product;
      state.editMode = 'place';
      updateMoveButton();
      renderProducts();
      const p = selectedProduct();
      setStatus('Product selected', p.surface === 'floor' ? 'Scan a floor and tap the green reticle.' : 'Point at a wall and tap the green reticle.', 'warn');
    });
  });
}

function selectFilter(filter) {
  state.filter = filter;
  els.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.filter === filter));
  const first = Object.values(PRODUCTS).find(p => p.surface === filter);
  if (first) state.selectedProductId = first.id;
  state.editMode = 'place';
  updateMoveButton();
  renderProducts();
}

function showEditPanel(object) {
  state.selectedObject = object;
  if (!object) {
    els.editPanel.classList.add('hidden');
    return;
  }
  els.editPanel.classList.remove('hidden');
  els.selectedObjectName.textContent = `${object.userData.instanceLabel}`;
  const isCurtain = object.userData.productId === 'curtain';
  els.curtainControls.classList.toggle('hidden', !isCurtain);
  if (isCurtain) {
    els.curtainToggleButton.textContent = object.userData.curtainOpen ? 'Close curtains' : 'Open curtains';
  }
}

function updateMoveButton() {
  els.moveButton.classList.toggle('active', state.editMode === 'move');
}

function makeMaterialsEditable(root, product) {
  root.traverse(child => {
    if (!child.isMesh) return;
    child.frustumCulled = false;
    const old = child.material;
    const oldColor = old && old.color ? old.color.getHex() : product.colors[0];
    child.material = new THREE.MeshStandardMaterial({
      color: oldColor,
      roughness: 0.78,
      metalness: 0.02,
      side: THREE.DoubleSide
    });
  });
}

function cloneWithIndependentMaterials(source) {
  const clone = source.clone(true);
  clone.traverse(child => {
    if (child.isMesh && child.material) {
      child.material = Array.isArray(child.material)
        ? child.material.map(material => material.clone())
        : child.material.clone();
    }
  });
  return clone;
}

async function loadModel(productId) {
  if (modelCache.has(productId)) return cloneWithIndependentMaterials(modelCache.get(productId));
  const product = PRODUCTS[productId];
  const gltf = await loader.loadAsync(product.url);
  makeMaterialsEditable(gltf.scene, product);
  gltf.scene.updateMatrixWorld(true);
  modelCache.set(productId, gltf.scene);
  return cloneWithIndependentMaterials(gltf.scene);
}

function tintObject(root, color) {
  root.traverse(child => {
    if (!child.isMesh) return;
    if (root.userData.productId === 'curtain' && !/Curtain/i.test(child.name)) return;
    if (child.material?.color) child.material.color.setHex(color);
  });
}

function configureCurtainParts(root) {
  const left = root.getObjectByName('LeftCurtain');
  const right = root.getObjectByName('RightCurtain');
  root.userData.curtainParts = { left, right };
  if (left && right) {
    root.userData.curtainClosed = { leftX: left.position.x, rightX: right.position.x };
  }
}

function labelFor(productId) {
  const count = state.placedObjects.filter(o => o.userData.productId === productId).length + 1;
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
  if (productId === 'curtain') configureCurtainParts(root);
  return root;
}

function setObjectAtCurrentHit(object) {
  const product = PRODUCTS[object.userData.productId];
  object.position.copy(state.lastHitPosition);

  if (product.surface === 'wall') {
    const normal = state.lastSurfaceNormal.clone().normalize();
    // Keep curtains vertical and rotate only around world Y so their local +Z faces the wall normal.
    const yaw = Math.atan2(normal.x, normal.z);
    object.rotation.set(0, yaw, 0);
    object.position.addScaledVector(normal, 0.025);
  } else if (!object.userData.keepRotationOnMove) {
    object.rotation.set(0, 0, 0);
  }
  object.updateMatrixWorld(true);
}

function collides(object, ignore = object) {
  const box = new THREE.Box3().setFromObject(object);
  // Slightly contract the box to avoid false positives from surfaces merely touching.
  const shrink = 0.008;
  box.min.addScalar(shrink);
  box.max.addScalar(-shrink);
  return state.placedObjects.some(other => {
    if (other === ignore) return false;
    const otherBox = new THREE.Box3().setFromObject(other);
    return box.intersectsBox(otherBox);
  });
}

async function placeSelectedProduct() {
  if (!state.validHit) {
    toast('No valid surface. Move the phone until the green reticle appears.', 'error');
    return;
  }
  const productId = state.selectedProductId;
  try {
    setStatus('Loading model', PRODUCTS[productId].name, 'warn');
    const object = await createPlacedObject(productId);
    setObjectAtCurrentHit(object);
    scene.add(object);
    object.updateMatrixWorld(true);

    if (collides(object)) {
      scene.remove(object);
      toast('That position overlaps another object. Choose another location.', 'error');
      setStatus('Placement blocked', 'Move the reticle to a clear location.', 'bad');
      return;
    }

    state.placedObjects.push(object);
    showEditPanel(object);
    state.editMode = 'edit';
    updateMoveButton();
    els.sessionActions.classList.remove('hidden');
    toast(`${PRODUCTS[productId].name} placed.`, 'success');
    setStatus('Object placed', 'Edit it below, or choose Place another.', 'good');
  } catch (error) {
    console.error(error);
    toast('Could not load the 3D model.', 'error');
    setStatus('Model error', 'Check the GLB file and network connection.', 'bad');
  }
}

function moveSelectedToHit() {
  const object = state.selectedObject;
  if (!object || !state.validHit) {
    toast('Find a valid surface before moving the object.', 'error');
    return;
  }
  const oldPos = object.position.clone();
  const oldRot = object.rotation.clone();
  object.userData.keepRotationOnMove = object.userData.productId !== 'curtain';
  setObjectAtCurrentHit(object);
  object.userData.keepRotationOnMove = false;

  if (collides(object)) {
    object.position.copy(oldPos);
    object.rotation.copy(oldRot);
    object.updateMatrixWorld(true);
    toast('Move rejected because it would overlap another object.', 'error');
    return;
  }
  state.editMode = 'edit';
  updateMoveButton();
  toast('Object moved.', 'success');
  setStatus('Object moved', 'Continue editing or place another item.', 'good');
}

function rotateSelected(delta) {
  if (!state.selectedObject) return;
  const object = state.selectedObject;
  const old = object.rotation.y;
  object.rotation.y += delta;
  object.updateMatrixWorld(true);
  if (collides(object)) {
    object.rotation.y = old;
    toast('Rotation blocked by another object.', 'error');
  }
}

function scaleSelected(factor) {
  if (!state.selectedObject) return;
  const object = state.selectedObject;
  const old = object.scale.clone();
  const next = THREE.MathUtils.clamp(object.scale.x * factor, 0.7, 1.35);
  if (object.userData.productId === 'curtain') {
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
    toast('Resize blocked by another object.', 'error');
  }
}

function cycleColour() {
  const object = state.selectedObject;
  if (!object) return;
  const product = PRODUCTS[object.userData.productId];
  object.userData.colorIndex = (object.userData.colorIndex + 1) % product.colors.length;
  tintObject(object, product.colors[object.userData.colorIndex]);
  toast('Colour changed.', 'success');
}

function resizeCurtain(axis, factor) {
  const object = state.selectedObject;
  if (!object || object.userData.productId !== 'curtain') return;
  const old = object.scale.clone();
  if (axis === 'x') object.scale.x = THREE.MathUtils.clamp(object.scale.x * factor, 0.55, 1.75);
  if (axis === 'y') object.scale.y = THREE.MathUtils.clamp(object.scale.y * factor, 0.55, 1.65);
  object.updateMatrixWorld(true);
  if (collides(object)) {
    object.scale.copy(old);
    toast('Curtain resize blocked by another object.', 'error');
  }
}

function animateCurtain(open) {
  const object = state.selectedObject;
  if (!object || object.userData.productId !== 'curtain') return;
  const parts = object.userData.curtainParts;
  const closed = object.userData.curtainClosed;
  if (!parts?.left || !parts?.right || !closed) {
    toast('Curtain panel nodes were not found in the model.', 'error');
    return;
  }
  const startLeft = parts.left.position.x;
  const startRight = parts.right.position.x;
  const targetLeft = open ? closed.leftX - 0.32 : closed.leftX;
  const targetRight = open ? closed.rightX + 0.32 : closed.rightX;
  state.curtainAnimations.push({
    root: object,
    left: parts.left,
    right: parts.right,
    startLeft,
    startRight,
    targetLeft,
    targetRight,
    startTime: performance.now(),
    duration: 450
  });
  object.userData.curtainOpen = open;
  els.curtainToggleButton.textContent = open ? 'Close curtains' : 'Open curtains';
}

function updateCurtainAnimations(now) {
  state.curtainAnimations = state.curtainAnimations.filter(anim => {
    const t = Math.min(1, (now - anim.startTime) / anim.duration);
    const eased = 1 - Math.pow(1 - t, 3);
    anim.left.position.x = THREE.MathUtils.lerp(anim.startLeft, anim.targetLeft, eased);
    anim.right.position.x = THREE.MathUtils.lerp(anim.startRight, anim.targetRight, eased);
    if (t >= 1) return false;
    return true;
  });
}

function deleteSelected() {
  const object = state.selectedObject;
  if (!object) return;
  scene.remove(object);
  state.placedObjects = state.placedObjects.filter(o => o !== object);
  state.selectedObject = state.placedObjects.at(-1) || null;
  showEditPanel(state.selectedObject);
  if (!state.placedObjects.length) els.sessionActions.classList.add('hidden');
  toast('Object deleted.');
}

function clearRoom() {
  state.placedObjects.forEach(o => scene.remove(o));
  state.placedObjects = [];
  state.selectedObject = null;
  showEditPanel(null);
  els.sessionActions.classList.add('hidden');
  state.editMode = 'place';
  updateMoveButton();
  toast('Room cleared.');
}

function selectNextObject() {
  if (!state.placedObjects.length) return;
  const currentIndex = state.selectedObject ? state.placedObjects.indexOf(state.selectedObject) : -1;
  const next = state.placedObjects[(currentIndex + 1) % state.placedObjects.length];
  showEditPanel(next);
  state.editMode = 'edit';
  updateMoveButton();
  toast(`Selected ${next.userData.instanceLabel}.`);
}

function onXRSelect() {
  if (!state.xrSession) return;
  if (state.editMode === 'move') moveSelectedToHit();
  else if (state.editMode === 'place') placeSelectedProduct();
}

function evaluateHitPose(pose) {
  state.lastHitPosition.setFromMatrixPosition(new THREE.Matrix4().fromArray(pose.transform.matrix));
  state.lastHitQuaternion.setFromRotationMatrix(new THREE.Matrix4().fromArray(pose.transform.matrix));
  state.lastSurfaceNormal.set(0, 1, 0).applyQuaternion(state.lastHitQuaternion).normalize();

  const product = selectedProduct();
  if (state.editMode === 'edit') {
    reticle.visible = false;
    state.validHit = false;
    return;
  }
  const horizontal = state.lastSurfaceNormal.y > 0.70;
  const vertical = Math.abs(state.lastSurfaceNormal.y) < 0.40;
  state.validHit = product.surface === 'floor' ? horizontal : vertical;

  reticle.visible = state.validHit;
  if (state.validHit) {
    reticle.matrix.fromArray(pose.transform.matrix);
    reticle.material.color.setHex(product.surface === 'floor' ? 0x2dd4bf : 0xf59e0b);
    if (state.editMode === 'move') {
      setStatus('Move mode', 'Tap the valid reticle to move the selected object.', 'warn');
    } else if (state.editMode === 'place') {
      setStatus(product.surface === 'floor' ? 'Floor detected' : 'Wall detected', `Tap to place ${product.name}.`, 'good');
    }
  } else if (state.editMode === 'place' || state.editMode === 'move') {
    const prompt = product.surface === 'floor' ? 'Aim at a horizontal floor surface.' : 'Aim at a vertical wall surface.';
    setStatus('Scanning surface', prompt, 'warn');
  }
}

function onXRFrame(_time, frame) {
  const session = renderer.xr.getSession();
  if (!session) return;

  if (!state.hitTestSourceRequested) {
    session.requestReferenceSpace('viewer').then(referenceSpace => {
      session.requestHitTestSource({ space: referenceSpace }).then(source => {
        state.hitTestSource = source;
      });
    }).catch(error => {
      console.error(error);
      setStatus('Hit-test unavailable', 'This device could not create a hit-test source.', 'bad');
    });
    session.addEventListener('end', () => {
      state.hitTestSourceRequested = false;
      state.hitTestSource = null;
      state.xrSession = null;
      state.validHit = false;
      reticle.visible = false;
      els.startPanel.classList.remove('hidden');
      els.cataloguePanel.classList.add('hidden');
      els.editPanel.classList.add('hidden');
      els.sessionActions.classList.add('hidden');
      setStatus('AR session ended', 'You can start another session.', '');
    }, { once: true });
    state.hitTestSourceRequested = true;
  }

  if (state.hitTestSource) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const hitTestResults = frame.getHitTestResults(state.hitTestSource);
    if (hitTestResults.length) {
      const pose = hitTestResults[0].getPose(referenceSpace);
      if (pose) evaluateHitPose(pose);
    } else {
      reticle.visible = false;
      state.validHit = false;
      if (state.editMode === 'place' || state.editMode === 'move') setStatus('Scanning room', 'Move your phone slowly and keep a surface in view.', 'warn');
    }
  }
}

function isInteractiveUI(target) {
  return Boolean(target?.closest?.('button, a, .catalogue-panel, .edit-panel, .session-actions, .start-panel, .modal-backdrop'));
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
  if (xrCamera?.isArrayCamera && xrCamera.cameras?.length) return xrCamera.cameras[0];
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
  state.placedObjects.forEach(root => root.traverse(child => {
    if (child.isMesh) meshes.push(child);
  }));
  const hit = touchRaycaster.intersectObjects(meshes, false)[0];
  return hit ? findPlacedRoot(hit.object) : null;
}

function applyGestureMove(dx, dy) {
  const object = state.selectedObject;
  if (!object) return;

  // Save old transform so collision checks can safely reject a drag step.
  const oldPosition = object.position.clone();
  const speed = THREE.MathUtils.clamp(object.position.distanceTo(getActiveXRCamera().position) * 0.0016, 0.0008, 0.0045);

  if (object.userData.productId === 'curtain') {
    // Curtains move only along their own wall plane: local X for left/right, world Y for up/down.
    const wallRight = new THREE.Vector3(1, 0, 0).applyQuaternion(object.quaternion).normalize();
    object.position.addScaledVector(wallRight, dx * speed);
    object.position.y += -dy * speed;
  } else {
    // Furniture stays on the same floor height while following the viewer's horizontal axes.
    const xrCamera = getActiveXRCamera();
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(xrCamera.quaternion);
    cameraRight.y = 0;
    if (cameraRight.lengthSq() < 1e-6) cameraRight.set(1, 0, 0);
    cameraRight.normalize();

    const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(xrCamera.quaternion);
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
  const distance = Math.max(20, getTouchDistance(t1, t2));
  const angle = getTouchAngle(t1, t2);
  const scaleFactor = THREE.MathUtils.clamp(distance / Math.max(20, gesture.startDistance), 0.55, 1.8);
  const angleDelta = normalizeAngle(angle - gesture.startAngle);

  const oldScale = object.scale.clone();
  const oldRotation = object.rotation.y;

  if (object.userData.productId === 'curtain') {
    object.scale.x = THREE.MathUtils.clamp(gesture.startScale.x * scaleFactor, 0.55, 1.75);
    object.scale.y = THREE.MathUtils.clamp(gesture.startScale.y * scaleFactor, 0.55, 1.65);
    object.scale.z = gesture.startScale.z;
  } else {
    const uniform = THREE.MathUtils.clamp(gesture.startScale.x * scaleFactor, 0.7, 1.35);
    object.scale.setScalar(uniform);
  }
  object.rotation.y = gesture.startRotationY - angleDelta;
  object.updateMatrixWorld(true);

  if (collides(object)) {
    object.scale.copy(oldScale);
    object.rotation.y = oldRotation;
    object.updateMatrixWorld(true);
  }
}

function onGestureTouchStart(event) {
  if (!state.xrSession || isInteractiveUI(event.target)) return;
  if (state.editMode === 'place' || state.editMode === 'move') return;

  const touches = event.touches;
  if (!touches.length) return;

  if (touches.length === 1) {
    const picked = pickPlacedObject(touches[0].clientX, touches[0].clientY);
    if (picked) {
      showEditPanel(picked);
      state.editMode = 'edit';
      updateMoveButton();
      toast(`Selected ${picked.userData.instanceLabel}. Drag to move, pinch to resize, twist to rotate.`);
    }
    if (!state.selectedObject) return;

    state.gesture.active = true;
    state.gesture.mode = 'move';
    state.gesture.moved = false;
    state.gesture.lastX = touches[0].clientX;
    state.gesture.lastY = touches[0].clientY;
  } else if (touches.length >= 2 && state.selectedObject) {
    state.gesture.active = true;
    state.gesture.mode = 'pinch-rotate';
    state.gesture.moved = false;
    state.gesture.startDistance = getTouchDistance(touches[0], touches[1]);
    state.gesture.startAngle = getTouchAngle(touches[0], touches[1]);
    state.gesture.startScale.copy(state.selectedObject.scale);
    state.gesture.startRotationY = state.selectedObject.rotation.y;
  }

  if (state.gesture.active) event.preventDefault();
}

function onGestureTouchMove(event) {
  if (!state.gesture.active || !state.selectedObject || isInteractiveUI(event.target)) return;

  if (event.touches.length === 1 && state.gesture.mode === 'move') {
    const touch = event.touches[0];
    const dx = touch.clientX - state.gesture.lastX;
    const dy = touch.clientY - state.gesture.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 1.5) state.gesture.moved = true;
    applyGestureMove(dx, dy);
    state.gesture.lastX = touch.clientX;
    state.gesture.lastY = touch.clientY;
    setStatus('Gesture move', 'Drag with one finger to reposition the selected object.', 'good');
  } else if (event.touches.length >= 2) {
    if (state.gesture.mode !== 'pinch-rotate') {
      state.gesture.mode = 'pinch-rotate';
      state.gesture.startDistance = getTouchDistance(event.touches[0], event.touches[1]);
      state.gesture.startAngle = getTouchAngle(event.touches[0], event.touches[1]);
      state.gesture.startScale.copy(state.selectedObject.scale);
      state.gesture.startRotationY = state.selectedObject.rotation.y;
    }
    state.gesture.moved = true;
    applyPinchAndTwist(event.touches[0], event.touches[1]);
    setStatus('Gesture edit', 'Pinch to resize • twist two fingers to rotate.', 'good');
  }

  event.preventDefault();
}

function onGestureTouchEnd(event) {
  if (!state.gesture.active) return;

  // Transition smoothly from two fingers back to one finger.
  if (event.touches.length === 1 && state.selectedObject) {
    state.gesture.mode = 'move';
    state.gesture.lastX = event.touches[0].clientX;
    state.gesture.lastY = event.touches[0].clientY;
    event.preventDefault();
    return;
  }

  if (event.touches.length === 0) {
    if (state.gesture.moved) toast('Gesture applied.', 'success');
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
    state.editMode = 'edit';
    updateMoveButton();
    toast(`Selected ${picked.userData.instanceLabel}. Drag to move, pinch to resize, twist to rotate.`);
  }
  if (!state.selectedObject) return false;

  state.gesture.active = true;
  state.gesture.mode = 'move';
  state.gesture.moved = false;
  state.gesture.lastX = point.clientX;
  state.gesture.lastY = point.clientY;
  return true;
}

function beginTwoFingerGesture(points) {
  if (!state.selectedObject || points.length < 2) return false;
  const [p1, p2] = points;
  state.gesture.active = true;
  state.gesture.mode = 'pinch-rotate';
  state.gesture.moved = false;
  state.gesture.startDistance = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
  state.gesture.startAngle = Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX);
  state.gesture.startScale.copy(state.selectedObject.scale);
  state.gesture.startRotationY = state.selectedObject.rotation.y;
  return true;
}

function onGesturePointerDown(event) {
  if (event.pointerType !== 'touch') return;
  if (!state.xrSession || isInteractiveUI(event.target)) return;
  if (state.editMode === 'place' || state.editMode === 'move') return;

  gesturePointers.set(event.pointerId, {
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY
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
  if (event.pointerType !== 'touch' || !gesturePointers.has(event.pointerId)) return;

  gesturePointers.set(event.pointerId, {
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY
  });

  if (!state.gesture.active || !state.selectedObject) return;
  const points = pointerSnapshot();

  if (points.length === 1) {
    const point = points[0];
    if (state.gesture.mode !== 'move') {
      state.gesture.mode = 'move';
      state.gesture.lastX = point.clientX;
      state.gesture.lastY = point.clientY;
    }
    const dx = point.clientX - state.gesture.lastX;
    const dy = point.clientY - state.gesture.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 1.5) state.gesture.moved = true;
    applyGestureMove(dx, dy);
    state.gesture.lastX = point.clientX;
    state.gesture.lastY = point.clientY;
    setStatus('Gesture move', 'Drag with one finger to reposition the selected object.', 'good');
  } else if (points.length >= 2) {
    if (state.gesture.mode !== 'pinch-rotate') beginTwoFingerGesture(points);
    const [p1, p2] = points;
    state.gesture.moved = true;
    applyPinchAndTwist(p1, p2);
    setStatus('Gesture edit', 'Pinch to resize • twist two fingers to rotate.', 'good');
  }

  event.preventDefault();
  event.stopPropagation();
}

function onGesturePointerEnd(event) {
  if (event.pointerType !== 'touch' || !gesturePointers.has(event.pointerId)) return;
  gesturePointers.delete(event.pointerId);

  const points = pointerSnapshot();
  if (points.length === 1 && state.selectedObject) {
    state.gesture.mode = 'move';
    state.gesture.lastX = points[0].clientX;
    state.gesture.lastY = points[0].clientY;
  } else if (points.length === 0) {
    if (state.gesture.active && state.gesture.moved) toast('Gesture applied.', 'success');
    state.gesture.active = false;
    state.gesture.mode = null;
    state.gesture.moved = false;
  }

  if (state.editMode === 'edit') {
    event.preventDefault();
    event.stopPropagation();
  }
}

function bindGestureControls() {
  // Important: use document-level capture instead of renderer.domElement. In immersive WebXR
  // with DOM Overlay, Android Chrome often sends touch/pointer input to the overlay rather
  // than to the WebGL canvas, which made the previous gesture implementation appear inactive.
  if (window.PointerEvent) {
    document.addEventListener('pointerdown', onGesturePointerDown, { passive: false, capture: true });
    document.addEventListener('pointermove', onGesturePointerMove, { passive: false, capture: true });
    document.addEventListener('pointerup', onGesturePointerEnd, { passive: false, capture: true });
    document.addEventListener('pointercancel', onGesturePointerEnd, { passive: false, capture: true });
  } else {
    // Fallback for older browsers.
    document.addEventListener('touchstart', onGestureTouchStart, { passive: false, capture: true });
    document.addEventListener('touchmove', onGestureTouchMove, { passive: false, capture: true });
    document.addEventListener('touchend', onGestureTouchEnd, { passive: false, capture: true });
    document.addEventListener('touchcancel', onGestureTouchEnd, { passive: false, capture: true });
  }
}

function bindUI() {
  els.tabs.forEach(tab => tab.addEventListener('click', () => selectFilter(tab.dataset.filter)));
  els.moveButton.addEventListener('click', () => {
    if (!state.selectedObject) return;
    state.editMode = state.editMode === 'move' ? 'edit' : 'move';
    updateMoveButton();
    if (state.editMode === 'move') {
      state.selectedProductId = state.selectedObject.userData.productId;
      state.filter = PRODUCTS[state.selectedProductId].surface;
      renderProducts();
      els.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.filter === state.filter));
      toast('Move mode: tap a new valid surface.');
    }
  });
  els.rotateLeftButton.addEventListener('click', () => rotateSelected(THREE.MathUtils.degToRad(15)));
  els.rotateRightButton.addEventListener('click', () => rotateSelected(THREE.MathUtils.degToRad(-15)));
  els.scaleDownButton.addEventListener('click', () => scaleSelected(0.90));
  els.scaleUpButton.addEventListener('click', () => scaleSelected(1.10));
  els.colourButton.addEventListener('click', cycleColour);
  els.deleteButton.addEventListener('click', deleteSelected);
  els.nextObjectButton.addEventListener('click', selectNextObject);
  els.widthDownButton.addEventListener('click', () => resizeCurtain('x', 0.90));
  els.widthUpButton.addEventListener('click', () => resizeCurtain('x', 1.10));
  els.heightDownButton.addEventListener('click', () => resizeCurtain('y', 0.90));
  els.heightUpButton.addEventListener('click', () => resizeCurtain('y', 1.10));
  els.curtainToggleButton.addEventListener('click', () => animateCurtain(!state.selectedObject?.userData.curtainOpen));
  els.placeAnotherButton.addEventListener('click', () => {
    state.editMode = 'place';
    updateMoveButton();
    showEditPanel(state.selectedObject);
    toast(`Place mode: ${selectedProduct().name}.`);
  });
  els.clearButton.addEventListener('click', clearRoom);
  els.exitArButton.addEventListener('click', async () => {
    if (state.xrSession) {
      try { await state.xrSession.end(); } catch (error) { console.warn(error); }
    }
  });
  els.helpButton.addEventListener('click', () => els.helpModal.classList.remove('hidden'));
  els.closeHelpButton.addEventListener('click', () => els.helpModal.classList.add('hidden'));
  els.helpModal.addEventListener('click', event => {
    if (event.target === els.helpModal) els.helpModal.classList.add('hidden');
  });
  // Prevent DOM overlay taps from also becoming XR select events.
  els.uiOverlay.addEventListener('beforexrselect', event => event.preventDefault());
}

async function setupARButton() {
  if (!navigator.xr) {
    els.supportMessage.textContent = 'WebXR is not available in this browser. Use an AR-capable Android device with current Chrome.';
    els.supportMessage.classList.add('error');
    setStatus('WebXR unavailable', 'Try a supported Android browser.', 'bad');
    return;
  }

  const supported = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
  if (!supported) {
    els.supportMessage.textContent = 'Immersive AR is not supported on this device/browser. Marker mode may still work.';
    els.supportMessage.classList.add('error');
    setStatus('AR unavailable', 'Immersive AR is not supported here.', 'bad');
    return;
  }

  els.supportMessage.textContent = 'AR support detected. Use a well-lit room and move the phone slowly.';
  els.supportMessage.classList.add('success');
  setStatus('AR supported', 'Choose a product and enter AR.', 'good');

  const button = ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay', 'local-floor'],
    domOverlay: { root: els.uiOverlay }
  });
  button.textContent = 'ENTER AR';
  els.arButtonMount.appendChild(button);

  renderer.xr.addEventListener('sessionstart', () => {
    state.xrSession = renderer.xr.getSession();
    els.startPanel.classList.add('hidden');
    els.cataloguePanel.classList.remove('hidden');
    if (state.placedObjects.length) els.sessionActions.classList.remove('hidden');
    state.editMode = 'place';
    updateMoveButton();
    setStatus('Scanning room', 'Move your phone slowly to detect a floor.', 'warn');
  });
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

bindUI();
bindGestureControls();
renderProducts();
els.cataloguePanel.classList.add('hidden');
setupARButton();
renderer.setAnimationLoop((time, frame) => {
  if (frame) onXRFrame(time, frame);
  updateCurtainAnimations(time);
  renderer.render(scene, camera);
});
