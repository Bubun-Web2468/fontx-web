/* ============================================
   Glyph Editor — Canvas-based Bezier Curve Editor
   ============================================ */

class GlyphEditor {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.font = null;
    this.glyph = null;
    this.glyphIndex = -1;

    // View state
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.viewInitialized = false;

    // Interaction state
    this.tool = 'select'; // select, pan, pen, move
    this.isDragging = false;
    this.isPanning = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.panStartX = 0;
    this.panStartY = 0;

    // Selection
    this.selectedPoints = [];
    this.hoveredPoint = null;
    this.pointRadius = 5;
    this.hitRadius = 10;

    // Undo/Redo
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndo = 50;

    // Guidelines
    this.showGuidelines = true;
    this.showPoints = true;
    this.showGrid = true;
    this.showMetrics = true;

    // Colors
    this.colors = {
      background: '#0d1117',
      grid: 'rgba(255, 255, 255, 0.03)',
      gridMajor: 'rgba(255, 255, 255, 0.06)',
      outline: '#58a6ff',
      fill: 'rgba(88, 166, 255, 0.08)',
      onCurve: '#3fb950',
      offCurve: '#f78166',
      selected: '#ffffff',
      hover: '#bc8cff',
      baseline: 'rgba(247, 129, 102, 0.5)',
      ascender: 'rgba(88, 166, 255, 0.4)',
      descender: 'rgba(188, 140, 255, 0.4)',
      xHeight: 'rgba(63, 185, 80, 0.3)',
      advanceWidth: 'rgba(210, 153, 34, 0.4)',
      handle: 'rgba(247, 129, 102, 0.6)',
      origin: 'rgba(255, 255, 255, 0.15)',
      sideBearing: 'rgba(63, 185, 80, 0.2)'
    };

    // Parsed points for editing
    this.editablePoints = [];

    // Setup events
    this.setupEvents();
    this.resizeCanvas();

