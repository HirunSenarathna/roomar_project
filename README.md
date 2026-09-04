# RoomAR — Web-Based AR Interior Designer

RoomAR is a browser-based WebXR/WebAR prototype for an INTE 42312 assignment. It demonstrates both marker-based and markerless augmented reality while solving a retail/interior-design use case.

## Implemented features

- Marker-based AR using AR.js + A-Frame and the Hiro marker.
- Markerless AR using Three.js + WebXR hit testing.
- 5 lightweight local GLB models: sofa, chair, table, plant and curtain set.
- Horizontal-surface furniture placement.
- Vertical-surface curtain placement.
- Placement reticle and surface validation.
- Multi-object placement and state management.
- Object move mode.
- 15° left/right rotation.
- Object scaling with safe limits.
- Colour cycling.
- Delete selected object and clear room.
- Simple 3D bounding-box collision detection.
- Curtain width and height controls.
- Curtain open/close animation.
- Marker product switching while the marker remains tracked.
- Mobile-first UI, status messages, help overlay and error feedback.

## Project structure

```text
roomar_project/
├── index.html

├── room-ar.html
├── marker-ar.html
├── hiro-marker.html
├── css/
│   ├── main.css
│   ├── ar.css
│   └── marker.css
├── js/
│   ├── room-ar.js
│   └── marker-ar.js
├── models/
│   ├── sofa.glb
│   ├── chair.glb
│   ├── table.glb
│   ├── plant.glb
│   └── curtain.glb
├── docs/
│   ├── TECHNICAL_REPORT_DRAFT.md
│   ├── TESTING_CHECKLIST.md
│   └── DEMO_SCRIPT.md
├── manifest.webmanifest

```

## Important browser requirement

The markerless experience uses `immersive-ar` and the WebXR Hit Test API. For the final demonstration, use an AR-capable Android phone with an up-to-date Chrome browser. iOS Safari does not expose the same WebXR immersive-AR hit-test path, so the room mode may report that it is unsupported there.

Camera and WebXR features should be served through HTTPS. `localhost` is acceptable for desktop development, but a phone opening a plain HTTP LAN address may not receive camera/WebXR permissions.

## Run locally

From the project folder:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

This is mainly for desktop/model/marker UI development. For real phone testing, deploy the folder over HTTPS.

## Deploy to GitHub Pages

1. Put the files in a GitHub repository.
2. Open **Settings → Pages**.
3. Deploy from the main branch/root folder.
4. Wait for the HTTPS Pages URL.
5. Test the URL on the target Android phone.

## Marker-based demonstration

1. Open `hiro-marker.html` on another device or print it.
2. Open `marker-ar.html` on the phone.
3. Grant camera permission.
4. Point the camera at the whole Hiro marker.
5. Switch among Sofa, Chair, Table, Plant and Curtain using the bottom UI.

The marker image page uses the official AR.js Hiro image hosted in the AR.js GitHub repository.

## Markerless room demonstration

1. Open `room-ar.html` on an AR-capable Android phone.
2. Tap **ENTER AR**.
3. Select a furniture item.
4. Move the phone slowly while aiming at the floor.
5. When the green reticle appears, tap the screen to place the model.
6. Edit the selected model using Move, Rotate, Size and Colour.
7. Place a second model and intentionally overlap it to demonstrate collision prevention.
8. Choose **Curtains**, point at a textured wall, and wait for a valid vertical hit.
9. Place the curtain and use Wider/Narrower, Taller/Shorter, Colour and Open/Close.

## How surface validation works

The hit-test pose is used to estimate the surface normal.

- Furniture accepts approximately horizontal surfaces.
- Curtains accept approximately vertical surfaces.
- The reticle is shown only when the selected product matches the detected surface orientation.

## How collision detection works

RoomAR calculates a `THREE.Box3` around the candidate object and compares it with the bounding boxes of already placed objects. If the candidate intersects another object, placement/movement/rotation/resize is rejected and a warning is shown.

## 3D model notes

The five included GLB files are deliberately low-poly and very small for web delivery. They were generated from simple geometric primitives specifically for this prototype. This avoids external asset licensing issues and makes the optimization requirement easy to document.

Approximate file sizes are only a few KB each. If you later replace them with visually richer downloaded models, keep the originals as a fallback and document the model source/license, polygon reduction, texture compression and final file size.

## Curtain implementation

The curtain GLB contains named `LeftCurtain` and `RightCurtain` nodes. The UI animates the local X positions of those nodes to simulate opening and closing without expensive cloth physics. Width and height are adjusted separately so the curtain can fit different window proportions.

## Known limitations to document honestly

- WebXR support differs by device/browser.
- Wall hit testing can be less stable on blank, reflective or low-texture walls.
- Objects are session-local and are not persisted after leaving/reloading the AR experience.
- Collision uses axis-aligned bounding boxes rather than mesh-level physics.
- Curtain animation is a controlled panel animation, not cloth simulation.
- No automatic semantic window recognition is attempted.

These limitations are intentional to keep the assignment focused on reliable tracking, interaction and browser performance.

## Suggested final submission contents

- This complete source folder / Git repository.
- Public hosted HTTPS URL.
- 3-minute demonstration video.
- Maximum 4-page technical report based on `docs/TECHNICAL_REPORT_DRAFT.md`.
- Test evidence/screenshots based on `docs/TESTING_CHECKLIST.md`.



## Touch gesture controls

In markerless Room AR, placed objects can now be manipulated directly with touch gestures:

- **Tap an object** to select it.
- **Drag with one finger** to move the selected object while keeping furniture on the floor and curtains on their wall plane.
- **Pinch with two fingers** to resize the selected object.
- **Twist two fingers** to rotate the selected object.
- Colour, delete, curtain open/close, and curtain width/height controls remain available as UI actions.

The original Move/Rotate/Size buttons remain as desktop/fallback controls and are hidden automatically on coarse touch devices.

## Gesture input fix (Android WebXR)
The gesture build listens for touch Pointer Events at the document capture phase rather than only on the Three.js canvas. This is required because Chrome's WebXR DOM Overlay can target input at the overlay instead of the WebGL canvas. Gestures are active after an object has been placed/selected: one-finger drag moves, two-finger pinch scales, and two-finger twist rotates. UI buttons are excluded from gesture capture.
