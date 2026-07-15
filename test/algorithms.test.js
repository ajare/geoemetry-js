import test from 'node:test';
import assert from 'node:assert/strict';
import { BridgeEdgesOptions, Mesh, MeshHelpers, MeshOperations, MeshUtils, MathsUtils, Vector2 } from '../src/index.js';

test('convex polygon clipping and union hull', () => {
  const a = [new Vector2(0,0), new Vector2(2,0), new Vector2(2,2), new Vector2(0,2)];
  const b = [new Vector2(1,1), new Vector2(3,1), new Vector2(3,3), new Vector2(1,3)];
  assert.ok(MathsUtils.clipPolygonAgainstPolygon(a, b).length >= 3);
  const u = MeshUtils.unionPolygons([a, b]);
  assert.equal(u.length, 1);
  assert.ok(u[0].length >= 4);
});

test('split, bridge, merge, and offset', () => {
  const mesh = new Mesh();
  const r = MeshHelpers.createRectangle(mesh, new Vector2(0,0), new Vector2(2,2));
  const verts = mesh.getPolygon(r.polygonIndex).vertexIndices();
  const split = MeshOperations.splitPolygon(mesh, r.polygonIndex, verts[0], verts[2]);
  assert.equal(split.polygons.length, 2);
  const edges = [...mesh.edges].filter(([, edge]) => edge.polygons.size === 1).map(([id]) => id);
  const bridge = MeshOperations.bridgeEdges(mesh, edges[0], edges[2]);
  assert.ok(mesh.getPolygon(bridge.polygon));
  const merge = MeshOperations.mergePolygonsByEdge(mesh, split.polygons[0], split.polygons[1]);
  assert.ok(mesh.getPolygon(merge.polygon));
});

test('directed extrusion of contiguous edges creates one side polygon', () => {
  const mesh = new Mesh();
  const r = MeshHelpers.createRectangle(mesh, new Vector2(0, 0), new Vector2(4, 4));
  const edgeIds = mesh.getPolygon(r.polygonIndex).getEdgeIndexList().slice(0, 2);

  const result = MeshOperations.extrudePolygonDirected(mesh, r.polygonIndex, edgeIds, new Vector2(2, 0));

  assert.equal(result.polygons.length, 1);
  assert.equal(mesh.getNumPolygons(), 2);
  assert.deepEqual(result.polygons[0].sourceEdgeIndices, edgeIds);
  assert.equal(mesh.getPolygon(result.polygons[0].index).vertexIndices().length, 6);
});

test('directed extrusion can merge contiguous edges into source polygon', () => {
  const mesh = new Mesh();
  const r = MeshHelpers.createRectangle(mesh, new Vector2(0, 0), new Vector2(4, 4));
  const edgeIds = mesh.getPolygon(r.polygonIndex).getEdgeIndexList().slice(0, 2);

  const result = MeshOperations.extrudePolygonDirected(mesh, r.polygonIndex, edgeIds, new Vector2(2, 0), { mergePolygons: true });

  assert.equal(result.polygon, r.polygonIndex);
  assert.equal(result.polygons.length, 1);
  assert.equal(mesh.getNumPolygons(), 1);
  assert.equal(mesh.getPolygon(r.polygonIndex).vertexIndices().length, 6);
});