    // Resize observer
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    if (this.canvas.parentElement) {
      this.resizeObserver.observe(this.canvas.parentElement);
    }
  }

  /**
   * Set up mouse and keyboard events
   */
  setupEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
    this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
  }

  /**
   * Resize canvas to fill parent
   */
  resizeCanvas() {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';

    this.ctx.scale(dpr, dpr);
    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;

    this.render();
  }

  /**
   * Load a font
   */
  setFont(font) {
    this.font = font;
  }

  /**
   * Load a glyph for editing
   */
  setGlyph(glyph, index) {
    this.glyph = glyph;
    this.glyphIndex = index;
    this.selectedPoints = [];
    this.hoveredPoint = null;

    // Parse glyph path into editable points
    this.parseGlyphPoints();

    // Reset view to fit glyph
    this.fitToView();

    this.render();
  }

  /**
   * Parse glyph path commands into editable point objects
   */
  parseGlyphPoints() {
    this.editablePoints = [];
    if (!this.glyph || !this.glyph.path) return;

    const cmds = this.glyph.path.commands;
    let contourIndex = 0;
    let pointIndex = 0;

    for (let i = 0; i < cmds.length; i++) {
      const cmd = cmds[i];

      if (cmd.type === 'M') {
        contourIndex++;
        this.editablePoints.push({
          x: cmd.x,
          y: cmd.y,
          type: 'move',
          onCurve: true,
          contour: contourIndex,
          cmdIndex: i,
          index: pointIndex++
        });
      } else if (cmd.type === 'L') {
        this.editablePoints.push({
          x: cmd.x,
          y: cmd.y,
          type: 'line',
          onCurve: true,
          contour: contourIndex,
          cmdIndex: i,
          index: pointIndex++
        });
      } else if (cmd.type === 'Q') {
        // Quadratic bezier: control point + on-curve end point
        this.editablePoints.push({
          x: cmd.x1,
          y: cmd.y1,
          type: 'quad-control',
          onCurve: false,
          contour: contourIndex,
          cmdIndex: i,
          controlFor: pointIndex + 1,
          index: pointIndex++
        });
        this.editablePoints.push({
          x: cmd.x,
          y: cmd.y,
          type: 'quad-end',
          onCurve: true,
          contour: contourIndex,
          cmdIndex: i,
          index: pointIndex++
        });
      } else if (cmd.type === 'C') {
        // Cubic bezier: 2 control points + end point
        this.editablePoints.push({
          x: cmd.x1,
          y: cmd.y1,
          type: 'cubic-control1',
          onCurve: false,
          contour: contourIndex,
          cmdIndex: i,
          index: pointIndex++
        });
        this.editablePoints.push({
          x: cmd.x2,
          y: cmd.y2,
          type: 'cubic-control2',
          onCurve: false,
          contour: contourIndex,
          cmdIndex: i,
          index: pointIndex++
        });
        this.editablePoints.push({
          x: cmd.x,
          y: cmd.y,
          type: 'cubic-end',
          onCurve: true,
          contour: contourIndex,
          cmdIndex: i,
          index: pointIndex++
        });
      }
      // 'Z' (close path) doesn't add points
    }
  }

  /**
   * Write editable points back to glyph path
   */
  syncPointsToGlyph() {
    if (!this.glyph || !this.glyph.path) return;

    const cmds = this.glyph.path.commands;

    for (const pt of this.editablePoints) {
      const cmd = cmds[pt.cmdIndex];
      if (!cmd) continue;

      switch (pt.type) {
        case 'move':
        case 'line':
        case 'quad-end':
        case 'cubic-end':
          cmd.x = Math.round(pt.x);
          cmd.y = Math.round(pt.y);
          break;
        case 'quad-control':
          cmd.x1 = Math.round(pt.x);
          cmd.y1 = Math.round(pt.y);
          break;
        case 'cubic-control1':
          cmd.x1 = Math.round(pt.x);
          cmd.y1 = Math.round(pt.y);
          break;
        case 'cubic-control2':
          cmd.x2 = Math.round(pt.x);
          cmd.y2 = Math.round(pt.y);
          break;
      }
    }
  }

  /**
   * Fit glyph to canvas view
   */
  fitToView() {
    if (!this.glyph || !this.font) {
      this.panX = this.canvasWidth / 2;
      this.panY = this.canvasHeight / 2;
      this.zoom = 1;
      return;
    }

    const upm = this.font.unitsPerEm;
    const ascender = this.font.ascender;
    const descender = this.font.descender;
    const totalHeight = ascender - descender;
    const advanceWidth = this.glyph.advanceWidth || upm;

    const padding = 60;
    const availW = this.canvasWidth - padding * 2;
    const availH = this.canvasHeight - padding * 2;

    const scaleX = availW / advanceWidth;
    const scaleY = availH / totalHeight;
    this.zoom = Math.min(scaleX, scaleY) * 0.85;

    // Center the glyph
    this.panX = (this.canvasWidth - advanceWidth * this.zoom) / 2;
    this.panY = padding + ascender * this.zoom;

    this.viewInitialized = true;
  }

  /**
   * Convert font coordinates to canvas coordinates
   */
  fontToCanvas(fx, fy) {
    return {
      x: this.panX + fx * this.zoom,
      y: this.panY - fy * this.zoom  // Y is flipped
    };
  }

  /**
   * Convert canvas coordinates to font coordinates
   */
  canvasToFont(cx, cy) {
    return {
      x: (cx - this.panX) / this.zoom,
      y: -(cy - this.panY) / this.zoom
    };
  }

  /**
   * Find point under mouse
   */
  hitTestPoint(canvasX, canvasY) {
    const hitR = this.hitRadius / this.zoom;

    for (let i = this.editablePoints.length - 1; i >= 0; i--) {
      const pt = this.editablePoints[i];
      const cp = this.fontToCanvas(pt.x, pt.y);
      const dx = canvasX - cp.x;
      const dy = canvasY - cp.y;
      if (dx * dx + dy * dy < this.hitRadius * this.hitRadius) {
        return pt;
      }
    }
    return null;
  }

  /* ── Mouse Events ── */

  onMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Middle mouse or space+click = pan
    if (e.button === 1 || (e.button === 0 && this.tool === 'pan')) {
      this.isPanning = true;
      this.panStartX = x - this.panX;
      this.panStartY = y - this.panY;
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (e.button === 0 && this.tool === 'select') {
      const hit = this.hitTestPoint(x, y);

      if (hit) {
        if (e.shiftKey) {
          // Toggle selection
          const idx = this.selectedPoints.indexOf(hit.index);
          if (idx >= 0) {
            this.selectedPoints.splice(idx, 1);
          } else {
            this.selectedPoints.push(hit.index);
          }
        } else {
          if (!this.selectedPoints.includes(hit.index)) {
            this.selectedPoints = [hit.index];
          }
        }

        // Save undo state before drag
        this.saveUndoState();

        this.isDragging = true;
        this.dragStartX = x;
        this.dragStartY = y;
      } else {
        // Deselect if clicking empty space
        if (!e.shiftKey) {
          this.selectedPoints = [];
        }
      }

      this.render();
    }
  }

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.isPanning) {
      this.panX = x - this.panStartX;
      this.panY = y - this.panStartY;
      this.render();
      return;
    }

    if (this.isDragging && this.selectedPoints.length > 0) {
      const dx = (x - this.dragStartX) / this.zoom;
      const dy = -(y - this.dragStartY) / this.zoom;

      for (const idx of this.selectedPoints) {
        const pt = this.editablePoints[idx];
        if (pt) {
          pt.x += dx;
          pt.y += dy;
        }
      }

      this.dragStartX = x;
      this.dragStartY = y;

      this.syncPointsToGlyph();
      this.render();

      // Emit change event
      this.onGlyphChanged();
      return;
    }

    // Hover detection
    const hit = this.hitTestPoint(x, y);
    if (hit !== this.hoveredPoint) {
      this.hoveredPoint = hit;
      this.render();
    }

    // Update cursor
    if (this.tool === 'select') {
      this.canvas.style.cursor = hit ? 'pointer' : 'crosshair';
    } else if (this.tool === 'pan') {
      this.canvas.style.cursor = 'grab';
    }

    // Update coordinates display
    const fontCoords = this.canvasToFont(x, y);
    this.updateCoordinates(Math.round(fontCoords.x), Math.round(fontCoords.y));
  }

  onMouseUp(e) {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = this.tool === 'pan' ? 'grab' : 'crosshair';
    }
    this.isDragging = false;
  }

  onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(20, this.zoom * delta));

    // Zoom towards mouse position
    this.panX = x - (x - this.panX) * (newZoom / this.zoom);
    this.panY = y - (y - this.panY) * (newZoom / this.zoom);
    this.zoom = newZoom;

    this.render();
    this.updateZoomDisplay();
  }

  onDoubleClick(e) {
    // Double-click to fit view
    if (!this.hitTestPoint(e.clientX - this.canvas.getBoundingClientRect().left,
      e.clientY - this.canvas.getBoundingClientRect().top)) {
      this.fitToView();
      this.render();
      this.updateZoomDisplay();
    }
  }

  onKeyDown(e) {
    // If the user is typing in an input, textarea, select, or editable element, DO NOT intercept keys!
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
      return;
    }

    // Do not intercept keys if any modal is currently open
    if (document.querySelector('.modal-overlay.active')) {
      return;
    }

    // Only handle keys when canvas is focused/visible
    if (!this.glyph) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      this.deleteSelectedPoints();
    } else if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      this.undo();
    } else if (e.ctrlKey && e.key === 'y') {
      e.preventDefault();
      this.redo();
    } else if (e.ctrlKey && e.key === 'a') {
      e.preventDefault();
      this.selectAll();
    } else if (e.key === 'Escape') {
      this.selectedPoints = [];
      this.render();
    }

    // Arrow keys for nudging
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && this.selectedPoints.length > 0) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowUp') dy = step;
      if (e.key === 'ArrowDown') dy = -step;
      if (e.key === 'ArrowLeft') dx = -step;
      if (e.key === 'ArrowRight') dx = step;

      this.saveUndoState();
      for (const idx of this.selectedPoints) {
        const pt = this.editablePoints[idx];
        if (pt) {
          pt.x += dx;
          pt.y += dy;
        }
      }
      this.syncPointsToGlyph();
      this.render();
      this.onGlyphChanged();
    }
  }

  /* ── Editing Operations ── */

  deleteSelectedPoints() {
    if (this.selectedPoints.length === 0) return;
    this.saveUndoState();

    // Remove selected points from editablePoints
    // and rebuild the path commands
    const toDelete = new Set(this.selectedPoints);
    this.editablePoints = this.editablePoints.filter(p => !toDelete.has(p.index));

    // Rebuild glyph path
    this.rebuildPathFromPoints();
    this.parseGlyphPoints(); // Re-parse to get clean indices
    this.selectedPoints = [];
    this.render();
    this.onGlyphChanged();
  }

  rebuildPathFromPoints() {
    if (!this.glyph) return;

    const path = new opentype.Path();
    let currentContour = -1;

    for (const pt of this.editablePoints) {
      if (pt.contour !== currentContour) {
        if (currentContour !== -1) {
          path.close();
        }
        currentContour = pt.contour;
        path.moveTo(Math.round(pt.x), Math.round(pt.y));
      } else {
        switch (pt.type) {
          case 'line':
            path.lineTo(Math.round(pt.x), Math.round(pt.y));
            break;
          case 'quad-control': {
            // Find the end point
            const nextIdx = this.editablePoints.indexOf(pt) + 1;
            if (nextIdx < this.editablePoints.length) {
              const end = this.editablePoints[nextIdx];
              path.quadraticCurveTo(
                Math.round(pt.x), Math.round(pt.y),
                Math.round(end.x), Math.round(end.y)
              );
            }
            break;
          }
          case 'quad-end':
            // Already handled by quad-control
            break;
          case 'cubic-control1': {
            const idx = this.editablePoints.indexOf(pt);
            if (idx + 2 < this.editablePoints.length) {
              const c2 = this.editablePoints[idx + 1];
              const end = this.editablePoints[idx + 2];
              path.curveTo(
                Math.round(pt.x), Math.round(pt.y),
                Math.round(c2.x), Math.round(c2.y),
                Math.round(end.x), Math.round(end.y)
              );
            }
            break;
          }
          case 'cubic-control2':
          case 'cubic-end':
            // Already handled by cubic-control1
            break;
          case 'move':
            path.moveTo(Math.round(pt.x), Math.round(pt.y));
            break;
        }
      }
    }

    if (currentContour !== -1) {
      path.close();
    }

    this.glyph.path = path;
  }

  selectAll() {
    this.selectedPoints = this.editablePoints.map(p => p.index);
    this.render();
  }

  /* ── Transform Operations ── */

  transformSelected(transformFn) {
    if (this.selectedPoints.length === 0) return;
    this.saveUndoState();

    // Get center of selected points
    let cx = 0, cy = 0;
    for (const idx of this.selectedPoints) {
      const pt = this.editablePoints[idx];
      if (pt) { cx += pt.x; cy += pt.y; }
    }
    cx /= this.selectedPoints.length;
    cy /= this.selectedPoints.length;

    for (const idx of this.selectedPoints) {
      const pt = this.editablePoints[idx];
      if (pt) {
        const result = transformFn(pt.x, pt.y, cx, cy);
        pt.x = result.x;
        pt.y = result.y;
      }
    }

    this.syncPointsToGlyph();
    this.render();
    this.onGlyphChanged();
  }

  flipHorizontal() {
    this.transformSelected((x, y, cx, cy) => ({
      x: 2 * cx - x,
      y: y
    }));
  }

  flipVertical() {
    this.transformSelected((x, y, cx, cy) => ({
      x: x,
      y: 2 * cy - y
    }));
  }

  rotate(degrees) {
    const rad = degrees * Math.PI / 180;
    this.transformSelected((x, y, cx, cy) => {
      const dx = x - cx;
      const dy = y - cy;
      return {
        x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
        y: cy + dx * Math.sin(rad) + dy * Math.cos(rad)
      };
    });
  }

  scale(factor) {
    this.transformSelected((x, y, cx, cy) => ({
      x: cx + (x - cx) * factor,
      y: cy + (y - cy) * factor
    }));
  }

  /* ── Undo/Redo ── */

  saveUndoState() {
    const state = JSON.stringify(this.editablePoints);
    this.undoStack.push(state);
    if (this.undoStack.length > this.maxUndo) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const currentState = JSON.stringify(this.editablePoints);
    this.redoStack.push(currentState);

    const prevState = this.undoStack.pop();
    this.editablePoints = JSON.parse(prevState);
    this.syncPointsToGlyph();
    this.selectedPoints = [];
    this.render();
    this.onGlyphChanged();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const currentState = JSON.stringify(this.editablePoints);
    this.undoStack.push(currentState);

    const nextState = this.redoStack.pop();
    this.editablePoints = JSON.parse(nextState);
    this.syncPointsToGlyph();
    this.selectedPoints = [];
    this.render();
    this.onGlyphChanged();
  }

  /* ── Rendering ── */

  render() {
    if (!this.ctx || !this.canvasWidth) return;

    const ctx = this.ctx;
    const w = this.canvasWidth;
    const h = this.canvasHeight;

    // Clear
    ctx.fillStyle = this.colors.background;
    ctx.fillRect(0, 0, w, h);

    // Draw grid
    if (this.showGrid) {
      this.drawGrid(ctx, w, h);
    }

    if (!this.glyph || !this.font) {
      this.drawEmptyState(ctx, w, h);
      return;
    }

    // Draw metrics guidelines
    if (this.showMetrics) {
      this.drawMetricLines(ctx, w, h);
    }

    // Draw glyph outline
    this.drawGlyphOutline(ctx);

    // Draw control handles
    if (this.showPoints) {
      this.drawHandles(ctx);
      this.drawPoints(ctx);
    }
  }

  drawGrid(ctx, w, h) {
    const gridSize = 50 * this.zoom;
    if (gridSize < 5) return;

    ctx.strokeStyle = this.colors.grid;
    ctx.lineWidth = 0.5;

    const startX = this.panX % gridSize;
    const startY = this.panY % gridSize;

    ctx.beginPath();
    for (let x = startX; x < w; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = startY; y < h; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Major grid lines
    const majorSize = gridSize * 5;
    if (majorSize > 20) {
      ctx.strokeStyle = this.colors.gridMajor;
      ctx.lineWidth = 0.5;

      const majorStartX = this.panX % majorSize;
      const majorStartY = this.panY % majorSize;

      ctx.beginPath();
      for (let x = majorStartX; x < w; x += majorSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = majorStartY; y < h; y += majorSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    }
  }

  drawMetricLines(ctx, w, h) {
    if (!this.font) return;

    const metrics = [
      { y: 0, color: this.colors.baseline, label: 'Baseline' },
      { y: this.font.ascender, color: this.colors.ascender, label: 'Ascender' },
      { y: this.font.descender, color: this.colors.descender, label: 'Descender' },
    ];

    // x-Height (if available via OS/2 table)
    if (this.font.tables && this.font.tables.os2 && this.font.tables.os2.sxHeight) {
      metrics.push({ y: this.font.tables.os2.sxHeight, color: this.colors.xHeight, label: 'x-Height' });
    }

    for (const m of metrics) {
      const canvasY = this.panY - m.y * this.zoom;

      ctx.strokeStyle = m.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, canvasY);
      ctx.lineTo(w, canvasY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = m.color;
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(m.label, 8, canvasY - 4);
    }

    // Origin line (vertical at x=0)
    const originX = this.panX;
    ctx.strokeStyle = this.colors.origin;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Advance width line
    if (this.glyph && this.glyph.advanceWidth) {
      const awX = this.panX + this.glyph.advanceWidth * this.zoom;
      ctx.strokeStyle = this.colors.advanceWidth;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(awX, 0);
      ctx.lineTo(awX, h);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = this.colors.advanceWidth;
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(`Width: ${this.glyph.advanceWidth}`, awX + 4, 20);
    }

    // Side bearing zones
    if (this.glyph && this.glyph.path) {
      const bbox = this.glyph.path.getBoundingBox();
      if (bbox.x1 !== Infinity) {
        // Left side bearing
        const lsbX = this.panX + bbox.x1 * this.zoom;
        ctx.fillStyle = this.colors.sideBearing;
        ctx.fillRect(originX, 0, lsbX - originX, h);

        // Right side bearing
        if (this.glyph.advanceWidth) {
          const rbX = this.panX + bbox.x2 * this.zoom;
          const awX = this.panX + this.glyph.advanceWidth * this.zoom;
          ctx.fillStyle = this.colors.sideBearing;
          ctx.fillRect(rbX, 0, awX - rbX, h);
        }
      }
    }
  }

  drawGlyphOutline(ctx) {
    if (!this.glyph || !this.glyph.path) return;

    const cmds = this.glyph.path.commands;
    if (cmds.length === 0) return;

    // Fill
    ctx.beginPath();
    for (const cmd of cmds) {
      switch (cmd.type) {
        case 'M': {
          const p = this.fontToCanvas(cmd.x, cmd.y);
          ctx.moveTo(p.x, p.y);
          break;
        }
        case 'L': {
          const p = this.fontToCanvas(cmd.x, cmd.y);
          ctx.lineTo(p.x, p.y);
          break;
        }
        case 'Q': {
          const c = this.fontToCanvas(cmd.x1, cmd.y1);
          const p = this.fontToCanvas(cmd.x, cmd.y);
          ctx.quadraticCurveTo(c.x, c.y, p.x, p.y);
          break;
        }
        case 'C': {
          const c1 = this.fontToCanvas(cmd.x1, cmd.y1);
          const c2 = this.fontToCanvas(cmd.x2, cmd.y2);
          const p = this.fontToCanvas(cmd.x, cmd.y);
          ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p.x, p.y);
          break;
        }
        case 'Z':
          ctx.closePath();
          break;
      }
    }

    ctx.fillStyle = this.colors.fill;
    ctx.fill('nonzero');

    // Outline stroke
    ctx.strokeStyle = this.colors.outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  drawHandles(ctx) {
    // Draw handle lines from on-curve to off-curve points
    ctx.strokeStyle = this.colors.handle;
    ctx.lineWidth = 1;

    for (let i = 0; i < this.editablePoints.length; i++) {
      const pt = this.editablePoints[i];
      if (!pt.onCurve) {
        // Find the associated on-curve point
        let prevOnCurve = null;
        let nextOnCurve = null;

        // Look backward for previous on-curve
        for (let j = i - 1; j >= 0; j--) {
          if (this.editablePoints[j].contour !== pt.contour) break;
          if (this.editablePoints[j].onCurve) {
            prevOnCurve = this.editablePoints[j];
            break;
          }
        }

        // Look forward for next on-curve
        for (let j = i + 1; j < this.editablePoints.length; j++) {
          if (this.editablePoints[j].contour !== pt.contour) break;
          if (this.editablePoints[j].onCurve) {
            nextOnCurve = this.editablePoints[j];
            break;
          }
        }

        const cp = this.fontToCanvas(pt.x, pt.y);

        if (prevOnCurve) {
          const pp = this.fontToCanvas(prevOnCurve.x, prevOnCurve.y);
          ctx.beginPath();
          ctx.moveTo(pp.x, pp.y);
          ctx.lineTo(cp.x, cp.y);
          ctx.stroke();
        }

        if (nextOnCurve && pt.type === 'cubic-control2') {
          const np = this.fontToCanvas(nextOnCurve.x, nextOnCurve.y);
          ctx.beginPath();
          ctx.moveTo(cp.x, cp.y);
          ctx.lineTo(np.x, np.y);
          ctx.stroke();
        }
      }
    }
  }

  drawPoints(ctx) {
    for (const pt of this.editablePoints) {
      const cp = this.fontToCanvas(pt.x, pt.y);
      const isSelected = this.selectedPoints.includes(pt.index);
      const isHovered = this.hoveredPoint === pt;

      const r = isHovered ? this.pointRadius + 2 : this.pointRadius;

      if (pt.onCurve) {
        // On-curve: filled square
        ctx.fillStyle = isSelected ? this.colors.selected :
          isHovered ? this.colors.hover : this.colors.onCurve;
        ctx.strokeStyle = isSelected ? this.colors.selected : this.colors.onCurve;
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.rect(cp.x - r, cp.y - r, r * 2, r * 2);
        if (isSelected) {
          ctx.fill();
        } else {
          ctx.fillStyle = this.colors.background;
          ctx.fill();
          ctx.stroke();
        }

        // Fill selected
        if (isSelected) {
          ctx.fillStyle = this.colors.selected;
          ctx.fill();
        }
      } else {
        // Off-curve: circle
        ctx.fillStyle = isSelected ? this.colors.selected :
          isHovered ? this.colors.hover : this.colors.offCurve;
        ctx.strokeStyle = isSelected ? this.colors.selected : this.colors.offCurve;
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.arc(cp.x, cp.y, r, 0, Math.PI * 2);
        if (isSelected) {
          ctx.fill();
        } else {
          ctx.fillStyle = this.colors.background;
          ctx.fill();
          ctx.stroke();
        }
      }
    }
  }

  drawEmptyState(ctx, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.font = '16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Select a glyph to edit', w / 2, h / 2 - 10);
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillText('Click a glyph from the browser panel', w / 2, h / 2 + 14);
    ctx.textAlign = 'left';
  }

  /* ── Tool Selection ── */

  setTool(tool) {
    this.tool = tool;
    switch (tool) {
      case 'select':
        this.canvas.style.cursor = 'crosshair';
        break;
      case 'pan':
        this.canvas.style.cursor = 'grab';
        break;
      case 'pen':
        this.canvas.style.cursor = 'crosshair';
        break;
    }

    // Update toolbar buttons
    document.querySelectorAll('.glyph-editor-tools button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
  }

  /* ── Zoom controls ── */

  zoomIn() {
    this.zoom = Math.min(20, this.zoom * 1.2);
    this.render();
    this.updateZoomDisplay();
  }

  zoomOut() {
    this.zoom = Math.max(0.1, this.zoom / 1.2);
    this.render();
    this.updateZoomDisplay();
  }

  zoomFit() {
    this.fitToView();
    this.render();
    this.updateZoomDisplay();
  }

  /* ── Callbacks ── */

  onGlyphChanged() {
    // Override in app.js to handle glyph modifications
    if (typeof window.onGlyphEdited === 'function') {
      window.onGlyphEdited(this.glyph, this.glyphIndex);
    }
  }

  updateCoordinates(x, y) {
    const el = document.getElementById('status-coords');
    if (el) el.textContent = `X: ${x}  Y: ${y}`;
  }

  updateZoomDisplay() {
    const el = document.getElementById('zoom-level');
    if (el) el.textContent = `${Math.round(this.zoom * 100)}%`;
    const statusEl = document.getElementById('status-zoom');
    if (statusEl) statusEl.textContent = `Zoom: ${Math.round(this.zoom * 100)}%`;
  }

  /* ── Public getters ── */

  getSelectedCount() {
    return this.selectedPoints.length;
  }

  getPointCount() {
    return this.editablePoints.length;
  }

  getContourCount() {
    if (this.editablePoints.length === 0) return 0;
    return this.editablePoints[this.editablePoints.length - 1].contour;
  }
}

window.GlyphEditor = GlyphEditor;
