/**
 * MFD Scope — Client-side application
 * Interactive diagrams, SSE live-reload, keyboard navigation, command palette
 */

// ===== State =====
let currentMermaidSource = '';
let commandPaletteItems = [];
let commandPaletteLoaded = false;
/** @type {Map<HTMLElement, DiagramCanvas>} */
const canvasInstances = new Map();
/** @type {Map<HTMLElement, EntityGraph>} */
const entityGraphInstances = new Map();
let activeTab = null;
let focusedListIdx = -1;

// ===== Position Persistence (localStorage) =====

function _posKey(graphType) {
  return 'scope-positions:' + window.location.pathname + ':' + graphType;
}

function savePositions(graphType, nodePositions) {
  try {
    const obj = {};
    for (const [id, pos] of nodePositions) {
      obj[id] = { x: Math.round(pos.x), y: Math.round(pos.y) };
    }
    localStorage.setItem(_posKey(graphType), JSON.stringify(obj));
  } catch (_) { /* quota exceeded — ignore */ }
}

function loadPositions(graphType) {
  try {
    const raw = localStorage.getItem(_posKey(graphType));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) { return null; }
}

// ===== Phase 1: DiagramCanvas — Zoom & Pan =====

class DiagramCanvas {
  constructor(container) {
    this.container = container;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this._startX = 0;
    this._startY = 0;
    this._startPanX = 0;
    this._startPanY = 0;
    this._wasPanning = false;
    this._moveDistance = 0;

    this._onWheel = this._onWheel.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onDblClick = this._onDblClick.bind(this);

    container.addEventListener('wheel', this._onWheel, { passive: false });
    container.addEventListener('mousedown', this._onMouseDown);
    container.addEventListener('dblclick', this._onDblClick);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);

    this._indicator = container.querySelector('.scope-zoom-indicator');
    this.fitToViewport();
  }

  _onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = this.container.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    // Zoom toward cursor point
    const newZoom = Math.min(5, Math.max(0.1, this.zoom * factor));
    const scale = newZoom / this.zoom;
    this.panX = cursorX - scale * (cursorX - this.panX);
    this.panY = cursorY - scale * (cursorY - this.panY);
    this.zoom = newZoom;
    this._apply();
  }

  _onMouseDown(e) {
    if (e.button !== 0) return;
    this.isPanning = true;
    this._wasPanning = false;
    this._moveDistance = 0;
    this._startX = e.clientX;
    this._startY = e.clientY;
    this._startPanX = this.panX;
    this._startPanY = this.panY;
    this.container.classList.add('panning');
  }

  _onMouseMove(e) {
    if (!this.isPanning) return;
    const dx = e.clientX - this._startX;
    const dy = e.clientY - this._startY;
    this._moveDistance = Math.sqrt(dx * dx + dy * dy);
    if (this._moveDistance > 3) this._wasPanning = true;
    this.panX = this._startPanX + dx;
    this.panY = this._startPanY + dy;
    this._apply();
  }

  _onMouseUp() {
    if (this.isPanning) {
      this.isPanning = false;
      this.container.classList.remove('panning');
    }
  }

  _onDblClick() {
    this.fitToViewport();
  }

  get wasPanning() {
    return this._wasPanning;
  }

  fitToViewport() {
    const svg = this.container.querySelector('svg');
    if (!svg) return;
    const containerRect = this.container.getBoundingClientRect();
    const svgW = svg.getBBox?.()?.width || svg.viewBox?.baseVal?.width || svg.clientWidth || 800;
    const svgH = svg.getBBox?.()?.height || svg.viewBox?.baseVal?.height || svg.clientHeight || 600;

    const padFactor = 0.9;
    const scaleX = (containerRect.width * padFactor) / svgW;
    const scaleY = (containerRect.height * padFactor) / svgH;
    this.zoom = Math.min(scaleX, scaleY, 2);

    this.panX = (containerRect.width - svgW * this.zoom) / 2;
    this.panY = (containerRect.height - svgH * this.zoom) / 2;
    this._apply();
  }

  zoomTo(factor) {
    if (factor === 0) {
      this.fitToViewport();
      return;
    }
    const rect = this.container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newZoom = Math.min(5, Math.max(0.1, this.zoom * factor));
    const scale = newZoom / this.zoom;
    this.panX = cx - scale * (cx - this.panX);
    this.panY = cy - scale * (cy - this.panY);
    this.zoom = newZoom;
    this._apply();
  }

  _apply() {
    const svg = this.container.querySelector('svg');
    if (svg) {
      svg.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
      svg.style.transformOrigin = '0 0';
    }
    if (this._indicator) {
      this._indicator.textContent = Math.round(this.zoom * 100) + '%';
    }
  }

  destroy() {
    this.container.removeEventListener('wheel', this._onWheel);
    this.container.removeEventListener('mousedown', this._onMouseDown);
    this.container.removeEventListener('dblclick', this._onDblClick);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    canvasInstances.delete(this.container);
  }
}

// ===== BaseGraph — Shared interactive graph infrastructure =====

class BaseGraph {
  /**
   * @param {HTMLElement} container — div with data-graph
   * @param {string} graphType — 'entity'|'flow'|'event'|'component' (localStorage key)
   * @param {string} svgSelector — SVG edges element selector
   * @param {string} worldSelector — world div selector
   * @param {string} nodeSelector — CSS selector for drag-target nodes
   * @param {string} nodeIdAttr — dataset attribute name for node ID
   */
  constructor(container, graphType, svgSelector, worldSelector, nodeSelector, nodeIdAttr) {
    this.container = container;
    this.graphType = graphType;
    this.nodeSelector = nodeSelector;
    this.nodeIdAttr = nodeIdAttr;
    this.data = this._parseData(container);
    this.nodePositions = new Map();
    this.nodeElements = new Map();
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.draggingNode = null;
    this.isPanning = false;
    this._startX = 0;
    this._startY = 0;
    this._startPanX = 0;
    this._startPanY = 0;
    this._dragOffsetX = 0;
    this._dragOffsetY = 0;
    this._wasDragging = false;

    this.svgEl = container.querySelector(svgSelector);
    this.worldEl = container.querySelector(worldSelector);

    this._bindEvents();
    this.renderNodes();
    this.layout();
    this._restorePositions();
    this.renderEdges();
    this.fitToViewport();
  }

  // --- Abstract methods (subclasses MUST implement) ---
  renderNodes() { throw new Error('renderNodes() not implemented'); }
  layout() { throw new Error('layout() not implemented'); }

  // --- Default implementation (subclasses MAY override) ---
  renderEdges() {}

  // --- Concrete methods (inherited) ---

  _parseData(container) {
    return JSON.parse(
      container.dataset.graph
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
    );
  }

  _bindEvents() {
    this._onWheel = this._onWheel.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onDblClick = this._onDblClick.bind(this);

    this.container.addEventListener('wheel', this._onWheel, { passive: false });
    this.container.addEventListener('mousedown', this._onMouseDown);
    this.container.addEventListener('dblclick', this._onDblClick);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
  }

  _applyTransform() {
    this.worldEl.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    this.svgEl.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    this.svgEl.style.transformOrigin = '0 0';
  }

  _onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = this.container.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const newZoom = Math.min(5, Math.max(0.1, this.zoom * factor));
    const scale = newZoom / this.zoom;
    this.panX = cursorX - scale * (cursorX - this.panX);
    this.panY = cursorY - scale * (cursorY - this.panY);
    this.zoom = newZoom;
    this._applyTransform();
  }

  _onMouseDown(e) {
    if (e.button !== 0) return;

    const nodeEl = e.target.closest(this.nodeSelector);
    if (nodeEl) {
      this.draggingNode = nodeEl;
      this._wasDragging = false;
      const id = nodeEl.dataset[this.nodeIdAttr];
      const pos = this.nodePositions.get(id);
      if (!pos) return;
      const rect = this.container.getBoundingClientRect();
      this._dragOffsetX = (e.clientX - rect.left - this.panX) / this.zoom - pos.x;
      this._dragOffsetY = (e.clientY - rect.top - this.panY) / this.zoom - pos.y;
      this._startX = e.clientX;
      this._startY = e.clientY;
      nodeEl.classList.add('dragging');
      return;
    }

    this.isPanning = true;
    this._wasDragging = false;
    this._startX = e.clientX;
    this._startY = e.clientY;
    this._startPanX = this.panX;
    this._startPanY = this.panY;
    this.container.style.cursor = 'grabbing';
  }

  _onMouseMove(e) {
    if (this.draggingNode) {
      const dx = e.clientX - this._startX;
      const dy = e.clientY - this._startY;
      if (Math.sqrt(dx * dx + dy * dy) > 3) this._wasDragging = true;

      const id = this.draggingNode.dataset[this.nodeIdAttr];
      const rect = this.container.getBoundingClientRect();
      const newX = (e.clientX - rect.left - this.panX) / this.zoom - this._dragOffsetX;
      const newY = (e.clientY - rect.top - this.panY) / this.zoom - this._dragOffsetY;

      this.nodePositions.set(id, { x: newX, y: newY });
      this.draggingNode.style.left = newX + 'px';
      this.draggingNode.style.top = newY + 'px';
      this.renderEdges();
      return;
    }

    if (this.isPanning) {
      const dx = e.clientX - this._startX;
      const dy = e.clientY - this._startY;
      if (Math.sqrt(dx * dx + dy * dy) > 3) this._wasDragging = true;
      this.panX = this._startPanX + dx;
      this.panY = this._startPanY + dy;
      this._applyTransform();
    }
  }

  _onMouseUp(e) {
    if (this.draggingNode) {
      this.draggingNode.classList.remove('dragging');
      if (this._wasDragging) {
        this._savePositions();
      } else {
        const href = this.draggingNode.dataset.href;
        if (href) navigateSPA(href);
      }
      this.draggingNode = null;
      return;
    }
    if (this.isPanning) {
      this.isPanning = false;
      this.container.style.cursor = '';
    }
  }

  _onDblClick() {
    this.fitToViewport();
  }

  _borderPoint(rx, ry, rw, rh, targetX, targetY) {
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    const dx = targetX - cx;
    const dy = targetY - cy;

    if (dx === 0 && dy === 0) return { x: cx, y: ry };

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx / rw > absDy / rh) {
      const signX = Math.sign(dx);
      const edgeX = cx + signX * rw / 2;
      const edgeY = cy + dy * (rw / 2) / absDx;
      return { x: edgeX, y: Math.max(ry, Math.min(ry + rh, edgeY)) };
    } else {
      const signY = Math.sign(dy);
      const edgeY = cy + signY * rh / 2;
      const edgeX = cx + dx * (rh / 2) / absDy;
      return { x: Math.max(rx, Math.min(rx + rw, edgeX)), y: edgeY };
    }
  }

  _restorePositions() {
    const saved = loadPositions(this.graphType);
    if (!saved) return;
    for (const [id, pos] of this.nodePositions) {
      if (saved[id]) {
        this.nodePositions.set(id, { x: saved[id].x, y: saved[id].y });
        const el = this.nodeElements.get(id);
        if (el) { el.style.left = saved[id].x + 'px'; el.style.top = saved[id].y + 'px'; }
      }
    }
  }

  _savePositions() {
    savePositions(this.graphType, this.nodePositions);
  }

  fitToViewport() {
    if (this.nodePositions.size === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [id, pos] of this.nodePositions) {
      const el = this.nodeElements.get(id);
      if (!el) continue;
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + el.offsetWidth);
      maxY = Math.max(maxY, pos.y + el.offsetHeight);
    }

    if (minX === Infinity) return;

    const pad = 60;
    const contentW = maxX - minX + pad * 2;
    const contentH = maxY - minY + pad * 2;
    const rect = this.container.getBoundingClientRect();

    const scaleX = rect.width / contentW;
    const scaleY = rect.height / contentH;
    this.zoom = Math.min(scaleX, scaleY, 1.5);

    this.panX = (rect.width - contentW * this.zoom) / 2 - minX * this.zoom + pad * this.zoom;
    this.panY = (rect.height - contentH * this.zoom) / 2 - minY * this.zoom + pad * this.zoom;
    this._applyTransform();
  }

  destroy() {
    this.container.removeEventListener('wheel', this._onWheel);
    this.container.removeEventListener('mousedown', this._onMouseDown);
    this.container.removeEventListener('dblclick', this._onDblClick);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
  }

  // --- Node building helpers (composable) ---

  /** Create a base node div with scope-graph-node + specialization class */
  createNode(data, specialClass) {
    const div = document.createElement('div');
    div.className = 'scope-graph-node ' + specialClass;
    if (data.ghost) div.classList.add('ghost');
    div.dataset.nodeId = data.id;
    div.dataset.href = data.href;
    return div;
  }

  /** Create a click-guarded link */
  createLink(data) {
    const link = document.createElement('a');
    link.href = data.href;
    link.className = 'scope-construct-link';
    link.textContent = data.name;
    link.addEventListener('click', (e) => {
      if (this._wasDragging) { e.preventDefault(); e.stopPropagation(); }
    });
    return link;
  }

  /** Create a type badge (flow, entity, event, enum) */
  createBadge(type) {
    const badge = document.createElement('div');
    badge.className = 'scope-node-badge scope-node-badge--' + type;
    badge.textContent = type;
    return badge;
  }

  /** Create a header row with link + optional implChip */
  createHeader(data) {
    const header = document.createElement('div');
    header.className = 'scope-node-header';
    header.appendChild(this.createLink(data));
    if (data.implChip) {
      const chip = document.createElement('span');
      chip.innerHTML = data.implChip;
      header.appendChild(chip);
    }
    return header;
  }

  /** Create a fields table (entity fields, event fields) */
  createFields(fields) {
    const container = document.createElement('div');
    container.className = 'scope-node-fields';
    for (const field of fields) {
      const row = document.createElement('div');
      row.className = 'scope-node-field';
      const name = document.createElement('span');
      name.className = 'scope-node-field__name';
      name.textContent = field.name;
      const type = document.createElement('span');
      type.className = 'scope-node-field__type';
      type.innerHTML = field.typeHtml;
      row.appendChild(name);
      row.appendChild(type);
      container.appendChild(row);
    }
    return container;
  }

  /** Create enum values display (chip-style) */
  createEnumValues(values) {
    const container = document.createElement('div');
    container.className = 'scope-node-enum-values';
    for (const val of values) {
      const chip = document.createElement('span');
      chip.className = 'scope-node-enum-chip';
      chip.textContent = val;
      container.appendChild(chip);
    }
    return container;
  }

  /** Create a type label (e.g. "entity", "flow") below the name */
  createTypeLabel(type) {
    const label = document.createElement('div');
    label.className = 'scope-node-type';
    label.textContent = type;
    return label;
  }

  /** Create ghost origin label */
  createGhostOrigin(data) {
    const label = document.createElement('div');
    label.className = 'scope-node-ghost-origin';
    label.textContent = data.ghostComponent || data.component || 'external';
    return label;
  }

  /** Apply abstract/interface classes to a node div */
  applyAbstractInterface(div, data) {
    if (data.isAbstract) div.classList.add('scope-node-abstract');
    if (data.isInterface) div.classList.add('scope-node-interface');
  }

  /** Append abstract/interface badge to a type label */
  createAbstractBadge(typeLabel, data) {
    if (data.isAbstract) {
      const badge = document.createElement('span');
      badge.className = 'scope-node-badge abstract';
      badge.textContent = 'abstract';
      typeLabel.appendChild(document.createTextNode(' '));
      typeLabel.appendChild(badge);
    }
    if (data.isInterface) {
      const badge = document.createElement('span');
      badge.className = 'scope-node-badge interface';
      badge.textContent = 'interface';
      typeLabel.appendChild(document.createTextNode(' '));
      typeLabel.appendChild(badge);
    }
    return typeLabel;
  }

  /** Create inheritance line (extends X  implements Y, Z) */
  createInheritanceLine(data) {
    const parts = [];
    if (data.extendsName) parts.push('extends ' + data.extendsName);
    if (data.implementsNames && data.implementsNames.length > 0)
      parts.push('implements ' + data.implementsNames.join(', '));
    if (parts.length === 0) return null;
    const div = document.createElement('div');
    div.className = 'scope-node-inheritance';
    div.textContent = parts.join('  ');
    return div;
  }

  /** Register node in world + nodeElements map */
  registerNode(div, id) {
    this.worldEl.appendChild(div);
    this.nodeElements.set(id, div);
  }
}

// ===== EntityGraph — Interactive Entity Relationship Graph =====

class EntityGraph extends BaseGraph {
  constructor(container) {
    super(container, 'entity',
      '.scope-entity-graph-edges',
      '.scope-entity-graph-world',
      '.scope-graph-node.scope-entity-node, .scope-graph-node.scope-enum-node',
      'nodeId'
    );
  }

  layout() {
    const nodes = this.data.nodes;
    if (nodes.length === 0) return;

    // Sort: non-ghost nodes with more connections first (central), ghosts at end
    const edgeCount = new Map();
    for (const e of this.data.edges) {
      edgeCount.set(e.from, (edgeCount.get(e.from) || 0) + 1);
      edgeCount.set(e.to, (edgeCount.get(e.to) || 0) + 1);
    }

    const sorted = [...nodes].sort((a, b) => {
      if (a.ghost && !b.ghost) return 1;
      if (!a.ghost && b.ghost) return -1;
      return (edgeCount.get(b.id) || 0) - (edgeCount.get(a.id) || 0);
    });

    // Calculate column width and row heights
    const colSpacing = 380;
    const rowSpacing = 40;
    const cols = Math.max(2, Math.ceil(Math.sqrt(sorted.length)));

    let x = 40;
    let y = 40;
    let col = 0;
    let maxHeightInRow = 0;

    for (const node of sorted) {
      this.nodePositions.set(node.id, { x, y });

      const el = this.nodeElements.get(node.id);
      const h = el ? el.offsetHeight : (60 + node.fields.length * 22);
      if (h > maxHeightInRow) maxHeightInRow = h;

      col++;
      if (col >= cols) {
        col = 0;
        x = 40;
        y += maxHeightInRow + rowSpacing;
        maxHeightInRow = 0;
      } else {
        x += colSpacing;
      }
    }

    // Apply positions
    for (const node of nodes) {
      const pos = this.nodePositions.get(node.id);
      const el = this.nodeElements.get(node.id);
      if (pos && el) {
        el.style.left = pos.x + 'px';
        el.style.top = pos.y + 'px';
      }
    }
  }

  renderNodes() {
    this.worldEl.innerHTML = '';

    for (const node of this.data.nodes) {
      const isEnum = node.constructType === 'enum';
      const div = this.createNode(node, isEnum ? 'scope-enum-node' : 'scope-entity-node');
      this.applyAbstractInterface(div, node);
      div.appendChild(this.createHeader(node));

      const typeLabel = this.createTypeLabel(isEnum ? 'enum' : 'entity');
      this.createAbstractBadge(typeLabel, node);
      div.appendChild(typeLabel);

      const inh = this.createInheritanceLine(node);
      if (inh) div.appendChild(inh);

      if (node.ghost) div.appendChild(this.createGhostOrigin(node));
      if (isEnum && node.enumValues && node.enumValues.length > 0) {
        div.appendChild(this.createEnumValues(node.enumValues));
      } else if (node.fields.length > 0) {
        div.appendChild(this.createFields(node.fields));
      }
      this.registerNode(div, node.id);
    }
  }

  renderEdges() {
    // Clear SVG
    while (this.svgEl.firstChild) this.svgEl.removeChild(this.svgEl.firstChild);

    // Create arrowhead markers
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const createMarker = (id, color) => {
      const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      m.setAttribute('id', id);
      m.setAttribute('viewBox', '0 0 10 7');
      m.setAttribute('refX', '10');
      m.setAttribute('refY', '3.5');
      m.setAttribute('markerWidth', '8');
      m.setAttribute('markerHeight', '6');
      m.setAttribute('orient', 'auto-start-reverse');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M 0 0 L 10 3.5 L 0 7 z');
      p.setAttribute('fill', color);
      m.appendChild(p);
      return m;
    };
    defs.appendChild(createMarker('entity-arrow', 'var(--scope-text-tertiary)'));
    defs.appendChild(createMarker('entity-arrow-extends', 'var(--scope-wip)'));
    defs.appendChild(createMarker('entity-arrow-implements', 'var(--scope-diagram-flow)'));
    this.svgEl.appendChild(defs);

    for (const edge of this.data.edges) {
      this._renderEdge(edge);
    }
  }

