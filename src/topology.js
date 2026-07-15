import { Vector2 } from './vector2.js';
import { BoundingBox } from './bounds.js';
import { MathsUtils } from './maths.js';

export class Vertex {
  constructor(position, id = -1) { this.id = id; this.publicId = id; this.attributeIndex = id; this.position = Vector2.from(position); this.edges = new Set(); this.attributes = {}; }
  clone() { const v = new Vertex(this.position, this.id); v.publicId = this.publicId; v.attributeIndex = this.attributeIndex; v.edges = new Set(this.edges); v.attributes = { ...this.attributes }; return v; }
  getPublicId() { return this.publicId; }
  getPosition() { return this.position; }
  getBoundingBox() { return new BoundingBox(this.position, Vector2.ZERO); }
  getEdgeReferences() { return new Set(this.edges); }
}

export class Edge {
  static Connectivity = Object.freeze({ Orphaned: 'Orphaned', External: 'External', Internal: 'Internal', Invalid: 'Invalid' });
  constructor(v0, v1, id = -1) { this.id = id; this.publicId = id; this.attributeIndex = id; this.vertices = [v0, v1]; this.polygons = new Set(); this.attributes = {}; this.normal = Vector2.ZERO; this.centre = Vector2.ZERO; this.direction = Vector2.ZERO; this.length = 0; this.bounds = new BoundingBox(); }
  clone() { const e = new Edge(this.vertices[0], this.vertices[1], this.id); e.publicId = this.publicId; e.attributeIndex = this.attributeIndex; e.polygons = new Set(this.polygons); e.attributes = { ...this.attributes }; e.normal = this.normal; e.centre = this.centre; e.direction = this.direction; e.length = this.length; e.bounds = this.bounds.clone(); return e; }
  update(mesh) { const a = mesh.vertices.get(this.vertices[0]).position; const b = mesh.vertices.get(this.vertices[1]).position; const d = b.sub(a); this.length = d.length(); this.direction = this.length ? d.div(this.length) : Vector2.ZERO; this.normal = this.direction.perpendicular(); this.centre = a.lerp(b, 0.5); this.bounds = new BoundingBox([a, b]); return this; }
  get connectivity() { const n = this.polygons.size; return n === 0 ? Edge.Connectivity.Orphaned : n === 1 ? Edge.Connectivity.External : n === 2 ? Edge.Connectivity.Internal : Edge.Connectivity.Invalid; }
  getPublicId() { return this.publicId; }
  getFirstVertex() { return this.vertices[0]; }
  getSecondVertex() { return this.vertices[1]; }
  getOtherVertex(v) { return this.vertices[0] === v ? this.vertices[1] : this.vertices[1] === v ? this.vertices[0] : -1; }
  getCentre() { return this.centre; }
  getNormal() { return this.normal; }
  getDirection() { return this.direction; }
  getLength() { return this.length; }
  getBoundingBox() { return this.bounds; }
  getPolygonReferences() { return new Set(this.polygons); }
  getConnectivity() { return this.connectivity; }
  getClosestPoint(point, mesh = null) { const a = mesh?.vertices.get(this.vertices[0])?.position ?? Vector2.ZERO; const b = mesh?.vertices.get(this.vertices[1])?.position ?? Vector2.ZERO; return Vector2.from(point).closestPointOnLine(a, b); }
  lerp(t, mesh = null) { const a = mesh?.vertices.get(this.vertices[0])?.position ?? Vector2.ZERO; const b = mesh?.vertices.get(this.vertices[1])?.position ?? Vector2.ZERO; return a.lerp(b, t); }
  connectedTo(edge) { return this.vertices.some(v => edge.vertices.includes(v)); }
  getSharedVertexIndex(edge) { return this.vertices.find(v => edge.vertices.includes(v)) ?? -1; }
}

export class DirectedEdge {
  constructor(edge, v0, v1) { this.edge = edge; this.v0 = v0; this.v1 = v1; }
  reversed() { return new DirectedEdge(this.edge, this.v1, this.v0); }
}

