// Set di emoji "luna" con diverse espressioni.
// Ogni voce ha uno shortcode (salvato nel testo del messaggio, es. ":moon_happy:")
// e genera un piccolo SVG con base condivisa (grigio-lavanda, crateri, ombra a mezzaluna)
// + occhi/bocca/extra diversi, nello stile della luna vera usata nell'hero.

const MOON_BASE_GRADIENT = (id) => `
  <radialGradient id="mg${id}" cx="32%" cy="30%" r="75%">
    <stop offset="0%" stop-color="#f4f4f8"/>
    <stop offset="55%" stop-color="#c7c5d6"/>
    <stop offset="100%" stop-color="#9391a8"/>
  </radialGradient>
`;

function moonSvg(id, inner) {
  return `<svg viewBox="0 0 32 32" width="26" height="26">
    <defs>
      ${MOON_BASE_GRADIENT(id)}
      <clipPath id="mc${id}"><circle cx="16" cy="16" r="14"/></clipPath>
    </defs>
    <circle cx="16" cy="16" r="14" fill="url(#mg${id})"/>
    <g clip-path="url(#mc${id})">
      <circle cx="9" cy="10" r="2.6" fill="#00000014"/>
      <circle cx="21" cy="9" r="2" fill="#00000012"/>
      <circle cx="7" cy="20" r="1.8" fill="#00000012"/>
      <circle cx="13" cy="23" r="2.3" fill="#00000010"/>
      <circle cx="23" cy="18" r="1.6" fill="#00000010"/>
      <!-- ombra a mezzaluna (lato in ombra della luna) -->
      <ellipse cx="24" cy="16" rx="9" ry="15" fill="#5b5870" opacity="0.35"/>
    </g>
    ${inner}
  </svg>`;
}

// --- pezzi riutilizzabili ---
const EYES = {
  dot: `<circle cx="11" cy="15" r="1.5" fill="#2f2d3d"/><circle cx="21" cy="15" r="1.5" fill="#2f2d3d"/>`,
  dotDown: `<circle cx="11" cy="16.5" r="1.4" fill="#2f2d3d"/><circle cx="21" cy="16.5" r="1.4" fill="#2f2d3d"/>`,
  happyArc: `<path d="M9 15 Q11 12.5 13 15" stroke="#2f2d3d" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M19 15 Q21 12.5 23 15" stroke="#2f2d3d" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  wink: `<circle cx="11" cy="15" r="1.5" fill="#2f2d3d"/><path d="M19 15 Q21 12.5 23 15" stroke="#2f2d3d" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  big: `<circle cx="11" cy="15" r="2.6" fill="#2f2d3d"/><circle cx="21" cy="15" r="2.6" fill="#2f2d3d"/>`,
  closed: `<path d="M9 15 H13" stroke="#2f2d3d" stroke-width="1.4" stroke-linecap="round"/><path d="M19 15 H23" stroke="#2f2d3d" stroke-width="1.4" stroke-linecap="round"/>`,
  heart: `<path d="M11 14c-1-1.3-3-0.6-3 0.7 0 1.3 3 2.6 3 2.6s3-1.3 3-2.6c0-1.3-2-2-3-0.7z" fill="#e0475f"/><path d="M21 14c-1-1.3-3-0.6-3 0.7 0 1.3 3 2.6 3 2.6s3-1.3 3-2.6c0-1.3-2-2-3-0.7z" fill="#e0475f"/>`,
  x: `<path d="M9.5 13.5 L12.5 16.5 M12.5 13.5 L9.5 16.5" stroke="#2f2d3d" stroke-width="1.3" stroke-linecap="round"/><path d="M19.5 13.5 L22.5 16.5 M22.5 13.5 L19.5 16.5" stroke="#2f2d3d" stroke-width="1.3" stroke-linecap="round"/>`,
  star: `<path d="M11 12l0.8 1.8 2 0.2-1.5 1.3 0.5 2-1.8-1.1-1.8 1.1 0.5-2-1.5-1.3 2-0.2z" fill="#2f2d3d"/><path d="M21 12l0.8 1.8 2 0.2-1.5 1.3 0.5 2-1.8-1.1-1.8 1.1 0.5-2-1.5-1.3 2-0.2z" fill="#2f2d3d"/>`,
  angryBrow: `<circle cx="11" cy="15.5" r="1.4" fill="#2f2d3d"/><circle cx="21" cy="15.5" r="1.4" fill="#2f2d3d"/><path d="M9 12.5 L13 13.8" stroke="#2f2d3d" stroke-width="1.3" stroke-linecap="round"/><path d="M23 12.5 L19 13.8" stroke="#2f2d3d" stroke-width="1.3" stroke-linecap="round"/>`,
  sunglasses: `<rect x="8" y="13.5" width="16" height="3.4" rx="1.5" fill="#2a2a2a"/><path d="M8 15 h-2 M24 15 h2" stroke="#2a2a2a" stroke-width="1.2"/>`,
  spiral: `<circle cx="11" cy="15" r="2" fill="none" stroke="#2f2d3d" stroke-width="1"/><circle cx="21" cy="15" r="2" fill="none" stroke="#2f2d3d" stroke-width="1"/>`,
  sad: `<path d="M9 16 Q11 13.5 13 16" stroke="#2f2d3d" stroke-width="1.4" fill="none" stroke-linecap="round" transform="rotate(180 11 15)"/><path d="M19 16 Q21 13.5 23 16" stroke="#2f2d3d" stroke-width="1.4" fill="none" stroke-linecap="round" transform="rotate(180 21 15)"/>`,
};

