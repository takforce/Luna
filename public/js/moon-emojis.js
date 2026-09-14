// Set di emoji "luna" con diverse espressioni.
// Ogni voce ha uno shortcode (salvato nel testo del messaggio, es. ":moon_happy:")
// e genera un piccolo SVG con base condivisa + occhi/bocca/extra diversi.

const MOON_BASE_GRADIENT = (id) => `
  <radialGradient id="mg${id}" cx="35%" cy="30%" r="75%">
    <stop offset="0%" stop-color="#fff6de"/>
    <stop offset="55%" stop-color="#f6c453"/>
    <stop offset="100%" stop-color="#d99a2b"/>
  </radialGradient>
`;

function moonSvg(id, inner) {
  return `<svg viewBox="0 0 32 32" width="26" height="26">
    <defs>${MOON_BASE_GRADIENT(id)}</defs>
    <circle cx="16" cy="16" r="14" fill="url(#mg${id})"/>
    ${inner}
  </svg>`;
}

// --- pezzi riutilizzabili ---
const EYES = {
  dot: `<circle cx="11" cy="15" r="1.5" fill="#3a2410"/><circle cx="21" cy="15" r="1.5" fill="#3a2410"/>`,
  dotDown: `<circle cx="11" cy="16.5" r="1.4" fill="#3a2410"/><circle cx="21" cy="16.5" r="1.4" fill="#3a2410"/>`,
  happyArc: `<path d="M9 15 Q11 12.5 13 15" stroke="#3a2410" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M19 15 Q21 12.5 23 15" stroke="#3a2410" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  wink: `<circle cx="11" cy="15" r="1.5" fill="#3a2410"/><path d="M19 15 Q21 12.5 23 15" stroke="#3a2410" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  big: `<circle cx="11" cy="15" r="2.6" fill="#3a2410"/><circle cx="21" cy="15" r="2.6" fill="#3a2410"/>`,
  closed: `<path d="M9 15 H13" stroke="#3a2410" stroke-width="1.4" stroke-linecap="round"/><path d="M19 15 H23" stroke="#3a2410" stroke-width="1.4" stroke-linecap="round"/>`,
  heart: `<path d="M11 14c-1-1.3-3-0.6-3 0.7 0 1.3 3 2.6 3 2.6s3-1.3 3-2.6c0-1.3-2-2-3-0.7z" fill="#e0475f"/><path d="M21 14c-1-1.3-3-0.6-3 0.7 0 1.3 3 2.6 3 2.6s3-1.3 3-2.6c0-1.3-2-2-3-0.7z" fill="#e0475f"/>`,
  x: `<path d="M9.5 13.5 L12.5 16.5 M12.5 13.5 L9.5 16.5" stroke="#3a2410" stroke-width="1.3" stroke-linecap="round"/><path d="M19.5 13.5 L22.5 16.5 M22.5 13.5 L19.5 16.5" stroke="#3a2410" stroke-width="1.3" stroke-linecap="round"/>`,
  star: `<path d="M11 12l0.8 1.8 2 0.2-1.5 1.3 0.5 2-1.8-1.1-1.8 1.1 0.5-2-1.5-1.3 2-0.2z" fill="#3a2410"/><path d="M21 12l0.8 1.8 2 0.2-1.5 1.3 0.5 2-1.8-1.1-1.8 1.1 0.5-2-1.5-1.3 2-0.2z" fill="#3a2410"/>`,
  angryBrow: `<circle cx="11" cy="15.5" r="1.4" fill="#3a2410"/><circle cx="21" cy="15.5" r="1.4" fill="#3a2410"/><path d="M9 12.5 L13 13.8" stroke="#3a2410" stroke-width="1.3" stroke-linecap="round"/><path d="M23 12.5 L19 13.8" stroke="#3a2410" stroke-width="1.3" stroke-linecap="round"/>`,
  sunglasses: `<rect x="8" y="13.5" width="16" height="3.4" rx="1.5" fill="#2a2a2a"/><path d="M8 15 h-2 M24 15 h2" stroke="#2a2a2a" stroke-width="1.2"/>`,
  spiral: `<circle cx="11" cy="15" r="2" fill="none" stroke="#3a2410" stroke-width="1"/><circle cx="21" cy="15" r="2" fill="none" stroke="#3a2410" stroke-width="1"/>`,
  sad: `<path d="M9 16 Q11 13.5 13 16" stroke="#3a2410" stroke-width="1.4" fill="none" stroke-linecap="round" transform="rotate(180 11 15)"/><path d="M19 16 Q21 13.5 23 16" stroke="#3a2410" stroke-width="1.4" fill="none" stroke-linecap="round" transform="rotate(180 21 15)"/>`,
};

