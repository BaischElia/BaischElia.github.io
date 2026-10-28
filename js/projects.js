/* =========================================================
   projects.js — Deine Projektliste
   ---------------------------------------------------------
   NEUES PROJEKT HINZUFÜGEN:
   Füge einfach ein Objekt zum PROJECTS-Array hinzu:
   {
     title: 'Projektname',
     tags:  { de:['Tag1','Tag2'], en:['Tag1','Tag2'] },
     year:  '2026',
     cover: 'assets/covers/mein-projekt.jpg',  // optional: Hover-Vorschau
     link:  'projects/mein-projekt.html'       // eigene Unterseite
     //  ODER eine externe URL: 'https://...'
   }
   Die Reihenfolge im Array = Reihenfolge auf der Seite.
   ========================================================= */

const PROJECTS = [
  {
    title: 'Reachy Mini — HRI',
    tags:  { de:['HRI','Studie','Paper'], en:['HRI','Study','Paper'] },
    year:  '2026',
    cover: 'assets/covers/reachy-mini.jpg',
    link:  'projects/reachy-mini.html'
  },
  {
    title: 'SustainAppility',
    tags:  { de:['UI/UX','Figma','Prototyping'], en:['UI/UX','Figma','Prototyping'] },
    year:  '2025',
    cover: 'assets/covers/sustainappility.png',
    link:  'projects/sustainappility.html'
  },
  {
    title: 'VST3 Plugin Dev',
    tags:  { de:['Audio','C++','DSP'], en:['Audio','C++','DSP'] },
    year:  '2025',
    cover: 'assets/covers/vst3-plugin-dev.png',
    link:  'projects/vst3-plugin-dev.html'
  },
  {
    title: 'Design Portfolios',
    tags:  { de:['Visual','Layout','Theorie'], en:['Visual','Layout','Theory'] },
    year:  '2024',
    cover: 'assets/covers/design-portfolios.png',
    link:  'projects/design-portfolios.html'
  }
];

/* ---- Projektliste rendern ---- */
function buildProjects(){
  const wrap = document.getElementById('projList');
  if(!wrap) return;
  const lang = window.lang || 'de';
  wrap.innerHTML = PROJECTS.map((p, i)=>{
    const external = /^https?:/.test(p.link);
    const num = String(i+1).padStart(2,'0');
    return `
    <a class="proj" href="${p.link}" ${external ? 'target="_blank" rel="noopener"' : ''} ${p.cover ? `data-cover="${p.cover}"` : ''}>
      <span class="pn">${num}</span>
      <span class="pt">${p.title}</span>
      <span class="pmeta">${p.tags[lang].map(t=>`<span class="tag">${t}</span>`).join('')}</span>
      <span class="py">${p.year}</span>
      <span class="arr">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M7 17L17 7M17 7H8M17 7v9"/></svg>
      </span>
    </a>`;
  }).join('');
  initProjectPreview();
}

/* ---- Bild-Vorschau, die beim Hovern am Cursor klebt (nur Desktop) ---- */
function initProjectPreview(){
  if(matchMedia('(pointer:coarse)').matches) return;
  let prev = document.querySelector('.proj-prev');
  if(!prev){
    prev = document.createElement('div');
    prev.className = 'proj-prev';
    prev.innerHTML = '<img alt="">';
    document.body.appendChild(prev);
  }
  const img = prev.querySelector('img');

  document.querySelectorAll('.proj[data-cover]').forEach(a=>{
    a.addEventListener('mouseenter', ()=>{ img.src = a.dataset.cover; prev.classList.add('on'); });
    a.addEventListener('mouseleave', ()=> prev.classList.remove('on'));
    a.addEventListener('mousemove', e=>{
      prev.style.left = e.clientX + 'px';
      prev.style.top  = e.clientY + 'px';
    });
  });
}

document.addEventListener('DOMContentLoaded', buildProjects);