  _renderEdge(edge) {
    const fromEl = this.nodeElements.get(edge.from);
    const toEl = this.nodeElements.get(edge.to);
    if (!fromEl || !toEl) return;

    const fromPos = this.nodePositions.get(edge.from);
    const toPos = this.nodePositions.get(edge.to);
    if (!fromPos || !toPos) return;

    const fromW = fromEl.offsetWidth;
    const fromH = fromEl.offsetHeight;
    const toW = toEl.offsetWidth;
    const toH = toEl.offsetHeight;

    // Center points
    const fromCX = fromPos.x + fromW / 2;
    const fromCY = fromPos.y + fromH / 2;
    const toCX = toPos.x + toW / 2;
    const toCY = toPos.y + toH / 2;

    // Calculate connection points on node borders
    const from = this._borderPoint(fromPos.x, fromPos.y, fromW, fromH, toCX, toCY);
    const to = this._borderPoint(toPos.x, toPos.y, toW, toH, fromCX, fromCY);

    // Bezier control points
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curvature = Math.min(dist * 0.3, 80);

    let c1x, c1y, c2x, c2y;
    if (Math.abs(dx) > Math.abs(dy)) {
      // Mostly horizontal
      c1x = from.x + curvature * Math.sign(dx);
      c1y = from.y;
      c2x = to.x - curvature * Math.sign(dx);
      c2y = to.y;
    } else {
      // Mostly vertical
      c1x = from.x;
      c1y = from.y + curvature * Math.sign(dy);
      c2x = to.x;
      c2y = to.y - curvature * Math.sign(dy);
    }

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('scope-entity-graph-edge-group');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`);
    path.classList.add('scope-entity-graph-edge');

    if (edge.edgeType === 'extends') {
      path.classList.add('scope-graph-edge-extends');
      path.setAttribute('marker-end', 'url(#entity-arrow-extends)');
    } else if (edge.edgeType === 'implements') {
      path.classList.add('scope-graph-edge-implements');
      path.setAttribute('marker-end', 'url(#entity-arrow-implements)');
    } else {
      path.setAttribute('marker-end', 'url(#entity-arrow)');
    }
    group.appendChild(path);

    // Label at midpoint
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', midX);
    label.setAttribute('y', midY - 6);
    label.setAttribute('text-anchor', 'middle');
    label.classList.add('scope-entity-graph-edge-label');

    let cardinalityLabel;
    if (edge.edgeType === 'extends') {
      cardinalityLabel = 'extends';
    } else if (edge.edgeType === 'implements') {
      cardinalityLabel = 'implements';
    } else {
      cardinalityLabel = edge.cardinality === 'ref' ? edge.field : `${edge.field} (${edge.cardinality})`;
    }
    label.textContent = cardinalityLabel;
    group.appendChild(label);

    this.svgEl.appendChild(group);
  }

  destroy() {
    super.destroy();
    entityGraphInstances.delete(this.container);
  }
}

function initEntityGraphs() {
  // Destroy old instances
  for (const [el, graph] of entityGraphInstances) {
    graph.destroy();
  }
  entityGraphInstances.clear();

  // Only init graphs in VISIBLE panels (hidden panels have 0 dimensions)
  document.querySelectorAll('.scope-entity-graph').forEach(container => {
    if (entityGraphInstances.has(container)) return;
    const panel = container.closest('.scope-tab-panel');
    if (panel && !panel.classList.contains('active')) return;
    const graph = new EntityGraph(container);
    entityGraphInstances.set(container, graph);
  });
}

function initEntityGraphsIn(parent) {
  parent.querySelectorAll('.scope-entity-graph').forEach(container => {
    // Destroy existing instance to rebuild fresh (e.g. after reload)
    const existing = entityGraphInstances.get(container);
    if (existing) existing.destroy();
    const graph = new EntityGraph(container);
    entityGraphInstances.set(container, graph);
  });
}

// ===== FlowGraph — Interactive Flow Relationship Graph =====

/** @type {Map<HTMLElement, FlowGraph>} */
const flowGraphInstances = new Map();

class FlowGraph extends BaseGraph {
  constructor(container) {
    super(container, 'flow',
      '.scope-flow-graph-edges',
      '.scope-flow-graph-world',
      '.scope-graph-node.scope-flow-node, .scope-graph-node.scope-flow-io-node, .scope-graph-node.scope-flow-event-node, .scope-graph-node.scope-operation-node, .scope-graph-node.scope-flow-endpoint-node, .scope-graph-node.scope-rule-node',
      'nodeId'
    );
  }

  renderNodes() {
    this.worldEl.innerHTML = '';

    // Flow nodes
    for (const flow of this.data.flows) {
      const div = this.createNode(flow, 'scope-flow-node');
      this.applyAbstractInterface(div, flow);
      div.appendChild(this.createHeader(flow));

      const typeLabel = this.createTypeLabel('flow');
      this.createAbstractBadge(typeLabel, flow);
      div.appendChild(typeLabel);

      const inh = this.createInheritanceLine(flow);
      if (inh) div.appendChild(inh);

      // Signature
      const sig = document.createElement('div');
      sig.className = 'scope-flow-graph-node-sig';
      sig.textContent = flow.signature;
      div.appendChild(sig);

      // Comment
      if (flow.comment) {
        const comment = document.createElement('div');
        comment.className = 'scope-flow-graph-node-comment';
        comment.textContent = flow.comment;
        div.appendChild(comment);
      }

      // Steps
      if (flow.steps.length > 0) {
        const stepsDiv = document.createElement('div');
        stepsDiv.className = 'scope-flow-graph-steps';

        for (const step of flow.steps) {
          const stepDiv = document.createElement('div');
          stepDiv.className = 'scope-flow-graph-step ' + step.kind;

          const num = document.createElement('span');
          num.className = 'scope-flow-graph-step-num';
          num.textContent = String(step.index);

          const content = document.createElement('span');
          content.className = 'scope-flow-graph-step-content';
          if (step.kind === 'return') {
            content.textContent = step.action;
          } else if (step.kind === 'emit') {
            content.textContent = 'emit(' + (step.args || '') + ')';
          } else if (step.kind === 'override') {
            content.textContent = 'override ' + step.overrideTarget + ' -> ' + step.action + (step.args ? '(' + step.args + ')' : '');
          } else {
            content.textContent = '-> ' + step.action + (step.args ? '(' + step.args + ')' : '');
          }

          stepDiv.appendChild(num);
          stepDiv.appendChild(content);

          if (step.isAsync) {
            const asyncBadge = document.createElement('span');
            asyncBadge.className = 'scope-flow-graph-step-async';
            asyncBadge.textContent = '@async';
            stepDiv.appendChild(asyncBadge);
          }

          stepsDiv.appendChild(stepDiv);
        }

        div.appendChild(stepsDiv);
      }

      this.registerNode(div, flow.id);
    }

    // IO nodes — entity-like cards with fields table
    for (const io of this.data.ioNodes) {
      const div = this.createNode(io, 'scope-flow-io-node');
      if (io.kind) div.classList.add(io.kind);
      div.appendChild(this.createHeader(io));
      div.appendChild(this.createTypeLabel(io.constructType || 'entity'));
      if (io.ghost) div.appendChild(this.createGhostOrigin(io));
      if (io.fields && io.fields.length > 0) div.appendChild(this.createFields(io.fields));
      this.registerNode(div, io.id);
    }

    // Event nodes
    for (const ev of this.data.eventNodes) {
      const div = this.createNode(ev, 'scope-flow-event-node');
      div.appendChild(this.createLink(ev));
      div.appendChild(this.createTypeLabel('event'));
      this.registerNode(div, ev.id);
    }

    // Operation nodes
    for (const op of (this.data.operationNodes || [])) {
      const div = this.createNode(op, 'scope-operation-node');
      div.appendChild(this.createHeader(op));
      div.appendChild(this.createTypeLabel('operation'));

      const sig = document.createElement('div');
      sig.className = 'scope-flow-graph-node-sig';
      sig.textContent = op.signature;
      div.appendChild(sig);

      if (op.comment) {
        const comment = document.createElement('div');
        comment.className = 'scope-flow-graph-node-comment';
        comment.textContent = op.comment;
        div.appendChild(comment);
      }

      for (const ep of (op.handles || [])) {
        const clause = document.createElement('div');
        clause.className = 'scope-operation-node-clause handles';
        clause.textContent = 'handles ' + ep;
        div.appendChild(clause);
      }
      for (const ep of (op.calls || [])) {
        const clause = document.createElement('div');
        clause.className = 'scope-operation-node-clause calls-ext';
        clause.textContent = 'calls ' + ep;
        div.appendChild(clause);
      }
      for (const evName of op.emits) {
        const clause = document.createElement('div');
        clause.className = 'scope-operation-node-clause emits';
        clause.textContent = 'emits ' + evName;
        div.appendChild(clause);
      }
      for (const ruleName of op.enforces) {
        const clause = document.createElement('div');
        clause.className = 'scope-operation-node-clause enforces';
        clause.textContent = 'enforces ' + ruleName;
        div.appendChild(clause);
      }

      this.registerNode(div, op.id);
    }

    // Endpoint nodes
    for (const ep of (this.data.endpointNodes || [])) {
      const div = this.createNode(ep, 'scope-flow-endpoint-node');
      div.classList.add(ep.direction);

      // Header with method badge
      const header = document.createElement('div');
      header.className = 'scope-node-header';
      const methodBadge = document.createElement('span');
      methodBadge.className = 'scope-api-method-badge scope-api-method--' + ep.method.toLowerCase();
      methodBadge.textContent = ep.method;
      header.appendChild(methodBadge);
      div.appendChild(header);

      // Path
      const pathDiv = document.createElement('div');
      pathDiv.className = 'scope-api-path';
      pathDiv.textContent = ep.path;
      div.appendChild(pathDiv);

      // Direction label
      const dirLabel = document.createElement('div');
      dirLabel.className = 'scope-flow-endpoint-direction';
      dirLabel.textContent = ep.direction === 'handles' ? 'serves' : 'consumes';
      div.appendChild(dirLabel);

      this.registerNode(div, ep.id);
    }

    // Rule nodes
    for (const rule of (this.data.ruleNodes || [])) {
      const div = this.createNode(rule, 'scope-rule-node');
      div.appendChild(this.createLink(rule));
      div.appendChild(this.createTypeLabel('rule'));

      if (rule.whenExpr) {
        const when = document.createElement('div');
        when.className = 'scope-rule-node-when';
        when.textContent = 'when ' + rule.whenExpr;
        div.appendChild(when);
      }
      if (rule.thenAction) {
        const then = document.createElement('div');
        then.className = 'scope-rule-node-then';
        then.textContent = 'then ' + rule.thenAction;
        div.appendChild(then);
      }

      this.registerNode(div, rule.id);
    }
  }

  layout() {
    const flows = this.data.flows;
    if (flows.length === 0) return;

    const colGap = 120;
    const flowGap = 40;

    // Measure all flow nodes to determine column widths
    let maxInputWidth = 0;
    let maxFlowWidth = 0;

    for (const io of this.data.ioNodes) {
      if (io.kind === 'input') {
        const el = this.nodeElements.get(io.id);
        if (el) maxInputWidth = Math.max(maxInputWidth, el.offsetWidth);
      }
    }

    for (const flow of flows) {
      const el = this.nodeElements.get(flow.id);
      if (el) maxFlowWidth = Math.max(maxFlowWidth, el.offsetWidth);
    }

    // Also measure right column (output) widths for proper spacing
    let maxOutputWidth = 0;
    for (const io of this.data.ioNodes) {
      if (io.kind === 'input') continue;
      const el = this.nodeElements.get(io.id);
      if (el) maxOutputWidth = Math.max(maxOutputWidth, el.offsetWidth);
    }
    for (const ev of this.data.eventNodes) {
      const el = this.nodeElements.get(ev.id);
      if (el) maxOutputWidth = Math.max(maxOutputWidth, el.offsetWidth);
    }

    if (maxInputWidth === 0) maxInputWidth = 180;
    if (maxFlowWidth === 0) maxFlowWidth = 300;
    if (maxOutputWidth === 0) maxOutputWidth = 180;

    const flowColX = maxInputWidth + colGap;
    const rightColX = flowColX + maxFlowWidth + colGap;

    // Position flow nodes in the center column
    let flowY = 40;
    const flowCenters = new Map(); // flowId -> { cy, top, bottom }

    for (const flow of flows) {
      const el = this.nodeElements.get(flow.id);
      const h = el ? el.offsetHeight : 100;
      this.nodePositions.set(flow.id, { x: flowColX, y: flowY });
      flowCenters.set(flow.id, { cy: flowY + h / 2, top: flowY, bottom: flowY + h });
      flowY += h + flowGap;
    }

    // Build maps: which input IO nodes connect to which flows
    const inputToFlows = new Map(); // ioKey -> Set<flowId>
    const flowToOutputs = new Map(); // flowId -> Set<ioKey>
    const flowToEvents = new Map(); // flowId -> Set<eventKey>
    const flowToOps = new Map(); // flowId -> Set<opId>
    const opToRules = new Map(); // opId -> Set<ruleId>
    const opToEndpoints = new Map(); // opId -> Set<epId>
    const endpointToOps = new Map(); // epId -> Set<opId> (for handles direction)

    for (const edge of this.data.edges) {
      if (edge.edgeType === 'input') {
        if (!inputToFlows.has(edge.from)) inputToFlows.set(edge.from, new Set());
        inputToFlows.get(edge.from).add(edge.to);
      } else if (edge.edgeType === 'output' || edge.edgeType === 'error') {
        if (!flowToOutputs.has(edge.from)) flowToOutputs.set(edge.from, new Set());
        flowToOutputs.get(edge.from).add(edge.to);
      } else if (edge.edgeType === 'emit') {
        if (!flowToEvents.has(edge.from)) flowToEvents.set(edge.from, new Set());
        flowToEvents.get(edge.from).add(edge.to);
      } else if (edge.edgeType === 'calls' || edge.edgeType === 'override') {
        if (!flowToOps.has(edge.from)) flowToOps.set(edge.from, new Set());
        flowToOps.get(edge.from).add(edge.to);
      } else if (edge.edgeType === 'enforces') {
        if (!opToRules.has(edge.from)) opToRules.set(edge.from, new Set());
        opToRules.get(edge.from).add(edge.to);
      } else if (edge.edgeType === 'handles') {
        // ep → op: endpoint handles operation
        if (!endpointToOps.has(edge.from)) endpointToOps.set(edge.from, new Set());
        endpointToOps.get(edge.from).add(edge.to);
        if (!opToEndpoints.has(edge.to)) opToEndpoints.set(edge.to, new Set());
        opToEndpoints.get(edge.to).add(edge.from);
      } else if (edge.edgeType === 'calls-ext') {
        // op → ep: operation calls external
        if (!opToEndpoints.has(edge.from)) opToEndpoints.set(edge.from, new Set());
        opToEndpoints.get(edge.from).add(edge.to);
      }
    }

    // Position input IO nodes in left column (aligned to center of connected flows)
    for (const io of this.data.ioNodes) {
      if (io.kind !== 'input') continue;
      const connectedFlows = inputToFlows.get(io.id);
      if (!connectedFlows || connectedFlows.size === 0) continue;

      // Average center Y of connected flows
      let sumCY = 0;
      let count = 0;
      for (const fid of connectedFlows) {
        const fc = flowCenters.get(fid);
        if (fc) { sumCY += fc.cy; count++; }
      }
      const avgCY = count > 0 ? sumCY / count : 40;
      const el = this.nodeElements.get(io.id);
      const h = el ? el.offsetHeight : 30;
      this.nodePositions.set(io.id, { x: 40, y: avgCY - h / 2 });
    }

    // Position output/error IO nodes in right column
    // Average center Y across ALL connected flows (fixes shared nodes like Erro)
    const rightUsedY = [];
    for (const io of this.data.ioNodes) {
      if (io.kind === 'input') continue;
      let sumCY = 0;
      let count = 0;
      for (const flow of flows) {
        const outputs = flowToOutputs.get(flow.id);
        if (outputs && outputs.has(io.id)) {
          const fc = flowCenters.get(flow.id);
          if (fc) { sumCY += fc.cy; count++; }
        }
      }
      const avgCY = count > 0 ? sumCY / count : 40;

      const el = this.nodeElements.get(io.id);
      const h = el ? el.offsetHeight : 30;
      let targetY = avgCY - h / 2;

      // Avoid overlap with previously placed right-column nodes
      for (const ry of rightUsedY) {
        if (Math.abs(targetY - ry.y) < ry.h + 10) {
          targetY = ry.y + ry.h + 10;
        }
      }

      this.nodePositions.set(io.id, { x: rightColX, y: targetY });
      rightUsedY.push({ y: targetY, h });
    }

    // Position event nodes in right column (below outputs)
    for (const ev of this.data.eventNodes) {
      let avgCY = 40;
      for (const flow of flows) {
        const events = flowToEvents.get(flow.id);
        if (events && events.has(ev.id)) {
          const fc = flowCenters.get(flow.id);
          if (fc) { avgCY = fc.cy; break; }
        }
      }

      const el = this.nodeElements.get(ev.id);
      const h = el ? el.offsetHeight : 30;
      let targetY = avgCY + 20; // Offset below center to separate from outputs

      for (const ry of rightUsedY) {
        if (Math.abs(targetY - ry.y) < ry.h + 10) {
          targetY = ry.y + ry.h + 10;
        }
      }

      this.nodePositions.set(ev.id, { x: rightColX, y: targetY });
      rightUsedY.push({ y: targetY, h });
    }

    // Position operation nodes below all flows, in horizontal rows per flow group
    const opGap = 24;
    const groupSeparator = 50;
    const operationNodes = this.data.operationNodes || [];
    const ruleNodesData = this.data.ruleNodes || [];

    if (operationNodes.length > 0) {
      // Find the bottom of all positioned nodes (flows + IO + events)
      let maxBottom = 0;
      for (const [id, pos] of this.nodePositions) {
        const el = this.nodeElements.get(id);
        if (el) {
          const bottom = pos.y + el.offsetHeight;
          if (bottom > maxBottom) maxBottom = bottom;
        }
      }

      // Assign each operation to its primary calling flow (first match in order)
      const placedOps = new Set();
      const flowOpGroups = [];
      for (const flow of flows) {
        const ops = flowToOps.get(flow.id);
        if (!ops) continue;
        const group = [];
        for (const op of operationNodes) {
          if (ops.has(op.id) && !placedOps.has(op.id)) {
            group.push(op);
            placedOps.add(op.id);
          }
        }
        if (group.length > 0) flowOpGroups.push({ flowId: flow.id, ops: group });
      }

      // Center point for operations layout
      const flowCenter = flowColX + maxFlowWidth / 2;
      let curY = maxBottom + groupSeparator;

      for (let gi = 0; gi < flowOpGroups.length; gi++) {
        const { ops } = flowOpGroups[gi];

        // Measure widths to compute total row width
        const opWidths = [];
        let totalRowWidth = 0;
        for (const op of ops) {
          const el = this.nodeElements.get(op.id);
          const w = el ? el.offsetWidth : 220;
          opWidths.push(w);
          totalRowWidth += w;
        }
        totalRowWidth += (ops.length - 1) * opGap;

        // Center the row on flowCenter
        let rowX = flowCenter - totalRowWidth / 2;
        let maxOpH = 0;

        for (let i = 0; i < ops.length; i++) {
          const op = ops[i];
          const el = this.nodeElements.get(op.id);
          const h = el ? el.offsetHeight : 60;
          this.nodePositions.set(op.id, { x: rowX, y: curY });
          rowX += opWidths[i] + opGap;
          if (h > maxOpH) maxOpH = h;
        }

        curY += maxOpH + opGap;

        // Position rules below their enforcing operation (same X)
        let hasRules = false;
        const ruleY = curY;
        let maxRuleH = 0;
        for (const op of ops) {
          const enforced = opToRules.get(op.id);
          if (!enforced) continue;
          const opPos = this.nodePositions.get(op.id);
          for (const rule of ruleNodesData) {
            if (!enforced.has(rule.id)) continue;
            hasRules = true;
            const ruleEl = this.nodeElements.get(rule.id);
            const ruleH = ruleEl ? ruleEl.offsetHeight : 40;
            this.nodePositions.set(rule.id, { x: opPos.x, y: ruleY });
            if (ruleH > maxRuleH) maxRuleH = ruleH;
          }
        }
        if (hasRules) curY = ruleY + maxRuleH + opGap;

        // Extra gap between groups
        if (gi < flowOpGroups.length - 1) curY += groupSeparator - opGap;
      }

      // Position endpoint nodes below operations/rules
      const endpointNodes = this.data.endpointNodes || [];
      if (endpointNodes.length > 0) {
        // Find the bottom of all positioned nodes
        let epStartY = curY + groupSeparator;

        // Group endpoints by their connected operation
        const placedEps = new Set();
        for (const op of operationNodes) {
          const epIds = opToEndpoints.get(op.id);
          if (!epIds) continue;
          const opPos = this.nodePositions.get(op.id);
          if (!opPos) continue;
          const opEl = this.nodeElements.get(op.id);
          const opCenterX = opPos.x + (opEl ? opEl.offsetWidth / 2 : 110);

          const epsForOp = endpointNodes.filter(ep => epIds.has(ep.id) && !placedEps.has(ep.id));
          if (epsForOp.length === 0) continue;

          let totalW = 0;
          for (let i = 0; i < epsForOp.length; i++) {
            if (i > 0) totalW += opGap;
            const el = this.nodeElements.get(epsForOp[i].id);
            totalW += el ? el.offsetWidth : 160;
          }
          let epX = opCenterX - totalW / 2;

          for (const ep of epsForOp) {
            const el = this.nodeElements.get(ep.id);
            const w = el ? el.offsetWidth : 160;
            this.nodePositions.set(ep.id, { x: epX, y: epStartY });
            placedEps.add(ep.id);
            epX += w + opGap;
          }
        }

        // Place any remaining unplaced endpoint nodes
        let orphanEpX = flowColX;
        for (const ep of endpointNodes) {
          if (placedEps.has(ep.id)) continue;
          const el = this.nodeElements.get(ep.id);
          const w = el ? el.offsetWidth : 160;
          this.nodePositions.set(ep.id, { x: orphanEpX, y: epStartY });
          orphanEpX += w + opGap;
        }
      }
    }

    // Apply positions
    for (const [id, pos] of this.nodePositions) {
      const el = this.nodeElements.get(id);
      if (el) {
        el.style.left = pos.x + 'px';
        el.style.top = pos.y + 'px';
      }
    }
  }

  renderEdges() {
    while (this.svgEl.firstChild) this.svgEl.removeChild(this.svgEl.firstChild);

    // Create arrowhead markers
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    const createMarker = (id, color) => {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', id);
      marker.setAttribute('viewBox', '0 0 10 7');
      marker.setAttribute('refX', '10');
      marker.setAttribute('refY', '3.5');
      marker.setAttribute('markerWidth', '8');
      marker.setAttribute('markerHeight', '6');
      marker.setAttribute('orient', 'auto-start-reverse');
      const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrowPath.setAttribute('d', 'M 0 0 L 10 3.5 L 0 7 z');
      arrowPath.setAttribute('fill', color);
      marker.appendChild(arrowPath);
      return marker;
    };

    defs.appendChild(createMarker('flow-arrow', 'var(--scope-text-tertiary)'));
    defs.appendChild(createMarker('flow-arrow-error', 'var(--scope-error)'));
    defs.appendChild(createMarker('flow-arrow-calls', 'var(--scope-text-tertiary)'));
    defs.appendChild(createMarker('flow-arrow-enforces', 'var(--scope-pending)'));
    defs.appendChild(createMarker('flow-arrow-extends', 'var(--scope-wip)'));
    defs.appendChild(createMarker('flow-arrow-implements', 'var(--scope-diagram-flow)'));
    defs.appendChild(createMarker('flow-arrow-override', 'var(--scope-wip)'));
    defs.appendChild(createMarker('flow-arrow-handles', 'var(--scope-accent)'));
    defs.appendChild(createMarker('flow-arrow-calls-ext', 'var(--scope-accent)'));
    this.svgEl.appendChild(defs);

    for (const edge of this.data.edges) {
      this._renderEdge(edge);
    }
  }

  _renderEdge(edge) {
    const fromEl = this.nodeElements.get(edge.from);
    const toEl = this.nodeElements.get(edge.to);
    if (!fromEl || !toEl) return;

    const fromPos = this.nodePositions.get(edge.from);
    const toPos = this.nodePositions.get(edge.to);
    if (!fromPos || !toPos) return;

    const fromW = fromEl.offsetWidth;
    const fromH = fromEl.offsetHeight;
    const toW = toEl.offsetWidth;
    const toH = toEl.offsetHeight;

    const fromCX = fromPos.x + fromW / 2;
    const fromCY = fromPos.y + fromH / 2;
    const toCX = toPos.x + toW / 2;
    const toCY = toPos.y + toH / 2;

    const from = this._borderPoint(fromPos.x, fromPos.y, fromW, fromH, toCX, toCY);
    const to = this._borderPoint(toPos.x, toPos.y, toW, toH, fromCX, fromCY);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curvature = Math.min(dist * 0.3, 80);

    let c1x, c1y, c2x, c2y;
    if (Math.abs(dx) > Math.abs(dy)) {
      c1x = from.x + curvature * Math.sign(dx);
      c1y = from.y;
      c2x = to.x - curvature * Math.sign(dx);
      c2y = to.y;
    } else {
      c1x = from.x;
      c1y = from.y + curvature * Math.sign(dy);
      c2x = to.x;
      c2y = to.y - curvature * Math.sign(dy);
    }

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('scope-flow-graph-edge-group');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`);
    path.classList.add('scope-flow-graph-edge');

