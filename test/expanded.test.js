import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, MeshHelpers, MeshOperations, VertexFilter, EdgeFilter, Edge, SerializerMeshChunk, Offsetter, Vector2, BridgeEdgesOptions } from '../src/index.js';

test('helpers, filters, and edge split', () => {
  const mesh = new Mesh();
  const r = MeshHelpers.createRectangle(mesh, new Vector2(0, 0), new Vector2(10, 10));
  assert.equal(mesh.getNumVertices(), 4);
  const vf = new VertexFilter(mesh).selectPolygonVertices(r.polygonIndex).minimumX();
  assert.equal(vf.getIndices().size, 1);
  const ef = new EdgeFilter(mesh).selectByConnectivity(Edge.Connectivity.External);
  assert.equal(ef.getIndices().size, 4);
  const edgeId = [...ef.getIndices()][0];
  const split = MeshOperations.splitEdge(mesh, edgeId, 0.5);
  assert.equal(mesh.getVertex(split.vertex).position.x, 5);
  assert.equal(mesh.getNumEdges(), 5);

  const edgeId2 = [...new EdgeFilter(mesh).selectByConnectivity(Edge.Connectivity.External).getIndices()][0];
  const splitCount = MeshOperations.splitEdge(mesh, edgeId2, 3);
  assert.equal(splitCount.vertices.length, 2);
});

test('bridge edge options use C++ defaults', () => {
  const options = new BridgeEdgesOptions();
  assert.equal(options.type, BridgeEdgesOptions.Type.Straight);
  assert.equal(options.squeezeType, BridgeEdgesOptions.SqueezeType.None);
  assert.equal(options.squeezeAmount, 0.0);
  assert.equal(options.steps, 1);
  assert.equal(options.merge, false);
  assert.equal(options.tightness, 0.551915);
});

test('serializer roundtrip and offsetter', () => {
  const mesh = new Mesh();
  mesh.addPolygon([new Vector2(0, 0), new Vector2(1, 0), new Vector2(0, 1)]);
  const json = SerializerMeshChunk.toJSON(mesh);
  const copy = SerializerMeshChunk.fromJSON(json);
  assert.equal(copy.getNumPolygons(), 1);
  const off = new Offsetter([new Vector2(0, 0), new Vector2(1, 0), new Vector2(0, 1)]);
  assert.equal(off.offset(1)[0].length, 3);
});
