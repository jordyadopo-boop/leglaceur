import { BRAND } from '../config.js';

/** Lien WhatsApp vers le Glaceur avec message prérempli. */
export const waLink = (text = '', number = BRAND.whatsapp) =>
  `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const telLink = (tel) => `tel:${tel.replace(/\s/g, '')}`;
