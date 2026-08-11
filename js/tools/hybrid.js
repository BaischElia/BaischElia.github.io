/* =========================================================
   tools/hybrid.js — Hybrid Image
   ---------------------------------------------------------
   Portierung von ToolsTemplates/Hybrid Image/hybrid_image.py
   Bild A liefert die tiefen Frequenzen (Gauß-Tiefpass),
   Bild B die hohen (Original minus Tiefpass).
   ========================================================= */

window.TOOLS = window.TOOLS || {};

window.TOOLS['hybrid'] = function(body, title){
  title.textContent = 'Hybrid Image';

  TL.build(body, {
    cols: 2,
    drops: [
      { id:'low',  label:{de:'Bild A — aus der Ferne', en:'Image A — seen far away'} },
      { id:'high', label:{de:'Bild B — aus der Nähe',  en:'Image B — seen close up'} }
    ],
    fields: [
      { id:'sl', type:'range', min:1, max:30, step:0.5, value:12, unit:' px',
        label:{de:'Sigma Tiefpass (A)', en:'Sigma low-pass (A)'} },
      { id:'sh', type:'range', min:1, max:30, step:0.5, value:5, unit:' px',
        label:{de:'Sigma Hochpass (B)', en:'Sigma high-pass (B)'} },
      { id:'wl', type:'range', min:0, max:2, step:0.05, value:1,
        label:{de:'Gewicht A', en:'Weight A'} },
      { id:'wh', type:'range', min:0, max:2, step:0.05, value:1,
        label:{de:'Gewicht B', en:'Weight B'} },
      { id:'gray', type:'check', value:false,
        label:{de:'In Graustufen rechnen', en:'Compute in grayscale'} }
    ],
    views: [
      { id:'lo',  label:{de:'Tiefpass A', en:'Low-pass A'} },
      { id:'hi',  label:{de:'Hochpass B', en:'High-pass B'} },
      { id:'far', label:{de:'Aus der Ferne', en:'From a distance'} },
      { id:'out', label:{de:'Hybridbild', en:'Hybrid image'} }
    ],
    action: { label:{de:'Hybridbild laden', en:'Download hybrid'}, view:'out', name:'hybrid.png' },

    onInput(api){
      // Beide Bilder auf dieselbe Größe bringen — sonst passt nichts übereinander.
      const [A, B] = TL.pixelsPair(api.images.low, api.images.high, 1000);
      const w = A.width, h = A.height, n = w * h;

      let fa = TL.toFloat(A), fb = TL.toFloat(B);
      if(api.val('gray')){
        const ga = TL.gray(fa, n), gb = TL.gray(fb, n);
        for(let i = 0; i < n; i++){
          fa[i*3] = fa[i*3+1] = fa[i*3+2] = ga[i];
          fb[i*3] = fb[i*3+1] = fb[i*3+2] = gb[i];
        }
      }

      // Tiefpass von A
      const low = TL.blur(Float32Array.from(fa), w, h, 3, api.val('sl'));
      // Hochpass von B  =  B − Tiefpass(B)
      const blurB = TL.blur(Float32Array.from(fb), w, h, 3, api.val('sh'));
      const high = new Float32Array(n * 3);
      for(let i = 0; i < n * 3; i++) high[i] = fb[i] - blurB[i];

      // Hybrid = w_low · Tiefpass + w_high · Hochpass
      const wl = api.val('wl'), wh = api.val('wh');
      const hyb = new Float32Array(n * 3);
      for(let i = 0; i < n * 3; i++) hyb[i] = wl * low[i] + wh * high[i];

      TL.show(api.view('lo'), TL.toImageData(low, w, h));
      // Hochpass um 128 versetzt darstellen, sonst sieht man nur Schwarz.
      const hiView = new Float32Array(n * 3);
      for(let i = 0; i < n * 3; i++) hiView[i] = high[i] + 128;
      TL.show(api.view('hi'), TL.toImageData(hiView, w, h));

      const out = TL.toImageData(hyb, w, h);
      TL.show(api.view('out'), out);

      // Verkleinerte Ansicht — simuliert den Blick aus der Ferne.
      const far = api.view('far');
      const small = TL.resample(out, Math.max(24, Math.round(w * 0.14)), Math.max(24, Math.round(h * 0.14)));
      TL.show(far, small);
      far.style.imageRendering = 'auto';

      api.say(TL.t({
        de: `Arbeitsauflösung ${w} × ${h} px — beide Bilder werden dafür auf dieselbe Größe gebracht.`,
        en: `Working resolution ${w} × ${h} px — both images are matched to the same size.`
      }));
    }
  });
};

