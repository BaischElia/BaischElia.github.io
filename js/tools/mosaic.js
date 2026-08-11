/* =========================================================
   tools/mosaic.js — Photo Mosaic
   ---------------------------------------------------------
   Portierung von ToolsTemplates/Photo Mosaic/
   Das Bild wird in ein Kachelraster zerlegt; je Kachel wird
   eine Farbe bestimmt. Die Methoden unterscheiden sich nur
   darin, WIE diese eine Farbe berechnet wird.
   ========================================================= */

window.TOOLS = window.TOOLS || {};

window.TOOLS['mosaic'] = function(body, title){
  title.textContent = 'Photo Mosaic';

  TL.build(body, {
    cols: 2,
    drops:  [{ id:'src', label:{de:'Bild wählen', en:'Choose an image'} }],
    fields: [
      { id:'tx', type:'range', min:4, max:160, step:1, value:48,
        label:{de:'Kacheln waagerecht', en:'Tiles across'} },
      { id:'ty', type:'range', min:3, max:120, step:1, value:36,
        label:{de:'Kacheln senkrecht', en:'Tiles down'} },
      { id:'method', type:'select', value:'mean',
        label:{de:'Methode', en:'Method'},
        options:[
          { v:'mean',     t:{de:'Mittelwert', en:'Mean colour'} },
          { v:'median',   t:{de:'Median', en:'Median colour'} },
          { v:'gaussian', t:{de:'Gauß-Weichzeichner', en:'Gaussian blur'} },
          { v:'kmeans',   t:{de:'K-Means (dominante Farbe)', en:'K-Means (dominant colour)'} },
          { v:'central',  t:{de:'Zentralpixel', en:'Central pixel'} },
          { v:'hist',     t:{de:'Histogramm-Ausgleich', en:'Histogram equalised'} },
          { v:'bilateral',t:{de:'Bilateralfilter (kantenerhaltend)', en:'Bilateral filter (edge-preserving)'} }
        ]},
      { id:'smooth', type:'check', value:false,
        label:{de:'Weich hochskalieren statt harte Kacheln', en:'Smooth upscale instead of hard tiles'} }
    ],
    views: [
      { id:'orig', label:{de:'Original', en:'Original'} },
      { id:'out',  label:{de:'Mosaik', en:'Mosaic'} }
    ],
    action: { label:{de:'Mosaik laden', en:'Download mosaic'}, view:'out', name:'mosaic.png' },

    onInput(api){
      const src = TL.pixels(api.images.src, 1100);
      TL.show(api.view('orig'), src);

      const w = src.width, h = src.height, n = w * h;
      const tx = Math.round(api.val('tx')), ty = Math.round(api.val('ty'));
      const method = api.val('method');

      // ---- 1) Optionale Vorverarbeitung des ganzen Bildes ----
      let f = TL.toFloat(src);
      if(method === 'gaussian')  f = TL.blur(f, w, h, 3, 2.0);
      if(method === 'hist')      f = equalize(f, n);
      if(method === 'bilateral') f = bilateral(f, w, h, 3.0, 40);

      // ---- 2) Je Kachel eine Farbe bestimmen ----
      const tiles = new Float32Array(tx * ty * 3);
      for(let gy = 0; gy < ty; gy++){
        const y0 = Math.floor(gy * h / ty), y1 = Math.max(y0 + 1, Math.floor((gy+1) * h / ty));
        for(let gx = 0; gx < tx; gx++){
          const x0 = Math.floor(gx * w / tx), x1 = Math.max(x0 + 1, Math.floor((gx+1) * w / tx));
          const col = tileColour(f, w, x0, y0, x1, y1, method);
          const t = (gy * tx + gx) * 3;
          tiles[t] = col[0]; tiles[t+1] = col[1]; tiles[t+2] = col[2];
        }
      }

      // ---- 3) Zurück auf Originalgröße ----
      const small = TL.toImageData(tiles, tx, ty);
      const out = api.view('out');
      out.width = w; out.height = h;
      const ctx = out.getContext('2d');
      const tmp = document.createElement('canvas');
      tmp.width = tx; tmp.height = ty;
      tmp.getContext('2d').putImageData(small, 0, 0);
      ctx.imageSmoothingEnabled = api.val('smooth');
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tmp, 0, 0, w, h);

      api.say(TL.t({
        de: `${tx} × ${ty} = ${tx*ty} Kacheln · je ${Math.round(w/tx)} × ${Math.round(h/ty)} px`,
        en: `${tx} × ${ty} = ${tx*ty} tiles · ${Math.round(w/tx)} × ${Math.round(h/ty)} px each`
      }));
    }
  });

  /* ---- Farbe einer einzelnen Kachel ---- */
  function tileColour(f, w, x0, y0, x1, y1, method){
    if(method === 'central'){
      const cx = (x0 + x1) >> 1, cy = (y0 + y1) >> 1, i = (cy*w + cx) * 3;
      return [f[i], f[i+1], f[i+2]];
    }
    if(method === 'median')  return tileMedian(f, w, x0, y0, x1, y1);
    if(method === 'kmeans')  return tileKMeans(f, w, x0, y0, x1, y1);
    // mean — und alle Varianten, die nur das Bild vorher filtern
    let r = 0, g = 0, b = 0, c = 0;
    for(let y = y0; y < y1; y++) for(let x = x0; x < x1; x++){
      const i = (y*w + x) * 3;
      r += f[i]; g += f[i+1]; b += f[i+2]; c++;
    }
    return [r/c, g/c, b/c];
  }

  /* Median je Kanal — unempfindlich gegen einzelne Ausreißer. */
  function tileMedian(f, w, x0, y0, x1, y1){
    const cnt = (x1-x0) * (y1-y0);
    const ch = [new Float32Array(cnt), new Float32Array(cnt), new Float32Array(cnt)];
    let k = 0;
    for(let y = y0; y < y1; y++) for(let x = x0; x < x1; x++, k++){
      const i = (y*w + x) * 3;
      ch[0][k] = f[i]; ch[1][k] = f[i+1]; ch[2][k] = f[i+2];
    }
    return ch.map(a => { a.sort(); return a[cnt >> 1]; });
  }

  /* K-Means mit k=3, wenige Iterationen — liefert die dominante Farbe. */
  function tileKMeans(f, w, x0, y0, x1, y1){
    const px = [];
    // Bei großen Kacheln nur eine Stichprobe nehmen, sonst wird es zäh.
    const step = Math.max(1, Math.floor(Math.sqrt((x1-x0)*(y1-y0) / 120)));
    for(let y = y0; y < y1; y += step) for(let x = x0; x < x1; x += step){
      const i = (y*w + x) * 3;
      px.push([f[i], f[i+1], f[i+2]]);
    }
    if(px.length < 3) return px[0] || [0,0,0];

    const k = 3;
    let cent = [px[0], px[(px.length/2)|0], px[px.length-1]].map(p => p.slice());
    let assign = new Uint8Array(px.length);
    for(let it = 0; it < 6; it++){
      for(let p = 0; p < px.length; p++){
        let best = 0, bd = Infinity;
        for(let c = 0; c < k; c++){
          const d = (px[p][0]-cent[c][0])**2 + (px[p][1]-cent[c][1])**2 + (px[p][2]-cent[c][2])**2;
          if(d < bd){ bd = d; best = c; }
        }
        assign[p] = best;
      }
      const sum = Array.from({length:k}, () => [0,0,0,0]);
      for(let p = 0; p < px.length; p++){
        const a = assign[p];
        sum[a][0] += px[p][0]; sum[a][1] += px[p][1]; sum[a][2] += px[p][2]; sum[a][3]++;
      }
      for(let c = 0; c < k; c++) if(sum[c][3])
        cent[c] = [sum[c][0]/sum[c][3], sum[c][1]/sum[c][3], sum[c][2]/sum[c][3]];
    }
    // größtes Cluster gewinnt
    const counts = new Array(k).fill(0);
    for(let p = 0; p < px.length; p++) counts[assign[p]]++;
    return cent[counts.indexOf(Math.max(...counts))];
  }

  /* Histogramm-Ausgleich auf der Helligkeit, Farbe bleibt erhalten. */
  function equalize(f, n){
    const hist = new Float64Array(256);
    const lum = new Float32Array(n);
    for(let i = 0; i < n; i++){
      const l = 0.299*f[i*3] + 0.587*f[i*3+1] + 0.114*f[i*3+2];
      lum[i] = l;
      hist[Math.min(255, Math.max(0, Math.round(l)))]++;
    }
    const cdf = new Float64Array(256);
    let acc = 0;
    for(let i = 0; i < 256; i++){ acc += hist[i]; cdf[i] = acc / n * 255; }
    const out = new Float32Array(f.length);
    for(let i = 0; i < n; i++){
      const l = lum[i];
      const nl = cdf[Math.min(255, Math.max(0, Math.round(l)))];
      const s = l > 1 ? nl / l : 1;                 // Farbton beibehalten
      for(let c = 0; c < 3; c++) out[i*3+c] = f[i*3+c] * s;
    }
    return out;
  }

  /* Bilateralfilter: glättet, respektiert aber Kanten.
     Läuft auf einer verkleinerten Fassung, weil er teuer ist. */
  function bilateral(f, w, h, sigmaSpace, sigmaRange){
    const r = Math.max(1, Math.round(sigmaSpace));
    const out = new Float32Array(f.length);
    const sr2 = 2 * sigmaRange * sigmaRange;
    const ss2 = 2 * sigmaSpace * sigmaSpace;
    const spatial = [];
    for(let dy = -r; dy <= r; dy++) for(let dx = -r; dx <= r; dx++)
      spatial.push(Math.exp(-(dx*dx + dy*dy) / ss2));

    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      const ci = (y*w + x) * 3;
      let wsum = 0, acc = [0,0,0], k = 0;
      for(let dy = -r; dy <= r; dy++){
        const yy = y + dy; if(yy < 0 || yy >= h){ k += 2*r+1; continue; }
        for(let dx = -r; dx <= r; dx++, k++){
          const xx = x + dx; if(xx < 0 || xx >= w) continue;
          const ni = (yy*w + xx) * 3;
          const dr = f[ni]-f[ci], dg = f[ni+1]-f[ci+1], db = f[ni+2]-f[ci+2];
          const wgt = spatial[k] * Math.exp(-(dr*dr + dg*dg + db*db) / sr2);
          acc[0] += f[ni]*wgt; acc[1] += f[ni+1]*wgt; acc[2] += f[ni+2]*wgt;
          wsum += wgt;
        }
      }
      for(let c = 0; c < 3; c++) out[ci+c] = acc[c] / wsum;
    }
    return out;
  }
};