    if (edge.edgeType === 'emit') {
      path.classList.add('emit');
    } else if (edge.edgeType === 'error') {
      path.classList.add('error');
    } else if (edge.edgeType === 'calls') {
      path.classList.add('calls');
    } else if (edge.edgeType === 'enforces') {
      path.classList.add('enforces');
    } else if (edge.edgeType === 'extends') {
      path.classList.add('scope-graph-edge-extends');
    } else if (edge.edgeType === 'implements') {
      path.classList.add('scope-graph-edge-implements');
    } else if (edge.edgeType === 'override') {
      path.classList.add('scope-graph-edge-override');
    } else if (edge.edgeType === 'handles') {
      path.classList.add('handles');
    } else if (edge.edgeType === 'calls-ext') {
      path.classList.add('calls-ext');
    }

    const markerMap = { error: 'flow-arrow-error', calls: 'flow-arrow-calls', enforces: 'flow-arrow-enforces', extends: 'flow-arrow-extends', implements: 'flow-arrow-implements', override: 'flow-arrow-override', handles: 'flow-arrow-handles', 'calls-ext': 'flow-arrow-calls-ext' };
    const markerId = markerMap[edge.edgeType] || 'flow-arrow';
    path.setAttribute('marker-end', `url(#${markerId})`);
    group.appendChild(path);

    // Label at midpoint
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', midX);
    label.setAttribute('y', midY - 6);
    label.setAttribute('text-anchor', 'middle');
    label.classList.add('scope-flow-graph-edge-label');
    label.textContent = edge.label;
    group.appendChild(label);

    this.svgEl.appendChild(group);
  }

  destroy() {
    super.destroy();
    flowGraphInstances.delete(this.container);
  }
}

function initFlowGraphs() {
  for (const [el, graph] of flowGraphInstances) {
    graph.destroy();
  }
  flowGraphInstances.clear();

  document.querySelectorAll('.scope-flow-graph').forEach(container => {
    if (flowGraphInstances.has(container)) return;
    const panel = container.closest('.scope-tab-panel');
    if (panel && !panel.classList.contains('active')) return;
    const graph = new FlowGraph(container);
    flowGraphInstances.set(container, graph);
  });
}

function initFlowGraphsIn(parent) {
  parent.querySelectorAll('.scope-flow-graph').forEach(container => {
    const existing = flowGraphInstances.get(container);
    if (existing) existing.destroy();
    const graph = new FlowGraph(container);
    flowGraphInstances.set(container, graph);
  });
}

// ===== EventGraph — Interactive Event Lifecycle Graph =====

/** @type {Map<HTMLElement, EventGraph>} */
const eventGraphInstances = new Map();

class EventGraph extends BaseGraph {
  constructor(container) {
    super(container, 'event',
      '.scope-event-graph-edges',
      '.scope-event-graph-world',
      '.scope-graph-node.scope-event-node, .scope-graph-node.scope-event-context-node',
      'nodeId'
    );
  }

  renderNodes() {
    this.worldEl.innerHTML = '';

    // Event nodes (center column)
    for (const ev of this.data.events) {
      const div = this.createNode(ev, 'scope-event-node');
      div.appendChild(this.createHeader(ev));
      div.appendChild(this.createTypeLabel('event'));

      // Field count
      if (ev.fieldCount > 0) {
        const countDiv = document.createElement('div');
        countDiv.className = 'scope-event-graph-field-count';
        countDiv.textContent = ev.fieldCount + ' field' + (ev.fieldCount > 1 ? 's' : '');
        div.appendChild(countDiv);
      }

      // Fields
      if (ev.fields && ev.fields.length > 0) {
        div.appendChild(this.createFields(ev.fields));
      }

      this.registerNode(div, ev.id);
    }

    // Emitter nodes (left columns — operations, flows, rules)
    for (const em of this.data.emitters) {
      const cssClass = 'scope-event-context-node scope-event-' + em.constructType + '-node';
      const div = this.createNode(em, cssClass);
      div.appendChild(this.createLink(em));
      div.appendChild(this.createTypeLabel(em.constructType));
      if (em.ghost) div.appendChild(this.createGhostOrigin(em));
      this.registerNode(div, em.id);
    }

    // Consumer nodes (right columns — transitions, cycle, operations, api-streams)
    for (const cn of this.data.consumers) {
      const cssClass = 'scope-event-context-node scope-event-' + cn.constructType + '-node';
      const div = this.createNode(cn, cssClass);
      if (cn.constructType === 'api-stream') {
        const nameEl = document.createElement('div');
        nameEl.className = 'scope-construct-link scope-event-stream-label';
        nameEl.textContent = cn.label || cn.name;
        div.appendChild(nameEl);
        div.appendChild(this.createTypeLabel('api'));
      } else if (cn.constructType === 'state-transition') {
        // Show "from → to", cycle name, and type label
        const transEl = document.createElement('div');
        transEl.className = 'scope-event-transition-label';
        transEl.textContent = cn.name;
        div.appendChild(transEl);
        const cycleLabel = document.createElement('div');
        cycleLabel.className = 'scope-node-type';
        cycleLabel.textContent = cn.label || 'state';
        div.appendChild(cycleLabel);
        div.appendChild(this.createTypeLabel('transition · state cycle'));
      } else {
        div.appendChild(this.createLink(cn));
        div.appendChild(this.createTypeLabel(cn.constructType));
      }
      if (cn.ghost) div.appendChild(this.createGhostOrigin(cn));
      this.registerNode(div, cn.id);
    }
  }

  layout() {
    const events = this.data.events;
    if (events.length === 0) return;

    const colGap = 100;
    const eventGap = 40;

    // Classify emitters into columns: flows (col 0), operations (col 1), rules (col 1 below ops)
    const flowEmitters = this.data.emitters.filter(e => e.constructType === 'flow');
    const opEmitters = this.data.emitters.filter(e => e.constructType === 'operation');
    const ruleEmitters = this.data.emitters.filter(e => e.constructType === 'rule');

    // Measure widths per column
    let maxFlowW = 0, maxOpW = 0, maxEventW = 0, maxConsumerW = 0;

    for (const em of flowEmitters) {
      const el = this.nodeElements.get(em.id);
      if (el) maxFlowW = Math.max(maxFlowW, el.offsetWidth);
    }
    for (const em of opEmitters) {
      const el = this.nodeElements.get(em.id);
      if (el) maxOpW = Math.max(maxOpW, el.offsetWidth);
    }
    for (const em of ruleEmitters) {
      const el = this.nodeElements.get(em.id);
      if (el) maxOpW = Math.max(maxOpW, el.offsetWidth);
    }
    for (const ev of events) {
      const el = this.nodeElements.get(ev.id);
      if (el) maxEventW = Math.max(maxEventW, el.offsetWidth);
    }
    for (const cn of this.data.consumers) {
      const el = this.nodeElements.get(cn.id);
      if (el) maxConsumerW = Math.max(maxConsumerW, el.offsetWidth);
    }

    if (maxFlowW === 0) maxFlowW = 160;
    if (maxOpW === 0) maxOpW = 180;
    if (maxEventW === 0) maxEventW = 240;
    if (maxConsumerW === 0) maxConsumerW = 180;

    // Column X positions (left to right: flow, operation, event, consumers)
    const hasFlows = flowEmitters.length > 0;
    const hasOps = opEmitters.length > 0 || ruleEmitters.length > 0;

    let flowColX = 40;
    let opColX = hasFlows ? flowColX + maxFlowW + colGap : 40;
    let eventColX = hasOps ? opColX + maxOpW + colGap : (hasFlows ? flowColX + maxFlowW + colGap : 40);
    let consumerColX = eventColX + maxEventW + colGap;

    // Position event nodes in center column
    let eventY = 40;
    const eventCenters = new Map();

    for (const ev of events) {
      const el = this.nodeElements.get(ev.id);
      const h = el ? el.offsetHeight : 80;
      this.nodePositions.set(ev.id, { x: eventColX, y: eventY });
      eventCenters.set(ev.id, { cy: eventY + h / 2, top: eventY, bottom: eventY + h });
      eventY += h + eventGap;
    }

    // Build connection maps (node → set of connected event IDs)
    const nodeToEvents = new Map(); // for emitters: which events they connect to (directly or through ops)
    const eventToConsumers = new Map();

    // For operations: op → event (emits edge)
    // For flows: flow → op (uses edge), op → event => flow indirectly connects to event
    const opToEvents = new Map();
    for (const edge of this.data.edges) {
      if (edge.edgeType === 'emits') {
        // from is an emitter, to is an event
        if (!nodeToEvents.has(edge.from)) nodeToEvents.set(edge.from, new Set());
        nodeToEvents.get(edge.from).add(edge.to);
        if (edge.from.startsWith('emitter-op:')) {
          if (!opToEvents.has(edge.from)) opToEvents.set(edge.from, new Set());
          opToEvents.get(edge.from).add(edge.to);
        }
      }
      if (edge.edgeType === 'uses') {
        // from is a flow, to is an operation
        // flow connects to same events as the operation
        if (!nodeToEvents.has(edge.from)) nodeToEvents.set(edge.from, new Set());
        const opEvs = opToEvents.get(edge.to);
        if (opEvs) for (const ev of opEvs) nodeToEvents.get(edge.from).add(ev);
      }
      if (edge.edgeType === 'enforces') {
        // from is an operation, to is a rule → rule connects via same events as op
        if (!nodeToEvents.has(edge.to)) nodeToEvents.set(edge.to, new Set());
        const opEvs = opToEvents.get(edge.from);
        if (opEvs) for (const ev of opEvs) nodeToEvents.get(edge.to).add(ev);
      }
      if (edge.edgeType === 'trigger' || edge.edgeType === 'stream') {
        // event → consumer or transition → cycle
        if (edge.from.startsWith('event:')) {
          if (!eventToConsumers.has(edge.from)) eventToConsumers.set(edge.from, new Set());
          eventToConsumers.get(edge.from).add(edge.to);
        }
      }
    }

    // Helper: compute avg Y for a node based on its connected events
    const avgEventY = (nodeId) => {
      const evIds = nodeToEvents.get(nodeId);
      if (!evIds || evIds.size === 0) return 40;
      let sum = 0, cnt = 0;
      for (const evId of evIds) {
        const ec = eventCenters.get(evId);
        if (ec) { sum += ec.cy; cnt++; }
      }
      return cnt > 0 ? sum / cnt : 40;
    };

    // Position operation emitters (col 1)
    const opUsedY = [];
    for (const op of opEmitters) {
      const el = this.nodeElements.get(op.id);
      const h = el ? el.offsetHeight : 30;
      let targetY = avgEventY(op.id) - h / 2;
      for (const ry of opUsedY) {
        if (Math.abs(targetY - ry.y) < ry.h + 10) targetY = ry.y + ry.h + 10;
      }
      this.nodePositions.set(op.id, { x: opColX, y: targetY });
      opUsedY.push({ y: targetY, h });
    }

    // Position rule emitters below their connected operations in col 1
    for (const rule of ruleEmitters) {
      const el = this.nodeElements.get(rule.id);
      const h = el ? el.offsetHeight : 30;
      // Find which operation connects to this rule via enforces edge
      let opY = avgEventY(rule.id);
      for (const edge of this.data.edges) {
        if (edge.edgeType === 'enforces' && edge.to === rule.id) {
          const opPos = this.nodePositions.get(edge.from);
          const opEl = this.nodeElements.get(edge.from);
          if (opPos && opEl) {
            opY = opPos.y + opEl.offsetHeight + 20; // below the operation
          }
        }
      }
      let targetY = opY;
      for (const ry of opUsedY) {
        if (Math.abs(targetY - ry.y) < ry.h + 10) targetY = ry.y + ry.h + 10;
      }
      this.nodePositions.set(rule.id, { x: opColX, y: targetY });
      opUsedY.push({ y: targetY, h });
    }

    // Position flow emitters (col 0)
    const flowUsedY = [];
    for (const flow of flowEmitters) {
      const el = this.nodeElements.get(flow.id);
      const h = el ? el.offsetHeight : 30;
      // Avg Y of connected operations (or events if no ops)
      let targetCY = avgEventY(flow.id);
      // Check if connected to an operation and use its Y
      for (const edge of this.data.edges) {
        if (edge.edgeType === 'uses' && edge.from === flow.id) {
          const opPos = this.nodePositions.get(edge.to);
          const opEl = this.nodeElements.get(edge.to);
          if (opPos && opEl) {
            targetCY = opPos.y + opEl.offsetHeight / 2;
          }
        }
      }
      let targetY = targetCY - h / 2;
      for (const ry of flowUsedY) {
        if (Math.abs(targetY - ry.y) < ry.h + 10) targetY = ry.y + ry.h + 10;
      }
      this.nodePositions.set(flow.id, { x: flowColX, y: targetY });
      flowUsedY.push({ y: targetY, h });
    }

    // Position consumer nodes (right column)
    const rightUsedY = [];
    for (const cn of this.data.consumers) {
      let avgCY = 40;
      for (const ev of events) {
        const consumers = eventToConsumers.get(ev.id);
        if (consumers && consumers.has(cn.id)) {
          const ec = eventCenters.get(ev.id);
          if (ec) { avgCY = ec.cy; break; }
        }
      }

      const el = this.nodeElements.get(cn.id);
      const h = el ? el.offsetHeight : 30;
      let targetY = avgCY - h / 2;
      for (const ry of rightUsedY) {
        if (Math.abs(targetY - ry.y) < ry.h + 10) targetY = ry.y + ry.h + 10;
      }
      this.nodePositions.set(cn.id, { x: consumerColX, y: targetY });
      rightUsedY.push({ y: targetY, h });
    }

    // Apply positions
    for (const [id, pos] of this.nodePositions) {
      const el = this.nodeElements.get(id);
      if (el) {
        el.style.left = pos.x + 'px';
        el.style.top = pos.y + 'px';
      }
    }
  }

  renderEdges() {
    while (this.svgEl.firstChild) this.svgEl.removeChild(this.svgEl.firstChild);

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    const createMarker = (id, color) => {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', id);
      marker.setAttribute('viewBox', '0 0 10 7');
      marker.setAttribute('refX', '10');
      marker.setAttribute('refY', '3.5');
      marker.setAttribute('markerWidth', '8');
      marker.setAttribute('markerHeight', '6');
      marker.setAttribute('orient', 'auto-start-reverse');
      const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrowPath.setAttribute('d', 'M 0 0 L 10 3.5 L 0 7 z');
      arrowPath.setAttribute('fill', color);
      marker.appendChild(arrowPath);
      return marker;
    };

    defs.appendChild(createMarker('event-arrow-emits', 'var(--scope-text-tertiary)'));
    defs.appendChild(createMarker('event-arrow-uses', 'var(--scope-text-tertiary)'));
    defs.appendChild(createMarker('event-arrow-trigger', 'var(--scope-text-tertiary)'));
    defs.appendChild(createMarker('event-arrow-stream', 'var(--scope-text-tertiary)'));
    defs.appendChild(createMarker('event-arrow-enforces', 'var(--scope-text-tertiary)'));
    this.svgEl.appendChild(defs);

    for (const edge of this.data.edges) {
      this._renderEdge(edge);
    }
  }

