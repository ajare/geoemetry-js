import { Vector2, Winding } from './vector2.js';
import { MathsUtils } from './maths.js';
import { Mesh } from './mesh.js';
import { DirectedEdge } from './topology.js';

export class MeshUtils {
  static vertexWinding(points) { return MathsUtils.pointsWinding(points.map(Vector2.from)); }
  static getVertexWinding(points) { return MeshUtils.vertexWinding(points); }
  static reversePolygon(mesh, polygonId) { const p = mesh.polygons.get(polygonId); p.edges = p.edges.map(e => e.reversed()).reverse(); p.invalidate(); return mesh; }
  static groupConnectedPolygons(mesh) { const visited = new Set(), groups = []; for (const id of mesh.polygons.keys()) { if (visited.has(id)) continue; const group = []; const stack = [id]; visited.add(id); while (stack.length) { const p = stack.pop(); group.push(p); for (const de of mesh.polygons.get(p).edges) for (const n of mesh.edges.get(de.edge).polygons) if (!visited.has(n)) { visited.add(n); stack.push(n); } } groups.push(group); } return groups; }
  static groupConnectedEdges(edgeList, allowFlips = false) { const remaining = edgeList.map(e => Array.isArray(e) ? e : [e.edge ?? e[0], e.v0 ?? e[1], e.v1 ?? e[2]]); const groups = []; while (remaining.length) { const g = [remaining.shift()]; let changed = true; while (changed) { changed = false; for (let i = 0; i < remaining.length; i++) { const e = remaining[i]; const tail = g[g.length - 1][2], head = g[0][1]; if (e[1] === tail) { g.push(e); remaining.splice(i, 1); changed = true; break; } if (e[2] === head) { g.unshift(e); remaining.splice(i, 1); changed = true; break; } if (allowFlips && e[2] === tail) { g.push([e[0], e[2], e[1]]); remaining.splice(i, 1); changed = true; break; } } } groups.push(g); } return groups; }
  static boundaryEdges(mesh) { return [...mesh.edges].filter(([, e]) => e.polygons.size === 1).map(([id]) => id); }
  static getNearestEdgeIndex(mesh, point, edgeIds = [...mesh.edges.keys()]) { let best = -1, bd = Infinity; for (const id of edgeIds) { const e = mesh.edges.get(id); const a = mesh.vertices.get(e.vertices[0]).position, b = mesh.vertices.get(e.vertices[1]).position; const d = Vector2.from(point).distanceToLineSq(a, b); if (d < bd) { bd = d; best = id; } } return best; }
  static insetVertexLoop(vertices, distance) { return [Offsetter.offsetPolygon(vertices, distance)]; }
  static insetVertexLoops(loops, distance) { return loops.flatMap(l => MeshUtils.insetVertexLoop(l, distance)); }
  static unionPolygons(polygons) {
    const remaining = polygons.map(p => p.map(Vector2.from));
    let changed = true;
    while (changed) {
      changed = false;
      outer: for (let i = 0; i < remaining.length; i++) for (let j = i + 1; j < remaining.length; j++) {
        if (MathsUtils.polygonsIntersect(remaining[i], remaining[j])) {
          const hull = MathsUtils.convexHull([...remaining[i], ...remaining[j]]);
          remaining.splice(j, 1); remaining[i] = hull; changed = true; break outer;
        }
      }
    }
    return remaining;
  }
  static fromPolygons(polygons) { const mesh = new Mesh(); for (const poly of polygons) mesh.addPolygon(poly); return mesh; }
}

export class MeshQuery {
  constructor(mesh) { this.mesh = mesh; }
  polygonAt(point) { return this.mesh.containingPolygon(point); }
  verticesInBox(box) { return [...this.mesh.vertices].filter(([, v]) => box.pointInside(v.position)).map(([id]) => id); }
  edgesIntersectingLine(a, b) { return [...this.mesh.edges].filter(([, e]) => e.bounds.intersectsLine(a, b)).map(([id]) => id); }
}

export class MeshValidator {
  static validate(mesh) { const errors = []; for (const [id, e] of mesh.edges) for (const v of e.vertices) if (!mesh.vertices.has(v)) errors.push(`Edge ${id} references missing vertex ${v}`); for (const [id, p] of mesh.polygons) for (const de of p.edges) if (!mesh.edges.has(de.edge)) errors.push(`Polygon ${id} references missing edge ${de.edge}`); return { valid: errors.length === 0, errors }; }
}

