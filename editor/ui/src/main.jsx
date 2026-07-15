import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BridgeEdgesOptions, DirectedEdge, Mesh, MeshHelpers, MeshOperations, SerializerMeshChunk, Vector2 } from '../../../src/index.js';
import styles from './styles.css?inline';

const styleElement = document.createElement('style');
styleElement.dataset.source = 'react-square-mesh-styles';
styleElement.textContent = styles;
document.head.appendChild(styleElement);

const VIEW_SIZE = 640;
const DEFAULT_VERTEX_SIZE = 6;
const CLICK_DRAG_THRESHOLD = 4;

function useViewportBox() {
  const [size, setSize] = useState(() => ({
    width: window.innerWidth || VIEW_SIZE,
    height: window.innerHeight || VIEW_SIZE,
  }));

  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const aspect = size.width / size.height;
  if (aspect >= 1) {
    const width = VIEW_SIZE * aspect;
    return { x: -width / 2, y: -VIEW_SIZE / 2, width, height: VIEW_SIZE };
  }

  const height = VIEW_SIZE / aspect;
  return { x: -VIEW_SIZE / 2, y: -height / 2, width: VIEW_SIZE, height };
}

function createSquareMesh() {
  const mesh = new Mesh();
  const result = MeshHelpers.createRectangle(mesh, new Vector2(-140, -140), new Vector2(140, 140));
  return { mesh, polygonId: result.polygonIndex };
}

