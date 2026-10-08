# Camera vision runtime

`opencv-4.13.0.js` is a self-hosted snapshot downloaded from the official
https://docs.opencv.org/4.x/opencv.js build. `cv.getBuildInformation()` reports
OpenCV 4.13.0 (2025-12-31 build). SHA-256:
63366510248adf3a7eddf3e793dd825404efb7df3749f4d6f8557c7fa4ca8aa0  sim/public/js-simulator/vision/opencv-4.13.0.js

OpenCV is Apache-2.0; see LICENSE.opencv. The 10.4 MiB runtime embeds WASM and
loads only when ArUco or Road is selected, in a dedicated worker. No CDN is
needed at runtime. Mirror this directory with `npm run sync:frontend` in sim.

`detection.js` ports the algorithms in scripts/robot-agent-v2/overlay's
aruco_camera.py and road_camera.py. Canvas RGBA is converted to grayscale rather
than using the physical camera's BGR input. ArUco uses DICT_4X4_50, with no
corner refinement. Road retains the same ROI, blur, Otsu/clamped threshold,
morphology, contour filters, line fitting, pair scoring and confidence rules.
It needs TWO dark components, not a single centre line.

The PNG markers were generated with this build's generateImageMarker, with
20-pixel white margins. Stage `stage_camera_vision` contains them as textured
planes, two tape boundaries, and labelled objects. `type: image` stage entries
accept texture, dimensions [width,height], position and optional orientation;
they are visual-only and currently authored through stage JSON, not an Inspector
image-upload control.

YOLO and Depth are explicitly simulated, not neural inference. Object labels
come from `visionLabel`, then entry name/type, for cubes/cylinders/spheres/wedges/
models. Boxes use camera projection and nine sampled occlusion rays; this is
approximate visibility for partially hidden/very thin objects. Labels need not
be COCO classes. Depth renders camera-forward geometry distance with white at
zero, black at >=5 metres; it is not FastDepth output or hardware calibration.
Camera mode/results are available through FossbotSimulatorHandle; these preview
features do not yet add Python/Blockly AI-camera commands.

Run `npm run test:camera` in sim for real WASM pixel tests. Frontend camera tests
cover rendering state restoration, mount scale, occlusion and worker lifecycle.
