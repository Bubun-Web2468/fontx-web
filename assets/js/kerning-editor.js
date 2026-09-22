/* ============================================
   Kerning Editor — View & Edit Kerning Pairs
   ============================================ */

class KerningEditor {
  constructor(font) {
    this.font = font;
    this.pairs = [];
    this.extractPairs();
  }

  /**
   * Extract all kerning pairs from the font
   */
  extractPairs() {
    this.pairs = [];
    if (!this.font) return;

    // Extract from kern table (legacy)
    if (this.font.kerningPairs) {
      for (const key of Object.keys(this.font.kerningPairs)) {
        const parts = key.split(',');
        if (parts.length === 2) {
          const leftIndex = parseInt(parts[0]);
          const rightIndex = parseInt(parts[1]);
          const value = this.font.kerningPairs[key];

          const leftGlyph = this.font.glyphs.get(leftIndex);
          const rightGlyph = this.font.glyphs.get(rightIndex);

          if (leftGlyph && rightGlyph) {
            this.pairs.push({
              leftIndex,
              rightIndex,
              leftName: leftGlyph.name || `glyph${leftIndex}`,
              rightName: rightGlyph.name || `glyph${rightIndex}`,
              leftChar: leftGlyph.unicode ? String.fromCodePoint(leftGlyph.unicode) : '',
              rightChar: rightGlyph.unicode ? String.fromCodePoint(rightGlyph.unicode) : '',
              value: value,
              source: 'kern'
            });
          }
        }
      }
    }

    // Try to extract from GPOS if available
    this.extractGPOSKerning();

    // Sort by left character
    this.pairs.sort((a, b) => a.leftName.localeCompare(b.leftName));
  }

  /**
   * Extract GPOS-based kerning (simplified)
   */
  extractGPOSKerning() {
    try {
      if (!this.font.tables || !this.font.tables.gpos) return;

      const gpos = this.font.tables.gpos;
      if (!gpos.features) return;

      // Find kern features
      for (const feature of gpos.features) {
        if (feature.tag === 'kern') {
          // GPOS kerning exists
          // Full extraction would require parsing subtable lookups
          // For MVP, we note that GPOS kerning is present
        }
      }
    } catch (e) {
      // GPOS parsing is complex; skip on error
    }
  }

  /**
   * Get the kerning value for two characters
   */
  getKerning(leftChar, rightChar) {
    if (!this.font) return 0;
    try {
      const leftGlyph = this.font.charToGlyph(leftChar);
      const rightGlyph = this.font.charToGlyph(rightChar);
      if (leftGlyph && rightGlyph) {
        return this.font.getKerningValue(leftGlyph, rightGlyph);
      }
    } catch (e) {
      // ignore
    }
    return 0;
  }

  /**
   * Update a kerning pair value
   */
  updatePair(leftIndex, rightIndex, newValue) {
    if (!this.font) return false;
    const key = `${leftIndex},${rightIndex}`;

    if (!this.font.kerningPairs) {
      this.font.kerningPairs = {};
    }

    this.font.kerningPairs[key] = newValue;

    // Update our local pairs array
    const existing = this.pairs.find(p => p.leftIndex === leftIndex && p.rightIndex === rightIndex);
    if (existing) {
      existing.value = newValue;
    } else {
      const leftGlyph = this.font.glyphs.get(leftIndex);
      const rightGlyph = this.font.glyphs.get(rightIndex);
      this.pairs.push({
        leftIndex,
        rightIndex,
        leftName: leftGlyph ? leftGlyph.name : `glyph${leftIndex}`,
        rightName: rightGlyph ? rightGlyph.name : `glyph${rightIndex}`,
        leftChar: leftGlyph && leftGlyph.unicode ? String.fromCodePoint(leftGlyph.unicode) : '',
        rightChar: rightGlyph && rightGlyph.unicode ? String.fromCodePoint(rightGlyph.unicode) : '',
        value: newValue,
        source: 'kern'
      });
    }

    return true;
  }

  /**
   * Delete a kerning pair
   */
  deletePair(leftIndex, rightIndex) {
    if (!this.font || !this.font.kerningPairs) return false;
    const key = `${leftIndex},${rightIndex}`;
    delete this.font.kerningPairs[key];
    this.pairs = this.pairs.filter(p => !(p.leftIndex === leftIndex && p.rightIndex === rightIndex));
    return true;
  }

