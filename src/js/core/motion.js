/**
 * Moteur d'animation partagé : GSAP + plugins + Lenis (défilement fluide).
 * Tous les modules importent gsap/ScrollTrigger d'ici pour partager la même instance.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Flip } from 'gsap/Flip';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { CustomEase } from 'gsap/CustomEase';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText, Flip, DrawSVGPlugin, MotionPathPlugin, CustomEase);
CustomEase.create('ice', '0.16, 1, 0.3, 1');
CustomEase.create('crack', '0.7, 0, 0.84, 0');
gsap.defaults({ ease: 'ice', duration: 1 });

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
export const isMobile = window.matchMedia('(max-width: 760px)').matches;

let lenis = null;

export function initSmoothScroll() {
  if (reducedMotion || lenis) return lenis;
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  // Ancres internes en défilement fluide (compense l'en-tête fixe).
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -80 });
    history.replaceState(null, '', id);
  });
  return lenis;
}

export const getLenis = () => lenis;
export const stopScroll = () => lenis?.stop();
export const startScroll = () => lenis?.start();

export { gsap, ScrollTrigger, SplitText, Flip, DrawSVGPlugin, MotionPathPlugin, CustomEase };
