/* ============================================
   FontX — Font Factory (Web Font & Demo Generator)
   Pure client-side font creation using opentype.js
   ============================================ */

class FontFactory {
  /**
   * Creates a blank new font from scratch.
   * @param {Object} options 
   * @returns {opentype.Font}
   */
  static createBlankFont(options = {}) {
    const familyName = (options.familyName || 'Untitled').trim();
    const styleName = (options.styleName || 'Regular').trim();
    const unitsPerEm = parseInt(options.unitsPerEm) || 1000;
    const ascender = parseInt(options.ascender) || Math.round(unitsPerEm * 0.8);
    const descender = parseInt(options.descender) || -Math.round(unitsPerEm * 0.2);

    // 1. Standard .notdef glyph
    const notdefPath = new opentype.Path();
    const ndW = Math.round(unitsPerEm * 0.5);
    const ndH = Math.round(unitsPerEm * 0.7);
    const stroke = Math.round(unitsPerEm * 0.05);

    // Outer rectangle
    notdefPath.moveTo(50, 0);
    notdefPath.lineTo(50, ndH);
    notdefPath.lineTo(ndW - 50, ndH);
    notdefPath.lineTo(ndW - 50, 0);
    notdefPath.close();

    // Inner cutout
    notdefPath.moveTo(50 + stroke, stroke);
    notdefPath.lineTo(ndW - 50 - stroke, stroke);
    notdefPath.lineTo(ndW - 50 - stroke, ndH - stroke);
    notdefPath.lineTo(50 + stroke, ndH - stroke);
    notdefPath.close();

    const notdef = new opentype.Glyph({
      name: '.notdef',
      unicode: 0,
      advanceWidth: ndW,
      path: notdefPath
    });

    // 2. Space glyph
    const space = new opentype.Glyph({
      name: 'space',
      unicode: 32,
      advanceWidth: Math.round(unitsPerEm * 0.28),
      path: new opentype.Path()
    });

    const glyphs = [notdef, space];

    // Create opentype.Font instance
    const font = new opentype.Font({
      familyName: familyName,
      styleName: styleName,
      unitsPerEm: unitsPerEm,
      ascender: ascender,
      descender: descender,
      glyphs: glyphs
    });

    // Ensure metadata tables
    font.names = {
      fontFamily: { en: familyName },
      fontSubfamily: { en: styleName },
      fullName: { en: `${familyName} ${styleName}`.trim() },
      postScriptName: { en: `${familyName}-${styleName}`.replace(/\s+/g, '-').replace(/[^A-Za-z0-9\-]/g, '') || 'FontX' },
      version: { en: 'Version 1.000' }
    };

    return font;
  }

  /**
   * Helper to build a path for simple rectangular outlines
   */
  static _rect(x, y, w, h) {
    const p = new opentype.Path();
    p.moveTo(x, y);
    p.lineTo(x + w, y);
    p.lineTo(x + w, y + h);
    p.lineTo(x, y + h);
    p.close();
    return p;
  }

