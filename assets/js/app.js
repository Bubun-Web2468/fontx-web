/* ============================================
   FontForge Studio — Main Application Controller
   ============================================ */

class FontEditorApp {
  constructor() {
    this.font = null;
    this.fileName = '';
    this.fileBuffer = null;
    this.glyphEditor = null;
    this.kerningEditor = null;
    this.validator = null;
    this.modified = false;

    // State
    this.selectedGlyphIndex = -1;
    this.glyphList = [];
    this.filteredGlyphs = [];
    this.currentFilter = 'all';
    this.searchQuery = '';

    // Active tab
    this.activeEditorTab = 'editor';

    // Preview
    this.previewText = 'Today\'s temperature is 25℃ (77℉). The angle is 90°, and every symbol should display clearly. 0123456789';
    this.previewSizes = [14, 24, 36, 48];
    this.activePreviewSize = 24;

    // Initialize
    this.init();
  }

  init() {
    // Set up drop zone
    this.setupDropZone();

    // Set up file input
    this.setupFileInput();

    // Set up menu
    this.setupMenu();

    // Set up toolbar
    this.setupToolbar();

    // Set up preview
    this.setupPreview();

    // Set up editor tabs
    this.setupEditorTabs();

    // Set up search
    this.setupSearch();

    // Set up filter buttons
    this.setupFilters();

    // Create glyph editor
    this.glyphEditor = new GlyphEditor('glyph-canvas');

    // Create validator
    this.validator = new FontValidator();

    // Set up theme toggle
    this.setupTheme();

    // Set up preview resize
    this.setupPreviewResize();

    // Set up sidebar resize
    this.setupSidebarResize();

    // Glyph change callback
    window.onGlyphEdited = (glyph, index) => {
      this.modified = true;
      this.updateProperties();
      this.updatePreview();
      this.updateGlyphCell(index);
    };

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // If user is interacting with any input, textarea, select, or contenteditable, ignore
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
      }

