import { Mesh } from './mesh.js';
import { Vector2 } from './vector2.js';

export class SerializerMeshChunk {
  static toJSON(mesh) { return mesh.toJSON(); }
  // Rebuild a mesh from toJSON() output. Ids are preserved wherever the file
  // supplies usable ones, so a round trip is identity-stable and callers can
  // keep referring to vertices/edges/polygons by the ids they saw before
  // saving. Edges are recreated up front (with their attributes) so that the
  // addEdge() calls inside polygon creation find and reuse them rather than
  // minting fresh ids -- without this, edge attributes and edge ids are both
  // lost, since edges otherwise only exist as a side effect of addPolygon().
  static fromJSON(data) {
    const mesh = new Mesh();
    const vertexMap = new Map();
    for (const v of data.vertices ?? []) {
      const nid = mesh.addVertexWithId(v.id, new Vector2(v.position));
      mesh.getVertex(nid).attributes = { ...(v.attributes ?? {}) };
      vertexMap.set(v.id, nid);
    }
    for (const e of data.edges ?? []) {
      const [a, b] = (e.vertices ?? []).map(v => vertexMap.get(v));
      if (a === undefined || b === undefined) continue;
      const eid = mesh.addEdgeWithId(e.id, a, b);
      mesh.getEdge(eid).attributes = { ...(e.attributes ?? {}) };
    }
    const polygonMap = new Map();
    for (const p of data.polygons ?? []) {
      const ids = p.edges.map(de => vertexMap.get(de.v0));
      const pid = mesh.addPolygonWithId(p.id, ids);
      mesh.getPolygon(pid).attributes = { ...(p.attributes ?? {}) };
      if (p.hole) mesh.getPolygon(pid).convertToHole();
      polygonMap.set(p.id, pid);
    }
    for (const p of data.polygons ?? []) {
      const pid = polygonMap.get(p.id);
      for (const h of p.holes ?? []) if (polygonMap.has(h)) mesh.addHoleToPolygon(pid, polygonMap.get(h));
    }
    return mesh;
  }
  constructor(name = 'Mesh', description = '') { this.name = name; this.description = description; this.mesh = null; }
  setMesh(mesh) { this.mesh = mesh; return this; }
  getVertices() { return [...(this.mesh?.vertices.values() ?? [])]; }
  getEdges() { return [...(this.mesh?.edges.values() ?? [])]; }
  getPolygons() { return [...(this.mesh?.polygons.values() ?? [])]; }
  writeText() { return JSON.stringify(SerializerMeshChunk.toJSON(this.mesh), null, 2); }
  readText(text) { this.mesh = SerializerMeshChunk.fromJSON(JSON.parse(text)); return this.mesh; }
}

export class TypeConverters {
  static vector2ToArray(v) { return [v.x, v.y]; }
  static arrayToVector2(a) { return new Vector2(a[0], a[1]); }
  static toDirectedEdgeVector(edges) { return [...edges]; }
  static toDirectedEdgeList(edges) { return [...edges]; }
  static toIndexVector(edges) { return [...edges].map(e => e.edge ?? e); }
  static toIndexList(edges) { return TypeConverters.toIndexVector(edges); }
  static toIndexSet(edges) { return new Set(TypeConverters.toIndexVector(edges)); }
}
