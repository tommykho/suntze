// Site-wide motion: Lenis smooth scroll + GSAP ScrollTrigger reveals, brush draws, word scrubs, parallax,
// pinned horizontal chapter scroller. Everything degrades to static content when motion is reduced.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);
const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- header + nav ----------
const header = document.querySelector('[data-header]');
const toggle = document.querySelector('[data-nav-toggle]');
toggle?.addEventListener('click', () => {
  const open = header.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', String(open));
});
let lastY = 0;
const onScroll = (y) => {
  header?.classList.toggle('is-scrolled', y > 40);
  if (!header?.classList.contains('is-open')) header?.classList.toggle('is-hidden', y > 400 && y > lastY);
  lastY = y;
};
window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });

// ---------- floating back-to-top ----------
const toTop = document.querySelector('[data-to-top]');
if (toTop) {
  let shown = false;
  const update = () => {
    const want = window.scrollY > 600;
    if (want === shown) return;
    shown = want;
    if (want) { toTop.hidden = false; requestAnimationFrame(() => toTop.classList.add('is-shown')); }
    else { toTop.classList.remove('is-shown'); setTimeout(() => { if (!shown) toTop.hidden = true; }, 350); }
  };
  window.addEventListener('scroll', update, { passive: true });
  update();
  toTop.addEventListener('click', () => {
    if (window.__lenis && !reduce) window.__lenis.scrollTo(0, { duration: 1.2 });
    else window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    document.getElementById('main')?.focus?.({ preventScroll: true });
  });
}

// ---------- reading progress ----------
const bar = document.querySelector('[data-progress]');
if (bar) {
  const set = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`;
  };
  addEventListener('scroll', set, { passive: true });
  set();
}

// ---------- copy buttons (used on tactic pages) ----------
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  const src = document.querySelector(btn.dataset.copy);
  if (!src) return;
  try {
    await navigator.clipboard.writeText(src.innerText.trim());
    const old = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => (btn.textContent = old), 1600);
  } catch { /* clipboard blocked: user can select manually */ }
});

if (!reduce) {
  // ---------- smooth scroll ----------
  const lenis = new Lenis({ duration: 1.1, smoothWheel: true, easing: (t) => 1 - Math.pow(1 - t, 3) });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis;
  document.querySelectorAll('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); lenis.scrollTo(target, { offset: -90 }); }
    }),
  );

  // ---------- reveals ----------
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (els) =>
      gsap.to(els, { opacity: 1, x: 0, y: 0, scale: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: true }),
  });

  // ---------- brush strokes draw in ----------
  document.querySelectorAll('[data-draw]').forEach((svg) => {
    svg.querySelectorAll('path').forEach((p) => {
      const len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
      gsap.to(p, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', scrollTrigger: { trigger: svg, start: 'top 90%' } });
    });
  });

  // ---------- word-by-word ink scrub ----------
  document.querySelectorAll('[data-split]').forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w) => `<span class="w">${w.replace(/</g, '&lt;')}</span>`).join(' ');
    gsap.to(el.querySelectorAll('.w'), {
      opacity: 1,
      stagger: 0.05,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true },
    });
  });

  // ---------- parallax ----------
  document.querySelectorAll('[data-parallax]').forEach((el) => {
    const amt = parseFloat(el.dataset.parallax) || 0.2;
    gsap.to(el, { yPercent: -amt * 100, ease: 'none', scrollTrigger: { trigger: el.closest('section') || el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // ---------- pinned horizontal scroller (desktop) ----------
  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px)', () => {
    document.querySelectorAll('[data-hscroll]').forEach((section) => {
      const track = section.querySelector('[data-hscroll-track]');
      const progress = section.querySelector('[data-hscroll-progress]');
      if (!track) return;
      const distance = () => Math.max(0, track.scrollWidth - innerWidth + 80);
      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
          onUpdate: (self) => progress && (progress.style.transform = `scaleX(${self.progress})`),
        },
      });
      track.querySelectorAll('[data-panel]').forEach((panel) => {
        gsap.from(panel.querySelectorAll('[data-panel-in]'), {
          y: 40,
          opacity: 0,
          stagger: 0.08,
          duration: 0.8,
          ease: 'expo.out',
          scrollTrigger: { trigger: panel, containerAnimation: tween, start: 'left 75%' },
        });
      });
    });
  });

  // ---------- stacked cards ----------
  document.querySelectorAll('[data-stack] > *').forEach((card, i, all) => {
    if (i === all.length - 1) return;
    gsap.to(card, {
      scale: 0.94,
      opacity: 0.5,
      ease: 'none',
      scrollTrigger: { trigger: all[i + 1], start: 'top 85%', end: 'top 25%', scrub: true },
    });
  });

  // ---------- counters ----------
  document.querySelectorAll('[data-count]').forEach((el) => {
    const end = parseInt(el.dataset.count, 10);
    const obj = { v: 0 };
    gsap.to(obj, { v: end, duration: 1.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' }, onUpdate: () => (el.textContent = Math.round(obj.v)) });
  });

  addEventListener('load', () => ScrollTrigger.refresh());
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

window.__gsap = gsap;
root.classList.add('motion-ready');
window.dispatchEvent(new CustomEvent('motion:ready', { detail: { gsap, ScrollTrigger, reduce } }));
export { gsap, ScrollTrigger };
