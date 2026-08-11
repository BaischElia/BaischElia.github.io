/* =========================================================
   tools/fusion.js — Laplacian Pyramid Fusion
   ---------------------------------------------------------
   Portierung von ToolsTemplates/Laplacian Fusion/laplacian_fusion*.py
   Multi-Band-Blending: beide Bilder werden in Frequenzbänder
   zerlegt, bandweise mit der Maske gemischt und wieder
   zusammengesetzt — dadurch entstehen keine sichtbaren Nähte.
   ========================================================= */

window.TOOLS = window.TOOLS || {};

window.TOOLS['fusion'] = function(body, title){
  title.textContent = TL.t({de:'Laplacian Fusion', en:'Laplacian fusion'});

  TL.build(body, {
    cols: 3,
    drops: [
      { id:'a', label:{de:'Bild A', en:'Image A'} },
      { id:'b', label:{de:'Bild B', en:'Image B'} }
    ],
    fields: [
      { id:'levels', type:'range', min:1, max:7, step:1, value:5,
        label:{de:'Pyramiden-Ebenen', en:'Pyramid levels'} },
      { id:'dir', type:'select', value:'vertical',
        label:{de:'Richtung der Naht', en:'Seam direction'},
        options:[
          { v:'vertical',   t:{de:'senkrecht (links | rechts)', en:'vertical (left | right)'} },
          { v:'horizontal', t:{de:'waagerecht (oben | unten)',  en:'horizontal (top | bottom)'} }
        ]},
      { id:'split', type:'range', min:0.05, max:0.95, step:0.01, value:0.5,
        label:{de:'Position der Naht', en:'Seam position'} },
      { id:'soft', type:'range', min:0.02, max:0.9, step:0.01, value:0.25,
        label:{de:'Weichheit des Übergangs', en:'Transition softness'} }
    ],
    views: [
      { id:'naive', label:{de:'Einfaches Überblenden', en:'Naive alpha blend'} },
      { id:'mask',  label:{de:'Gewichtsmaske', en:'Weight mask'} },
      { id:'out',   label:{de:'Laplacian-Fusion', en:'Laplacian fusion'} }
    ],
    action: { label:{de:'Fusion laden', en:'Download fusion'}, view:'out', name:'fusion.png' },

    onInput(api){
      const [A, B] = TL.pixelsPair(api.images.a, api.images.b, 900);
      const w = A.width, h = A.height, n = w * h;
      const fa = TL.toFloat(A), fb = TL.toFloat(B);

      // ---- Gewichtsmaske: weicher Verlauf quer über das Bild ----
      const mask = buildMask(w, h, api.val('dir'), api.val('split'), api.val('soft'));

      // Maske sichtbar machen
      const mView = new Float32Array(n * 3);
      for(let i = 0; i < n; i++) mView[i*3] = mView[i*3+1] = mView[i*3+2] = mask[i] * 255;
      TL.show(api.view('mask'), TL.toImageData(mView, w, h));

      // ---- Zum Vergleich: naives Überblenden in einem Rutsch ----
      const naive = new Float32Array(n * 3);
      for(let i = 0; i < n; i++){
        const m = mask[i];
        for(let c = 0; c < 3; c++) naive[i*3+c] = m * fa[i*3+c] + (1-m) * fb[i*3+c];
      }
      TL.show(api.view('naive'), TL.toImageData(naive, w, h));

      // ---- Multi-Band-Blending ----
      const levels = Math.min(api.val('levels'), maxLevels(w, h));
      const la = laplacianPyramid(fa, w, h, 3, levels);
      const lb = laplacianPyramid(fb, w, h, 3, levels);
      const gm = gaussianPyramid(mask, w, h, 1, levels);

      // Jede Ebene einzeln mit der passend skalierten Maske mischen
      const blended = la.map((lvl, i) => {
        const out = new Float32Array(lvl.data.length);
        const m = gm[i].data;
        for(let p = 0; p < gm[i].w * gm[i].h; p++){
          const mv = m[p];
          for(let c = 0; c < 3; c++)
            out[p*3+c] = mv * lvl.data[p*3+c] + (1-mv) * lb[i].data[p*3+c];
        }
        return { data: out, w: lvl.w, h: lvl.h };
      });

      TL.show(api.view('out'), TL.toImageData(collapse(blended, 3), w, h));

      api.say(TL.t({
        de: `${levels} Ebenen · Arbeitsauflösung ${w} × ${h} px. Vergleich: links das naive Überblenden mit sichtbarer Naht.`,
        en: `${levels} levels · working resolution ${w} × ${h} px. Compare: the naive blend on the left still shows a seam.`
      }));
    }
  });

  /* ---- Maske: linearer Rampenverlauf, wie generate_weight_mask() ---- */
  function buildMask(w, h, dir, split, soft){
    const m = new Float32Array(w * h);
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      const t = dir === 'vertical' ? x / (w - 1 || 1) : y / (h - 1 || 1);
      let v = (t - split + soft/2) / soft;
      m[y*w + x] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
    return m;
  }

  const maxLevels = (w, h) => Math.max(1, Math.floor(Math.log2(Math.min(w, h))) - 2);

  /* ---- Gauß-Pyramide: wiederholtes Glätten + Halbieren (REDUCE) ---- */
  function gaussianPyramid(data, w, h, ch, levels){
    const p = [{ data, w, h }];
    for(let i = 1; i <= levels; i++){
      const prev = p[i-1];
      p.push(TL.reduce(prev.data, prev.w, prev.h, ch));
    }
    return p;
  }

  /* ---- Laplace-Pyramide: L_i = G_i − EXPAND(G_i+1) ---- */
  function laplacianPyramid(data, w, h, ch, levels){
    const g = gaussianPyramid(data, w, h, ch, levels);
    const l = [];
    for(let i = 0; i < levels; i++){
      const up = TL.expand(g[i+1].data, g[i+1].w, g[i+1].h, ch, g[i].w, g[i].h);
      const d = new Float32Array(g[i].data.length);
      for(let k = 0; k < d.length; k++) d[k] = g[i].data[k] - up[k];
      l.push({ data: d, w: g[i].w, h: g[i].h });
    }
    l.push(g[levels]);           // gröbste Ebene bleibt Gauß
    return l;
  }

  /* ---- Rekonstruktion: G_i = L_i + EXPAND(G_i+1) ---- */
  function collapse(pyr, ch){
    let cur = pyr[pyr.length - 1];
    for(let i = pyr.length - 2; i >= 0; i--){
      const up = TL.expand(cur.data, cur.w, cur.h, ch, pyr[i].w, pyr[i].h);
      const d = new Float32Array(pyr[i].data.length);
      for(let k = 0; k < d.length; k++) d[k] = pyr[i].data[k] + up[k];
      cur = { data: d, w: pyr[i].w, h: pyr[i].h };
    }
    return cur.data;
  }
};

