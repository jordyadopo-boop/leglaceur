/**
 * Boucle d'animation unique de tous les effets.
 * Elle se greffe sur le ticker GSAP (un seul requestAnimationFrame pour GSAP, Lenis et les effets),
 * ne tourne que si au moins une tâche est active et se met en pause quand l'onglet est caché.
 *
 *   const task = createTask('fog', (dt, t) => { … });  // dt en secondes (plafonné), t en secondes
 *   task.start(); task.stop();
 */
import { gsap } from '../core/motion.js';

const active = new Set();
let attached = false;
const stats = new Map();
const DEV = import.meta.env.DEV;

function tick(time, deltaMs) {
  const dt = Math.min(Math.max(deltaMs, 0) / 1000, 1 / 20);
  for (const task of active) {
    if (DEV) {
      const t0 = performance.now();
      task.fn(dt, time);
      const ms = performance.now() - t0;
      const s = stats.get(task.name) || { avg: 0, max: 0, frames: 0 };
      s.avg = s.avg * 0.95 + ms * 0.05;
      s.max = Math.max(s.max * 0.995, ms);
      s.frames++;
      stats.set(task.name, s);
    } else {
      task.fn(dt, time);
    }
  }
}

function sync() {
  const want = active.size > 0 && !document.hidden;
  if (want && !attached) {
    gsap.ticker.add(tick);
    attached = true;
  } else if (!want && attached) {
    gsap.ticker.remove(tick);
    attached = false;
  }
}

document.addEventListener('visibilitychange', sync);

export function createTask(name, fn) {
  const task = {
    name,
    fn,
    running: false,
    start() {
      if (task.running) return task;
      task.running = true;
      active.add(task);
      sync();
      return task;
    },
    stop() {
      if (!task.running) return task;
      task.running = false;
      active.delete(task);
      sync();
      return task;
    },
  };
  return task;
}

if (DEV) {
  // Outil de mesure en développement : window.__fxStats()
  window.__fxStats = () =>
    Object.fromEntries([...stats].map(([k, v]) => [k, { avg: +v.avg.toFixed(3), max: +v.max.toFixed(3), frames: v.frames }]));
  window.__fxActive = () => [...active].map((t) => t.name);
}
