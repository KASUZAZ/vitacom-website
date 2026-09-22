const header = document.querySelector('.site-header');
const progress = document.getElementById('pageProgress');
const menuBtn = document.getElementById('menuBtn');
const navMenu = document.getElementById('navMenu');
const navLinks = [...document.querySelectorAll('.nav a')];

window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 20);
  const doc = document.documentElement;
  const max = doc.scrollHeight - doc.clientHeight;
  progress.style.width = `${max ? (doc.scrollTop / max) * 100 : 0}%`;

  let current = '';
  document.querySelectorAll('main section[id]').forEach(section => {
    if (scrollY >= section.offsetTop - 180) current = section.id;
  });
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href?.startsWith('#')) link.classList.toggle('active', href === `#${current}`);
  });
});

menuBtn?.addEventListener('click', () => {
  const open = navMenu.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', open);
});
navLinks.forEach(link => link.addEventListener('click', () => navMenu.classList.remove('open')));

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.13 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = Number(el.dataset.target || 0);
    const duration = 1600;
    const start = performance.now();
    const suffix = target >= 1000 ? '+' : '+';

    const tick = (now) => {
      if (el.dataset.cmsEdited === 'true') return;
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const value = Math.floor(target * eased);
      el.firstChild.nodeValue = target >= 1000 ? `${(value/1000).toFixed(value >= 1000 ? 1 : 0)}k${suffix}` : `${value}${suffix}`;
      if (p < 1) requestAnimationFrame(tick);
      else el.firstChild.nodeValue = target >= 1000 ? `${(target/1000).toFixed(1)}k+` : `${target}+`;
    };
    requestAnimationFrame(tick);
    counterObserver.unobserve(el);
  });
}, { threshold: .7 });

document.querySelectorAll('.counter').forEach(el => counterObserver.observe(el));

const tiltWrap = document.getElementById('tiltCard');
const tiltCard = tiltWrap?.querySelector('.hero-card');
if (tiltWrap && tiltCard && window.matchMedia('(pointer:fine)').matches) {
  tiltWrap.addEventListener('mousemove', e => {
    const r = tiltWrap.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5;
    const y = (e.clientY - r.top) / r.height - .5;
    tiltCard.style.transform = `rotateY(${x * 10}deg) rotateX(${y * -10}deg) translateZ(0)`;
  });
  tiltWrap.addEventListener('mouseleave', () => tiltCard.style.transform = 'rotateY(0deg) rotateX(0deg)');
}

if (window.matchMedia('(pointer:fine)').matches) {
  document.querySelectorAll('.magnetic').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${x * .11}px, ${y * .16}px)`;
    });
    btn.addEventListener('mouseleave', () => btn.style.transform = 'translate(0,0)');
  });
}

window.dispatchEvent(new Event('scroll'));
