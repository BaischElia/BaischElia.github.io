/* =========================================================
   main.js — Grundfunktionen der Seite
   Nav · Sprache (DE/EN) · Typed-Animation · Reveal · Uhr · Marquee
   ========================================================= */

/* ---- Sprachzustand (global, damit projects.js darauf zugreift) ---- */
window.lang = 'de';

/* ---- TYPED-Animation (deine Strings) ---- */
function startTyped(){
  const el = document.querySelector('.typing');
  if(!el) return;
  if(typeof Typed === 'undefined'){ el.textContent = 'Elia Baisch'; return; }
  new Typed('.typing', {
    strings: [
      'Elia Baisch',
      'UI/UX Designer',
      'Web Developer',
      'Software Developer',
      'Application Developer',
      'Graphic Designer',
      'Visual Designer',
      'Project Manager',
      'Concept Developer'
    ],
    typeSpeed: 100,
    backSpeed: 100,
    loop: true
  });
}

/* ---- Sprache umschalten ---- */
function toggleLang(){
  window.lang = window.lang === 'de' ? 'en' : 'de';
  document.documentElement.lang = window.lang;
  document.querySelectorAll('[data-de]').forEach(el=>{
    const t = el.getAttribute('data-' + window.lang);
    if(t === null) return;
    // Enthält das Element ein Icon (z. B. Pfeil-SVG)? Dann nur den Text
    // austauschen, damit das Icon nicht mit überschrieben wird.
    const icon = el.querySelector(':scope > svg');
    if(icon){
      const txt = [...el.childNodes].find(n=> n.nodeType === 3 && n.textContent.trim());
      if(txt) txt.textContent = t + ' ';
      else el.insertBefore(document.createTextNode(t + ' '), icon);
    } else {
      el.innerHTML = t;
    }
  });
  const btn = document.getElementById('langBtn');
  if(btn) btn.textContent = window.lang.toUpperCase();
  // Projektliste neu bauen (Tags sprachabhängig)
  if(typeof buildProjects === 'function') buildProjects();
}

/* ---- NAV: Scroll-Zustand + Mobile-Menü ---- */
function initNav(){
  const nav = document.getElementById('nav');
  if(nav) addEventListener('scroll', ()=> nav.classList.toggle('scrolled', scrollY > 40));
  const burger = document.getElementById('burger');
  const navLinks = document.getElementById('navLinks');
  if(burger && navLinks){
    burger.onclick = ()=>{ burger.classList.toggle('open'); navLinks.classList.toggle('open'); };
    navLinks.querySelectorAll('a').forEach(a=> a.onclick = ()=>{
      burger.classList.remove('open'); navLinks.classList.remove('open');
    });
  }
}

/* ---- ABOUT-Tabs ---- */
function atab(e, id){
  document.querySelectorAll('.about-tabs button').forEach(b=> b.classList.remove('active'));
  document.querySelectorAll('.tp').forEach(p=> p.classList.remove('active'));
  e.target.classList.add('active');
  document.getElementById(id).classList.add('active');
}

/* ---- Marquee-Streifen füllen ---- */
function initStrip(){
  const strip = document.getElementById('strip');
  if(!strip) return;
  const words = ['Interface Design','Automation','Web Development','App Development','3D & Motion','RPA','UI / UX','Audio / DSP'];
  let html = '';
  for(let i=0;i<2;i++) words.forEach(w=> html += `<span class="it">${w}</span><span class="st">✦</span>`);
  strip.innerHTML = html;
}

/* ---- Scroll-Reveal ---- */
function initReveal(){
  const io = new IntersectionObserver(entries=>entries.forEach(e=>{
    if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .14 });
  document.querySelectorAll('.rv').forEach(el=> io.observe(el));
}

/* ---- Uhr im Footer ---- */
function initClock(){
  const el = document.getElementById('clock');
  if(!el) return;
  const tick = ()=> el.textContent = new Date().toLocaleTimeString('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}) + ' MEZ';
  tick(); setInterval(tick, 15000);
}

/* ---- Start ---- */
document.addEventListener('DOMContentLoaded', ()=>{
  initNav();
  startTyped();
  initStrip();
  initReveal();
  initClock();
});