  /**
   * Add a new kerning pair by characters
   */
  addPairByChars(leftChar, rightChar, value) {
    const leftGlyph = this.font.charToGlyph(leftChar);
    const rightGlyph = this.font.charToGlyph(rightChar);
    if (!leftGlyph || !rightGlyph || leftGlyph.index === 0 || rightGlyph.index === 0) {
      return false;
    }
    return this.updatePair(leftGlyph.index, rightGlyph.index, value);
  }

  /**
   * Get all pairs (for rendering the table)
   */
  getPairs() {
    return this.pairs;
  }

  /**
   * Get pair count
   */
  getCount() {
    return this.pairs.length;
  }

  /**
   * Generate common kerning pair suggestions
   */
  getSuggestions() {
    const commonPairs = [
      ['A', 'V'], ['A', 'W'], ['A', 'Y'], ['A', 'T'],
      ['T', 'a'], ['T', 'o'], ['T', 'e'], ['T', 'i'],
      ['V', 'a'], ['V', 'o'], ['V', 'e'],
      ['W', 'a'], ['W', 'o'], ['W', 'e'],
      ['Y', 'a'], ['Y', 'o'], ['Y', 'e'],
      ['L', 'T'], ['L', 'V'], ['L', 'W'], ['L', 'Y'],
      ['P', 'a'], ['P', '.'], ['P', ','],
      ['F', 'a'], ['F', '.'], ['F', ','],
      ['r', '.'], ['r', ','],
      ['f', '.'], ['f', ',']
    ];

    const suggestions = [];
    for (const [l, r] of commonPairs) {
      const leftG = this.font.charToGlyph(l);
      const rightG = this.font.charToGlyph(r);
      if (leftG && rightG && leftG.index !== 0 && rightG.index !== 0) {
        const existing = this.getKerning(l, r);
        if (existing === 0) {
          suggestions.push({ left: l, right: r });
        }
      }
    }

    return suggestions;
  }

  /**
   * Render the kerning editor HTML
   */
  renderHTML() {
    if (this.pairs.length === 0) {
      return `
        <div class="empty-state" style="padding: 30px;">
          <div class="empty-state__icon">⚙️</div>
          <div class="empty-state__text">No Kerning Pairs Found</div>
          <div class="empty-state__hint">This font has no kerning data. You can add pairs below.</div>
        </div>
        <div style="padding: 12px 20px; border-top: 1px solid var(--border-default);">
          <div style="font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">Add New Pair</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="text" id="kern-left-char" maxlength="1" placeholder="A" style="width: 40px; text-align: center;" class="prop-row__input">
            <input type="text" id="kern-right-char" maxlength="1" placeholder="V" style="width: 40px; text-align: center;" class="prop-row__input">
            <input type="number" id="kern-value" value="-50" style="width: 70px; text-align: center;" class="prop-row__input">
            <button class="btn btn--primary" onclick="app.addKerningPair()">Add</button>
          </div>
        </div>
      `;
    }

    let html = `
      <div style="padding: 8px 20px; border-bottom: 1px solid var(--border-default); display: flex; justify-content: space-between; align-items: center;">
        <span class="badge badge--blue">${this.pairs.length} pairs</span>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input type="text" id="kern-left-char" maxlength="1" placeholder="A" style="width: 36px; text-align: center;" class="prop-row__input">
          <input type="text" id="kern-right-char" maxlength="1" placeholder="V" style="width: 36px; text-align: center;" class="prop-row__input">
          <input type="number" id="kern-value" value="-50" style="width: 60px; text-align: center;" class="prop-row__input">
          <button class="btn btn--primary" style="padding: 4px 10px; font-size: 11px;" onclick="app.addKerningPair()">+ Add</button>
        </div>
      </div>
      <div style="overflow-y: auto; max-height: 400px;">
        <table class="kerning-table">
          <thead>
            <tr>
              <th>Preview</th>
              <th>Left</th>
              <th>Right</th>
              <th>Value</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const pair of this.pairs) {
      html += `
        <tr>
          <td class="kern-pair">${this.escapeHTML(pair.leftChar)}${this.escapeHTML(pair.rightChar)}</td>
          <td>${this.escapeHTML(pair.leftName)}</td>
          <td>${this.escapeHTML(pair.rightName)}</td>
          <td>
            <input type="number" class="kern-input" value="${pair.value}"
              onchange="app.updateKerningValue(${pair.leftIndex}, ${pair.rightIndex}, this.value)">
          </td>
          <td>
            <button class="btn btn--danger" style="padding: 2px 8px; font-size: 10px;"
              onclick="app.deleteKerningPair(${pair.leftIndex}, ${pair.rightIndex})">✕</button>
          </td>
        </tr>
      `;
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    return html;
  }

  escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

window.KerningEditor = KerningEditor;
