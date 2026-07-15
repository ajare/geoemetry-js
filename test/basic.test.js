import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, Vector2, MeshUtils, MeshValidator, Edge } from '../src/index.js';

test('creates and triangulates a quad mesh', () => {
  const mesh = new Mesh();
  const pid = mesh.addPolygon([
    new Vector2(0, 0),
    new Vector2(10, 0),
    new Vector2(10, 10),
    new Vector2(0, 10),
  ]);

  assert.equal(mesh.vertices.size, 4);
  assert.equal(mesh.edges.size, 4);
  assert.equal(mesh.polygons.size, 1);
  assert.equal(mesh.triangulatePolygon(pid).length, 2);
  assert.equal(mesh.containingPolygon(new Vector2(5, 5)), pid);
  assert.deepEqual(MeshValidator.validate(mesh), { valid: true, errors: [] });
  assert.equal(mesh.edgesByConnectivity(Edge.Connectivity.External).length, 4);
});

test('groups connected polygons', () => {
  const mesh = MeshUtils.fromPolygons([
    [new Vector2(0, 0), new Vector2(1, 0), new Vector2(0, 1)],
    [new Vector2(10, 10), new Vector2(11, 10), new Vector2(10, 11)],
  ]);
  assert.equal(MeshUtils.groupConnectedPolygons(mesh).length, 2);
});