      // If a modal is open, don't trigger global shortcuts; allow Escape to close modal
      if (document.querySelector('.modal-overlay.active')) {
        if (e.key === 'Escape') {
          const activeModal = document.querySelector('.modal-overlay.active');
          if (activeModal) activeModal.classList.remove('active');
        }
        return;
      }

      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        document.getElementById('file-input').click();
      } else if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        this.showNewFontModal();
      } else if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        this.exportFontManual(this.font && this.font.outlinesFormat === 'cff' ? 'otf' : 'ttf');
      }
    });
  }

  /* ═══════════════════════════════════════════
     File Loading
     ═══════════════════════════════════════════ */

  setupDropZone() {
    const dropZone = document.getElementById('drop-zone');
    const welcomeScreen = document.getElementById('welcome-screen');

    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(event => {
      dropZone.addEventListener(event, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(event => {
      dropZone.addEventListener(event, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.loadFontFile(files[0]);
      }
    });

    dropZone.addEventListener('click', () => {
      document.getElementById('file-input').click();
    });
  }

  setupFileInput() {
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.loadFontFile(e.target.files[0]);
        }
      });
    }
  }

  async loadFontFile(file) {
    const validExts = ['.ttf', '.otf', '.woff', '.woff2'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExts.includes(ext)) {
      this.showToast('Invalid file format. Please upload a .ttf, .otf, .woff, or .woff2 file.', 'error');
      return;
    }

    try {
      this.showToast('Loading font...', 'info');
      this.fileName = file.name;

      const buffer = await file.arrayBuffer();
      this.fileBuffer = buffer;

      // Validate font file signature (magic bytes) to handle incorrect/empty browser MIME types
      if (buffer.byteLength < 4) {
        throw new Error('File is too small to be a valid font');
      }

      const view = new DataView(buffer);
      const magic = view.getUint32(0);
      const isTrueType = (magic === 0x00010000 || magic === 0x74727565); // 0x00010000 or 'true'
      const isOpenType = (magic === 0x4F54544F); // 'OTTO'
      const isWOFF     = (magic === 0x774F4646); // 'wOFF'
      const isWOFF2    = (magic === 0x774F4632); // 'wOF2'

      if (!isTrueType && !isOpenType && !isWOFF && !isWOFF2) {
        throw new Error('Invalid font signature: file does not match TTF, OTF, or WOFF format');
      }

      this.font = opentype.parse(buffer);

      if (!this.font) {
        throw new Error('Failed to parse font file');
      }

      // Initialize subsystems
      this.glyphEditor.setFont(this.font);
      this.kerningEditor = new KerningEditor(this.font);

      // Build glyph list
      this.buildGlyphList();

      // Update UI
      this.hideWelcomeScreen();
      this.updateFontName();
      this.renderGlyphGrid();
      this.updatePreview();
      this.updateStatusBar();

      // Register custom font for preview
      this.registerFontForPreview(buffer);

      this.modified = false;
      this.showToast(`Font loaded: ${this.fileName} (${this.font.glyphs.length} glyphs)`, 'success');

    } catch (error) {
      console.error('Font loading error:', error);
      this.showToast(`Error loading font: ${error.message}`, 'error');
    }
  }

  registerFontForPreview(buffer) {
    try {
      // Create a FontFace from the buffer for live preview
      const fontFace = new FontFace('PreviewFont', buffer);
      fontFace.load().then((loaded) => {
        document.fonts.add(loaded);
        this.updatePreview();
      }).catch(err => {
        console.warn('Could not register font for preview:', err);
      });
    } catch (e) {
      console.warn('FontFace API not supported:', e);
    }
  }

  hideWelcomeScreen() {
    const ws = document.getElementById('welcome-screen');
    if (ws) ws.classList.add('hidden');
  }

  showWelcomeScreen() {
    const ws = document.getElementById('welcome-screen');
    if (ws) ws.classList.remove('hidden');
  }

  /* ═══════════════════════════════════════════
     Glyph List & Grid
     ═══════════════════════════════════════════ */

  buildGlyphList() {
    this.glyphList = [];
    if (!this.font) return;

    for (let i = 0; i < this.font.glyphs.length; i++) {
      const g = this.font.glyphs.get(i);
      const hasOutline = g.path && g.path.commands && g.path.commands.length > 0;

      this.glyphList.push({
        index: i,
        name: g.name || `.glyph${i}`,
        unicode: g.unicode,
        char: g.unicode ? String.fromCodePoint(g.unicode) : '',
        hasOutline: hasOutline,
        advanceWidth: g.advanceWidth || 0
      });
    }

    this.applyFilters();
  }

  applyFilters() {
    let list = [...this.glyphList];

    // Apply category filter
    if (this.currentFilter === 'latin') {
      list = list.filter(g => g.unicode >= 0x0020 && g.unicode <= 0x024F);
    } else if (this.currentFilter === 'digits') {
      list = list.filter(g => g.unicode >= 0x0030 && g.unicode <= 0x0039);
    } else if (this.currentFilter === 'symbols') {
      list = list.filter(g =>
        (g.unicode >= 0x2000 && g.unicode <= 0x2BFF) ||
        (g.unicode >= 0x0021 && g.unicode <= 0x002F) ||
        (g.unicode >= 0x003A && g.unicode <= 0x0040) ||
        (g.unicode >= 0x005B && g.unicode <= 0x0060) ||
        (g.unicode >= 0x007B && g.unicode <= 0x007E)
      );
    } else if (this.currentFilter === 'empty') {
      list = list.filter(g => !g.hasOutline && g.index > 0);
    } else if (this.currentFilter === 'mapped') {
      list = list.filter(g => g.unicode != null);
    }

    // Apply search
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(g => {
        if (g.name.toLowerCase().includes(q)) return true;
        if (g.char && g.char.toLowerCase().includes(q)) return true;
        if (g.unicode && ('U+' + g.unicode.toString(16).toUpperCase().padStart(4, '0')).toLowerCase().includes(q)) return true;
        return false;
      });
    }

    this.filteredGlyphs = list;

    // Update count
    const countEl = document.getElementById('glyph-count');
    if (countEl) {
      countEl.textContent = this.filteredGlyphs.length;
    }
  }

  renderGlyphGrid() {
    const grid = document.getElementById('glyph-grid');
    if (!grid) return;

    // Use document fragment for performance
    const fragment = document.createDocumentFragment();

    for (const g of this.filteredGlyphs) {
      const cell = document.createElement('div');
      cell.className = 'glyph-cell' + (g.hasOutline ? '' : ' empty');
      cell.dataset.index = g.index;

      if (g.index === this.selectedGlyphIndex) {
        cell.classList.add('active');
      }

      const charSpan = document.createElement('span');
      charSpan.className = 'glyph-cell__char';
      charSpan.textContent = g.char || '□';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'glyph-cell__label';
      labelSpan.textContent = g.unicode
        ? g.unicode.toString(16).toUpperCase().padStart(4, '0')
        : g.index;

      cell.appendChild(charSpan);
      cell.appendChild(labelSpan);

      cell.addEventListener('click', () => this.selectGlyph(g.index));

      fragment.appendChild(cell);
    }

    grid.innerHTML = '';
    grid.appendChild(fragment);
  }

  updateGlyphCell(index) {
    const cell = document.querySelector(`.glyph-cell[data-index="${index}"]`);
    if (!cell) return;

    const g = this.font.glyphs.get(index);
    const hasOutline = g.path && g.path.commands && g.path.commands.length > 0;
    cell.classList.toggle('empty', !hasOutline);
  }

  selectGlyph(index) {
    this.selectedGlyphIndex = index;
    const glyph = this.font.glyphs.get(index);

    // Update glyph editor
    this.glyphEditor.setGlyph(glyph, index);

    // Update properties panel
    this.updateProperties();

    // Update grid selection
    document.querySelectorAll('.glyph-cell').forEach(cell => {
      cell.classList.toggle('active', parseInt(cell.dataset.index) === index);
    });

    // Show canvas controls & info bar
    const canvasInfoBar = document.getElementById('canvas-info-bar');
    const glyphEditorTools = document.getElementById('glyph-editor-tools');
    const zoomControls = document.getElementById('zoom-controls');
    if (canvasInfoBar) canvasInfoBar.style.display = 'flex';
    if (glyphEditorTools) glyphEditorTools.style.display = 'flex';
    if (zoomControls) zoomControls.style.display = 'flex';

    // Update info bar counters
    const pointsEl = document.getElementById('info-points');
    const contoursEl = document.getElementById('info-contours');
    const selectedEl = document.getElementById('info-selected');
    if (pointsEl) pointsEl.textContent = this.glyphEditor.getPointCount();
    if (contoursEl) contoursEl.textContent = this.glyphEditor.getContourCount();
    if (selectedEl) selectedEl.textContent = this.glyphEditor.getSelectedCount();

    // Update status bar
    const unicodeStr = glyph.unicode
      ? `U+${glyph.unicode.toString(16).toUpperCase().padStart(4, '0')}`
      : 'None';
    const statusUnicode = document.getElementById('status-unicode');
    if (statusUnicode) statusUnicode.textContent = `Unicode: ${unicodeStr}`;

    // Switch to editor tab
    this.switchEditorTab('editor');
  }

  /* ═══════════════════════════════════════════
     Web Demo & New Font Creation
     ═══════════════════════════════════════════ */

  loadDemoFont() {
    try {
      this.showToast('Generating demo font...', 'info');
      this.font = FontFactory.createDemoFont();
      this.fileName = 'FontXDemo-Regular.ttf';
      this.fileBuffer = this.font.toArrayBuffer();

      // Initialize subsystems
      this.glyphEditor.setFont(this.font);
      this.kerningEditor = new KerningEditor(this.font);

      // Build glyph list
      this.buildGlyphList();

      // Update UI
      this.hideWelcomeScreen();
      this.updateFontName();
      this.renderGlyphGrid();
      this.updatePreview();
      this.updateStatusBar();

      // Register custom font for preview
      this.registerFontForPreview(this.fileBuffer);

      this.modified = false;
      this.showToast(`Demo font loaded! (${this.font.glyphs.length} glyphs)`, 'success');

      // Select first letter A if available
      const aGlyph = this.glyphList.find(g => g.char === 'A' || g.name === 'A');
      if (aGlyph) {
        this.selectGlyph(aGlyph.index);
      }
    } catch (err) {
      console.error('Failed to load demo font:', err);
      this.showToast(`Error creating demo font: ${err.message}`, 'error');
    }
  }

  showNewFontModal() {
    this.showModal('new-font-modal');
    setTimeout(() => {
      const input = document.getElementById('new-font-family');
      if (input) {
        input.focus();
        input.select();
      }
    }, 100);
  }

  confirmNewFont() {
    const nameInput = document.getElementById('new-font-family');
    const styleInput = document.getElementById('new-font-style');
    const upemInput = document.getElementById('new-font-upem');
    const ascInput = document.getElementById('new-font-ascender');
    const descInput = document.getElementById('new-font-descender');

    const familyName = nameInput ? (nameInput.value.trim() || 'MyFont') : 'MyFont';
    const styleName = styleInput ? (styleInput.value.trim() || 'Regular') : 'Regular';
    const upem = parseInt(upemInput ? upemInput.value : 1000) || 1000;
    const ascender = parseInt(ascInput ? ascInput.value : 800) || 800;
    const descender = parseInt(descInput ? descInput.value : -200) || -200;

    try {
      this.font = FontFactory.createBlankFont({
        familyName,
        styleName,
        unitsPerEm: upem,
        ascender,
        descender
      });

      this.fileName = `${familyName}-${styleName}.ttf`;
      this.fileBuffer = this.font.toArrayBuffer();

      this.glyphEditor.setFont(this.font);
      this.kerningEditor = new KerningEditor(this.font);

      this.buildGlyphList();
      this.hideWelcomeScreen();
      this.updateFontName();
      this.renderGlyphGrid();
      this.updatePreview();
      this.updateStatusBar();

      this.registerFontForPreview(this.fileBuffer);

      this.modified = true;
      this.hideModal('new-font-modal');
      this.showToast(`Created new font: ${familyName} (${styleName})`, 'success');

      // Select first glyph (.notdef)
      if (this.glyphList.length > 0) {
        this.selectGlyph(0);
      }
    } catch (err) {
      console.error('Create font error:', err);
      this.showToast(`Error creating font: ${err.message}`, 'error');
    }
  }

  /* ═══════════════════════════════════════════
     Properties Panel
     ═══════════════════════════════════════════ */

  updateProperties() {
    const content = document.getElementById('properties-content');
    if (!content) return;

    if (this.selectedGlyphIndex < 0 || !this.font) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📝</div>
          <div class="empty-state__text">No Glyph Selected</div>
          <div class="empty-state__hint">Click a glyph to see its properties</div>
        </div>
      `;
      return;
    }

    const glyph = this.font.glyphs.get(this.selectedGlyphIndex);
    if (!glyph) return;

    const unicode = glyph.unicode
      ? `U+${glyph.unicode.toString(16).toUpperCase().padStart(4, '0')}`
      : 'Unassigned';

    const bbox = glyph.path ? glyph.path.getBoundingBox() : { x1: 0, y1: 0, x2: 0, y2: 0 };
    const contours = this.glyphEditor.getContourCount();
    const points = this.glyphEditor.getPointCount();

    content.innerHTML = `
      <div class="prop-section">
        <div class="prop-section__title">Glyph Info</div>
        <div class="prop-row">
          <span class="prop-row__label">Name</span>
          <span class="prop-row__value">${this.escapeHTML(glyph.name || 'unnamed')}</span>
        </div>
        <div class="prop-row">
          <span class="prop-row__label">Index</span>
          <span class="prop-row__value">${this.selectedGlyphIndex}</span>
        </div>
        <div class="prop-row">
          <span class="prop-row__label">Unicode</span>
          <span class="prop-row__value">${unicode}</span>
        </div>
        <div class="prop-row">
          <span class="prop-row__label">Character</span>
          <span class="prop-row__value" style="font-size: 18px;">${glyph.unicode ? this.escapeHTML(String.fromCodePoint(glyph.unicode)) : '—'}</span>
        </div>
      </div>

      <div class="prop-section">
        <div class="prop-section__title">Metrics</div>
        <div class="prop-row">
          <span class="prop-row__label">Width</span>
          <input type="number" class="prop-row__input" value="${glyph.advanceWidth || 0}"
            onchange="app.updateGlyphWidth(this.value)" style="width: 80px;">
        </div>
        <div class="prop-row">
          <span class="prop-row__label">LSB</span>
          <span class="prop-row__value">${Math.round(bbox.x1) || 0}</span>
        </div>
        <div class="prop-row">
          <span class="prop-row__label">RSB</span>
          <span class="prop-row__value">${Math.round((glyph.advanceWidth || 0) - bbox.x2) || 0}</span>
        </div>
      </div>

      <div class="prop-section">
        <div class="prop-section__title">Outline</div>
        <div class="prop-row">
          <span class="prop-row__label">Contours</span>
          <span class="prop-row__value">${contours}</span>
        </div>
        <div class="prop-row">
          <span class="prop-row__label">Points</span>
          <span class="prop-row__value">${points}</span>
        </div>
        <div class="prop-row">
          <span class="prop-row__label">BBox</span>
          <span class="prop-row__value" style="font-size: 9px;">${Math.round(bbox.x1)},${Math.round(bbox.y1)} → ${Math.round(bbox.x2)},${Math.round(bbox.y2)}</span>
        </div>
      </div>

      <div class="prop-section">
        <div class="prop-section__title">Transform</div>
        <button class="prop-btn" onclick="app.glyphEditor.flipHorizontal()">↔ Flip Horizontal</button>
        <button class="prop-btn" onclick="app.glyphEditor.flipVertical()">↕ Flip Vertical</button>
        <button class="prop-btn" onclick="app.glyphEditor.rotate(90)">⟳ Rotate 90°</button>
        <button class="prop-btn" onclick="app.glyphEditor.rotate(-90)">⟲ Rotate -90°</button>
        <button class="prop-btn" onclick="app.glyphEditor.scale(1.1)">🔍 Scale Up 10%</button>
        <button class="prop-btn" onclick="app.glyphEditor.scale(0.9)">🔍 Scale Down 10%</button>
      </div>

      <div class="prop-section">
        <div class="prop-section__title">Actions</div>
        <button class="prop-btn accent" onclick="app.glyphEditor.selectAll()">⬜ Select All Points</button>
        <button class="prop-btn" onclick="app.glyphEditor.zoomFit()">🎯 Fit to View</button>
      </div>
    `;
  }

  updateGlyphWidth(value) {
    if (!this.font || this.selectedGlyphIndex < 0) return;
    const glyph = this.font.glyphs.get(this.selectedGlyphIndex);
    if (!glyph) return;

    glyph.advanceWidth = parseInt(value) || 0;
    this.modified = true;
    this.glyphEditor.render();
    this.updatePreview();
  }

  /* ═══════════════════════════════════════════
     Font Information Modal
     ═══════════════════════════════════════════ */

  showFontInfoModal() {
    if (!this.font) {
      this.showToast('No font loaded', 'warning');
      return;
    }

    const modal = document.getElementById('font-info-modal');
    const body = document.getElementById('font-info-body');

    const names = this.font.names;
    const getN = (key) => {
      const val = names[key];
      if (!val) return '';
      if (typeof val === 'string') return val;
      return val.en || Object.values(val)[0] || '';
    };

    const os2 = this.font.tables.os2 || {};

    let createdDateStr = '';
    if (this.font.createdTimestamp) {
      const d = new Date(this.font.createdTimestamp * 1000);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      createdDateStr = `${year}-${month}-${day}`;
    }

    body.innerHTML = `
      <div class="modal-tabs">
        <button class="modal-tab active" onclick="app.switchModalTab(this, 'tab-general')">General</button>
        <button class="modal-tab" onclick="app.switchModalTab(this, 'tab-metrics')">Metrics</button>
        <button class="modal-tab" onclick="app.switchModalTab(this, 'tab-legal')">Legal</button>
        <button class="modal-tab" onclick="app.switchModalTab(this, 'tab-tables')">Tables</button>
      </div>

      <div id="tab-general" class="modal-tab-content active">
        <div class="form-group">
          <label>Font Family Name</label>
          <input type="text" id="info-family" value="${this.escapeAttr(getN('fontFamily'))}">
        </div>
        <div class="form-group">
          <label>Font Subfamily (Style)</label>
          <input type="text" id="info-subfamily" value="${this.escapeAttr(getN('fontSubfamily'))}">
        </div>
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" id="info-fullname" value="${this.escapeAttr(getN('fullName'))}">
        </div>
        <div class="form-group">
          <label>PostScript Name</label>
          <input type="text" id="info-postscript" value="${this.escapeAttr(getN('postScriptName'))}">
        </div>
        <div class="form-group">
          <label>Version</label>
          <input type="text" id="info-version" value="${this.escapeAttr(getN('version'))}">
        </div>
        <div class="form-group">
          <label>Unique ID</label>
          <input type="text" id="info-uniqueid" value="${this.escapeAttr(getN('uniqueID'))}">
        </div>
        <div class="form-group">
          <label>Created Date</label>
          <input type="date" id="info-created" value="${createdDateStr}">
        </div>
      </div>

      <div id="tab-metrics" class="modal-tab-content">
        <div class="form-group">
          <label>Units Per Em</label>
          <input type="number" id="info-upem" value="${this.font.unitsPerEm}">
        </div>
        <div class="form-group">
          <label>Ascender</label>
          <input type="number" id="info-ascender" value="${this.font.ascender}">
        </div>
        <div class="form-group">
          <label>Descender</label>
          <input type="number" id="info-descender" value="${this.font.descender}">
        </div>
        <div class="form-group">
          <label>Line Gap</label>
          <input type="number" id="info-linegap" value="${os2.sTypoLineGap || 0}">
        </div>
        <div class="form-group">
          <label>x-Height</label>
          <input type="number" id="info-xheight" value="${os2.sxHeight || 0}">
        </div>
        <div class="form-group">
          <label>Cap Height</label>
          <input type="number" id="info-capheight" value="${os2.sCapHeight || 0}">
        </div>
      </div>

      <div id="tab-legal" class="modal-tab-content">
        <div class="form-group">
          <label>Copyright</label>
          <textarea id="info-copyright" rows="2">${this.escapeHTML(getN('copyright'))}</textarea>
        </div>
        <div class="form-group">
          <label>Designer</label>
          <input type="text" id="info-designer" value="${this.escapeAttr(getN('designer'))}">
        </div>
        <div class="form-group">
          <label>Manufacturer</label>
          <input type="text" id="info-manufacturer" value="${this.escapeAttr(getN('manufacturer'))}">
        </div>
        <div class="form-group">
          <label>License</label>
          <textarea id="info-license" rows="3">${this.escapeHTML(getN('license'))}</textarea>
        </div>

        <div class="form-group">
          <label>Trademark</label>
          <input type="text" id="info-trademark" value="${this.escapeAttr(getN('trademark'))}">
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="info-description" rows="3">${this.escapeHTML(getN('description'))}</textarea>
        </div>
      </div>

      <div id="tab-tables" class="modal-tab-content">
        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">
          Font tables present in this file:
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          ${Object.keys(this.font.tables).map(t => `
            <span class="badge badge--blue">${t}</span>
          `).join('')}
        </div>
        <div style="margin-top: 16px;">
          <div class="prop-row">
            <span class="prop-row__label">Total Glyphs</span>
            <span class="prop-row__value">${this.font.glyphs.length}</span>
          </div>
          <div class="prop-row">
            <span class="prop-row__label">Format</span>
            <span class="prop-row__value">${this.font.outlinesFormat}</span>
          </div>
          <div class="prop-row">
            <span class="prop-row__label">Created</span>
            <span class="prop-row__value">${this.font.createdTimestamp ? new Date(this.font.createdTimestamp * 1000).toLocaleString() : 'Unknown'}</span>
          </div>
        </div>
      </div>
    `;

    this.showModal('font-info-modal');
  }

  saveFontInfo() {
    if (!this.font) return;

    // These name fields are REQUIRED for a valid TTF/OTF font.
    // Deleting or emptying them will corrupt the font file.
    const requiredFields = new Set(['fontFamily', 'fontSubfamily', 'fullName', 'postScriptName']);

    const setName = (key, elementId) => {
      const el = document.getElementById(elementId);
      if (!el) return;
      const val = (el.value !== undefined ? el.value : el.textContent).trim();
      if (val) {
        // Save user's value
        if (!this.font.names[key]) this.font.names[key] = {};
        this.font.names[key].en = val;
      } else {
        // Field was cleared
        if (requiredFields.has(key)) {
          // Required field — never remove, silently keep old value so font stays valid
          return;
        }
        // Optional field — set to empty string so UI shows it as empty next time
        if (this.font.names[key]) {
          this.font.names[key].en = '';
        }
      }
    };

    // General
    setName('fontFamily', 'info-family');
    setName('fontSubfamily', 'info-subfamily');
    setName('fullName', 'info-fullname');
    setName('postScriptName', 'info-postscript');
    setName('version', 'info-version');
    setName('uniqueID', 'info-uniqueid');

    // Also update preferredFamily and preferredSubfamily if they exist to keep them in sync
    const familyVal = (document.getElementById('info-family')?.value || '').trim();
    const subVal    = (document.getElementById('info-subfamily')?.value || '').trim();
    if (familyVal && this.font.names.preferredFamily) {
      if (typeof this.font.names.preferredFamily === 'string') {
        this.font.names.preferredFamily = { en: familyVal };
      } else {
        this.font.names.preferredFamily.en = familyVal;
      }
    }
    if (subVal && this.font.names.preferredSubfamily) {
      if (typeof this.font.names.preferredSubfamily === 'string') {
        this.font.names.preferredSubfamily = { en: subVal };
      } else {
        this.font.names.preferredSubfamily.en = subVal;
      }
    }

    // Metrics — update font object AND the underlying tables so export is correct
    const upem = document.getElementById('info-upem');
    if (upem) {
      const val = parseInt(upem.value) || this.font.unitsPerEm;
      this.font.unitsPerEm = val;
      if (this.font.tables.head) this.font.tables.head.unitsPerEm = val;
    }

    const asc = document.getElementById('info-ascender');
    if (asc) {
      const val = parseInt(asc.value);
      if (!isNaN(val)) {
        this.font.ascender = val;
        if (this.font.tables.hhea) this.font.tables.hhea.ascender = val;
        if (this.font.tables.os2) {
          this.font.tables.os2.sTypoAscender = val;
          this.font.tables.os2.usWinAscent   = Math.abs(val);
        }
      }
    }

    const desc = document.getElementById('info-descender');
    if (desc) {
      const val = parseInt(desc.value);
      if (!isNaN(val)) {
        this.font.descender = val;
        if (this.font.tables.hhea) this.font.tables.hhea.descender = val;
        if (this.font.tables.os2) {
          this.font.tables.os2.sTypoDescender = val;
          this.font.tables.os2.usWinDescent   = Math.abs(val);
        }
      }
    }

    const lineGap = document.getElementById('info-linegap');
    if (lineGap) {
      const val = parseInt(lineGap.value) || 0;
      if (this.font.tables.os2) this.font.tables.os2.sTypoLineGap = val;
      if (this.font.tables.hhea) this.font.tables.hhea.lineGap = val;
    }

    const xh = document.getElementById('info-xheight');
    if (xh && this.font.tables.os2) {
      this.font.tables.os2.sxHeight = parseInt(xh.value) || 0;
    }

    const ch = document.getElementById('info-capheight');
    if (ch && this.font.tables.os2) {
      this.font.tables.os2.sCapHeight = parseInt(ch.value) || 0;
    }

    // Ensure USE_TYPO_METRICS bit so modern renderers use sTypo* not usWin*
    if (this.font.tables.os2 && this.font.tables.os2.fsSelection !== undefined) {
      this.font.tables.os2.fsSelection = this.font.tables.os2.fsSelection | 0x0080;
    }

    // Legal
    setName('copyright', 'info-copyright');
    setName('designer', 'info-designer');
    setName('manufacturer', 'info-manufacturer');
    setName('license', 'info-license');
    setName('trademark', 'info-trademark');
    setName('description', 'info-description');

    // Save Created Date
    const createdInput = document.getElementById('info-created');
    if (createdInput && createdInput.value) {
      const dateParts = createdInput.value.split('-');
      if (dateParts.length === 3) {
        const d = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
        this.font.createdTimestamp = Math.round(d.getTime() / 1000);
      }
    }

    this.modified = true;
    this.updateFontName();
    this.hideModal('font-info-modal');
    this.showToast('Font information updated', 'success');
  }

  switchModalTab(tabBtn, tabId) {
    const modal = tabBtn.closest('.modal__body');
    modal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    modal.querySelectorAll('.modal-tab-content').forEach(t => t.classList.remove('active'));
    tabBtn.classList.add('active');
    document.getElementById(tabId).classList.add('active');
  }

  /* ═══════════════════════════════════════════
     Character Map
     ═══════════════════════════════════════════ */

  showCharacterMap() {
    if (!this.font) {
      this.showToast('No font loaded', 'warning');
      return;
    }

    const modal = document.getElementById('charmap-modal');
    this.renderCharMap('basic-latin');
    this.showModal('charmap-modal');
  }

  renderCharMap(blockName) {
    const blocks = {
      'basic-latin': { start: 0x0020, end: 0x007F, name: 'Basic Latin' },
      'latin-1': { start: 0x0080, end: 0x00FF, name: 'Latin-1 Supplement' },
      'latin-ext-a': { start: 0x0100, end: 0x017F, name: 'Latin Extended-A' },
      'latin-ext-b': { start: 0x0180, end: 0x024F, name: 'Latin Extended-B' },
      'greek': { start: 0x0370, end: 0x03FF, name: 'Greek & Coptic' },
      'cyrillic': { start: 0x0400, end: 0x04FF, name: 'Cyrillic' },
      'arabic': { start: 0x0600, end: 0x06FF, name: 'Arabic' },
      'bangla': { start: 0x0980, end: 0x09FF, name: 'Bengali / Bangla' },
      'devanagari': { start: 0x0900, end: 0x097F, name: 'Devanagari' },
      'punctuation': { start: 0x2000, end: 0x206F, name: 'General Punctuation' },
      'currency': { start: 0x20A0, end: 0x20CF, name: 'Currency Symbols' },
      'arrows': { start: 0x2190, end: 0x21FF, name: 'Arrows' },
      'math': { start: 0x2200, end: 0x22FF, name: 'Mathematical Operators' },
      'box-drawing': { start: 0x2500, end: 0x257F, name: 'Box Drawing' },
      'geometric': { start: 0x25A0, end: 0x25FF, name: 'Geometric Shapes' },
      'dingbats': { start: 0x2700, end: 0x27BF, name: 'Dingbats' }
    };

    const block = blocks[blockName] || blocks['basic-latin'];
    const grid = document.getElementById('charmap-grid');
    if (!grid) return;

    let html = '';
    for (let code = block.start; code <= block.end; code++) {
      const char = String.fromCodePoint(code);
      const glyph = this.font.charToGlyph(char);
      const hasGlyph = glyph && glyph.index !== 0;
      const hex = code.toString(16).toUpperCase().padStart(4, '0');

      html += `<div class="charmap-cell ${hasGlyph ? 'has-glyph' : 'no-glyph'}"
        data-tooltip="U+${hex}"
        onclick="app.selectGlyphByUnicode(${code})"
        >${char}</div>`;
    }

    grid.innerHTML = html;

    // Update block selector
    const selector = document.getElementById('charmap-block-select');
    if (selector) selector.value = blockName;
  }

  selectGlyphByUnicode(code) {
    if (!this.font) return;
    const char = String.fromCodePoint(code);
    const glyph = this.font.charToGlyph(char);
    if (glyph && glyph.index > 0) {
      this.hideModal('charmap-modal');
      this.selectGlyph(glyph.index);

      // Scroll to glyph in grid
      const cell = document.querySelector(`.glyph-cell[data-index="${glyph.index}"]`);
      if (cell) cell.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      this.showToast(`No glyph for U+${code.toString(16).toUpperCase().padStart(4, '0')}`, 'info');
    }
  }

  /* ═══════════════════════════════════════════
     Kerning
     ═══════════════════════════════════════════ */

  showKerningModal() {
    if (!this.font) {
      this.showToast('No font loaded', 'warning');
      return;
    }

    if (!this.kerningEditor) {
      this.kerningEditor = new KerningEditor(this.font);
    }

    const body = document.getElementById('kerning-body');
    if (body) {
      body.innerHTML = this.kerningEditor.renderHTML();
    }

    this.showModal('kerning-modal');
  }

  addKerningPair() {
    const leftChar = document.getElementById('kern-left-char')?.value;
    const rightChar = document.getElementById('kern-right-char')?.value;
    const value = parseInt(document.getElementById('kern-value')?.value) || -50;

    if (!leftChar || !rightChar) {
      this.showToast('Please enter both left and right characters', 'warning');
      return;
    }

    if (this.kerningEditor.addPairByChars(leftChar, rightChar, value)) {
      this.modified = true;
      this.showToast(`Kerning pair added: ${leftChar}${rightChar} = ${value}`, 'success');
      // Re-render
      const body = document.getElementById('kerning-body');
      if (body) body.innerHTML = this.kerningEditor.renderHTML();
    } else {
      this.showToast('Could not add pair. Characters not found in font.', 'error');
    }
  }

  updateKerningValue(leftIdx, rightIdx, value) {
    this.kerningEditor.updatePair(leftIdx, rightIdx, parseInt(value));
    this.modified = true;
  }

  deleteKerningPair(leftIdx, rightIdx) {
    this.kerningEditor.deletePair(leftIdx, rightIdx);
    this.modified = true;
    const body = document.getElementById('kerning-body');
    if (body) body.innerHTML = this.kerningEditor.renderHTML();
    this.showToast('Kerning pair deleted', 'info');
  }

  /* ═══════════════════════════════════════════
     Validation
     ═══════════════════════════════════════════ */

  showValidationModal() {
    if (!this.font) {
      this.showToast('No font loaded', 'warning');
      return;
    }

    const results = this.validator.validate(this.font);
    const summary = this.validator.getSummary();
    const body = document.getElementById('validation-body');

    let html = `
      <div style="display: flex; gap: 12px; margin-bottom: 16px;">
        <div class="badge badge--coral">${summary.errors} Errors</div>
        <div class="badge" style="background: var(--accent-yellow-dim); color: var(--accent-yellow);">${summary.warnings} Warnings</div>
        <div class="badge badge--green">${summary.passed} Passed</div>
      </div>
      <ul class="validation-list">
    `;

    for (const r of results) {
      const iconClass = r.type;
      const icon = r.type === 'error' ? '✕' : r.type === 'warning' ? '⚠' : '✓';
      html += `
        <li class="validation-item">
          <div class="validation-item__icon ${iconClass}">${icon}</div>
          <div class="validation-item__text">
            <div class="validation-item__title">${this.escapeHTML(r.title)}</div>
            <div class="validation-item__desc">${this.escapeHTML(r.desc)}</div>
          </div>
        </li>
      `;
    }

    html += '</ul>';
    body.innerHTML = html;

    this.showModal('validation-modal');
  }

  /* ═══════════════════════════════════════════
     Export / Save
     ═══════════════════════════════════════════ */

  exportFont(format = 'ttf') {
    if (!this.font) {
      this.showToast('No font loaded', 'warning');
      return;
    }

    // Force format based on outlinesFormat of the loaded font
    const finalFormat = (this.font && this.font.outlinesFormat === 'cff') ? 'otf' : 'ttf';

    try {
      // 1. Sync font-level metrics back into os2 & hhea tables
      this._syncFontTables();

      // 2. Ensure name records are clean and present
      this._fixNameTable();

      // 3. Fix Windows compatibility issues (cmap, name table platform IDs, OS/2)
      this._fixWindowsCompatibility();

      // 4. Ensure Gasp table is deleted to avoid the opentype.js serialization bug
      if (this.font.tables && this.font.tables.gasp) {
        delete this.font.tables.gasp;
      }

      this.font.download(this.fileName || `font.${finalFormat}`);
      this.modified = false;
      this.showToast(`Font exported as ${finalFormat.toUpperCase()}`, 'success');
    } catch (error) {
      console.error('Export error:', error);
      this.showToast(`Export error: ${error.message}`, 'error');
    }
  }

  exportFontManual(format = 'ttf') {
    if (!this.font) {
      this.showToast('No font loaded', 'warning');
      return;
    }

    // Show Save modal with filename input
    this.showSaveModal(format);
  }

  showSaveModal(format = 'ttf') {
    // Determine recommended format based on font's outlines
    const recommendedFormat = (this.font && this.font.outlinesFormat === 'cff') ? 'otf' : 'ttf';
    // Default to the caller's format or recommended format
    const defaultFormat = format || recommendedFormat;

    // Prefer the font's family name set by the user; fall back to the loaded file name
    const userFontFamily = this.font && this.font.names && this.font.names.fontFamily
      ? (this.font.names.fontFamily.en || Object.values(this.font.names.fontFamily)[0] || '')
      : '';
    const baseName = (userFontFamily.trim() || this.fileName.replace(/\.(ttf|otf|woff)$/i, '')).replace(/[/\\?%*:|"<>]/g, '-');
    const body = document.getElementById('save-modal-body');

    body.innerHTML = `
      <div class="form-group">
        <label>Font File Name</label>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input type="text" id="save-filename" value="${this.escapeAttr(baseName)}"
            style="flex: 1;" placeholder="Enter font file name...">
          <select id="save-format" style="width: 100px;">
            <option value="ttf" ${defaultFormat === 'ttf' ? 'selected' : ''}>.ttf</option>
            <option value="otf" ${defaultFormat === 'otf' ? 'selected' : ''}>.otf</option>
          </select>
        </div>
        <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px;">
          * Recommended format is <strong>.${recommendedFormat}</strong> to match the font's internal outline type (${this.font.outlinesFormat === 'cff' ? 'PostScript CFF' : 'TrueType'}).
        </div>
      </div>
      <div style="margin-top: 8px; padding: 10px; background: var(--bg-tertiary); border-radius: var(--radius-md); border: 1px solid var(--border-default);">
        <div style="font-size: 11px; color: var(--text-tertiary); margin-bottom: 6px;">Preview:</div>
        <div id="save-preview-name" style="font-family: var(--font-mono); font-size: 14px; color: var(--accent-blue);">
          ${this.escapeHTML(baseName)}.${defaultFormat}
        </div>
      </div>
    `;

    this.showModal('save-modal');

    // Update preview on input change
    const filenameInput = document.getElementById('save-filename');
    const formatSelect = document.getElementById('save-format');
    const previewEl = document.getElementById('save-preview-name');

    const updatePreview = () => {
      const name = filenameInput.value.trim() || 'untitled';
      const ext = formatSelect.value;
      previewEl.textContent = `${name}.${ext}`;
    };

    filenameInput.addEventListener('input', updatePreview);
    formatSelect.addEventListener('change', updatePreview);

    // Auto-select text in input for easy replacement
    setTimeout(() => filenameInput.select(), 100);
  }

  confirmSave() {
    const filenameInput = document.getElementById('save-filename');
    const formatSelect  = document.getElementById('save-format');
    if (!filenameInput || !formatSelect) return;

    const fileName = filenameInput.value.trim();
    // Respect the user's selected format extension from the dropdown
    const format = formatSelect.value;

    if (!fileName) {
      this.showToast('Please enter a file name', 'warning');
      return;
    }

    try {
      // 1. Sync font-level metrics back into os2 & hhea tables
      this._syncFontTables();

      // 2. Ensure name records are clean and present
      this._fixNameTable();

      // 3. Fix Windows compatibility issues (cmap, name table platform IDs, OS/2)
      this._fixWindowsCompatibility();

      // 4. Ensure Gasp table is deleted to avoid the opentype.js serialization bug
      if (this.font.tables && this.font.tables.gasp) {
        delete this.font.tables.gasp;
      }

      // 4. Serialise using the in-place modified font object
      let arrayBuffer = this.font.toArrayBuffer();

      // If exporting as TTF, convert to standard TrueType (glyf/loca tables, 0x00010000 sfntVersion)
      if (format.toLowerCase() === 'ttf') {
        try {
          arrayBuffer = this._convertToTrueType(this.font, arrayBuffer);
        } catch (e) {
          console.warn('Pure JS TrueType conversion fallback:', e);
        }
      }

      if (window.pywebview && window.pywebview.api && window.pywebview.api.save_font_file) {
        // Desktop App wrapper mode
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
        }
        const base64Content = window.btoa(binary);

        window.pywebview.api.save_font_file(fileName, format, base64Content).then((response) => {
          if (response.success) {
            this.showToast(`Font successfully saved!`, 'success');
            this.modified = false;
            this.hideModal('save-modal');
            setTimeout(() => this.showFontGuideModal(fileName, format), 200);
          } else if (response.message !== 'Cancelled') {
            this.showToast(`Save error: ${response.message}`, 'error');
          }
        }).catch((err) => {
          this.showToast(`Save error: ${err}`, 'error');
        });
      } else {
        // Standard Browser mode fallback
        const downloadFont = (buf) => {
          const fontMimes = {
            ttf: 'font/ttf',
            otf: 'font/otf',
            woff: 'font/woff',
            woff2: 'font/woff2'
          };
          const mimeType = fontMimes[format.toLowerCase()] || 'font/ttf';
          const blob = new Blob([buf], { type: mimeType });
          const url  = URL.createObjectURL(blob);

          const a = document.createElement('a');
          a.href     = url;
          a.download = `${fileName}.${format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          this.modified = false;
          this.hideModal('save-modal');
          this.showToast(`Font downloaded: ${fileName}.${format}`, 'success');
          // Show Web & Multi-platform guide
          setTimeout(() => this.showFontGuideModal(fileName, format), 200);
        };

        // Convert arrayBuffer to base64 for processing if dev_server is active
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
        }
        const base64Content = window.btoa(binary);

        fetch('/api/process-font', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64: base64Content, format: format })
        })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('API offline');
        })
        .then(data => {
          if (data && data.success && data.base64) {
            const binStr = window.atob(data.base64);
            const len = binStr.length;
            const u8 = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              u8[i] = binStr.charCodeAt(i);
            }
            downloadFont(u8.buffer);
          } else {
            downloadFont(arrayBuffer);
          }
        })
        .catch(() => {
          downloadFont(arrayBuffer);
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      this.showToast(`Export error: ${error.message}`, 'error');
    }
  }

  _encodeGlyph(glyph) {
    const commands = glyph.path ? glyph.path.commands : [];
    if (!commands || commands.length === 0) return new Uint8Array(0);

    const contours = [];
    let currentContour = [];
    let lastPoint = { x: 0, y: 0, onCurve: true };

    for (const cmd of commands) {
      if (cmd.type === 'M') {
        if (currentContour.length > 0) contours.push(currentContour);
        currentContour = [];
        lastPoint = { x: Math.round(cmd.x), y: Math.round(cmd.y), onCurve: true };
        currentContour.push(lastPoint);
      } else if (cmd.type === 'L') {
        lastPoint = { x: Math.round(cmd.x), y: Math.round(cmd.y), onCurve: true };
        currentContour.push(lastPoint);
      } else if (cmd.type === 'Q') {
        currentContour.push({ x: Math.round(cmd.x1), y: Math.round(cmd.y1), onCurve: false });
        lastPoint = { x: Math.round(cmd.x), y: Math.round(cmd.y), onCurve: true };
        currentContour.push(lastPoint);
      } else if (cmd.type === 'C') {
        const p0 = lastPoint;
        const p1 = { x: cmd.x1, y: cmd.y1 };
        const p2 = { x: cmd.x2, y: cmd.y2 };
        const p3 = { x: cmd.x, y: cmd.y };

        const p01x = (p0.x + p1.x) / 2, p01y = (p0.y + p1.y) / 2;
        const p12x = (p1.x + p2.x) / 2, p12y = (p1.y + p2.y) / 2;
        const p23x = (p2.x + p3.x) / 2, p23y = (p2.y + p3.y) / 2;
        const p012x = (p01x + p12x) / 2, p012y = (p01y + p12y) / 2;
        const p123x = (p12x + p23x) / 2, p123y = (p12y + p23y) / 2;
        const pmidx = (p012x + p123x) / 2, pmidy = (p012y + p123y) / 2;

        const q1x = (3 * p1.x - p0.x) / 2, q1y = (3 * p1.y - p0.y) / 2;
        const q2x = (3 * p2.x - p3.x) / 2, q2y = (3 * p2.y - p3.y) / 2;

        currentContour.push({ x: Math.round(q1x), y: Math.round(q1y), onCurve: false });
        currentContour.push({ x: Math.round(pmidx), y: Math.round(pmidy), onCurve: true });
        currentContour.push({ x: Math.round(q2x), y: Math.round(q2y), onCurve: false });
        lastPoint = { x: Math.round(p3.x), y: Math.round(p3.y), onCurve: true };
        currentContour.push(lastPoint);
      } else if (cmd.type === 'Z') {
        if (currentContour.length > 1) {
          const first = currentContour[0];
          const last = currentContour[currentContour.length - 1];
          if (first.x === last.x && first.y === last.y && first.onCurve && last.onCurve) {
            currentContour.pop();
          }
        }
      }
    }
    if (currentContour.length > 0) contours.push(currentContour);
    if (contours.length === 0) return new Uint8Array(0);

    const points = [];
    const endPtsOfContours = [];
    let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;

    for (const c of contours) {
      for (const pt of c) {
        points.push(pt);
        if (pt.x < xMin) xMin = pt.x;
        if (pt.y < yMin) yMin = pt.y;
        if (pt.x > xMax) xMax = pt.x;
        if (pt.y > yMax) yMax = pt.y;
      }
      endPtsOfContours.push(points.length - 1);
    }

    if (points.length === 0) return new Uint8Array(0);

    const flags = [];
    const xBytes = [];
    const yBytes = [];
    let prevX = 0, prevY = 0;

    for (const pt of points) {
      let flag = pt.onCurve ? 1 : 0;
      const dx = pt.x - prevX;
      const dy = pt.y - prevY;

      if (dx === 0) {
        flag |= 0x10;
      } else if (dx > 0 && dx <= 255) {
        flag |= (0x02 | 0x10);
        xBytes.push(dx);
      } else if (dx < 0 && dx >= -255) {
        flag |= 0x02;
        xBytes.push(-dx);
      } else {
        xBytes.push((dx >> 8) & 0xFF, dx & 0xFF);
      }

      if (dy === 0) {
        flag |= 0x20;
      } else if (dy > 0 && dy <= 255) {
        flag |= (0x04 | 0x20);
        yBytes.push(dy);
      } else if (dy < 0 && dy >= -255) {
        flag |= 0x04;
        yBytes.push(-dy);
      } else {
        yBytes.push((dy >> 8) & 0xFF, dy & 0xFF);
      }

      flags.push(flag);
      prevX = pt.x;
      prevY = pt.y;
    }

    const numContours = contours.length;
    const headerSize = 10 + numContours * 2 + 2;
    const totalSize = headerSize + flags.length + xBytes.length + yBytes.length;
    const paddedSize = (totalSize % 2 === 1) ? totalSize + 1 : totalSize;

    const buf = new Uint8Array(paddedSize);
    const view = new DataView(buf.buffer);

    view.setInt16(0, numContours);
    view.setInt16(2, xMin);
    view.setInt16(4, yMin);
    view.setInt16(6, xMax);
    view.setInt16(8, yMax);

    let offset = 10;
    for (let i = 0; i < numContours; i++) {
      view.setUint16(offset, endPtsOfContours[i]);
      offset += 2;
    }
    view.setUint16(offset, 0);
    offset += 2;

    buf.set(flags, offset);
    offset += flags.length;
    buf.set(xBytes, offset);
    offset += xBytes.length;
    buf.set(yBytes, offset);

    return buf;
  }

  _convertToTrueType(font, rawArrayBuffer) {
    const view = new DataView(rawArrayBuffer);
    const numTables = view.getUint16(4);
    const existingTables = {};

    for (let i = 0; i < numTables; i++) {
      const recOffset = 12 + i * 16;
      const tag = String.fromCharCode(
        view.getUint8(recOffset),
        view.getUint8(recOffset + 1),
        view.getUint8(recOffset + 2),
        view.getUint8(recOffset + 3)
      );
      const offset = view.getUint32(recOffset + 8);
      const length = view.getUint32(recOffset + 12);
      existingTables[tag] = new Uint8Array(rawArrayBuffer.slice(offset, offset + length));
    }

    const numGlyphs = font.glyphs.length;
    const glyphBuffers = [];
    const locaOffsets = [0];
    let currentOffset = 0;
    let maxPoints = 0, maxContours = 0;

    for (let i = 0; i < numGlyphs; i++) {
      const gBuf = this._encodeGlyph(font.glyphs.get(i));
      glyphBuffers.push(gBuf);
      currentOffset += gBuf.length;
      locaOffsets.push(currentOffset);
      if (gBuf.length >= 10) {
        const gView = new DataView(gBuf.buffer, gBuf.byteOffset, gBuf.byteLength);
        const contours = gView.getInt16(0);
        if (contours > maxContours) maxContours = contours;
        if (contours > 0) {
          const lastPtIdx = gView.getUint16(10 + (contours - 1) * 2);
          const pts = lastPtIdx + 1;
          if (pts > maxPoints) maxPoints = pts;
        }
      }
    }

    const glyfTable = new Uint8Array(currentOffset);
    let gPos = 0;
    for (const gBuf of glyphBuffers) {
      glyfTable.set(gBuf, gPos);
      gPos += gBuf.length;
    }

    const isShortLoca = currentOffset <= 131070;
    const locaTable = new Uint8Array((numGlyphs + 1) * (isShortLoca ? 2 : 4));
    const locaView = new DataView(locaTable.buffer);
    for (let i = 0; i <= numGlyphs; i++) {
      if (isShortLoca) {
        locaView.setUint16(i * 2, locaOffsets[i] / 2);
      } else {
        locaView.setUint32(i * 4, locaOffsets[i]);
      }
    }

    const maxpTable = new Uint8Array(32);
    const maxpView = new DataView(maxpTable.buffer);
    maxpView.setUint32(0, 0x00010000); // Version 1.0
    maxpView.setUint16(4, numGlyphs);
    maxpView.setUint16(6, maxPoints);
    maxpView.setUint16(8, maxContours);
    maxpView.setUint16(10, 0);
    maxpView.setUint16(12, 0);
    maxpView.setUint16(14, 1); // maxZones = 1
    maxpView.setUint16(16, 0);
    maxpView.setUint16(18, 0);
    maxpView.setUint16(20, 0);
    maxpView.setUint16(22, 0);
    maxpView.setUint16(24, 0);
    maxpView.setUint16(26, 0);
    maxpView.setUint16(28, 0);
    maxpView.setUint16(30, 0);

    const headTable = new Uint8Array(existingTables['head']);
    const headView = new DataView(headTable.buffer, headTable.byteOffset, headTable.byteLength);
    headView.setInt16(50, isShortLoca ? 0 : 1);
    headView.setUint32(8, 0);

    const newTables = { ...existingTables };
    delete newTables['CFF '];
    delete newTables['CFF2'];
    delete newTables['VORG'];
    newTables['head'] = headTable;
    newTables['maxp'] = maxpTable;
    newTables['loca'] = locaTable;
    newTables['glyf'] = glyfTable;

    const tags = Object.keys(newTables).sort();
    const numNewTables = tags.length;

    let entrySelector = 0;
    let maxPowerOf2 = 1;
    while (maxPowerOf2 * 2 <= numNewTables) {
      maxPowerOf2 *= 2;
      entrySelector++;
    }
    const searchRange = maxPowerOf2 * 16;
    const rangeShift = numNewTables * 16 - searchRange;

    const tableDirSize = 12 + numNewTables * 16;
    let currentTableOffset = tableDirSize;
    const tableRecords = [];

    for (const tag of tags) {
      const data = newTables[tag];
      const length = data.byteLength;
      const paddedLength = (length + 3) & ~3;
      tableRecords.push({
        tag,
        data,
        offset: currentTableOffset,
        length,
        paddedLength
      });
      currentTableOffset += paddedLength;
    }

    const outBuf = new Uint8Array(currentTableOffset);
    const outView = new DataView(outBuf.buffer);

    outView.setUint32(0, 0x00010000); // TrueType sfntVersion
    outView.setUint16(4, numNewTables);
    outView.setUint16(6, searchRange);
    outView.setUint16(8, entrySelector);
    outView.setUint16(10, rangeShift);

    let dirOffset = 12;
    let headTableOffset = 0;

    for (const rec of tableRecords) {
      for (let c = 0; c < 4; c++) {
        outView.setUint8(dirOffset + c, rec.tag.charCodeAt(c));
      }

      outBuf.set(rec.data, rec.offset);

      let checkSum = 0;
      const tableDataView = new DataView(outBuf.buffer, rec.offset, rec.paddedLength);
      const numWords = rec.paddedLength / 4;
      for (let w = 0; w < numWords; w++) {
        checkSum = (checkSum + tableDataView.getUint32(w * 4)) >>> 0;
      }

      outView.setUint32(dirOffset + 4, checkSum);
      outView.setUint32(dirOffset + 8, rec.offset);
      outView.setUint32(dirOffset + 12, rec.length);

      if (rec.tag === 'head') {
        headTableOffset = rec.offset;
      }

      dirOffset += 16;
    }

    let wholeFontSum = 0;
    const totalWords = currentTableOffset / 4;
    for (let w = 0; w < totalWords; w++) {
      wholeFontSum = (wholeFontSum + outView.getUint32(w * 4)) >>> 0;
    }
    const checkSumAdjustment = (0xB1B0AFBA - wholeFontSum) >>> 0;
    outView.setUint32(headTableOffset + 8, checkSumAdjustment);

    return outBuf.buffer;
  }

  showFontGuideModal(fileName, format) {
    const family = (this.font && this.font.names && this.font.names.fontFamily)
      ? (this.font.names.fontFamily.en || Object.values(this.font.names.fontFamily)[0] || fileName)
      : fileName;

    const modal = document.getElementById('font-guide-modal');
    if (!modal) return;

    // Set font title
    const guideNameEl = document.getElementById('font-guide-filename');
    if (guideNameEl) guideNameEl.textContent = `${fileName}.${format}`;

    // Generate @font-face CSS snippet
    const fontFormat = format === 'otf' ? 'opentype' : 'truetype';
    const cssSnippet = `@font-face {\n  font-family: '${family}';\n  src: url('${fileName}.${format}') format('${fontFormat}');\n  font-weight: normal;\n  font-style: normal;\n  font-display: swap;\n}\n\n/* Example usage */\nbody {\n  font-family: '${family}', sans-serif;\n}`;

    const cssEl = document.getElementById('font-guide-css');
    if (cssEl) cssEl.textContent = cssSnippet;

    this.showModal('font-guide-modal');
  }

  copyFontCss() {
    const cssEl = document.getElementById('font-guide-css');
    if (!cssEl) return;
    navigator.clipboard.writeText(cssEl.textContent).then(() => {
      this.showToast('CSS copied to clipboard!', 'success');
    }).catch(() => {
      this.showToast('Could not copy CSS to clipboard', 'warning');
    });
  }

  /**
   * Sync in-memory font.ascender / descender / unitsPerEm edits into the
   * underlying table objects so the UI always reflects the current state.
   * (Still useful when the Font Info modal saves changes mid-session.)
   */
  _syncFontTables() {
    const font = this.font;
    if (!font) return;

    if (font.tables.head) {
      font.tables.head.unitsPerEm = font.unitsPerEm;
    }
    if (font.tables.hhea) {
      font.tables.hhea.ascender  = font.ascender;
      font.tables.hhea.descender = font.descender;
      if (font.tables.hhea.lineGap === undefined) font.tables.hhea.lineGap = 0;
    }
    if (font.tables.os2) {
      const os2 = font.tables.os2;
      os2.sTypoAscender  = font.ascender;
      os2.sTypoDescender = font.descender;
      if (os2.sTypoLineGap === undefined) os2.sTypoLineGap = 0;
      os2.usWinAscent    = Math.abs(font.ascender);
      os2.usWinDescent   = Math.abs(font.descender);
      if (os2.fsSelection !== undefined) os2.fsSelection = os2.fsSelection | 0x0080;
    }
  }

  /** Ensure font.names required keys are present (used by UI helpers). */
  _fixNameTable() {
    const font = this.font;
    if (!font || !font.names) return;

    const getVal = (key) => {
      const entry = font.names[key];
      if (!entry) return '';
      if (typeof entry === 'string') return entry;
      return entry.en || entry.undefined || Object.values(entry)[0] || '';
    };
    const setVal = (key, value) => {
      if (!value) return;
      if (!font.names[key]) font.names[key] = {};
      if (typeof font.names[key] === 'string') font.names[key] = { en: value };
      else font.names[key].en = value;
    };

    const family   = getVal('fontFamily')   || this.fileName.replace(/\.(ttf|otf|woff)$/i, '') || 'Untitled';
    const sub      = getVal('fontSubfamily') || 'Regular';
    const fullName = getVal('fullName')      || `${family} ${sub}`.trim();
    const psName   = getVal('postScriptName')
      || `${family}-${sub}`.replace(/\s+/g, '-').replace(/[^A-Za-z0-9\-]/g, '');

    setVal('fontFamily',     family);
    setVal('fontSubfamily',  sub);
    setVal('fullName',       fullName);
    setVal('postScriptName', psName);
    if (!getVal('version')) setVal('version', 'Version 1.000');

    // Sync preferred family & subfamily to avoid grouping mismatches on Windows/macOS
    if (font.names.preferredFamily) {
      setVal('preferredFamily', family);
    }
    if (font.names.preferredSubfamily) {
      setVal('preferredSubfamily', sub);
    }
  }

  /**
   * Comprehensive Windows font compatibility repair.
   * opentype.js v1.x automatically serialises font.names with both
   * Mac (platformID=1) and Windows (platformID=3) name records — so we only
   * need to set values in the high-level font.names object.
   * We also harden cmap, OS/2, post, and head tables for Windows installs.
   */
  _fixWindowsCompatibility() {
    const font = this.font;
    if (!font) return;

    // ── 1. Ensure all required name records are populated ────────────────────
    const getNameVal = (key) => {
      const entry = font.names[key];
      if (!entry) return '';
      if (typeof entry === 'string') return entry;
      return entry.en || entry.undefined || Object.values(entry)[0] || '';
    };

    const safeSetName = (key, val) => {
      if (!val) return;
      try {
        if (!font.names[key]) font.names[key] = {};
        if (typeof font.names[key] === 'string') {
          font.names[key] = { en: val };
        } else {
          font.names[key].en = val;
        }
      } catch (e) { /* ignore if key not in opentype.js nameTableNames */ }
    };

    const family   = getNameVal('fontFamily')    || this.fileName.replace(/\.(ttf|otf|woff)$/i, '') || 'Untitled';
    const sub      = getNameVal('fontSubfamily') || 'Regular';
    const fullName = getNameVal('fullName')      || `${family} ${sub}`.trim();
    const psName   = (getNameVal('postScriptName')
      || `${family}-${sub}`.replace(/\s+/g, '-').replace(/[^A-Za-z0-9\-]/g, '')).substring(0, 63);
    const version  = getNameVal('version')       || 'Version 1.000';

    safeSetName('fontFamily',    family);
    safeSetName('fontSubfamily', sub);
    safeSetName('fullName',      fullName);
    safeSetName('postScriptName',psName);
    safeSetName('version',       version);
    // Unique ID with timestamp so Windows doesn't confuse with a cached old version
    safeSetName('uniqueID', `${version};${psName};${Date.now()}`);
    // Sync preferred family names to ensure it doesn't get grouped under the old font name
    if (font.names.preferredFamily) {
      safeSetName('preferredFamily', family);
    }
    if (font.names.preferredSubfamily) {
      safeSetName('preferredSubfamily', sub);
    }

    // ── 2. Remove DSIG table — it becomes invalid after any edit ─────────────
    // An invalid DSIG causes Windows to silently reject the font
    if (font.tables && font.tables.DSIG) delete font.tables.DSIG;
    if (font.tables && font.tables.dsig) delete font.tables.dsig;

    // ── 3. Ensure cmap has a Windows platform 3, encoding 1 sub-table ────────
    if (font.tables && font.tables.cmap) {
      const cmap = font.tables.cmap;
      if (cmap.tables && Array.isArray(cmap.tables)) {
        const hasWin = cmap.tables.some(t => t.platformID === 3 && t.encodingID === 1);
        if (!hasWin) {
          const srcTable = cmap.tables.find(t => t.glyphIndexMap);
          if (srcTable && srcTable.glyphIndexMap) {
            cmap.tables.push({
              platformID:    3,
              encodingID:    1,
              format:        4,
              glyphIndexMap: Object.assign({}, srcTable.glyphIndexMap)
            });
          }
        }
      }
    }

    // ── 4. Harden OS/2 table ─────────────────────────────────────────────────
    if (font.tables && font.tables.os2) {
      const os2 = font.tables.os2;
      const upem = font.unitsPerEm || 1000;

      // Keep the original version (do not force version 4 unless undefined, default to 3)
      if (os2.version === undefined || os2.version === null) os2.version = 3;

      // fsType = 0 → installable embedding (required for Windows install)
      if (os2.fsType === undefined || os2.fsType === null) os2.fsType = 0;

      // panose — must not be all-zero
      if (!os2.panose || os2.panose.every(b => b === 0)) {
        os2.panose = [2, 0, 5, 3, 0, 0, 0, 0, 0, 0];
      }

      // ulUnicodeRange1 — mark Basic Latin at minimum
      if (!os2.ulUnicodeRange1) os2.ulUnicodeRange1 = 1;
      if (!os2.ulUnicodeRange2) os2.ulUnicodeRange2 = 0;
      if (!os2.ulUnicodeRange3) os2.ulUnicodeRange3 = 0;
      if (!os2.ulUnicodeRange4) os2.ulUnicodeRange4 = 0;

      // achVendID — must be exactly 4 ASCII chars
      if (!os2.achVendID || os2.achVendID.length !== 4) os2.achVendID = 'UNKN';

      // usWeightClass — 400 = Regular
      if (!os2.usWeightClass) os2.usWeightClass = 400;

      // usWidthClass — 5 = Medium/Normal
      if (!os2.usWidthClass) os2.usWidthClass = 5;

      // usFirstCharIndex / usLastCharIndex — derive from cmap
      if (font.tables.cmap && font.tables.cmap.tables) {
        const srcMap = font.tables.cmap.tables.find(t => t.glyphIndexMap);
        if (srcMap && srcMap.glyphIndexMap) {
          const codes = Object.keys(srcMap.glyphIndexMap).map(Number);
          if (codes.length) {
            os2.usFirstCharIndex = Math.min(...codes);
            os2.usLastCharIndex  = Math.min(Math.max(...codes), 0xFFFE);
          }
        }
      }
      if (os2.usFirstCharIndex === undefined) os2.usFirstCharIndex = 0x0020;
      if (os2.usLastCharIndex  === undefined) os2.usLastCharIndex  = 0x00FF;

      // USE_TYPO_METRICS bit — Windows should use sTypo* not usWin*
      if (os2.fsSelection !== undefined) os2.fsSelection = os2.fsSelection | 0x0080;

      // Version-specific safe defaults to prevent undefined/NaN during binary compilation
      if (os2.version >= 1) {
        if (!os2.ulCodePageRange1) os2.ulCodePageRange1 = 0x00000001; // Latin 1
        if (!os2.ulCodePageRange2) os2.ulCodePageRange2 = 0;
      }
      if (os2.version >= 2) {
        if (!os2.sxHeight)   os2.sxHeight   = Math.round(upem * 0.5);
        if (!os2.sCapHeight) os2.sCapHeight = Math.round(upem * 0.7);
        if (!os2.usDefaultChar) os2.usDefaultChar = 0;
        if (!os2.usBreakChar) os2.usBreakChar = 32;
        if (!os2.usMaxContext) os2.usMaxContext = 1;
      }
    }

    // ── 4. Harden post table ─────────────────────────────────────────────────
    if (font.tables && font.tables.post) {
      const post = font.tables.post;
      if (post.italicAngle        === undefined) post.italicAngle        = 0;
      if (post.underlinePosition  === undefined) post.underlinePosition  = -100;
      if (post.underlineThickness === undefined) post.underlineThickness = 50;
      if (post.isFixedPitch       === undefined) post.isFixedPitch       = 0;
    }

    // ── 5. head table ────────────────────────────────────────────────────────
    if (font.tables && font.tables.head) {
      const head = font.tables.head;
      if (head.macStyle          === undefined) head.macStyle          = 0;
      if (head.lowestRecPPEM     === undefined) head.lowestRecPPEM     = 8;
      if (head.fontDirectionHint === undefined) head.fontDirectionHint = 2;
      if (head.indexToLocFormat  === undefined) head.indexToLocFormat  = 0;
    }
  }


  /* ═══════════════════════════════════════════
     Preview
     ═══════════════════════════════════════════ */

  setupPreview() {
    const input = document.getElementById('preview-input');
    if (input) {
      input.value = this.previewText;
      input.addEventListener('input', () => {
        this.previewText = input.value;
        this.updatePreview();
      });
    }

    // Size buttons
    document.querySelectorAll('.preview-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.preview-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activePreviewSize = parseInt(btn.dataset.size);
        this.updatePreview();
      });
    });
  }

  updatePreview() {
    const container = document.getElementById('preview-content');
    if (!container || !this.font) return;

    const text = this.previewText || 'Today\'s temperature is 25℃ (77℉). The angle is 90°, and every symbol should display clearly. 0123456789';
    const showAll = document.querySelector('.preview-size-btn.active')?.dataset.size === 'all';

    if (showAll) {
      let html = '';
      for (const size of this.previewSizes) {
        html += `<div class="preview-line" style="font-family: 'PreviewFont', sans-serif; font-size: ${size}px;">
          <span style="font-size: 10px; color: var(--text-tertiary); font-family: var(--font-mono); margin-right: 8px;">${size}px</span>
          ${this.escapeHTML(text)}
        </div>`;
      }
      container.innerHTML = html;
    } else {
      container.innerHTML = `<div class="preview-line" style="font-family: 'PreviewFont', sans-serif; font-size: ${this.activePreviewSize}px;">
        ${this.escapeHTML(text)}
      </div>`;
    }
  }

  /* ═══════════════════════════════════════════
     Editor Tabs
     ═══════════════════════════════════════════ */

  setupEditorTabs() {
    document.querySelectorAll('.editor-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchEditorTab(tab.dataset.tab);
      });
    });
  }

  switchEditorTab(tabName) {
    this.activeEditorTab = tabName;
    document.querySelectorAll('.editor-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });

    // Show/hide canvas info
    const canvasWrapper = document.getElementById('canvas-wrapper');
    const charmapView = document.getElementById('charmap-view');

    if (tabName === 'editor') {
      if (canvasWrapper) canvasWrapper.style.display = 'flex';
      if (charmapView) charmapView.style.display = 'none';
      this.glyphEditor.resizeCanvas();
    } else if (tabName === 'charmap') {
      if (canvasWrapper) canvasWrapper.style.display = 'none';
      if (charmapView) charmapView.style.display = 'block';
      this.renderInlineCharMap();
    }
  }

  renderInlineCharMap() {
    const container = document.getElementById('charmap-view');
    if (!container || !this.font) return;

    const blockSelect = document.getElementById('inline-charmap-block');
    const blockName = blockSelect ? blockSelect.value : 'basic-latin';

    const blocks = {
      'basic-latin': { start: 0x0020, end: 0x007F },
      'latin-1': { start: 0x0080, end: 0x00FF },
      'latin-ext-a': { start: 0x0100, end: 0x017F },
      'greek': { start: 0x0370, end: 0x03FF },
      'cyrillic': { start: 0x0400, end: 0x04FF },
      'arabic': { start: 0x0600, end: 0x06FF },
      'bangla': { start: 0x0980, end: 0x09FF },
      'devanagari': { start: 0x0900, end: 0x097F }
    };

    const block = blocks[blockName] || blocks['basic-latin'];
    const grid = document.getElementById('inline-charmap-grid');
    if (!grid) return;

    let html = '';
    for (let code = block.start; code <= block.end; code++) {
      const char = String.fromCodePoint(code);
      const glyph = this.font.charToGlyph(char);
      const hasGlyph = glyph && glyph.index !== 0;
      const hex = code.toString(16).toUpperCase().padStart(4, '0');

      html += `<div class="charmap-cell ${hasGlyph ? 'has-glyph' : 'no-glyph'}"
        data-tooltip="U+${hex}"
        onclick="app.selectGlyphByUnicodeInline(${code})"
        >${char}</div>`;
    }

    grid.innerHTML = html;
  }

  selectGlyphByUnicodeInline(code) {
    if (!this.font) return;
    const char = String.fromCodePoint(code);
    const glyph = this.font.charToGlyph(char);
    if (glyph && glyph.index > 0) {
      this.switchEditorTab('editor');
      this.selectGlyph(glyph.index);
      const cell = document.querySelector(`.glyph-cell[data-index="${glyph.index}"]`);
      if (cell) cell.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      this.showToast(`No glyph for U+${code.toString(16).toUpperCase().padStart(4, '0')}`, 'info');
    }
  }

  /* ═══════════════════════════════════════════
     Menu & Toolbar
     ═══════════════════════════════════════════ */

  setupMenu() {
    // Dropdown menus will be handled by click events on menu items
    document.querySelectorAll('.header__menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const action = item.dataset.action;
        if (action) this.handleMenuAction(action);
      });
    });

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.header__menu-item')) {
        document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('active'));
      }
    });
  }

  setupToolbar() {
    document.querySelectorAll('.toolbar__btn[data-action], .toolbar__label-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.handleToolbarAction(btn.dataset.action);
      });
    });
  }

  handleMenuAction(action) {
    switch (action) {
      case 'new':
        this.showNewFontModal();
        break;
      case 'demo':
        this.loadDemoFont();
        break;
      case 'open':
        document.getElementById('file-input').click();
        break;
      case 'save':
        this.exportFontManual(this.font && this.font.outlinesFormat === 'cff' ? 'otf' : 'ttf');
        break;
      case 'export-otf':
        this.exportFontManual('otf');
        break;
      case 'font-info':
        this.showFontInfoModal();
        break;
      case 'validate':
        this.showValidationModal();
        break;
      case 'special-chars':
        this.showSpecialCharsModal();
        break;
      case 'charmap':
        this.showCharacterMap();
        break;
      case 'kerning':
        this.showKerningModal();
        break;
      case 'close':
        this.closeFont();
        break;
    }
  }

  handleToolbarAction(action) {
    switch (action) {
      case 'new':
        this.showNewFontModal();
        break;
      case 'demo':
        this.loadDemoFont();
        break;
      case 'open':
        document.getElementById('file-input').click();
        break;
      case 'save':
        this.exportFontManual(this.font && this.font.outlinesFormat === 'cff' ? 'otf' : 'ttf');
        break;
      case 'export':
        this.exportFontManual(this.font && this.font.outlinesFormat === 'cff' ? 'otf' : 'ttf');
        break;
      case 'undo':
        this.glyphEditor.undo();
        break;
      case 'redo':
        this.glyphEditor.redo();
        break;
      case 'select':
        this.glyphEditor.setTool('select');
        this.updateToolbarActiveState('select');
        break;
      case 'pan':
        this.glyphEditor.setTool('pan');
        this.updateToolbarActiveState('pan');
        break;
      case 'pen':
        this.glyphEditor.setTool('pen');
        this.updateToolbarActiveState('pen');
        break;
      case 'zoom-in':
        this.glyphEditor.zoomIn();
        break;
      case 'zoom-out':
        this.glyphEditor.zoomOut();
        break;
      case 'zoom-fit':
        this.glyphEditor.zoomFit();
        break;
      case 'font-info':
        this.showFontInfoModal();
        break;
      case 'validate':
        this.showValidationModal();
        break;
      case 'special-chars':
        this.showSpecialCharsModal();
        break;
      case 'charmap':
        this.showCharacterMap();
        break;
      case 'kerning':
        this.showKerningModal();
        break;
      case 'flip-h':
        this.glyphEditor.flipHorizontal();
        break;
      case 'flip-v':
        this.glyphEditor.flipVertical();
        break;
    }
  }

  updateToolbarActiveState(activeTool) {
    document.querySelectorAll('.toolbar__btn[data-action="select"], .toolbar__btn[data-action="pan"], .toolbar__btn[data-action="pen"]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.action === activeTool);
    });
  }

  /* ═══════════════════════════════════════════
     Search & Filters
     ═══════════════════════════════════════════ */

  setupSearch() {
    const input = document.getElementById('glyph-search');
    if (input) {
      input.addEventListener('input', () => {
        this.searchQuery = input.value;
        this.applyFilters();
        this.renderGlyphGrid();
      });
    }
  }

  setupFilters() {
    document.querySelectorAll('.sidebar__filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sidebar__filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.applyFilters();
        this.renderGlyphGrid();
      });
    });
  }

  /* ═══════════════════════════════════════════
     Status Bar
     ═══════════════════════════════════════════ */

  updateStatusBar() {
    if (!this.font) return;

    const statusGlyphs = document.getElementById('status-glyphs');
    if (statusGlyphs) statusGlyphs.textContent = `Glyphs: ${this.font.glyphs.length}`;

    const statusFormat = document.getElementById('status-format');
    if (statusFormat) statusFormat.textContent = `Format: ${this.font.outlinesFormat || 'TrueType'}`;
  }

  updateFontName() {
    const el = document.getElementById('font-name-display');
    if (!el || !this.font) return;

    const names = this.font.names;
    const family = names.fontFamily ? (names.fontFamily.en || Object.values(names.fontFamily)[0]) : '';
    const style = names.fontSubfamily ? (names.fontSubfamily.en || Object.values(names.fontSubfamily)[0]) : '';

    el.textContent = `${family} ${style}`.trim() || this.fileName;
  }

  /* ═══════════════════════════════════════════
     Close Font
     ═══════════════════════════════════════════ */

  closeFont() {
    if (this.modified) {
      if (!confirm('You have unsaved changes. Close anyway?')) return;
    }

    this.font = null;
    this.fileName = '';
    this.selectedGlyphIndex = -1;
    this.glyphList = [];
    this.filteredGlyphs = [];
    this.modified = false;

    // Reset UI
    document.getElementById('glyph-grid').innerHTML = '';
    document.getElementById('properties-content').innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📝</div>
        <div class="empty-state__text">No Font Loaded</div>
        <div class="empty-state__hint">Open a font file to get started</div>
      </div>
    `;
    document.getElementById('preview-content').innerHTML = '';
    document.getElementById('font-name-display').textContent = 'No Font Loaded';
    document.getElementById('glyph-count').textContent = '0';

    this.glyphEditor.glyph = null;
    this.glyphEditor.font = null;
    this.glyphEditor.render();

    this.showWelcomeScreen();
    this.showToast('Font closed', 'info');
  }

  /* ═══════════════════════════════════════════
     Modal Helpers
     ═══════════════════════════════════════════ */

  showModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.add('active');
  }

  hideModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.remove('active');
  }

  /* ═══════════════════════════════════════════
     Toast Notifications
     ═══════════════════════════════════════════ */

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${this.escapeHTML(message)}`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  /* ═══════════════════════════════════════════
     Utilities
     ═══════════════════════════════════════════ */

  escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  escapeAttr(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ═══════════════════════════════════════════
     Quick Add Special Characters (°, ℃, ℉)
     ═══════════════════════════════════════════ */

  showSpecialCharsModal() {
    if (!this.font) {
      this.showToast('No font loaded', 'warning');
      return;
    }

    const modal = document.getElementById('special-chars-modal');
    const body = document.getElementById('special-chars-body');

    const chars = [
      { char: '°', unicode: 0x00B0, name: 'Degree Sign', desc: 'U+00B0 — Used for temperature, angles' },
      { char: '℃', unicode: 0x2103, name: 'Degree Celsius', desc: 'U+2103 — Celsius temperature symbol' },
      { char: '℉', unicode: 0x2109, name: 'Degree Fahrenheit', desc: 'U+2109 — Fahrenheit temperature symbol' }
    ];

    let html = `
      <div style="margin-bottom: 16px; font-size: 13px; color: var(--text-secondary);">
        Click a character to add it to the current font. If the glyph already exists, it will be replaced.
      </div>
      <div class="special-chars-grid">
    `;

    for (const ch of chars) {
      const existingGlyph = this.font.charToGlyph(ch.char);
      const exists = existingGlyph && existingGlyph.index !== 0;
      const statusBadge = exists
        ? `<span class="badge badge--green" style="font-size: 9px;">Exists</span>`
        : `<span class="badge badge--coral" style="font-size: 9px;">Missing</span>`;

      html += `
        <div class="special-char-card" id="special-card-${ch.unicode}">
          <div class="special-char-card__preview">${ch.char}</div>
          <div class="special-char-card__info">
            <div class="special-char-card__name">${ch.name} ${statusBadge}</div>
            <div class="special-char-card__desc">${ch.desc}</div>
          </div>
          <button class="btn btn--primary special-char-card__btn"
            onclick="app.addSpecialChar(${ch.unicode}, '${ch.char}', '${ch.name}')">
            ${exists ? '🔄 Replace' : '➕ Add'} to Font
          </button>
        </div>
      `;
    }

    html += `</div>`;
    body.innerHTML = html;

    this.showModal('special-chars-modal');
  }

  /**
   * Add a special character glyph to the font
   */
  addSpecialChar(unicode, char, name) {
    if (!this.font) return;

    const upm = this.font.unitsPerEm;
    const ascender = this.font.ascender;

    let path;
    let advanceWidth;

    switch (unicode) {
      case 0x00B0: // ° Degree Sign
        ({ path, advanceWidth } = this.generateDegreeGlyph(upm, ascender));
        break;
      case 0x2103: // ℃ Degree Celsius
        ({ path, advanceWidth } = this.generateDegreeCelsiusGlyph(upm, ascender));
        break;
      case 0x2109: // ℉ Degree Fahrenheit
        ({ path, advanceWidth } = this.generateDegreeFahrenheitGlyph(upm, ascender));
        break;
      default:
        this.showToast('Unknown character', 'error');
        return;
    }

    // Check if glyph already exists
    const existingGlyph = this.font.charToGlyph(char);
    let glyphIndex;

    if (existingGlyph && existingGlyph.index !== 0) {
      // Replace existing
      existingGlyph.path = path;
      existingGlyph.advanceWidth = advanceWidth;
      glyphIndex = existingGlyph.index;
    } else {
      // Add new glyph
      const newGlyph = new opentype.Glyph({
        name: name.replace(/\s+/g, ''),
        unicode: unicode,
        unicodes: [unicode],
        advanceWidth: advanceWidth,
        path: path
      });
      newGlyph.index = this.font.glyphs.length;
      this.font.glyphs.push(this.font.glyphs.length, newGlyph);
      glyphIndex = this.font.glyphs.length - 1;

      // Update mapping cache tables in encoding and cmap to make sure lookups work instantly in the current session
      if (this.font.encoding) {
        if (this.font.encoding.cmap && this.font.encoding.cmap.glyphIndexMap) {
          this.font.encoding.cmap.glyphIndexMap[unicode] = glyphIndex;
        }
        if (this.font.encoding.glyphIndexMap) {
          this.font.encoding.glyphIndexMap[unicode] = glyphIndex;
        }
      }
      if (this.font.tables && this.font.tables.cmap && this.font.tables.cmap.glyphIndexMap) {
        this.font.tables.cmap.glyphIndexMap[unicode] = glyphIndex;
      }
    }

    this.modified = true;

    // Rebuild glyph list and refresh grid
    this.buildGlyphList();
    this.renderGlyphGrid();
    this.updateStatusBar();

    // Update the card status in the modal
    const card = document.getElementById(`special-card-${unicode}`);
    if (card) {
      const btn = card.querySelector('.special-char-card__btn');
      if (btn) {
        btn.innerHTML = '✅ Added!';
        btn.classList.remove('btn--primary');
        btn.style.background = 'var(--accent-green-dim)';
        btn.style.color = 'var(--accent-green)';
        btn.style.borderColor = 'rgba(63, 185, 80, 0.3)';
      }
      const badge = card.querySelector('.badge');
      if (badge) {
        badge.className = 'badge badge--green';
        badge.style.fontSize = '9px';
        badge.textContent = 'Added ✓';
      }
    }

    this.showToast(`"${char}" (${name}) added to font successfully!`, 'success');

    // Select the new glyph
    setTimeout(() => {
      this.selectGlyph(glyphIndex);
      const cell = document.querySelector(`.glyph-cell[data-index="${glyphIndex}"]`);
      if (cell) cell.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }

  /**
   * Generate ° (Degree Sign) glyph — a small circle near top
   */
  generateDegreeGlyph(upm, ascender) {
    const path = new opentype.Path();

    // Circle parameters
    const radius = upm * 0.09;
    const strokeWidth = upm * 0.04;
    const cx = upm * 0.22;
    const cy = ascender * 0.85;
    const outerR = radius;
    const innerR = radius - strokeWidth;

    // Bezier control factor for circles: 0.5523
    const k = 0.5523;

    // Outer circle (clockwise)
    path.moveTo(cx + outerR, cy);
    path.curveTo(cx + outerR, cy + outerR * k, cx + outerR * k, cy + outerR, cx, cy + outerR);
    path.curveTo(cx - outerR * k, cy + outerR, cx - outerR, cy + outerR * k, cx - outerR, cy);
    path.curveTo(cx - outerR, cy - outerR * k, cx - outerR * k, cy - outerR, cx, cy - outerR);
    path.curveTo(cx + outerR * k, cy - outerR, cx + outerR, cy - outerR * k, cx + outerR, cy);
    path.close();

    // Inner circle (counter-clockwise for hole)
    path.moveTo(cx + innerR, cy);
    path.curveTo(cx + innerR, cy - innerR * k, cx + innerR * k, cy - innerR, cx, cy - innerR);
    path.curveTo(cx - innerR * k, cy - innerR, cx - innerR, cy - innerR * k, cx - innerR, cy);
    path.curveTo(cx - innerR, cy + innerR * k, cx - innerR * k, cy + innerR, cx, cy + innerR);
    path.curveTo(cx + innerR * k, cy + innerR, cx + innerR, cy + innerR * k, cx + innerR, cy);
    path.close();

    const advanceWidth = Math.round(cx * 2);
    return { path, advanceWidth };
  }

  /**
   * Generate ℃ (Degree Celsius) glyph — degree sign + C letter
   */
  generateDegreeCelsiusGlyph(upm, ascender) {
    const path = new opentype.Path();

    // First: small degree circle at top-left
    const degRadius = upm * 0.065;
    const degStroke = upm * 0.03;
    const degCx = upm * 0.15;
    const degCy = ascender * 0.88;
    const outerR = degRadius;
    const innerR = degRadius - degStroke;
    const k = 0.5523;

    // Outer circle
    path.moveTo(degCx + outerR, degCy);
    path.curveTo(degCx + outerR, degCy + outerR * k, degCx + outerR * k, degCy + outerR, degCx, degCy + outerR);
    path.curveTo(degCx - outerR * k, degCy + outerR, degCx - outerR, degCy + outerR * k, degCx - outerR, degCy);
    path.curveTo(degCx - outerR, degCy - outerR * k, degCx - outerR * k, degCy - outerR, degCx, degCy - outerR);
    path.curveTo(degCx + outerR * k, degCy - outerR, degCx + outerR, degCy - outerR * k, degCx + outerR, degCy);
    path.close();

    // Inner circle (hole)
    path.moveTo(degCx + innerR, degCy);
    path.curveTo(degCx + innerR, degCy - innerR * k, degCx + innerR * k, degCy - innerR, degCx, degCy - innerR);
    path.curveTo(degCx - innerR * k, degCy - innerR, degCx - innerR, degCy - innerR * k, degCx - innerR, degCy);
    path.curveTo(degCx - innerR, degCy + innerR * k, degCx - innerR * k, degCy + innerR, degCx, degCy + innerR);
    path.curveTo(degCx + innerR * k, degCy + innerR, degCx + innerR, degCy + innerR * k, degCx + innerR, degCy);
    path.close();

    // Second: try to copy 'C' glyph from font, offset to the right
    const cGlyph = this.font.charToGlyph('C');
    const offsetX = upm * 0.25;

    if (cGlyph && cGlyph.index !== 0 && cGlyph.path && cGlyph.path.commands.length > 0) {
      // Copy C glyph commands with offset
      for (const cmd of cGlyph.path.commands) {
        switch (cmd.type) {
          case 'M': path.moveTo(cmd.x + offsetX, cmd.y); break;
          case 'L': path.lineTo(cmd.x + offsetX, cmd.y); break;
          case 'Q': path.quadraticCurveTo(cmd.x1 + offsetX, cmd.y1, cmd.x + offsetX, cmd.y); break;
          case 'C': path.curveTo(cmd.x1 + offsetX, cmd.y1, cmd.x2 + offsetX, cmd.y2, cmd.x + offsetX, cmd.y); break;
          case 'Z': path.close(); break;
        }
      }
      const cWidth = cGlyph.advanceWidth || upm * 0.6;
      return { path, advanceWidth: Math.round(offsetX + cWidth) };
    } else {
      // Fallback: draw a simple C shape
      this.drawFallbackC(path, offsetX, upm, ascender);
      return { path, advanceWidth: Math.round(upm * 0.85) };
    }
  }

  /**
   * Generate ℉ (Degree Fahrenheit) glyph — degree sign + F letter
   */
  generateDegreeFahrenheitGlyph(upm, ascender) {
    const path = new opentype.Path();

    // First: small degree circle at top-left (same as Celsius)
    const degRadius = upm * 0.065;
    const degStroke = upm * 0.03;
    const degCx = upm * 0.15;
    const degCy = ascender * 0.88;
    const outerR = degRadius;
    const innerR = degRadius - degStroke;
    const k = 0.5523;

    // Outer circle
    path.moveTo(degCx + outerR, degCy);
    path.curveTo(degCx + outerR, degCy + outerR * k, degCx + outerR * k, degCy + outerR, degCx, degCy + outerR);
    path.curveTo(degCx - outerR * k, degCy + outerR, degCx - outerR, degCy + outerR * k, degCx - outerR, degCy);
    path.curveTo(degCx - outerR, degCy - outerR * k, degCx - outerR * k, degCy - outerR, degCx, degCy - outerR);
    path.curveTo(degCx + outerR * k, degCy - outerR, degCx + outerR, degCy - outerR * k, degCx + outerR, degCy);
    path.close();

    // Inner circle (hole)
    path.moveTo(degCx + innerR, degCy);
    path.curveTo(degCx + innerR, degCy - innerR * k, degCx + innerR * k, degCy - innerR, degCx, degCy - innerR);
    path.curveTo(degCx - innerR * k, degCy - innerR, degCx - innerR, degCy - innerR * k, degCx - innerR, degCy);
    path.curveTo(degCx - innerR, degCy + innerR * k, degCx - innerR * k, degCy + innerR, degCx, degCy + innerR);
    path.curveTo(degCx + innerR * k, degCy + innerR, degCx + innerR, degCy + innerR * k, degCx + innerR, degCy);
    path.close();

    // Second: try to copy 'F' glyph from font, offset to the right
    const fGlyph = this.font.charToGlyph('F');
    const offsetX = upm * 0.25;

    if (fGlyph && fGlyph.index !== 0 && fGlyph.path && fGlyph.path.commands.length > 0) {
      for (const cmd of fGlyph.path.commands) {
        switch (cmd.type) {
          case 'M': path.moveTo(cmd.x + offsetX, cmd.y); break;
          case 'L': path.lineTo(cmd.x + offsetX, cmd.y); break;
          case 'Q': path.quadraticCurveTo(cmd.x1 + offsetX, cmd.y1, cmd.x + offsetX, cmd.y); break;
          case 'C': path.curveTo(cmd.x1 + offsetX, cmd.y1, cmd.x2 + offsetX, cmd.y2, cmd.x + offsetX, cmd.y); break;
          case 'Z': path.close(); break;
        }
      }
      const fWidth = fGlyph.advanceWidth || upm * 0.55;
      return { path, advanceWidth: Math.round(offsetX + fWidth) };
    } else {
      // Fallback: draw a simple F shape
      this.drawFallbackF(path, offsetX, upm, ascender);
      return { path, advanceWidth: Math.round(upm * 0.75) };
    }
  }

  /**
   * Fallback C shape when font doesn't have 'C'
   */
  drawFallbackC(path, offsetX, upm, ascender) {
    const x = offsetX;
    const top = ascender * 0.95;
    const bot = 0;
    const w = upm * 0.55;
    const stroke = upm * 0.1;

    // Simple C: outer arc and inner arc
    const cx = x + w * 0.55;
    const cy = (top + bot) / 2;
    const rx = w * 0.5;
    const ry = (top - bot) / 2;
    const k = 0.5523;

    // Outer
    path.moveTo(cx + rx * 0.7, top);
    path.curveTo(cx - rx * k * 0.3, top, cx - rx, cy + ry * k, cx - rx, cy);
    path.curveTo(cx - rx, cy - ry * k, cx - rx * k * 0.3, bot, cx + rx * 0.7, bot);
    path.lineTo(cx + rx * 0.7, bot + stroke);
    path.curveTo(cx - rx * k * 0.1, bot + stroke, cx - rx + stroke, cy - (ry - stroke) * k, cx - rx + stroke, cy);
    path.curveTo(cx - rx + stroke, cy + (ry - stroke) * k, cx - rx * k * 0.1, top - stroke, cx + rx * 0.7, top - stroke);
    path.close();
  }

  /**
   * Fallback F shape when font doesn't have 'F'
   */
  drawFallbackF(path, offsetX, upm, ascender) {
    const x = offsetX;
    const top = ascender * 0.95;
    const bot = 0;
    const w = upm * 0.5;
    const stroke = upm * 0.1;
    const mid = (top + bot) / 2 + upm * 0.05;

    // Vertical stem
    path.moveTo(x, bot);
    path.lineTo(x + stroke, bot);
    path.lineTo(x + stroke, top);
    path.lineTo(x, top);
    path.close();

    // Top horizontal bar
    path.moveTo(x, top);
    path.lineTo(x + w, top);
    path.lineTo(x + w, top - stroke);
    path.lineTo(x, top - stroke);
    path.close();

    // Middle horizontal bar
    path.moveTo(x, mid + stroke / 2);
    path.lineTo(x + w * 0.75, mid + stroke / 2);
    path.lineTo(x + w * 0.75, mid - stroke / 2);
    path.lineTo(x, mid - stroke / 2);
    path.close();
  }

  /* ═══════════════════════════════════════════
     Theme Toggle
     ═══════════════════════════════════════════ */

  setupTheme() {
    const saved = localStorage.getItem('ffs-theme') || 'dark';
    this.applyTheme(saved);

    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.themeTarget;
        this.applyTheme(theme);
        localStorage.setItem('ffs-theme', theme);
      });
    });
  }

  applyTheme(theme) {
    // Apply to <body>
    document.body.setAttribute('data-theme', theme);

    // Update active button state
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeTarget === theme);
    });
  }

  /* ═══════════════════════════════════════════
     Preview Panel Resize
     ═══════════════════════════════════════════ */

  setupPreviewResize() {
    const handle   = document.getElementById('preview-resize-handle');
    const appEl    = document.getElementById('app');
    const MIN_H    = 60;    // px — smallest preview height
    const MAX_H    = 500;   // px — largest preview height
    const STORED_KEY = 'ffs-preview-height';

    // Restore saved height
    const saved = parseInt(localStorage.getItem(STORED_KEY));
    if (saved && saved >= MIN_H && saved <= MAX_H) {
      appEl.style.setProperty('--preview-height-dynamic', saved + 'px');
    }

    if (!handle) return;

    let dragging   = false;
    let startY     = 0;
    let startH     = 0;

    const getHeight = () => {
      return parseInt(
        getComputedStyle(appEl).getPropertyValue('--preview-height-dynamic') || '120'
      ) || 120;
    };

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      startY   = e.clientY;
      startH   = getHeight();
      handle.classList.add('dragging');
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      // Dragging UP (negative delta) → increase height
      // Dragging DOWN (positive delta) → decrease height
      const delta  = startY - e.clientY;
      const newH   = Math.min(MAX_H, Math.max(MIN_H, startH + delta));
      appEl.style.setProperty('--preview-height-dynamic', newH + 'px');
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Persist
      const current = getHeight();
      localStorage.setItem(STORED_KEY, current);
    });

    // Touch support
    handle.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      dragging = true;
      startY   = t.clientY;
      startH   = getHeight();
      handle.classList.add('dragging');
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const t = e.touches[0];
      const delta = startY - t.clientY;
      const newH  = Math.min(MAX_H, Math.max(MIN_H, startH + delta));
      appEl.style.setProperty('--preview-height-dynamic', newH + 'px');
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      localStorage.setItem(STORED_KEY, getHeight());
    });
  }

  /* ═══════════════════════════════════════════
     Sidebar Resize
     ═══════════════════════════════════════════ */

  setupSidebarResize() {
    const handle     = document.getElementById('sidebar-resize-handle');
    const mainEl     = document.querySelector('.main-content');
    const MIN_W      = 160;   // px — narrowest sidebar
    const MAX_W      = 480;   // px — widest sidebar
    const STORED_KEY = 'ffs-sidebar-width';

    // Restore saved width
    const saved = parseInt(localStorage.getItem(STORED_KEY));
    if (saved && saved >= MIN_W && saved <= MAX_W) {
      mainEl.style.setProperty('--sidebar-width-dynamic', saved + 'px');
    }

    if (!handle) return;

    let dragging = false;
    let startX   = 0;
    let startW   = 0;

    const getWidth = () => {
      return parseInt(
        getComputedStyle(mainEl).getPropertyValue('--sidebar-width-dynamic') || '280'
      ) || 280;
    };

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      startX   = e.clientX;
      startW   = getWidth();
      handle.classList.add('dragging');
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      // Moving RIGHT → wider, LEFT → narrower
      const delta = e.clientX - startX;
      const newW  = Math.min(MAX_W, Math.max(MIN_W, startW + delta));
      mainEl.style.setProperty('--sidebar-width-dynamic', newW + 'px');
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem(STORED_KEY, getWidth());
    });

    // Touch support
    handle.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      dragging = true;
      startX   = t.clientX;
      startW   = getWidth();
      handle.classList.add('dragging');
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const t    = e.touches[0];
      const delta = t.clientX - startX;
      const newW  = Math.min(MAX_W, Math.max(MIN_W, startW + delta));
      mainEl.style.setProperty('--sidebar-width-dynamic', newW + 'px');
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      localStorage.setItem(STORED_KEY, getWidth());
    });
  }
}

// ── Initialize App ──
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new FontEditorApp();
  window.app = app;
});