window.TOOLS['fusion'].doc = {
  de: `
<h4>Bildfusion mit Laplace-Pyramiden</h4>
<p>Zwei Bilder einfach mit einem weichen Verlauf übereinanderzublenden funktioniert selten gut: Entweder bleibt eine sichtbare Naht, oder der Übergang wird so breit, dass beide Bilder geisterhaft durchscheinen. Multi-Band-Blending löst genau dieses Problem.</p>

<h5>Warum einfaches Überblenden scheitert</h5>
<p>Grobe Strukturen (Helligkeit, Farbverlauf) brauchen einen <em>breiten</em> Übergang, damit man keine Kante sieht. Feine Details (Textur, Kanten) brauchen einen <em>schmalen</em> Übergang, damit sie nicht doppelt erscheinen. Ein einzelner Verlauf kann nicht beides gleichzeitig sein.</p>

<h5>Die Lösung: jede Frequenz bekommt ihren eigenen Übergang</h5>
<ul>
  <li><strong>Gauß-Pyramide:</strong> Beide Bilder und die Maske werden mehrfach geglättet und halbiert (REDUCE).</li>
  <li><strong>Laplace-Pyramide:</strong> Aus jeder Ebene wird die vergrößerte nächstgröbere abgezogen. Übrig bleibt genau ein Frequenzband.</li>
  <li><strong>Bandweises Mischen:</strong> Jedes Band wird mit der passend skalierten Maske gemischt.</li>
  <li><strong>Rekonstruktion:</strong> Die Bänder werden wieder aufsummiert.</li>
</ul>
<div class="fx">L_i = G_i − EXPAND(G_i+1)</div>
<div class="fx">L_fused_i = M_i · L_A_i + (1 − M_i) · L_B_i</div>
<div class="fx">G_i = L_i + EXPAND(G_i+1)</div>
<p>Weil die Maske auf jeder Ebene mitverkleinert wird, ist ihr Übergang relativ zum Bildinhalt auf groben Ebenen breit und auf feinen Ebenen schmal — automatisch genau das, was man braucht.</p>

<h5>Die Regler</h5>
<ul>
  <li><strong>Ebenen:</strong> Wie viele Frequenzbänder getrennt werden. Mehr Ebenen = weicherer Übergang bei den groben Strukturen.</li>
  <li><strong>Position der Naht:</strong> Wo der Wechsel zwischen A und B liegt.</li>
  <li><strong>Weichheit:</strong> Breite der Rampe in der Basismaske.</li>
</ul>
<p>Zum Vergleich zeigt das Tool links immer auch das <strong>naive Überblenden</strong> mit derselben Maske — der Unterschied ist meist sofort sichtbar.</p>

<h5>Einsatzgebiete</h5>
<ul>
  <li>Panorama-Stitching (Übergang zwischen überlappenden Fotos)</li>
  <li>Belichtungsfusion (dunkle und helle Aufnahme derselben Szene)</li>
  <li>Himmel-Austausch in Landschaftsbildern</li>
  <li>Innen- und Außenaufnahme über einen Fensterbereich verbinden</li>
</ul>

<h5>Grenzen</h5>
<ul>
  <li>Die Blickwinkel sollten ähnlich sein — sonst braucht es vorher eine Ausrichtung (im Python-Projekt über ORB-Merkmale, Brute-Force-Matching und Homographie mit RANSAC).</li>
  <li>Objekte, die sich zwischen den Aufnahmen bewegt haben, erzeugen Artefakte.</li>
  <li>Die Qualität der Maske bestimmt maßgeblich das Ergebnis.</li>
  <li>Es ist kein vollständiges Panorama-System: keine Bündelausgleichung, keine Belichtungskorrektur, keine sphärische Projektion.</li>
</ul>
<p class="src">Quelle: eigenes Projekt „Image Fusion using Laplacian Pyramids“ (NumPy + OpenCV). Die Browser-Fassung nutzt die geometrische Basismaske; die kanten- und salienzbasierte Maskenverfeinerung aus <code>laplacian_fusion_max.py</code> ist hier nicht enthalten.</p>`,

  en: `
<h4>Image fusion with Laplacian pyramids</h4>
<p>Simply cross-fading two images with a soft gradient rarely works well: either a visible seam remains, or the transition gets so wide that both images ghost through. Multi-band blending solves exactly this.</p>

<h5>Why naive blending fails</h5>
<p>Coarse structure (brightness, colour gradients) needs a <em>wide</em> transition so no edge shows. Fine detail (texture, edges) needs a <em>narrow</em> transition so it doesn't appear twice. A single gradient cannot be both at once.</p>

<h5>The fix: every frequency gets its own transition</h5>
<ul>
  <li><strong>Gaussian pyramid:</strong> both images and the mask are repeatedly smoothed and halved (REDUCE).</li>
  <li><strong>Laplacian pyramid:</strong> from each level the expanded next-coarser level is subtracted, leaving exactly one frequency band.</li>
  <li><strong>Per-band blending:</strong> each band is blended with the correspondingly scaled mask.</li>
  <li><strong>Reconstruction:</strong> the bands are summed back up.</li>
</ul>
<div class="fx">L_i = G_i − EXPAND(G_i+1)</div>
<div class="fx">L_fused_i = M_i · L_A_i + (1 − M_i) · L_B_i</div>
<div class="fx">G_i = L_i + EXPAND(G_i+1)</div>
<p>Because the mask is downscaled along with the levels, its transition is wide relative to image content on coarse levels and narrow on fine levels — automatically exactly what you need.</p>

<h5>The controls</h5>
<ul>
  <li><strong>Levels:</strong> how many frequency bands are separated. More levels = softer transition in the coarse structure.</li>
  <li><strong>Seam position:</strong> where the switch between A and B sits.</li>
  <li><strong>Softness:</strong> width of the ramp in the base mask.</li>
</ul>
<p>For comparison the tool always also shows the <strong>naive blend</strong> using the same mask — the difference is usually obvious at once.</p>

<h5>Use cases</h5>
<ul>
  <li>Panorama stitching (transition between overlapping photos)</li>
  <li>Exposure fusion (a dark and a bright shot of the same scene)</li>
  <li>Sky replacement in landscape images</li>
  <li>Merging interior and exterior shots through a window region</li>
</ul>

<h5>Limitations</h5>
<ul>
  <li>Viewpoints should be similar — otherwise alignment is needed first (in the Python project via ORB features, brute-force matching and RANSAC homography).</li>
  <li>Objects that moved between shots cause artefacts.</li>
  <li>Mask quality strongly affects the result.</li>
  <li>It is not a full panorama system: no bundle adjustment, no exposure compensation, no spherical projection.</li>
</ul>
<p class="src">Source: my own “Image Fusion using Laplacian Pyramids” project (NumPy + OpenCV). The browser version uses the geometric base mask; the edge- and saliency-aware mask refinement from <code>laplacian_fusion_max.py</code> is not included here.</p>`
};
