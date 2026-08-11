/* =========================================================
   project.js — Nur für Projekt-Unterseiten (projects/*.html)
   ---------------------------------------------------------
   • Lightbox: jedes <img class="zoom"> öffnet sich groß
   • Fehlende Bilder werden ausgeblendet (Platzhalter-freundlich)
   Wird zusätzlich zu main.js eingebunden.
   ========================================================= */

/* ---- Lightbox ---- */
function initLightbox(){
  const imgs = document.querySelectorAll('img.zoom');
  if(!imgs.length) return;

  const box = document.createElement('div');
  box.className = 'lb';
  box.innerHTML = `<button class="lb-x" aria-label="Close">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button><img alt="">`;
  document.body.appendChild(box);
  const big = box.querySelector('img');

  const close = ()=>{ box.classList.remove('show'); document.body.style.overflow=''; };
  box.addEventListener('click', close);
  addEventListener('keydown', e=>{ if(e.key === 'Escape') close(); });

  imgs.forEach(img=> img.addEventListener('click', ()=>{
    big.src = img.currentSrc || img.src;
    big.alt = img.alt || '';
    box.classList.add('show');
    document.body.style.overflow = 'hidden';
  }));
}

/* ---- Bilder, die (noch) nicht existieren, sauber ausblenden ---- */
function initMissingImages(){
  document.querySelectorAll('img[data-optional]').forEach(img=>{
    img.addEventListener('error', ()=>{
      const fig = img.closest('figure') || img.parentElement;
      if(fig) fig.style.display = 'none';
    });
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  initLightbox();
  initMissingImages();
});
