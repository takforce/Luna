function buildStarfield() {
  const field = document.createElement('div');
  field.className = 'starfield';
  const n = window.innerWidth < 640 ? 75 : 130;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    // circa 1 stella su 7 e' un po' piu' grande e luminosa
    const isBig = Math.random() < 0.14;
    s.className = 'star' + (isBig ? ' star-big' : '');
    const size = isBig ? (Math.random() * 1.6 + 2.6) : (Math.random() * 2.0 + 0.6);
    s.style.width = size + 'px';
    s.style.height = size + 'px';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 100 + '%';
    s.style.animationDuration = (Math.random() * 2 + 2.8) + 's';
    s.style.animationDelay = (Math.random() * 4) + 's';
    field.appendChild(s);
  }
  const shootCount = window.innerWidth < 640 ? 4 : 6;
  for (let i = 0; i < shootCount; i++) {
    const sh = document.createElement('div');
    sh.className = 'shooting-star';
    sh.style.left = (5 + Math.random() * 60) + '%';
    sh.style.top = (2 + Math.random() * 75) + '%';
    sh.style.setProperty('--dist', (180 + Math.random() * 110) + 'px');
    sh.style.setProperty('--angle', (26 + Math.random() * 18) + 'deg');
    sh.style.animationDuration = (4 + Math.random() * 2.5) + 's';
    sh.style.animationDelay = (i * 3 + Math.random() * 4) + 's';
    field.appendChild(sh);
  }
  document.body.prepend(field);
}
document.addEventListener('DOMContentLoaded', buildStarfield);
