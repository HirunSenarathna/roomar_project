(() => {
  const MARKER_START_ROTATION = "-90 0 0";
  const products = {
    sofa: {
      name: "Modern Sofa",
      asset: "#sofaModel",
      scale: "0.42 0.42 0.42",
      position: "0 0 0",
    },

    chair: {
      name: "Lounge Chair",
      asset: "#chairModel",
      scale: "0.55 0.55 0.55",
      position: "0 0 0",
    },

    table: {
      name: "Coffee Table",
      asset: "#tableModel",
      scale: "0.55 0.55 0.55",
      position: "0 0 0",
    },

    plant: {
      name: "Indoor Plant",
      asset: "#plantModel",
      scale: "0.52 0.52 0.52",
      position: "0 0 0",
    },

    curtain: {
      name: "Curtain Set",
      asset: "#curtainModel",
      scale: "0.40 0.40 0.40",
      position: "0 0.48 0",
    },
  };

  const marker = document.querySelector("#hiroMarker");

  const model = document.querySelector("#markerModel");

  const title = document.querySelector("#markerStatusTitle");

  const text = document.querySelector("#markerStatusText");

  const dot = document.querySelector("#markerDot");

  const productName = document.querySelector("#markerProductName");

  const buttons = [...document.querySelectorAll("[data-product]")];

  // =========================================
  // MARKER CURTAIN CONTROLS
  // =========================================

  const curtainToggle = document.querySelector("#markerCurtainToggle");

  let currentProductId = "sofa";

  let markerCurtainOpen = false;

  let markerCurtainParts = null;

  let markerCurtainClosed = null;

  let markerCurtainAnimation = null;

  // =========================================
  // CURTAIN AUDIO
  // =========================================

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

    sound.play().catch(() => {});
  }

  // =========================================
  // FIND CURTAIN PANELS
  // =========================================

  // =========================================
  // CREATE LEFT AND RIGHT CURTAIN PANELS
  // =========================================

  function markerCurtainFabricCandidate(root) {
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

      // Find the fabric and ignore the thin metal rail.
      candidates.push({
        child,
        surfaceArea: dimensions[0] * dimensions[1],
      });
    });

    candidates.sort((a, b) => b.surfaceArea - a.surfaceArea);

    return candidates[0]?.child ?? null;
  }

  function markerGeometryForCurtainSide(sourceGeometry, dividerX, side) {
    const source = sourceGeometry.index
      ? sourceGeometry.toNonIndexed()
      : sourceGeometry.clone();

    const position = source.getAttribute("position");

    const selectedVertices = [];

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

      const values = new ArrayType(
        selectedVertices.length * attribute.itemSize,
      );

      let targetIndex = 0;

      for (const sourceIndex of selectedVertices) {
        for (
          let component = 0;
          component < attribute.itemSize;
          component += 1
        ) {
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

  function cloneMarkerCurtainMaterial(material) {
    return Array.isArray(material)
      ? material.map((entry) => entry.clone())
      : material.clone();
  }

  function configureMarkerCurtainParts() {
    markerCurtainParts = null;
    markerCurtainClosed = null;

    const fabricSource = markerCurtainFabricCandidate(model.object3D);

    const parent = fabricSource?.parent;

    const sourceBox = fabricSource?.geometry?.boundingBox;

    if (!fabricSource || !parent || !sourceBox) {
      console.error("Marker curtain fabric geometry was not found.");

      return false;
    }

    const dividerX = (sourceBox.min.x + sourceBox.max.x) / 2;

    const leftGeometry = markerGeometryForCurtainSide(
      fabricSource.geometry,
      dividerX,
      "left",
    );

    const rightGeometry = markerGeometryForCurtainSide(
      fabricSource.geometry,
      dividerX,
      "right",
    );

    if (!leftGeometry || !rightGeometry) {
      leftGeometry?.dispose();
      rightGeometry?.dispose();

      console.error("Marker curtain could not be divided into two panels.");

      return false;
    }

    // Preserve the original model transform.
    const panelContainer = new THREE.Group();

    panelContainer.name = "MarkerCurtainPanelContainer";

    panelContainer.position.copy(fabricSource.position);

    panelContainer.quaternion.copy(fabricSource.quaternion);

    panelContainer.scale.copy(fabricSource.scale);

    panelContainer.visible = fabricSource.visible;

    const left = new THREE.Mesh(
      leftGeometry,
      cloneMarkerCurtainMaterial(fabricSource.material),
    );

    const right = new THREE.Mesh(
      rightGeometry,
      cloneMarkerCurtainMaterial(fabricSource.material),
    );

    left.name = "LeftCurtain";
    right.name = "RightCurtain";

    left.frustumCulled = false;
    right.frustumCulled = false;

    const leftCentreX =
      (leftGeometry.boundingBox.min.x + leftGeometry.boundingBox.max.x) / 2;

    const rightCentreX =
      (rightGeometry.boundingBox.min.x + rightGeometry.boundingBox.max.x) / 2;

    const leftHalfWidth =
      (leftGeometry.boundingBox.max.x - leftGeometry.boundingBox.min.x) / 2;

    const rightHalfWidth =
      (rightGeometry.boundingBox.max.x - rightGeometry.boundingBox.min.x) / 2;

    // Centre each panel around its own origin.
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

    // Remove only the old combined fabric.
    // The metal rail remains visible.
    parent.remove(fabricSource);

    markerCurtainParts = {
      left,
      right,
      panelContainer,
    };

    markerCurtainClosed = {
      leftX: left.position.x,
      rightX: right.position.x,

      leftScaleX: left.scale.x,
      rightScaleX: right.scale.x,

      leftHalfWidth,
      rightHalfWidth,
    };

    model.object3D.updateMatrixWorld(true);

    console.info("Marker curtain panels configured.");

    return true;
  }

  // =========================================
  // OPEN / CLOSE CURTAIN
  // =========================================

  function animateMarkerCurtain(open) {
    if (
      currentProductId !== "curtain" ||
      !markerCurtainParts ||
      !markerCurtainClosed
    ) {
      return;
    }

    const { left, right } = markerCurtainParts;

    const closed = markerCurtainClosed;

    // Opened curtain panel width.
    const openWidth = 0.3;

    const targetLeftScaleX = open
      ? closed.leftScaleX * openWidth
      : closed.leftScaleX;

    const targetRightScaleX = open
      ? closed.rightScaleX * openWidth
      : closed.rightScaleX;

    // Move the left panel towards the left.
    const targetLeft = open
      ? closed.leftX -
        closed.leftHalfWidth * (closed.leftScaleX - targetLeftScaleX)
      : closed.leftX;

    // Move the right panel towards the right.
    const targetRight = open
      ? closed.rightX +
        closed.rightHalfWidth * (closed.rightScaleX - targetRightScaleX)
      : closed.rightX;

    markerCurtainAnimation = {
      startTime: performance.now(),

      duration: 1200,

      left,
      right,

      startLeft: left.position.x,
      startRight: right.position.x,

      targetLeft,
      targetRight,

      startLeftScaleX: left.scale.x,
      startRightScaleX: right.scale.x,

      targetLeftScaleX,
      targetRightScaleX,
    };

    markerCurtainOpen = open;

    curtainToggle.textContent = open ? "Close curtains" : "Open curtains";

    playCurtainSound(open);

    requestAnimationFrame(updateMarkerCurtainAnimation);
  }

  // =========================================
  // CURTAIN ANIMATION LOOP
  // =========================================

  function updateMarkerCurtainAnimation(now) {
    const animation = markerCurtainAnimation;

    if (!animation) {
      return;
    }

    const t = Math.min(
      1,

      (now - animation.startTime) / animation.duration,
    );

    const eased = t * t * (3 - 2 * t);

    // Left curtain movement
    animation.left.position.x = THREE.MathUtils.lerp(
      animation.startLeft,

      animation.targetLeft,

      eased,
    );

    // Right curtain movement
    animation.right.position.x = THREE.MathUtils.lerp(
      animation.startRight,

      animation.targetRight,

      eased,
    );

    // Left curtain gathering
    animation.left.scale.x = THREE.MathUtils.lerp(
      animation.startLeftScaleX,

      animation.targetLeftScaleX,

      eased,
    );

    // Right curtain gathering
    animation.right.scale.x = THREE.MathUtils.lerp(
      animation.startRightScaleX,

      animation.targetRightScaleX,

      eased,
    );

    if (t < 1) {
      requestAnimationFrame(updateMarkerCurtainAnimation);
    } else {
      markerCurtainAnimation = null;
    }
  }

  // =========================================
  // PRODUCT SELECTION
  // =========================================

  function selectProduct(id) {
    const p = products[id];

    if (!p) return;

    currentProductId = id;

    markerCurtainOpen = false;

    markerCurtainParts = null;

    markerCurtainClosed = null;

    markerCurtainAnimation = null;

    if (curtainToggle) {
      curtainToggle.classList.toggle("hidden", id !== "curtain");

      curtainToggle.textContent = "Open curtains";
    }
    model.setAttribute("visible", false);

    model.setAttribute("gltf-model", p.asset);

    model.setAttribute("scale", p.scale);

    model.setAttribute("position", p.position);

    /*
  Face the model toward the camera when
  the marker is first detected.
*/
    model.setAttribute("rotation", MARKER_START_ROTATION);

    productName.textContent = p.name;

    buttons.forEach((button) => {
      button.classList.toggle("active", button.dataset.product === id);
    });
  }

  model.addEventListener("model-loaded", () => {
    model.setAttribute("visible", true);

    /*
     * When curtain model finishes loading,
     * detect its left and right panels.
     */
    if (currentProductId === "curtain") {
      configureMarkerCurtainParts();
    }
  });

  // =========================================
  // MARKER DETECTION
  // =========================================

  marker.addEventListener("markerFound", () => {
    title.textContent = "Marker detected";

    text.textContent = "Pinch to zoom and drag or twist to rotate the model.";

    dot.classList.add("good");
  });

  marker.addEventListener("markerLost", () => {
    title.textContent = "Searching for marker";

    text.textContent = "Keep the full Hiro marker visible and well lit.";

    dot.classList.remove("good");
  });

  // =========================================
  // GESTURE STATE
  // =========================================

  const gesturePointers = new Map();

  const gesture = {
    active: false,

    mode: null,

    lastX: 0,
    lastY: 0,

    startDistance: 0,
    startAngle: 0,

    // Used for vertical two-finger movement
    startMidY: 0,

    startScale: null,

    startRotationX: 0,
    startRotationY: 0,
  };

  // =========================================
  // HELPERS
  // =========================================

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeAngle(angle) {
    while (angle > Math.PI) {
      angle -= Math.PI * 2;
    }

    while (angle < -Math.PI) {
      angle += Math.PI * 2;
    }

    return angle;
  }

  function points() {
    return [...gesturePointers.values()];
  }

  // =========================================
  // BEGIN TWO-FINGER GESTURE
  // =========================================

  function beginTwoFingerGesture(list) {
    if (list.length < 2) {
      return;
    }

    const [p1, p2] = list;

    gesture.active = true;

    gesture.mode = "pinch-rotate";

    gesture.startDistance = Math.max(
      20,

      Math.hypot(
        p2.x - p1.x,

        p2.y - p1.y,
      ),
    );

    gesture.startAngle = Math.atan2(
      p2.y - p1.y,

      p2.x - p1.x,
    );

    /*
      Middle point between both fingers.

      Moving both fingers vertically
      will rotate around X.
    */
    gesture.startMidY = (p1.y + p2.y) * 0.5;

    gesture.startScale = model.object3D.scale.clone();

    gesture.startRotationX = model.object3D.rotation.x;

    gesture.startRotationY = model.object3D.rotation.y;
  }

  // =========================================
  // POINTER DOWN
  // =========================================

  function onGesturePointerDown(event) {
    if (event.pointerType !== "touch") {
      return;
    }

    /*
      Do not manipulate model when touching
      buttons / catalogue controls.
    */
    if (event.target.closest?.("button, a, .marker-panel, .marker-topbar")) {
      return;
    }

    gesturePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const list = points();

    // -------------------------------------
    // ONE FINGER
    // -------------------------------------

    if (list.length === 1) {
      gesture.active = true;

      gesture.mode = "rotate";

      gesture.lastX = list[0].x;

      gesture.lastY = list[0].y;
    }

    // -------------------------------------
    // TWO FINGERS
    // -------------------------------------
    else if (list.length >= 2) {
      beginTwoFingerGesture(list);
    }

    event.preventDefault();
  }

  // =========================================
  // POINTER MOVE
  // =========================================

  function onGesturePointerMove(event) {
    if (event.pointerType !== "touch") {
      return;
    }

    if (!gesturePointers.has(event.pointerId)) {
      return;
    }

    gesturePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (!gesture.active) {
      return;
    }

    const list = points();

    // =====================================
    // ONE FINGER = FREE ROTATION
    // =====================================

    if (list.length === 1) {
      const p = list[0];

      if (gesture.mode !== "rotate") {
        gesture.mode = "rotate";

        gesture.lastX = p.x;

        gesture.lastY = p.y;
      }

      const dx = p.x - gesture.lastX;

      const dy = p.y - gesture.lastY;

      /*
        Horizontal drag
        =
        rotate left / right.
      */
      model.object3D.rotation.y = normalizeAngle(
        model.object3D.rotation.y - dx * 0.01,
      );

      /*
        Vertical drag
        =
        rotate forward/backward.

        Continue dragging and the model
        can rotate upside down.
      */
      model.object3D.rotation.x = normalizeAngle(
        model.object3D.rotation.x + dy * 0.01,
      );

      gesture.lastX = p.x;

      gesture.lastY = p.y;

      title.textContent = "Gesture rotate";

      text.textContent =
        "Drag left/right to rotate. Drag up/down to flip the model.";
    }

    // =====================================
    // TWO FINGERS
    // =====================================
    else if (list.length >= 2) {
      if (gesture.mode !== "pinch-rotate") {
        beginTwoFingerGesture(list);
      }

      const [p1, p2] = list;

      // -------------------------
      // Current pinch distance
      // -------------------------

      const distance = Math.max(
        20,

        Math.hypot(
          p2.x - p1.x,

          p2.y - p1.y,
        ),
      );

      // -------------------------
      // Current twist angle
      // -------------------------

      const angle = Math.atan2(
        p2.y - p1.y,

        p2.x - p1.x,
      );

      // -------------------------
      // Current finger midpoint
      // -------------------------

      const midY = (p1.y + p2.y) * 0.5;

      // ===================================
      // PINCH = ZOOM
      // ===================================

      const scaleFactor = clamp(
        distance / gesture.startDistance,

        0.35,
        3.0,
      );

      // ===================================
      // TWIST = LEFT / RIGHT
      // ===================================

      const angleDelta = normalizeAngle(angle - gesture.startAngle);

      // ===================================
      // BOTH FINGERS UP/DOWN = FLIP
      // ===================================

      const pitchDelta = (midY - gesture.startMidY) * 0.012;

      // ===================================
      // APPLY SCALE
      // ===================================

      model.object3D.scale.copy(gesture.startScale).multiplyScalar(scaleFactor);

      // ===================================
      // APPLY Y ROTATION
      // ===================================

      model.object3D.rotation.y = normalizeAngle(
        gesture.startRotationY - angleDelta,
      );

      // ===================================
      // APPLY X ROTATION
      // ===================================

      model.object3D.rotation.x = normalizeAngle(
        gesture.startRotationX + pitchDelta,
      );

      title.textContent = "Gesture edit";

      text.textContent =
        "Pinch = zoom • twist = rotate • slide both fingers = flip.";
    }

    event.preventDefault();
  }

  // =========================================
  // POINTER END
  // =========================================

  function onGesturePointerEnd(event) {
    if (event.pointerType !== "touch") {
      return;
    }

    if (!gesturePointers.has(event.pointerId)) {
      return;
    }

    gesturePointers.delete(event.pointerId);

    const list = points();

    /*
      If one finger remains after pinch,
      continue with one-finger rotation.
    */
    if (list.length === 1) {
      gesture.mode = "rotate";

      gesture.lastX = list[0].x;

      gesture.lastY = list[0].y;
    } else if (list.length === 0) {
      /*
      All fingers removed.
    */
      gesture.active = false;

      gesture.mode = null;
    }

    event.preventDefault();
  }

  // =========================================
  // REGISTER TOUCH EVENTS
  // =========================================

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
  }

  // =========================================
  // PRODUCT BUTTONS
  // =========================================

  buttons.forEach((button) =>
    button.addEventListener("click", () =>
      selectProduct(button.dataset.product),
    ),
  );
  if (curtainToggle) {
    curtainToggle.addEventListener("click", (event) => {
      /*
       * Do not allow this tap
       * to affect the AR model gesture.
       */
      event.stopPropagation();

      animateMarkerCurtain(!markerCurtainOpen);
    });
  }

  // Default model
  selectProduct("sofa");
})();
