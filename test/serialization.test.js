import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, Vector2, SerializerMeshChunk } from '../src/index.js';

function quadWithHole() {
  const mesh = new Mesh();
  const outer = mesh.addPolygon([
    new Vector2(0, 0), new Vector2(30, 0), new Vector2(30, 30), new Vector2(0, 30),
  ]);
  const hole = mesh.addPolygon([
    new Vector2(10, 10), new Vector2(20, 10), new Vector2(20, 20), new Vector2(10, 20),
  ]);
  mesh.addHoleToPolygon(outer, hole);
  return { mesh, outer, hole };
}

test('round trip preserves vertex, edge and polygon ids', () => {
  const { mesh, outer, hole } = quadWithHole();
  const restored = SerializerMeshChunk.fromJSON(SerializerMeshChunk.toJSON(mesh));

  assert.deepEqual([...restored.vertices.keys()], [...mesh.vertices.keys()]);
  assert.deepEqual([...restored.edges.keys()], [...mesh.edges.keys()]);
  assert.deepEqual([...restored.polygons.keys()], [...mesh.polygons.keys()]);
  assert.deepEqual(restored.getPolygon(outer).holes, [hole]);
  assert.equal(restored.getPolygon(hole).hole, true);
});

test('round trip restores edge attributes', () => {
  const { mesh } = quadWithHole();
  const railed = [...mesh.edges.keys()].slice(0, 3);
  for (const id of railed) mesh.getEdge(id).attributes.rail = true;
  mesh.getEdge(railed[0]).attributes.railHeight = 2.5;

  const restored = SerializerMeshChunk.fromJSON(SerializerMeshChunk.toJSON(mesh));

  for (const id of railed) assert.equal(restored.getEdge(id).attributes.rail, true, `edge ${id}`);
  assert.equal(restored.getEdge(railed[0]).attributes.railHeight, 2.5);
  const flagged = [...restored.edges.values()].filter(e => e.attributes.rail).length;
  assert.equal(flagged, railed.length);
});

test('edges keep their vertex pairing and polygon connectivity', () => {
  const { mesh } = quadWithHole();
  const restored = SerializerMeshChunk.fromJSON(SerializerMeshChunk.toJSON(mesh));

  for (const [id, edge] of mesh.edges) {
    assert.deepEqual(restored.getEdge(id).vertices, edge.vertices, `edge ${id} vertices`);
    assert.equal(restored.getEdge(id).polygons.size, edge.polygons.size, `edge ${id} polygons`);
    assert.equal(restored.findEdge(...edge.vertices), id, `edge ${id} lookup`);
  }
});

test('further edits after a round trip do not collide with restored ids', () => {
  const { mesh } = quadWithHole();
  const restored = SerializerMeshChunk.fromJSON(SerializerMeshChunk.toJSON(mesh));

  const v = restored.addVertex(new Vector2(40, 40));
  assert.equal(restored.vertices.size, mesh.vertices.size + 1);
  assert.ok(!mesh.vertices.has(v), 'new vertex id must not reuse an existing one');

  const pid = restored.addPolygon([new Vector2(40, 0), new Vector2(50, 0), new Vector2(50, 10)]);
  assert.ok(!mesh.polygons.has(pid), 'new polygon id must not reuse an existing one');
  assert.equal(restored.triangulatePolygon(pid).length, 1);
});

test('files without an edges array still load', () => {
  const { mesh } = quadWithHole();
  const data = SerializerMeshChunk.toJSON(mesh);
  delete data.edges;

  const restored = SerializerMeshChunk.fromJSON(data);
  assert.equal(restored.polygons.size, mesh.polygons.size);
  assert.equal(restored.edges.size, mesh.edges.size);
});
