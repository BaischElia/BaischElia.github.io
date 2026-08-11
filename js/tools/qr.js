/* =========================================================
   tools/qr.js — QR-Poster Generator
   ---------------------------------------------------------
   Browser-Portierung von QRCodeGenerator.py:
   runde Module mit Farbverlauf-Hintergrund, abgerundete Karte
   mit Glow, Titel, Untertitel und Badge.

   Registriert sich als window.TOOLS['qr']
   Benötigt: qrcode-generator (in index.html per CDN eingebunden)
   ========================================================= */

window.TOOLS = window.TOOLS || {};

/* ---- Themes (identisch zum Python-Skript) ---- */
const QR_THEMES = {
  aurora: { bg1:'#121637', bg2:'#481860', qrEdge:'#8a4fff', card:'#ffffff', text:'#141830', accent:'#7c5cff' },
  neon:   { bg1:'#080a14', bg2:'#140828', qrEdge:'#00a8ff', card:'#101222', text:'#ebf0ff', accent:'#00ffb3' },
  sunset: { bg1:'#280e28', bg2:'#78203c', qrEdge:'#ff4a6e', card:'#fffcf8', text:'#301420', accent:'#ff5c74' },
  mono:   { bg1:'#1e1e22', bg2:'#3c3c42', qrEdge:'#5a5a62', card:'#ffffff', text:'#18181c', accent:'#28282e' },
  mint:   { bg1:'#06302c', bg2:'#0e5c4e', qrEdge:'#40c49c', card:'#f8fffc', text:'#0a2822', accent:'#1eaa82' },
  candy:  { bg1:'#2c1446', bg2:'#782882', qrEdge:'#7878ff', card:'#ffffff', text:'#28143c', accent:'#d250be' }
};