const MOUTHS = {
  smile: `<path d="M11 20 Q16 24 21 20" stroke="#2f2d3d" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  bigSmile: `<path d="M10 19.5 Q16 26 22 19.5 Q16 23 10 19.5 Z" fill="#2f2d3d"/>`,
  frown: `<path d="M11 22 Q16 18 21 22" stroke="#2f2d3d" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  o: `<ellipse cx="16" cy="21" rx="2.2" ry="2.8" fill="#2f2d3d"/>`,
  line: `<path d="M12 21 H20" stroke="#2f2d3d" stroke-width="1.4" stroke-linecap="round"/>`,
  smirk: `<path d="M12 20.5 Q17 22.5 20 19.5" stroke="#2f2d3d" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  tongue: `<path d="M11 19.5 Q16 23.5 21 19.5" stroke="#2f2d3d" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M14.5 21.5 Q16 26 17.5 21.5 Z" fill="#e0475f"/>`,
  kiss: `<ellipse cx="16" cy="21" rx="1.6" ry="1.2" fill="#2f2d3d"/>`,
  wavy: `<path d="M11 21 Q13 19.5 15 21 Q17 22.5 21 21" stroke="#2f2d3d" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
};

const EXTRAS = {
  none: ``,
  tears: `<ellipse cx="8" cy="19" rx="1.1" ry="1.8" fill="#5fb8e0"/><ellipse cx="24" cy="19" rx="1.1" ry="1.8" fill="#5fb8e0"/>`,
  sweat: `<path d="M25 11c1 1.4 1.6 2.4 1.6 3.3 0 0.9-0.7 1.6-1.6 1.6s-1.6-0.7-1.6-1.6c0-0.9 0.6-1.9 1.6-3.3z" fill="#5fb8e0"/>`,
  blush: `<circle cx="9" cy="18.5" r="1.6" fill="#f2a0a8" opacity="0.75"/><circle cx="23" cy="18.5" r="1.6" fill="#f2a0a8" opacity="0.75"/>`,
  zzz: `<text x="23" y="9" font-size="6" fill="#2f2d3d" font-family="sans-serif" font-weight="700">Z</text><text x="27" y="6" font-size="4.5" fill="#2f2d3d" font-family="sans-serif" font-weight="700">z</text>`,
  heartFloat: `<path d="M27 8c-0.6-0.8-1.9-0.4-1.9 0.5 0 0.9 1.9 1.7 1.9 1.7s1.9-0.8 1.9-1.7c0-0.9-1.3-1.3-1.9-0.5z" fill="#e0475f"/>`,
  sparkle: `<path d="M6 8l0.5 1.3 1.3 0.3-1.3 0.9 0.3 1.4-1.3-0.8-1.3 0.8 0.3-1.4-1.3-0.9 1.3-0.3z" fill="#f6c453"/>`,
  halo: `<ellipse cx="16" cy="4" rx="5" ry="1.6" fill="none" stroke="#f6c453" stroke-width="1.3"/>`,
  horns: `<path d="M10 5 L11.5 9 L8.5 8 Z" fill="#2f2d3d"/><path d="M22 5 L23.5 8 L20.5 9 Z" fill="#2f2d3d"/>`,
  glasses: `<circle cx="11" cy="15" r="3" fill="none" stroke="#2a2a2a" stroke-width="1.2"/><circle cx="21" cy="15" r="3" fill="none" stroke="#2a2a2a" stroke-width="1.2"/><path d="M14 15 H18" stroke="#2a2a2a" stroke-width="1.2"/>`,
  party: `<path d="M16 3 L20 9 L12 9 Z" fill="#e0475f"/><circle cx="6" cy="12" r="1" fill="#59d694"/><circle cx="26" cy="10" r="1" fill="#8b7fd1"/><circle cx="27" cy="18" r="1" fill="#f6c453"/>`,
  snow: `<path d="M26 10 v4 M24 12 h4 M24.6 10.6 l2.8 2.8 M27.4 10.6 l-2.8 2.8" stroke="#8fd3f4" stroke-width="0.9"/>`,
  plus: `<path d="M26 10 v4 M24 12 h4" stroke="#5fbf7a" stroke-width="1.3" stroke-linecap="round"/>`,
  question: `<text x="24" y="11" font-size="7" fill="#2f2d3d" font-family="sans-serif" font-weight="700">?</text>`,
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

// ── Luna a forma di cuore e sole, in rosso, per esprimere affetto ──
function heartMoonSvg(id, inner) {
  return `<svg viewBox="0 0 32 32" width="26" height="26">
    <defs>
      <radialGradient id="hm${id}" cx="35%" cy="28%" r="80%">
        <stop offset="0%" stop-color="#ffd2da"/>
        <stop offset="45%" stop-color="#e0475f"/>
        <stop offset="100%" stop-color="#a3293c"/>
      </radialGradient>
    </defs>
    <path d="M16 28.5s-11-6.2-11-14.3A7 7 0 0 1 16 8a7 7 0 0 1 11 6.2c0 8.1-11 14.3-11 14.3z" fill="url(#hm${id})"/>
    ${inner}
  </svg>`;
}

function sunLoveSvg(id, inner) {
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * 45) * Math.PI / 180;
    const x1 = (16 + Math.cos(a) * 11).toFixed(1), y1 = (16 + Math.sin(a) * 11).toFixed(1);
    const x2 = (16 + Math.cos(a) * 15).toFixed(1), y2 = (16 + Math.sin(a) * 15).toFixed(1);
    rays += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="url(#sn${id})" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  return `<svg viewBox="0 0 32 32" width="26" height="26">
    <defs>
      <radialGradient id="sn${id}" cx="35%" cy="28%" r="80%">
        <stop offset="0%" stop-color="#ffc19e"/>
        <stop offset="50%" stop-color="#e0655f"/>
        <stop offset="100%" stop-color="#a3293c"/>
      </radialGradient>
    </defs>
    ${rays}
    <circle cx="16" cy="16" r="10" fill="url(#sn${id})"/>
    ${inner}
  </svg>`;
}

MOON_EMOJIS.push({
  code: ':moon_heart_red:',
  label: 'Heart moon',
  svg: heartMoonSvg('extra1', EYES.happyArc + MOUTHS.smile)
});
MOON_EMOJIS.push({
  code: ':sun_love:',
  label: 'Warm sun',
  svg: sunLoveSvg('extra2', EYES.happyArc + MOUTHS.smile)
});


// -- 6 in piu' a tema affetto, per completare la fila --
const HEART_PATH = 'M16 28.5s-11-6.2-11-14.3A7 7 0 0 1 16 8a7 7 0 0 1 11 6.2c0 8.1-11 14.3-11 14.3z';

function plainHeartSvg(id, grad, extra) {
  return `<svg viewBox="0 0 32 32" width="26" height="26">
    <defs>${grad}</defs>
    <path d="${HEART_PATH}" fill="url(#${id})"/>
    ${extra || ''}
  </svg>`;
}

// Cuore che brilla (glow)
MOON_EMOJIS.push({
  code: ':heart_glow:',
  label: 'Glowing heart',
  svg: `<svg viewBox="0 0 32 32" width="26" height="26">
    <defs>
      <radialGradient id="hg1" cx="35%" cy="28%" r="85%">
        <stop offset="0%" stop-color="#fff0c2"/>
        <stop offset="35%" stop-color="#ff8a5b"/>
        <stop offset="100%" stop-color="#e0475f"/>
      </radialGradient>
    </defs>
    <path d="${HEART_PATH}" fill="url(#hg1)" style="filter:drop-shadow(0 0 4px rgba(255,150,120,0.65))"/>
  </svg>`
});

// Cuore con stelline
MOON_EMOJIS.push({
  code: ':heart_sparkle:',
  label: 'Sparkling heart',
  svg: plainHeartSvg('hs1', `
    <radialGradient id="hs1" cx="35%" cy="28%" r="80%">
      <stop offset="0%" stop-color="#ffd2da"/>
      <stop offset="45%" stop-color="#f06d8c"/>
      <stop offset="100%" stop-color="#c23a5a"/>
    </radialGradient>
  `, `
    <path d="M25 6l0.7 1.7 1.7 0.7-1.7 0.7-0.7 1.7-0.7-1.7-1.7-0.7 1.7-0.7z" fill="#fff6de"/>
    <path d="M6 20l0.5 1.2 1.2 0.5-1.2 0.5-0.5 1.2-0.5-1.2-1.2-0.5 1.2-0.5z" fill="#fff6de"/>
  `)
});

// Cuore rosa
MOON_EMOJIS.push({
  code: ':heart_pink:',
  label: 'Pink heart',
  svg: plainHeartSvg('hp1', `
    <radialGradient id="hp1" cx="35%" cy="28%" r="80%">
      <stop offset="0%" stop-color="#ffe4ec"/>
      <stop offset="50%" stop-color="#f2a0c4"/>
      <stop offset="100%" stop-color="#d1639a"/>
    </radialGradient>
  `)
});

// Faccina lunare innamorata, circondata di cuoricini
MOON_EMOJIS.push({
  code: ':moon_surrounded_hearts:',
  label: 'Surrounded by love',
  svg: moonSvg('lv1', EYES.heart + MOUTHS.smile + `
    <path d="M26 8c-0.6-0.8-1.9-0.4-1.9 0.5 0 0.9 1.9 1.7 1.9 1.7s1.9-0.8 1.9-1.7c0-0.9-1.3-1.3-1.9-0.5z" fill="#e0475f"/>
    <path d="M6 10c-0.5-0.7-1.6-0.3-1.6 0.4 0 0.7 1.6 1.4 1.6 1.4s1.6-0.7 1.6-1.4c0-0.7-1.1-1.1-1.6-0.4z" fill="#e0475f"/>
    <path d="M8 24c-0.5-0.7-1.6-0.3-1.6 0.4 0 0.7 1.6 1.4 1.6 1.4s1.6-0.7 1.6-1.4c0-0.7-1.1-1.1-1.6-0.4z" fill="#e0475f"/>
  `)
});

// Doppio cuore
MOON_EMOJIS.push({
  code: ':heart_double:',
  label: 'Double heart',
  svg: `<svg viewBox="0 0 32 32" width="26" height="26">
    <defs>
      <radialGradient id="hd1" cx="35%" cy="28%" r="80%">
        <stop offset="0%" stop-color="#ffd2da"/>
        <stop offset="45%" stop-color="#f2a0c4"/>
        <stop offset="100%" stop-color="#c96a94"/>
      </radialGradient>
      <radialGradient id="hd2" cx="35%" cy="28%" r="80%">
        <stop offset="0%" stop-color="#ffd2da"/>
        <stop offset="45%" stop-color="#e0475f"/>
        <stop offset="100%" stop-color="#a3293c"/>
      </radialGradient>
    </defs>
    <path d="${HEART_PATH}" fill="url(#hd1)" opacity="0.85" transform="translate(-4,-3) scale(0.72)"/>
    <path d="${HEART_PATH}" fill="url(#hd2)" transform="translate(3,3) scale(0.8)"/>
  </svg>`
});

// Cuore spezzato
MOON_EMOJIS.push({
  code: ':heart_broken:',
  label: 'Broken heart',
  svg: plainHeartSvg('hb1', `
    <radialGradient id="hb1" cx="35%" cy="28%" r="80%">
      <stop offset="0%" stop-color="#ffd2da"/>
      <stop offset="45%" stop-color="#e0475f"/>
      <stop offset="100%" stop-color="#a3293c"/>
    </radialGradient>
  `, `
    <path d="M17.5 9 L14 15 L18.5 17.5 L13.5 23.5 L16.5 28.5" stroke="#1c1a3a" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  `)
});

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