window.TOOLS['hybrid'].doc = {
  de: `
<h4>Hybrid Images</h4>
<p>Ein Hybridbild zeigt zwei verschiedene Motive — je nachdem, wie weit man weg steht. Aus der Nähe sieht man das eine, aus der Ferne das andere. Der Effekt ist <strong>kein Spezialeffekt</strong>, sondern entsteht allein durch lineare Filterung und die Eigenschaften der menschlichen Wahrnehmung.</p>

<h5>Die Idee</h5>
<p>Unser visuelles System wertet je nach Betrachtungsabstand unterschiedliche Ortsfrequenzen aus. Aus der Nähe dominieren feine Details (hohe Frequenzen), aus der Ferne nur noch die grobe Struktur (tiefe Frequenzen). Kombiniert man die tiefen Frequenzen von Bild A mit den hohen von Bild B, entscheidet der Abstand, welches Motiv gewinnt.</p>

<h5>Der Rechenweg</h5>
<ul>
  <li><strong>Tiefpass:</strong> Bild A wird mit einem Gaußfilter weichgezeichnet — übrig bleibt die grobe Struktur.</li>
  <li><strong>Hochpass:</strong> Von Bild B wird die weichgezeichnete Version abgezogen — übrig bleiben nur die Details.</li>
  <li><strong>Kombination:</strong> Beide Anteile werden gewichtet addiert.</li>
</ul>
<div class="fx">hybrid = w_A · tiefpass(A, σ_A) + w_B · ( B − tiefpass(B, σ_B) )</div>

<h5>In der Fourier-Domäne</h5>
<p>Präziser lässt sich das im Frequenzraum beschreiben. Mit dem Gaußfilter G(ω) und der Cutoff-Frequenz f_cut (dort, wo |G(ω)| = 0,5 ist):</p>
<div class="fx">Î_low(ω) = Î(ω) · G(ω)        Î_high(ω) = Î(ω) · (1 − G(ω))</div>
<div class="fx">Ĥ(ω) = Î_low(ω) + Î_high(ω)</div>
<p>Die Wahl der Sigma-Werte bestimmt also direkt, <strong>bei welcher Betrachtungsdistanz</strong> welches Bild dominiert.</p>

<h5>Tipps</h5>
<ul>
  <li>Am besten funktionieren Bildpaare, die grob zueinander ausgerichtet sind — Augen auf Augen, Kontur auf Kontur.</li>
  <li>Größeres Sigma beim Tiefpass = Bild A setzt sich erst aus größerer Entfernung durch.</li>
  <li>Die Ansicht „Aus der Ferne“ ist eine verkleinerte Version des Ergebnisses — das entspricht dem Blick aus mehreren Metern.</li>
</ul>

<h5>Erweiterung auf Video</h5>
<p>Im Projekt habe ich den Ansatz auch auf zwei zeitsynchrone Videos angewandt: Ein Video liefert die hohen, das andere die tiefen Frequenzen. Eine naive Umsetzung Bild für Bild erzeugt sichtbares Flackern; erst eine zeitliche Glättung über aufeinanderfolgende Frames sorgt für Stabilität. Am besten funktioniert das, wenn beide Videos ähnliche Kamerabewegung, Auflösung und Framerate haben.</p>
<p class="src">Referenz: Oliva, A. &amp; Torralba, A. — „Hybrid Images“, SIGGRAPH 2006. Eigene Umsetzung mit NumPy + OpenCV, hier im Browser nachgebaut.</p>`,

  en: `
<h4>Hybrid images</h4>
<p>A hybrid image shows two different subjects depending on your viewing distance. Up close you see one, from far away the other. The effect is <strong>not a special effect</strong> — it comes purely from linear filtering and the properties of human perception.</p>

<h5>The idea</h5>
<p>Our visual system evaluates different spatial frequencies depending on distance. Up close, fine detail (high frequencies) dominates; from afar only the coarse structure (low frequencies) remains. Combine the low frequencies of image A with the high frequencies of image B, and distance decides which subject wins.</p>

<h5>The computation</h5>
<ul>
  <li><strong>Low-pass:</strong> image A is blurred with a Gaussian — the coarse structure remains.</li>
  <li><strong>High-pass:</strong> the blurred version of image B is subtracted from B — only detail remains.</li>
  <li><strong>Combination:</strong> both parts are added with weights.</li>
</ul>
<div class="fx">hybrid = w_A · lowpass(A, σ_A) + w_B · ( B − lowpass(B, σ_B) )</div>

<h5>In the Fourier domain</h5>
<p>It is described more precisely in frequency space. With the Gaussian filter G(ω) and cutoff frequency f_cut (where |G(ω)| = 0.5):</p>
<div class="fx">Î_low(ω) = Î(ω) · G(ω)        Î_high(ω) = Î(ω) · (1 − G(ω))</div>
<div class="fx">Ĥ(ω) = Î_low(ω) + Î_high(ω)</div>
<p>So the choice of sigma directly determines <strong>at which viewing distance</strong> each image takes over.</p>

<h5>Tips</h5>
<ul>
  <li>Pairs that are roughly aligned work best — eyes on eyes, outline on outline.</li>
  <li>A larger low-pass sigma means image A only takes over from further away.</li>
  <li>The “from a distance” view is a downscaled version of the result — it approximates looking from several metres away.</li>
</ul>

<h5>Extension to video</h5>
<p>In the project I also applied this to two time-synchronised videos: one supplies the high frequencies, the other the low ones. A naive frame-by-frame implementation causes visible flicker; only temporal smoothing across consecutive frames makes it stable. It works best when both videos share similar camera motion, resolution and frame rate.</p>
<p class="src">Reference: Oliva, A. &amp; Torralba, A. — “Hybrid Images”, SIGGRAPH 2006. My own implementation with NumPy + OpenCV, rebuilt here in the browser.</p>`
};
