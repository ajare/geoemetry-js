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
  triangulate(mesh) {
    if (this._triangles) return this._triangles.map(t => [...t]);
    this._triangles = this.holes.length
      ? triangulatePolygonWithHoles(mesh, this)
      : triangulateLoop(mesh, this.vertexIndices());
    return this._triangles.map(t => [...t]);
  }
  getPublicId() { return this.publicId; }
  isHole() { return this.hole; }
  convertToHole() { this.hole = true; return this; }
  convertFromHole() { this.hole = false; return this; }
  getHoleIndices() { return [...this.holes]; }
  getTriangulationTriangleCount(mesh) { return mesh ? this.triangulate(mesh).length : (this._triangles?.length ?? 0); }
  getTriangulationVertexIndices(triangleIndex, mesh) { return this.triangulate(mesh)[triangleIndex]; }
}

function triangulateLoop(mesh, vertexIds) {
  const points = vertexIds.map(i => mesh.vertices.get(i).position);
  return triangulateSimplePolygon(points)
    .map(t => t.map(i => vertexIds[i]))
    .filter(t => new Set(t).size === 3 && Math.abs(triangleArea(mesh, t)) > MathsUtils.Epsilon);
}

function triangulatePolygonWithHoles(mesh, polygon) {
  const outerIds = orientLoop(mesh, polygon.vertexIndices(), true);
  const holes = polygon.holes
    .map(holeId => mesh.polygons.get(holeId))
    .filter(Boolean)
    .map(hole => orientLoop(mesh, hole.vertexIndices(), false))
    .filter(loop => loop.length >= 3);

  if (!holes.length) return triangulateLoop(mesh, outerIds);

  const loops = [outerIds, ...holes];
  const vertexIds = [...new Set(loops.flat())];
  const boundary = boundarySegments(loops);
  const edgeKeys = new Set(boundary.map(([a, b]) => edgeKey(a, b)));
  const edgeList = [...boundary];
  const candidates = [];

  for (let i = 0; i < vertexIds.length; ++i) {
    for (let j = i + 1; j < vertexIds.length; ++j) {
      const a = vertexIds[i], b = vertexIds[j];
      if (edgeKeys.has(edgeKey(a, b))) continue;
      if (edgeIsInsidePolygonWithHoles(mesh, a, b, outerIds, holes, boundary, vertexIds)) {
        candidates.push([a, b, mesh.vertices.get(a).position.distanceToSq(mesh.vertices.get(b).position)]);
      }
    }
  }

  candidates.sort((a, b) => a[2] - b[2]);
  for (const [a, b] of candidates) {
    if (edgeCrossesAny(mesh, a, b, edgeList)) continue;
    edgeKeys.add(edgeKey(a, b));
    edgeList.push([a, b]);
  }

  const triangles = [];
  for (let i = 0; i < vertexIds.length; ++i) {
    for (let j = i + 1; j < vertexIds.length; ++j) {
      for (let k = j + 1; k < vertexIds.length; ++k) {
        const triangle = [vertexIds[i], vertexIds[j], vertexIds[k]];
        const [a, b, c] = triangle;
        if (!edgeKeys.has(edgeKey(a, b)) || !edgeKeys.has(edgeKey(b, c)) || !edgeKeys.has(edgeKey(a, c))) continue;
        if (Math.abs(triangleArea(mesh, triangle)) <= MathsUtils.Epsilon) continue;
        if (!triangleInPolygonWithHoles(mesh, triangle, outerIds, holes)) continue;
        if (vertexIds.some(vertexId => !triangle.includes(vertexId) && pointStrictlyInTriangle(mesh.vertices.get(vertexId).position, triangle.map(id => mesh.vertices.get(id).position)))) continue;
        triangles.push(triangleArea(mesh, triangle) > 0 ? triangle : [a, c, b]);
      }
    }
  }

  return triangles;
}