window.TOOLS['mosaic'].doc = {
  de: `
<h4>Photo Mosaic</h4>
<p>Das Bild wird in ein Raster aus Kacheln zerlegt, und jede Kachel wird durch eine einzige Farbe ersetzt. Alle Methoden unterscheiden sich nur in einem Punkt: <strong>Wie wird diese eine Farbe bestimmt?</strong></p>

<h5>Der Bezug zur Faltung</h5>
<p>Die Mittelwert-Variante ist nichts anderes als eine Faltung. Man kann sie exakt mit einer <code>Conv2d</code>-Schicht nachbauen: Kernelgröße = Kachelgröße, Stride = Kachelgröße, und alle Gewichte auf 1/(kh·kw) gesetzt. Das Ergebnis ist ein heruntergerechnetes Bild, das anschließend wieder auf Originalgröße hochskaliert wird. Genau so macht es <code>reconstruct_mosaic.py</code> im Projekt mit PyTorch.</p>
<p>Das Mosaik von Maria von Linden, das dem Projekt zugrunde lag, verwendet ein Raster von <strong>48 × 36 Kacheln</strong> — die Voreinstellung hier.</p>

<h5>Die Methoden</h5>
<ul>
  <li><strong>Mittelwert</strong> — Durchschnitt aller Pixel der Kachel. Der klassische, blockige Mosaik-Look.</li>
  <li><strong>Median</strong> — der mittlere Wert statt des Durchschnitts. Unempfindlich gegen Ausreißer, etwa ein einzelnes helles Pixel in einer dunklen Kachel; wirkt dadurch oft repräsentativer.</li>
  <li><strong>Gauß-Weichzeichner</strong> — das Bild wird erst geglättet, dann gemittelt. Ergibt weichere Farbübergänge zwischen den Kacheln.</li>
  <li><strong>K-Means</strong> — ein Clustering-Verfahren sucht die dominanteste Farbe der Kachel statt einer Mischfarbe. Das Ergebnis wirkt kräftiger und kontrastreicher.</li>
  <li><strong>Zentralpixel</strong> — nimmt einfach die Farbe des Pixels in der Kachelmitte. Sehr schnell, kann aber je nach Bilddetail unruhig oder zufällig aussehen.</li>
  <li><strong>Histogramm-Ausgleich</strong> — der Kontrast wird zuerst gespreizt (dunkle Stellen dunkler, helle heller), dann gemittelt. Ergibt ein knalliges, sattes Mosaik.</li>
  <li><strong>Bilateralfilter</strong> — ein „intelligenter“ Weichzeichner: Er glättet Flächen, lässt Kanten aber scharf. Danach wird gemittelt. Das Ergebnis ist ruhig, behält aber die Umrisse der Objekte.</li>
</ul>

<h5>Hartes oder weiches Hochskalieren</h5>
<p>Standardmäßig werden die Kacheln hart hochskaliert (Nearest Neighbour) — das ist der typische Mosaik-Look. Mit der Option „weich hochskalieren“ wird stattdessen interpoliert, wodurch ein weicher Farbverlauf statt sichtbarer Kacheln entsteht.</p>
<p class="src">Quelle: eigenes Projekt „Mosaic Generator Web App“ (Flask, PyTorch, OpenCV, scikit-learn), hier vollständig im Browser nachgebaut.</p>`,

  en: `
<h4>Photo mosaic</h4>
<p>The image is divided into a grid of tiles, and each tile is replaced by a single colour. All methods differ in exactly one respect: <strong>how is that one colour determined?</strong></p>

<h5>The link to convolution</h5>
<p>The mean variant is simply a convolution. You can reproduce it exactly with a <code>Conv2d</code> layer: kernel size = tile size, stride = tile size, and all weights set to 1/(kh·kw). The result is a downsampled image that is then upscaled back to the original dimensions. That is precisely what <code>reconstruct_mosaic.py</code> does in the project using PyTorch.</p>
<p>The Maria von Linden mosaic the project was based on uses a grid of <strong>48 × 36 tiles</strong> — the default here.</p>

<h5>The methods</h5>
<ul>
  <li><strong>Mean</strong> — the average of all pixels in the tile. The classic blocky mosaic look.</li>
  <li><strong>Median</strong> — the middle value instead of the average. Insensitive to outliers such as a single bright pixel in a dark tile, and therefore often more representative.</li>
  <li><strong>Gaussian blur</strong> — the image is smoothed first, then averaged. Gives softer colour transitions between tiles.</li>
  <li><strong>K-Means</strong> — a clustering algorithm finds the most dominant colour of the tile instead of a mixture. The result looks more vivid and higher in contrast.</li>
  <li><strong>Central pixel</strong> — simply takes the colour of the pixel at the tile centre. Very fast, but can look noisy or random depending on image detail.</li>
  <li><strong>Histogram equalised</strong> — contrast is stretched first (darks darker, brights brighter), then averaged. Produces a punchy, vivid mosaic.</li>
  <li><strong>Bilateral filter</strong> — a “smart” blur: it smooths flat areas while keeping edges sharp. Then averaging is applied. The result is clean but respects object outlines.</li>
</ul>

<h5>Hard or smooth upscaling</h5>
<p>By default the tiles are upscaled hard (nearest neighbour) — the typical mosaic look. With the “smooth upscale” option the result is interpolated instead, producing a soft colour gradient rather than visible tiles.</p>
<p class="src">Source: my own “Mosaic Generator Web App” project (Flask, PyTorch, OpenCV, scikit-learn), rebuilt entirely in the browser.</p>`
};
