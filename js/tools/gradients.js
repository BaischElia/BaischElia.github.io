/* =========================================================
   tools/gradients.js — Gradienten-Analyse (Bildforensik)
   ---------------------------------------------------------
   Portierung des Modus `analyze_pair` aus
   ToolsTemplates/Detecting generated images/src/gradients.py
   Zwei Bilder werden mit demselben Filter analysiert und
   nebeneinander verglichen — plus die Kennzahlen dazu.
   ========================================================= */

window.TOOLS = window.TOOLS || {};

window.TOOLS['grad'] = function(body, title){
  title.textContent = TL.t({de:'Gradienten-Analyse', en:'Gradient analysis'});
  let table = null;

  TL.build(body, {
    cols: 2,
    drops: [
      { id:'a', label:{de:'Bild A — z. B. echtes Foto', en:'Image A — e.g. a real photo'} },
      { id:'b', label:{de:'Bild B — z. B. generiert', en:'Image B — e.g. generated'} }
    ],
    fields: [
      { id:'filter', type:'select', value:'sobel',
        label:{de:'Filter', en:'Filter'},
        options:[
          { v:'sobel',   t:{de:'Sobel — Kanten', en:'Sobel — edges'} },
          { v:'scharr',  t:{de:'Scharr — Kanten (genauer)', en:'Scharr — edges (more accurate)'} },
          { v:'laplace', t:{de:'Laplace — Details & Rauschen', en:'Laplacian — detail & noise'} }
        ]},
      { id:'gain', type:'range', min:1, max:6, step:0.1, value:1.6, unit:'×',
        label:{de:'Kontrast der Darstellung', en:'Display contrast'} }
    ],
    views: [
      { id:'ma', label:{de:'Bild A', en:'Image A'} },
      { id:'mb', label:{de:'Bild B', en:'Image B'} }
    ],
    action: { label:{de:'Karte A laden', en:'Download map A'}, view:'ma', name:'gradient-map.png' },

    onInput(api){
      const [A, B] = TL.pixelsPair(api.images.a, api.images.b, 900);
      const w = A.width, h = A.height, n = w * h;
      const kind = api.val('filter'), gain = api.val('gain');

      const res = [['a', A, 'ma'], ['b', B, 'mb']].map(([key, img, view]) => {
        const g = TL.gray(TL.toFloat(img), n);
        const raw = gradientRaw(g, w, h, kind);

        // Darstellung: je Bild auf 0…1 normiert (wie sobel_map & Co. im
        // Python-Projekt), damit man überhaupt etwas erkennt.
        const disp = normalise(raw);
        for(let i = 0; i < n; i++) disp[i] = Math.min(1, disp[i] * gain);
        TL.show(api.view(view), TL.mapToImageData(disp, w, h));

        // Kennzahlen dagegen auf den ABSOLUTEN Werten (in Graustufen) —
        // sonst wären die beiden Bilder nicht vergleichbar, weil jede
        // Normierung sich am eigenen Maximum orientiert.
        return { key, ...TL.stats(raw), energy: highFreqEnergy(raw, n) };
      });

      renderTable(api, res);
      api.say('');
    }
  });

  /* Gradientenbetrag in Graustufen (unnormiert). Scharr wird durch 3
     geteilt, damit seine Werte auf derselben Skala liegen wie Sobel. */
  function gradientRaw(g, w, h, kind){
    const K = TL.KERNELS;
    if(kind === 'laplace'){
      const l = TL.conv3(g, w, h, K.laplace);
      const out = new Float32Array(l.length);
      for(let i = 0; i < l.length; i++) out[i] = Math.abs(l[i]);
      return out;
    }
    const scharr = kind === 'scharr';
    const [kx, ky] = scharr ? [K.scharrX, K.scharrY] : [K.sobelX, K.sobelY];
    const gx = TL.conv3(g, w, h, kx), gy = TL.conv3(g, w, h, ky);
    const out = new Float32Array(gx.length), s = scharr ? 1/3 : 1;
    for(let i = 0; i < gx.length; i++) out[i] = Math.hypot(gx[i], gy[i]) * s;
    return out;
  }

  function normalise(raw){
    let lo = Infinity, hi = -Infinity;
    for(let i = 0; i < raw.length; i++){ if(raw[i] < lo) lo = raw[i]; if(raw[i] > hi) hi = raw[i]; }
    const sp = (hi - lo) || 1e-12;
    const out = new Float32Array(raw.length);
    for(let i = 0; i < raw.length; i++) out[i] = (raw[i] - lo) / sp;
    return out;
  }

  /* Anteil der Pixel mit deutlicher Gradientenantwort — absolute Schwelle
     in Graustufen, damit beide Bilder gleich gemessen werden. */
  function highFreqEnergy(raw, n){
    let c = 0;
    for(let i = 0; i < n; i++) if(raw[i] > 12) c++;
    return c / n;
  }

  function renderTable(api, res){
    if(!table){
      table = document.createElement('table');
      table.className = 'tstats';
      api.panel.insertBefore(table, api.panel.querySelector('.tnote'));
    }
    const de = TL.de();
    const [a, b] = res;
    const row = (label, va, vb, hint) => `
      <tr><td>${label}</td><td>${va}</td><td>${vb}</td><td style="color:var(--ink-3)">${hint}</td></tr>`;
    table.innerHTML = `
      <tr><th>${de ? 'Kennzahl' : 'Metric'}</th><th>${de ? 'Bild A' : 'Image A'}</th>
          <th>${de ? 'Bild B' : 'Image B'}</th><th></th></tr>
      ${row(de ? 'Mittlere Gradientenstärke' : 'Mean gradient strength',
            a.mean.toFixed(2), b.mean.toFixed(2),
            de ? 'in Graustufen — wie kantenreich' : 'in gray levels — how edge-rich')}
      ${row(de ? 'Standardabweichung' : 'Standard deviation',
            a.std.toFixed(2), b.std.toFixed(2),
            de ? 'wie ungleichmäßig' : 'how uneven')}
      ${row(de ? 'Anteil strukturierter Pixel' : 'Share of structured pixels',
            (a.energy*100).toFixed(1) + ' %', (b.energy*100).toFixed(1) + ' %',
            de ? 'Feinstruktur & Rauschen' : 'fine structure & noise')}`;
  }
};