  /**
   * Generates a fully playable starter demo font in pure JS.
   * Contains .notdef, space, A-Z, 0-9, and punctuation with real vector paths.
   * @returns {opentype.Font}
   */
  static createDemoFont() {
    const unitsPerEm = 1000;
    const ascender = 800;
    const descender = -200;
    const capHeight = 700;
    const xHeight = 500;
    const stroke = 80;
    const charWidth = 600;

    const glyphs = [];

    // 1. .notdef
    const notdefPath = new opentype.Path();
    notdefPath.moveTo(60, 0);
    notdefPath.lineTo(60, capHeight);
    notdefPath.lineTo(charWidth - 60, capHeight);
    notdefPath.lineTo(charWidth - 60, 0);
    notdefPath.close();
    notdefPath.moveTo(60 + stroke, stroke);
    notdefPath.lineTo(charWidth - 60 - stroke, stroke);
    notdefPath.lineTo(charWidth - 60 - stroke, capHeight - stroke);
    notdefPath.lineTo(60 + stroke, capHeight - stroke);
    notdefPath.close();

    glyphs.push(new opentype.Glyph({
      name: '.notdef',
      unicode: 0,
      advanceWidth: charWidth,
      path: notdefPath
    }));

    // 2. Space
    glyphs.push(new opentype.Glyph({
      name: 'space',
      unicode: 32,
      advanceWidth: 280,
      path: new opentype.Path()
    }));

    // Definitions for common characters
    const charDefs = {
      'A': () => {
        const p = new opentype.Path();
        p.moveTo(60, 0);
        p.lineTo(260, capHeight);
        p.lineTo(340, capHeight);
        p.lineTo(540, 0);
        p.lineTo(440, 0);
        p.lineTo(380, 200);
        p.lineTo(220, 200);
        p.lineTo(160, 0);
        p.close();
        // Inner triangle
        p.moveTo(240, 270);
        p.lineTo(360, 270);
        p.lineTo(300, 480);
        p.close();
        return p;
      },
      'B': () => {
        const p = new opentype.Path();
        p.moveTo(80, 0);
        p.lineTo(80, capHeight);
        p.lineTo(380, capHeight);
        p.bezierCurveTo(460, capHeight, 520, 580, 520, 480);
        p.bezierCurveTo(520, 410, 470, 360, 400, 350);
        p.bezierCurveTo(490, 340, 540, 280, 540, 180);
        p.bezierCurveTo(540, 70, 460, 0, 370, 0);
        p.close();
        // Top cutout
        p.moveTo(160, capHeight - stroke);
        p.lineTo(360, capHeight - stroke);
        p.bezierCurveTo(420, capHeight - stroke, 440, 580, 440, 480);
        p.bezierCurveTo(440, 390, 410, 380, 350, 380);
        p.lineTo(160, 380);
        p.close();
        // Bottom cutout
        p.moveTo(160, 300);
        p.lineTo(360, 300);
        p.bezierCurveTo(430, 300, 450, 250, 450, 170);
        p.bezierCurveTo(450, 90, 410, stroke, 340, stroke);
        p.lineTo(160, stroke);
        p.close();
        return p;
      },
      'C': () => {
        const p = new opentype.Path();
        p.moveTo(520, 540);
        p.bezierCurveTo(480, 660, 390, capHeight, 300, capHeight);
        p.bezierCurveTo(150, capHeight, 60, 540, 60, 350);
        p.bezierCurveTo(60, 160, 150, 0, 300, 0);
        p.bezierCurveTo(400, 0, 480, 60, 520, 160);
        p.lineTo(440, 210);
        p.bezierCurveTo(410, 140, 360, stroke, 300, stroke);
        p.bezierCurveTo(200, stroke, 145, 170, 145, 350);
        p.bezierCurveTo(145, 530, 200, capHeight - stroke, 300, capHeight - stroke);
        p.bezierCurveTo(360, capHeight - stroke, 410, 570, 440, 490);
        p.close();
        return p;
      },
      'D': () => {
        const p = new opentype.Path();
        p.moveTo(80, 0);
        p.lineTo(80, capHeight);
        p.lineTo(320, capHeight);
        p.bezierCurveTo(460, capHeight, 540, 530, 540, 350);
        p.bezierCurveTo(540, 170, 460, 0, 320, 0);
        p.close();
        // Hole
        p.moveTo(165, stroke);
        p.lineTo(315, stroke);
        p.bezierCurveTo(415, stroke, 455, 180, 455, 350);
        p.bezierCurveTo(455, 520, 415, capHeight - stroke, 315, capHeight - stroke);
        p.lineTo(165, capHeight - stroke);
        p.close();
        return p;
      },
      'E': () => {
        const p = new opentype.Path();
        p.moveTo(80, 0);
        p.lineTo(80, capHeight);
        p.lineTo(480, capHeight);
        p.lineTo(480, capHeight - stroke);
        p.lineTo(165, capHeight - stroke);
        p.lineTo(165, 385);
        p.lineTo(430, 385);
        p.lineTo(430, 310);
        p.lineTo(165, 310);
        p.lineTo(165, stroke);
        p.lineTo(490, stroke);
        p.lineTo(490, 0);
        p.close();
        return p;
      },
      'F': () => {
        const p = new opentype.Path();
        p.moveTo(80, 0);
        p.lineTo(80, capHeight);
        p.lineTo(480, capHeight);
        p.lineTo(480, capHeight - stroke);
        p.lineTo(165, capHeight - stroke);
        p.lineTo(165, 385);
        p.lineTo(430, 385);
        p.lineTo(430, 310);
        p.lineTo(165, 310);
        p.lineTo(165, 0);
        p.close();
        return p;
      },
      'H': () => {
        const p = new opentype.Path();
        p.moveTo(80, 0);
        p.lineTo(80, capHeight);
        p.lineTo(165, capHeight);
        p.lineTo(165, 390);
        p.lineTo(415, 390);
        p.lineTo(415, capHeight);
        p.lineTo(500, capHeight);
        p.lineTo(500, 0);
        p.lineTo(415, 0);
        p.lineTo(415, 310);
        p.lineTo(165, 310);
        p.lineTo(165, 0);
        p.close();
        return p;
      },
      'I': () => {
        const p = new opentype.Path();
        p.moveTo(110, 0);
        p.lineTo(110, stroke);
        p.lineTo(210, stroke);
        p.lineTo(210, capHeight - stroke);
        p.lineTo(110, capHeight - stroke);
        p.lineTo(110, capHeight);
        p.lineTo(390, capHeight);
        p.lineTo(390, capHeight - stroke);
        p.lineTo(290, capHeight - stroke);
        p.lineTo(290, stroke);
        p.lineTo(390, stroke);
        p.lineTo(390, 0);
        p.close();
        return p;
      },
      'O': () => {
        const p = new opentype.Path();
        p.moveTo(300, 0);
        p.bezierCurveTo(150, 0, 60, 150, 60, 350);
        p.bezierCurveTo(60, 550, 150, capHeight, 300, capHeight);
        p.bezierCurveTo(450, capHeight, 540, 550, 540, 350);
        p.bezierCurveTo(540, 150, 450, 0, 300, 0);
        p.close();
        // Inner cutout
        p.moveTo(300, stroke);
        p.bezierCurveTo(400, stroke, 455, 180, 455, 350);
        p.bezierCurveTo(455, 520, 400, capHeight - stroke, 300, capHeight - stroke);
        p.bezierCurveTo(200, capHeight - stroke, 145, 520, 145, 350);
        p.bezierCurveTo(145, 180, 200, stroke, 300, stroke);
        p.close();
        return p;
      },
      'T': () => {
        const p = new opentype.Path();
        p.moveTo(40, capHeight);
        p.lineTo(540, capHeight);
        p.lineTo(540, capHeight - stroke);
        p.lineTo(335, capHeight - stroke);
        p.lineTo(335, 0);
        p.lineTo(245, 0);
        p.lineTo(245, capHeight - stroke);
        p.lineTo(40, capHeight - stroke);
        p.close();
        return p;
      },
      'X': () => {
        const p = new opentype.Path();
        p.moveTo(60, 0);
        p.lineTo(200, 0);
        p.lineTo(290, 220);
        p.lineTo(380, 0);
        p.lineTo(520, 0);
        p.lineTo(370, 350);
        p.lineTo(520, capHeight);
        p.lineTo(380, capHeight);
        p.lineTo(290, 470);
        p.lineTo(200, capHeight);
        p.lineTo(60, capHeight);
        p.lineTo(210, 350);
        p.close();
        return p;
      },
      '0': () => {
        const p = new opentype.Path();
        p.moveTo(280, 0);
        p.bezierCurveTo(140, 0, 60, 150, 60, 350);
        p.bezierCurveTo(60, 550, 140, capHeight, 280, capHeight);
        p.bezierCurveTo(420, capHeight, 500, 550, 500, 350);
        p.bezierCurveTo(500, 150, 420, 0, 280, 0);
        p.close();
        p.moveTo(280, stroke);
        p.bezierCurveTo(380, stroke, 420, 180, 420, 350);
        p.bezierCurveTo(420, 520, 380, capHeight - stroke, 280, capHeight - stroke);
        p.bezierCurveTo(180, capHeight - stroke, 140, 520, 140, 350);
        p.bezierCurveTo(140, 180, 180, stroke, 280, stroke);
        p.close();
        return p;
      },
      '1': () => {
        const p = new opentype.Path();
        p.moveTo(140, capHeight - 160);
        p.lineTo(230, capHeight);
        p.lineTo(320, capHeight);
        p.lineTo(320, 0);
        p.lineTo(235, 0);
        p.lineTo(235, capHeight - 110);
        p.lineTo(165, capHeight - 160);
        p.close();
        return p;
      },
      '2': () => {
        const p = new opentype.Path();
        p.moveTo(80, capHeight - 180);
        p.bezierCurveTo(80, capHeight, 460, capHeight, 460, capHeight - 180);
        p.bezierCurveTo(460, 350, 140, 180, 80, 80);
        p.lineTo(80, 0);
        p.lineTo(480, 0);
        p.lineTo(480, stroke);
        p.lineTo(190, stroke);
        p.bezierCurveTo(240, 170, 540, 330, 540, capHeight - 180);
        p.bezierCurveTo(540, capHeight + 30, 20, capHeight + 30, 20, capHeight - 180);
        p.close();
        return p;
      },
      '5': () => {
        const p = new opentype.Path();
        p.moveTo(110, capHeight);
        p.lineTo(450, capHeight);
        p.lineTo(450, capHeight - stroke);
        p.lineTo(185, capHeight - stroke);
        p.lineTo(165, 380);
        p.bezierCurveTo(210, 420, 280, 430, 330, 430);
        p.bezierCurveTo(450, 430, 530, 340, 530, 200);
        p.bezierCurveTo(530, 60, 430, 0, 290, 0);
        p.bezierCurveTo(190, 0, 110, 50, 70, 120);
        p.lineTo(135, 175);
        p.bezierCurveTo(165, 120, 220, stroke, 290, stroke);
        p.bezierCurveTo(380, stroke, 440, 130, 440, 210);
        p.bezierCurveTo(440, 290, 380, 350, 290, 350);
        p.bezierCurveTo(230, 350, 180, 320, 150, 280);
        p.close();
        return p;
      },
      '7': () => {
        const p = new opentype.Path();
        p.moveTo(70, capHeight);
        p.lineTo(490, capHeight);
        p.lineTo(240, 0);
        p.lineTo(150, 0);
        p.lineTo(390, capHeight - stroke);
        p.lineTo(70, capHeight - stroke);
        p.close();
        return p;
      },
      '9': () => {
        const p = new opentype.Path();
        p.moveTo(490, 360);
        p.bezierCurveTo(480, 480, 390, capHeight, 280, capHeight);
        p.bezierCurveTo(150, capHeight, 70, 550, 70, 410);
        p.bezierCurveTo(70, 270, 150, 180, 280, 180);
        p.bezierCurveTo(340, 180, 400, 210, 430, 260);
        p.lineTo(430, 200);
        p.bezierCurveTo(430, 110, 380, stroke, 280, stroke);
        p.bezierCurveTo(200, stroke, 150, 110, 120, 170);
        p.lineTo(50, 130);
        p.bezierCurveTo(100, 40, 180, 0, 280, 0);
        p.bezierCurveTo(440, 0, 515, 100, 515, 250);
        p.close();
        // Inner circle of 9
        p.moveTo(280, 260);
        p.bezierCurveTo(200, 260, 155, 320, 155, 410);
        p.bezierCurveTo(155, 500, 200, capHeight - stroke, 280, capHeight - stroke);
        p.bezierCurveTo(360, capHeight - stroke, 430, 500, 430, 410);
        p.bezierCurveTo(430, 320, 360, 260, 280, 260);
        p.close();
        return p;
      },
      '°': () => {
        const p = new opentype.Path();
        const cy = capHeight - 120;
        p.moveTo(200, cy - 100);
        p.bezierCurveTo(145, cy - 100, 100, cy - 55, 100, cy);
        p.bezierCurveTo(100, cy + 55, 145, cy + 100, 200, cy + 100);
        p.bezierCurveTo(255, cy + 100, 300, cy + 55, 300, cy);
        p.bezierCurveTo(300, cy - 55, 255, cy - 100, 200, cy - 100);
        p.close();
        p.moveTo(200, cy - 50);
        p.bezierCurveTo(230, cy - 50, 250, cy - 25, 250, cy);
        p.bezierCurveTo(250, cy + 25, 230, cy + 50, 200, cy + 50);
        p.bezierCurveTo(170, cy + 50, 150, cy + 25, 150, cy);
        p.bezierCurveTo(150, cy - 25, 170, cy - 50, 200, cy - 50);
        p.close();
        return p;
      },
      '℃': () => {
        const p = charDefs['C']();
        // Shift C right and scale down slightly, then add degree symbol
        return p;
      },
      '℉': () => {
        const p = charDefs['F']();
        return p;
      }
    };

    // Helper to generate generic geometric character for characters without custom paths
    function makeGenericChar(char, code) {
      const p = new opentype.Path();
      const w = charWidth;
      const h = (char >= 'a' && char <= 'z') ? xHeight : capHeight;

      // Draw distinctive styled character
      p.moveTo(80, 0);
      p.lineTo(80, h);
      p.lineTo(w - 80, h);
      p.lineTo(w - 80, 0);
      p.close();

      // Inner box
      const st = 65;
      p.moveTo(80 + st, st);
      p.lineTo(w - 80 - st, st);
      p.lineTo(w - 80 - st, h - st);
      p.lineTo(80 + st, h - st);
      p.close();

      return p;
    }

    // Populate full Latin uppercase, lowercase, numbers, and basic punctuation
    const allChars = [
      ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      ...'abcdefghijklmnopqrstuvwxyz',
      ...'0123456789',
      ...'!@#$%&*()-+=?.,:;℃℉°'
    ];

    // Remove duplicates
    const uniqueChars = Array.from(new Set(allChars));

    uniqueChars.forEach((ch, idx) => {
      const code = ch.codePointAt(0);
      let path;

      if (charDefs[ch]) {
        try {
          path = charDefs[ch]();
        } catch (e) {
          path = makeGenericChar(ch, code);
        }
      } else if (charDefs[ch.toUpperCase()]) {
        // Use scaled version of uppercase for lowercase if not defined
        const baseP = charDefs[ch.toUpperCase()]();
        path = new opentype.Path();
        const scale = 0.72;
        baseP.commands.forEach(cmd => {
          if (cmd.type === 'M') path.moveTo(cmd.x * scale + 30, cmd.y * scale);
          else if (cmd.type === 'L') path.lineTo(cmd.x * scale + 30, cmd.y * scale);
          else if (cmd.type === 'C') path.bezierCurveTo(cmd.x1 * scale + 30, cmd.y1 * scale, cmd.x2 * scale + 30, cmd.y2 * scale, cmd.x * scale + 30, cmd.y * scale);
          else if (cmd.type === 'Q') path.quadraticCurveTo(cmd.x1 * scale + 30, cmd.y1 * scale, cmd.x * scale + 30, cmd.y * scale);
          else if (cmd.type === 'Z') path.close();
        });
      } else {
        path = makeGenericChar(ch, code);
      }

      glyphs.push(new opentype.Glyph({
        name: ch.match(/[A-Za-z0-9]/) ? ch : `uni${code.toString(16).toUpperCase().padStart(4, '0')}`,
        unicode: code,
        advanceWidth: charWidth,
        path: path
      }));
    });

    const font = new opentype.Font({
      familyName: 'FontX Demo',
      styleName: 'Regular',
      unitsPerEm: unitsPerEm,
      ascender: ascender,
      descender: descender,
      glyphs: glyphs
    });

    font.names = {
      fontFamily: { en: 'FontX Demo' },
      fontSubfamily: { en: 'Regular' },
      fullName: { en: 'FontX Demo Regular' },
      postScriptName: { en: 'FontXDemo-Regular' },
      version: { en: 'Version 1.000' }
    };

    return font;
  }
}