function SquareMeshEditor() {
  const initial = useMemo(createSquareMesh, []);
  const [mesh, setMesh] = useState(initial.mesh);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [dragVertex, setDragVertex] = useState(null);
  const [dragVertices, setDragVertices] = useState(null);
  const [dragEdges, setDragEdges] = useState(null);
  const [dragPolygons, setDragPolygons] = useState(null);
  const [extrudeEdge, setExtrudeEdge] = useState(null);
  const [splitDrag, setSplitDrag] = useState(null);
  const [pendingSelection, setPendingSelection] = useState(null);
  const [selectedVertices, setSelectedVertices] = useState([]);
  const [selectedEdges, setSelectedEdges] = useState([]);
  const [selectedPolygons, setSelectedPolygons] = useState([]);
  const [insertMode, setInsertMode] = useState(false);
  const [insertPoints, setInsertPoints] = useState([]);
  const [insertCursor, setInsertCursor] = useState(null);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [bridgeDialogOpen, setBridgeDialogOpen] = useState(false);
  const [bridgePreviewEnabled, setBridgePreviewEnabled] = useState(false);
  const [bridgeDialogPosition, setBridgeDialogPosition] = useState(null);
  const [bridgeDialogDrag, setBridgeDialogDrag] = useState(null);
  const [bridgeOptions, setBridgeOptions] = useState(() => new BridgeEdgesOptions());
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [splitPreviewEnabled, setSplitPreviewEnabled] = useState(false);
  const [splitDialogPosition, setSplitDialogPosition] = useState(null);
  const [splitDialogDrag, setSplitDialogDrag] = useState(null);
  const [splitOptions, setSplitOptions] = useState({ mode: 'count', edgeCount: 2, amount: 0.5 });
  const [chamferDialogOpen, setChamferDialogOpen] = useState(false);
  const [chamferPreviewEnabled, setChamferPreviewEnabled] = useState(false);
  const [chamferDialogPosition, setChamferDialogPosition] = useState(null);
  const [chamferDialogDrag, setChamferDialogDrag] = useState(null);
  const [chamferOptions, setChamferOptions] = useState({ distance: 16, tightness: 0.551915, segments: 1 });
  const [extrudeVertexDialogOpen, setExtrudeVertexDialogOpen] = useState(false);
  const [extrudeVertexPreviewEnabled, setExtrudeVertexPreviewEnabled] = useState(false);
  const [extrudeVertexDialogPosition, setExtrudeVertexDialogPosition] = useState(null);
  const [extrudeVertexDialogDrag, setExtrudeVertexDialogDrag] = useState(null);
  const [extrudeVertexOptions, setExtrudeVertexOptions] = useState({ type: 'Round', distance: 24, outwards: true, squareThreshold: 3, segments: 8 });
  const [gridSize, setGridSize] = useState(32);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [showVertices, setShowVertices] = useState(true);
  const [showTriangulation, setShowTriangulation] = useState(true);
  const [vertexSize, setVertexSize] = useState(DEFAULT_VERTEX_SIZE);
  const [showVertexLabels, setShowVertexLabels] = useState(false);
  const importInputRef = useRef(null);
  const viewBox = useViewportBox();

  const selectedEdgeGroups = useMemo(() => {
    const remaining = new Set(selectedEdges.filter((id) => mesh.getEdge(id)));
    const groups = [];

    while (remaining.size) {
      const [start] = remaining;
      const group = [];
      const stack = [start];
      remaining.delete(start);

      while (stack.length) {
        const edgeId = stack.pop();
        const edge = mesh.getEdge(edgeId);
        if (!edge) continue;
        group.push(edgeId);

        for (const otherId of [...remaining]) {
          const other = mesh.getEdge(otherId);
          if (!other) {
            remaining.delete(otherId);
            continue;
          }
          if (edge.vertices.some((vertexId) => other.vertices.includes(vertexId))) {
            remaining.delete(otherId);
            stack.push(otherId);
          }
        }
      }

      groups.push(group);
    }

    return groups;
  }, [mesh, selectedEdges]);

  const previewMesh = useMemo(() => {
    try {
      if (bridgeDialogOpen && bridgePreviewEnabled && selectedEdgeGroups.length === 2) return buildBridgePreviewMesh();
      if (splitDialogOpen && splitPreviewEnabled && selectedEdges.length) return buildSplitPreviewMesh();
      if (chamferDialogOpen && chamferPreviewEnabled && selectedVertices.length) return buildChamferPreviewMesh();
      if (extrudeVertexDialogOpen && extrudeVertexPreviewEnabled && selectedVertices.length) return buildExtrudeVertexPreviewMesh();
    } catch {
      return null;
    }
    return null;
  }, [bridgeDialogOpen, bridgePreviewEnabled, selectedEdgeGroups, bridgeOptions, splitDialogOpen, splitPreviewEnabled, splitOptions, selectedEdges, chamferDialogOpen, chamferPreviewEnabled, chamferOptions, extrudeVertexDialogOpen, extrudeVertexPreviewEnabled, extrudeVertexOptions, selectedVertices, mesh]);

  const renderMesh = previewMesh ?? mesh;
  const polygonIds = [...renderMesh.polygons.keys()];
  const vertexIds = [...renderMesh.vertices.keys()];
  const vertices = vertexIds.map((id) => ({ id, position: renderMesh.getVertex(id).position }));
  const edgePoints = [...renderMesh.edges].map(([id, edge]) => {
    const a = renderMesh.getVertex(edge.vertices[0]).position;
    const b = renderMesh.getVertex(edge.vertices[1]).position;
    return { id, a, b };
  });
  const triangles = polygonIds.flatMap((id) => renderMesh.triangulatePolygon(id));
  const polygonPointSets = polygonIds.map((id) => ({
    id,
    hole: renderMesh.getPolygon(id).hole,
    points: renderMesh.getPolygon(id).vertexIndices().map((vertexId) => renderMesh.getVertex(vertexId).position),
  }));
  const canConvertSelectedPolygonsToHoles = useMemo(
    () => selectedPolygons.length > 0 && selectedPolygons.every((polygonId) => findContainingPolygon(mesh, polygonId) != null),
    [mesh, selectedPolygons],
  );
  const canRemoveHolesFromSelectedPolygons = useMemo(
    () => selectedPolygons.some((polygonId) => (mesh.getPolygon(polygonId)?.holes.length ?? 0) > 0),
    [mesh, selectedPolygons],
  );

  useEffect(() => {
    function onKeyDown(event) {
      const tagName = event.target?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') return;

      if (event.key.toLowerCase() === 'i' && !bridgeDialogOpen && !splitDialogOpen && !chamferDialogOpen && !extrudeVertexDialogOpen) {
        event.preventDefault();
        setInsertMode((enabled) => !enabled);
        setInsertPoints([]);
        setInsertCursor(null);
        clearSelection();
        return;
      }

      if (event.key.toLowerCase() === 'b' && selectedEdgeGroups.length === 2) {
        event.preventDefault();
        openBridgeDialog();
        return;
      }

      if (event.key.toLowerCase() === 's' && selectedEdges.length) {
        event.preventDefault();
        openSplitDialog();
        return;
      }

      if (event.key.toLowerCase() === 'c' && selectedVertices.length) {
        event.preventDefault();
        openChamferDialog();
        return;
      }

      if (event.key.toLowerCase() === 'e' && selectedVertices.length) {
        event.preventDefault();
        openExtrudeVertexDialog();
        return;
      }

      if (event.key.toLowerCase() === 'h' && canConvertSelectedPolygonsToHoles) {
        event.preventDefault();
        convertSelectedPolygonsToHoles();
        return;
      }

      if (bridgeDialogOpen || splitDialogOpen || chamferDialogOpen || extrudeVertexDialogOpen) return;
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      if (selectedVertices.length) {
        const selected = new Set(selectedVertices);
        const meshPolygonIds = [...mesh.polygons.keys()];
        const affected = meshPolygonIds.filter((id) => mesh.getPolygon(id).vertexIndices().some((vertexId) => selected.has(vertexId)));
        if (!affected.length || affected.some((id) => mesh.getPolygon(id).vertexIndices().filter((vertexId) => !selected.has(vertexId)).length < 3)) return;

        event.preventDefault();
        const next = new Mesh();
        for (const id of meshPolygonIds) {
          const positions = mesh.getPolygon(id).vertexIndices()
            .filter((vertexId) => !selected.has(vertexId))
            .map((vertexId) => mesh.getVertex(vertexId).position.clone());
          if (positions.length >= 3) next.addPolygon(positions);
        }
        commitMesh(next);
        setSelectedVertices([]);
        setSelectedEdges([]);
        setSelectedPolygons([]);
        setDragVertex(null);
        setDragEdges(null);
        setSplitDrag(null);
        return;
      }

      if (selectedEdges.length) {
        event.preventDefault();
        try {
          const next = mesh.clone();
          for (const edgeId of selectedEdges) {
            const deleted = next.removeEdge(edgeId);
            if (!deleted) return;
          }
          commitMesh(next);
          setSelectedEdges([]);
        } catch {
          // Leave the mesh untouched when edge deletion is invalid.
        }
        return;
      }

      if (selectedPolygons.length) {
        event.preventDefault();
        try {
          const next = mesh.clone();
          for (const polygonId of selectedPolygons) {
            const deleted = next.removePolygon(polygonId, { removeOrphanEdges: true });
            if (!deleted) return;
          }
          for (const [vertexId, vertex] of [...next.vertices]) {
            if (vertex.edges.size === 0 && ![...next.polygons.values()].some((polygon) => polygon.usesVertex(vertexId))) {
              next.removeVertex(vertexId);
            }
          }
          commitMesh(next);
          setSelectedPolygons([]);
        } catch {
          // Leave the mesh untouched when polygon deletion is invalid.
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mesh, selectedVertices, selectedEdges, selectedEdgeGroups, selectedPolygons, canConvertSelectedPolygonsToHoles, bridgeDialogOpen, splitDialogOpen, chamferDialogOpen, extrudeVertexDialogOpen]);

  function svgPoint(event) {
    const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget;
    const svgPoint = svg.createSVGPoint();
    svgPoint.x = event.clientX;
    svgPoint.y = event.clientY;
    const transformed = svgPoint.matrixTransform(svg.getScreenCTM().inverse());
    const meshPoint = new Vector2(transformed.x, -transformed.y);
    if (!snapToGrid) return meshPoint;
    return new Vector2(
      Math.round(meshPoint.x / gridSize) * gridSize,
      Math.round(meshPoint.y / gridSize) * gridSize,
    );
  }

  function clearInteractionState() {
    setSelectedVertices([]);
    setSelectedEdges([]);
    setSelectedPolygons([]);
    setHelpDialogOpen(false);
    setBridgeDialogOpen(false);
    setBridgeDialogDrag(null);
    setSplitDialogOpen(false);
    setSplitDialogDrag(null);
    setChamferDialogOpen(false);
    setChamferDialogDrag(null);
    setExtrudeVertexDialogOpen(false);
    setExtrudeVertexDialogDrag(null);
    setDragVertex(null);
    setDragVertices(null);
    setDragEdges(null);
    setDragPolygons(null);
    setExtrudeEdge(null);
    setSplitDrag(null);
    setPendingSelection(null);
    setInsertPoints([]);
    setInsertCursor(null);
  }

  function pushUndo(snapshot = mesh) {
    setUndoStack((stack) => [...stack.slice(-19), snapshot.clone()]);
    setRedoStack([]);
  }

  function commitMesh(next) {
    pushUndo(mesh);
    setMesh(next);
  }

  function undo() {
    setUndoStack((stack) => {
      if (!stack.length) return stack;
      const previous = stack[stack.length - 1];
      setRedoStack((redo) => [...redo.slice(-19), mesh.clone()]);
      setMesh(previous);
      clearInteractionState();
      return stack.slice(0, -1);
    });
  }

  function redo() {
    setRedoStack((stack) => {
      if (!stack.length) return stack;
      const next = stack[stack.length - 1];
      setUndoStack((undoHistory) => [...undoHistory.slice(-19), mesh.clone()]);
      setMesh(next);
      clearInteractionState();
      return stack.slice(0, -1);
    });
  }

  function updateVertex(vertexId, point) {
    const next = mesh.clone();
    next.moveVertex(vertexId, point);
    setMesh(next);
  }

  function moveVerticesFromBase(baseMesh, vertexIds, delta) {
    const next = baseMesh.clone();
    for (const vertexId of vertexIds) {
      const vertex = baseMesh.getVertex(vertexId);
      if (vertex) next.moveVertex(vertexId, vertex.position.add(delta));
    }
    return next;
  }

  function moveEdgesFromBase(baseMesh, edgeIds, delta) {
    const next = baseMesh.clone();
    const vertexIds = new Set();
    for (const edgeId of edgeIds) {
      const edge = next.getEdge(edgeId);
      if (!edge) continue;
      for (const vertexId of edge.vertices) vertexIds.add(vertexId);
    }
    for (const vertexId of vertexIds) {
      const vertex = baseMesh.getVertex(vertexId);
      if (vertex) next.moveVertex(vertexId, vertex.position.add(delta));
    }
    return next;
  }

  function movePolygonsFromBase(baseMesh, polygonIdsToMove, delta) {
    const vertexIds = new Set();
    for (const polygonId of polygonIdsToMove) {
      const polygon = baseMesh.getPolygon(polygonId);
      if (!polygon) continue;
      for (const vertexId of polygon.vertexIndices()) vertexIds.add(vertexId);
    }
    return moveVerticesFromBase(baseMesh, vertexIds, delta);
  }

  function splitEdgeAt(edgeId, point) {
    const edge = mesh.getEdge(edgeId);
    const a = mesh.getVertex(edge.vertices[0]).position;
    const b = mesh.getVertex(edge.vertices[1]).position;
    const ab = b.sub(a);
    const lengthSq = ab.lengthSq();
    if (lengthSq === 0) return null;

    const t = Math.max(0.001, Math.min(0.999, point.sub(a).dot(ab) / lengthSq));
    const next = mesh.clone();
    const result = MeshOperations.splitEdge(next, edgeId, t);
    next.moveVertex(result.vertex, point);
    commitMesh(next);
    setSelectedEdges([]);
    setSelectedPolygons([]);
    return result.vertex;
  }

  function extrudeSingleEdgeFromBase(baseMesh, edgeId, delta) {
    const next = baseMesh.clone();
    const edge = next.getEdge(edgeId);
    if (!edge || edge.polygons.size === 0) return next;

    const targetPolygonId = [...edge.polygons][0];
    const polygon = next.getPolygon(targetPolygonId);
    const edgePosition = polygon.edges.findIndex((directedEdge) => directedEdge.edge === edgeId);
    if (edgePosition < 0) return next;

    const directedEdge = polygon.edges[edgePosition];
    const start = next.getVertex(directedEdge.v0).position;
    const end = next.getVertex(directedEdge.v1).position;
    const newStart = next.addVertex(start.add(delta));
    const newEnd = next.addVertex(end.add(delta));

    edge.polygons.delete(targetPolygonId);
    if (edge.polygons.size === 0) next.removeEdge(edgeId);

    const sideA = next.addEdge(directedEdge.v0, newStart);
    const extruded = next.addEdge(newStart, newEnd);
    const sideB = next.addEdge(newEnd, directedEdge.v1);

    polygon.edges.splice(
      edgePosition,
      1,
      new DirectedEdge(sideA, directedEdge.v0, newStart),
      new DirectedEdge(extruded, newStart, newEnd),
      new DirectedEdge(sideB, newEnd, directedEdge.v1),
    );

    next.getEdge(sideA).polygons.add(targetPolygonId);
    next.getEdge(extruded).polygons.add(targetPolygonId);
    next.getEdge(sideB).polygons.add(targetPolygonId);
    polygon.invalidate();
    return next;
  }

  function extrudeEdgesFromBase(baseMesh, edgeIds, delta) {
    if (edgeIds.length === 1) return extrudeSingleEdgeFromBase(baseMesh, edgeIds[0], delta);

    const next = baseMesh.clone();
    const edgesByPolygon = new Map();

    for (const edgeId of edgeIds) {
      const edge = next.getEdge(edgeId);
      if (!edge || edge.polygons.size === 0) continue;
      const polygonId = [...edge.polygons][0];
      if (!edgesByPolygon.has(polygonId)) edgesByPolygon.set(polygonId, []);
      edgesByPolygon.get(polygonId).push(edgeId);
    }

    for (const [polygonId, polygonEdgeIds] of edgesByPolygon) {
      MeshOperations.extrudePolygonDirected(next, polygonId, polygonEdgeIds, delta, { mergePolygons: true, separateExtrusions: false });
    }

    return next;
  }

  function findVertexAt(point, excludeId = null) {
    return vertices.find(({ id, position }) => id !== excludeId && position.distanceTo(point) <= vertexSize * 1.75)?.id ?? null;
  }

  function findEdgeAt(point, excludeVertexId = null) {
    let best = null;
    let bestDistance = Infinity;
    for (const { id, a, b } of edgePoints) {
      const edge = mesh.getEdge(id);
      if (excludeVertexId != null && edge.vertices.includes(excludeVertexId)) continue;
      const distance = point.distanceToLine(a, b);
      if (distance < bestDistance) {
        best = id;
        bestDistance = distance;
      }
    }
    return bestDistance <= vertexSize * 1.75 ? best : null;
  }

  function findCrossedEdgesInMesh(sourceMesh, fromVertex, toPoint, targetPolygonId = null) {
    const fromPoint = sourceMesh.getVertex(fromVertex).position;
    const ray = toPoint.sub(fromPoint);
    if (ray.lengthSq() === 0) return [];

    const crossings = [];
    for (const [id, edge] of sourceMesh.edges) {
      if (!edge || edge.vertices.includes(fromVertex)) continue;
      if (targetPolygonId != null && !edge.polygons.has(targetPolygonId)) continue;

      const a = sourceMesh.getVertex(edge.vertices[0]).position;
      const b = sourceMesh.getVertex(edge.vertices[1]).position;
      const segment = b.sub(a);
      const denom = ray.cross(segment);
      if (Math.abs(denom) < 1e-8) continue;

      const offset = a.sub(fromPoint);
      const lineAmount = offset.cross(segment) / denom;
      const edgeAmount = offset.cross(ray) / denom;
      if (lineAmount <= 1e-6 || lineAmount >= 1 || edgeAmount <= 1e-6 || edgeAmount >= 1 - 1e-6) continue;
      crossings.push({ edgeId: id, edgeAmount, lineAmount, point: fromPoint.add(ray.mul(lineAmount)) });
    }

    return crossings.sort((a, b) => a.lineAmount - b.lineAmount);
  }

  function findCrossedEdges(fromVertex, toPoint, targetPolygonId = null) {
    return findCrossedEdgesInMesh(mesh, fromVertex, toPoint, targetPolygonId);
  }

  function findFirstCrossedEdge(fromVertex, toPoint) {
    return findCrossedEdges(fromVertex, toPoint)[0] ?? null;
  }

  function splitBetweenVertices(fromVertex, toVertex) {
    const targetPolygonId = polygonIds.find((id) => {
      const polygonVertices = mesh.getPolygon(id).vertexIndices();
      return polygonVertices.includes(fromVertex) && polygonVertices.includes(toVertex);
    });
    if (targetPolygonId == null) return;

    const polygonVertices = mesh.getPolygon(targetPolygonId).vertexIndices();
    const fromIndex = polygonVertices.indexOf(fromVertex);
    const toIndex = polygonVertices.indexOf(toVertex);
    const adjacent = Math.abs(fromIndex - toIndex) === 1 || Math.abs(fromIndex - toIndex) === polygonVertices.length - 1;
    if (adjacent || polygonVertices.length <= 3) return;

    const next = mesh.clone();
    MeshOperations.splitPolygon(next, targetPolygonId, fromVertex, toVertex);
    setSelectedEdges([]);
    setSelectedPolygons([]);
    commitMesh(next);
  }

  function edgeAmountAt(sourceMesh, edgeId, point) {
    const edge = sourceMesh.getEdge(edgeId);
    const a = sourceMesh.getVertex(edge.vertices[0]).position;
    const b = sourceMesh.getVertex(edge.vertices[1]).position;
    const ab = b.sub(a);
    const lengthSq = ab.lengthSq();
    if (lengthSq === 0) return 0.5;
    return Math.max(0.001, Math.min(0.999, point.sub(a).dot(ab) / lengthSq));
  }

  function polygonsUsingVertex(sourceMesh, vertexId) {
    return [...sourceMesh.polygons].filter(([, polygon]) => polygon.usesVertex(vertexId)).map(([id]) => id);
  }

  function sharedPolygonForEdge(sourceMesh, vertexId, edgeId) {
    const edge = sourceMesh.getEdge(edgeId);
    if (!edge) return null;
    return [...edge.polygons].find((polygonId) => sourceMesh.getPolygon(polygonId)?.usesVertex(vertexId)) ?? null;
  }

  function verticesShareEdge(sourceMesh, a, b) {
    const edgeId = sourceMesh.findEdge(a, b);
    return edgeId != null && edgeId !== undefined;
  }

  function polygonForCut(sourceMesh, a, b) {
    return polygonsUsingVertex(sourceMesh, a).find((polygonId) => sourceMesh.getPolygon(polygonId).usesVertex(b)) ?? null;
  }

  function cutDraggedLine(fromVertex, toPoint, { targetVertex = null, targetEdge = null } = {}) {
    const next = mesh.clone();
    const crossings = findCrossedEdges(fromVertex, toPoint)
      .filter((crossing) => crossing.edgeId !== targetEdge);
    const pathVertices = [fromVertex];
    let changed = false;

    for (const crossing of crossings) {
      const edge = next.getEdge(crossing.edgeId);
      if (!edge) continue;
      const split = MeshOperations.splitEdge(next, crossing.edgeId, crossing.edgeAmount);
      pathVertices.push(split.vertex);
      changed = true;
    }

    let finalVertex = targetVertex;
    if (targetEdge != null) {
      const existingCrossing = crossings.find((crossing) => crossing.edgeId === targetEdge);
      if (existingCrossing) {
        finalVertex = pathVertices[crossings.indexOf(existingCrossing) + 1];
      } else {
        const edge = next.getEdge(targetEdge);
        if (!edge) return;
        const split = MeshOperations.splitEdge(next, targetEdge, edgeAmountAt(next, targetEdge, toPoint));
        finalVertex = split.vertex;
        changed = true;
      }
    }

    if (finalVertex == null) finalVertex = pathVertices[pathVertices.length - 1];
    if (finalVertex != null && pathVertices[pathVertices.length - 1] !== finalVertex) pathVertices.push(finalVertex);
    if (pathVertices.length < 2) return;

    for (let i = 0; i < pathVertices.length - 1; ++i) {
      const a = pathVertices[i];
      const b = pathVertices[i + 1];
      if (a === b || verticesShareEdge(next, a, b)) continue;

      const polygonId = polygonForCut(next, a, b);
      if (polygonId == null) continue;
      MeshOperations.cutPolygon(next, polygonId, a, b);
      changed = true;
    }

    if (!changed) return;
    const selected = pathVertices[pathVertices.length - 1];
    if (selected != null) setSelectedVertices([selected]);
    setSelectedEdges([]);
    setSelectedPolygons([]);
    commitMesh(next);
  }

  function selectVertex(vertexId, mode = 'replace') {
    setSelectedVertices((ids) => {
      if (mode === 'add') return ids.includes(vertexId) ? ids : [...ids, vertexId];
      if (mode === 'toggle') return ids.includes(vertexId) ? ids.filter((id) => id !== vertexId) : [...ids, vertexId];
      return [vertexId];
    });
    setSelectedEdges([]);
    setSelectedPolygons([]);
  }

  function selectEdge(edgeId, mode = 'replace') {
    setSelectedEdges((ids) => {
      if (mode === 'add') return ids.includes(edgeId) ? ids : [...ids, edgeId];
      if (mode === 'toggle') return ids.includes(edgeId) ? ids.filter((id) => id !== edgeId) : [...ids, edgeId];
      return [edgeId];
    });
    setSelectedVertices([]);
    setSelectedPolygons([]);
  }

  function selectPolygon(polygonId, mode = 'replace') {
    setSelectedPolygons((ids) => {
      if (mode === 'add') return ids.includes(polygonId) ? ids : [...ids, polygonId];
      if (mode === 'toggle') return ids.includes(polygonId) ? ids.filter((id) => id !== polygonId) : [...ids, polygonId];
      return [polygonId];
    });
    setSelectedVertices([]);
    setSelectedEdges([]);
  }

  function findContainingPolygon(sourceMesh, holePolygonId) {
    const holePolygon = sourceMesh.getPolygon(holePolygonId);
    if (!holePolygon || holePolygon.hole) return null;
    const holePositions = holePolygon.vertexIndices().map((vertexId) => sourceMesh.getVertex(vertexId).position);

    return [...sourceMesh.polygons].find(([candidateId, candidate]) => (
      candidateId !== holePolygonId
      && !candidate.hole
      && holePositions.every((position) => candidate.pointInside(sourceMesh, position))
    ))?.[0] ?? null;
  }

  function convertSelectedPolygonsToHoles() {
    if (!canConvertSelectedPolygonsToHoles) return;

    try {
      const next = mesh.clone();
      const converted = [];
      for (const polygonId of selectedPolygons) {
        const parentId = findContainingPolygon(next, polygonId);
        if (parentId == null) continue;
        next.addHoleToPolygon(parentId, polygonId);
        converted.push(polygonId);
      }

      if (!converted.length) return;
      commitMesh(next);
      setSelectedPolygons(converted);
    } catch (error) {
      console.error('Failed to convert selected polygon to hole', error);
    }
  }

  function removeHolesFromSelectedPolygons() {
    if (!canRemoveHolesFromSelectedPolygons) return;

    try {
      const next = mesh.clone();
      for (const polygonId of selectedPolygons) {
        if ((next.getPolygon(polygonId)?.holes.length ?? 0) > 0) next.removeHolesFromPolygon(polygonId);
      }
      commitMesh(next);
    } catch (error) {
      console.error('Failed to remove holes from selected polygons', error);
    }
  }

  function orderedEdgeGroup(edgeIds) {
    if (edgeIds.length <= 1) return edgeIds;

    const vertexToEdges = new Map();
    for (const edgeId of edgeIds) {
      for (const vertexId of mesh.getEdge(edgeId).vertices) {
        if (!vertexToEdges.has(vertexId)) vertexToEdges.set(vertexId, []);
        vertexToEdges.get(vertexId).push(edgeId);
      }
    }

    const startEdge = edgeIds.find((edgeId) => mesh.getEdge(edgeId).vertices.some((vertexId) => vertexToEdges.get(vertexId)?.length === 1)) ?? edgeIds[0];
    const ordered = [];
    const visited = new Set();
    let current = startEdge;

    while (current != null) {
      ordered.push(current);
      visited.add(current);
      const next = mesh.getEdge(current).vertices
        .flatMap((vertexId) => vertexToEdges.get(vertexId) ?? [])
        .find((edgeId) => !visited.has(edgeId));
      current = next ?? null;
    }

    return ordered.concat(edgeIds.filter((edgeId) => !visited.has(edgeId)));
  }

  function buildBridgePreviewMesh() {
    if (selectedEdgeGroups.length !== 2) return null;
    const [groupA, groupB] = selectedEdgeGroups.map(orderedEdgeGroup);
    if (groupA.length !== groupB.length) return null;

    const next = mesh.clone();
    MeshOperations.bridgeEdges(next, groupA, groupB, new BridgeEdgesOptions(bridgeOptions));
    return next;
  }

  function bridgeSelectedEdges() {
    try {
      const next = buildBridgePreviewMesh();
      if (!next) return;
      commitMesh(next);
      setSelectedEdges([]);
      setBridgeDialogOpen(false);
      setBridgePreviewEnabled(false);
    } catch (error) {
      console.error('Failed to bridge selected edge groups', error);
    }
  }

  function splitValueFromOptions() {
    return splitOptions.mode === 'count'
      ? Math.max(2, Math.trunc(Number(splitOptions.edgeCount) || 2))
      : Math.max(0.001, Math.min(0.999, Number(splitOptions.amount) || 0.5));
  }

  function buildSplitPreviewMesh() {
    if (!selectedEdges.length) return null;
    const next = mesh.clone();
    const value = splitValueFromOptions();
    for (const edgeId of selectedEdges) {
      if (next.getEdge(edgeId)) MeshOperations.splitEdge(next, edgeId, value);
    }
    return next;
  }

  function splitSelectedEdges() {
    try {
      const next = buildSplitPreviewMesh();
      if (!next) return;
      commitMesh(next);
      setSelectedEdges([]);
      setSplitDialogOpen(false);
      setSplitPreviewEnabled(false);
      setSplitDialogDrag(null);
    } catch (error) {
      console.error('Failed to split selected edges', error);
    }
  }

  function chamferPoints(prev, corner, next) {
    const distance = Math.max(0, Number(chamferOptions.distance) || 0);
    const segments = Math.max(1, Math.trunc(Number(chamferOptions.segments) || 1));
    const tightness = Math.max(0, Math.min(1, Number(chamferOptions.tightness) || 0));
    const prevLength = corner.distanceTo(prev);
    const nextLength = corner.distanceTo(next);
    if (distance <= 0 || prevLength === 0 || nextLength === 0) return [corner.clone()];

    const start = corner.lerp(prev, Math.min(0.999, distance / prevLength));
    const end = corner.lerp(next, Math.min(0.999, distance / nextLength));
    if (segments === 1) return [start, end];

    const ctrl0 = start.lerp(corner, tightness);
    const ctrl1 = end.lerp(corner, tightness);
    const cubic = (p0, p1, p2, p3, t) => {
      const a = p0.lerp(p1, t);
      const b = p1.lerp(p2, t);
      const c = p2.lerp(p3, t);
      return a.lerp(b, t).lerp(b.lerp(c, t), t);
    };

    return [...Array(segments + 1)].map((_, i) => cubic(start, ctrl0, ctrl1, end, i / segments));
  }

  function buildChamferPreviewMesh() {
    if (!selectedVertices.length) return null;
    const selected = new Set(selectedVertices);
    const next = new Mesh();

    for (const polygon of mesh.polygons.values()) {
      const ids = polygon.vertexIndices();
      const positions = [];
      for (let i = 0; i < ids.length; ++i) {
        const vertexId = ids[i];
        const prevId = ids[(i + ids.length - 1) % ids.length];
        const nextId = ids[(i + 1) % ids.length];
        const corner = mesh.getVertex(vertexId).position;

        if (selected.has(vertexId)) {
          positions.push(...chamferPoints(
            mesh.getVertex(prevId).position,
            corner,
            mesh.getVertex(nextId).position,
          ));
        } else {
          positions.push(corner.clone());
        }
      }
      if (positions.length >= 3) next.addPolygon(positions);
    }

    return next;
  }

  function chamferSelectedVertices() {
    try {
      const next = buildChamferPreviewMesh();
      if (!next) return;
      commitMesh(next);
      setSelectedVertices([]);
      setChamferDialogOpen(false);
      setChamferPreviewEnabled(false);
      setChamferDialogDrag(null);
    } catch (error) {
      console.error('Failed to chamfer selected vertices', error);
    }
  }

  function extrudeVertexPoints(prev, corner, next, polygonIsCcw) {
    const distance = Math.max(0, Number(extrudeVertexOptions.distance) || 0);
    const segments = Math.max(1, Math.trunc(Number(extrudeVertexOptions.segments) || 1));
    if (distance <= 0 || corner.distanceTo(prev) === 0 || corner.distanceTo(next) === 0) return [corner.clone()];

    const prevDir = prev.sub(corner).normalised();
    const nextDir = next.sub(corner).normalised();
    const start = corner.add(prevDir.mul(distance));
    const end = corner.add(nextDir.mul(distance));
    const outwardSign = extrudeVertexOptions.outwards ? -1 : 1;

    if (extrudeVertexOptions.type === 'Square') {
      const threshold = Math.max(0, Number(extrudeVertexOptions.squareThreshold) || 0) * distance;
      const bisector = prevDir.add(nextDir).normalised().mul(outwardSign || 1);
      const point = corner.add(bisector.mul(threshold || distance));
      return [start, point, end];
    }

    const startAngle = Math.atan2(start.y - corner.y, start.x - corner.x);
    const endAngle = Math.atan2(end.y - corner.y, end.x - corner.x);
    const ccwArc = extrudeVertexOptions.outwards === polygonIsCcw;
    let delta = endAngle - startAngle;
    if (ccwArc && delta < 0) delta += Math.PI * 2;
    if (!ccwArc && delta > 0) delta -= Math.PI * 2;

    return [...Array(segments + 1)].map((_, i) => {
      const angle = startAngle + delta * (i / segments);
      return new Vector2(corner.x + Math.cos(angle) * distance, corner.y + Math.sin(angle) * distance);
    });
  }

  function buildExtrudeVertexPreviewMesh() {
    if (!selectedVertices.length) return null;
    const selected = new Set(selectedVertices);
    const next = new Mesh();

    for (const polygon of mesh.polygons.values()) {
      const ids = polygon.vertexIndices();
      const positions = [];
      const polygonIsCcw = polygon.signedArea(mesh) > 0;
      for (let i = 0; i < ids.length; ++i) {
        const vertexId = ids[i];
        const prevId = ids[(i + ids.length - 1) % ids.length];
        const nextId = ids[(i + 1) % ids.length];
        const corner = mesh.getVertex(vertexId).position;

        if (selected.has(vertexId)) {
          positions.push(...extrudeVertexPoints(
            mesh.getVertex(prevId).position,
            corner,
            mesh.getVertex(nextId).position,
            polygonIsCcw,
          ));
        } else {
          positions.push(corner.clone());
        }
      }
      if (positions.length >= 3) next.addPolygon(positions);
    }

    return next;
  }

  function extrudeSelectedVertices() {
    try {
      const next = buildExtrudeVertexPreviewMesh();
      if (!next) return;
      commitMesh(next);
      setSelectedVertices([]);
      setExtrudeVertexDialogOpen(false);
      setExtrudeVertexPreviewEnabled(false);
      setExtrudeVertexDialogDrag(null);
    } catch (error) {
      console.error('Failed to extrude selected vertices', error);
    }
  }

  function openBridgeDialog() {
    setBridgeDialogOpen(true);
    setBridgeDialogPosition((position) => position ?? { x: Math.max(16, window.innerWidth / 2 - 180), y: Math.max(16, window.innerHeight / 2 - 220) });
  }

  function openSplitDialog() {
    setSplitDialogOpen(true);
    setSplitDialogPosition((position) => position ?? { x: Math.max(16, window.innerWidth / 2 - 180), y: Math.max(16, window.innerHeight / 2 - 180) });
  }

  function openChamferDialog() {
    setChamferDialogOpen(true);
    setChamferDialogPosition((position) => position ?? { x: Math.max(16, window.innerWidth / 2 - 180), y: Math.max(16, window.innerHeight / 2 - 180) });
  }

  function openExtrudeVertexDialog() {
    setExtrudeVertexDialogOpen(true);
    setExtrudeVertexDialogPosition((position) => position ?? { x: Math.max(16, window.innerWidth / 2 - 180), y: Math.max(16, window.innerHeight / 2 - 180) });
  }

  function selectionModeFromEvent(event) {
    if (event.shiftKey) return 'add';
    if (event.ctrlKey || event.metaKey) return 'toggle';
    return 'replace';
  }

  function dragDistance(event, pending = pendingSelection) {
    if (!pending) return 0;
    return Math.hypot(event.clientX - pending.clientX, event.clientY - pending.clientY);
  }

  function clearSelection() {
    setSelectedVertices([]);
    setSelectedEdges([]);
    setSelectedPolygons([]);
  }

  function finishInsertPolygon() {
    if (insertPoints.length < 3) return;
    const next = mesh.clone();
    const polygonId = next.addPolygon(insertPoints.map((point) => point.clone()));
    commitMesh(next);
    setSelectedPolygons([polygonId]);
    setInsertPoints([]);
    setInsertCursor(null);
    setInsertMode(false);
  }

  function handleInsertPoint(point) {
    if (insertPoints.length >= 3 && point.distanceTo(insertPoints[0]) <= Math.max(vertexSize * 1.75, gridSize * 0.25)) {
      finishInsertPolygon();
      return;
    }
    setInsertPoints((points) => [...points, point.clone()]);
    setInsertCursor(point.clone());
  }

  function onCanvasPointerDownCapture(event) {
    if (!insertMode || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    handleInsertPoint(svgPoint(event));
  }

  function onCanvasPointerDown(event) {
    if (event.button !== 0 || insertMode) return;
    if (event.target !== event.currentTarget && event.target.tagName !== 'rect') return;
    clearSelection();
  }

  function onPointerMove(event) {
    if (insertMode) {
      setInsertCursor(svgPoint(event));
    }


    if (pendingSelection && dragDistance(event) > CLICK_DRAG_THRESHOLD) {
      const point = svgPoint(event);
      event.preventDefault();

      if (pendingSelection.type === 'vertex') {
        if (pendingSelection.mode === 'add') {
          setSplitDrag({ fromVertex: pendingSelection.id, cursor: point, hoverVertex: null, hoverEdge: null });
        } else if (pendingSelection.mode === 'replace') {
          const vertexIds = selectedVertices.includes(pendingSelection.id) ? selectedVertices : [pendingSelection.id];
          pushUndo();
          setSelectedVertices(vertexIds);
          setSelectedEdges([]);
          setSelectedPolygons([]);
          setDragVertices({ vertexIds, startPoint: pendingSelection.startPoint, baseMesh: mesh.clone() });
        }
      } else if (pendingSelection.type === 'edge') {
        if (pendingSelection.mode === 'add') {
          const vertexId = splitEdgeAt(pendingSelection.id, point);
          if (vertexId != null) {
            setSelectedVertices([vertexId]);
            setSelectedEdges([]);
            setDragVertex(vertexId);
          }
        } else if (pendingSelection.mode === 'toggle') {
          const edgeIds = selectedEdges.length > 1 && selectedEdges.includes(pendingSelection.id) ? selectedEdges : [pendingSelection.id];
          pushUndo();
          setSelectedVertices([]);
          setSelectedEdges([]);
          setSelectedPolygons([]);
          setExtrudeEdge({ edgeIds, startPoint: pendingSelection.startPoint, baseMesh: mesh.clone() });
        } else if (selectedEdges.includes(pendingSelection.id)) {
          pushUndo();
          setSelectedVertices([]);
          setSelectedPolygons([]);
          setDragEdges({ edgeIds: selectedEdges, startPoint: pendingSelection.startPoint, baseMesh: mesh.clone() });
        }
      } else if (pendingSelection.type === 'polygon') {
        const polygonIdsToMove = selectedPolygons.includes(pendingSelection.id) ? selectedPolygons : [pendingSelection.id];
        pushUndo();
        setSelectedVertices([]);
        setSelectedEdges([]);
        setSelectedPolygons(polygonIdsToMove);
        setDragPolygons({ polygonIds: polygonIdsToMove, startPoint: pendingSelection.startPoint, baseMesh: mesh.clone() });
      }

      setPendingSelection(null);
      return;
    }

    if (splitDrag) {
      event.preventDefault();
      const cursor = svgPoint(event);
      const hoverVertex = findVertexAt(cursor, splitDrag.fromVertex);
      const crossedEdge = hoverVertex == null ? findFirstCrossedEdge(splitDrag.fromVertex, cursor) : null;
      const hoverEdge = hoverVertex == null ? (crossedEdge?.edgeId ?? findEdgeAt(cursor, splitDrag.fromVertex)) : null;
      setSplitDrag({ ...splitDrag, cursor, hoverVertex, hoverEdge });
      return;
    }

    if (extrudeEdge) {
      event.preventDefault();
      const point = svgPoint(event);
      const delta = point.sub(extrudeEdge.startPoint);
      setMesh(extrudeEdgesFromBase(extrudeEdge.baseMesh, extrudeEdge.edgeIds, delta));
      return;
    }

    if (dragVertices) {
      event.preventDefault();
      const point = svgPoint(event);
      const delta = point.sub(dragVertices.startPoint);
      setMesh(moveVerticesFromBase(dragVertices.baseMesh, dragVertices.vertexIds, delta));
      return;
    }

    if (dragEdges) {
      event.preventDefault();
      const point = svgPoint(event);
      const delta = point.sub(dragEdges.startPoint);
      setMesh(moveEdgesFromBase(dragEdges.baseMesh, dragEdges.edgeIds, delta));
      return;
    }

    if (dragPolygons) {
      event.preventDefault();
      const point = svgPoint(event);
      const delta = point.sub(dragPolygons.startPoint);
      setMesh(movePolygonsFromBase(dragPolygons.baseMesh, dragPolygons.polygonIds, delta));
      return;
    }

    if (dragVertex == null) return;
    event.preventDefault();
    updateVertex(dragVertex, svgPoint(event));
  }

  function onPointerUp(event) {
    if (pendingSelection) {
      if (pendingSelection.type === 'vertex') selectVertex(pendingSelection.id, pendingSelection.mode);
      else if (pendingSelection.type === 'edge') selectEdge(pendingSelection.id, pendingSelection.mode);
      else if (pendingSelection.type === 'polygon') selectPolygon(pendingSelection.id, pendingSelection.mode);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      setPendingSelection(null);
      return;
    }

    if (splitDrag) {
      const point = svgPoint(event);
      const targetVertex = findVertexAt(point, splitDrag.fromVertex);
      if (targetVertex != null) {
        cutDraggedLine(splitDrag.fromVertex, point, { targetVertex });
      } else {
        const targetEdge = findEdgeAt(point, splitDrag.fromVertex);
        const crossedEdge = findFirstCrossedEdge(splitDrag.fromVertex, point);
        if (targetEdge != null || crossedEdge != null) {
          cutDraggedLine(splitDrag.fromVertex, point, { targetEdge: targetEdge ?? crossedEdge.edgeId });
        }
      }
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      setSplitDrag(null);
      return;
    }

    if (dragVertex == null && !dragVertices && !extrudeEdge && !dragEdges && !dragPolygons) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDragVertex(null);
    setDragVertices(null);
    setDragEdges(null);
    setDragPolygons(null);
    setExtrudeEdge(null);
  }

  async function exportJson() {
    const json = JSON.stringify(SerializerMeshChunk.toJSON(mesh), null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    try {
      if ('showSaveFilePicker' in window) {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'mesh.json',
          types: [{ description: 'JSON files', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.error('Failed to export mesh JSON', error);
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mesh.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  function importJson() {
    importInputRef.current?.click();
  }

  async function onImportFile(event) {
    const [file] = event.target.files ?? [];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const next = SerializerMeshChunk.fromJSON(JSON.parse(text));
      commitMesh(next);
      clearInteractionState();
    } catch (error) {
      console.error('Failed to import mesh JSON', error);
    }
  }

  function reset() {
    commitMesh(createSquareMesh().mesh);
    setSelectedVertices([]);
    setSelectedEdges([]);
    setSelectedPolygons([]);
    setDragVertex(null);
    setDragVertices(null);
    setDragEdges(null);
    setDragPolygons(null);
    setExtrudeEdge(null);
    setSplitDrag(null);
  }

  return (
    <main className="app">
      <section className="panel">
        <div className="button-row">
          <button type="button" onClick={reset}>New mesh</button>
          <button type="button" onClick={() => setHelpDialogOpen(true)}>Help</button>
        </div>
        <div className="button-row">
          <button type="button" onClick={exportJson}>Export JSON</button>
          <button type="button" onClick={importJson}>Import JSON</button>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="file-input"
          onChange={onImportFile}
        />
        <div className="button-row">
          <button type="button" onClick={undo} disabled={!undoStack.length}>Undo</button>
          <button type="button" onClick={redo} disabled={!redoStack.length}>Redo</button>
        </div>
        <button
          type="button"
          className={insertMode ? 'mode-button active' : 'mode-button'}
          onClick={() => {
            setInsertMode((enabled) => !enabled);
            setInsertPoints([]);
            setInsertCursor(null);
            clearSelection();
          }}
        >
          Insert mode {insertMode ? 'On' : 'Off'}
        </button>
        <h2 className="tool-header">Vertex tools</h2>
        <div className="button-row">
          <button type="button" onClick={openChamferDialog} disabled={!selectedVertices.length}>Chamfer</button>
          <button type="button" onClick={openExtrudeVertexDialog} disabled={!selectedVertices.length}>Extrude</button>
        </div>
        <h2 className="tool-header">Edge tools</h2>
        <div className="button-row">
          <button type="button" onClick={openBridgeDialog} disabled={selectedEdgeGroups.length !== 2}>Bridge</button>
          <button type="button" onClick={openSplitDialog} disabled={!selectedEdges.length}>Split</button>
        </div>
        <h2 className="tool-header">Polygon tools</h2>
        <div className="button-row">
          <button type="button" onClick={convertSelectedPolygonsToHoles} disabled={!canConvertSelectedPolygonsToHoles}>Convert to hole</button>
          <button type="button" onClick={removeHolesFromSelectedPolygons} disabled={!canRemoveHolesFromSelectedPolygons}>Remove holes</button>
        </div>

        <details className="rollup" open>
          <summary>View Settings</summary>
          <div className="controls">
            <label>
              Grid size
            <select value={gridSize} onChange={(event) => setGridSize(Number(event.target.value))}>
              <option value="8">8</option>
              <option value="16">16</option>
              <option value="32">32</option>
              <option value="64">64</option>
            </select>
          </label>

          <label className="checkbox-control">
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(event) => setSnapToGrid(event.target.checked)}
            />
            Snap to grid
          </label>

          <label className="checkbox-control">
            <input
              type="checkbox"
              checked={showVertices}
              onChange={(event) => setShowVertices(event.target.checked)}
            />
            Show vertices
          </label>

          <label>
            Vertex size
            <input
              type="number"
              min="2"
              max="32"
              step="1"
              value={vertexSize}
              onChange={(event) => setVertexSize(Math.max(2, Number(event.target.value) || DEFAULT_VERTEX_SIZE))}
            />
          </label>

          <label className="checkbox-control">
            <input
              type="checkbox"
              checked={showVertexLabels}
              onChange={(event) => setShowVertexLabels(event.target.checked)}
            />
            Show vertex labels
          </label>

          <label className="checkbox-control">
            <input
              type="checkbox"
              checked={showTriangulation}
              onChange={(event) => setShowTriangulation(event.target.checked)}
            />
            Show triangulation
            </label>
          </div>
        </details>

        <details className="rollup">
          <summary>Mesh stats</summary>
          <dl>
            <dt>Vertices</dt><dd>{mesh.getNumVertices()}</dd>
            <dt>Edges</dt><dd>{mesh.getNumEdges()}</dd>
            <dt>Polygons</dt><dd>{mesh.getNumPolygons()}</dd>
            <dt>Selected vertices</dt><dd>{selectedVertices.length}</dd>
            <dt>Selected edges</dt><dd>{selectedEdges.length}</dd>
            <dt>Selected polygons</dt><dd>{selectedPolygons.length}</dd>
            <dt>Edge groups</dt><dd>{selectedEdgeGroups.length}</dd>
            <dt>Triangles</dt><dd>{triangles.length}</dd>
          </dl>
          <ol className="coords">
            {vertices.map(({ id, position }) => (
              <li key={id}>v{id}: {position.x.toFixed(1)}, {position.y.toFixed(1)}</li>
            ))}
          </ol>
        </details>
      </section>

      {helpDialogOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="dialog help-dialog"
            style={{ left: Math.max(16, window.innerWidth / 2 - 220), top: Math.max(16, window.innerHeight / 2 - 160) }}
          >
            <h2>Help</h2>
            <p>Click to replace selection, Shift-click to add, Ctrl-click to toggle. Drag selected vertices, edges, or polygons to move them. Press I to toggle Insert mode; click points and click the first point again to create a polygon.</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setHelpDialogOpen(false)}>Close</button>
            </div>
          </section>
        </div>
      )}

      {bridgeDialogOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onPointerMove={(event) => {
            if (!bridgeDialogDrag) return;
            event.preventDefault();
            setBridgeDialogPosition({
              x: event.clientX - bridgeDialogDrag.offsetX,
              y: event.clientY - bridgeDialogDrag.offsetY,
            });
          }}
          onPointerUp={() => setBridgeDialogDrag(null)}
          onPointerCancel={() => setBridgeDialogDrag(null)}
        >
          <form
            className="dialog"
            style={bridgeDialogPosition ? { left: bridgeDialogPosition.x, top: bridgeDialogPosition.y } : undefined}
            onSubmit={(event) => {
              event.preventDefault();
              bridgeSelectedEdges();
            }}
          >
            <h2
              className="dialog-title"
              onPointerDown={(event) => {
                const rect = event.currentTarget.closest('.dialog').getBoundingClientRect();
                event.currentTarget.setPointerCapture(event.pointerId);
                setBridgeDialogDrag({ offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top });
              }}
            >Bridge edge groups</h2>
            <p>Create bridge polygons between the two selected disjoint edge groups. The groups must contain the same number of edges.</p>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={bridgePreviewEnabled}
                onChange={(event) => setBridgePreviewEnabled(event.target.checked)}
              />
              Preview on canvas
            </label>
            <label>
              Bridge type
              <select
                value={bridgeOptions.type}
                onChange={(event) => setBridgeOptions((options) => ({ ...options, type: event.target.value }))}
              >
                <option value="Straight">Straight</option>
                <option value="Curved">Curved</option>
              </select>
            </label>
            <label>
              Squeeze type
              <select
                value={bridgeOptions.squeezeType}
                onChange={(event) => setBridgeOptions((options) => ({ ...options, squeezeType: event.target.value }))}
              >
                <option value="None">None</option>
                <option value="Straight">Straight</option>
                <option value="Curved">Curved</option>
              </select>
            </label>
            <label>
              Squeeze amount
              <input
                type="number"
                step="0.01"
                value={bridgeOptions.squeezeAmount}
                onChange={(event) => setBridgeOptions((options) => ({ ...options, squeezeAmount: Number(event.target.value) }))}
              />
            </label>
            <label>
              Steps
              <input
                type="number"
                min="1"
                step="1"
                value={bridgeOptions.steps}
                onChange={(event) => setBridgeOptions((options) => ({ ...options, steps: Math.max(1, Math.trunc(Number(event.target.value) || 1)) }))}
              />
            </label>
            <label>
              Tightness
              <input
                type="number"
                step="0.000001"
                value={bridgeOptions.tightness}
                onChange={(event) => setBridgeOptions((options) => ({ ...options, tightness: Number(event.target.value) }))}
              />
            </label>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={bridgeOptions.merge}
                onChange={(event) => setBridgeOptions((options) => ({ ...options, merge: event.target.checked }))}
              />
              Merge generated topology
            </label>
            <div className="dialog-actions">
              <button type="button" onClick={() => {
                setBridgeDialogOpen(false);
                setBridgePreviewEnabled(false);
              }}>Cancel</button>
              <button type="submit" disabled={selectedEdgeGroups.length !== 2}>OK</button>
            </div>
          </form>
        </div>
      )}

      {splitDialogOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onPointerMove={(event) => {
            if (!splitDialogDrag) return;
            event.preventDefault();
            setSplitDialogPosition({
              x: event.clientX - splitDialogDrag.offsetX,
              y: event.clientY - splitDialogDrag.offsetY,
            });
          }}
          onPointerUp={() => setSplitDialogDrag(null)}
          onPointerCancel={() => setSplitDialogDrag(null)}
        >
          <form
            className="dialog split-dialog"
            style={splitDialogPosition ? { left: splitDialogPosition.x, top: splitDialogPosition.y } : undefined}
            onSubmit={(event) => {
              event.preventDefault();
              splitSelectedEdges();
            }}
          >
            <h2
              className="dialog-title"
              onPointerDown={(event) => {
                const rect = event.currentTarget.closest('.dialog').getBoundingClientRect();
                event.currentTarget.setPointerCapture(event.pointerId);
                setSplitDialogDrag({ offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top });
              }}
            >Split selected edges</h2>
            <p>Split each selected edge. Currently selected: {selectedEdges.length}</p>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={splitPreviewEnabled}
                onChange={(event) => setSplitPreviewEnabled(event.target.checked)}
              />
              Preview on canvas
            </label>
            <label>
              Split mode
              <select
                value={splitOptions.mode}
                onChange={(event) => setSplitOptions((options) => ({ ...options, mode: event.target.value }))}
              >
                <option value="count">Equal segments</option>
                <option value="amount">Single split amount</option>
              </select>
            </label>
            {splitOptions.mode === 'count' ? (
              <label>
                Edge count
                <input
                  type="number"
                  min="2"
                  step="1"
                  value={splitOptions.edgeCount}
                  onChange={(event) => setSplitOptions((options) => ({ ...options, edgeCount: Math.max(2, Math.trunc(Number(event.target.value) || 2)) }))}
                />
              </label>
            ) : (
              <label>
                Amount along edge
                <input
                  type="number"
                  min="0.001"
                  max="0.999"
                  step="0.01"
                  value={splitOptions.amount}
                  onChange={(event) => setSplitOptions((options) => ({ ...options, amount: Math.max(0.001, Math.min(0.999, Number(event.target.value) || 0.5)) }))}
                />
              </label>
            )}
            <div className="dialog-actions">
              <button type="button" onClick={() => {
                setSplitDialogOpen(false);
                setSplitPreviewEnabled(false);
                setSplitDialogDrag(null);
              }}>Cancel</button>
              <button type="submit" disabled={!selectedEdges.length}>OK</button>
            </div>
          </form>
        </div>
      )}

      {chamferDialogOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onPointerMove={(event) => {
            if (!chamferDialogDrag) return;
            event.preventDefault();
            setChamferDialogPosition({
              x: event.clientX - chamferDialogDrag.offsetX,
              y: event.clientY - chamferDialogDrag.offsetY,
            });
          }}
          onPointerUp={() => setChamferDialogDrag(null)}
          onPointerCancel={() => setChamferDialogDrag(null)}
        >
          <form
            className="dialog chamfer-dialog"
            style={chamferDialogPosition ? { left: chamferDialogPosition.x, top: chamferDialogPosition.y } : undefined}
            onSubmit={(event) => {
              event.preventDefault();
              chamferSelectedVertices();
            }}
          >
            <h2
              className="dialog-title"
              onPointerDown={(event) => {
                const rect = event.currentTarget.closest('.dialog').getBoundingClientRect();
                event.currentTarget.setPointerCapture(event.pointerId);
                setChamferDialogDrag({ offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top });
              }}
            >Chamfer selected vertices</h2>
            <p>Chamfer each selected vertex. Currently selected: {selectedVertices.length}</p>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={chamferPreviewEnabled}
                onChange={(event) => setChamferPreviewEnabled(event.target.checked)}
              />
              Preview on canvas
            </label>
            <label>
              Distance
              <input
                type="number"
                min="0"
                step="1"
                value={chamferOptions.distance}
                onChange={(event) => setChamferOptions((options) => ({ ...options, distance: Math.max(0, Number(event.target.value) || 0) }))}
              />
            </label>
            <label>
              Tightness
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={chamferOptions.tightness}
                onChange={(event) => setChamferOptions((options) => ({ ...options, tightness: Math.max(0, Math.min(1, Number(event.target.value) || 0)) }))}
              />
            </label>
            <label>
              Segments
              <input
                type="number"
                min="1"
                step="1"
                value={chamferOptions.segments}
                onChange={(event) => setChamferOptions((options) => ({ ...options, segments: Math.max(1, Math.trunc(Number(event.target.value) || 1)) }))}
              />
            </label>
            <div className="dialog-actions">
              <button type="button" onClick={() => {
                setChamferDialogOpen(false);
                setChamferPreviewEnabled(false);
                setChamferDialogDrag(null);
              }}>Cancel</button>
              <button type="submit" disabled={!selectedVertices.length}>OK</button>
            </div>
          </form>
        </div>
      )}

      {extrudeVertexDialogOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onPointerMove={(event) => {
            if (!extrudeVertexDialogDrag) return;
            event.preventDefault();
            setExtrudeVertexDialogPosition({
              x: event.clientX - extrudeVertexDialogDrag.offsetX,
              y: event.clientY - extrudeVertexDialogDrag.offsetY,
            });
          }}
          onPointerUp={() => setExtrudeVertexDialogDrag(null)}
          onPointerCancel={() => setExtrudeVertexDialogDrag(null)}
        >
          <form
            className="dialog extrude-vertex-dialog"
            style={extrudeVertexDialogPosition ? { left: extrudeVertexDialogPosition.x, top: extrudeVertexDialogPosition.y } : undefined}
            onSubmit={(event) => {
              event.preventDefault();
              extrudeSelectedVertices();
            }}
          >
            <h2
              className="dialog-title"
              onPointerDown={(event) => {
                const rect = event.currentTarget.closest('.dialog').getBoundingClientRect();
                event.currentTarget.setPointerCapture(event.pointerId);
                setExtrudeVertexDialogDrag({ offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top });
              }}
            >Extrude selected vertices</h2>
            <p>Extrude each selected vertex. Currently selected: {selectedVertices.length}</p>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={extrudeVertexPreviewEnabled}
                onChange={(event) => setExtrudeVertexPreviewEnabled(event.target.checked)}
              />
              Preview on canvas
            </label>
            <label>
              Type
              <select
                value={extrudeVertexOptions.type}
                onChange={(event) => setExtrudeVertexOptions((options) => ({ ...options, type: event.target.value }))}
              >
                <option value="Round">Round</option>
                <option value="Square">Square</option>
              </select>
            </label>
            <label>
              Distance
              <input
                type="number"
                min="0"
                step="1"
                value={extrudeVertexOptions.distance}
                onChange={(event) => setExtrudeVertexOptions((options) => ({ ...options, distance: Math.max(0, Number(event.target.value) || 0) }))}
              />
            </label>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={extrudeVertexOptions.outwards}
                onChange={(event) => setExtrudeVertexOptions((options) => ({ ...options, outwards: event.target.checked }))}
              />
              Outwards
            </label>
            {extrudeVertexOptions.type === 'Round' ? (
              <label>
                Segments
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={extrudeVertexOptions.segments}
                  onChange={(event) => setExtrudeVertexOptions((options) => ({ ...options, segments: Math.max(1, Math.trunc(Number(event.target.value) || 1)) }))}
                />
              </label>
            ) : (
              <label>
                Square threshold
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={extrudeVertexOptions.squareThreshold}
                  onChange={(event) => setExtrudeVertexOptions((options) => ({ ...options, squareThreshold: Math.max(0, Number(event.target.value) || 0) }))}
                />
              </label>
            )}
            <div className="dialog-actions">
              <button type="button" onClick={() => {
                setExtrudeVertexDialogOpen(false);
                setExtrudeVertexPreviewEnabled(false);
                setExtrudeVertexDialogDrag(null);
              }}>Cancel</button>
              <button type="submit" disabled={!selectedVertices.length}>OK</button>
            </div>
          </form>
        </div>
      )}

      <svg
        className="canvas"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        onPointerDownCapture={onCanvasPointerDownCapture}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#283044" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill="url(#grid)" />
        <line x1={viewBox.x} y1="0" x2={viewBox.x + viewBox.width} y2="0" className="axis x-axis" />
        <line x1="0" y1={viewBox.y} x2="0" y2={viewBox.y + viewBox.height} className="axis y-axis" />
        <text x={viewBox.x + 12} y="-10" className="axis-label">X</text>
        <text x="10" y={viewBox.y + 22} className="axis-label">Y</text>
        <text x="10" y="-10" className="origin-label">0,0</text>

        {insertMode && insertPoints.length > 0 && (
          <>
            <polyline
              points={insertPoints.map((position) => `${position.x},${-position.y}`).join(' ')}
              className="insert-preview"
            />
            {insertCursor && (
              <line
                x1={insertPoints[insertPoints.length - 1].x}
                y1={-insertPoints[insertPoints.length - 1].y}
                x2={insertCursor.x}
                y2={-insertCursor.y}
                className="insert-preview pending"
              />
            )}
            {insertPoints.map((position, index) => (
              <circle
                key={index}
                cx={position.x}
                cy={-position.y}
                r={index === 0 ? vertexSize * 0.75 : vertexSize * 0.55}
                className={index === 0 ? 'insert-point first' : 'insert-point'}
              />
            ))}
          </>
        )}

        {showTriangulation && triangles.map(([aId, bId, cId], i) => {
          const a = renderMesh.getVertex(aId).position;
          const b = renderMesh.getVertex(bId).position;
          const c = renderMesh.getVertex(cId).position;
          return (
            <polygon
              key={i}
              points={`${a.x},${-a.y} ${b.x},${-b.y} ${c.x},${-c.y}`}
              className="triangle"
            />
          );
        })}

        {polygonPointSets.map(({ id, hole, points }) => (
          <polygon
            key={id}
            points={points.map((position) => `${position.x},${-position.y}`).join(' ')}
            className={`${hole ? 'mesh-fill hole' : 'mesh-fill'}${selectedPolygons.includes(id) ? ' selected' : ''}`}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.ownerSVGElement.setPointerCapture(event.pointerId);
              setPendingSelection({
                type: 'polygon',
                id,
                mode: selectionModeFromEvent(event),
                startPoint: svgPoint(event),
                clientX: event.clientX,
                clientY: event.clientY,
              });
            }}
          />
        ))}

        {splitDrag && (
          <line
            x1={mesh.getVertex(splitDrag.fromVertex).position.x}
            y1={-mesh.getVertex(splitDrag.fromVertex).position.y}
            x2={splitDrag.cursor.x}
            y2={-splitDrag.cursor.y}
            className="split-preview"
          />
        )}

        {edgePoints.map(({ id, a, b }) => (
          <line
            key={id}
            x1={a.x}
            y1={-a.y}
            x2={b.x}
            y2={-b.y}
            className={splitDrag?.hoverEdge === id ? 'edge hover-target' : selectedEdges.includes(id) ? 'edge selected' : 'edge'}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.ownerSVGElement.setPointerCapture(event.pointerId);
              setPendingSelection({
                type: 'edge',
                id,
                mode: selectionModeFromEvent(event),
                startPoint: svgPoint(event),
                clientX: event.clientX,
                clientY: event.clientY,
              });
            }}
          />
        ))}

        {showVertices && vertices.map(({ id, position }) => (
          <g key={id}>
            <circle
              cx={position.x}
              cy={-position.y}
              r={vertexSize}
              className={splitDrag?.hoverVertex === id ? 'handle hover-target' : dragVertex === id ? 'handle active' : selectedVertices.includes(id) ? 'handle selected' : 'handle'}
              onPointerDown={(event) => {
                event.currentTarget.ownerSVGElement.setPointerCapture(event.pointerId);
                event.preventDefault();
                event.stopPropagation();
                setPendingSelection({
                  type: 'vertex',
                  id,
                  mode: selectionModeFromEvent(event),
                  startPoint: svgPoint(event),
                  clientX: event.clientX,
                  clientY: event.clientY,
                });
              }}
            />
            {showVertexLabels && (
              <text x={position.x + vertexSize + 4} y={-position.y - vertexSize - 4} className="label">v{id}</text>
            )}
          </g>
        ))}
      </svg>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<SquareMeshEditor />);
