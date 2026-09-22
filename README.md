# FontX — Professional Web-Based TTF/OTF Font Editor 🔤

**FontX** is a modern, client-side browser-based vector font editor and studio. It allows font designers, typographers, and web developers to create, inspect, edit glyphs, adjust metrics, configure kerning pairs, validate font tables, and export compliant TrueType (`.ttf`) and OpenType (`.otf`) fonts directly in the browser.

---

## ✨ Key Features

- **100% Client-Side**: Runs directly in modern browsers (Chrome, Edge, Firefox, Safari) with zero external backend required.
- **✨ Instant Demo Font**: Test the editor with 1 click using the built-in procedural demo font generator.
- **➕ Create Blank Fonts**: Start designing new fonts from scratch with customizable unitsPerEm, ascender, and descender.
- **✏️ Vector Glyph Editor**: Canvas-based bezier curve editor with on-curve & off-curve control points, contour manipulation, pen tool, selection, pan, and zoom.
- **🗺️ Character Map**: Inspect Unicode blocks (Basic Latin, Latin-1, Cyrillic, Greek, Arabic, Bengali/Bangla, Devanagari, Math, etc.).
- **⇔ Kerning Editor**: View and fine-tune kerning pairs and metrics.
- **📋 Live Preview Panel**: Test your custom font in real-time at multiple point sizes with custom sample text.
- **✅ Font Diagnostics & Validation**: Automated validation for naming records, missing glyphs, bounding boxes, and metrics.
- **🌐 Web Font Export & CSS Generator**: Exports standard `.ttf` and `.otf` font files with ready-to-use `@font-face` CSS snippets.
- **📱 PWA & Offline Support**: Installable Progressive Web App with Service Worker caching for complete offline operation.
- **🌓 Multi-Theme Support**: Dark, Night (warm amber), and Light modes.

---

## 🚀 Quick Start / Running Locally

### Option 1: Using Python (Zero-dependency)
```bash
python dev_server.py
```
This starts the local server at `http://127.0.0.1:8080/index.html` and automatically opens your browser.

### Option 2: Using Node / npx
```bash
npm start
# or: npx serve .
```

### Option 3: Direct Static Hosting
You can deploy this folder directly to any static web hosting platform:
- **GitHub Pages**
- **Vercel**
- **Netlify**
- **Cloudflare Pages**

---

## 📂 Project Architecture

```
Font Exc/
├── index.html                   # Main application UI & layout
├── manifest.json                # PWA Web App Manifest
├── sw.js                        # Service Worker for offline capability
├── package.json                 # npm scripts
├── dev_server.py                # Zero-dependency local development server
├── assets/
│   ├── css/
│   │   └── styles.css           # Modern design system (Dark, Night, Light themes)
│   ├── js/
│   │   ├── app.js               # Application controller & state management
│   │   ├── font-factory.js      # Procedural demo font generator & blank font creator
│   │   ├── glyph-editor.js      # Canvas bezier curve and glyph outline editor
│   │   ├── kerning-editor.js    # Kerning pairs extractor and modifier
│   │   ├── font-validator.js    # Automated font spec and table diagnostics
│   │   └── opentype.min.js      # OpenType/TrueType parsing & writing library
│   └── image/
│       ├── font-logo.png        # Application logo
│       ├── font-logo.ico        # Favicon
│       └── splash.png           # Splash graphic
└── README.md                    # Project documentation
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + O` | Open Font File |
| `Ctrl + N` | Create New Font |
| `Ctrl + S` | Save / Export Font |
| `Ctrl + Z` | Undo Glyph Edit |
| `Ctrl + Y` | Redo Glyph Edit |
| `V` | Select Tool |
| `H` | Hand / Pan Tool |
| `P` | Pen Tool |

---

## 📜 License & Credits

- Developed by **Subhajit Roy (Bubun)**.
- Powered by [opentype.js](https://opentype.js.org/).