window.TOOLS['grad'].doc = {
  de: `
<h4>Erkennung generierter Bilder durch Gradienten</h4>
<p>Die Ausgangsthese des Projekts: Generative Modelle hinterlassen spezifische Artefakte in den <strong>Bildgradienten</strong> — also an Kanten und Texturübergängen. Mit bloßem Auge sind die oft nicht zu sehen, in der Gradientendarstellung dagegen häufig schon.</p>
<p>Dieses Tool entspricht dem Modus <code>analyze_pair</code> aus dem Projekt: Zwei Bilder werden mit demselben Filter analysiert und direkt nebeneinander verglichen.</p>

<h5>1 — Sobel (Kantenfilter)</h5>
<p><strong>Was es ist:</strong> Berechnet die erste Ableitung der Bildhelligkeit und hebt damit Kanten und Konturen hervor.</p>
<p><strong>Real vs. Fake:</strong> Echte Fotos haben meist physikalisch plausible, scharfe Kantenübergänge. Generierte Bilder zeigen manchmal „verwaschene“ Kanten oder Artefakte an Stellen, die eigentlich glatt sein müssten — etwa seltsame Strukturen in Hintergründen.</p>

<h5>2 — Scharr</h5>
<p>Eine rotationssymmetrisch optimierte Variante des Sobel-Operators. Sie schätzt die Gradientenrichtung genauer und reagiert empfindlicher auf feine Kanten.</p>

<h5>3 — Laplace (Detail- und Rauschfilter)</h5>
<p><strong>Was es ist:</strong> Die zweite Ableitung, also die Krümmung der Helligkeit. Extrem empfindlich für feine Details und Rauschen.</p>
<p><strong>Real vs. Fake:</strong> Echte Kamerasensoren erzeugen ein natürliches, gleichmäßig verteiltes Rauschen. Generierte Bilder sind oft unnatürlich glatt (wirken „entrauscht“) oder zeigen ein künstliches, repetitives Rauschmuster. Der Laplace-Filter macht genau diesen Unterschied im Rauschverhalten oft am deutlichsten sichtbar.</p>

<h5>Die Kennzahlen</h5>
<ul>
  <li><strong>Mittlere Gradientenstärke</strong> — wie kantenreich das Bild insgesamt ist, gemessen in Graustufen.</li>
  <li><strong>Standardabweichung</strong> — wie ungleichmäßig die Kanten verteilt sind. Sehr gleichmäßige Werte können auf synthetische Textur hindeuten.</li>
  <li><strong>Anteil strukturierter Pixel</strong> — wie viel Fläche überhaupt Feinstruktur oder Rauschen trägt. Auffällig niedrige Werte sprechen für ein glattgerechnetes Bild.</li>
</ul>
<p>Wichtig für die Interpretation: Die <em>Bilder</em> sind je einzeln auf ihren eigenen Wertebereich gestreckt, damit man überhaupt etwas erkennt — ein dunkles Bild heißt also nicht automatisch „wenig Struktur“. Die <em>Zahlen</em> in der Tabelle dagegen stehen auf einer gemeinsamen absoluten Skala und sind direkt vergleichbar.</p>

<h5>Wichtige Einordnung</h5>
<p>Das ist <strong>kein Detektor</strong>, der ein Urteil fällt. Die Zahlen sind Indizien, keine Beweise — Bildkompression, Nachschärfung oder ein Handy-Bildprozessor verändern sie ebenfalls deutlich. Sinnvoll ist der Vergleich zweier Bilder unter gleichen Bedingungen, nicht die absolute Bewertung eines einzelnen Bildes.</p>

<h5>Was im Python-Projekt zusätzlich steckt</h5>
<ul>
  <li><strong>extract_features</strong> — berechnet numerische Merkmale für einen ganzen Datensatz.</li>
  <li><strong>train</strong> — trainiert einen Random-Forest-Klassifikator auf diesen Merkmalen.</li>
  <li><strong>LGrad-proxy</strong> — nutzt ein vortrainiertes VGG16-Netz und visualisiert Gradienten der <em>Netz-Aktivierungen</em> statt der Pixel. Damit lassen sich semantische Inkonsistenzen finden, die auf Pixelebene unsichtbar sind.</li>
</ul>
<p>Diese drei Teile brauchen PyTorch und ein trainiertes Modell und laufen deshalb nicht im Browser — hier ist die visuelle Analyse umgesetzt.</p>
<p class="src">Quelle: eigenes Projekt „Erkennung generierter Bilder durch Gradienten“ (NumPy, OpenCV, PyTorch, scikit-learn).</p>`,

  en: `
<h4>Detecting generated images through gradients</h4>
<p>The project's premise: generative models leave specific artefacts in the <strong>image gradients</strong> — at edges and texture transitions. They are often invisible to the naked eye, but frequently show up in a gradient view.</p>
<p>This tool corresponds to the <code>analyze_pair</code> mode of the project: two images are analysed with the same filter and compared side by side.</p>

<h5>1 — Sobel (edge filter)</h5>
<p><strong>What it is:</strong> computes the first derivative of image brightness, highlighting edges and contours.</p>
<p><strong>Real vs. fake:</strong> real photos usually have physically plausible, sharp edge transitions. Generated images sometimes show “washed out” edges or artefacts in places that should be smooth — odd structures in backgrounds, for instance.</p>

<h5>2 — Scharr</h5>
<p>A rotation-optimised variant of the Sobel operator. It estimates gradient direction more accurately and responds more sensitively to fine edges.</p>

<h5>3 — Laplacian (detail and noise filter)</h5>
<p><strong>What it is:</strong> the second derivative, i.e. the curvature of brightness. Extremely sensitive to fine detail and noise.</p>
<p><strong>Real vs. fake:</strong> real camera sensors produce natural, evenly distributed noise. Generated images are often unnaturally smooth (they look denoised) or show an artificial, repetitive noise pattern. The Laplacian usually makes this difference in noise behaviour clearest.</p>

<h5>The metrics</h5>
<ul>
  <li><strong>Mean gradient strength</strong> — how edge-rich the image is overall, measured in gray levels.</li>
  <li><strong>Standard deviation</strong> — how unevenly the edges are distributed. Very uniform values can indicate synthetic texture.</li>
  <li><strong>Share of structured pixels</strong> — how much of the area carries fine structure or noise at all. Strikingly low values suggest a smoothed-out image.</li>
</ul>
<p>Important for interpretation: each <em>image</em> is stretched to its own value range so you can see anything at all — a dark map therefore does not automatically mean “little structure”. The <em>numbers</em> in the table, by contrast, sit on a shared absolute scale and are directly comparable.</p>

<h5>Important context</h5>
<p>This is <strong>not a detector</strong> that passes judgement. The numbers are indications, not proof — compression, sharpening or a phone's image processor change them significantly too. Comparing two images under equal conditions is meaningful; judging a single image in absolute terms is not.</p>

<h5>What else the Python project contains</h5>
<ul>
  <li><strong>extract_features</strong> — computes numeric features across a whole dataset.</li>
  <li><strong>train</strong> — trains a random forest classifier on those features.</li>
  <li><strong>LGrad proxy</strong> — uses a pre-trained VGG16 network and visualises gradients of the <em>network activations</em> rather than pixels, revealing semantic inconsistencies invisible at pixel level.</li>
</ul>
<p>Those three parts need PyTorch and a trained model and therefore do not run in the browser — what is implemented here is the visual analysis.</p>
<p class="src">Source: my own project “Detecting generated images through gradients” (NumPy, OpenCV, PyTorch, scikit-learn).</p>`
};