export class MeshOperations {
  static translate(mesh, delta) { for (const id of mesh.vertices.keys()) mesh.moveVertex(id, mesh.vertices.get(id).position.add(delta)); return mesh; }
  static scale(mesh, scalar, origin = Vector2.ZERO) { origin = Vector2.from(origin); for (const id of mesh.vertices.keys()) { const v = mesh.vertices.get(id).position; mesh.moveVertex(id, origin.add(v.sub(origin).mul(scalar))); } return mesh; }
  static rotate(mesh, degrees, origin = Vector2.ZERO) { origin = Vector2.from(origin); for (const id of mesh.vertices.keys()) mesh.moveVertex(id, mesh.vertices.get(id).position.rotateAround(origin, degrees)); return mesh; }
  static splitEdge(mesh, edgeId, t = 0.5) {
    const edgeCount = Number.isInteger(t) && t > 1 ? t : null;
    const amounts = edgeCount == null ? [Math.max(0.001, Math.min(0.999, t))] : [...Array(edgeCount - 1)].map((_, i) => (i + 1) / edgeCount);
    const e = mesh.edges.get(edgeId);
    if (!e) throw new Error(`Edge ${edgeId} does not exist`);
    const a = mesh.vertices.get(e.vertices[0]).position;
    const b = mesh.vertices.get(e.vertices[1]).position;
    const vids = amounts.map((amount) => mesh.addVertex(a.lerp(b, amount)));
    const oldPolys = [...e.polygons];

    for (const pid of oldPolys) e.polygons.delete(pid);
    mesh.removeEdge(edgeId);

    const createdEdges = new Set();
    for (const pid of oldPolys) {
      const p = mesh.polygons.get(pid);
      for (let i = 0; i < p.edges.length; i++) {
        const de = p.edges[i];
        if (de.edge !== edgeId) continue;

        const chain = [de.v0, ...vids, de.v1];
        const replacement = [];
        for (let j = 0; j < chain.length - 1; ++j) {
          const newEdge = mesh.addEdge(chain[j], chain[j + 1]);
          createdEdges.add(newEdge);
          replacement.push(new DirectedEdge(newEdge, chain[j], chain[j + 1]));
        }
        p.edges.splice(i, 1, ...replacement);
        break;
      }
    }

    for (const pid of oldPolys) {
      const p = mesh.polygons.get(pid);
      for (const de of p.edges) mesh.edges.get(de.edge)?.polygons.add(pid);
      p.invalidate();
    }

    return { vertex: vids[0], vertices: vids, newVertexIndices: vids, edges: [...createdEdges], newEdgeIndices: [...createdEdges], splitEdgeIndex: edgeId };
  }
  static setEdgeLength(mesh, edgeId, length) { const e = mesh.edges.get(edgeId); const a = mesh.vertices.get(e.vertices[0]).position; mesh.moveVertex(e.vertices[1], a.add(e.direction.mul(length))); return mesh; }
  static extrudePolygonDirected(mesh, polygonId, edgeIds, extrusion, options = {}) {
    const polygon = mesh.getPolygon(polygonId);
    if (!polygon) throw new Error(`Polygon ${polygonId} does not exist`);

    const selected = new Set(edgeIds?.length ? edgeIds : polygon.getEdgeIndexList());
    for (const edgeId of selected) {
      if (!polygon.edges.some((de) => de.edge === edgeId)) throw new Error(`Edge ${edgeId} is not in polygon ${polygonId}`);
    }

    const separateExtrusions = Boolean(options.separateExtrusions ?? options.separate ?? false);
    const directedEdges = polygon.edges;
    const selectedRuns = [];
    let current = [];

    for (const de of directedEdges) {
      if (selected.has(de.edge)) current.push(de);
      else if (current.length) {
        selectedRuns.push(current);
        current = [];
      }
    }
    if (current.length) {
      if (!separateExtrusions && selectedRuns.length && selected.has(directedEdges[0].edge)) selectedRuns[0] = current.concat(selectedRuns[0]);
      else selectedRuns.push(current);
    }

    const sections = separateExtrusions ? selectedRuns.flatMap((run) => run.map((de) => [de])) : selectedRuns;
    const polygons = [];
    const extrusionVector = Vector2.from(extrusion);

    if (options.mergePolygons) {
      const orderedSections = sections
        .filter((section) => section.length)
        .map((section) => ({
          section,
          index: polygon.edges.findIndex((de) => de.edge === section[0].edge),
        }))
        .sort((a, b) => b.index - a.index);

      for (const { section } of orderedSections) {
        if (section[0].v0 === section[section.length - 1].v1) throw new Error('Cannot extrude a full loop');

        const firstIndex = polygon.edges.findIndex((de) => de.edge === section[0].edge);
        if (firstIndex < 0) continue;

        const sourceVertices = section.map((de) => de.v0).concat(section[section.length - 1].v1);
        const newVertices = sourceVertices.map((vertexId) => mesh.addVertex(mesh.getVertex(vertexId).position.add(extrusionVector)));
        const replacement = [];
        const sourceEdgeIndices = section.map((de) => de.edge);
        const extrudedEdgeIndices = [];

        const firstConnector = mesh.addEdge(section[0].v0, newVertices[0]);
        replacement.push(new DirectedEdge(firstConnector, section[0].v0, newVertices[0]));

        for (let i = 0; i < newVertices.length - 1; ++i) {
          const edgeId = mesh.addEdge(newVertices[i], newVertices[i + 1]);
          extrudedEdgeIndices.push(edgeId);
          replacement.push(new DirectedEdge(edgeId, newVertices[i], newVertices[i + 1]));
        }

        const lastConnector = mesh.addEdge(newVertices[newVertices.length - 1], section[section.length - 1].v1);
        replacement.push(new DirectedEdge(lastConnector, newVertices[newVertices.length - 1], section[section.length - 1].v1));

        for (const sourceEdgeId of sourceEdgeIndices) {
          mesh.getEdge(sourceEdgeId)?.polygons.delete(polygonId);
        }

        polygon.edges.splice(firstIndex, section.length, ...replacement);
        for (const de of replacement) mesh.getEdge(de.edge).polygons.add(polygonId);
        polygon.invalidate();

        for (const sourceEdgeId of sourceEdgeIndices) {
          const edge = mesh.getEdge(sourceEdgeId);
          if (edge && edge.polygons.size === 0) mesh.removeEdge(sourceEdgeId);
        }

        polygons.push({ index: polygonId, sourceEdgeIndices, extrudedEdgeIndices });
      }

      return { polygon: polygonId, polygons, sourcePolygon: polygonId };
    }

    for (const section of sections) {
      if (!section.length) continue;
      if (section[0].v0 === section[section.length - 1].v1) throw new Error('Cannot extrude a full loop');

      const sourceVertices = section.map((de) => de.v0).concat(section[section.length - 1].v1);
      const newVertices = sourceVertices.map((vertexId) => mesh.addVertex(mesh.getVertex(vertexId).position.add(extrusionVector)));
      const polygonVertices = [
        ...newVertices,
        ...sourceVertices.slice().reverse(),
      ];
      const newPolygon = mesh.addPolygon(polygonVertices);
      polygons.push({
        index: newPolygon,
        sourceEdgeIndices: section.map((de) => de.edge),
        extrudedEdgeIndices: mesh.getPolygon(newPolygon).edges.slice(0, Math.max(0, newVertices.length - 1)).map((de) => de.edge),
      });
    }

    return { polygon: polygons[0]?.index ?? null, polygons, sourcePolygon: polygonId };
  }
  static extrudePolygonNormal(mesh, polygonId, edgeIds, distance) { const p = mesh.getPolygon(polygonId); const n = p.signedArea(mesh) >= 0 ? -1 : 1; const first = p.edges.find(e => !edgeIds?.length || edgeIds.includes(e.edge)); const normal = mesh.getEdge(first.edge).normal.mul(distance * n); return MeshOperations.extrudePolygonDirected(mesh, polygonId, edgeIds, normal); }
  static splitPolygon(mesh, polygonId, vertexA, vertexB) { const p = mesh.getPolygon(polygonId); const verts = p.vertexIndices(); const ia = verts.indexOf(vertexA), ib = verts.indexOf(vertexB); if (ia < 0 || ib < 0 || ia === ib) return null; const range = (from, to) => { const out = []; for (let i = from;; i = (i + 1) % verts.length) { out.push(verts[i]); if (i === to) break; } return out; }; const a = range(ia, ib), b = range(ib, ia); mesh.removePolygon(polygonId, { removeOrphanEdges: true }); return { polygons: [mesh.addPolygon(a), mesh.addPolygon(b)] }; }
  static cutPolygon(mesh, polygonId, ...args) {
    const isVertex = (id) => Number.isInteger(id) && mesh.vertices.has(id);
    const isEdge = (id) => Number.isInteger(id) && mesh.edges.has(id);
    const isAmount = (value) => typeof value === 'number' && value >= 0 && value <= 1 && !Number.isInteger(value);
    const isPoint = (value) => value instanceof Vector2 || (typeof value === 'object' && value != null && 'x' in value && 'y' in value);

    const cutByPath = (startVertex, endVertex, throughVertices = []) => {
      const polygon = mesh.getPolygon(polygonId);
      if (!polygon) throw new Error(`Polygon ${polygonId} does not exist`);

      const cutPath = [startVertex, ...(throughVertices ?? []), endVertex];
      if (new Set(cutPath).size !== cutPath.length) throw new Error('Cut path cannot contain duplicate vertices');

      const polygonVertices = polygon.vertexIndices();
      for (const vertexId of cutPath) {
        if (!polygonVertices.includes(vertexId)) throw new Error(`Vertex ${vertexId} is not in polygon ${polygonId}`);
      }

      const startIndex = polygonVertices.indexOf(startVertex);
      const endIndex = polygonVertices.indexOf(endVertex);
      if (startIndex < 0 || endIndex < 0 || startIndex === endIndex) return null;

      const sharesBoundaryEdge = cutPath.length === 2 && (
        Math.abs(startIndex - endIndex) === 1 || Math.abs(startIndex - endIndex) === polygonVertices.length - 1
      );
      if (sharesBoundaryEdge) throw new Error(`Vertices ${startVertex} and ${endVertex} share an edge`);

      const boundaryRange = (from, to) => {
        const out = [];
        for (let i = from;; i = (i + 1) % polygonVertices.length) {
          out.push(polygonVertices[i]);
          if (i === to) break;
        }
        return out;
      };

      const forward = boundaryRange(startIndex, endIndex);
      const backward = boundaryRange(endIndex, startIndex);
      const reverseCutPath = [...cutPath].reverse();
      const polygonA = [...cutPath, ...backward.slice(1, -1)];
      const polygonB = [...reverseCutPath, ...forward.slice(1, -1)];
      if (polygonA.length < 3 || polygonB.length < 3) return null;

      mesh.removePolygon(polygonId, { removeOrphanEdges: true });
      return { polygons: [mesh.addPolygon(polygonA), mesh.addPolygon(polygonB)], vertices: cutPath };
    };

    const splitEdgeToVertex = (edgeId, amount) => MeshOperations.splitEdge(mesh, edgeId, Math.max(0.001, Math.min(0.999, amount))).vertex;

    const cutLine = (pointA, pointB) => {
      pointA = Vector2.from(pointA);
      pointB = Vector2.from(pointB);
      const polygon = mesh.getPolygon(polygonId);
      if (!polygon) throw new Error(`Polygon ${polygonId} does not exist`);
      const direction = pointB.sub(pointA);
      const hits = [];

      for (const de of polygon.edges) {
        const edge = mesh.getEdge(de.edge);
        const a = mesh.getVertex(de.v0).position;
        const b = mesh.getVertex(de.v1).position;
        const segment = b.sub(a);
        const denom = direction.cross(segment);
        if (Math.abs(denom) < 1e-8) continue;
        const offset = a.sub(pointA);
        const lineT = offset.cross(segment) / denom;
        const edgeT = offset.cross(direction) / denom;
        if (lineT < -1e-8 || lineT > 1 + 1e-8 || edgeT < -1e-8 || edgeT > 1 + 1e-8) continue;
        hits.push({ edgeId: de.edge, edgeT: Math.max(0, Math.min(1, edgeT)), point: pointA.add(direction.mul(lineT)) });
      }

      const unique = [];
      for (const hit of hits) {
        if (!unique.some((other) => other.edgeId === hit.edgeId || other.point.distanceTo(hit.point) < 1e-6)) unique.push(hit);
      }
      if (unique.length !== 2) throw new Error('Cut line must intersect polygon boundary exactly twice');

      const v0 = unique[0].edgeT <= 1e-6 ? mesh.getEdge(unique[0].edgeId).vertices[0]
        : unique[0].edgeT >= 1 - 1e-6 ? mesh.getEdge(unique[0].edgeId).vertices[1]
          : splitEdgeToVertex(unique[0].edgeId, unique[0].edgeT);
      const v1 = unique[1].edgeT <= 1e-6 ? mesh.getEdge(unique[1].edgeId).vertices[0]
        : unique[1].edgeT >= 1 - 1e-6 ? mesh.getEdge(unique[1].edgeId).vertices[1]
          : splitEdgeToVertex(unique[1].edgeId, unique[1].edgeT);
      return { ...cutByPath(v0, v1), vertices: [v0, v1] };
    };

    if (args.length === 2 && isPoint(args[0]) && isPoint(args[1])) return cutLine(args[0], args[1]);

    let vertexIndices = [];
    if (Array.isArray(args[args.length - 1])) vertexIndices = args.pop();

    let startVertex;
    let endVertex;
    let split = null;

    if (args.length === 2) {
      [startVertex, endVertex] = args;
    } else if (args.length === 3) {
      const [a, b, c] = args;
      if (isVertex(a) && isEdge(b) && (isAmount(c) || typeof c === 'number')) {
        startVertex = a;
        endVertex = splitEdgeToVertex(b, c);
        split = { edge: b, vertex: endVertex };
      } else if (isEdge(a) && typeof b === 'number' && isVertex(c)) {
        startVertex = splitEdgeToVertex(a, b);
        endVertex = c;
        split = { edge: a, vertex: startVertex };
      } else {
        throw new Error('Invalid cutPolygon(vertex, edge, amount) or cutPolygon(edge, amount, vertex) arguments');
      }
    } else if (args.length === 4) {
      const [edgeA, amountA, edgeB, amountB] = args;
      if (!isEdge(edgeA) || !isEdge(edgeB) || typeof amountA !== 'number' || typeof amountB !== 'number') {
        throw new Error('Invalid cutPolygon(edge, amount, edge, amount) arguments');
      }
      startVertex = splitEdgeToVertex(edgeA, amountA);
      endVertex = splitEdgeToVertex(edgeB, amountB);
      split = { vertices: [startVertex, endVertex] };
    } else {
      throw new Error('Invalid cutPolygon overload');
    }

    if (!isVertex(startVertex) || !isVertex(endVertex)) throw new Error('Cut endpoints must be vertices');
    const cut = cutByPath(startVertex, endVertex, vertexIndices);
    return { ...cut, vertex: split?.vertex, split };
  }
  static slicePolygon(mesh, polygonId, vertexA, vertexB, removeSliced = false) { const r = MeshOperations.splitPolygon(mesh, polygonId, vertexA, vertexB); if (removeSliced && r?.polygons?.[1] != null) mesh.removePolygon(r.polygons[1], { removeOrphanEdges: true }); return r; }
  static bridgeEdges(mesh, sourceEdgeIds, targetEdgeIds, options = {}) {
    const sourceIds = Array.isArray(sourceEdgeIds) ? sourceEdgeIds : [sourceEdgeIds];
    const targetIds = Array.isArray(targetEdgeIds) ? targetEdgeIds : [targetEdgeIds];
    if (!sourceIds.length || !targetIds.length) throw new Error('Bridge edges requires source and target edge lists');

    const opts = {
      type: 'Straight',
      squeezeType: 'None',
      squeezeAmount: 0,
      steps: 1,
      merge: false,
      tightness: 0.551915,
      ...options,
    };
    opts.steps = Math.max(1, Math.trunc(opts.steps || 1));
    if (opts.squeezeAmount <= -1) opts.squeezeAmount = -0.99;

    const polygonRefs = (ids) => new Set(ids.flatMap((id) => [...(mesh.getEdge(id)?.polygons ?? [])]));
    const sourcePolygonRefs = polygonRefs(sourceIds);
    const targetPolygonRefs = polygonRefs(targetIds);
    if (!sourcePolygonRefs.size || !targetPolygonRefs.size) throw new Error('Cannot bridge orphaned edges');
    if (opts.merge && (sourcePolygonRefs.size > 1 || targetPolygonRefs.size > 1)) throw new Error('Cannot merge a bridge operation when an edge list spans more than one polygon');

    for (const edgeId of [...sourceIds, ...targetIds]) {
      const edge = mesh.getEdge(edgeId);
      if (!edge) throw new Error(`Edge ${edgeId} does not exist`);
      if (edge.polygons.size !== 1) throw new Error(`Cannot bridge edge ${edgeId} as it is not an external edge`);
    }

    const toEdgeInfo = (ids) => ids.map((id) => {
      const edge = mesh.getEdge(id);
      return [id, edge.vertices[0], edge.vertices[1]];
    });
    const sourceGroups = MeshUtils.groupConnectedEdges(toEdgeInfo(sourceIds), true);
    const targetGroups = MeshUtils.groupConnectedEdges(toEdgeInfo(targetIds), true);
    if (sourceGroups.length !== 1 || targetGroups.length !== 1) throw new Error('Bridge edge lists must each be contiguous');

    const sourceEdges = sourceGroups[0];
    let targetEdges = targetGroups[0];
    if (sourceEdges[0][1] === sourceEdges[sourceEdges.length - 1][2]) throw new Error('Source edge list cannot be an unbroken loop');
    if (targetEdges[0][1] === targetEdges[targetEdges.length - 1][2]) throw new Error('Target edge list cannot be an unbroken loop');

    const reversedEdges = (edges) => [...edges].reverse().map(([edgeId, v0, v1]) => [edgeId, v1, v0]);
    const bridgeCost = (targetCandidate) => {
      const sourceStart = mesh.getVertex(sourceEdges[0][1]).position;
      const sourceEnd = mesh.getVertex(sourceEdges[sourceEdges.length - 1][2]).position;
      const targetStart = mesh.getVertex(targetCandidate[0][1]).position;
      const targetEnd = mesh.getVertex(targetCandidate[targetCandidate.length - 1][2]).position;
      return sourceStart.distanceTo(targetEnd) + targetStart.distanceTo(sourceEnd);
    };
    const reversedTargetEdges = reversedEdges(targetEdges);
    if (bridgeCost(reversedTargetEdges) < bridgeCost(targetEdges)) targetEdges = reversedTargetEdges;

    const sourceStartVertex = sourceEdges[0][1];
    const sourceEndVertex = sourceEdges[sourceEdges.length - 1][2];
    const targetStartVertex = targetEdges[0][1];
    const targetEndVertex = targetEdges[targetEdges.length - 1][2];

    const sourceStart = mesh.getVertex(sourceStartVertex).position;
    const sourceEnd = mesh.getVertex(sourceEndVertex).position;
    const targetStart = mesh.getVertex(targetStartVertex).position;
    const targetEnd = mesh.getVertex(targetEndVertex).position;

    const squeezeFn = (t) => opts.squeezeAmount + (Math.cos(t * Math.PI * 2) + 1) * 0.5 * (1 - opts.squeezeAmount);
    const cubic = (p0, p1, p2, p3, t) => {
      const a = p0.lerp(p1, t), b = p1.lerp(p2, t), c = p2.lerp(p3, t);
      return a.lerp(b, t).lerp(b.lerp(c, t), t);
    };
    const pathPoints = (start, end, oppositeStart, oppositeEnd, startNormal, endNormal) => {
      const points = [];
      const distance = start.distanceTo(end);
      const c0 = start.add(startNormal.neg().mul(distance * opts.tightness));
      const c1 = end.add(endNormal.neg().mul(distance * opts.tightness));
      for (let i = 1; i < opts.steps; ++i) {
        const t = i / opts.steps;
        let point = opts.type === 'Curved' ? cubic(start, c0, c1, end, t) : start.lerp(end, t);
        if (opts.squeezeType === 'Straight' || opts.squeezeType === 'Curved') {
          const opposite = oppositeStart.lerp(oppositeEnd, 1 - t);
          const centre = point.lerp(opposite, 0.5);
          point = point.lerp(centre, opts.squeezeType === 'Curved' ? squeezeFn(t) : 1);
        }
        points.push(point);
      }
      return points;
    };

    const side1Points = pathPoints(targetStart, sourceEnd, sourceStart, targetEnd, mesh.getEdge(targetEdges[0][0]).normal, mesh.getEdge(sourceEdges[sourceEdges.length - 1][0]).normal);
    const side2Points = pathPoints(sourceStart, targetEnd, targetStart, sourceEnd, mesh.getEdge(sourceEdges[0][0]).normal, mesh.getEdge(targetEdges[targetEdges.length - 1][0]).normal);
    const side1Vertices = side1Points.map((p) => mesh.addVertex(p));
    const side2Vertices = side2Points.map((p) => mesh.addVertex(p));

    const sourceReverse = [sourceEndVertex, ...[...sourceEdges].reverse().map(([, v0]) => v0)];
    const targetReverse = [targetEndVertex, ...[...targetEdges].reverse().map(([, v0]) => v0)];
    const polygonVertices = [
      ...sourceReverse,
      ...side2Vertices,
      targetEndVertex,
      ...targetReverse.slice(1),
      ...side1Vertices,
    ];

    const deduped = polygonVertices.filter((vertexId, index) => index === 0 || vertexId !== polygonVertices[index - 1]);
    if (deduped[0] === deduped[deduped.length - 1]) deduped.pop();
    const polygon = mesh.addPolygon(deduped);

    const result = { polygon, polygons: [{ index: polygon, edges: [[], []] }], polygonRemovedInMergeIndex: null };
    if (opts.merge) {
      for (const edgeId of [...sourceIds, ...targetIds]) {
        if (mesh.getEdge(edgeId)?.polygons.size === 2) mesh.removeEdge(edgeId);
      }
      result.polygonRemovedInMergeIndex = [...targetPolygonRefs][0];
    }

    return result;
  }
  static weldEdges(mesh, edge0Id, edge1Id) { const e0 = mesh.getEdge(edge0Id), e1 = mesh.getEdge(edge1Id); mesh.moveVertex(e1.vertices[0], mesh.getVertex(e0.vertices[0]).position); mesh.moveVertex(e1.vertices[1], mesh.getVertex(e0.vertices[1]).position); return { edge: edge0Id, removedEdge: edge1Id }; }
  static mergePolygonsByEdge(mesh, polyA, polyB) { const a = mesh.getPolygon(polyA), b = mesh.getPolygon(polyB); const pts = MathsUtils.convexHull([...a.vertices(mesh), ...b.vertices(mesh)]); mesh.removePolygon(polyA, { removeOrphanEdges: true }); mesh.removePolygon(polyB, { removeOrphanEdges: true }); return { polygon: mesh.addPolygon(pts) }; }
}