window.TOOLS['qr'] = function(body, title){
  const de = window.isDE();
  title.textContent = de ? 'QR-Poster Generator' : 'QR poster generator';

  body.innerHTML = `
    <div class="field">
      <label>${de ? 'Inhalt — URL oder Text' : 'Content — URL or text'}</label>
      <input type="text" id="qT" value="https://baischelia.github.io">
    </div>
    <div class="grid2">
      <div class="field"><label>${de ? 'Titel' : 'Title'}</label>
        <input type="text" id="qTitle" value="SCAN ME"></div>
      <div class="field"><label>${de ? 'Untertitel' : 'Subtitle'}</label>
        <input type="text" id="qSub" value="${de ? 'Jetzt Portfolio öffnen' : 'Open the portfolio'}"></div>
    </div>
    <div class="field">
      <label>${de ? 'Badge unter dem Code — leer = automatisch' : 'Badge below the code — empty = automatic'}</label>
      <input type="text" id="qBadge" placeholder="${de ? 'automatisch' : 'automatic'}">
    </div>
    <div class="grid2">
      <div class="field"><label>Theme</label>
        <select id="qTheme">
          ${Object.keys(QR_THEMES).map(t=>`<option value="${t}">${t}</option>`).join('')}
        </select></div>
      <div class="field"><label>${de ? 'Fehlerkorrektur' : 'Error correction'}</label>
        <select id="qEc">
          <option value="L">L — ${de ? 'niedrig' : 'low'}</option>
          <option value="M">M</option>
          <option value="Q">Q</option>
          <option value="H" selected>H — ${de ? 'hoch' : 'high'}</option>
        </select></div>
    </div>
    <div class="out">
      <canvas id="qCanvas" width="1080" height="1350" style="max-width:100%;border-radius:12px"></canvas>
      <p id="qErr" style="display:none;font-size:13px;color:var(--accent);text-align:center"></p>
      <button class="mbtn" id="qDl">${de ? 'Poster herunterladen' : 'Download poster'}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3v13M7 11l5 5 5-5M5 21h14"/></svg></button>
    </div>`;

  const el = id => document.getElementById(id);
  const canvas = el('qCanvas'), ctx = canvas.getContext('2d');
  const err = el('qErr'), dl = el('qDl');

  if(typeof qrcode === 'undefined'){
    err.style.display = 'block';
    err.textContent = de ? 'QR-Bibliothek konnte nicht geladen werden.' : 'QR library failed to load.';
    canvas.style.display = 'none';
    dl.style.display = 'none';
    return;
  }

  /* ---------- Hilfsfunktionen ---------- */

  // Pfad eines Rechtecks mit einzeln einstellbaren Eckradien.
  function roundPath(c, x, y, w, h, r){
    const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
    c.beginPath();
    c.moveTo(x + tl, y);
    c.lineTo(x + w - tr, y);        c.arcTo(x + w, y, x + w, y + tr, tr);
    c.lineTo(x + w, y + h - br);    c.arcTo(x + w, y + h, x + w - br, y + h, br);
    c.lineTo(x + bl, y + h);        c.arcTo(x, y + h, x, y + h - bl, bl);
    c.lineTo(x, y + tl);            c.arcTo(x, y, x + tl, y, tl);
    c.closePath();
  }

  // Bricht Text um; zu lange Einzelwörter werden hart getrennt.
  function wrapLines(c, text, maxW){
    const lines = [];
    for(const word of text.split(/\s+/).filter(Boolean)){
      let chunks = [word];
      if(c.measureText(word).width > maxW){
        chunks = []; let cur = '';
        for(const ch of word){
          if(c.measureText(cur + ch).width <= maxW) cur += ch;
          else { chunks.push(cur); cur = ch; }
        }
        chunks.push(cur);
      }
      for(const chunk of chunks){
        if(lines.length && c.measureText(lines[lines.length-1] + ' ' + chunk).width <= maxW)
          lines[lines.length-1] += ' ' + chunk;
        else lines.push(chunk);
      }
    }
    return lines;
  }

  // Größte Schriftgröße suchen, bei der der Text in maxLines Zeilen passt.
  function fitText(c, text, maxW, maxLines, startSize, minSize, weight){
    if(!text.trim()) return null;
    for(let size = startSize; size >= minSize; size -= 3){
      c.font = `${weight} ${size}px Roboto, system-ui, sans-serif`;
      const lines = wrapLines(c, text, maxW);
      if(lines.length <= maxLines) return { size, weight, lines };
    }
    c.font = `${weight} ${minSize}px Roboto, system-ui, sans-serif`;
    const lines = wrapLines(c, text, maxW).slice(0, maxLines);
    if(lines.length){
      let last = lines[lines.length-1];
      while(last && c.measureText(last + '…').width > maxW) last = last.slice(0, -1);
      lines[lines.length-1] = last + '…';
    }
    return { size: minSize, weight, lines };
  }

  const lineH = block => Math.round(block.size * 1.28);
  const blockH = block => block ? block.lines.length * lineH(block) : 0;

  function drawBlock(c, block, cx, y, color){
    if(!block) return y;
    c.font = `${block.weight} ${block.size}px Roboto, system-ui, sans-serif`;
    c.fillStyle = color;
    c.textAlign = 'center';
    c.textBaseline = 'top';
    for(const line of block.lines){ c.fillText(line, cx, y); y += lineH(block); }
    return y;
  }

  // Umlaute & Co. korrekt als UTF-8 kodieren (sonst werden sie verstümmelt).
  if(qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8'])
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

  // Modul-Matrix aus der QR-Bibliothek holen. 0 = Version automatisch wählen.
  function qrMatrix(text, ecName){
    const qr = qrcode(0, ecName);
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const m = [];
    for(let r = 0; r < n; r++){
      m.push([]);
      for(let col = 0; col < n; col++) m[r].push(qr.isDark(r, col));
    }
    return m;
  }

  // QR mit runden Modulen zeichnen — Ecken werden nur dort gerundet,
  // wo kein Nachbarmodul anschließt (wie RoundedModuleDrawer in Python).
  function drawQR(c, matrix, x, y, size){
    const border = 1;                        // Ruhezone in Modulen
    const n = matrix.length;
    const box = size / (n + border * 2);
    c.fillStyle = '#ffffff';
    c.fillRect(x, y, size, size);
    c.fillStyle = '#000000';
    const dark = (r, col) => r >= 0 && col >= 0 && r < n && col < n && matrix[r][col];
    const R = box / 2;
    for(let r = 0; r < n; r++){
      for(let col = 0; col < n; col++){
        if(!dark(r, col)) continue;
        const up = dark(r-1, col), down = dark(r+1, col);
        const left = dark(r, col-1), right = dark(r, col+1);
        roundPath(c,
          x + (col + border) * box, y + (r + border) * box, box, box,
          [ (!up && !left) ? R : 0, (!up && !right) ? R : 0,
            (!down && !right) ? R : 0, (!down && !left) ? R : 0 ]);
        c.fill();
      }
    }
  }

  function badgeLabel(data, custom){
    if(custom.trim()) return custom.trim();
    if(/^https?:\/\//i.test(data))
      return data.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    const flat = data.replace(/\s+/g, ' ').trim();
    return flat.length <= 42 ? flat : flat.slice(0, 41) + '…';
  }

  /* ---------- Poster zeichnen ---------- */

  function render(){
    const raw = el('qT').value.trim() || ' ';
    const theme = QR_THEMES[el('qTheme').value];
    const W = canvas.width, H = canvas.height;
    const pad = 90, cardW = W - pad * 2, innerW = cardW - 110;

    let matrix;
    try { matrix = qrMatrix(raw, el('qEc').value); }
    catch(e){
      err.style.display = 'block';
      err.textContent = de
        ? 'Inhalt zu lang für einen QR-Code — kürze ihn oder wähle Fehlerkorrektur L.'
        : 'Content too long for a QR code — shorten it or pick error correction L.';
      return;
    }
    err.style.display = 'none';

    // Textblöcke vorab setzen, damit die Kartenhöhe stimmt.
    const tBlock = fitText(ctx, el('qTitle').value, innerW, 3, 66, 34, 700);
    const sBlock = fitText(ctx, el('qSub').value, innerW, 2, 34, 22, 400);
    const label  = badgeLabel(raw, el('qBadge').value);

    let badgeFont = 30, badgeW = 0;
    if(label){
      do {
        ctx.font = `700 ${badgeFont}px Roboto, system-ui, sans-serif`;
        badgeW = ctx.measureText(label).width + 72;
        if(badgeW <= innerW) break;
        badgeFont -= 2;
      } while(badgeFont > 18);
    }
    const badgeH = label ? badgeFont + 40 : 0;

    const qrSize = cardW - 200;
    const padTop = 60, gapTitleSub = 10, gapBeforeQR = 44, gapAfterQR = 40, padBottom = 56;
    const headH = padTop + blockH(tBlock)
                + ((tBlock && sBlock) ? gapTitleSub : 0) + blockH(sBlock);
    const cardH = headH + gapBeforeQR + qrSize
                + (label ? gapAfterQR + badgeH : 0) + padBottom;
    const cardX = pad, cardY = Math.max((H - cardH) / 2, 40);

    // Hintergrund-Verlauf.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, theme.bg1); g.addColorStop(1, theme.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Weicher Glow hinter der Karte.
    ctx.save();
    if('filter' in ctx) ctx.filter = 'blur(45px)';
    ctx.globalAlpha = 0.51;
    ctx.fillStyle = theme.qrEdge;
    roundPath(ctx, cardX - 6, cardY + 26, cardW + 12, cardH + 8, 60);
    ctx.fill();
    ctx.restore();

    // Karte.
    ctx.fillStyle = theme.card;
    roundPath(ctx, cardX, cardY, cardW, cardH, 56);
    ctx.fill();

    // Titel + Untertitel.
    const cx = W / 2;
    let y = cardY + padTop;
    if(tBlock) y = drawBlock(ctx, tBlock, cx, y, theme.text);
    if(sBlock){ if(tBlock) y += gapTitleSub; drawBlock(ctx, sBlock, cx, y, theme.accent); }

    // QR-Code.
    const qrX = cardX + (cardW - qrSize) / 2;
    const qrY = cardY + headH + gapBeforeQR;
    drawQR(ctx, matrix, qrX, qrY, qrSize);

    // Badge.
    if(label){
      const bw = badgeW, bh = badgeH;
      const bx = cx - bw / 2, by = qrY + qrSize + gapAfterQR;
      ctx.fillStyle = theme.accent;
      roundPath(ctx, bx, by, bw, bh, bh / 2);
      ctx.fill();
      ctx.font = `700 ${badgeFont}px Roboto, system-ui, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, by + bh / 2 + 1);
    }
  }

  /* ---------- Verdrahtung ---------- */
  let t;
  const schedule = () => { clearTimeout(t); t = setTimeout(render, 120); };
  ['qT','qTitle','qSub','qBadge'].forEach(id => el(id).oninput = schedule);
  ['qTheme','qEc'].forEach(id => el(id).onchange = render);

  dl.onclick = () => {
    const a = document.createElement('a');
    a.download = 'qr-poster.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  // Erst zeichnen, wenn Roboto geladen ist — sonst stimmen die Textmaße nicht.
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(render);
  else render();
};
