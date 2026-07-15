import { Mesh } from './mesh.js';
import { Vector2 } from './vector2.js';

export class SerializerMeshChunk {
  static toJSON(mesh) { return mesh.toJSON(); }
  static fromJSON(data) {
    const mesh = new Mesh();
    const vertexMap = new Map();
    for (const v of data.vertices ?? []) {
      const nid = mesh.addVertex(new Vector2(v.position));
      mesh.getVertex(nid).attributes = { ...(v.attributes ?? {}) };
      vertexMap.set(v.id, nid);
    }
    const polygonMap = new Map();
    for (const p of data.polygons ?? []) {
      const ids = p.edges.map(de => vertexMap.get(de.v0));
      const pid = mesh.addPolygon(ids);
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
