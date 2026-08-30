# RoomAR Testing Checklist

Record the actual device/browser and result for each test. Add screenshots where possible.

| ID | Test | Expected result | Actual result | Pass/Fail |
|---|---|---|---|---|
| T01 | Open home page on mobile | Responsive UI loads without horizontal overflow | | |
| T02 | Open marker mode and allow camera | Camera starts | | |
| T03 | Scan Hiro marker | Selected 3D model becomes anchored to marker | | |
| T04 | Move marker | Model follows marker pose | | |
| T05 | Switch marker product | New model loads while marker mode remains active | | |
| T06 | Open room mode | WebXR support check completes | | |
| T07 | Start immersive AR | Camera AR session starts | | |
| T08 | Scan textured floor | Horizontal placement reticle appears | | |
| T09 | Aim furniture at wall | Furniture reticle is rejected/hidden | | |
| T10 | Place sofa | Sofa appears at detected floor position | | |
| T11 | Place chair | Chair appears as second independent object | | |
| T12 | Move selected object | Object moves to new valid hit location | | |
| T13 | Rotate selected object | Object rotates in 15° steps | | |
| T14 | Resize selected object | Scale changes within limits | | |
| T15 | Cycle colour | Material colour changes | | |
| T16 | Overlap two objects | Collision warning appears and overlap is rejected | | |
| T17 | Delete selected object | Object is removed from scene | | |
| T18 | Select curtains | Application requests a vertical wall surface | | |
| T19 | Scan textured wall | Curtain placement reticle becomes valid | | |
| T20 | Place curtain | Curtain aligns approximately with wall | | |
| T21 | Adjust curtain width | Only width changes significantly | | |
| T22 | Adjust curtain height | Only height changes significantly | | |
| T23 | Change curtain colour | Curtain panels change colour | | |
| T24 | Open/close curtain | Left/right panels animate apart/together | | |
| T25 | Clear room | All placed objects are removed | | |
| T26 | End AR session | Camera/XR session closes cleanly | | |
| T27 | Dim room test | Note tracking quality and recovery behavior | | |
| T28 | Plain wall test | Note wall-tracking limitation and user guidance | | |
| T29 | Second compatible Android device | Core markerless workflow operates | | |
| T30 | Unsupported browser | Clear compatibility/error message is displayed | | |