  _renderEdge(edge) {
    const fromEl = this.nodeElements.get(edge.from);
    const toEl = this.nodeElements.get(edge.to);
    if (!fromEl || !toEl) return;

    const fromPos = this.nodePositions.get(edge.from);
    const toPos = this.nodePositions.get(edge.to);
    if (!fromPos || !toPos) return;

    const fromW = fromEl.offsetWidth;
    const fromH = fromEl.offsetHeight;
    const toW = toEl.offsetWidth;
    const toH = toEl.offsetHeight;

    const fromCX = fromPos.x + fromW / 2;
    const fromCY = fromPos.y + fromH / 2;
    const toCX = toPos.x + toW / 2;
    const toCY = toPos.y + toH / 2;

    const from = this._borderPoint(fromPos.x, fromPos.y, fromW, fromH, toCX, toCY);
    const to = this._borderPoint(toPos.x, toPos.y, toW, toH, fromCX, fromCY);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curvature = Math.min(dist * 0.3, 80);

    let c1x, c1y, c2x, c2y;
    if (Math.abs(dx) > Math.abs(dy)) {
      c1x = from.x + curvature * Math.sign(dx);
      c1y = from.y;
      c2x = to.x - curvature * Math.sign(dx);
      c2y = to.y;
    } else {
      c1x = from.x;
      c1y = from.y + curvature * Math.sign(dy);
      c2x = to.x;
      c2y = to.y - curvature * Math.sign(dy);
    }

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('scope-event-graph-edge-group');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`);
    path.classList.add('scope-event-graph-edge');
    path.classList.add(edge.edgeType);
    path.setAttribute('marker-end', 'url(#event-arrow-' + edge.edgeType + ')');
    group.appendChild(path);

    // Label at midpoint
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', midX);
    label.setAttribute('y', midY - 6);
    label.setAttribute('text-anchor', 'middle');
    label.classList.add('scope-event-graph-edge-label');
    label.textContent = edge.label;
    group.appendChild(label);

    this.svgEl.appendChild(group);
  }

  destroy() {
    super.destroy();
    eventGraphInstances.delete(this.container);
  }
}

function initEventGraphs() {
  for (const [el, graph] of eventGraphInstances) {
    graph.destroy();
  }
  eventGraphInstances.clear();

  document.querySelectorAll('.scope-event-graph').forEach(container => {
    if (eventGraphInstances.has(container)) return;
    const panel = container.closest('.scope-tab-panel');
    if (panel && !panel.classList.contains('active')) return;
    const graph = new EventGraph(container);
    eventGraphInstances.set(container, graph);
  });
}

function initEventGraphsIn(parent) {
  parent.querySelectorAll('.scope-event-graph').forEach(container => {
    const existing = eventGraphInstances.get(container);
    if (existing) existing.destroy();
    const graph = new EventGraph(container);
    eventGraphInstances.set(container, graph);
  });
}

// ===== StateGraph — Interactive State Machine Graph =====

/** @type {Map<HTMLElement, StateGraph>} */
const stateGraphInstances = new Map();

class StateGraph extends BaseGraph {
  constructor(container) {
    super(container, 'state',
      '.scope-state-graph-edges',
      '.scope-state-graph-world',
      '.scope-graph-node.scope-state-node, .scope-graph-node.scope-state-event-node, .scope-graph-node.scope-state-enum-node',
      'nodeId'
    );
  }

  renderNodes() {
    this.worldEl.innerHTML = '';

    // Title bars for each machine (positioned absolutely during layout)
    for (const machine of this.data.machines) {
      const titleDiv = document.createElement('div');
      titleDiv.className = 'scope-state-graph-title';
      titleDiv.dataset.machine = machine.name;
      const stateLink = document.createElement('a');
      stateLink.href = machine.stateHref;
      stateLink.className = 'scope-construct-link';
      stateLink.textContent = machine.name;
      stateLink.addEventListener('click', (e) => {
        if (this._wasDragging) { e.preventDefault(); e.stopPropagation(); }
      });
      titleDiv.appendChild(stateLink);
      titleDiv.appendChild(document.createTextNode(' : '));
      const enumLink = document.createElement('a');
      enumLink.href = machine.enumHref;
      enumLink.className = 'scope-construct-link';
      enumLink.textContent = machine.enumRef;
      enumLink.addEventListener('click', (e) => {
        if (this._wasDragging) { e.preventDefault(); e.stopPropagation(); }
      });
      titleDiv.appendChild(enumLink);
      this.worldEl.appendChild(titleDiv);
    }

    // State nodes — name first, type + cycle below
    for (const state of this.data.stateNodes) {
      const div = this.createNode(state, 'scope-state-node');
      if (state.isInitial) div.classList.add('initial');
      if (state.isTerminal) div.classList.add('terminal');
      const machine = this.data.machines.find(m => m.name === state.machine);
      if (machine) div.dataset.href = machine.stateHref;

      // Name (large, first)
      const nameDiv = document.createElement('div');
      nameDiv.className = 'scope-state-node-name';
      if (state.isInitial) {
        const marker = document.createElement('span');
        marker.className = 'scope-state-initial-marker';
        marker.textContent = '\u25CF ';
        nameDiv.appendChild(marker);
      }
      nameDiv.appendChild(document.createTextNode(state.name));
      div.appendChild(nameDiv);

      // Type + cycle (small, below)
      const metaDiv = document.createElement('div');
      metaDiv.className = 'scope-state-node-meta';
      metaDiv.textContent = 'state \u00B7 ' + state.machine;
      div.appendChild(metaDiv);

      this.registerNode(div, state.id);
    }

    // Event nodes — name first, type below
    for (const ev of this.data.eventNodes) {
      const div = this.createNode(ev, 'scope-state-event-node');
      if (ev.machines && ev.machines.length > 1) {
        div.classList.add('shared');
      }

      const nameDiv = document.createElement('div');
      nameDiv.className = 'scope-state-event-node-name';
      const link = this.createLink(ev);
      nameDiv.appendChild(link);
      div.appendChild(nameDiv);

      const metaDiv = document.createElement('div');
      metaDiv.className = 'scope-state-node-meta';
      metaDiv.textContent = ev.machines && ev.machines.length > 1
        ? 'event \u00B7 shared'
        : 'event';
      div.appendChild(metaDiv);

      this.registerNode(div, ev.id);
    }

    // Enum nodes — one per machine
    for (const en of (this.data.enumNodes || [])) {
      const div = this.createNode(en, 'scope-state-enum-node');
      div.dataset.href = en.href;

      const nameDiv = document.createElement('div');
      nameDiv.className = 'scope-state-node-name';
      const enumNameLink = document.createElement('a');
      enumNameLink.href = en.href;
      enumNameLink.className = 'scope-construct-link';
      enumNameLink.textContent = en.name;
      enumNameLink.addEventListener('click', (e) => {
        if (this._wasDragging) { e.preventDefault(); e.stopPropagation(); }
      });
      nameDiv.appendChild(enumNameLink);
      div.appendChild(nameDiv);

      const metaDiv = document.createElement('div');
      metaDiv.className = 'scope-state-node-meta';
      metaDiv.textContent = 'enum';
      div.appendChild(metaDiv);

      div.appendChild(this.createEnumValues(en.values));

      this.registerNode(div, en.id);
    }
  }

  layout() {
    const stateNodes = this.data.stateNodes;
    if (stateNodes.length === 0) return;

    const machines = this.data.machines || [];
    const machineNames = machines.map(m => m.name);

    // Group state nodes by machine
    const machineGroups = new Map();
    for (const mn of machineNames) {
      machineGroups.set(mn, stateNodes.filter(n => n.machine === mn));
    }

    // Layout each machine group
    const colGap = 260;
    const rowGap = 100;
    const machineGap = 120; // vertical gap between machine groups
    const startX = 200;
    let groupStartY = 60;

    // Track bounding box per machine for title positioning
    const machineBounds = new Map(); // name -> { minX, minY, maxX, maxY }

    for (const machineName of machineNames) {
      const group = machineGroups.get(machineName) || [];
      if (group.length === 0) continue;

      // Build adjacency for BFS within this machine
      const stateAdj = new Map();
      for (const edge of this.data.edges) {
        if (edge.edgeType === 'transition') {
          // Only edges within this machine
          const fromMachine = edge.from.split(':')[1];
          if (fromMachine === machineName) {
            if (!stateAdj.has(edge.from)) stateAdj.set(edge.from, []);
            stateAdj.get(edge.from).push(edge.to);
          }
        }
      }

      // BFS from initial states
      const initialIds = group.filter(n => n.isInitial).map(n => n.id);
      if (initialIds.length === 0 && group.length > 0) {
        initialIds.push(group[0].id);
      }

      const depth = new Map();
      const queue = [];
      for (const id of initialIds) {
        depth.set(id, 0);
        queue.push(id);
      }

      while (queue.length > 0) {
        const current = queue.shift();
        const currentDepth = depth.get(current);
        const neighbors = stateAdj.get(current) || [];
        for (const next of neighbors) {
          if (!depth.has(next)) {
            depth.set(next, currentDepth + 1);
            queue.push(next);
          }
        }
      }

      for (const node of group) {
        if (!depth.has(node.id)) depth.set(node.id, 0);
      }

      // Group by depth
      const columns = new Map();
      for (const [id, d] of depth) {
        if (!columns.has(d)) columns.set(d, []);
        columns.get(d).push(id);
      }

      // Position state nodes
      const sortedDepths = [...columns.keys()].sort((a, b) => a - b);
      let maxY = groupStartY;
      for (const d of sortedDepths) {
        const col = columns.get(d);
        const x = startX + d * colGap;
        let y = groupStartY;
        for (const id of col) {
          this.nodePositions.set(id, { x, y });
          const el = this.nodeElements.get(id);
          if (el) { el.style.left = x + 'px'; el.style.top = y + 'px'; }
          y += rowGap;
        }
        maxY = Math.max(maxY, y);
      }

      // Compute bounding box
      let minX = Infinity, minY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
      for (const node of group) {
        const pos = this.nodePositions.get(node.id);
        if (pos) {
          minX = Math.min(minX, pos.x);
          minY = Math.min(minY, pos.y);
          bMaxX = Math.max(bMaxX, pos.x + 160);
          bMaxY = Math.max(bMaxY, pos.y + 60);
        }
      }
      machineBounds.set(machineName, { minX, minY, maxX: bMaxX, maxY: bMaxY });

      // Next machine group starts below
      groupStartY = maxY + machineGap;
    }

    // Position title labels at top-left of each machine group
    const titleEls = this.worldEl.querySelectorAll('.scope-state-graph-title[data-machine]');
    for (const titleEl of titleEls) {
      const mn = titleEl.dataset.machine;
      const bounds = machineBounds.get(mn);
      if (bounds) {
        titleEl.style.position = 'absolute';
        titleEl.style.left = (bounds.minX - 10) + 'px';
        titleEl.style.top = (bounds.minY - 30) + 'px';
      }
    }

    // Position event nodes — shared events between machine groups, others near their group
    let eventIdx = 0;
    for (const ev of this.data.eventNodes) {
      const targetStates = this.data.edges
        .filter(e => e.edgeType === 'trigger' && e.from === ev.id)
        .map(e => e.to);

      let sumX = 0, sumY = 0, count = 0;
      for (const sid of targetStates) {
        const pos = this.nodePositions.get(sid);
        if (pos) { sumX += pos.x; sumY += pos.y; count++; }
      }

      if (count > 0) {
        const avgX = sumX / count;
        let avgY;
        if (ev.machines && ev.machines.length > 1) {
          // Shared event: position between the machine groups
          const groupYs = ev.machines.map(mn => {
            const bounds = machineBounds.get(mn);
            return bounds ? (bounds.minY + bounds.maxY) / 2 : 0;
          });
          avgY = groupYs.reduce((a, b) => a + b, 0) / groupYs.length;
          // Position to the right of all groups
          const maxBoundsX = Math.max(...ev.machines.map(mn => {
            const bounds = machineBounds.get(mn);
            return bounds ? bounds.maxX : 0;
          }));
          this.nodePositions.set(ev.id, { x: maxBoundsX + 80 + (eventIdx % 2) * 40, y: avgY });
        } else {
          avgY = sumY / count - 80 - (eventIdx % 2) * 30;
          this.nodePositions.set(ev.id, { x: avgX, y: avgY });
        }
      } else {
        this.nodePositions.set(ev.id, { x: startX + eventIdx * 180, y: 0 });
      }

      const el = this.nodeElements.get(ev.id);
      const pos = this.nodePositions.get(ev.id);
      if (el && pos) { el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px'; }
      eventIdx++;
    }

    // Position enum nodes to the left of their machine group
    for (const en of (this.data.enumNodes || [])) {
      const bounds = machineBounds.get(en.machine);
      const x = 30;
      const y = bounds ? bounds.minY + 20 : 80;
      this.nodePositions.set(en.id, { x, y });
      const el = this.nodeElements.get(en.id);
      if (el) { el.style.left = x + 'px'; el.style.top = y + 'px'; }
    }
  }

  renderEdges() {
    while (this.svgEl.firstChild) this.svgEl.removeChild(this.svgEl.firstChild);

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const createMarker = (id, color) => {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', id);
      marker.setAttribute('viewBox', '0 0 10 7');
      marker.setAttribute('refX', '10');
      marker.setAttribute('refY', '3.5');
      marker.setAttribute('markerWidth', '8');
      marker.setAttribute('markerHeight', '6');
      marker.setAttribute('orient', 'auto-start-reverse');
      const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrowPath.setAttribute('d', 'M 0 0 L 10 3.5 L 0 7 z');
      arrowPath.setAttribute('fill', color);
      marker.appendChild(arrowPath);
      return marker;
    };
    defs.appendChild(createMarker('state-arrow', 'var(--scope-text-tertiary)'));
    defs.appendChild(createMarker('state-arrow-trigger', 'var(--scope-diagram-state)'));
    defs.appendChild(createMarker('state-arrow-enum', 'var(--scope-pending)'));
    this.svgEl.appendChild(defs);

    for (const edge of this.data.edges) {
      this._renderStateEdge(edge);
    }
  }

  _renderStateEdge(edge) {
    const fromEl = this.nodeElements.get(edge.from);
    const toEl = this.nodeElements.get(edge.to);
    if (!fromEl || !toEl) return;

    const fromPos = this.nodePositions.get(edge.from);
    const toPos = this.nodePositions.get(edge.to);
    if (!fromPos || !toPos) return;

    const fromW = fromEl.offsetWidth;
    const fromH = fromEl.offsetHeight;
    const toW = toEl.offsetWidth;
    const toH = toEl.offsetHeight;

    const fromCX = fromPos.x + fromW / 2;
    const fromCY = fromPos.y + fromH / 2;
    const toCX = toPos.x + toW / 2;
    const toCY = toPos.y + toH / 2;

    const from = this._borderPoint(fromPos.x, fromPos.y, fromW, fromH, toCX, toCY);
    const to = this._borderPoint(toPos.x, toPos.y, toW, toH, fromCX, fromCY);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curvature = Math.min(dist * 0.25, 60);

    let c1x, c1y, c2x, c2y;
    if (Math.abs(dx) > Math.abs(dy)) {
      c1x = from.x + curvature * Math.sign(dx);
      c1y = from.y;
      c2x = to.x - curvature * Math.sign(dx);
      c2y = to.y;
    } else {
      c1x = from.x;
      c1y = from.y + curvature * Math.sign(dy);
      c2x = to.x;
      c2y = to.y - curvature * Math.sign(dy);
    }

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('scope-state-graph-edge-group');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`);
    path.classList.add('scope-state-graph-edge');
    path.classList.add(edge.edgeType);

    if (edge.edgeType === 'enum-value') {
      path.setAttribute('marker-end', 'url(#state-arrow-enum)');
    } else if (edge.edgeType === 'trigger') {
      path.setAttribute('marker-end', 'url(#state-arrow-trigger)');
    } else {
      path.setAttribute('marker-end', 'url(#state-arrow)');
    }

    group.appendChild(path);

    // Add label on edge midpoint
    if (edge.label) {
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', mx);
      label.setAttribute('y', my - 6);
      label.setAttribute('text-anchor', 'middle');
      label.classList.add('scope-state-graph-edge-label');
      label.textContent = edge.label;
      group.appendChild(label);
    }

    this.svgEl.appendChild(group);
  }

  destroy() {
    super.destroy();
    stateGraphInstances.delete(this.container);
  }
}

function initStateGraphs() {
  for (const [el, graph] of stateGraphInstances) {
    graph.destroy();
  }
  stateGraphInstances.clear();

  document.querySelectorAll('.scope-state-graph').forEach(container => {
    if (stateGraphInstances.has(container)) return;
    const panel = container.closest('.scope-tab-panel');
    if (panel && !panel.classList.contains('active')) return;
    const graph = new StateGraph(container);
    stateGraphInstances.set(container, graph);
  });
}

function initStateGraphsIn(parent) {
  parent.querySelectorAll('.scope-state-graph').forEach(container => {
    const existing = stateGraphInstances.get(container);
    if (existing) existing.destroy();
    const graph = new StateGraph(container);
    stateGraphInstances.set(container, graph);
  });
}

// ===== ScreenGraph — Interactive Screen/Element/Action Graph =====

/** @type {Map<HTMLElement, ScreenGraph>} */
const screenGraphInstances = new Map();

class ScreenGraph extends BaseGraph {
  constructor(container) {
    super(container, 'screen',
      '.scope-screen-graph-edges',
      '.scope-screen-graph-world',
      '.scope-graph-node.scope-screen-node, .scope-graph-node.scope-screen-element-node, .scope-graph-node.scope-screen-action-node, .scope-graph-node.scope-screen-api-node, .scope-graph-node.scope-screen-entity-node, .scope-graph-node.scope-screen-signal-node',
      'nodeId'
    );
  }

  renderNodes() {
    this.worldEl.innerHTML = '';

    // Screen nodes (lightweight containers)
    for (const screen of this.data.screens) {
      const div = this.createNode(screen, 'scope-screen-node');
      div.appendChild(this.createHeader(screen));
      div.appendChild(this.createTypeLabel('screen'));

      // Layout badge
      if (screen.layout) {
        const layoutBadge = document.createElement('div');
        layoutBadge.className = 'scope-screen-layout';
        layoutBadge.textContent = '@layout(' + screen.layout + ')';
        div.appendChild(layoutBadge);
      }

      // Uses count
      if (screen.usesElements && screen.usesElements.length > 0) {
        const uses = document.createElement('div');
        uses.className = 'scope-screen-uses-count';
        uses.textContent = screen.usesElements.length + ' element' + (screen.usesElements.length > 1 ? 's' : '');
        div.appendChild(uses);
      }

      this.registerNode(div, screen.id);
    }

    // Element nodes (main building blocks)
    for (const el of this.data.elements) {
      const div = this.createNode(el, 'scope-screen-element-node');
      this.applyAbstractInterface(div, el);
      div.appendChild(this.createHeader(el));

      const typeLabel = this.createTypeLabel('element');
      this.createAbstractBadge(typeLabel, el);
      div.appendChild(typeLabel);

      const inh = this.createInheritanceLine(el);
      if (inh) div.appendChild(inh);

      if (el.ghost) div.appendChild(this.createGhostOrigin(el));

      // Props
      if (el.props && el.props.length > 0) {
        div.appendChild(this.createFields(el.props));
      }

      // Forms
      if (el.forms && el.forms.length > 0) {
        const formsList = document.createElement('div');
        formsList.className = 'scope-screen-forms-list';
        for (const f of el.forms) {
          const formItem = document.createElement('div');
          formItem.className = 'scope-screen-form-item';
          const name = document.createElement('div');
          name.className = 'scope-screen-form-name';
          name.textContent = f.name;
          formItem.appendChild(name);
          for (const field of (f.fields || []).slice(0, 4)) {
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'scope-screen-form-field';
            const fname = document.createElement('span');
            fname.textContent = field.name;
            const ftype = document.createElement('span');
            ftype.innerHTML = field.typeHtml;
            fieldDiv.appendChild(fname);
            fieldDiv.appendChild(ftype);
            formItem.appendChild(fieldDiv);
          }
          formsList.appendChild(formItem);
        }
        div.appendChild(formsList);
      }

      this.registerNode(div, el.id);
    }

    // Action nodes
    for (const action of this.data.actions) {
      const div = this.createNode(action, 'scope-screen-action-node');
      div.appendChild(this.createHeader(action));
      div.appendChild(this.createTypeLabel('action'));

      // Endpoint or stream
      if (action.callsEndpoint) {
        const ep = document.createElement('div');
        ep.className = 'scope-action-endpoint';
        ep.textContent = 'calls ' + action.callsEndpoint;
        div.appendChild(ep);
      }
      if (action.onStream) {
        const st = document.createElement('div');
        st.className = 'scope-action-endpoint';
        st.textContent = 'on ' + action.onStream;
        div.appendChild(st);
      }
      if (action.emitsSignal) {
        const sig = document.createElement('div');
        sig.className = 'scope-action-signal';
        sig.textContent = 'emits ' + action.emitsSignal;
        div.appendChild(sig);
      }
      if (action.onSignal) {
        const sig = document.createElement('div');
        sig.className = 'scope-action-signal';
        sig.textContent = 'on ' + action.onSignal;
        div.appendChild(sig);
      }

      // Results
      if (action.results && action.results.length > 0) {
        const resultsList = document.createElement('div');
        resultsList.className = 'scope-action-results';
        for (const r of action.results) {
          const item = document.createElement('div');
          item.className = 'scope-action-result';
          const pipe = document.createElement('span');
          pipe.textContent = '| ';
          pipe.style.color = 'var(--scope-text-tertiary)';
          item.appendChild(pipe);
          const outcome = document.createElement('span');
          outcome.className = 'scope-action-result-outcome';
          outcome.textContent = r.outcome;
          item.appendChild(outcome);
          const arrow = document.createElement('span');
          arrow.textContent = ' \u2192 ';
          arrow.style.color = 'var(--scope-text-tertiary)';
          item.appendChild(arrow);
          const screenSpan = document.createElement('span');
          screenSpan.className = r.screen === 'end' ? 'scope-action-result-end' : 'scope-action-result-screen';
          screenSpan.textContent = r.screen;
          item.appendChild(screenSpan);
          resultsList.appendChild(item);
        }
        div.appendChild(resultsList);
      }

      this.registerNode(div, action.id);
    }

    // API endpoint nodes
    for (const ep of (this.data.apiEndpoints || [])) {
      const div = this.createNode(ep, 'scope-screen-api-node');

      // Header with method badge
      const header = document.createElement('div');
      header.className = 'scope-node-header';
      const methodBadge = document.createElement('span');
      methodBadge.className = 'scope-api-method-badge scope-api-method--' + ep.method.toLowerCase();
      methodBadge.textContent = ep.method;
      header.appendChild(methodBadge);
      div.appendChild(header);

      // Path
      const pathDiv = document.createElement('div');
      pathDiv.className = 'scope-api-path';
      pathDiv.textContent = ep.path;
      div.appendChild(pathDiv);

      // Return type
      if (ep.returnType) {
        const retDiv = document.createElement('div');
        retDiv.className = 'scope-api-return';
        retDiv.textContent = '\u2192 ' + ep.returnType;
        div.appendChild(retDiv);
      }

      this.registerNode(div, ep.id);
    }

    // Signal nodes
    for (const sig of (this.data.signalNodes || [])) {
      const div = this.createNode(sig, 'scope-screen-signal-node');
      div.appendChild(this.createLink(sig));
      div.appendChild(this.createTypeLabel('signal'));
      this.registerNode(div, sig.id);
    }

    // Construct nodes (entities/events/enums connected from endpoints)
    for (const cn of (this.data.constructNodes || [])) {
      const div = this.createNode(cn, 'scope-screen-entity-node');
      div.appendChild(this.createLink(cn));
      div.appendChild(this.createTypeLabel(cn.constructType));
      this.registerNode(div, cn.id);
    }

  }

  layout() {
    const screens = this.data.screens;
    if (screens.length === 0 && this.data.elements.length === 0) return;

    // Layout (top-to-bottom rows):
    //   Row 0: Screens — horizontal, spaced apart
    //   Row 1: Concrete elements — horizontal below their screen
    //   Row 2: Dependencies (abstract/interface elements) — below the element that uses them
    //   Row 3: Actions — horizontal
    //   Row 4: API endpoints — horizontal
    //   Row 5: Signals — horizontal
    const rowGap = 50;
    const nodeGap = 25;
    const screenGap = 160;  // horizontal gap between screen groups

    const getSize = (id) => {
      const el = this.nodeElements.get(id);
      return el ? { w: el.offsetWidth, h: el.offsetHeight } : { w: 200, h: 80 };
    };

    // Build edge maps
    const screenToElementIds = new Map();
    const elementToExtendsId = new Map();  // element → abstract element id (extends)
    const elementToImplIds = new Map();    // element → interface element ids (implements)

    for (const edge of this.data.edges) {
      const pushEdge = (map, key, val) => {
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(val);
      };
      if (edge.edgeType === 'contains') pushEdge(screenToElementIds, edge.from, edge.to);
      if (edge.edgeType === 'extends') elementToExtendsId.set(edge.from, edge.to);
      if (edge.edgeType === 'implements') pushEdge(elementToImplIds, edge.from, edge.to);
    }

    const placed = new Set();
    const startX = 40;
    const startY = 40;

    // === Row 0: Screens horizontal ===
    let curX = startX;
    const screenGroups = []; // { screenId, x, elements: [{id, x}], deps: [{id, parentX}] }

    for (const screen of screens) {
      const sSize = getSize(screen.id);
      const elIds = (screenToElementIds.get(screen.id) || []).filter(id => !placed.has(id));

      // Mark concrete elements as placed
      elIds.forEach(id => placed.add(id));

      // Calculate group width: all elements side by side
      let elementsWidth = 0;
      for (let i = 0; i < elIds.length; i++) {
        if (i > 0) elementsWidth += nodeGap;
        elementsWidth += getSize(elIds[i]).w;
      }
      const groupWidth = Math.max(sSize.w, elementsWidth);

      screenGroups.push({ screenId: screen.id, x: curX, groupWidth, elIds });

      // Place screen centered above its elements
      this.nodePositions.set(screen.id, {
        x: curX + (groupWidth - sSize.w) / 2,
        y: startY
      });
      placed.add(screen.id);

      curX += groupWidth + screenGap;
    }

    // Screen row bottom
    let row0Bottom = startY;
    for (const s of screens) row0Bottom = Math.max(row0Bottom, startY + getSize(s.id).h);

    // === Row 1: Concrete elements horizontal below their screen ===
    const row1Y = row0Bottom + rowGap;
    const elementPositions = new Map(); // element id → { x, y, w }

    for (const group of screenGroups) {
      // Calculate total elements width
      let totalW = 0;
      for (let i = 0; i < group.elIds.length; i++) {
        if (i > 0) totalW += nodeGap;
        totalW += getSize(group.elIds[i]).w;
      }
      // Center elements under screen group
      let elX = group.x + (group.groupWidth - totalW) / 2;

      for (const elId of group.elIds) {
        const size = getSize(elId);
        this.nodePositions.set(elId, { x: elX, y: row1Y });
        elementPositions.set(elId, { x: elX, y: row1Y, w: size.w });
        elX += size.w + nodeGap;
      }
    }

    // Row 1 bottom
    let row1Bottom = row1Y;
    for (const group of screenGroups) {
      for (const elId of group.elIds) {
        row1Bottom = Math.max(row1Bottom, row1Y + getSize(elId).h);
      }
    }

    // === Row 2: Dependencies (abstract, interface, entity) below their parent element ===
    const row2Y = row1Bottom + rowGap;

    // Build: for each concrete element, collect its dependencies (extends, implements)
    // Each dep placed below the element center, accumulating horizontally
    const allConcreteEls = screenGroups.flatMap(g => g.elIds);
    let row2Bottom = row2Y;

    for (const elId of allConcreteEls) {
      const deps = [];
      // extends → abstract element
      const extendsId = elementToExtendsId.get(elId);
      if (extendsId && !placed.has(extendsId)) deps.push(extendsId);
      // implements → interface elements
      const implIds = elementToImplIds.get(elId) || [];
      for (const iid of implIds) {
        if (!placed.has(iid)) deps.push(iid);
      }
      if (deps.length === 0) continue;

      // Place deps horizontally, centered below parent element
      const parentPos = elementPositions.get(elId);
      if (!parentPos) continue;
      const parentCenterX = parentPos.x + parentPos.w / 2;

      let totalDepsW = 0;
      for (let i = 0; i < deps.length; i++) {
        if (i > 0) totalDepsW += nodeGap;
        totalDepsW += getSize(deps[i]).w;
      }
      let depX = parentCenterX - totalDepsW / 2;

      for (const depId of deps) {
        placed.add(depId);
        const size = getSize(depId);
        this.nodePositions.set(depId, { x: depX, y: row2Y });
        depX += size.w + nodeGap;
        row2Bottom = Math.max(row2Bottom, row2Y + size.h);
      }
    }

    // Place any remaining unplaced elements (abstract/interface not referenced by concrete)
    let orphanX = curX;
    for (const el of this.data.elements) {
      if (placed.has(el.id)) continue;
      placed.add(el.id);
      const size = getSize(el.id);
      this.nodePositions.set(el.id, { x: orphanX, y: row1Y });
      orphanX += size.w + nodeGap;
      row1Bottom = Math.max(row1Bottom, row1Y + size.h);
    }

    // === Row 3: Actions horizontal ===
    const row3Y = Math.max(row2Bottom, row1Bottom) + rowGap;
    let actionX = startX;
    for (const action of this.data.actions) {
      const size = getSize(action.id);
      this.nodePositions.set(action.id, { x: actionX, y: row3Y });
      placed.add(action.id);
      actionX += size.w + nodeGap * 3;
    }

    let row3Bottom = row3Y;
    for (const action of this.data.actions) {
      row3Bottom = Math.max(row3Bottom, row3Y + getSize(action.id).h);
    }

    // === Row 4: API endpoints horizontal ===
    let row4Bottom = row3Bottom;
    const apiEndpoints = this.data.apiEndpoints || [];
    if (apiEndpoints.length > 0) {
      const row4Y = row3Bottom + rowGap;
      let apiX = startX;
      for (const ep of apiEndpoints) {
        const size = getSize(ep.id);
        this.nodePositions.set(ep.id, { x: apiX, y: row4Y });
        placed.add(ep.id);
        apiX += size.w + nodeGap * 3;
        row4Bottom = Math.max(row4Bottom, row4Y + size.h);
      }
    }

    // === Row 5: Construct nodes (entities/events from endpoints) ===
    let row5Bottom = row4Bottom;
    const constructNodes = this.data.constructNodes || [];
    if (constructNodes.length > 0) {
      const row5Y = row4Bottom + rowGap;
      let cnX = startX;
      for (const cn of constructNodes) {
        const size = getSize(cn.id);
        this.nodePositions.set(cn.id, { x: cnX, y: row5Y });
        placed.add(cn.id);
        cnX += size.w + nodeGap * 3;
        row5Bottom = Math.max(row5Bottom, row5Y + size.h);
      }
    }

    // === Row 6: Signals horizontal ===
    const signalNodes = this.data.signalNodes || [];
    if (signalNodes.length > 0) {
      const row6Y = row5Bottom + rowGap;
      let sigX = startX;
      for (const sig of signalNodes) {
        const size = getSize(sig.id);
        this.nodePositions.set(sig.id, { x: sigX, y: row6Y });
        placed.add(sig.id);
        sigX += size.w + nodeGap * 3;
      }
    }

    // Apply positions
    for (const [id, pos] of this.nodePositions) {
      const el = this.nodeElements.get(id);
      if (el) {
        el.style.left = pos.x + 'px';
        el.style.top = pos.y + 'px';
      }
    }
  }