function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function edgeIsInsidePolygonWithHoles(mesh, aId, bId, outerIds, holes, boundary, vertexIds) {
  const a = mesh.vertices.get(aId).position;
  const b = mesh.vertices.get(bId).position;
  const midpoint = a.lerp(b, 0.5);
  if (!pointInPolygonWithHoles(mesh, midpoint, outerIds, holes)) return false;
  for (const vertexId of vertexIds) {
    if (vertexId !== aId && vertexId !== bId && pointOnSegment(mesh.vertices.get(vertexId).position, a, b)) return false;
  }

  for (const [cId, dId] of boundary) {
    if (cId === aId || cId === bId || dId === aId || dId === bId) continue;
    const c = mesh.vertices.get(cId).position;
    const d = mesh.vertices.get(dId).position;
    if (segmentsProperlyIntersect(a, b, c, d)) return false;
  }
  return true;
}

function edgeCrossesAny(mesh, aId, bId, edges) {
  const a = mesh.vertices.get(aId).position;
  const b = mesh.vertices.get(bId).position;
  for (const [cId, dId] of edges) {
    if (cId === aId || cId === bId || dId === aId || dId === bId) continue;
    const c = mesh.vertices.get(cId).position;
    const d = mesh.vertices.get(dId).position;
    if (segmentsProperlyIntersect(a, b, c, d)) return true;
  }
  return false;
}

function pointOnSegment(point, a, b) {
  if (Math.abs(b.sub(a).cross(point.sub(a))) > MathsUtils.Epsilon) return false;
  const dot = point.sub(a).dot(point.sub(b));
  return dot < -MathsUtils.Epsilon;
}

function pointInPolygonWithHoles(mesh, point, outerIds, holes) {
  if (!MathsUtils.pointInPolygon(point, outerIds.map(id => mesh.vertices.get(id).position))) return false;
  return !holes.some(holeIds => MathsUtils.pointInPolygon(point, holeIds.map(id => mesh.vertices.get(id).position)));
}

function pointStrictlyInTriangle(point, trianglePoints) {
  const [a, b, c] = trianglePoints;
  const area = Math.abs(b.sub(a).cross(c.sub(a)));
  if (area <= MathsUtils.Epsilon) return false;
  const s1 = MathsUtils.valueSign(b.sub(a).cross(point.sub(a)));
  const s2 = MathsUtils.valueSign(c.sub(b).cross(point.sub(b)));
  const s3 = MathsUtils.valueSign(a.sub(c).cross(point.sub(c)));
  return (s1 > 0 && s2 > 0 && s3 > 0) || (s1 < 0 && s2 < 0 && s3 < 0);
}

function orientLoop(mesh, vertexIds, ccw) {
  const ids = [...vertexIds];
  const area = MathsUtils.convexPolygonArea(ids.map(id => mesh.vertices.get(id).position));
  if ((ccw && area < 0) || (!ccw && area > 0)) ids.reverse();
  return ids;
}

function boundarySegments(loops) {
  const segments = [];
  for (const loop of loops) {
    for (let i = 0; i < loop.length; ++i) segments.push([loop[i], loop[(i + 1) % loop.length]]);
  }
  return segments;
}

function segmentsProperlyIntersect(a, b, c, d) {
  const orient = (p, q, r) => Math.sign(MathsUtils.valueSign(q.sub(p).cross(r.sub(p))));
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  return o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0 && o1 !== o2 && o3 !== o4;
}

function triangleArea(mesh, triangle) {
  const [a, b, c] = triangle.map(id => mesh.vertices.get(id).position);
  return b.sub(a).cross(c.sub(a)) / 2;
}

function triangleInPolygonWithHoles(mesh, triangle, outerIds, holes) {
  const [a, b, c] = triangle.map(id => mesh.vertices.get(id).position);
  const centroid = new Vector2((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3);
  if (!MathsUtils.pointInPolygon(centroid, outerIds.map(id => mesh.vertices.get(id).position))) return false;
  return !holes.some(holeIds => MathsUtils.pointInPolygon(centroid, holeIds.map(id => mesh.vertices.get(id).position)));
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
