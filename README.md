# RoomAR — Web-Based AR Interior Designer

RoomAR is a mobile-friendly WebAR application for previewing furniture and curtains in augmented reality.

## Features

- Marker-based AR using AR.js and a Hiro marker
- Markerless room AR using WebXR hit testing
- Sofa, chair, table, plant, and curtain models
- Floor and wall surface detection
- Place, move, rotate, resize, recolour, and delete objects
- Touch gestures for moving, scaling, and rotating models
- Collision detection between placed objects
- Curtain resizing and open/close animation with sound

## Run locally

From the project folder, run:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy with GitHub Pages

1. Upload the project files to a GitHub repository.
2. Go to **Settings → Pages**.
3. Select the `main` branch and `/root` folder.
4. Open the generated HTTPS link on your phone.

## How to use

- **Marker AR:** Open `hiro-marker.html`, then scan the marker through `marker-ar.html`.
- **Room AR:** Open `room-ar.html`, start AR, select a model, scan a surface, and tap the green reticle to place it.

## Compatibility

Markerless Room AR requires an ARCore-compatible Android device and a browser that supports WebXR immersive AR. Unsupported devices may open the website but cannot start Room AR. Marker AR can still work when camera access is available.

Camera and AR features require HTTPS when the project is hosted online.

## 3D Model Credits

- [Cabin chair](https://poly.pizza/m/5rAjPHAuq1u) by Daniel Doran, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), via Poly Pizza.

- [House plant](https://poly.pizza/m/3qh9saogdJd) by Poly by Google, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), via Poly Pizza.

- [Couch | Wide](https://poly.pizza/m/7Q_Ab2HLll1) by Danni Bittman, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), via Poly Pizza.

- [Coffee Table](https://poly.pizza/m/QBFNwiFQSi) by michu, released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), via Poly Pizza.

- [Curtains Double](https://poly.pizza/m/kkeII96j9N) by Quaternius, released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), via Poly Pizza.

The models were resized, optimized and adapted for use in RoomAR. The curtain geometry is divided and animated at runtime.

## Technologies

HTML, CSS, JavaScript, Three.js, WebXR, A-Frame, AR.js, and GLB 3D models.