  _resolveOverlaps(ids, gap) {
    const sorted = ids
      .map(id => ({ id, pos: this.nodePositions.get(id), el: this.nodeElements.get(id) }))
      .filter(n => n.pos && n.el)
      .sort((a, b) => a.pos.y - b.pos.y);

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const prevBottom = prev.pos.y + prev.el.offsetHeight;
      if (curr.pos.y < prevBottom + gap) {
        curr.pos.y = prevBottom + gap;
        this.nodePositions.set(curr.id, curr.pos);
      }
    }
  }

  renderEdges() {
    while (this.svgEl.firstChild) this.svgEl.removeChild(this.svgEl.firstChild);

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const createMarker = (id, color) => {
      const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      m.setAttribute('id', id);
      m.setAttribute('viewBox', '0 0 10 7');
      m.setAttribute('refX', '10');
      m.setAttribute('refY', '3.5');
      m.setAttribute('markerWidth', '8');
      m.setAttribute('markerHeight', '6');
      m.setAttribute('orient', 'auto-start-reverse');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M 0 0 L 10 3.5 L 0 7 z');
      p.setAttribute('fill', color);
      m.appendChild(p);
      return m;
    };
    defs.appendChild(createMarker('screen-arrow', 'var(--scope-text-tertiary)'));
    defs.appendChild(createMarker('screen-arrow-contains', 'var(--scope-diagram-screen)'));
    defs.appendChild(createMarker('screen-arrow-action', 'var(--scope-diagram-flow)'));
    defs.appendChild(createMarker('screen-arrow-calls', 'var(--scope-accent)'));
    defs.appendChild(createMarker('screen-arrow-stream', 'var(--scope-wip)'));
    defs.appendChild(createMarker('screen-arrow-result', 'var(--scope-diagram-screen)'));
    defs.appendChild(createMarker('screen-arrow-extends', 'var(--scope-wip)'));
    defs.appendChild(createMarker('screen-arrow-implements', 'var(--scope-diagram-flow)'));
    defs.appendChild(createMarker('screen-arrow-emits-signal', '#A78BFA'));
    defs.appendChild(createMarker('screen-arrow-on-signal', '#A78BFA'));
    defs.appendChild(createMarker('screen-arrow-returns', 'var(--scope-diagram-entity)'));
    this.svgEl.appendChild(defs);

    for (const edge of this.data.edges) {
      this._renderEdge(edge);
    }
  }

  _renderEdge(edge) {
    const fromEl = this.nodeElements.get(edge.from);
    const toEl = this.nodeElements.get(edge.to);
    if (!fromEl || !toEl) return;

    const fromPos = this.nodePositions.get(edge.from);
    const toPos = this.nodePositions.get(edge.to);
    if (!fromPos || !toPos) return;

    const fromW = fromEl.offsetWidth;
    const fromH = fromEl.offsetHeight;
    const toW = toEl.offsetWidth;
    const toH = toEl.offsetHeight;

    const fromCX = fromPos.x + fromW / 2;
    const fromCY = fromPos.y + fromH / 2;
    const toCX = toPos.x + toW / 2;
    const toCY = toPos.y + toH / 2;

    const from = this._borderPoint(fromPos.x, fromPos.y, fromW, fromH, toCX, toCY);
    const to = this._borderPoint(toPos.x, toPos.y, toW, toH, fromCX, fromCY);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curvature = Math.min(dist * 0.3, 80);

    let c1x, c1y, c2x, c2y;
    if (Math.abs(dx) > Math.abs(dy)) {
      c1x = from.x + curvature * Math.sign(dx);
      c1y = from.y;
      c2x = to.x - curvature * Math.sign(dx);
      c2y = to.y;
    } else {
      c1x = from.x;
      c1y = from.y + curvature * Math.sign(dy);
      c2x = to.x;
      c2y = to.y - curvature * Math.sign(dy);
    }

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`);
    path.classList.add('scope-screen-graph-edge');
    path.classList.add(edge.edgeType);

    // Marker per edge type
    const markerMap = {
      'contains': 'screen-arrow-contains',
      'action': 'screen-arrow-action',
      'calls': 'screen-arrow-calls',
      'on-stream': 'screen-arrow-stream',
      'result': 'screen-arrow-result',
      'extends': 'screen-arrow-extends',
      'implements': 'screen-arrow-implements',
      'emits-signal': 'screen-arrow-emits-signal',
      'on-signal': 'screen-arrow-on-signal',
      'returns': 'screen-arrow-returns',
    };
    const marker = markerMap[edge.edgeType] || 'screen-arrow';
    path.setAttribute('marker-end', `url(#${marker})`);
    group.appendChild(path);

    // Label
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', midX);
    label.setAttribute('y', midY - 6);
    label.setAttribute('text-anchor', 'middle');
    label.classList.add('scope-screen-graph-edge-label');
    label.textContent = edge.label;
    group.appendChild(label);

    this.svgEl.appendChild(group);
  }

  destroy() {
    super.destroy();
    screenGraphInstances.delete(this.container);
  }
}

function initScreenGraphs() {
  for (const [el, graph] of screenGraphInstances) {
    graph.destroy();
  }
  screenGraphInstances.clear();

  document.querySelectorAll('.scope-screen-graph').forEach(container => {
    if (screenGraphInstances.has(container)) return;
    const panel = container.closest('.scope-tab-panel');
    if (panel && !panel.classList.contains('active')) return;
    const graph = new ScreenGraph(container);
    screenGraphInstances.set(container, graph);
  });
}

function initScreenGraphsIn(parent) {
  parent.querySelectorAll('.scope-screen-graph').forEach(container => {
    const existing = screenGraphInstances.get(container);
    if (existing) existing.destroy();
    const graph = new ScreenGraph(container);
    screenGraphInstances.set(container, graph);
  });
}

// ===== ApiGraph — Interactive API Endpoint Graph =====

/** @type {Map<HTMLElement, ApiGraph>} */
const apiGraphInstances = new Map();

class ApiGraph extends BaseGraph {
  constructor(container) {
    super(container, 'api',
      '.scope-api-graph-edges',
      '.scope-api-graph-world',
      '.scope-graph-node.scope-api-endpoint-node, .scope-graph-node.scope-api-handler-node, .scope-graph-node.scope-api-consumer-node, .scope-graph-node.scope-api-construct-node',
      'nodeId'
    );
  }

  renderNodes() {
    this.worldEl.innerHTML = '';

    // Endpoint nodes (center column)
    for (const ep of this.data.endpoints) {
      const div = this.createNode(ep, 'scope-api-endpoint-node' + (ep.isExternal ? ' external' : ''));

      // Prefix + external label (top label inside node)
      if (ep.prefix || ep.isExternal) {
        const prefixLabel = document.createElement('div');
        prefixLabel.className = 'scope-api-prefix-label';
        let labelText = ep.prefix || '';
        if (ep.isExternal) {
          labelText += (labelText ? ' ' : '') + '@external';
        }
        prefixLabel.textContent = labelText;
        div.appendChild(prefixLabel);
      }

      // Method badge
      const header = document.createElement('div');
      header.className = 'scope-node-header';
      const methodBadge = document.createElement('span');
      methodBadge.className = 'scope-api-method-badge scope-api-method--' + ep.method.toLowerCase();
      methodBadge.textContent = ep.method;
      header.appendChild(methodBadge);
      if (ep.hasAuth) {
        const authBadge = document.createElement('span');
        authBadge.className = 'scope-api-auth-badge';
        authBadge.textContent = '@auth';
        header.appendChild(authBadge);
      }
      div.appendChild(header);

      // Path
      const pathDiv = document.createElement('div');
      pathDiv.className = 'scope-api-path';
      pathDiv.textContent = ep.fullPath;
      div.appendChild(pathDiv);

      // IO types
      if (ep.inputTypeHtml) {
        const inputDiv = document.createElement('div');
        inputDiv.className = 'scope-api-io';
        inputDiv.innerHTML = '<span class="scope-api-io-label">in:</span> ' + ep.inputTypeHtml;
        div.appendChild(inputDiv);
      }
      if (ep.outputTypeHtml) {
        const outputDiv = document.createElement('div');
        outputDiv.className = 'scope-api-io';
        outputDiv.innerHTML = '<span class="scope-api-io-label">out:</span> ' + ep.outputTypeHtml;
        div.appendChild(outputDiv);
      }

      this.registerNode(div, ep.id);
    }

    // Handler nodes (left column — operations/flows)
    for (const handler of this.data.handlers) {
      const handlerClass = handler.constructType === 'flow' ? 'scope-api-handler-node scope-api-handler-node--flow' : 'scope-api-handler-node';
      const div = this.createNode(handler, handlerClass);
      div.appendChild(this.createHeader(handler));
      div.appendChild(this.createTypeLabel(handler.constructType || 'operation'));

      // Signature
      const sigDiv = document.createElement('div');
      sigDiv.className = 'scope-api-handler-sig';
      sigDiv.textContent = handler.signature;
      div.appendChild(sigDiv);

      // Direction badge
      const dirBadge = document.createElement('div');
      dirBadge.className = 'scope-api-direction scope-api-direction--' + handler.direction;
      dirBadge.textContent = handler.direction;
      div.appendChild(dirBadge);

      this.registerNode(div, handler.id);
    }

    // Consumer nodes (right column — actions)
    for (const consumer of this.data.consumers) {
      const div = this.createNode(consumer, 'scope-api-consumer-node');
      div.appendChild(this.createHeader(consumer));
      div.appendChild(this.createTypeLabel('action'));

      // Endpoint or stream reference
      if (consumer.callsEndpoint) {
        const ep = document.createElement('div');
        ep.className = 'scope-action-endpoint';
        ep.textContent = 'calls ' + consumer.callsEndpoint;
        div.appendChild(ep);
      }
      if (consumer.onStream) {
        const st = document.createElement('div');
        st.className = 'scope-action-endpoint';
        st.textContent = 'on ' + consumer.onStream;
        div.appendChild(st);
      }

      this.registerNode(div, consumer.id);
    }

    // Construct nodes (bottom — entities/events/enums)
    for (const cn of this.data.constructs) {
      const div = this.createNode(cn, 'scope-api-construct-node');
      div.classList.add('scope-api-construct-node--' + cn.constructType);
      div.appendChild(this.createLink(cn));
      div.appendChild(this.createTypeLabel(cn.constructType));
      this.registerNode(div, cn.id);
    }
  }

  layout() {
    const endpoints = this.data.endpoints;
    if (endpoints.length === 0) return;

    const colGap = 100;
    const rowGap = 25;
    const groupGap = 30;

    // Measure column widths
    let maxHandlerW = 0, maxEndpointW = 0, maxConsumerW = 0;

    for (const h of this.data.handlers) {
      const el = this.nodeElements.get(h.id);
      if (el) maxHandlerW = Math.max(maxHandlerW, el.offsetWidth);
    }
    for (const ep of endpoints) {
      const el = this.nodeElements.get(ep.id);
      if (el) maxEndpointW = Math.max(maxEndpointW, el.offsetWidth);
    }
    for (const c of this.data.consumers) {
      const el = this.nodeElements.get(c.id);
      if (el) maxConsumerW = Math.max(maxConsumerW, el.offsetWidth);
    }

    if (maxHandlerW === 0) maxHandlerW = 200;
    if (maxEndpointW === 0) maxEndpointW = 220;
    if (maxConsumerW === 0) maxConsumerW = 200;

    const hasHandlers = this.data.handlers.length > 0;
    const hasConsumers = this.data.consumers.length > 0;

    // Column X positions
    const handlerColX = 40;
    const endpointColX = hasHandlers ? handlerColX + maxHandlerW + colGap : 40;
    const consumerColX = endpointColX + maxEndpointW + colGap;

    // --- Position endpoints sequentially ---
    let endpointY = 40;
    const endpointCenters = new Map(); // epId → { cy }

    for (const ep of endpoints) {
      const el = this.nodeElements.get(ep.id);
      const h = el ? el.offsetHeight : 60;
      this.nodePositions.set(ep.id, { x: endpointColX, y: endpointY });
      endpointCenters.set(ep.id, { cy: endpointY + h / 2 });
      endpointY += h + rowGap;
    }

    // --- Position handlers (left column) aligned to their connected endpoints ---
    const handlerUsedY = [];
    // Build handler → endpoint connection map
    const handlerToEndpoints = new Map();
    for (const edge of this.data.edges) {
      if (edge.edgeType === 'handles' || edge.edgeType === 'calls') {
        if (edge.from.startsWith('handler:')) {
          if (!handlerToEndpoints.has(edge.from)) handlerToEndpoints.set(edge.from, []);
          handlerToEndpoints.get(edge.from).push(edge.to);
        }
      }
    }

    for (const handler of this.data.handlers) {
      const el = this.nodeElements.get(handler.id);
      const h = el ? el.offsetHeight : 40;

      // Avg Y of connected endpoints
      const connectedEps = handlerToEndpoints.get(handler.id) || [];
      let targetCY = 40;
      if (connectedEps.length > 0) {
        let sum = 0, cnt = 0;
        for (const epId of connectedEps) {
          const ec = endpointCenters.get(epId);
          if (ec) { sum += ec.cy; cnt++; }
        }
        if (cnt > 0) targetCY = sum / cnt;
      }

      let targetY = targetCY - h / 2;
      for (const ry of handlerUsedY) {
        if (Math.abs(targetY - ry.y) < ry.h + 10) targetY = ry.y + ry.h + 10;
      }
      this.nodePositions.set(handler.id, { x: handlerColX, y: targetY });
      handlerUsedY.push({ y: targetY, h });
    }

    // --- Position consumers (right column) aligned to their connected endpoints ---
    const consumerUsedY = [];
    const endpointToConsumers = new Map();
    for (const edge of this.data.edges) {
      if (edge.edgeType === 'calls-action' || edge.edgeType === 'on-stream') {
        if (!endpointToConsumers.has(edge.from)) endpointToConsumers.set(edge.from, []);
        endpointToConsumers.get(edge.from).push(edge.to);
      }
    }

    for (const consumer of this.data.consumers) {
      const el = this.nodeElements.get(consumer.id);
      const h = el ? el.offsetHeight : 40;

      // Find which endpoint connects to this consumer
      let targetCY = 40;
      for (const edge of this.data.edges) {
        if ((edge.edgeType === 'calls-action' || edge.edgeType === 'on-stream') && edge.to === consumer.id) {
          const ec = endpointCenters.get(edge.from);
          if (ec) { targetCY = ec.cy; break; }
        }
      }

      let targetY = targetCY - h / 2;
      for (const ry of consumerUsedY) {
        if (Math.abs(targetY - ry.y) < ry.h + 10) targetY = ry.y + ry.h + 10;
      }
      this.nodePositions.set(consumer.id, { x: hasConsumers ? consumerColX : endpointColX + maxEndpointW + colGap, y: targetY });
      consumerUsedY.push({ y: targetY, h });
    }

    // --- Position construct nodes (below all columns, horizontal) ---
    const constructY = endpointY + 20;
    let constructX = endpointColX;
    for (const cn of this.data.constructs) {
      const el = this.nodeElements.get(cn.id);
      const w = el ? el.offsetWidth : 150;
      this.nodePositions.set(cn.id, { x: constructX, y: constructY });
      constructX += w + 40;
    }

    // Apply positions
    for (const [id, pos] of this.nodePositions) {
      const el = this.nodeElements.get(id);
      if (el) {
        el.style.left = pos.x + 'px';
        el.style.top = pos.y + 'px';
      }
    }
  }

  renderEdges() {
    while (this.svgEl.firstChild) this.svgEl.removeChild(this.svgEl.firstChild);

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const createMarker = (id, color) => {
      const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      m.setAttribute('id', id);
      m.setAttribute('viewBox', '0 0 10 7');
      m.setAttribute('refX', '10');
      m.setAttribute('refY', '3.5');
      m.setAttribute('markerWidth', '8');
      m.setAttribute('markerHeight', '6');
      m.setAttribute('orient', 'auto-start-reverse');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M 0 0 L 10 3.5 L 0 7 z');
      p.setAttribute('fill', color);
      m.appendChild(p);
      return m;
    };

    defs.appendChild(createMarker('api-arrow-handles', '#4caf50'));
    defs.appendChild(createMarker('api-arrow-calls', '#2196f3'));
    defs.appendChild(createMarker('api-arrow-calls-action', 'var(--scope-accent)'));
    defs.appendChild(createMarker('api-arrow-on-stream', '#9c27b0'));
    defs.appendChild(createMarker('api-arrow-input', 'var(--scope-diagram-entity)'));
    defs.appendChild(createMarker('api-arrow-output', 'var(--scope-diagram-entity)'));
    this.svgEl.appendChild(defs);

    for (const edge of this.data.edges) {
      this._renderEdge(edge);
    }
  }

