function buildStarfield() {
  const field = document.createElement('div');
  field.className = 'starfield';
  const n = window.innerWidth < 640 ? 45 : 80;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size = Math.random() * 2.2 + 0.6;
    s.style.width = size + 'px';
    s.style.height = size + 'px';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 100 + '%';
    s.style.animationDelay = (Math.random() * 3.5) + 's';
    field.appendChild(s);
  }
  for (let i = 0; i < 3; i++) {
    const sh = document.createElement('div');
    sh.className = 'shooting-star';
    sh.style.left = (10 + Math.random() * 60) + '%';
    sh.style.top = (5 + Math.random() * 40) + '%';
    sh.style.animationDelay = (i * 4 + Math.random() * 3) + 's';
    field.appendChild(sh);
  }
  document.body.prepend(field);
}
document.addEventListener('DOMContentLoaded', buildStarfield);