export class Offsetter {
  static CornerType = Object.freeze({ Miter: 'Miter', Square: 'Square', Arc: 'Arc', Unmitred: 'Unmitred' });
  constructor(vertices = [], maxMiter = 10) { this.vertices = vertices.map(Vector2.from); this.maxMiter = maxMiter; this.offsetVertices = []; }
  getVertices() { return this.vertices.map(v => v.clone()); }
  getOffsetVertices() { return this.offsetVertices.map(loop => loop.map(v => v.clone())); }
  offset(amount1, amount2 = amount1, cornerType = Offsetter.CornerType.Miter, widthModifier = t => 1, startVertex = 0, endVertex = -1) { this.offsetVertices = [Offsetter.offsetPolygon(this.vertices.slice(startVertex, endVertex < 0 ? undefined : endVertex + 1), amount1, cornerType, widthModifier)]; return this.offsetVertices; }
  static offsetPolygon(points, distance, cornerType = Offsetter.CornerType.Miter, widthModifier = t => 1) {
    const pts = points.map(Vector2.from); if (pts.length < 3) return pts;
    const ccw = MathsUtils.pointsWinding(pts) === Winding.Anticlockwise;
    const outward = ccw ? -1 : 1;
    const lineIntersection = (p, r, q, s) => { const den = r.cross(s); if (Math.abs(den) < MathsUtils.Epsilon) return p; return p.add(r.mul(q.sub(p).cross(s) / den)); };
    const shifted = pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; const d = q.sub(p).normalised(); const n = d.perpendicular().mul(outward * distance * widthModifier(i / Math.max(1, pts.length - 1))); return { p: p.add(n), q: q.add(n), d }; });
    return pts.map((_, i) => {
      const prev = shifted[(i + pts.length - 1) % pts.length], cur = shifted[i];
      let v = lineIntersection(prev.p, prev.d, cur.p, cur.d);
      if (cornerType === Offsetter.CornerType.Square) v = v.add(prev.d.sub(cur.d).normalised().mul(Math.abs(distance) * 0.25));
      if (cornerType === Offsetter.CornerType.Unmitred) v = prev.q.lerp(cur.p, 0.5);
      return v;
    });
  }
}
export class ConvexOffsetter extends Offsetter {}
export class BezierOffsetter extends Offsetter {}

export class CsgUtils {
  static unionBounds(meshes) { return meshes.map(m => m.extents).reduce((a, b) => a ? a.union(b) : b, null); }
  static opUnion(polygons) { return MeshUtils.unionPolygons(polygons); }
}