const MOUTHS = {
  smile: `<path d="M11 20 Q16 24 21 20" stroke="#3a2410" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  bigSmile: `<path d="M10 19.5 Q16 26 22 19.5 Q16 23 10 19.5 Z" fill="#7a2f1c"/>`,
  frown: `<path d="M11 22 Q16 18 21 22" stroke="#3a2410" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  o: `<ellipse cx="16" cy="21" rx="2.2" ry="2.8" fill="#7a2f1c"/>`,
  line: `<path d="M12 21 H20" stroke="#3a2410" stroke-width="1.4" stroke-linecap="round"/>`,
  smirk: `<path d="M12 20.5 Q17 22.5 20 19.5" stroke="#3a2410" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  tongue: `<path d="M11 19.5 Q16 23.5 21 19.5" stroke="#3a2410" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M14.5 21.5 Q16 26 17.5 21.5 Z" fill="#e0475f"/>`,
  kiss: `<ellipse cx="16" cy="21" rx="1.6" ry="1.2" fill="#7a2f1c"/>`,
  wavy: `<path d="M11 21 Q13 19.5 15 21 Q17 22.5 21 21" stroke="#3a2410" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
};

const EXTRAS = {
  none: ``,
  tears: `<ellipse cx="8" cy="19" rx="1.1" ry="1.8" fill="#5fb8e0"/><ellipse cx="24" cy="19" rx="1.1" ry="1.8" fill="#5fb8e0"/>`,
  sweat: `<path d="M25 11c1 1.4 1.6 2.4 1.6 3.3 0 0.9-0.7 1.6-1.6 1.6s-1.6-0.7-1.6-1.6c0-0.9 0.6-1.9 1.6-3.3z" fill="#5fb8e0"/>`,
  blush: `<circle cx="9" cy="18.5" r="1.6" fill="#f2a0a8" opacity="0.75"/><circle cx="23" cy="18.5" r="1.6" fill="#f2a0a8" opacity="0.75"/>`,
  zzz: `<text x="23" y="9" font-size="6" fill="#3a2410" font-family="sans-serif" font-weight="700">Z</text><text x="27" y="6" font-size="4.5" fill="#3a2410" font-family="sans-serif" font-weight="700">z</text>`,
  heartFloat: `<path d="M27 8c-0.6-0.8-1.9-0.4-1.9 0.5 0 0.9 1.9 1.7 1.9 1.7s1.9-0.8 1.9-1.7c0-0.9-1.3-1.3-1.9-0.5z" fill="#e0475f"/>`,
  sparkle: `<path d="M6 8l0.5 1.3 1.3 0.3-1.3 0.9 0.3 1.4-1.3-0.8-1.3 0.8 0.3-1.4-1.3-0.9 1.3-0.3z" fill="#f6c453"/>`,
  halo: `<ellipse cx="16" cy="4" rx="5" ry="1.6" fill="none" stroke="#f6c453" stroke-width="1.3"/>`,
  horns: `<path d="M10 5 L11.5 9 L8.5 8 Z" fill="#7a2f1c"/><path d="M22 5 L23.5 8 L20.5 9 Z" fill="#7a2f1c"/>`,
  glasses: `<circle cx="11" cy="15" r="3" fill="none" stroke="#2a2a2a" stroke-width="1.2"/><circle cx="21" cy="15" r="3" fill="none" stroke="#2a2a2a" stroke-width="1.2"/><path d="M14 15 H18" stroke="#2a2a2a" stroke-width="1.2"/>`,
  party: `<path d="M16 3 L20 9 L12 9 Z" fill="#e0475f"/><circle cx="6" cy="12" r="1" fill="#59d694"/><circle cx="26" cy="10" r="1" fill="#8b7fd1"/><circle cx="27" cy="18" r="1" fill="#f6c453"/>`,
  snow: `<path d="M26 10 v4 M24 12 h4 M24.6 10.6 l2.8 2.8 M27.4 10.6 l-2.8 2.8" stroke="#8fd3f4" stroke-width="0.9"/>`,
  plus: `<path d="M26 10 v4 M24 12 h4" stroke="#5fbf7a" stroke-width="1.3" stroke-linecap="round"/>`,
  question: `<text x="24" y="11" font-size="7" fill="#3a2410" font-family="sans-serif" font-weight="700">?</text>`,
};

const MOODS = [
  ["happy","Happy",EYES.dot,MOUTHS.smile,EXTRAS.none],
  ["sad","Sad",EYES.dotDown,MOUTHS.frown,EXTRAS.none],
  ["love","In love",EYES.heart,MOUTHS.smile,EXTRAS.none],
  ["laughing","Laughing",EYES.happyArc,MOUTHS.bigSmile,EXTRAS.none],
  ["wink","Wink",EYES.wink,MOUTHS.smirk,EXTRAS.none],
  ["surprised","Surprised",EYES.big,MOUTHS.o,EXTRAS.none],
  ["sleepy","Sleepy",EYES.closed,MOUTHS.line,EXTRAS.zzz],
  ["angry","Angry",EYES.angryBrow,MOUTHS.frown,EXTRAS.none],
  ["crying","Crying",EYES.dotDown,MOUTHS.frown,EXTRAS.tears],
  ["cool","Cool",EYES.sunglasses,MOUTHS.smirk,EXTRAS.none],
  ["tongue","Silly",EYES.happyArc,MOUTHS.tongue,EXTRAS.none],
  ["blush","Blushing",EYES.dot,MOUTHS.smile,EXTRAS.blush],
  ["confused","Confused",EYES.wink,MOUTHS.wavy,EXTRAS.question],
  ["starstruck","Starstruck",EYES.star,MOUTHS.o,EXTRAS.none],
  ["kiss","Kiss",EYES.happyArc,MOUTHS.kiss,EXTRAS.heartFloat],
  ["rofl","Dying laughing",EYES.x,MOUTHS.bigSmile,EXTRAS.tears],
  ["worried","Worried",EYES.dot,MOUTHS.wavy,EXTRAS.sweat],
  ["shy","Shy",EYES.dotDown,MOUTHS.smile,EXTRAS.blush],
  ["excited","Excited",EYES.big,MOUTHS.bigSmile,EXTRAS.sparkle],
  ["sick","Sick",EYES.dot,MOUTHS.wavy,EXTRAS.plus],
  ["dizzy","Dizzy",EYES.spiral,MOUTHS.wavy,EXTRAS.none],
  ["proud","Proud",EYES.happyArc,MOUTHS.smile,EXTRAS.none],
  ["sneaky","Sneaky",EYES.wink,MOUTHS.smirk,EXTRAS.none],
  ["scared","Scared",EYES.big,MOUTHS.o,EXTRAS.sweat],
  ["bored","Bored",EYES.closed,MOUTHS.line,EXTRAS.none],
  ["thinking","Thinking",EYES.dot,MOUTHS.line,EXTRAS.question],
  ["party","Party",EYES.happyArc,MOUTHS.bigSmile,EXTRAS.party],
  ["cold","Cold",EYES.dot,MOUTHS.wavy,EXTRAS.snow],
  ["hot","Hot",EYES.dot,MOUTHS.o,EXTRAS.sweat],
  ["nerdy","Nerdy",EYES.dot,MOUTHS.smile,EXTRAS.glasses],
  ["angel","Angel",EYES.dot,MOUTHS.smile,EXTRAS.halo],
  ["devil","Cheeky",EYES.wink,MOUTHS.smirk,EXTRAS.horns],
];

const MOON_EMOJIS = MOODS.map(([id, label, eyes, mouth, extra], i) => ({
  code: `:moon_${id}:`,
  label,
  svg: moonSvg(i, eyes + mouth + extra)
}));

// Sostituisce gli shortcode ":moon_xxx:" nel testo con la relativa icona SVG inline
function replaceMoonShortcodes(text) {
  let out = text;
  MOON_EMOJIS.forEach(m => {
    if (out.includes(m.code)) {
      out = out.split(m.code).join(`<span class="moon-emoji-inline">${m.svg}</span>`);
    }
  });
  return out;
}
