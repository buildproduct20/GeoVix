# GeoVix

GeoVix is an interactive 3D subsurface viewer built with React, TypeScript, and Three.js. Explore a synthetic 200 × 150 m terrain block, three rock units, and eight vertical drillholes. All coordinates are local metres. The model is illustrative and uses a procedural elevation surface and fixed synthetic depth intervals.

## Run locally

Use Node.js 20.19+ on Node 20, or Node.js 22.12 or later, and a browser with WebGL 2.

```sh
npm ci
npm run dev
```

Use `npm run build` to type-check the project and build it into `dist/`. Use `npm run preview` to serve the production build locally.

## Explore the survey

- Drag to orbit, scroll to zoom, and right-drag to pan. Top view uses an orthographic camera with pan and zoom.
- Toggle terrain, rock units, drillholes, or the reference grid. Hide terrain to examine drillhole cores from above.
- Select a drillhole in the viewport or from the keyboard-accessible list. Both update the same inspector and highlight.
- Watch the draw-call and triangle counts change with layer visibility. The numbers describe the latest rendered frame.

## Stack and architecture

| Technology | Role |
| --- | --- |
| React | Renders the controls and drillhole inspector. Owns layer visibility and the selected drillhole ID. |
| TypeScript | Types the survey data, layer controls, and the interface between the viewer and the UI. |
| Three.js | Builds the scene, indexed terrain and rock meshes, cameras, materials, and lighting. `OrbitControls` handles navigation and `Raycaster` identifies the nearest object under a click. |
| WebGL 2 | Browser graphics API used by Three.js's `WebGLRenderer` to draw the scene onto a canvas. The UI and data list remain usable if renderer creation fails. |
| Vite | Resolves npm packages for local development and produces static application assets for deployment. |
| CSS | Lays out the viewport, layer controls, and inspector across desktop and mobile widths. |

[Survey data](src/viewer/survey.ts) is shared by the [React interface](src/App.tsx) and the [geometry builder](src/viewer/buildModel.ts). [Viewport.tsx](src/viewer/Viewport.tsx) mounts [the Three.js viewer](src/viewer/createViewer.ts) once per effect lifecycle and forwards state changes. Canvas picks send a drillhole ID back to React. Picking includes visible occluders so a hidden drillhole interval cannot receive a click through the terrain.

The viewer schedules a frame when the camera, viewport size, selection, or visibility changes. A single pending animation-frame callback coalesces changes, and the renderer reports metrics only when the counts change. Terrain triangles share indexed vertices, and drillhole markers and cores reuse geometries and materials. Unmounting releases WebGL resources, event listeners and the resize observer.

## Read the rendering code

1. In `buildModel.ts`, follow how elevation samples become vertex positions and how index triplets form terrain triangles.
2. In `createViewer.ts`, follow `handlePointerUp` from canvas-relative coordinates to a ray intersection and drillhole ID.
3. In `Viewport.tsx`, find the effects that synchronize React state with Three.js and clean up the renderer.
