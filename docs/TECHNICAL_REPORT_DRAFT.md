# RoomAR: Web-Based AR Interior Design and Curtain Visualization System

> Edit this draft with your own screenshots, test results, device names and real development challenges before submission.

## 1. Problem Definition and Proposed Solution

Purchasing furniture and curtains involves spatial decisions that are difficult to make from conventional product photographs. Users may struggle to judge whether a sofa is appropriately sized for a room, whether a table conflicts with existing furniture, or whether a curtain colour and proportion suits a wall/window area. RoomAR addresses this problem through a browser-based augmented-reality prototype that lets a user inspect catalogue products using marker-based AR and then place selected items into the real room using markerless WebXR.

WebXR is appropriate because the experience can be delivered through a mobile browser without requiring the user to install a dedicated native application. The solution focuses on a usable technical prototype rather than a commercial furniture catalogue.

## 2. Design and Implementation

### 2.1 Technology stack

The markerless experience is implemented using Three.js and the WebXR Device API. The application requests an `immersive-ar` session with hit-test support. A hit-test source is created from the viewer reference space, and hit-test poses are evaluated each XR frame. A placement reticle is shown when the currently selected product is compatible with the estimated surface orientation.

The marker-based experience is implemented using A-Frame and AR.js. A Hiro marker is used as the known tracking target. A local GLB product model is attached to the marker and remains registered to it while visible. The user can switch between the sofa, chair, table, plant and curtain models from a mobile overlay.

### 2.2 3D content and optimization

Five local GLB models are included: sofa, chair, coffee table, plant and curtain set. The models are intentionally low-poly and generated from simple geometric primitives for the prototype. Their very small file sizes reduce initial loading and memory overhead on mobile devices. GLB was selected because it packages geometry/material information efficiently for web delivery.

The curtain model is split into named left and right curtain nodes. This supports an open/close animation by changing the local X positions of each panel rather than running cloth physics. This approach provides useful visual interaction at substantially lower computational cost.

### 2.3 Markerless placement

For each hit-test result, RoomAR obtains the hit pose and estimates the surface normal from the pose orientation. Furniture products require a predominantly upward normal and are therefore accepted on approximately horizontal surfaces. Curtains require a mainly horizontal normal and are accepted on approximately vertical surfaces. Invalid surfaces hide the placement reticle and trigger a status instruction asking the user to scan the correct type of surface.

When the user taps the screen while a valid reticle is visible, a clone of the selected GLB model is created. Furniture is positioned directly on the floor hit. Curtains are rotated around the world Y axis so that the curtain plane approximately aligns with the wall normal.

### 2.4 Advanced interaction

RoomAR implements a multi-step object editing workflow rather than a single click interaction. After placement, the latest object becomes selected. The user can enter Move mode and tap another valid surface, rotate the selected object in 15-degree steps, resize within controlled limits, cycle material colours, delete the object, or select the next placed object.

A `THREE.Box3` bounding box is calculated around each placed object. Before accepting placement, movement, rotation or resizing, the candidate bounding box is tested against all other placed objects. If an intersection is detected, the action is reverted and a collision warning is shown.

Curtains add specialized controls for independent width and height adjustment plus open/close animation. This avoids unrealistic uniform scaling and provides an interaction that is directly relevant to interior design.

### 2.5 User experience

The user interface provides visible system status throughout the AR workflow. Messages distinguish AR support, room scanning, valid floor/wall detection, loading, successful placement, tracking problems and collision errors. A placement reticle provides feedback before the user commits to placing content. A help panel explains the main controls, while the product catalogue separates floor furniture from wall curtains.

## 3. Testing and Evaluation

Testing should be conducted on at least two compatible mobile devices where possible and under multiple environmental conditions. The main test areas are marker recognition, floor hit testing, wall hit testing, object anchoring, editing controls, collision handling and performance.

Insert your real results here, for example:

| Device / Browser | Marker AR | Floor hit test | Wall hit test | Editing | Notes |
|---|---|---|---|---|---|
| [Device 1] | [Pass/Fail] | [Pass/Fail] | [Pass/Fail] | [Pass/Fail] | [Observation] |
| [Device 2] | [Pass/Fail] | [Pass/Fail] | [Pass/Fail] | [Pass/Fail] | [Observation] |

Environmental tests should include a bright textured floor, a dimmer room, a plain wall and a textured wall. Marker tracking should be tested at different viewing angles and distances. Record where tracking becomes unstable and how quickly the experience recovers.

## 4. Technical Challenges and Solutions

Replace/expand the following with the challenges you actually observe during development and testing.

### Challenge 1: Reliable surface placement

**Problem:** Hit testing may return surfaces that are unsuitable for the selected product. A curtain on the floor or sofa on a wall would create a poor experience.

**Solution:** The hit-test pose orientation is used to estimate the surface normal. RoomAR accepts horizontal surfaces for furniture and vertical surfaces for curtains and hides the placement reticle otherwise.

### Challenge 2: Furniture overlap

**Problem:** Users can create physically implausible layouts by placing furniture through other furniture.

**Solution:** Axis-aligned `THREE.Box3` collision checking is performed before accepting placement and editing operations. Invalid operations are reverted and an explanatory warning is displayed.

### Challenge 3: Mobile performance

**Problem:** Heavy 3D assets can increase loading time and reduce AR rendering performance.

**Solution:** The prototype uses lightweight GLB assets with simple geometry and no large textures. Models are cached after the first load and cloned for repeated placement.

### Challenge 4: Curtain animation cost

**Problem:** Real-time cloth simulation would add unnecessary implementation and rendering complexity for the assignment scope.

**Solution:** The curtain model contains separate left/right panels. Their positions are tweened to produce a clear open/close animation without physics simulation.

### Challenge 5: Browser/device differences

**Problem:** Immersive WebXR hit testing is not exposed consistently across all mobile browsers.

**Solution:** RoomAR performs a WebXR support check and displays a clear compatibility message when `immersive-ar` is unavailable. The final markerless demonstration should be performed on a tested AR-capable Android/Chrome device.

## 5. Reflection

RoomAR demonstrates that a useful interior-design workflow can be implemented as a lightweight browser AR experience using both marker-based and markerless tracking. The most important engineering trade-off was prioritizing reliable interaction and mobile performance over photorealistic assets or complex physics. Future work could include persistent room layouts, semantic window recognition, real product databases, measurement tools and improved cross-platform AR fallbacks.