  _renderEdge(edge) {
    const fromEl = this.nodeElements.get(edge.from);
    const toEl = this.nodeElements.get(edge.to);
    if (!fromEl || !toEl) return;

    const fromPos = this.nodePositions.get(edge.from);
    const toPos = this.nodePositions.get(edge.to);
    if (!fromPos || !toPos) return;

    const fromW = fromEl.offsetWidth;
    const fromH = fromEl.offsetHeight;
    const toW = toEl.offsetWidth;
    const toH = toEl.offsetHeight;

    const fromCX = fromPos.x + fromW / 2;
    const fromCY = fromPos.y + fromH / 2;
    const toCX = toPos.x + toW / 2;
    const toCY = toPos.y + toH / 2;

    const from = this._borderPoint(fromPos.x, fromPos.y, fromW, fromH, toCX, toCY);
    const to = this._borderPoint(toPos.x, toPos.y, toW, toH, fromCX, fromCY);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curvature = Math.min(dist * 0.3, 80);

    let c1x, c1y, c2x, c2y;
    if (Math.abs(dx) > Math.abs(dy)) {
      c1x = from.x + curvature * Math.sign(dx);
      c1y = from.y;
      c2x = to.x - curvature * Math.sign(dx);
      c2y = to.y;
    } else {
      c1x = from.x;
      c1y = from.y + curvature * Math.sign(dy);
      c2x = to.x;
      c2y = to.y - curvature * Math.sign(dy);
    }

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('scope-api-graph-edge-group');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`);
    path.classList.add('scope-api-graph-edge');
    path.classList.add(edge.edgeType);
    path.setAttribute('marker-end', 'url(#api-arrow-' + edge.edgeType + ')');
    group.appendChild(path);

    // Label at midpoint
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', midX);
    label.setAttribute('y', midY - 6);
    label.setAttribute('text-anchor', 'middle');
    label.classList.add('scope-api-graph-edge-label');
    label.textContent = edge.label;
    group.appendChild(label);

    this.svgEl.appendChild(group);
  }

  destroy() {
    super.destroy();
    apiGraphInstances.delete(this.container);
  }
}

function initApiGraphs() {
  for (const [el, graph] of apiGraphInstances) {
    graph.destroy();
  }
  apiGraphInstances.clear();

  document.querySelectorAll('.scope-api-graph').forEach(container => {
    if (apiGraphInstances.has(container)) return;
    const panel = container.closest('.scope-tab-panel');
    if (panel && !panel.classList.contains('active')) return;
    const graph = new ApiGraph(container);
    apiGraphInstances.set(container, graph);
  });
}

function initApiGraphsIn(parent) {
  parent.querySelectorAll('.scope-api-graph').forEach(container => {
    const existing = apiGraphInstances.get(container);
    if (existing) existing.destroy();
    const graph = new ApiGraph(container);
    apiGraphInstances.set(container, graph);
  });
}

// ===== JourneyGraph — Interactive Journey Graph =====

/** @type {Map<HTMLElement, JourneyGraph>} */
const journeyGraphInstances = new Map();

class JourneyGraph extends BaseGraph {
  constructor(container) {
    super(container, 'journey',
      '.scope-journey-graph-edges',
      '.scope-journey-graph-world',
      '.scope-graph-node.scope-journey-screen-node, .scope-graph-node.scope-journey-trigger-node, .scope-graph-node.scope-journey-special-node, .scope-graph-node.scope-journey-action-node',
      'nodeId'
    );
  }

  renderNodes() {
    this.worldEl.innerHTML = '';

    const label = this.data.journeyLabel;

    // Screen nodes
    for (const screen of this.data.screenNodes) {
      const div = this.createNode(screen, 'scope-journey-screen-node');

      // Journey label inside node (like API prefix)
      const labelDiv = document.createElement('div');
      labelDiv.className = 'scope-journey-label';
      labelDiv.textContent = label;
      div.appendChild(labelDiv);

      div.appendChild(this.createLink(screen));
      div.appendChild(this.createTypeLabel('screen'));
      this.registerNode(div, screen.id);
    }

    // Trigger nodes (event, signal, or unresolved)
    for (const trigger of this.data.triggerNodes) {
      const kind = trigger.triggerKind || (trigger.isEvent ? 'event' : 'unresolved'); // fallback for old data
      const isResolved = kind !== 'unresolved';
      const div = this.createNode(trigger, 'scope-journey-trigger-node' + (isResolved ? '' : ' unresolved'));
      div.classList.add('scope-journey-trigger--' + kind);
      if (isResolved && trigger.href !== '#') {
        div.appendChild(this.createLink(trigger));
      } else {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'scope-journey-trigger-name';
        nameSpan.textContent = trigger.name;
        div.appendChild(nameSpan);
      }
      div.appendChild(this.createTypeLabel(kind));
      this.registerNode(div, trigger.id);
    }

    // Special nodes (* wildcard, end)
    for (const special of this.data.specialNodes) {
      const div = this.createNode(special, 'scope-journey-special-node scope-journey-special--' + special.nodeType);
      const labelEl = document.createElement('div');
      labelEl.className = 'scope-journey-special-label';
      labelEl.textContent = special.nodeType === 'wildcard' ? '*' : 'end';
      div.appendChild(labelEl);
      const typeEl = document.createElement('div');
      typeEl.className = 'scope-node-type';
      typeEl.textContent = special.nodeType === 'wildcard' ? 'any screen' : 'terminal';
      div.appendChild(typeEl);
      this.registerNode(div, special.id);
    }

    // Action nodes
    for (const action of (this.data.actionNodes || [])) {
      const div = this.createNode(action, 'scope-journey-action-node');
      div.appendChild(this.createLink(action));
      div.appendChild(this.createTypeLabel('action'));

      // Action type badge
      const typeBadge = document.createElement('div');
      typeBadge.className = 'scope-journey-action-type scope-journey-action-type--' + action.actionType;
      typeBadge.textContent = action.actionType;
      div.appendChild(typeBadge);

      // Calls endpoint (imperative actions)
      if (action.callsEndpoint) {
        const ep = document.createElement('div');
        ep.className = 'scope-journey-action-endpoint';
        ep.textContent = action.callsEndpoint;
        div.appendChild(ep);
      }

      if (action.implChip) {
        const chip = document.createElement('span');
        chip.innerHTML = action.implChip;
        div.appendChild(chip);
      }

      this.registerNode(div, action.id);
    }
  }

  layout() {
    const screens = this.data.screenNodes;
    if (screens.length === 0) return;

    const colGap = 60;
    const rowGap = 25;

    // Determine journey path order (screens in first-appearance order)
    const orderedScreenIds = [];
    const seen = new Set();
    for (const edge of this.data.edges) {
      if (edge.from.startsWith('screen:') && !seen.has(edge.from)) {
        orderedScreenIds.push(edge.from);
        seen.add(edge.from);
      }
      if (edge.to.startsWith('screen:') && !seen.has(edge.to)) {
        orderedScreenIds.push(edge.to);
        seen.add(edge.to);
      }
    }

    // Measure dimensions
    let maxScreenW = 0, maxScreenH = 0, maxTriggerW = 0, maxTriggerH = 0;

    for (const s of screens) {
      const el = this.nodeElements.get(s.id);
      if (el) {
        maxScreenW = Math.max(maxScreenW, el.offsetWidth);
        maxScreenH = Math.max(maxScreenH, el.offsetHeight);
      }
    }
    for (const t of this.data.triggerNodes) {
      const el = this.nodeElements.get(t.id);
      if (el) {
        maxTriggerW = Math.max(maxTriggerW, el.offsetWidth);
        maxTriggerH = Math.max(maxTriggerH, el.offsetHeight);
      }
    }

    if (maxScreenW === 0) maxScreenW = 160;
    if (maxScreenH === 0) maxScreenH = 60;
    if (maxTriggerW === 0) maxTriggerW = 120;
    if (maxTriggerH === 0) maxTriggerH = 30;

    // Screen row Y
    const screenY = 60;
    const triggerY = screenY + maxScreenH + rowGap;

    // Build screen position map (horizontal, evenly spaced)
    const totalStepW = maxScreenW + colGap;
    const screenPositions = new Map();

    for (let i = 0; i < orderedScreenIds.length; i++) {
      const sid = orderedScreenIds[i];
      const x = 40 + i * totalStepW;
      screenPositions.set(sid, { x, y: screenY });
      this.nodePositions.set(sid, { x, y: screenY });
    }

    // Build trigger → connected screens map
    const triggerToScreens = new Map();
    for (const edge of this.data.edges) {
      const tid = edge.from.startsWith('trigger:') ? edge.from : edge.to.startsWith('trigger:') ? edge.to : null;
      if (!tid) continue;
      if (!triggerToScreens.has(tid)) triggerToScreens.set(tid, { from: null, to: null });
      const entry = triggerToScreens.get(tid);
      if (edge.to === tid) entry.from = edge.from;
      if (edge.from === tid) entry.to = edge.to;
    }

    // Separate forward vs backward triggers
    const forwardTriggers = [];
    const backwardTriggers = [];

    for (const trigger of this.data.triggerNodes) {
      const conn = triggerToScreens.get(trigger.id);
      if (!conn) continue;
      const fromPos = conn.from ? (screenPositions.get(conn.from) || this.nodePositions.get(conn.from)) : null;
      const toPos = conn.to ? (screenPositions.get(conn.to) || this.nodePositions.get(conn.to)) : null;
      const isBackward = fromPos && toPos && toPos.x < fromPos.x;
      if (isBackward) {
        backwardTriggers.push({ trigger, conn, fromPos, toPos });
      } else {
        forwardTriggers.push({ trigger, conn, fromPos, toPos });
      }
    }

    // Place forward triggers below screens
    const usedForwardSlots = [];
    for (const { trigger, fromPos, toPos } of forwardTriggers) {
      let tx;
      if (fromPos && toPos) {
        tx = (fromPos.x + toPos.x) / 2 + (maxScreenW - maxTriggerW) / 2;
      } else if (fromPos) {
        tx = fromPos.x + maxScreenW + colGap / 2 - maxTriggerW / 2;
      } else if (toPos) {
        tx = toPos.x - colGap / 2 - maxTriggerW / 2;
      } else {
        tx = 40;
      }
      let ty = triggerY;
      for (const slot of usedForwardSlots) {
        if (Math.abs(tx - slot.x) < maxTriggerW + 10 && Math.abs(ty - slot.y) < maxTriggerH + 8) {
          ty = slot.y + maxTriggerH + 8;
        }
      }
      this.nodePositions.set(trigger.id, { x: tx, y: ty });
      usedForwardSlots.push({ x: tx, y: ty });
    }

    // Place backward triggers above screens
    const backwardY = screenY - maxTriggerH - rowGap;
    const usedBackwardSlots = [];
    for (const { trigger, fromPos, toPos } of backwardTriggers) {
      let tx;
      if (fromPos && toPos) {
        tx = (fromPos.x + toPos.x) / 2 + (maxScreenW - maxTriggerW) / 2;
      } else {
        tx = 40;
      }
      let ty = backwardY;
      for (const slot of usedBackwardSlots) {
        if (Math.abs(tx - slot.x) < maxTriggerW + 10 && Math.abs(ty - slot.y) < maxTriggerH + 8) {
          ty = slot.y - maxTriggerH - 8;
        }
      }
      this.nodePositions.set(trigger.id, { x: tx, y: ty });
      usedBackwardSlots.push({ x: tx, y: ty });
    }

    // Position action nodes (Row 4 — below forward triggers)
    const actionNodes = this.data.actionNodes || [];
    let maxActionW = 0, maxActionH = 0;
    for (const action of actionNodes) {
      const el = this.nodeElements.get(action.id);
      if (el) {
        maxActionW = Math.max(maxActionW, el.offsetWidth);
        maxActionH = Math.max(maxActionH, el.offsetHeight);
      }
    }
    if (maxActionW === 0) maxActionW = 130;
    if (maxActionH === 0) maxActionH = 50;

    // Find the max forward trigger Y to place actions below
    let maxForwardTriggerBottom = triggerY;
    for (const slot of usedForwardSlots) {
      maxForwardTriggerBottom = Math.max(maxForwardTriggerBottom, slot.y + maxTriggerH);
    }
    const actionY = maxForwardTriggerBottom + rowGap;

    // Build action → connected screens map from edges
    const actionToScreens = new Map();
    for (const edge of this.data.edges) {
      if (edge.edgeType === 'action-from') {
        // edge.from = screen, edge.to = action
        if (!actionToScreens.has(edge.to)) actionToScreens.set(edge.to, { from: null, to: null });
        actionToScreens.get(edge.to).from = edge.from;
      } else if (edge.edgeType === 'action-to') {
        // edge.from = action, edge.to = screen
        if (!actionToScreens.has(edge.from)) actionToScreens.set(edge.from, { from: null, to: null });
        actionToScreens.get(edge.from).to = edge.to;
      }
    }

    const usedActionSlots = [];
    for (const action of actionNodes) {
      const conn = actionToScreens.get(action.id);
      let tx;
      if (conn) {
        const fromPos = conn.from ? (screenPositions.get(conn.from) || this.nodePositions.get(conn.from)) : null;
        const toPos = conn.to ? (screenPositions.get(conn.to) || this.nodePositions.get(conn.to)) : null;
        if (fromPos && toPos) {
          tx = (fromPos.x + toPos.x) / 2 + (maxScreenW - maxActionW) / 2;
        } else if (fromPos) {
          tx = fromPos.x + maxScreenW / 2 - maxActionW / 2;
        } else {
          tx = 40;
        }
      } else {
        tx = 40;
      }

      let ty = actionY;
      for (const slot of usedActionSlots) {
        if (Math.abs(tx - slot.x) < maxActionW + 10 && Math.abs(ty - slot.y) < maxActionH + 8) {
          ty = slot.y + maxActionH + 8;
        }
      }

      this.nodePositions.set(action.id, { x: tx, y: ty });
      usedActionSlots.push({ x: tx, y: ty });
    }

    // Position special nodes
    const bottomY = actionNodes.length > 0
      ? actionY + maxActionH + rowGap
      : triggerY + (forwardTriggers.length > 0 ? maxTriggerH + rowGap : 0);
    for (const special of this.data.specialNodes) {
      if (special.nodeType === 'wildcard') {
        this.nodePositions.set(special.id, { x: 40, y: bottomY + 10 });
      } else if (special.nodeType === 'end') {
        const lastX = orderedScreenIds.length > 0
          ? (screenPositions.get(orderedScreenIds[orderedScreenIds.length - 1])?.x ?? 40) + totalStepW
          : 40 + totalStepW;
        this.nodePositions.set(special.id, { x: lastX, y: screenY + maxScreenH / 4 });
      }
    }

    // Apply positions
    for (const [id, pos] of this.nodePositions) {
      const el = this.nodeElements.get(id);
      if (el) {
        el.style.left = pos.x + 'px';
        el.style.top = pos.y + 'px';
      }
    }
  }

  renderEdges() {
    while (this.svgEl.firstChild) this.svgEl.removeChild(this.svgEl.firstChild);

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const createMarker = (id, color) => {
      const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      m.setAttribute('id', id);
      m.setAttribute('viewBox', '0 0 10 7');
      m.setAttribute('refX', '10');
      m.setAttribute('refY', '3.5');
      m.setAttribute('markerWidth', '8');
      m.setAttribute('markerHeight', '6');
      m.setAttribute('orient', 'auto-start-reverse');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M 0 0 L 10 3.5 L 0 7 z');
      p.setAttribute('fill', color);
      m.appendChild(p);
      return m;
    };

    defs.appendChild(createMarker('journey-arrow-step', 'var(--scope-diagram-journey)'));
    defs.appendChild(createMarker('journey-arrow-wildcard', 'var(--scope-wip)'));
    defs.appendChild(createMarker('journey-arrow-terminal', 'var(--scope-text-tertiary)'));
    defs.appendChild(createMarker('journey-arrow-action-from', 'var(--scope-diagram-screen)'));
    defs.appendChild(createMarker('journey-arrow-action-to', 'var(--scope-diagram-screen)'));
    this.svgEl.appendChild(defs);

    for (const edge of this.data.edges) {
      this._renderEdge(edge);
    }
  }

  _renderEdge(edge) {
    const fromEl = this.nodeElements.get(edge.from);
    const toEl = this.nodeElements.get(edge.to);
    if (!fromEl || !toEl) return;

    const fromPos = this.nodePositions.get(edge.from);
    const toPos = this.nodePositions.get(edge.to);
    if (!fromPos || !toPos) return;

    const fromW = fromEl.offsetWidth;
    const fromH = fromEl.offsetHeight;
    const toW = toEl.offsetWidth;
    const toH = toEl.offsetHeight;

    const fromCX = fromPos.x + fromW / 2;
    const fromCY = fromPos.y + fromH / 2;
    const toCX = toPos.x + toW / 2;
    const toCY = toPos.y + toH / 2;

    const from = this._borderPoint(fromPos.x, fromPos.y, fromW, fromH, toCX, toCY);
    const to = this._borderPoint(toPos.x, toPos.y, toW, toH, fromCX, fromCY);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curvature = Math.min(dist * 0.25, 60);

    let c1x, c1y, c2x, c2y;
    if (Math.abs(dx) > Math.abs(dy)) {
      c1x = from.x + curvature * Math.sign(dx);
      c1y = from.y;
      c2x = to.x - curvature * Math.sign(dx);
      c2y = to.y;
    } else {
      c1x = from.x;
      c1y = from.y + curvature * Math.sign(dy);
      c2x = to.x;
      c2y = to.y - curvature * Math.sign(dy);
    }

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('scope-journey-graph-edge-group');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`);
    path.classList.add('scope-journey-graph-edge');
    path.classList.add(edge.edgeType);
    path.setAttribute('marker-end', 'url(#journey-arrow-' + edge.edgeType + ')');
    group.appendChild(path);

    this.svgEl.appendChild(group);
  }

  destroy() {
    super.destroy();
    journeyGraphInstances.delete(this.container);
  }
}

function initJourneyGraphs() {
  document.querySelectorAll('.scope-journey-graph').forEach(container => {
    const existing = journeyGraphInstances.get(container);
    if (existing) existing.destroy();
    const graph = new JourneyGraph(container);
    journeyGraphInstances.set(container, graph);
  });
}

function initJourneyGraphsIn(parent) {
  parent.querySelectorAll('.scope-journey-graph').forEach(container => {
    const existing = journeyGraphInstances.get(container);
    if (existing) existing.destroy();
    const graph = new JourneyGraph(container);
    journeyGraphInstances.set(container, graph);
  });
}

// ===== OverviewGraph — Interactive Overview Graph (all constructs) =====

/** @type {Map<HTMLElement, OverviewGraph>} */
const overviewGraphInstances = new Map();

class OverviewGraph extends BaseGraph {
  constructor(container) {
    super(container, 'overview',
      '.scope-overview-graph-edges',
      '.scope-overview-graph-world',
      '.scope-graph-node.scope-overview-node',
      'nodeId'
    );
  }

  renderNodes() {
    this.worldEl.innerHTML = '';

    for (const node of this.data.nodes) {
      const div = this.createNode(node, 'scope-overview-node');
      div.classList.add('scope-overview-node--' + node.constructType);
      this.applyAbstractInterface(div, node);
      div.appendChild(this.createHeader(node));

      const typeLabel = this.createTypeLabel(node.constructType);
      this.createAbstractBadge(typeLabel, node);
      div.appendChild(typeLabel);

      const inh = this.createInheritanceLine(node);
      if (inh) div.appendChild(inh);

      if (node.ghost) div.appendChild(this.createGhostOrigin(node));

      this.registerNode(div, node.id);
    }
  }

  layout() {
    const nodes = this.data.nodes;
    if (nodes.length === 0) return;

    // Sub-group ordering within each category
    const behaviorOrder = ['screen', 'flow', 'state', 'api'];
    const dataOrder = ['entity', 'event', 'signal'];

    // Group nodes by category
    const behaviorNodes = nodes.filter(n => n.category === 'behavior');
    const dataNodes = nodes.filter(n => n.category === 'data');

    // Sub-group by type within each category
    function groupByType(items, order) {
      const groups = new Map();
      for (const type of order) {
        const matching = items.filter(n => n.constructType === type);
        if (matching.length > 0) groups.set(type, matching);
      }
      // Catch any types not in the order list
      for (const n of items) {
        if (!order.includes(n.constructType)) {
          if (!groups.has(n.constructType)) groups.set(n.constructType, []);
          groups.get(n.constructType).push(n);
        }
      }
      return groups;
    }

    const behaviorGroups = groupByType(behaviorNodes, behaviorOrder);
    const dataGroups = groupByType(dataNodes, dataOrder);

    // Layout parameters
    const nodeGap = 20;
    const rowGap = 60;
    const columnGap = 400;
    const startX = 40;
    const startY = 40;

    // Layout a column of type-groups, returns the max X used
    const layoutColumn = (groups, offsetX) => {
      let y = startY;
      let maxColWidth = 0;

      for (const [, typeNodes] of groups) {
        let x = offsetX;
        let maxRowHeight = 0;

        for (const node of typeNodes) {
          this.nodePositions.set(node.id, { x, y });
          const el = this.nodeElements.get(node.id);
          const w = el ? el.offsetWidth : 160;
          const h = el ? el.offsetHeight : 50;
          if (h > maxRowHeight) maxRowHeight = h;
          if ((x - offsetX) + w > maxColWidth) maxColWidth = (x - offsetX) + w;
          x += w + nodeGap;
        }

        y += maxRowHeight + rowGap;
      }

      return maxColWidth;
    };

    // Layout behavior column (left)
    const behaviorWidth = layoutColumn(behaviorGroups, startX);

    // Layout data column (right)
    const dataStartX = startX + behaviorWidth + columnGap;
    layoutColumn(dataGroups, dataStartX);

    // Apply positions
    for (const node of nodes) {
      const pos = this.nodePositions.get(node.id);
      const el = this.nodeElements.get(node.id);
      if (pos && el) {
        el.style.left = pos.x + 'px';
        el.style.top = pos.y + 'px';
      }
    }

    // Add category labels
    if (behaviorNodes.length > 0) {
      const label = document.createElement('div');
      label.className = 'scope-overview-category-label';
      label.textContent = 'BEHAVIOR';
      label.style.left = startX + 'px';
      label.style.top = (startY - 20) + 'px';
      this.worldEl.appendChild(label);
    }

    if (dataNodes.length > 0) {
      const label = document.createElement('div');
      label.className = 'scope-overview-category-label';
      label.textContent = 'DATA';
      label.style.left = dataStartX + 'px';
      label.style.top = (startY - 20) + 'px';
      this.worldEl.appendChild(label);
    }
  }

  renderEdges() {
    while (this.svgEl.firstChild) this.svgEl.removeChild(this.svgEl.firstChild);

    // Type color map for per-source-type edge coloring
    const typeColors = {
      screen: '#F472B6', flow: '#34D399', state: '#FBBF24', api: '#60A5FA',
      entity: '#00FFFF', event: '#A78BFA', signal: '#FB923C',
      operation: '#E879F9', rule: '#F87171', journey: '#2DD4BF',
      enum: '#94A3B8', element: '#C084FC', action: '#FCD34D',
    };

    // Create per-type arrowhead markers
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    for (const [type, color] of Object.entries(typeColors)) {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', 'overview-arrow-' + type);
      marker.setAttribute('viewBox', '0 0 10 7');
      marker.setAttribute('refX', '10');
      marker.setAttribute('refY', '3.5');
      marker.setAttribute('markerWidth', '8');
      marker.setAttribute('markerHeight', '6');
      marker.setAttribute('orient', 'auto-start-reverse');
      const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrowPath.setAttribute('d', 'M 0 0 L 10 3.5 L 0 7 z');
      arrowPath.setAttribute('fill', color);
      marker.appendChild(arrowPath);
      defs.appendChild(marker);
    }
    // Fallback monochrome marker
    const fallback = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    fallback.setAttribute('id', 'overview-arrow');
    fallback.setAttribute('viewBox', '0 0 10 7');
    fallback.setAttribute('refX', '10');
    fallback.setAttribute('refY', '3.5');
    fallback.setAttribute('markerWidth', '8');
    fallback.setAttribute('markerHeight', '6');
    fallback.setAttribute('orient', 'auto-start-reverse');
    const fallbackPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    fallbackPath.setAttribute('d', 'M 0 0 L 10 3.5 L 0 7 z');
    fallbackPath.setAttribute('fill', 'var(--scope-text-tertiary)');
    fallback.appendChild(fallbackPath);
    defs.appendChild(fallback);
    this.svgEl.appendChild(defs);

    this._typeColors = typeColors;

    for (const edge of this.data.edges) {
      this._renderEdge(edge);
    }
  }

