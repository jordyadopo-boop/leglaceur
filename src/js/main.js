/**
 * Point d'entrée unique de toutes les pages.
 * Chaque élément portant data-module="nom [autre]" charge src/js/modules/<nom>.js à la demande
 * et appelle son export par défaut : init(element, ctx). Les styles de src/styles/modules/*.css
 * sont tous chargés.
 */
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '../styles/main.css';
import { initSmoothScroll, ScrollTrigger, reducedMotion, finePointer } from './core/motion.js';
import { initReveals } from './core/reveal.js';

import.meta.glob('../styles/modules/*.css', { eager: true });
const loaders = import.meta.glob('./modules/*.js');

document.documentElement.classList.add('js');
if (reducedMotion) document.documentElement.classList.add('reduced-motion');
if (finePointer) document.documentElement.classList.add('fine-pointer');

const ctx = { page: document.body.dataset.page || 'home' };

async function boot() {
  initSmoothScroll();
  const jobs = [];
  for (const el of document.querySelectorAll('[data-module]')) {
    for (const name of el.dataset.module.split(/\s+/).filter(Boolean)) {
      const load = loaders[`./modules/${name}.js`];
      if (!load) { console.warn(`[module] introuvable : ${name}`); continue; }
      jobs.push(
        load()
          .then((m) => m.default?.(el, ctx))
          .catch((err) => console.error(`[module] ${name}`, err)),
      );
    }
  }
  await Promise.allSettled(jobs);
  initReveals();
  requestAnimationFrame(() => ScrollTrigger.refresh());
  document.documentElement.classList.add('is-ready');
  window.dispatchEvent(new Event('app:ready'));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
