/** Formats monétaires et téléphoniques (fr-CI). */
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** 3 000 F CFA — espaces fines insécables, pour l'écran. */
export const fcfa = (n) => `${nf.format(Math.round(n || 0))} F CFA`;

/** 3 000 F — version courte pour l'écran. */
export const fcfaShort = (n) => `${nf.format(Math.round(n || 0))} F`;

/** 3 000 FCFA — espaces ordinaires (jsPDF, Excel, WhatsApp n'aiment pas U+202F). */
export const fcfaPlain = (n) => `${nf.format(Math.round(n || 0)).replace(/[  ]/g, ' ')} FCFA`;

export const plainNumber = (n) => nf.format(Math.round(n || 0)).replace(/[  ]/g, ' ');

export const dateFr = (d = new Date()) =>
  d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

export const pluralize = (n, one, many) => `${n} ${n > 1 ? many : one}`;