  _renderEdge(edge) {
    const fromEl = this.nodeElements.get(edge.from);
    const toEl = this.nodeElements.get(edge.to);
    if (!fromEl || !toEl) return;

    const fromPos = this.nodePositions.get(edge.from);
    const toPos = this.nodePositions.get(edge.to);
    if (!fromPos || !toPos) return;

    const fromW = fromEl.offsetWidth;
    const fromH = fromEl.offsetHeight;
    const toW = toEl.offsetWidth;
    const toH = toEl.offsetHeight;

    const fromCX = fromPos.x + fromW / 2;
    const fromCY = fromPos.y + fromH / 2;
    const toCX = toPos.x + toW / 2;
    const toCY = toPos.y + toH / 2;

    const from = this._borderPoint(fromPos.x, fromPos.y, fromW, fromH, toCX, toCY);
    const to = this._borderPoint(toPos.x, toPos.y, toW, toH, fromCX, fromCY);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curvature = Math.min(dist * 0.25, 60);

    let c1x, c1y, c2x, c2y;
    if (Math.abs(dx) > Math.abs(dy)) {
      c1x = from.x + curvature * Math.sign(dx);
      c1y = from.y;
      c2x = to.x - curvature * Math.sign(dx);
      c2y = to.y;
    } else {
      c1x = from.x;
      c1y = from.y + curvature * Math.sign(dy);
      c2x = to.x;
      c2y = to.y - curvature * Math.sign(dy);
    }

    // Resolve source node type for edge coloring
    const sourceType = edge.from.split(':')[0];
    const edgeColor = this._typeColors && this._typeColors[sourceType];

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('scope-overview-graph-edge-group');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`);
    path.classList.add('scope-overview-graph-edge');

    if (edgeColor) {
      path.style.stroke = edgeColor;
      path.setAttribute('marker-end', `url(#overview-arrow-${sourceType})`);
    } else {
      path.setAttribute('marker-end', 'url(#overview-arrow)');
    }

    // Apply visual class based on edge type
    const governanceTypes = ['governance', 'event-state', 'state-entity', 'state-enum', 'rule-entity'];
    const interactionTypes = ['screen-api', 'screen-signal', 'signal-screen'];
    if (governanceTypes.includes(edge.edgeType)) {
      path.classList.add('governance');
    } else if (interactionTypes.includes(edge.edgeType)) {
      path.classList.add('interaction');
    } else if (edge.edgeType === 'extends') {
      path.classList.add('extends');
    } else if (edge.edgeType === 'implements') {
      path.classList.add('implements');
    }

    group.appendChild(path);

    // Edge label at midpoint of curve
    if (edge.edgeType) {
      const midT = 0.5;
      const mt = 1 - midT;
      const mx = mt*mt*mt*from.x + 3*mt*mt*midT*c1x + 3*mt*midT*midT*c2x + midT*midT*midT*to.x;
      const my = mt*mt*mt*from.y + 3*mt*mt*midT*c1y + 3*mt*midT*midT*c2y + midT*midT*midT*to.y;
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', mx);
      label.setAttribute('y', my - 4);
      label.setAttribute('text-anchor', 'middle');
      label.classList.add('scope-overview-graph-edge-label');
      if (edgeColor) label.style.fill = edgeColor;
      label.textContent = edge.edgeType;
      group.appendChild(label);
    }

    this.svgEl.appendChild(group);
  }

  destroy() {
    super.destroy();
    overviewGraphInstances.delete(this.container);
  }
}

function initOverviewGraphs() {
  for (const [el, graph] of overviewGraphInstances) {
    graph.destroy();
  }
  overviewGraphInstances.clear();

  document.querySelectorAll('.scope-overview-graph').forEach(container => {
    if (overviewGraphInstances.has(container)) return;
    const panel = container.closest('.scope-tab-panel');
    if (panel && !panel.classList.contains('active')) return;
    const graph = new OverviewGraph(container);
    overviewGraphInstances.set(container, graph);
  });
}

function initOverviewGraphsIn(parent) {
  parent.querySelectorAll('.scope-overview-graph').forEach(container => {
    const existing = overviewGraphInstances.get(container);
    if (existing) existing.destroy();
    const graph = new OverviewGraph(container);
    overviewGraphInstances.set(container, graph);
  });
}

// ===== ComponentGraph — Interactive Component Graph for Overview =====

/** @type {Map<HTMLElement, ComponentGraph>} */
const componentGraphInstances = new Map();

class ComponentGraph extends BaseGraph {
  constructor(container) {
    super(container, 'component',
      '.scope-component-graph-edges',
      '.scope-component-graph-world',
      '.scope-graph-node.scope-component-node',
      'nodeId'
    );
  }

  renderNodes() {
    this.worldEl.innerHTML = '';

    for (const node of this.data.nodes) {
      const div = this.createNode(node, 'scope-component-node');

      // Apply component color via CSS custom property
      if (node.color) {
        div.style.setProperty('--node-color', node.color);
        div.style.borderColor = node.color;
      }

      // Dashed border for abstract/interface
      if (node.isAbstract) div.classList.add('scope-component-node--abstract');
      if (node.isInterface) div.classList.add('scope-component-node--interface');

      const nameEl = document.createElement('div');
      nameEl.className = 'scope-component-node__name';
      nameEl.appendChild(this.createLink(node));
      div.appendChild(nameEl);

      // Badge for @abstract / @interface
      if (node.isAbstract || node.isInterface) {
        const badgeEl = document.createElement('div');
        badgeEl.className = 'scope-component-node__badge';
        if (node.isAbstract) {
          badgeEl.textContent = '@abstract';
          badgeEl.classList.add('scope-component-node__badge--abstract');
        } else {
          badgeEl.textContent = '@interface';
          badgeEl.classList.add('scope-component-node__badge--interface');
        }
        div.appendChild(badgeEl);
      }

      // Inheritance info for concrete components
      const inheritParts = [];
      if (node.extendsFrom) inheritParts.push('extends ' + node.extendsFrom);
      if (node.implementsList && node.implementsList.length > 0) {
        inheritParts.push('impl ' + node.implementsList.join(', '));
      }
      if (inheritParts.length > 0) {
        const inheritEl = document.createElement('div');
        inheritEl.className = 'scope-component-node__inherit';
        inheritEl.textContent = inheritParts.join(' · ');
        div.appendChild(inheritEl);
      }

      const statusEl = document.createElement('div');
      statusEl.className = 'scope-component-node__status';
      statusEl.textContent = node.status;
      div.appendChild(statusEl);

      const countsEl = document.createElement('div');
      countsEl.className = 'scope-component-node__counts';
      countsEl.textContent = node.counts;
      div.appendChild(countsEl);

      const implEl = document.createElement('div');
      implEl.className = 'scope-component-node__impl';
      const filled = Math.round(node.implPct / 12.5);
      const empty = 8 - filled;
      implEl.textContent = 'impl ' + '\u2588'.repeat(filled) + '\u2591'.repeat(empty) + ' ' + node.implPct + '%';
      div.appendChild(implEl);

      this.registerNode(div, node.id);
    }
  }

  layout() {
    const nodes = this.data.nodes;
    if (nodes.length === 0) return;

    // BFS-based LR layout: root nodes (no incoming edges) on the left
    const incoming = new Map();
    const outgoing = new Map();
    for (const n of nodes) {
      incoming.set(n.id, []);
      outgoing.set(n.id, []);
    }
    for (const e of this.data.edges) {
      if (incoming.has(e.to)) incoming.get(e.to).push(e.from);
      if (outgoing.has(e.from)) outgoing.get(e.from).push(e.to);
    }

    // Assign layers via BFS
    const layers = new Map();
    const roots = nodes.filter(n => incoming.get(n.id).length === 0);
    if (roots.length === 0) roots.push(nodes[0]); // fallback: pick first

    const queue = [];
    for (const r of roots) {
      layers.set(r.id, 0);
      queue.push(r.id);
    }
    while (queue.length > 0) {
      const id = queue.shift();
      const layer = layers.get(id);
      for (const target of (outgoing.get(id) || [])) {
        const existing = layers.get(target);
        if (existing === undefined || existing < layer + 1) {
          layers.set(target, layer + 1);
          queue.push(target);
        }
      }
    }
    // Assign any unvisited nodes
    for (const n of nodes) {
      if (!layers.has(n.id)) layers.set(n.id, 0);
    }

    // Group by layer
    const layerGroups = new Map();
    for (const [id, layer] of layers) {
      if (!layerGroups.has(layer)) layerGroups.set(layer, []);
      layerGroups.get(layer).push(id);
    }

    const colSpacing = 350;
    const rowSpacing = 40;

    const sortedLayers = [...layerGroups.keys()].sort((a, b) => a - b);
    for (const layer of sortedLayers) {
      const ids = layerGroups.get(layer);
      const x = 40 + layer * colSpacing;
      let y = 40;
      for (const id of ids) {
        this.nodePositions.set(id, { x, y });
        const el = this.nodeElements.get(id);
        if (el) { el.style.left = x + 'px'; el.style.top = y + 'px'; }
        const h = el ? el.offsetHeight : 100;
        y += h + rowSpacing;
      }
    }
  }

  renderEdges() {
    while (this.svgEl.firstChild) this.svgEl.removeChild(this.svgEl.firstChild);

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const createMarker = (id, color) => {
      const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      m.setAttribute('id', id);
      m.setAttribute('viewBox', '0 0 10 7');
      m.setAttribute('refX', '10');
      m.setAttribute('refY', '3.5');
      m.setAttribute('markerWidth', '8');
      m.setAttribute('markerHeight', '6');
      m.setAttribute('orient', 'auto-start-reverse');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M 0 0 L 10 3.5 L 0 7 z');
      p.setAttribute('fill', color);
      m.appendChild(p);
      return m;
    };
    defs.appendChild(createMarker('comp-arrow', 'var(--scope-text-primary)'));
    defs.appendChild(createMarker('comp-arrow-opt', 'var(--scope-text-tertiary)'));
    defs.appendChild(createMarker('comp-arrow-extends', 'var(--scope-wip)'));
    defs.appendChild(createMarker('comp-arrow-implements', 'var(--scope-diagram-flow)'));
    this.svgEl.appendChild(defs);

    for (const edge of this.data.edges) {
      this._renderEdge(edge);
    }
  }