test('cut polygon supports overloads', () => {
  {
    const mesh = new Mesh();
    const r = MeshHelpers.createRectangle(mesh, new Vector2(0, 0), new Vector2(4, 4));
    const verts = mesh.getPolygon(r.polygonIndex).vertexIndices();
    MeshOperations.cutPolygon(mesh, r.polygonIndex, verts[0], verts[2]);
    assert.equal(mesh.getNumPolygons(), 2);
  }

  {
    const mesh = new Mesh();
    const r = MeshHelpers.createRectangle(mesh, new Vector2(0, 0), new Vector2(4, 4));
    const verts = mesh.getPolygon(r.polygonIndex).vertexIndices();
    const edge = mesh.getPolygon(r.polygonIndex).getEdgeIndexList()[2];
    const result = MeshOperations.cutPolygon(mesh, r.polygonIndex, verts[0], edge, 0.5);
    assert.ok(result.vertex != null);
    assert.equal(mesh.getNumPolygons(), 2);
  }

  {
    const mesh = new Mesh();
    const r = MeshHelpers.createRectangle(mesh, new Vector2(0, 0), new Vector2(4, 4));
    const verts = mesh.getPolygon(r.polygonIndex).vertexIndices();
    const edge = mesh.getPolygon(r.polygonIndex).getEdgeIndexList()[0];
    const result = MeshOperations.cutPolygon(mesh, r.polygonIndex, edge, 0.5, verts[2]);
    assert.ok(result.split.vertex != null);
    assert.equal(mesh.getNumPolygons(), 2);
  }

  {
    const mesh = new Mesh();
    const r = MeshHelpers.createRectangle(mesh, new Vector2(0, 0), new Vector2(4, 4));
    const edges = mesh.getPolygon(r.polygonIndex).getEdgeIndexList();
    const result = MeshOperations.cutPolygon(mesh, r.polygonIndex, edges[0], 0.5, edges[2], 0.5);
    assert.equal(result.split.vertices.length, 2);
    assert.equal(mesh.getNumPolygons(), 2);
  }

  {
    const mesh = new Mesh();
    const r = MeshHelpers.createRectangle(mesh, new Vector2(0, 0), new Vector2(4, 4));
    MeshOperations.cutPolygon(mesh, r.polygonIndex, new Vector2(2, -1), new Vector2(2, 5));
    assert.equal(mesh.getNumPolygons(), 2);
  }
});

test('triangulation subtracts polygon holes', () => {
  const mesh = new Mesh();
  const outer = MeshHelpers.createRectangle(mesh, new Vector2(0, 0), new Vector2(10, 10)).polygonIndex;
  const hole = MeshHelpers.createRectangle(mesh, new Vector2(3, 3), new Vector2(7, 7)).polygonIndex;
  mesh.addHoleToPolygon(outer, hole);

  const triangles = mesh.triangulatePolygon(outer);
  const area = triangles.reduce((sum, triangle) => {
    const [a, b, c] = triangle.map((vertexId) => mesh.getVertex(vertexId).position);
    return sum + Math.abs(b.sub(a).cross(c.sub(a)) / 2);
  }, 0);

  assert.equal(triangles.length, 8);
  assert.equal(area, 84);
  assert.equal(mesh.getPolygon(outer).pointInside(mesh, new Vector2(5, 5)), false);
  assert.equal(mesh.getPolygon(outer).pointInside(mesh, new Vector2(1, 1)), true);
});

test('moving a hole vertex invalidates parent polygon triangulation', () => {
  const mesh = new Mesh();
  const outer = MeshHelpers.createRectangle(mesh, new Vector2(0, 0), new Vector2(10, 10)).polygonIndex;
  const hole = MeshHelpers.createRectangle(mesh, new Vector2(3, 3), new Vector2(7, 7)).polygonIndex;
  mesh.addHoleToPolygon(outer, hole);

  const before = mesh.triangulatePolygon(outer).reduce((sum, triangle) => {
    const [a, b, c] = triangle.map((vertexId) => mesh.getVertex(vertexId).position);
    return sum + Math.abs(b.sub(a).cross(c.sub(a)) / 2);
  }, 0);

  mesh.moveVertex(mesh.getPolygon(hole).vertexIndices()[0], new Vector2(4, 4));

  const after = mesh.triangulatePolygon(outer).reduce((sum, triangle) => {
    const [a, b, c] = triangle.map((vertexId) => mesh.getVertex(vertexId).position);
    return sum + Math.abs(b.sub(a).cross(c.sub(a)) / 2);
  }, 0);

  assert.equal(before, 84);
  assert.equal(after, 88);
});

test('bridge edge chains creates one bridge polygon with interpolation options', () => {
  const mesh = new Mesh();
  const left = MeshHelpers.createRectangle(mesh, new Vector2(-4, -2), new Vector2(-2, 2));
  const right = MeshHelpers.createRectangle(mesh, new Vector2(2, -2), new Vector2(4, 2));
  const leftEdges = mesh.getPolygon(left.polygonIndex).getEdgeIndexList().slice(1, 3);
  const rightEdges = mesh.getPolygon(right.polygonIndex).getEdgeIndexList().slice(3, 5);

  const result = MeshOperations.bridgeEdges(mesh, leftEdges, rightEdges, new BridgeEdgesOptions({ steps: 3, squeezeType: 'Curved', squeezeAmount: 0.25 }));

  assert.ok(mesh.getPolygon(result.polygon));
  assert.equal(mesh.getNumPolygons(), 3);
  assert.ok(mesh.getPolygon(result.polygon).vertexIndices().length > 4);
});
