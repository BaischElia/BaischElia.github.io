/* =========================================================
   tools/_lib.js — gemeinsame Basis aller Bild-Tools
   ---------------------------------------------------------
   Muss VOR den einzelnen Tools eingebunden werden.

   Bietet:
   • TL.build(body, cfg)   → baut die komplette Tool-Oberfläche
                             (Dropzones, Parameter, Ausgaben, Button)
   • Bildhelfer            → Blur, Graustufen, Pyramiden, Faltung,
                             sRGB↔linear, Perzentil, Download
   Dadurch bleibt jedes Tool auf seinen eigentlichen Algorithmus
   beschränkt.
   ========================================================= */

window.TL = (function(){

  const de = () => (window.lang || 'de') === 'de';
  const t  = o => typeof o === 'string' ? o : (o[de() ? 'de' : 'en'] || o.de);

  /* ---------------------------------------------------------
     Oberfläche
     --------------------------------------------------------- */

  /**
   * cfg = {
   *   drops:   [{id, label}]                      Bild-Uploads
   *   fields:  [{id, type:'range'|'select'|'check'|'number', label, …}]
   *   views:   [{id, label}]                      Ausgabe-Canvases
   *   action:  {label, name}                      Download-Button
   *   onInput: fn                                 bei jeder Änderung
   * }
   */
  function build(body, cfg){
    const F = cfg.fields || [], D = cfg.drops || [], V = cfg.views || [];

    const dropHTML = D.map(d => `
      <div class="tdrop" data-drop="${d.id}">
        <input type="file" accept="image/*" hidden>
        <canvas></canvas>
        <div class="tdrop-t">
          <span class="big">${t(d.label)}</span>
          <p>${t({de:'ziehen oder klicken', en:'drop or click'})}</p>
        </div>
      </div>`).join('');

    const fieldHTML = F.map(f => {
      const lbl = t(f.label);
      if(f.type === 'select')
        return `<div class="field"><label>${lbl}</label>
          <select data-f="${f.id}">${f.options.map(o=>
            `<option value="${o.v}"${o.v===f.value?' selected':''}>${t(o.t)}</option>`).join('')}</select></div>`;
      if(f.type === 'check')
        return `<div class="field tcheck"><label>
          <input type="checkbox" data-f="${f.id}"${f.value?' checked':''}> ${lbl}</label></div>`;
      if(f.type === 'number')
        return `<div class="field"><label>${lbl}</label>
          <input type="number" data-f="${f.id}" value="${f.value}" min="${f.min}" max="${f.max}" step="${f.step||1}"></div>`;
      return `<div class="field"><label>${lbl} · <span class="mval" data-v="${f.id}">${f.value}${f.unit||''}</span></label>
        <input type="range" data-f="${f.id}" min="${f.min}" max="${f.max}" step="${f.step||1}" value="${f.value}"></div>`;
    }).join('');

    const viewHTML = V.map(v => `
      <figure class="tview" data-view="${v.id}">
        <canvas></canvas>
        ${v.label ? `<figcaption>${t(v.label)}</figcaption>` : ''}
      </figure>`).join('');

    body.innerHTML = `
      ${D.length ? `<div class="tdrops${D.length>1?' two':''}">${dropHTML}</div>` : ''}
      <div class="tpanel" style="display:${D.length?'none':'block'}">
        ${F.length ? `<div class="tfields">${fieldHTML}</div>` : ''}
        <div class="tviews${cfg.cols === 2 ? ' two' : cfg.cols === 3 ? ' three' : ''}">${viewHTML}</div>
        <p class="tnote" style="display:none"></p>
        ${cfg.action ? `<button class="mbtn" data-act>${t(cfg.action.label)}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3v13M7 11l5 5 5-5M5 21h14"/></svg></button>` : ''}
      </div>`;

    /* ---- Zustand ---- */
    const api = {
      images: {},                                    // id → HTMLImageElement
      files:  {},                                    // id → File (Originaldatei)
      panel:  body.querySelector('.tpanel'),
      note:   body.querySelector('.tnote'),
      val(id){
        const el = body.querySelector(`[data-f="${id}"]`);
        if(!el) return null;
        if(el.type === 'checkbox') return el.checked;
        if(el.tagName === 'SELECT') return el.value;
        return parseFloat(el.value);
      },
      set(id, v){
        const el = body.querySelector(`[data-f="${id}"]`);
        if(el){ el.value = v; syncLabel(id); }
      },
      view(id){ return body.querySelector(`[data-view="${id}"] canvas`); },
      viewBox(id){ return body.querySelector(`[data-view="${id}"]`); },
      say(msg){
        api.note.style.display = msg ? 'block' : 'none';
        api.note.textContent = msg || '';
      },
      ready(){ return Object.keys(api.images).length === D.length; }
    };

    function syncLabel(id){
      const out = body.querySelector(`[data-v="${id}"]`);
      const el  = body.querySelector(`[data-f="${id}"]`);
      if(out && el){
        const f = F.find(x => x.id === id);
        out.textContent = el.value + (f && f.unit ? f.unit : '');
      }
    }

    /* ---- Dropzones ---- */
    D.forEach(d => {
      const zone  = body.querySelector(`[data-drop="${d.id}"]`);
      const input = zone.querySelector('input');
      const thumb = zone.querySelector('canvas');

      const accept = file => {
        if(!file || !file.type.startsWith('image/')) return;
        readImage(file).then(img => {
          api.images[d.id] = img;
          api.files[d.id]  = file;          // Originaldatei merken (Größe, Typ, Name)
          fitInto(thumb, img, 260);
          zone.classList.add('has');
          if(api.ready()){ api.panel.style.display = 'block'; run(); }
        }).catch(() => api.say(t({de:'Bild konnte nicht gelesen werden.', en:'Could not read the image.'})));
      };

      zone.onclick = () => input.click();
      input.onchange = e => accept(e.target.files[0]);
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
      zone.addEventListener('drop', e => {
        e.preventDefault(); zone.classList.remove('drag');
        accept(e.dataTransfer.files[0]);
      });
    });

    /* ---- Parameter ---- */
    let timer, runId = 0;
    const run = () => {
      if(!api.ready()) return;
      // Nur der jüngste Lauf darf zeichnen. Das Token muss der Lauf selbst
      // festhalten (api.token gleich zu Beginn lesen) — eine gemeinsame
      // stale()-Funktion ohne Token würde von jedem neuen Lauf überschrieben
      // und alte Läufe hielten sich für aktuell.
      const mine = ++runId;
      api.token = mine;
      api.stale = tok => tok !== runId;
      body.classList.add('tbusy');
      // Kurz Luft holen, damit der Ladezustand gezeichnet wird, bevor
      // die Berechnung den Hauptthread blockiert. (setTimeout statt
      // requestAnimationFrame, damit es auch in Hintergrund-Tabs läuft.)
      setTimeout(() => {
        const fertig = () => { if(mine === runId) body.classList.remove('tbusy'); };
        const schief = err => {
          console.error(err);
          if(mine !== runId) return;
          api.say(t({de:'Berechnung fehlgeschlagen — versuch ein kleineres Bild.',
                     en:'Computation failed — try a smaller image.'}));
        };
        // Erst leeren, dann rechnen — sonst würde die Meldung des Tools
        // gleich wieder überschrieben.
        try {
          api.say('');
          const r = cfg.onInput(api);
          // Tools dürfen auch asynchron rechnen (z. B. Kodierläufe).
          if(r && typeof r.then === 'function') r.then(fertig, err => { schief(err); fertig(); });
          else fertig();
        }
        catch(err){ schief(err); fertig(); }
      }, 16);
    };
    api.run = run;

    body.querySelectorAll('[data-f]').forEach(el => {
      const ev = (el.tagName === 'SELECT' || el.type === 'checkbox') ? 'change' : 'input';
      el.addEventListener(ev, () => {
        syncLabel(el.dataset.f);
        clearTimeout(timer);
        timer = setTimeout(run, ev === 'input' ? 160 : 0);
      });
    });

    /* ---- Download ---- */
    const act = body.querySelector('[data-act]');
    if(act) act.onclick = () => {
      const c = api.view(cfg.action.view || V[V.length-1].id);
      if(c) download(c, cfg.action.name || 'result.png');
    };

    if(!D.length) run();
    return api;
  }

  /* ---------------------------------------------------------
     Bild laden / zeichnen
     --------------------------------------------------------- */

  function readImage(file){
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onerror = rej;
      r.onload = e => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = e.target.result; };
      r.readAsDataURL(file);
    });
  }

  // Zeichnet ein Bild proportional in ein Canvas (max. Kantenlänge).
  function fitInto(canvas, img, max){
    const s = Math.min(1, max / Math.max(img.width, img.height));
    canvas.width  = Math.max(1, Math.round(img.width  * s));
    canvas.height = Math.max(1, Math.round(img.height * s));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  // Bild als ImageData in Arbeitsauflösung (Performance-Deckel).
  function pixels(img, max){
    const c = document.createElement('canvas');
    fitInto(c, img, max || 1200);
    return c.getContext('2d').getImageData(0, 0, c.width, c.height);
  }

  // Zwei Bilder auf dieselbe Größe bringen (kleinstes gemeinsames Maß).
  function pixelsPair(a, b, max){
    const A = pixels(a, max), B = pixels(b, max);
    const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height);
    return [resample(A, w, h), resample(B, w, h)];
  }

  function resample(imgData, w, h){
    if(imgData.width === w && imgData.height === h) return imgData;
    const src = document.createElement('canvas');
    src.width = imgData.width; src.height = imgData.height;
    src.getContext('2d').putImageData(imgData, 0, 0);
    const dst = document.createElement('canvas');
    dst.width = w; dst.height = h;
    const c = dst.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(src, 0, 0, w, h);
    return c.getImageData(0, 0, w, h);
  }

  function show(canvas, imgData){
    canvas.width = imgData.width; canvas.height = imgData.height;
    canvas.getContext('2d').putImageData(imgData, 0, 0);
  }

  function download(canvas, name){
    const a = document.createElement('a');
    a.download = name;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  /* ---------------------------------------------------------
     Konvertierung: ImageData ↔ Float-Ebenen
     --------------------------------------------------------- */

  // ImageData → Float32Array (RGB interleaved, 0…255), Alpha getrennt.
  function toFloat(d){
    const n = d.width * d.height, f = new Float32Array(n * 3);
    for(let i = 0, j = 0; i < n; i++, j += 3){
      f[j] = d.data[i*4]; f[j+1] = d.data[i*4+1]; f[j+2] = d.data[i*4+2];
    }
    return f;
  }

  function toImageData(f, w, h){
    const d = new ImageData(w, h), n = w * h;
    for(let i = 0, j = 0; i < n; i++, j += 3){
      d.data[i*4]   = clamp8(f[j]);
      d.data[i*4+1] = clamp8(f[j+1]);
      d.data[i*4+2] = clamp8(f[j+2]);
      d.data[i*4+3] = 255;
    }
    return d;
  }

  const clamp8 = v => v < 0 ? 0 : v > 255 ? 255 : v;

  // Graustufen nach Rec.601 (wie cv2.cvtColor BGR2GRAY).
  function gray(f, n){
    const g = new Float32Array(n);
    for(let i = 0, j = 0; i < n; i++, j += 3)
      g[i] = 0.299 * f[j] + 0.587 * f[j+1] + 0.114 * f[j+2];
    return g;
  }

  /* ---------------------------------------------------------
     Gauß-Weichzeichner
     Drei Box-Durchläufe approximieren eine Gauß-Faltung sehr genau
     und laufen in O(1) je Pixel — unabhängig von Sigma.
     (nach Kutskir, "Fastest Gaussian blur")
     --------------------------------------------------------- */

  function boxSizes(sigma, n){
    const wIdeal = Math.sqrt((12 * sigma * sigma / n) + 1);
    let wl = Math.floor(wIdeal); if(wl % 2 === 0) wl--;
    const wu = wl + 2;
    const mIdeal = (12*sigma*sigma - n*wl*wl - 4*n*wl - 3*n) / (-4*wl - 4);
    const m = Math.round(mIdeal);
    const out = [];
    for(let i = 0; i < n; i++) out.push(i < m ? wl : wu);
    return out;
  }

  // Weichzeichnet ein Float-Array mit `ch` Kanälen (interleaved), in place.
  function blur(src, w, h, ch, sigma){
    if(sigma <= 0) return src;
    let a = src, b = new Float32Array(src.length);
    for(const bs of boxSizes(sigma, 3)){
      const r = (bs - 1) / 2;
      boxH(a, b, w, h, ch, r);
      boxV(b, a, w, h, ch, r);
    }
    return a;
  }

  function boxH(src, dst, w, h, ch, r){
    const iarr = 1 / (r + r + 1);
    for(let y = 0; y < h; y++){
      for(let c = 0; c < ch; c++){
        let ti = y * w, li = ti, ri = ti + r;
        const fv = src[ti*ch + c], lv = src[(ti + w - 1)*ch + c];
        let val = (r + 1) * fv;
        for(let j = 0; j < r; j++) val += src[(ti + j)*ch + c];
        for(let j = 0; j <= r; j++){ val += src[(ri++)*ch + c] - fv;            dst[(ti++)*ch + c] = val * iarr; }
        for(let j = r+1; j < w-r; j++){ val += src[(ri++)*ch + c] - src[(li++)*ch + c]; dst[(ti++)*ch + c] = val * iarr; }
        for(let j = w-r; j < w; j++){ val += lv - src[(li++)*ch + c];           dst[(ti++)*ch + c] = val * iarr; }
      }
    }
  }

  function boxV(src, dst, w, h, ch, r){
    const iarr = 1 / (r + r + 1);
    for(let x = 0; x < w; x++){
      for(let c = 0; c < ch; c++){
        let ti = x, li = ti, ri = ti + r*w;
        const fv = src[ti*ch + c], lv = src[(ti + w*(h-1))*ch + c];
        let val = (r + 1) * fv;
        for(let j = 0; j < r; j++) val += src[(ti + j*w)*ch + c];
        for(let j = 0; j <= r; j++){ val += src[ri*ch + c] - fv;              dst[ti*ch + c] = val * iarr; ri += w; ti += w; }
        for(let j = r+1; j < h-r; j++){ val += src[ri*ch + c] - src[li*ch + c]; dst[ti*ch + c] = val * iarr; li += w; ri += w; ti += w; }
        for(let j = h-r; j < h; j++){ val += lv - src[li*ch + c];              dst[ti*ch + c] = val * iarr; li += w; ti += w; }
      }
    }
  }

  /* ---------------------------------------------------------
     Gauß-/Laplace-Pyramide (5-Tap-Kern [1,4,6,4,1])
     --------------------------------------------------------- */

  const K5 = [1/16, 4/16, 6/16, 4/16, 1/16];

  function sep5(src, w, h, ch, scale){
    const k = K5.map(v => v * (scale || 1));
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    const cl = (v, m) => v < 0 ? 0 : v >= m ? m-1 : v;
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) for(let c = 0; c < ch; c++){
      let s = 0;
      for(let i = -2; i <= 2; i++) s += k[i+2] * src[(y*w + cl(x+i, w))*ch + c];
      tmp[(y*w + x)*ch + c] = s;
    }
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) for(let c = 0; c < ch; c++){
      let s = 0;
      for(let i = -2; i <= 2; i++) s += k[i+2] * tmp[(cl(y+i, h)*w + x)*ch + c];
      out[(y*w + x)*ch + c] = s;
    }
    return out;
  }

  function reduce(src, w, h, ch){
    const sm = sep5(src, w, h, ch);
    const nw = Math.max(1, Math.ceil(w/2)), nh = Math.max(1, Math.ceil(h/2));
    const out = new Float32Array(nw * nh * ch);
    for(let y = 0; y < nh; y++) for(let x = 0; x < nw; x++) for(let c = 0; c < ch; c++)
      out[(y*nw + x)*ch + c] = sm[((y*2)*w + x*2)*ch + c];
    return { data: out, w: nw, h: nh };
  }

  function expand(src, sw, sh, ch, w, h){
    const up = new Float32Array(w * h * ch);
    for(let y = 0; y < sh; y++) for(let x = 0; x < sw; x++){
      const ty = y*2, tx = x*2;
      if(ty < h && tx < w) for(let c = 0; c < ch; c++)
        up[(ty*w + tx)*ch + c] = src[(y*sw + x)*ch + c];
    }
    // Nur jedes 4. Pixel ist belegt, also muss die Energie ×4 ausgeglichen
    // werden. sep5 wendet den Faktor je Achse an → 2 · 2 = 4.
    return sep5(up, w, h, ch, 2);
  }

  /* ---------------------------------------------------------
     3×3-Faltung auf einem Graukanal
     --------------------------------------------------------- */

  function conv3(g, w, h, k){
    const out = new Float32Array(w * h);
    const cl = (v, m) => v < 0 ? 0 : v >= m ? m-1 : v;
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      let s = 0, i = 0;
      for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++, i++)
        s += k[i] * g[cl(y+dy, h)*w + cl(x+dx, w)];
      out[y*w + x] = s;
    }
    return out;
  }

  const KERNELS = {
    sobelX:  [-1,0,1, -2,0,2, -1,0,1],
    sobelY:  [-1,-2,-1, 0,0,0, 1,2,1],
    scharrX: [-3,0,3, -10,0,10, -3,0,3],
    scharrY: [-3,-10,-3, 0,0,0, 3,10,3],
    laplace: [0,1,0, 1,-4,1, 0,1,0]
  };

  // Betrag zweier Ableitungen, auf 0…1 normiert (wie im Python-Projekt).
  function magnitude(gx, gy){
    const n = gx.length, m = new Float32Array(n);
    let lo = Infinity, hi = -Infinity;
    for(let i = 0; i < n; i++){
      const v = gy ? Math.hypot(gx[i], gy[i]) : Math.abs(gx[i]);
      m[i] = v; if(v < lo) lo = v; if(v > hi) hi = v;
    }
    const sp = (hi - lo) || 1e-12;
    for(let i = 0; i < n; i++) m[i] = (m[i] - lo) / sp;
    return m;
  }

  // Normierte Graukarte (0…1) als ImageData darstellen.
  function mapToImageData(m, w, h){
    const d = new ImageData(w, h);
    for(let i = 0; i < m.length; i++){
      const v = clamp8(m[i] * 255);
      d.data[i*4] = d.data[i*4+1] = d.data[i*4+2] = v;
      d.data[i*4+3] = 255;
    }
    return d;
  }

  /* ---------------------------------------------------------
     Farb-/Statistikhelfer
     --------------------------------------------------------- */

  // sRGB → linear und zurück (LUT für 0…255 bzw. Funktion für Floats).
  const S2L = new Float32Array(256);
  for(let i = 0; i < 256; i++){
    const v = i / 255;
    S2L[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  const lin2srgb = v => {
    const s = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1/2.4) - 0.055;
    return s < 0 ? 0 : s > 1 ? 1 : s;
  };

  // Perzentil eines Float-Arrays (lineare Interpolation, wie np.percentile).
  function percentile(arr, p){
    const s = Float32Array.from(arr).sort();
    const idx = (s.length - 1) * p / 100;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
  }

  function stats(arr){
    let sum = 0, n = arr.length;
    for(let i = 0; i < n; i++) sum += arr[i];
    const mean = sum / n;
    let v = 0;
    for(let i = 0; i < n; i++){ const d = arr[i] - mean; v += d*d; }
    return { mean, std: Math.sqrt(v / n) };
  }

  return { t, de, build, readImage, fitInto, pixels, pixelsPair, resample, show, download,
           toFloat, toImageData, gray, blur, reduce, expand, sep5, conv3, KERNELS,
           magnitude, mapToImageData, S2L, lin2srgb, percentile, stats, clamp8 };
})();