  _renderEdge(edge) {
    const fromEl = this.nodeElements.get(edge.from);
    const toEl = this.nodeElements.get(edge.to);
    if (!fromEl || !toEl) return;

    const fromPos = this.nodePositions.get(edge.from);
    const toPos = this.nodePositions.get(edge.to);
    if (!fromPos || !toPos) return;

    const fromW = fromEl.offsetWidth;
    const fromH = fromEl.offsetHeight;
    const toW = toEl.offsetWidth;
    const toH = toEl.offsetHeight;

    const fromCX = fromPos.x + fromW / 2;
    const fromCY = fromPos.y + fromH / 2;
    const toCX = toPos.x + toW / 2;
    const toCY = toPos.y + toH / 2;

    const from = this._borderPoint(fromPos.x, fromPos.y, fromW, fromH, toCX, toCY);
    const to = this._borderPoint(toPos.x, toPos.y, toW, toH, fromCX, fromCY);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curvature = Math.min(dist * 0.3, 80);

    let c1x, c1y, c2x, c2y;
    if (Math.abs(dx) > Math.abs(dy)) {
      c1x = from.x + curvature * Math.sign(dx);
      c1y = from.y;
      c2x = to.x - curvature * Math.sign(dx);
      c2y = to.y;
    } else {
      c1x = from.x;
      c1y = from.y + curvature * Math.sign(dy);
      c2x = to.x;
      c2y = to.y - curvature * Math.sign(dy);
    }

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('scope-component-graph-edge-group');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`);
    path.classList.add('scope-component-graph-edge');

    if (edge.edgeType === 'extends') {
      path.classList.add('scope-graph-edge-extends');
      path.setAttribute('marker-end', 'url(#comp-arrow-extends)');
    } else if (edge.edgeType === 'implements') {
      path.classList.add('scope-graph-edge-implements');
      path.setAttribute('marker-end', 'url(#comp-arrow-implements)');
    } else {
      if (edge.optional) path.classList.add('optional');
      path.setAttribute('marker-end', edge.optional ? 'url(#comp-arrow-opt)' : 'url(#comp-arrow)');
    }
    group.appendChild(path);

    // Label for inheritance edges
    if (edge.edgeType === 'extends' || edge.edgeType === 'implements') {
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', midX);
      label.setAttribute('y', midY - 6);
      label.setAttribute('text-anchor', 'middle');
      label.classList.add('scope-component-graph-edge-label');
      label.textContent = edge.edgeType;
      group.appendChild(label);
    }

    this.svgEl.appendChild(group);
  }

  destroy() {
    super.destroy();
    componentGraphInstances.delete(this.container);
  }
}

function initComponentGraphs() {
  for (const [el, graph] of componentGraphInstances) {
    graph.destroy();
  }
  componentGraphInstances.clear();

  document.querySelectorAll('.scope-component-graph').forEach(container => {
    if (componentGraphInstances.has(container)) return;
    const graph = new ComponentGraph(container);
    componentGraphInstances.set(container, graph);
  });
}

function initDiagramCanvases() {
  // Destroy old instances
  for (const [el, canvas] of canvasInstances) {
    canvas.destroy();
  }
  canvasInstances.clear();

  document.querySelectorAll('.scope-diagram-container').forEach(container => {
    // Skip containers that have an interactive graph (they handle their own zoom/pan)
    if (container.querySelector('.scope-component-graph')) return;
    const svg = container.querySelector('svg');
    if (!svg) return;
    const canvas = new DiagramCanvas(container);
    canvasInstances.set(container, canvas);
  });
}

// Override zoomDiagram to use DiagramCanvas
window.zoomDiagram = function(factor) {
  const container = document.getElementById('diagram-container');
  if (!container) return;
  const canvas = canvasInstances.get(container);
  if (canvas) {
    canvas.zoomTo(factor);
  }
};

// ===== Phase 2: Clickable Nodes =====

function attachNodeInteractivity(container, diagramType) {
  const svg = container.querySelector('svg');
  if (!svg) return;
  const canvas = canvasInstances.get(container);

  if (diagramType === 'overview') {
    // Overview relationship diagram: nodes labeled "type: Name" or "type: Name [status]"
    const nodes = svg.querySelectorAll('.node');
    nodes.forEach(node => {
      const rawLabel = getNodeLabel(node);
      if (!rawLabel) return;

      // First line is "type: Name", second line (if any) is status
      const firstLine = rawLabel.split('\n')[0].trim();
      const match = firstLine.match(/^(\w+):\s*(.+)$/);
      if (!match) return;
      const [, nodeType, nodeName] = match;
      const cleanName = nodeName.trim();

      // Get the component name from the URL path
      const compName = decodeURIComponent(window.location.pathname.split('/component/')[1] || '');

      // Resolve href: try command palette, fallback to building URL from type/name
      const item = commandPaletteItems.find(
        i => i.type === nodeType && i.name === cleanName
      );
      const href = item?.href || (compName ? `/component/${encodeURIComponent(compName)}/${nodeType}/${encodeURIComponent(cleanName)}` : null);
      if (!href) return;

      // Remove Mermaid's native click handler by cloning
      const clone = node.cloneNode(true);
      node.parentNode.replaceChild(clone, node);
      makeClickable(clone, href, cleanName, nodeType, canvas);
    });
  } else if (diagramType === 'component' || diagramType === 'screen' || diagramType === 'journey') {
    // Flowchart nodes: .node or .flowchart-label
    const nodes = svg.querySelectorAll('.node');
    nodes.forEach(node => {
      const label = getNodeLabel(node);
      if (!label) return;
      // Clean label (remove status annotations)
      const cleanName = label.split('\\n')[0].split('\n')[0].replace(/\(.*\)$/, '').trim();
      if (!cleanName) return;

      const href = resolveNodeHref(diagramType, cleanName);
      if (href) {
        makeClickable(node, href, cleanName, diagramType, canvas);
      }
    });
  } else if (diagramType === 'entity') {
    // ER diagram entity labels
    const entityLabels = svg.querySelectorAll('.er.entityLabel');
    entityLabels.forEach(label => {
      const textEl = label.querySelector('text') || label;
      const name = textEl.textContent?.trim();
      if (!name) return;
      const href = resolveNodeHref('entity', name);
      if (href) {
        const group = label.closest('g') || label;
        makeClickable(group, href, name, 'entity', canvas);
      }
    });
  } else if (diagramType === 'state') {
    // State diagram nodes
    const stateNodes = svg.querySelectorAll('.stateGroup, .state-node');
    stateNodes.forEach(node => {
      const label = getNodeLabel(node);
      if (!label || label === '[*]') return;
      const href = resolveNodeHref('state', label);
      if (href) {
        makeClickable(node, href, label, 'state', canvas);
      }
    });
  }
}

function getNodeLabel(node) {
  // Try multiple strategies to extract the label text from a Mermaid node
  const labelEl = node.querySelector('.nodeLabel') ||
                  node.querySelector('.label') ||
                  node.querySelector('text') ||
                  node.querySelector('foreignObject span');
  if (labelEl) {
    // Use innerText for HTML elements (respects <br/> as newlines), fallback to textContent for SVG
    return (labelEl.innerText ?? labelEl.textContent)?.trim() || '';
  }
  return '';
}

function resolveNodeHref(diagramType, name) {
  // Use commandPaletteItems to resolve the href
  if (!commandPaletteItems.length) return null;

  if (diagramType === 'component') {
    const item = commandPaletteItems.find(
      i => i.type === 'component' && i.name === name
    );
    return item?.href || `/component/${encodeURIComponent(name)}`;
  }

  // For entity/state/screen/journey — search by name and type
  const typeMap = {
    entity: 'entity',
    state: 'state',
    screen: 'screen',
    journey: 'journey',
  };
  const searchType = typeMap[diagramType];
  if (searchType) {
    const item = commandPaletteItems.find(
      i => i.type === searchType && i.name === name
    );
    return item?.href || null;
  }
  return null;
}

function makeClickable(svgGroup, href, label, diagramType, canvas) {
  svgGroup.classList.add('scope-interactive-node');
  svgGroup.style.cursor = 'pointer';

  svgGroup.addEventListener('click', (e) => {
    // Don't navigate if we were panning
    if (canvas && canvas.wasPanning) return;
    e.preventDefault();
    e.stopPropagation();
    navigateWithTransition(href, e);
  });

  svgGroup.addEventListener('mouseenter', (e) => {
    showNodeTooltip(e, label, diagramType);
  });

  svgGroup.addEventListener('mouseleave', () => {
    hideNodeTooltip();
  });
}

// ===== Node Tooltip =====
let tooltipEl = null;

function showNodeTooltip(e, label, type) {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'scope-node-tooltip';
    document.body.appendChild(tooltipEl);
  }
  tooltipEl.innerHTML = `<span class="scope-node-tooltip-type">${type}</span> ${escapeHtml(label)}`;
  tooltipEl.style.display = 'block';
  positionTooltip(e);
}

function positionTooltip(e) {
  if (!tooltipEl) return;
  tooltipEl.style.left = (e.clientX + 12) + 'px';
  tooltipEl.style.top = (e.clientY - 8) + 'px';
}

function hideNodeTooltip() {
  if (tooltipEl) tooltipEl.style.display = 'none';
}

document.addEventListener('mousemove', (e) => {
  if (tooltipEl && tooltipEl.style.display !== 'none') {
    positionTooltip(e);
  }
});

// ===== Phase 3: Component Tabs =====

window.switchTab = function(tabName) {
  // Sync tab panels
  const panels = document.querySelectorAll('.scope-tab-panel');
  panels.forEach(panel => {
    const isActive = panel.dataset.tabPanel === tabName;
    panel.classList.toggle('active', isActive);
    // Lazy render Mermaid in newly visible panels
    if (isActive) {
      const unrendered = panel.querySelectorAll('.mermaid:not([data-rendered])');
      if (unrendered.length > 0) {
        renderMermaidInContainer(panel).then(() => {
          initDiagramCanvasesIn(panel);
          // Attach interactivity after render
          panel.querySelectorAll('.scope-diagram-container').forEach(dc => {
            const type = dc.dataset.diagramType;
            if (type) attachNodeInteractivity(dc, type);
          });
        });
      }
      // Initialize entity graphs, flow graphs, event graphs, and state graphs in this panel
      initEntityGraphsIn(panel);
      initFlowGraphsIn(panel);
      initEventGraphsIn(panel);
      initStateGraphsIn(panel);
      initScreenGraphsIn(panel);
      initApiGraphsIn(panel);
      initJourneyGraphsIn(panel);
      initOverviewGraphsIn(panel);
    }
  });

  // Sync frame nav tabs (component level)
  const frameTabs = document.querySelectorAll('#frame-nav .scope-frame-tab[data-tab]');
  frameTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  // Sync internal .scope-tab buttons (if any remain)
  const internalTabs = document.querySelectorAll('.scope-tab[data-tab]');
  internalTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  activeTab = tabName;
  focusedListIdx = -1;
  updateFocusedItem();
};

function initDiagramCanvasesIn(parent) {
  parent.querySelectorAll('.scope-diagram-container').forEach(container => {
    const svg = container.querySelector('svg');
    if (!svg) return;
    if (canvasInstances.has(container)) return;
    const canvas = new DiagramCanvas(container);
    canvasInstances.set(container, canvas);
  });
}

async function renderMermaidInContainer(parent) {
  if (!window.mermaid) return;
  const elements = parent.querySelectorAll('.mermaid:not([data-rendered])');
  for (const el of elements) {
    try {
      const source = el.dataset.mermaidSource || el.textContent.trim();
      if (!source) continue;
      el.dataset.mermaidSource = source;
      const id = 'mermaid-' + Math.random().toString(36).slice(2, 8);
      const { svg } = await window.mermaid.render(id, source);
      el.innerHTML = svg;
      el.dataset.rendered = 'true';
    } catch (e) {
      console.warn('Mermaid render error:', e);
      el.innerHTML = `<pre style="color: var(--scope-error); font-size: var(--scope-text-sm); white-space: pre-wrap">${escapeHtml(e.message || String(e))}</pre>`;
      el.dataset.rendered = 'true';
    }
  }
}

// ===== Phase 5: Components Panel Toggle =====

window.toggleComponentsPanel = function() {
  const panel = document.querySelector('.scope-components-panel');
  if (panel) panel.classList.toggle('open');
};

// ===== Phase 6: Zoom Transition =====

function navigateWithTransition(href, event) {
  const overlay = document.createElement('div');
  overlay.className = 'scope-zoom-overlay';

  if (event) {
    overlay.style.transformOrigin = `${event.clientX}px ${event.clientY}px`;
  }

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));

  setTimeout(() => {
    navigateSPA(href).then(() => {
      overlay.remove();
    }).catch(() => {
      overlay.remove();
    });
  }, 200);
}

// Intercept component card clicks for transition
document.addEventListener('click', (e) => {
  const card = e.target.closest('.scope-component-card');
  if (card && card.href) {
    e.preventDefault();
    navigateWithTransition(card.href, e);
  }
});

// Intercept entity/construct card clicks for SPA navigation
document.addEventListener('click', (e) => {
  const card = e.target.closest('.scope-entity-card');
  if (card) {
    const link = card.querySelector('a.scope-construct-link');
    if (link && link.href) {
      e.preventDefault();
      navigateWithTransition(link.href, e);
    }
  }
});

// ===== Mermaid Rendering =====
async function renderMermaidDiagrams() {
  if (!window.mermaid) return;

  // Only render Mermaid elements in visible panels.
  // Hidden tab panels are rendered lazily when switchTab() activates them.
  const elements = document.querySelectorAll('.mermaid');
  for (const el of elements) {
    const hiddenPanel = el.closest('.scope-tab-panel:not(.active)');
    if (hiddenPanel) {
      // Preserve source for lazy rendering later, but skip render now
      if (!el.dataset.mermaidSource) {
        el.dataset.mermaidSource = el.textContent.trim();
      }
      continue;
    }
    try {
      const source = el.dataset.mermaidSource || el.textContent.trim();
      if (!source) continue;
      el.dataset.mermaidSource = source;
      currentMermaidSource = source;
      const id = 'mermaid-' + Math.random().toString(36).slice(2, 8);
      const { svg } = await window.mermaid.render(id, source);
      el.innerHTML = svg;
      el.dataset.rendered = 'true';
    } catch (e) {
      console.warn('Mermaid render error:', e);
      el.innerHTML = `<pre style="color: var(--scope-error); font-size: var(--scope-text-sm); white-space: pre-wrap">${escapeHtml(e.message || String(e))}</pre>`;
      el.dataset.rendered = 'true';
    }
  }

  // After render, init canvases and interactivity
  initDiagramCanvases();
  initComponentGraphs();
  initEntityGraphs();
  initFlowGraphs();
  initEventGraphs();
  initStateGraphs();
  initScreenGraphs();
  initApiGraphs();
  initJourneyGraphs();
  initOverviewGraphs();
  document.querySelectorAll('.scope-diagram-container').forEach(dc => {
    const mermaidEl = dc.querySelector('.mermaid');
    const type = dc.dataset.diagramType || mermaidEl?.dataset.type;
    if (type) attachNodeInteractivity(dc, type);
  });
}

window.addEventListener('mermaid-ready', () => {
  renderMermaidDiagrams();
});

if (window.mermaid) {
  renderMermaidDiagrams();
}

// ===== SSE Live Reload =====
function connectSSE() {
  const pulse = document.getElementById('live-pulse');
  let retryDelay = 5000;

  const es = new EventSource('/api/events');

  es.addEventListener('connected', () => {
    if (pulse) {
      pulse.className = 'scope-pulse';
      const label = pulse.querySelector('span:last-child');
      if (label) label.textContent = 'Live';
    }
    retryDelay = 5000;
  });

  es.addEventListener('model-updated', (event) => {
    try {
      const data = JSON.parse(event.data);
      const dot = pulse?.querySelector('.scope-pulse-dot');
      if (dot) {
        dot.style.animation = 'none';
        dot.offsetHeight;
        dot.style.animation = 'flash 0.3s ease';
        setTimeout(() => { dot.style.animation = 'pulse 2s ease-in-out infinite'; }, 300);
      }

      showToast(data.changes || 'Model updated');
      commandPaletteLoaded = false;
      reloadContent();
    } catch (e) {
      console.warn('SSE parse error:', e);
    }
  });

  es.addEventListener('validation-error', (event) => {
    try {
      const data = JSON.parse(event.data);
      showErrorBanner(data.errors, data.warnings);
    } catch (e) {
      console.warn('SSE validation parse error:', e);
    }
  });

  es.onerror = () => {
    if (pulse) {
      pulse.className = 'scope-pulse disconnected';
      const label = pulse.querySelector('span:last-child');
      if (label) label.textContent = 'Disconnected';
    }

    es.close();
    setTimeout(() => {
      retryDelay = Math.min(retryDelay * 2, 60000);
      connectSSE();
    }, retryDelay);
  };
}

connectSSE();

// ===== Page Reload (preserves URL + active tab + scroll) =====
async function reloadContent() {
  const savedTab = activeTab;
  const scrollTop = document.getElementById('canvas')?.scrollTop || 0;

  const canvas = document.getElementById('canvas');
  if (canvas) canvas.classList.add('transitioning');

  try {
    const resp = await fetch(window.location.href);
    const html = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const newCanvas = doc.getElementById('canvas');
    if (newCanvas && canvas) {
      canvas.innerHTML = newCanvas.innerHTML;
      canvas.classList.remove('transitioning');

      // Restore active tab if applicable
      if (savedTab) {
        const tab = canvas.querySelector(`.scope-tab[data-tab="${savedTab}"]`);
        if (tab) window.switchTab(savedTab);
      }

      await renderMermaidDiagrams();
      initComponentGraphs();
      initEntityGraphs();
      initFlowGraphs();
      initEventGraphs();
      initStateGraphs();
      initScreenGraphs();
      initApiGraphs();
      initJourneyGraphs();
      initOverviewGraphs();
          canvas.scrollTop = scrollTop;
    }

    const newRail = doc.querySelector('.scope-rail');
    const rail = document.querySelector('.scope-rail');
    if (newRail && rail) {
      rail.innerHTML = newRail.innerHTML;
    }

    // Also refresh the frame nav (contextual tabs may change)
    const newFrameNav = doc.getElementById('frame-nav');
    const frameNav = document.getElementById('frame-nav');
    if (newFrameNav && frameNav) {
      frameNav.outerHTML = newFrameNav.outerHTML;
      setupFrameNavHandlers();
    }

    hideErrorBanner();
  } catch (e) {
    console.warn('Reload error:', e);
    if (canvas) canvas.classList.remove('transitioning');
  }
}

// ===== Diagram Controls =====
window.switchDiagram = function(type) {
  const url = new URL(window.location.href);
  url.searchParams.set('type', type);
  window.history.pushState({}, '', url);
  reloadContent();

  document.querySelectorAll('.scope-type-item').forEach(item => {
    item.classList.toggle('active', item.dataset.diagramType === type);
  });
};

window.downloadDiagram = function(format) {
  const container = document.getElementById('diagram-container');
  if (!container) return;
  const svg = container.querySelector('svg');
  if (!svg) return;

  if (format === 'svg') {
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    downloadBlob(blob, 'diagram.svg');
  } else if (format === 'png') {
    const canvas = document.createElement('canvas');
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext('2d');
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        downloadBlob(blob, 'diagram.png');
      });
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }
};

window.copyMermaid = function() {
  if (currentMermaidSource) {
    navigator.clipboard.writeText(currentMermaidSource).then(() => {
      showToast('Mermaid source copied');
    });
  }
};

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== Toast =====
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'scope-toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ===== Error Banner =====
function showErrorBanner(errors, warnings) {
  const banner = document.getElementById('error-banner');
  if (!banner) return;
  const messages = [];
  if (errors?.length) messages.push(`${errors.length} error(s): ${errors[0].message}`);
  if (warnings?.length) messages.push(`${warnings.length} warning(s)`);
  banner.textContent = messages.join(' | ');
  banner.classList.add('visible');
}

function hideErrorBanner() {
  const banner = document.getElementById('error-banner');
  if (banner) banner.classList.remove('visible');
}

// ===== Table Sorting =====
window.sortTable = function(colIndex) {
  const table = document.getElementById('constructs-table');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const sorted = rows.sort((a, b) => {
    const aText = a.cells[colIndex]?.textContent?.trim() ?? '';
    const bText = b.cells[colIndex]?.textContent?.trim() ?? '';
    return aText.localeCompare(bText);
  });
  sorted.forEach(row => tbody.appendChild(row));
};

// ===== Table Filtering =====
window.filterTable = function(filter, btn) {
  const table = document.getElementById('constructs-table');
  if (!table) return;
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    if (filter === 'all') {
      row.style.display = '';
    } else {
      const impl = row.dataset.impl;
      const match = (filter === 'done' && impl === 'done') ||
                    (filter === 'wip' && impl !== 'done' && impl !== 'pending') ||
                    (filter === 'pending' && (impl === 'pending' || !impl));
      row.style.display = match ? '' : 'none';
    }
  });
  document.querySelectorAll('.scope-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
};

// ===== Deep Command Palette =====
async function loadCommandPaletteData() {
  if (commandPaletteLoaded && commandPaletteItems.length > 0) return;

  try {
    const resp = await fetch('/api/constructs');
    const items = await resp.json();
    commandPaletteItems = items;
    commandPaletteLoaded = true;
  } catch (e) {
    console.warn('Failed to load command palette data:', e);
  }
}

function openCommandPalette() {
  const overlay = document.getElementById('command-palette');
  const input = document.getElementById('command-input');
  if (!overlay || !input) return;
  overlay.classList.add('open');
  input.value = '';
  input.focus();
  loadCommandPaletteData().then(() => renderCommandResults(''));
}

function closeCommandPalette() {
  const overlay = document.getElementById('command-palette');
  if (overlay) overlay.classList.remove('open');
}

function renderCommandResults(query) {
  const container = document.getElementById('command-results');
  if (!container) return;

  const q = query.toLowerCase().trim();
  let filtered = commandPaletteItems;

  if (q) {
    let typeFilter = null;
    let compFilter = null;
    let searchTerm = q;

    const typeMatch = q.match(/^(\w+):\s*(.*)/);
    if (typeMatch) {
      const prefix = typeMatch[1].toLowerCase();
      const rest = typeMatch[2];

      const typeAliases = {
        entity: 'entity', e: 'entity',
        flow: 'flow', f: 'flow',
        api: 'endpoint', endpoint: 'endpoint', ep: 'endpoint',
        state: 'state', s: 'state',
        event: 'event', ev: 'event',
        rule: 'rule', r: 'rule',
        screen: 'screen', sc: 'screen',
        journey: 'journey', j: 'journey',
        component: 'component', comp: 'component', c: 'component',
        page: 'page', diagram: 'diagram',
        enum: 'enum',
      };

      if (typeAliases[prefix]) {
        typeFilter = typeAliases[prefix];
        searchTerm = rest;
      } else {
        const matchingComp = commandPaletteItems.find(
          item => item.type === 'component' && item.name.toLowerCase().startsWith(prefix)
        );
        if (matchingComp) {
          compFilter = matchingComp.name;
          searchTerm = rest;
        }
      }
    }

    filtered = commandPaletteItems.filter(item => {
      if (typeFilter && item.type !== typeFilter) return false;
      if (compFilter && item.component !== compFilter) return false;
      if (!searchTerm) return true;
      return item.name.toLowerCase().includes(searchTerm) ||
             item.component?.toLowerCase().includes(searchTerm);
    });
  }

  const grouped = {};
  for (const item of filtered.slice(0, 30)) {
    const group = item.type;
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(item);
  }

  const TYPE_ORDER = ['page', 'diagram', 'component', 'entity', 'enum', 'flow', 'endpoint', 'state', 'event', 'rule', 'screen', 'journey'];
  const TYPE_COLORS = {
    page: 'var(--scope-text-secondary)',
    diagram: 'var(--scope-text-secondary)',
    component: 'var(--scope-diagram-component)',
    entity: 'var(--scope-diagram-entity)',
    enum: 'var(--scope-diagram-entity)',
    flow: 'var(--scope-diagram-flow)',
    endpoint: 'var(--scope-accent)',
    state: 'var(--scope-diagram-state)',
    event: 'var(--scope-wip)',
    rule: 'var(--scope-error)',
    screen: 'var(--scope-diagram-screen)',
    journey: 'var(--scope-diagram-journey)',
  };

  let html = '';
  let firstItem = true;
  for (const type of TYPE_ORDER) {
    if (!grouped[type]) continue;
    for (const item of grouped[type]) {
      const selected = firstItem ? ' selected' : '';
      firstItem = false;
      const compLabel = item.component ? `<span style="color: var(--scope-text-tertiary); margin-left: auto; font-size: var(--scope-text-xs)">${escapeHtml(item.component)}</span>` : '';
      const color = TYPE_COLORS[item.type] || 'var(--scope-text-secondary)';
      html += `<div class="scope-command-item${selected}" data-href="${item.href}" onclick="navigateTo('${item.href}')">
        <span class="scope-command-item-type" style="color: ${color}">${item.type}</span>
        <span>${escapeHtml(item.name)}</span>
        ${compLabel}
      </div>`;
    }
  }

  if (!html) {
    html = '<div style="padding: var(--scope-space-4); color: var(--scope-text-tertiary); text-align: center">No results</div>';
  }

  container.innerHTML = html;
}

window.navigateTo = function(href) {
  closeCommandPalette();
  navigateSPA(href);
};

// Command palette input handler
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('command-input');
  if (input) {
    input.addEventListener('input', (e) => {
      renderCommandResults(e.target.value);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeCommandPalette();
      } else if (e.key === 'Enter') {
        const selected = document.querySelector('.scope-command-item.selected');
        if (selected) {
          closeCommandPalette();
          navigateSPA(selected.dataset.href);
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = document.querySelectorAll('.scope-command-item');
        const current = document.querySelector('.scope-command-item.selected');
        const idx = Array.from(items).indexOf(current);
        const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
        if (next >= 0 && next < items.length) {
          current?.classList.remove('selected');
          items[next].classList.add('selected');
          items[next].scrollIntoView({ block: 'nearest' });
        }
      }
    });
  }

  const overlay = document.getElementById('command-palette');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeCommandPalette();
    });
  }

  const shortcutsPanel = document.getElementById('shortcuts-panel');
  if (shortcutsPanel) {
    shortcutsPanel.addEventListener('click', (e) => {
      if (e.target === shortcutsPanel) shortcutsPanel.classList.remove('open');
    });
  }

  loadCommandPaletteData();

  // Apply entering animation
  const canvas = document.getElementById('canvas');
  if (canvas) {
    canvas.classList.add('entering');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => canvas.classList.remove('entering'));
    });
  }
});

// ===== Phase 7: Keyboard Navigation =====

function getNavigableItems() {
  // Get items from active tab panel if tabs exist, otherwise from canvas
  const activePanel = document.querySelector('.scope-tab-panel.active');
  const scope = activePanel || document.getElementById('canvas');
  if (!scope) return [];
  return Array.from(scope.querySelectorAll(
    '.scope-component-card, .scope-entity-card, .scope-construct-link'
  ));
}

function updateFocusedItem() {
  document.querySelectorAll('.scope-focused').forEach(el => el.classList.remove('scope-focused'));
  const items = getNavigableItems();
  if (focusedListIdx >= 0 && focusedListIdx < items.length) {
    items[focusedListIdx].classList.add('scope-focused');
    items[focusedListIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// ===== Helpers: Navigation Level =====
function getNavLevel() {
  const frameNav = document.getElementById('frame-nav');
  return frameNav?.dataset.level || 'system';
}

function getFrameTabIds() {
  // Get ordered tab IDs from frame nav (for component level)
  return Array.from(document.querySelectorAll('#frame-nav .scope-frame-tab[data-tab]'))
    .map(el => el.dataset.tab);
}

// ===== Keyboard Shortcuts =====
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  const key = e.key;
  const level = getNavLevel();

  // Command palette
  if (key === '/' || (e.metaKey && key === 'k') || (e.ctrlKey && key === 'k')) {
    e.preventDefault();
    openCommandPalette();
    return;
  }

  // Escape: close modals or go up a level (contextual)
  if (key === 'Escape') {
    const palette = document.getElementById('command-palette');
    const shortcuts = document.getElementById('shortcuts-panel');
    const compPanel = document.querySelector('.scope-components-panel.open');
    if (palette?.classList.contains('open')) {
      closeCommandPalette();
    } else if (shortcuts?.classList.contains('open')) {
      shortcuts.classList.remove('open');
    } else if (compPanel) {
      compPanel.classList.remove('open');
    } else if (level === 'construct') {
      // Back to component
      const frameNav = document.getElementById('frame-nav');
      const compName = frameNav?.dataset.component;
      if (compName) {
        navigateSPA(`/component/${encodeURIComponent(compName)}`);
      } else {
        navigateSPA('/');
      }
    } else if (level === 'component') {
      // Back to components
      navigateSPA('/components');
    } else {
      // System level: go home if not already
      const path = window.location.pathname;
      if (path === '/dashboard' || path === '/components' || path.startsWith('/diagram/')) {
        navigateSPA('/');
      }
    }
    return;
  }

  // Shortcuts panel
  if (key === '?') {
    const panel = document.getElementById('shortcuts-panel');
    if (panel) panel.classList.toggle('open');
    return;
  }

  // j/k — navigate items
  if (key === 'j' || key === 'k') {
    e.preventDefault();
    const items = getNavigableItems();
    if (items.length === 0) return;
    if (key === 'j') {
      focusedListIdx = Math.min(focusedListIdx + 1, items.length - 1);
    } else {
      focusedListIdx = Math.max(focusedListIdx - 1, 0);
    }
    updateFocusedItem();
    return;
  }

  // Enter — open focused item
  if (key === 'Enter') {
    const focused = document.querySelector('.scope-focused');
    if (focused) {
      const link = focused.href || focused.querySelector('a')?.href;
      if (link) {
        e.preventDefault();
        navigateWithTransition(link, e);
      }
    }
    return;
  }

  // Tab — cycle tabs contextually
  if (key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    if (level === 'component') {
      // Cycle through component tabs in frame nav
      const tabIds = getFrameTabIds();
      if (tabIds.length > 1) {
        e.preventDefault();
        const currentIdx = tabIds.indexOf(activeTab || tabIds[0]);
        const nextIdx = (currentIdx + 1) % tabIds.length;
        window.switchTab(tabIds[nextIdx]);
        return;
      }
    } else if (level === 'system') {
      // Cycle frame nav page tabs (system/dashboard)
      const frameTabs = Array.from(document.querySelectorAll('#frame-nav .scope-frame-tab[href]'));
      if (frameTabs.length > 1) {
        e.preventDefault();
        const currentIdx = frameTabs.findIndex(t => t.classList.contains('active'));
        const nextIdx = (currentIdx + 1) % frameTabs.length;
        navigateSPA(frameTabs[nextIdx].getAttribute('href'));
      }
    }
    return;
  }

  // Number keys — contextual
  const numKey = parseInt(key);
  if (numKey >= 1 && numKey <= 9) {
    if (level === 'component') {
      // Switch to Nth tab
      const tabIds = getFrameTabIds();
      const idx = numKey - 1;
      if (idx < tabIds.length) {
        e.preventDefault();
        window.switchTab(tabIds[idx]);
      }
    } else if (level === 'system') {
      if (numKey === 1) {
        navigateSPA('/');
      } else if (numKey === 2) {
        navigateSPA('/components');
      } else if (numKey === 3) {
        navigateSPA('/dashboard');
      }
    }
    return;
  }

  // Fullscreen toggle
  const lower = key.toLowerCase();
  if (lower === 'f') {
    const container = document.getElementById('diagram-container');
    if (container) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        container.requestFullscreen().catch(() => {});
      }
    }
    return;
  }

  // Zoom
  if (key === '+' || key === '=') {
    window.zoomDiagram?.(1.2);
  } else if (key === '-') {
    window.zoomDiagram?.(0.8);
  } else if (key === '0') {
    window.zoomDiagram?.(0);
  }
});

// ===== Theme Toggle =====
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('scope-theme');
  if (saved) {
    document.documentElement.dataset.theme = saved;
    updateMermaidTheme(saved);
  }

  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme;
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('scope-theme', next);
      updateMermaidTheme(next);
      renderMermaidDiagrams();
    });
  }
});

function updateMermaidTheme(theme) {
  if (!window.mermaid) return;
  const isDark = theme !== 'light';
  window.mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      darkMode: true,
      background: '#000000',
      primaryColor: '#000000',
      primaryBorderColor: '#FFFFFF',
      primaryTextColor: '#FFFFFF',
      secondaryColor: '#000000',
      secondaryBorderColor: '#FFFFFF',
      secondaryTextColor: '#FFFFFF',
      tertiaryColor: '#000000',
      lineColor: '#FFFFFF',
      textColor: '#FFFFFF',
      mainBkg: '#000000',
      nodeBorder: '#FFFFFF',
      clusterBkg: '#000000',
      clusterBorder: '#FFFFFF',
      titleColor: '#FFFFFF',
      edgeLabelBackground: '#000000',
      fontFamily: "monospace",
      fontSize: '13px',
    },
    flowchart: { curve: 'basis', htmlLabels: true, useMaxWidth: false },
    er: { useMaxWidth: false },
    sequence: { useMaxWidth: false },
  });
}

// ===== Frame Nav Bar =====
function setupFrameNavHandlers() {
  const searchBtn = document.getElementById('frame-search-btn');
  if (searchBtn) searchBtn.addEventListener('click', () => openCommandPalette());

  const helpBtn = document.getElementById('frame-help-btn');
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      const panel = document.getElementById('shortcuts-panel');
      if (panel) panel.classList.toggle('open');
    });
  }

  // Back button handler
  const backBtn = document.querySelector('#frame-nav .scope-frame-tab[data-nav="back"]');
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const href = backBtn.getAttribute('href');
      if (href) navigateWithTransition(href, e);
    });
  }

  // Component tab click handlers (already have onclick but add transition)
  const level = getNavLevel();
  if (level === 'component') {
    // Initialize activeTab from frame nav
    const activeFrameTab = document.querySelector('#frame-nav .scope-frame-tab.active[data-tab]');
    if (activeFrameTab && !activeTab) {
      activeTab = activeFrameTab.dataset.tab;
      // Ensure panel is synced
      window.switchTab(activeTab);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupFrameNavHandlers();
});

// ===== SPA Navigation (no full page reload) =====
async function navigateSPA(href) {
  const canvas = document.getElementById('canvas');
  if (canvas) canvas.classList.add('transitioning');

  try {
    const resp = await fetch(href);
    const html = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Swap canvas (main content area)
    const newCanvas = doc.getElementById('canvas');
    if (newCanvas && canvas) {
      canvas.innerHTML = newCanvas.innerHTML;
      canvas.classList.remove('transitioning');
    }

    // Swap rail (sidebar)
    const newRail = doc.querySelector('.scope-rail');
    const rail = document.querySelector('.scope-rail');
    if (newRail && rail) {
      rail.innerHTML = newRail.innerHTML;
    }

    // Swap frame nav (top bar with breadcrumbs/tabs)
    const newFrameNav = doc.getElementById('frame-nav');
    const frameNav = document.getElementById('frame-nav');
    if (newFrameNav && frameNav) {
      frameNav.outerHTML = newFrameNav.outerHTML;
      setupFrameNavHandlers();
    }

    // Update document title
    const newTitle = doc.querySelector('title');
    if (newTitle) document.title = newTitle.textContent;

    // Update URL without reload
    window.history.pushState({}, '', href);

    // Reset state
    activeTab = null;
    focusedListIdx = -1;
    commandPaletteLoaded = false;

    // Re-init interactive elements
    await renderMermaidDiagrams();
    initComponentGraphs();
    initEntityGraphs();
    initFlowGraphs();
    initEventGraphs();
    initStateGraphs();
    initScreenGraphs();
    initApiGraphs();
    initJourneyGraphs();
    initOverviewGraphs();

    // Restore active tab if component level
    const level = getNavLevel();
    if (level === 'component') {
      const activeFrameTab = document.querySelector('#frame-nav .scope-frame-tab.active[data-tab]');
      if (activeFrameTab) {
        activeTab = activeFrameTab.dataset.tab;
        window.switchTab(activeTab);
      }
    }

    hideErrorBanner();
  } catch (e) {
    console.warn('SPA navigation error, falling back:', e);
    if (canvas) canvas.classList.remove('transitioning');
    window.location.href = href;
  }
}

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
  navigateSPA(window.location.href);
});

// ===== Helpers =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
