# @willpower/geometry

Pure JavaScript ES module port of the Willpower geometry module for Node and browsers.

This repository currently contains:

- A dependency-free geometry/mesh library in `src/`.
- Node test coverage in `test/` using the built-in `node:test` runner.
- A React/Vite SVG mesh editor example in `editor/ui/`.
- A GitHub Actions workflow that builds and deploys the editor UI to GitHub Pages.

## Quick start

### Requirements

- Node.js 24 is recommended. The GitHub Actions workflow uses Node 24.
- npm.

### Install

The root package has no runtime dependencies. The editor UI has its own dependencies.

```sh
# Install editor dependencies when you want to run/build the UI
npm --prefix editor/ui ci
```

If you prefer working inside the editor directory:

```sh
cd editor/ui
npm ci
```

## Using the library

```js
import { Mesh, Vector2 } from '@willpower/geometry';

const mesh = new Mesh();
const polygonId = mesh.addPolygon([
  new Vector2(0, 0),
  new Vector2(10, 0),
  new Vector2(10, 10),
  new Vector2(0, 10),
]);

console.log(mesh.triangulatePolygon(polygonId));
```

The public API is exported from `src/index.js`.

## Run tests

```sh
npm test
```

Current test status: 11 passing tests covering core mesh creation, triangulation, helpers, filters, serialization, splitting, cutting, bridging, extrusion, offsetting, and basic polygon algorithms.

## Run the editor app locally

```sh
npm --prefix editor/ui ci
npm --prefix editor/ui run dev
```

Then open the Vite URL printed in the terminal.

Useful editor scripts:

```sh
npm --prefix editor/ui run dev      # start local dev server
npm --prefix editor/ui run build    # production build to editor/ui/dist
npm --prefix editor/ui run preview  # preview production build
```

`editor/ui/node_modules/` and `editor/ui/dist/` are intentionally ignored by git.

## GitHub Pages deployment

The workflow is defined at:

```text
.github/workflows/deploy-editor-pages.yml
```

It runs on pushes to `main` and can also be triggered manually. It:

1. Checks out the repo.
2. Sets up Node.js 24.
3. Installs editor dependencies with `npm ci`.
4. Runs root tests with `npm test`.
5. Builds the editor UI.
6. Uploads `editor/ui/dist` as a GitHub Pages artifact.
7. Deploys the artifact to GitHub Pages.

Repository Pages settings should use **GitHub Actions** as the Pages source.

## Codebase map

### Core library (`src/`)

- `vector2.js` - 2D vector math and winding constants.
- `maths.js` - geometry math helpers, intersections, convex hull, polygon clipping.
- `bounds.js` - bounding boxes and circles.
- `topology.js` - `Vertex`, `Edge`, `DirectedEdge`, `DirectedEdgeLoop`, `Polygon`.
- `mesh.js` - mutable mesh data structure, topology management, JSON output.
- `utils.js` - mesh utilities, queries, validation, operations, offsetting, CSG-like helpers.
- `helpers.js` - rectangle and regular polygon creation helpers.
- `filters.js` - vertex/edge/polygon selection filters.
- `attributes.js` - lightweight user attribute containers.
- `serialization.js` - mesh JSON serialization/deserialization.
- `operationTypes.js` - option/result classes for operations.
- `index.js` - public exports.

### Editor UI (`editor/ui/`)

- React + Vite single-page app.
- Renders an editable mesh in SVG.
- Supports selection, dragging, insert mode, split, bridge, chamfer, vertex extrusion, holes, undo/redo, JSON import/export, grid and triangulation display.

## Current known limitations / bugs

- `Mesh.clone()` does not currently clone root `attributes` or the `vertexAttributes`, `edgeAttributes`, `polygonAttributes`, and `polygonVertexAttributes` collections. Cloned meshes can lose user data stored through those APIs.
- Polygon holes are tracked in topology, but `Polygon.triangulate()` triangulates the outer loop only. Triangulation display/output does not subtract holes.
- CSG-style helpers are approximate. For example, `MeshUtils.unionPolygons()` and `mergePolygonsByEdge()` use convex hull behavior rather than full robust polygon boolean operations.
- Many geometry operations assume simple, non-self-intersecting polygons and do limited validation before mutating topology.
- `MeshValidator.validate()` currently checks only basic missing references. It does not yet validate winding, duplicate vertices, self-intersections, non-manifold edges, hole containment, or polygon orientation.
- The editor catches several invalid operation errors and logs them to the console rather than showing user-facing error messages.

## To-dos / recommendations

- Add tests for attribute cloning and serialization of user attributes.
- Decide whether holes should be triangulated/rendered as true holes, then implement a hole-aware triangulation strategy.
- Expand `MeshValidator` to catch topology and geometry invariants.
- Document operation preconditions, especially for split, cut, bridge, extrusion, and merge operations.
- Consider replacing convex-hull approximations with robust polygon boolean operations if true CSG behavior is required.
- Add a lint/format step and include it in CI.
- Add editor UI error feedback for failed operations.
- Consider TypeScript declarations or JSDoc types for public API consumers.

## License

UNLICENSED
