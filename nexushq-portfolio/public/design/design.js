// Shared shell for the 2D design mockups: header, footer, theme toggle and the review bar.
// Each page sets <body data-page="..."> and leaves #head / #foot empty for this script.
(function () {
  const NAV = [
    ['home', 'Home', 'home.html'], ['about', 'About', 'about.html'], ['experience', 'Experience', 'experience.html'],
    ['projects', 'Projects', 'projects.html'], ['skills', 'Skills', 'skills.html'], ['opensource', 'Open source', 'open-source.html'],
    ['articles', 'Articles', 'articles.html'], ['contact', 'Contact', 'contact.html']
  ];
  const page = document.body.dataset.page || '';
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

  const saved = store.get('design-theme');
  if (saved) document.documentElement.dataset.theme = saved;
  const isDark = () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
  const sun = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const moon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  const toggle = () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next; store.set('design-theme', next);
    document.querySelectorAll('[data-theme-btn]').forEach((b) => { b.innerHTML = isDark() ? sun : moon; });
  };

  const head = document.getElementById('head');
  if (head) {
    head.outerHTML = '<header class="site-head"><div class="wrap">' +
      '<a class="brand" href="home.html"><b>coffee &amp; code</b><span>[YOUR NAME] · full-stack, AI &amp; cloud</span></a>' +
      '<nav class="nav" id="nav" aria-label="Main">' + NAV.map((n) => '<a href="' + n[2] + '"' + (n[0] === page ? ' aria-current="page"' : '') + '>' + n[1] + '</a>').join('') + '</nav>' +
      '<div class="head-actions">' +
      '<a class="btn btn-ghost" href="/3d" style="min-height:40px;padding:0 14px;font-size:14px">3D café</a>' +
      '<button class="icon-btn" data-theme-btn aria-label="Toggle dark mode"></button>' +
      '<button class="icon-btn menu-btn" aria-label="Menu" aria-controls="nav"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>' +
      '</div></div></header>';
  }
  const foot = document.getElementById('foot');
  if (foot) {
    foot.outerHTML = '<footer class="site-foot"><div class="wrap">' +
      '<span>© [YEAR] [YOUR NAME] · Made with coffee &amp; code</span>' +
      '<div class="row"><a class="link" href="#">GitHub</a><a class="link" href="#">LinkedIn</a><a class="link" href="contact.html">Email</a></div>' +
      '</div></footer>';
  }
  // the review bar is for the full page only, not the board's thumbnail previews
  if (window === window.top) document.body.insertAdjacentHTML('beforeend', '<div class="review-bar" role="navigation" aria-label="Design review"><span>Design mockup</span><a href="index.html">All pages</a><button data-theme-btn aria-label="Toggle dark mode"></button></div>');
  document.querySelectorAll('[data-theme-btn]').forEach((b) => { b.innerHTML = isDark() ? sun : moon; b.addEventListener('click', toggle); });
  const mb = document.querySelector('.menu-btn');
  if (mb) mb.addEventListener('click', () => document.getElementById('nav').classList.toggle('open'));

  // ---------- motion layer (skipped entirely for reduced-motion users) ----------
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('motion');

  // headline appears word by word
  document.querySelectorAll('[data-words]').forEach((h) => {
    let w = 0;
    const split = (node) => [...node.childNodes].forEach((c) => {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const s = document.createElement('span'); s.className = 'hw'; s.style.setProperty('--w', w++); s.textContent = part; frag.appendChild(s);
        });
        c.replaceWith(frag);
      } else if (c.nodeType === 1 && c.tagName !== 'BR') split(c);
    });
    split(h);
  });

  // scroll reveal: sections rise in once, siblings staggered
  const SEL = '.page-head > *, .card, .tl-item, .list-row, .figure, .band, .stat, .section > h2, .section > .row, .facts, .prose > *, .marquee';
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  document.querySelectorAll(SEL).forEach((el) => {
    if (el.closest('[data-reveal]') && el.closest('[data-reveal]') !== el) return;
    if (el.closest('[data-words], .hero')) return;
    const sibs = [...el.parentElement.children].filter((c) => c.matches(SEL));
    el.dataset.reveal = ''; el.style.setProperty('--i', Math.min(6, sibs.indexOf(el)));
    io.observe(el);
  });

  // portrait card tilts toward the cursor, with a soft moving highlight
  document.querySelectorAll('.hero-card').forEach((c) => {
    if (!c.querySelector('.shine')) c.insertAdjacentHTML('afterbegin', '<span class="shine"></span>');
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty('--ry', ((x - 0.5) * 10).toFixed(2) + 'deg'); c.style.setProperty('--rx', ((0.5 - y) * 8).toFixed(2) + 'deg');
      c.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); c.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    });
    c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
  });

  // numbers count up when they come into view: <b data-count="40" data-suffix="%">40%</b>
  const co = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; co.unobserve(e.target);
    const el = e.target, to = parseFloat(el.dataset.count), pre = el.dataset.prefix || '', suf = el.dataset.suffix || '', t0 = performance.now(), dur = 1400;
    const tick = (t) => { const k = Math.min(1, (t - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - k, 3))); el.textContent = pre + v + suf; if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach((el) => co.observe(el));
})();