export class DirectedEdgeLoop {
  constructor(edges = []) { this.edges = edges.map(e => e instanceof DirectedEdge ? e : new DirectedEdge(e.edge, e.v0, e.v1)); }
  *[Symbol.iterator]() { yield* this.edges; }
  get length() { return this.edges.length; }
  getNumEdges() { return this.edges.length; }
  getFirstEdge() { return this.edges[0] ?? null; }
  getEndEdge() { return null; }
  getEdges() { return [...this.edges]; }
  getEdgeIndexSet() { return new Set(this.edges.map(e => e.edge)); }
  getEdgeIndexList() { return this.edges.map(e => e.edge); }
  vertexIndices() { return this.edges.map(e => e.v0); }
  vertices(mesh) { return this.vertexIndices().map(i => mesh.vertices.get(i).position); }
  getVertexIndexSet() { return new Set(this.vertexIndices()); }
  getVertexIndexList() { return this.vertexIndices(); }
  usesVertex(vertexId) { return this.vertexIndices().includes(vertexId); }
  signedArea(mesh) { return MathsUtils.convexPolygonArea(this.vertices(mesh)); }
  containsPoint(mesh, p) { return MathsUtils.pointInPolygon(p, this.vertices(mesh)); }
}

export class Polygon extends DirectedEdgeLoop {
  constructor(edges = [], id = -1) { super(edges); this.id = id; this.publicId = id; this.attributeIndex = id; this.holes = []; this.attributes = {}; this._triangles = null; this.hole = false; }
  clone() { const p = new Polygon(this.edges, this.id); p.publicId = this.publicId; p.attributeIndex = this.attributeIndex; p.holes = [...this.holes]; p.hole = this.hole; p.attributes = { ...this.attributes }; p._triangles = this._triangles ? this._triangles.map(t => [...t]) : null; return p; }
  invalidate() { this._triangles = null; }
  bounds(mesh) { return new BoundingBox(this.vertices(mesh)); }
  pointInside(mesh, point) { if (!this.containsPoint(mesh, point)) return false; return !this.holes.some(h => mesh.polygons.get(h)?.containsPoint(mesh, point)); }
  triangulate(mesh) { if (this._triangles) return this._triangles.map(t => [...t]); const indices = this.vertexIndices(); const points = indices.map(i => mesh.vertices.get(i).position); this._triangles = triangulateSimplePolygon(points).map(t => t.map(i => indices[i])); return this._triangles.map(t => [...t]); }
  getPublicId() { return this.publicId; }
  isHole() { return this.hole; }
  convertToHole() { this.hole = true; return this; }
  convertFromHole() { this.hole = false; return this; }
  getHoleIndices() { return [...this.holes]; }
  getTriangulationTriangleCount(mesh) { return mesh ? this.triangulate(mesh).length : (this._triangles?.length ?? 0); }
  getTriangulationVertexIndices(triangleIndex, mesh) { return this.triangulate(mesh)[triangleIndex]; }
}


function triangulateSimplePolygon(points) {
  const n = points.length; if (n < 3) return [];
  const verts = [...Array(n).keys()];
  const ccw = MathsUtils.convexPolygonArea(points) > 0;
  const tris = [];
  let guard = 0;
  const isConvex = (a, b, c) => { const cross = points[b].sub(points[a]).cross(points[c].sub(points[b])); return ccw ? cross > -MathsUtils.Epsilon : cross < MathsUtils.Epsilon; };
  while (verts.length > 3 && guard++ < n * n) {
    let clipped = false;
    for (let i = 0; i < verts.length; i++) {
      const a = verts[(i + verts.length - 1) % verts.length], b = verts[i], c = verts[(i + 1) % verts.length];
      if (!isConvex(a, b, c)) continue;
      let contains = false;
      for (const v of verts) if (v !== a && v !== b && v !== c && MathsUtils.pointInTriangle(points[v], points[a], points[b], points[c])) { contains = true; break; }
      if (contains) continue;
      tris.push(ccw ? [a, b, c] : [a, c, b]);
      verts.splice(i, 1); clipped = true; break;
    }
    if (!clipped) break;
  }
  if (verts.length === 3) tris.push(ccw ? [...verts] : [verts[0], verts[2], verts[1]]);
  return tris;
}
