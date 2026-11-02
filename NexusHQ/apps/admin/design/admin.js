/* NexusHQ admin design mockup. Static, no backend: every section is described by a schema
   (list columns + editor fields) and rendered from placeholder data, so reviewing a new
   section only means adding an entry to SECTIONS. Routing is by #hash. */
(function () {
  'use strict';

  const I = {
    home: '<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    brief: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    cap: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    git: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="8" r="2.5"/><path d="M6 8.5v7M18 10.5c0 4-6 3-11 6"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    quote: '<path d="M7 7h4v6a4 4 0 0 1-4 4M14 7h4v6a4 4 0 0 1-4 4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    drag: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    text: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    coffee: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  };
  const icon = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24">${I[n]}</svg>`;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const status = (s) => `<span class="chip ${s === 'Published' ? 'pub' : s === 'Draft' ? 'draft' : s === 'Pending' ? 'pending' : 'hidden'}">${s}</span>`;

  /* ---------------- content schemas ----------------
     columns: [label, (item) => html]
     fields:  { k, label, type, opts, full, hint } — type: text | textarea | rich | select | tags | list | links | toggle | image | date | number | seg */
  const common = [{ k: 'status', label: 'Visibility', type: 'seg', opts: ['Published', 'Draft', 'Hidden'] }];

  const SECTIONS = {
    profile: { label: 'Profile & About', icon: 'user', kind: 'profile', blurb: 'Who you are: the hero on Home, the About story, availability and social links.' },
    experience: {
      label: 'Experience', icon: 'brief', kind: 'table', singular: 'role',
      blurb: 'Jobs and contracts shown on the Experience timeline, newest first.',
      items: [
        { title: 'Senior Full-stack Engineer', sub: 'NexusLabs · Remote', from: 'Mar 2023', to: 'Present', type: 'Full-time', status: 'Published', skills: ['Next.js', 'Postgres', 'AI'] },
        { title: 'Full-stack Developer', sub: 'Freelance (Upwork)', from: 'Jan 2021', to: 'Feb 2023', type: 'Contract', status: 'Published', skills: ['React', 'Node', 'Stripe'] },
        { title: 'Frontend Developer', sub: 'Brightside Studio · Mumbai', from: 'Jun 2019', to: 'Dec 2020', type: 'Full-time', status: 'Published', skills: ['Vue', 'Svelte'] },
        { title: 'Engineering Intern', sub: 'CloudKite', from: 'Jan 2019', to: 'May 2019', type: 'Internship', status: 'Draft', skills: ['Python'] },
      ],
      columns: [
        ['Role', (r) => `<div class="cell-main"><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></div>`],
        ['Dates', (r) => `<span class="muted">${r.from} – ${r.to}</span>`, 'hide-sm'],
        ['Type', (r) => `<span class="chip plain">${r.type}</span>`, 'hide-sm'],
        ['Status', (r) => status(r.status)],
      ],
      fields: [
        { group: 'Role' },
        { k: 'title', label: 'Job title', type: 'text' },
        { k: 'company', label: 'Company', type: 'text', value: (r) => r.sub.split(' · ')[0] },
        { k: 'from', label: 'Start', type: 'text', hint: 'e.g. Mar 2023' },
        { k: 'to', label: 'End', type: 'text', hint: 'Leave empty for “Present”' },
        { k: 'place', label: 'Location', type: 'text', value: () => 'Remote' },
        { k: 'type', label: 'Employment type', type: 'select', opts: ['Full-time', 'Contract', 'Part-time', 'Internship', 'Freelance'] },
        { group: 'Story' },
        { k: 'summary', label: 'Summary', type: 'textarea', full: true, value: () => 'Leading the platform team building AI-assisted tooling for small agencies.' },
        { k: 'highlights', label: 'Highlights', type: 'list', full: true, value: () => ['Cut page load by 48% with streaming SSR', 'Shipped a Stripe billing revamp used by 3k teams'] },
        { k: 'skills', label: 'Skills used', type: 'tags', full: true },
        { group: 'Publishing' }, ...common,
      ],
    },
    education: {
      label: 'Education', icon: 'cap', kind: 'table', singular: 'entry',
      blurb: 'Degrees, courses and certifications under the Experience timeline.',
      items: [
        { title: 'B.E. Computer Engineering', sub: 'University of Mumbai', when: '2015 – 2019', status: 'Published' },
        { title: 'AWS Certified Developer', sub: 'Amazon Web Services', when: '2022', status: 'Published' },
      ],
      columns: [
        ['Title', (r) => `<div class="cell-main"><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></div>`],
        ['When', (r) => `<span class="muted">${r.when}</span>`, 'hide-sm'],
        ['Status', (r) => status(r.status)],
      ],
      fields: [
        { group: 'Details' },
        { k: 'title', label: 'Title', type: 'text', full: true },
        { k: 'org', label: 'Institution', type: 'text', value: (r) => r.sub },
        { k: 'when', label: 'When', type: 'text' },
        { k: 'subjects', label: 'Subjects / topics', type: 'tags', full: true, value: () => ['Algorithms', 'Distributed systems', 'Databases'] },
        { k: 'cert', label: 'Certificate', type: 'image', full: true, hint: 'PDF or image, optional' },
        { group: 'Publishing' }, ...common,
      ],
    },
    projects: {
      label: 'Projects', icon: 'folder', kind: 'table', singular: 'project',
      blurb: 'Cards on Projects (and the bookshelf in the 3D café). Each one can open a full case study.',
      items: [
        { title: 'NexusHQ', sub: 'Platform · 2026', cat: 'platform', featured: true, status: 'Published', skills: ['Next.js', 'Supabase', 'AI'] },
        { title: 'Coffee & Code Café', sub: '3D portfolio · 2026', cat: 'web', featured: true, status: 'Published', skills: ['WebGL2', 'Blender'] },
        { title: 'ProposalPilot', sub: 'AI tool · 2025', cat: 'ai', featured: false, status: 'Published', skills: ['LLMs', 'Node'] },
        { title: 'ShopLite', sub: 'E-commerce · 2024', cat: 'web', featured: false, status: 'Draft', skills: ['SvelteKit', 'Stripe'] },
        { title: 'Ledgerly', sub: 'SaaS · 2023', cat: 'platform', featured: false, status: 'Hidden', skills: ['React', 'Postgres'] },
      ],
      columns: [
        ['Project', (r) => `<div class="row-flex"><div class="thumb"></div><div class="cell-main"><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></div></div>`],
        ['Category', (r) => `<span class="chip plain">${r.cat}</span>`, 'hide-sm'],
        ['Featured', (r) => (r.featured ? '<span class="chip label plain">★ Featured</span>' : '<span class="faint">—</span>'), 'hide-sm'],
        ['Status', (r) => status(r.status)],
      ],
      fields: [
        { group: 'Card' },
        { k: 'title', label: 'Name', type: 'text' },
        { k: 'slug', label: 'URL slug', type: 'text', value: (r) => r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), hint: '/projects/…' },
        { k: 'kind', label: 'Kind', type: 'text', value: (r) => r.sub.split(' · ')[0] },
        { k: 'year', label: 'Year', type: 'text', value: (r) => r.sub.split(' · ')[1] },
        { k: 'cat', label: 'Category (filter)', type: 'select', opts: ['web', 'ai', 'platform'] },
        { k: 'featured', label: 'Feature on Projects and Home', type: 'toggle' },
        { k: 'summary', label: 'Card summary', type: 'textarea', full: true, value: () => 'One place to run a freelance business: portfolio, AI job radar and proposals.' },
        { k: 'cover', label: 'Cover image', type: 'image', full: true },
        { k: 'skills', label: 'Stack', type: 'tags', full: true },
        { k: 'links', label: 'Links', type: 'links', full: true },
        { group: 'Case study' },
        { k: 'role', label: 'Your role', type: 'text', value: () => 'Solo builder' },
        { k: 'timeline', label: 'Timeline', type: 'text', value: () => '8 weeks' },
        { k: 'team', label: 'Team', type: 'text', value: () => 'Just me + 1 designer' },
        { k: 'problem', label: 'The problem', type: 'textarea', full: true },
        { k: 'built', label: 'What I built', type: 'textarea', full: true },
        { k: 'decisions', label: 'Key decisions', type: 'list', full: true, value: () => ['Supabase RLS instead of a custom API', 'Static-first rendering'] },
        { k: 'results', label: 'Results', type: 'textarea', full: true },
        { k: 'quote', label: 'Client quote', type: 'select', opts: ['None', 'Link a testimonial…', '“Delivered ahead of schedule” — Sara K.'], full: true, hint: 'Pick from approved testimonials' },
        { group: 'Publishing' }, ...common,
      ],
    },
    skills: { label: 'Skills', icon: 'spark', kind: 'skills', blurb: 'Grouped skill chips on the Skills page. Drag to reorder groups and chips.' },
    opensource: {
      label: 'Open source', icon: 'git', kind: 'table', singular: 'repo',
      blurb: 'Libraries you maintain or contribute to.',
      items: [
        { title: 'svelte-motion-kit', sub: 'Maintainer', badge: '1.2k ★', status: 'Published' },
        { title: 'supabase-js', sub: 'Contributor', badge: '6 PRs', status: 'Published' },
        { title: 'next-view-transitions', sub: 'Contributor', badge: '2 PRs', status: 'Draft' },
      ],
      columns: [
        ['Repository', (r) => `<div class="cell-main"><b class="mono" style="font-size:13px">${esc(r.title)}</b><small>${esc(r.sub)}</small></div>`],
        ['Badge', (r) => `<span class="chip plain">${r.badge}</span>`, 'hide-sm'],
        ['Status', (r) => status(r.status)],
      ],
      fields: [
        { group: 'Repository' },
        { k: 'title', label: 'Name', type: 'text' },
        { k: 'relation', label: 'Your relation', type: 'select', opts: ['Maintainer', 'Contributor', 'Creator'], value: (r) => r.sub },
        { k: 'url', label: 'GitHub URL', type: 'text', full: true, value: (r) => `https://github.com/abiali/${r.title}` },
        { k: 'badge', label: 'Badge', type: 'text', hint: 'Stars, PR count… auto-sync later' },
        { k: 'summary', label: 'Summary', type: 'textarea', full: true },
        { group: 'Publishing' }, ...common,
      ],
    },
    articles: {
      label: 'Articles', icon: 'pen', kind: 'table', singular: 'article',
      blurb: 'Writing on the Articles page (and the newspaper in the café).',
      items: [
        { title: 'Building a 3D portfolio without a framework', sub: '8 min read', date: 'Oct 12, 2026', status: 'Published' },
        { title: 'Supabase RLS patterns for solo founders', sub: '6 min read', date: 'Sep 2, 2026', status: 'Published' },
        { title: 'What I learned from 200 Upwork proposals', sub: '5 min read', date: '—', status: 'Draft' },
      ],
      columns: [
        ['Title', (r) => `<div class="cell-main"><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></div>`],
        ['Date', (r) => `<span class="muted">${r.date}</span>`, 'hide-sm'],
        ['Status', (r) => status(r.status)],
      ],
      fields: [
        { group: 'Article' },
        { k: 'title', label: 'Title', type: 'text', full: true },
        { k: 'slug', label: 'URL slug', type: 'text', value: (r) => r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) },
        { k: 'date', label: 'Publish date', type: 'date' },
        { k: 'summary', label: 'Summary', type: 'textarea', full: true },
        { k: 'cover', label: 'Cover image', type: 'image', full: true },
        { k: 'body', label: 'Body', type: 'rich', full: true },
        { group: 'Publishing' }, ...common,
      ],
    },
    gallery: { label: 'Gallery', icon: 'image', kind: 'gallery', blurb: 'Photos for the About page gallery. Drop files to upload; drag to reorder.' },
    hobbies: {
      label: 'Hobbies', icon: 'heart', kind: 'table', singular: 'hobby',
      blurb: 'Small “outside of work” cards on About.',
      items: [
        { title: 'Specialty coffee', sub: 'Pour-over experiments every morning', status: 'Published' },
        { title: 'Cycling', sub: 'Weekend rides along the coast', status: 'Published' },
        { title: '3D modelling', sub: 'Blender scenes, mostly cafés', status: 'Published' },
      ],
      columns: [
        ['Hobby', (r) => `<div class="cell-main"><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></div>`],
        ['Status', (r) => status(r.status)],
      ],
      fields: [
        { group: 'Card' },
        { k: 'title', label: 'Title', type: 'text', full: true },
        { k: 'body', label: 'Short text', type: 'textarea', full: true, value: (r) => r.sub },
        { k: 'photo', label: 'Photo (optional)', type: 'image', full: true },
        { group: 'Publishing' }, ...common,
      ],
    },
    testimonials: { label: 'Testimonials', icon: 'quote', kind: 'testimonials', blurb: 'Collect text, video and audio testimonials with a share link, review them, then choose where they show.' },
    cafe: { label: '3D café', icon: 'coffee', kind: 'cafe', blurb: 'Words that only exist in the 3D café: signs, the panel each object opens, and credits for the 3D model artists. Panel lists themselves come from the sections above.' },
  };

  const CAFE_PANELS = [
    ['Barista (owner)', 'about', 'The barista', 'Hey, I am Abiali', 'Profile & About'],
    ['Menu board', 'skills', 'The menu board', 'What I brew', 'Skills'],
    ['Bookshelf', 'projects', 'The bookshelf', 'Things I have built', 'Projects'],
    ['Framed photos', 'experience', 'The framed photos', 'Where I have worked', 'Experience'],
    ['Newspaper', 'articles', 'The newspaper', 'The Daily Read', 'Articles'],
    ['DJ booth', 'hobbies', 'The DJ booth', 'Off the clock', 'Hobbies'],
    ['Cookie jar', 'opensource', 'The free cookie jar', 'Open source', 'Open source'],
    ['Photo wall', 'gallery', 'The photo wall', 'Snapshots', 'Gallery (first 6)'],
    ['Business cards', 'contact', 'The business cards', 'Take a card', 'Profile · socials'],
    ['Notice board', 'credits', 'The notice board', 'Thank you', 'Model credits below'],
  ];
  const CREDITS = [['Bar Table', 'CommonSpence'], ['Bar Stool', 'CommonSpence'], ['Bench Sofa', 'rhdustxx'], ['Speakers Low Poly', 'Condo'], ['Chalkboard sign', 'clon6767'], ['Cookie', 'plaggy'], ['Low-Poly Modern Laptop', 'murattd3v'], ['Magnolia in a vase', 'Andrei V']];

  const NAV = [
    { single: 'dashboard', label: 'Dashboard', icon: 'home' },
    { group: 'Portfolio', icon: 'folder', open: true, items: ['profile', 'experience', 'education', 'projects', 'skills', 'opensource', 'articles', 'gallery', 'hobbies', 'testimonials', 'cafe'] },
    { group: 'Inbox', icon: 'mail', open: false, items: ['messages'] },
    { group: 'Upwork cockpit', icon: 'bolt', open: false, items: ['jobs', 'proposals'] },
    { group: 'Settings', icon: 'gear', open: false, items: ['users', 'site'] },
  ];
  const EXTRA = {
    dashboard: { label: 'Dashboard' },
    messages: { label: 'Contact messages', icon: 'mail', count: 2 },
    jobs: { label: 'Job radar', icon: 'bolt' },
    proposals: { label: 'Proposals', icon: 'pen' },
    users: { label: 'Users & roles', icon: 'shield' },
    site: { label: 'Site settings', icon: 'gear' },
  };
  const metaOf = (k) => SECTIONS[k] || EXTRA[k];

  /* ---------------- testimonials data ---------------- */
  const TESTIMONIALS = [
    { id: 1, name: 'Sara Khan', role: 'Founder, Brightside Studio', type: 'video', state: 'Pending', when: '2 hours ago', dur: '1:12', rating: 5, text: 'Abiali rebuilt our booking flow in three weeks and conversions went up straight away…', via: 'Request link' },
    { id: 2, name: 'Tom Reyes', role: 'CTO, Ledgerly', type: 'text', state: 'Pending', when: 'Yesterday', rating: 5, text: 'Rare mix of product sense and engineering depth. Communicates early, ships calmly, and leaves the codebase better than he found it.', via: 'Request link' },
    { id: 3, name: 'Priya N.', role: 'Upwork client', type: 'audio', state: 'Approved', when: 'Oct 2', dur: '0:48', rating: 5, text: 'He understood what we needed before we did. The dashboard is still the thing our team opens first every morning.', via: 'Open link', showOn: ['Home', 'About'] },
    { id: 4, name: 'Marco Bellini', role: 'PM, CloudKite', type: 'text', state: 'Approved', when: 'Sep 18', rating: 4, text: 'Delivered ahead of schedule and documented everything. Would hire again without a second thought.', via: 'Added manually', showOn: ['Projects: Ledgerly'] },
    { id: 5, name: 'Lena Fischer', role: 'Design lead', type: 'video', state: 'Approved', when: 'Aug 30', dur: '0:54', rating: 5, text: 'Every pixel of the design survived the build — that almost never happens.', via: 'Request link', showOn: ['Home'] },
    { id: 6, name: 'Anonymous', role: '—', type: 'text', state: 'Archived', when: 'Aug 2', rating: 3, text: 'Good work overall.', via: 'Open link' },
  ];
  const REQUESTS = [
    { to: 'Sara Khan', email: 'sara@brightside.studio', sent: 'Oct 15', state: 'Submitted' },
    { to: 'Tom Reyes', email: 'tom@ledgerly.io', sent: 'Oct 14', state: 'Submitted' },
    { to: 'Jess Park', email: 'jess@lumen.dev', sent: 'Oct 10', state: 'Opened' },
    { to: 'Omar Ali', email: 'omar@fieldnote.app', sent: 'Oct 9', state: 'Not opened' },
  ];

  /* ---------------- shell ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const view = $('#view');
  const openState = {};

  function renderNav(active) {
    $('#nav').innerHTML = NAV.map((g, gi) => {
      if (g.single) {
        return `<div class="nav-group"><a class="nav-head nav-link nav-single" href="#${g.single}" ${active === g.single ? 'aria-current="page"' : ''}>${icon(g.icon)}${g.label}</a></div>`;
      }
      const open = openState[gi] ?? (g.open || g.items.includes(active));
      const links = g.items.map((k) => {
        const m = metaOf(k);
        const badge = k === 'testimonials' ? `<span class="dot">${TESTIMONIALS.filter((t) => t.state === 'Pending').length}</span>`
          : m.count ? `<span class="dot">${m.count}</span>`
          : m.items ? `<span class="count">${m.items.length}</span>` : '';
        return `<a class="nav-link" href="#${k}" ${active === k ? 'aria-current="page"' : ''}>${m.label}${badge}</a>`;
      }).join('');
      return `<div class="nav-group" data-open="${open}"><button class="nav-head" data-g="${gi}" aria-expanded="${open}">${icon(g.icon)}${g.group}${icon('chev', 'i chev')}</button><div class="nav-items"><div>${links}</div></div></div>`;
    }).join('');
  }
  $('#nav').addEventListener('click', (e) => {
    const h = e.target.closest('button.nav-head');
    if (!h) { if (e.target.closest('a')) document.body.classList.remove('nav-open'); return; }
    const grp = h.parentElement;
    const open = grp.dataset.open !== 'true';
    grp.dataset.open = open; h.setAttribute('aria-expanded', open);
    openState[h.dataset.g] = open;
  });

  function head(k, actions = '') {
    const m = metaOf(k);
    const group = NAV.find((g) => g.items && g.items.includes(k));
    $('#crumbs').innerHTML = group ? `${group.group} / <b>${m.label}</b>` : `<b>${m.label}</b>`;
    return `<div class="page-head"><div><div class="kicker">${group ? group.group : 'Overview'}</div><h1>${m.label}</h1>${m.blurb ? `<p>${m.blurb}</p>` : ''}</div><div class="actions">${actions}</div></div>`;
  }

  /* ---------------- field rendering ---------------- */
  function field(f, item) {
    if (f.group) return null;
    let v = f.value ? f.value(item || {}) : item ? item[f.k] : '';
    if (!item && !f.value) v = '';
    if (!item && f.value && f.type !== 'list') v = '';
    const id = 'f_' + f.k;
    const wrap = (inner) => `<div class="field ${f.full ? 'full' : ''}"><label for="${id}">${f.label}</label>${inner}${f.hint ? `<span class="hint">${f.hint}</span>` : ''}</div>`;
    switch (f.type) {
      case 'textarea': return wrap(`<textarea id="${id}">${esc(v || (item ? 'Placeholder copy — edit me.' : ''))}</textarea>`);
      case 'rich': return wrap(`<div class="rte-bar"><button>H2</button><button>B</button><button><i>I</i></button><button>“ ”</button><button>&lt;/&gt;</button><button>${icon('link')}</button><button>${icon('image')}</button></div><textarea id="${id}">${item ? 'Opening paragraph…\n\n## A section heading\n\nMore text, a quote, a code block.' : ''}</textarea>`);
      case 'select': return wrap(`<select id="${id}">${f.opts.map((o) => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`);
      case 'tags': return wrap(`<div class="tags">${(v || []).map((t) => `<span>${esc(t)}<button aria-label="Remove">${icon('x')}</button></span>`).join('')}<input id="${id}" placeholder="Add and press Enter"></div>`);
      case 'list': return wrap(`<div class="repeat">${(v && v.length ? v : ['']).map((t) => `<div class="repeat-row"><span class="handle">${icon('drag')}</span><input class="input" value="${esc(t)}"><button class="icon-btn" aria-label="Remove">${icon('x')}</button></div>`).join('')}<button class="add-row">${icon('plus')} Add line</button></div>`);
      case 'links': return wrap(`<div class="repeat">${(item ? [['Live site', 'https://…'], ['GitHub', 'https://github.com/…']] : [['', '']]).map(([a, b]) => `<div class="repeat-row"><input class="input" style="max-width:140px" placeholder="Label" value="${a}"><input class="input" placeholder="URL" value="${b}"><button class="icon-btn" aria-label="Remove">${icon('x')}</button></div>`).join('')}<button class="add-row">${icon('plus')} Add link</button></div>`);
      case 'toggle': return `<div class="field ${f.full ? 'full' : ''}" style="justify-content:flex-end"><label class="toggle"><input type="checkbox" ${v ? 'checked' : ''}> ${f.label}</label></div>`;
      case 'image': return wrap(`<div class="drop">${icon('upload')}<b>Drop a file or browse</b><span class="faint">PNG, JPG, WebP · max 8 MB · stored in Supabase Storage</span></div>`);
      case 'date': return wrap(`<input id="${id}" type="date" value="2026-10-19">`);
      case 'seg': return wrap(`<div class="seg">${f.opts.map((o) => `<label><input type="radio" name="${id}" ${o === (v || 'Draft') ? 'checked' : ''}><span>${o}</span></label>`).join('')}</div>`);
      default: return wrap(`<input id="${id}" value="${esc(v)}">`);
    }
  }
  function form(fields, item) {
    const out = []; let cur = null;
    fields.forEach((f) => {
      if (f.group) { cur = { title: f.group, rows: [] }; out.push(cur); return; }
      if (!cur) { cur = { title: '', rows: [] }; out.push(cur); }
      cur.rows.push(field(f, item));
    });
    return out.map((g) => `<fieldset class="fieldset">${g.title ? `<legend>${g.title}</legend>` : ''}<div class="fields">${g.rows.join('')}</div></fieldset>`).join('');
  }

  /* ---------------- drawer / modal / toast ---------------- */
  const drawer = $('#drawer'), scrim = $('#scrim'), modal = $('#modal');
  let lastFocus = null;
  function openDrawer(html) {
    lastFocus = document.activeElement;
    drawer.innerHTML = html; drawer.classList.add('open'); scrim.classList.add('open');
    setTimeout(() => { const c = drawer.querySelector('[data-close]'); c && c.focus(); }, 50);
  }
  function closeAll() {
    drawer.classList.remove('open'); modal.classList.remove('open'); scrim.classList.remove('open');
    document.body.classList.remove('nav-open');
    lastFocus && lastFocus.focus && lastFocus.focus();
  }
  function openModal(html) { lastFocus = document.activeElement; $('#modalBox').innerHTML = html; modal.classList.add('open'); scrim.classList.add('open'); }
  scrim.addEventListener('click', closeAll);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeAll(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeAll();
    const t = e.target.closest('[data-toast]');
    if (t) { toast(t.dataset.toast); if (t.closest('.drawer, .modal')) closeAll(); }
  });
  let tt;
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 2000); }

  function editor(k, idx) {
    const s = SECTIONS[k];
    const item = idx == null ? null : s.items[idx];
    openDrawer(`
      <div class="drawer-head"><div><div class="kicker">${s.label}</div><h2 id="drawerTitle">${item ? esc(item.title) : 'New ' + s.singular}</h2></div><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="drawer-body">${form(s.fields, item)}</div>
      <div class="drawer-foot">${item ? `<button class="btn ghost danger sm">${icon('trash')} Delete</button>` : ''}<span class="spacer"></span><button class="btn sm" data-toast="Saved as draft">Save draft</button><button class="btn primary sm" data-toast="Published to the live site">${icon('check')} Publish</button></div>`);
  }

  /* ---------------- views ---------------- */
  function vTable(k) {
    const s = SECTIONS[k];
    const counts = ['All', 'Published', 'Draft', 'Hidden'].map((t) => [t, t === 'All' ? s.items.length : s.items.filter((i) => i.status === t).length]);
    view.innerHTML = head(k, `<button class="btn primary" data-new="${k}">${icon('plus')} Add ${s.singular}</button>`) + `
      <div class="card">
        <div class="toolbar"><div class="tabs" role="tablist">${counts.map(([t, n], i) => `<button role="tab" aria-selected="${i === 0}">${t} <span class="faint">${n}</span></button>`).join('')}</div>
          <label class="search"><svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input placeholder="Filter ${s.label.toLowerCase()}…"></label></div>
        <table><thead><tr><th></th>${s.columns.map((c) => `<th class="${c[2] || ''}">${c[0]}</th>`).join('')}<th></th></tr></thead>
        <tbody>${s.items.map((r, i) => `<tr data-edit="${k}" data-i="${i}"><td class="handle" title="Drag to reorder">${icon('drag')}</td>${s.columns.map((c) => `<td class="${c[2] || ''}">${c[1](r)}</td>`).join('')}
          <td><div class="row-actions"><button class="icon-btn" title="Preview" aria-label="Preview">${icon('eye')}</button></div></td></tr>`).join('')}</tbody></table>
        <div class="table-foot">${icon('info')} Drag rows to set the order on the public page. Drafts and hidden rows never leave the admin.</div>
      </div>`;
  }

  function vProfile() {
    const prof = [
      { group: 'Identity' },
      { k: 'name', label: 'Display name', type: 'text', value: () => 'Abiali' },
      { k: 'role', label: 'Role line', type: 'text', value: () => 'Full-stack engineer' },
      { k: 'headline', label: 'Hero headline', type: 'text', full: true, value: () => 'I build calm, fast products — and a café to show them in.' },
      { k: 'intro', label: 'Intro', type: 'textarea', full: true, value: () => 'Freelance full-stack engineer working with founders on web apps, AI tools and platforms.' },
      { k: 'avatar', label: 'Portrait', type: 'image', full: true },
      { group: 'About story' },
      { k: 'story', label: 'Story paragraphs', type: 'list', full: true, value: () => ['I started building websites for my family café at 14…', 'Today I help small teams ship products that feel considered.'] },
      { k: 'principles', label: 'Principles (title — text)', type: 'list', full: true, value: () => ['Calm over clever — Boring tech, shipped well.', 'Show the work — Weekly demos, no surprises.'] },
      { group: 'Availability' },
      { k: 'location', label: 'Location', type: 'text', value: () => 'Mumbai, India' },
      { k: 'mode', label: 'Work mode', type: 'select', opts: ['Remote', 'Hybrid', 'On-site'], value: () => 'Remote' },
      { k: 'avail', label: 'Availability', type: 'select', opts: ['Open to work', 'Limited', 'Booked'], value: () => 'Open to work' },
      { k: 'currently', label: 'Currently', type: 'text', value: () => 'Building NexusHQ' },
      { k: 'email', label: 'Public email', type: 'text', value: () => 'hello@abiali.dev' },
      { k: 'resume', label: 'Résumé (PDF)', type: 'image', hint: 'Shown as “Download CV”' },
      { group: 'Stats on Home' },
      { k: 'stats', label: 'Stats (value — label)', type: 'list', full: true, value: () => ['6+ — years shipping', '40+ — projects delivered', '100% — job success'] },
      { k: 'stack', label: 'Tech strip (scrolling marquee on Home)', type: 'tags', full: true, value: () => ['Node.js', 'NestJS', 'Next.js', 'React', 'TypeScript', 'PostgreSQL', 'Python', 'LangGraph', 'AWS', 'Docker'] },
      { group: 'Contact page' },
      { k: 'cHead', label: 'Headline', type: 'text', full: true, value: () => 'Let’s build something together.' },
      { k: 'cLead', label: 'Intro line', type: 'textarea', full: true, value: () => 'Open to freelance and full-time work with teams anywhere.' },
      { k: 'cReply', label: 'Reply time', type: 'text', value: () => 'I usually reply within a day.' },
      { k: 'cForm', label: 'Contact form', type: 'toggle', value: () => true },
      { group: 'Social links' },
      { k: 'socials', label: 'Links (also printed on the café business cards)', type: 'links', full: true },
    ];
    view.innerHTML = head('profile', `<button class="btn" data-toast="Preview opened">${icon('eye')} Preview</button><button class="btn primary" data-toast="Profile published">${icon('check')} Publish changes</button>`) +
      `<div class="notice">${icon('info')}<div>One profile record feeds the Home hero, About page, footer and the café's welcome panel. <span class="muted">Unpublished edits are kept as a draft until you publish.</span></div></div>
       <div class="card card-pad" style="display:flex;flex-direction:column;gap:18px">${form(prof, {})}</div>`;
  }

  function vSkills() {
    const groups = [['Frontend', ['React', 'Next.js', 'Svelte', 'TypeScript', 'CSS / motion']], ['Backend', ['Node', 'Postgres', 'Supabase', 'REST / tRPC']], ['AI', ['LLM apps', 'RAG', 'Agents']], ['3D & design', ['WebGL2', 'Blender', 'Figma']]];
    view.innerHTML = head('skills', `<button class="btn primary" data-toast="Group added">${icon('plus')} Add group</button>`) +
      `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">${groups.map(([g, s]) => `
        <div class="card"><div class="card-head"><span class="handle">${icon('drag')}</span><h2>${g}</h2><span class="chip pub" style="margin-left:auto">Published</span><button class="icon-btn" aria-label="Group options" style="margin-left:6px">${icon('pen')}</button></div>
        <div class="card-pad"><div class="tags" style="background:none;border-style:dashed">${s.map((x) => `<span>${x}<button aria-label="Remove">${icon('x')}</button></span>`).join('')}<input placeholder="Add skill…"></div></div></div>`).join('')}</div>`;
  }

  function vGallery() {
    const photos = [['Morning pour-over', 'About · hero strip', 'Published'], ['Desk setup', 'About', 'Published'], ['Coast ride', 'About · hobbies', 'Published'], ['Café render', 'About', 'Draft'], ['Meetup talk', 'About', 'Published'], ['Team offsite', '—', 'Hidden']];
    const g = ['#c9a27a,#7d5236', '#6f8a73,#2f3b31', '#9a4f30,#c9a27a', '#7d5236,#6f8a73', '#ebe5da,#9a4f30', '#3b2c22,#c9a27a'];
    view.innerHTML = head('gallery', `<button class="btn">${icon('check')} Select</button><button class="btn primary" data-toast="Choose photos…">${icon('upload')} Upload photos</button>`) +
      `<div class="card"><div class="toolbar"><div class="tabs"><button aria-selected="true">All <span class="faint">6</span></button><button>Published</button><button>Drafts</button></div><span class="faint" style="margin-left:auto;font-size:13px">Drag to reorder · click to edit caption & alt text</span></div>
       <div class="grid gallery">
         <div class="photo upload">${icon('upload')}<b>Drop photos here</b><span class="faint" style="font-size:12px">Auto-resized & converted to WebP</span></div>
         ${photos.map(([c, w, s], i) => `<div class="photo" data-photo="${i}"><div class="img" style="background:linear-gradient(135deg,${g[i]})"></div><span class="badge">${status(s)}</span><span class="sel"></span><div class="meta"><b>${c}</b><small>${w}</small></div></div>`).join('')}
       </div></div>`;
  }

  function wave(seed, on) { let h = ''; for (let i = 0; i < 48; i++) { const v = 25 + Math.abs(Math.sin(i * 0.7 + seed) * 55) + ((i * 37) % 20); h += `<i class="${i < on ? 'on' : ''}" style="height:${Math.min(100, v)}%"></i>`; } return `<div class="wave">${h}</div>`; }
  function tCard(t) {
    const media = t.type === 'video' ? `<div class="video"><div class="play">${icon('play')}</div><span class="dur">${t.dur}</span></div><p class="transcript"><b>Auto transcript:</b> ${esc(t.text)}</p>`
      : t.type === 'audio' ? `<div class="audio"><button class="play" aria-label="Play">${icon('play')}</button>${wave(t.id, 14)}<span class="mono faint">${t.dur}</span></div><p class="transcript"><b>Auto transcript:</b> ${esc(t.text)}</p>`
      : `<p class="t-quote">${esc(t.text)}</p>`;
    const typeIcon = { video: 'video', audio: 'mic', text: 'text' }[t.type];
    const actions = t.state === 'Pending'
      ? `<button class="btn sm ghost danger" data-toast="Testimonial rejected">Reject</button><span class="spacer"></span><button class="btn sm" data-t="${t.id}">Edit</button><button class="btn sm primary" data-toast="Approved — choose where it shows">${icon('check')} Approve</button>`
      : `<span class="faint" style="font-size:12px">${t.showOn ? 'Shows on: ' + t.showOn.join(', ') : 'Not placed anywhere'}</span><span class="spacer"></span><button class="btn sm" data-t="${t.id}">Edit</button>`;
    return `<article class="t-card ${t.state === 'Pending' ? 'is-pending' : ''}">
      <div class="t-head"><div class="avatar">${t.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</div><div><b>${esc(t.name)}</b><small>${esc(t.role)}</small></div>
        <span class="chip plain">${icon(typeIcon)} ${t.type}</span></div>
      ${media}
      <div class="row-flex"><span class="stars">${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</span><span class="faint" style="font-size:12px;margin-left:auto">${t.when} · via ${t.via}</span>${status(t.state === 'Approved' ? 'Published' : t.state)}</div>
      <div class="t-foot">${actions}</div></article>`;
  }
  function vTestimonials(tab = 'Pending') {
    const tabs = ['Pending', 'Approved', 'Archived', 'All'];
    const list = tab === 'All' ? TESTIMONIALS : TESTIMONIALS.filter((t) => t.state === tab);
    view.innerHTML = head('testimonials', `<button class="btn" data-manual>${icon('plus')} Add manually</button><button class="btn primary" data-request>${icon('link')} Request testimonial</button>`) + `
      <div class="grid stats" style="margin-bottom:16px">
        <div class="card stat"><span class="muted">Waiting for review</span><b>${TESTIMONIALS.filter((t) => t.state === 'Pending').length}</b><small>new since Friday</small></div>
        <div class="card stat"><span class="muted">Published</span><b>${TESTIMONIALS.filter((t) => t.state === 'Approved').length}</b><small>2 video · 1 audio · 1 text</small></div>
        <div class="card stat"><span class="muted">Requests sent</span><b>${REQUESTS.length}</b><small>50% replied</small></div>
        <div class="card stat"><span class="muted">Average rating</span><b>4.8</b><small>★ from 6 people</small></div>
      </div>
      <div class="grid two" style="margin-top:0;grid-template-columns:1fr 340px;align-items:start">
        <div class="card">
          <div class="toolbar"><div class="tabs" role="tablist" id="tTabs">${tabs.map((t) => `<button role="tab" data-tab="${t}" aria-selected="${t === tab}">${t} <span class="faint">${t === 'All' ? TESTIMONIALS.length : TESTIMONIALS.filter((x) => x.state === t).length}</span></button>`).join('')}</div>
            <div class="tabs" style="margin-left:auto"><button aria-selected="true">Any</button><button>${icon('text')}</button><button>${icon('video')}</button><button>${icon('mic')}</button></div></div>
          ${list.length ? `<div class="grid t-grid">${list.map(tCard).join('')}</div>` : '<div class="empty">Nothing here yet.</div>'}
        </div>
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card"><div class="card-head"><h2>Open collection link</h2></div><div class="card-pad" style="display:flex;flex-direction:column;gap:10px">
            <p class="muted" style="font-size:13px">Anyone with this link can leave a text, video or audio testimonial. Everything lands here as <b>Pending</b> first.</p>
            <div class="linkbox"><code>abiali.dev/kind-words</code><button class="btn sm" data-toast="Link copied">${icon('copy')} Copy</button></div>
            <a class="btn sm ghost" href="collect.html" target="_blank">${icon('eye')} Preview the client form ↗</a>
            <label class="toggle"><input type="checkbox" checked> Accepting submissions</label></div></div>
          <div class="card"><div class="card-head"><h2>Requests</h2><button class="btn sm ghost" data-request>${icon('plus')}</button></div>
            <ul class="req-list">${REQUESTS.map((r) => `<li><div class="cell-main" style="flex:1"><b>${r.to}</b><small>${r.email} · sent ${r.sent}</small></div><span class="chip ${r.state === 'Submitted' ? 'pub' : r.state === 'Opened' ? 'draft' : 'hidden'}">${r.state}</span></li>`).join('')}</ul></div>
        </div>
      </div>`;
  }
  function tEditor(id) {
    const t = TESTIMONIALS.find((x) => x.id === +id);
    const places = ['Home', 'About', 'Projects page', 'Project: NexusHQ', 'Project: Ledgerly', '3D café'];
    openDrawer(`
      <div class="drawer-head"><div><div class="kicker">Testimonial · ${t.type}</div><h2 id="drawerTitle">${esc(t.name)}</h2></div><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="drawer-body">
        ${t.type !== 'text' ? `<fieldset class="fieldset"><legend>Recording</legend>${t.type === 'video' ? `<div class="video"><div class="play">${icon('play')}</div><span class="dur">${t.dur}</span></div>` : `<div class="audio"><button class="play">${icon('play')}</button>${wave(t.id, 0)}<span class="mono faint">${t.dur}</span></div>`}
          <div class="fields"><div class="field"><label>Trim start</label><input value="0:00"></div><div class="field"><label>Trim end</label><input value="${t.dur}"></div>
          ${t.type === 'video' ? '<div class="field full"><label>Poster frame</label><div class="drop">' + icon('image') + '<b>Pick a frame or upload</b></div></div>' : ''}</div></fieldset>` : ''}
        <fieldset class="fieldset"><legend>Words</legend><div class="fields">
          <div class="field full"><label>${t.type === 'text' ? 'Testimonial' : 'Transcript (editable, used as captions & quote)'}</label><textarea>${esc(t.text)}</textarea></div>
          <div class="field full"><label>Short pull-quote</label><input value="${esc(t.text.split(/[.—…]/)[0])}"><span class="hint">Used on cards where space is tight</span></div></div></fieldset>
        <fieldset class="fieldset"><legend>Person</legend><div class="fields">
          <div class="field"><label>Name</label><input value="${esc(t.name)}"></div><div class="field"><label>Role & company</label><input value="${esc(t.role)}"></div>
          <div class="field"><label>Rating</label><select>${[5, 4, 3, 2, 1].map((n) => `<option ${n === t.rating ? 'selected' : ''}>${'★'.repeat(n)}</option>`).join('')}</select></div>
          <div class="field"><label>Link to project</label><select><option>None</option><option>NexusHQ</option><option>Ledgerly</option><option>ShopLite</option></select></div>
          <div class="field full"><label>Photo</label><div class="drop">${icon('upload')}<b>Drop a photo</b><span class="faint">Optional — initials are used otherwise</span></div></div>
          <div class="field full"><label class="toggle"><input type="checkbox" checked> They agreed to be shown publicly</label></div></div></fieldset>
        <fieldset class="fieldset"><legend>Where it shows</legend><div class="fields">${places.map((p) => `<div class="field"><label class="toggle"><input type="checkbox" ${(t.showOn || []).some((s) => p.includes(s.replace('Projects: ', 'Project: '))) ? 'checked' : ''}> ${p}</label></div>`).join('')}</div></fieldset>
      </div>
      <div class="drawer-foot"><button class="btn ghost sm">Archive</button><span class="spacer"></span><button class="btn sm" data-toast="Saved">Save</button><button class="btn primary sm" data-toast="Approved and published">${icon('check')} ${t.state === 'Pending' ? 'Approve & publish' : 'Save & publish'}</button></div>`);
  }
  function requestModal() {
    openModal(`
      <div class="drawer-head"><div><div class="kicker">Testimonials</div><h2>Request a testimonial</h2></div><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="drawer-body">
        <div class="fields">
          <div class="field"><label>Client name</label><input placeholder="Sara Khan"></div>
          <div class="field"><label>Email</label><input placeholder="sara@company.com"></div>
          <div class="field full"><label>Project</label><select><option>NexusHQ</option><option>Ledgerly</option><option>ShopLite</option><option>Other / general</option></select></div>
          <div class="field full"><label>Allowed formats</label><div class="seg" style="align-self:flex-start"><label><input type="checkbox" checked>${icon('text')} Text</label><label><input type="checkbox" checked>${icon('video')} Video</label><label><input type="checkbox" checked>${icon('mic')} Audio</label></div></div>
          <div class="field full"><label>Personal note</label><textarea>Hi Sara, it was great working on the booking flow together. Would you mind sharing a few words about the experience? A short video or voice note is perfect — or just type, whatever's easiest.</textarea></div>
          <div class="field full"><label>Personal link</label><div class="linkbox"><code>abiali.dev/kind-words/sara-k7f2</code><button class="btn sm" data-toast="Link copied">${icon('copy')} Copy</button></div><span class="hint">Pre-fills their name and project. Expires in 30 days.</span></div>
        </div>
      </div>
      <div class="drawer-foot"><span class="spacer"></span><button class="btn sm" data-close>Cancel</button><button class="btn primary sm" data-toast="Request emailed to Sara">${icon('mail')} Send request</button></div>`);
  }

  function vCafe() {
    const signs = [{ group: 'Signs in the scene' },
      { k: 'neon', label: 'Main neon sign', type: 'text', value: () => 'coffee & code' },
      { k: 'neonSub', label: 'Sign subline', type: 'text', value: () => 'Abiali · EST. 2019', hint: 'Name and the year you started' },
      { k: 'win', label: 'Window neon', type: 'text', value: () => 'records · coffee' },
      { k: 'open', label: 'Door neon', type: 'text', value: () => 'open' },
      { k: 'what', label: 'Barista panel: “What I do”', type: 'text', full: true, value: () => 'Full-stack products, AI agents and the cloud they run on' }];
    view.innerHTML = head('cafe', `<a class="btn" href="#" title="Opens /3d">${icon('eye')} Open café ↗</a><button class="btn primary" data-toast="Café text published">${icon('check')} Publish changes</button>`) + `
      <div class="notice">${icon('info')}<div>The café reads the same records as the 2D site, so projects, skills, experience and the rest are edited in their own sections. This page only holds what is unique to the 3D scene. <span class="muted">The 3D café is hidden on phones and tablets.</span></div></div>
      <div class="card card-pad" style="margin-bottom:16px">${form(signs, {})}</div>
      <div class="card" style="margin-bottom:16px"><div class="card-head"><h2>Object panels</h2><span class="faint" style="font-size:13px;margin-left:auto">Click a row to edit its heading and intro</span></div>
        <table><thead><tr><th>Object</th><th>Kicker</th><th>Title</th><th class="hide-sm">List comes from</th></tr></thead>
        <tbody>${CAFE_PANELS.map(([o, z, k, t, src]) => `<tr data-panel="${z}"><td><b>${o}</b></td><td class="muted">${k}</td><td>${t}</td><td class="hide-sm"><span class="chip plain">${src}</span></td></tr>`).join('')}</tbody></table></div>
      <div class="card"><div class="card-head"><h2>3D model credits</h2><button class="btn sm" data-toast="Credit added">${icon('plus')} Add credit</button></div>
        <table><thead><tr><th></th><th>Model</th><th>Artist</th><th class="hide-sm">Licence</th></tr></thead>
        <tbody>${CREDITS.map(([m, a]) => `<tr><td class="handle">${icon('drag')}</td><td><b>${m}</b></td><td class="muted">${a}</td><td class="hide-sm"><span class="chip plain">CC BY 4.0</span></td></tr>`).join('')}</tbody></table>
        <div class="table-foot">${icon('info')} CC BY requires attribution — credits show on the café notice board and can't be hidden while the model is in the scene.</div></div>`;
  }

  function vDashboard() {
    $('#crumbs').innerHTML = '<b>Dashboard</b>';
    const tiles = NAV[1].items.map((k) => { const s = SECTIONS[k]; const n = s.items ? s.items.length : k === 'gallery' ? 6 : k === 'skills' ? 4 : k === 'testimonials' ? TESTIMONIALS.length : 1; const pct = s.items ? Math.round((s.items.filter((i) => i.status === 'Published').length / s.items.length) * 100) : 100; return `<a class="card tile" href="#${k}"><span class="ic">${icon(s.icon)}</span><b>${s.label}</b><span class="faint" style="font-size:12px">${n} ${n === 1 ? 'record' : 'items'} · ${pct}% live</span><div class="bar"><i style="width:${pct}%"></i></div></a>`; }).join('');
    view.innerHTML = `<div class="page-head"><div><div class="kicker">Good afternoon</div><h1>Welcome back, Abiali</h1><p>Your portfolio is live. 2 testimonials and 2 messages are waiting for you.</p></div>
      <div class="actions"><a class="btn" href="#testimonials">${icon('quote')} Review testimonials</a><a class="btn primary" href="#projects">${icon('plus')} New project</a></div></div>
      <div class="grid stats">
        <div class="card stat"><span class="muted">Published items</span><b>27</b><small>across 10 sections</small></div>
        <div class="card stat"><span class="muted">Drafts</span><b>4</b><small>not on the site yet</small></div>
        <div class="card stat"><span class="muted">Pending testimonials</span><b>2</b><small>1 video · 1 text</small></div>
        <div class="card stat"><span class="muted">Last publish</span><b style="font-size:22px;margin-top:12px">2 h ago</b><small>Projects · NexusHQ</small></div>
      </div>
      <h2 style="font-size:18px;margin:26px 0 12px">Portfolio sections</h2>
      <div class="grid section-tiles">${tiles}</div>
      <div class="grid two">
        <div class="card"><div class="card-head"><h2>Recent activity</h2></div><ul class="feed">
          <li><span class="ic">${icon('video')}</span><div><b>Sara Khan</b> sent a video testimonial<div class="faint" style="font-size:12px">2 hours ago</div></div></li>
          <li><span class="ic">${icon('folder')}</span><div>You published <b>NexusHQ</b> case study<div class="faint" style="font-size:12px">2 hours ago</div></div></li>
          <li><span class="ic">${icon('text')}</span><div><b>Tom Reyes</b> sent a text testimonial<div class="faint" style="font-size:12px">Yesterday</div></div></li>
          <li><span class="ic">${icon('image')}</span><div>You uploaded 3 photos to <b>Gallery</b><div class="faint" style="font-size:12px">Oct 16</div></div></li></ul></div>
        <div class="card"><div class="card-head"><h2>Needs attention</h2></div><ul class="feed">
          <li><span class="ic">${icon('pen')}</span><div><b>ShopLite</b> project is a draft with no cover image<div><a href="#projects" style="color:var(--accent);font-weight:600;font-size:13px">Finish it →</a></div></div></li>
          <li><span class="ic">${icon('pen')}</span><div><b>“200 Upwork proposals”</b> article is unfinished<div><a href="#articles" style="color:var(--accent);font-weight:600;font-size:13px">Continue →</a></div></div></li>
          <li><span class="ic">${icon('mail')}</span><div>2 unread contact messages<div><a href="#messages" style="color:var(--accent);font-weight:600;font-size:13px">Open inbox →</a></div></div></li></ul></div>
      </div>`;
  }

  function vPlaceholder(k) {
    const m = EXTRA[k];
    const notes = { messages: 'Messages from the Contact page form will land here once the endpoint exists.', jobs: 'The local agent’s job radar — designed in its own workflow later.', proposals: 'AI-drafted proposals for review — designed later.', users: 'Only the Admin role exists today. Roles: Admin (full access) and, later, Editor (content only, no publishing).', site: 'SEO defaults, theme, entry modal and 3D café toggle.' };
    view.innerHTML = head(k) + `<div class="card empty">${icon(m.icon, 'i')}<h2 style="font-size:18px;margin:10px 0 6px">${m.label}</h2><p>${notes[k]}</p></div>`;
  }

  /* ---------------- routing & events ---------------- */
  function route() {
    const k = (location.hash || '#dashboard').slice(1);
    renderNav(k);
    closeAll();
    const s = SECTIONS[k];
    if (k === 'dashboard') vDashboard();
    else if (!s) vPlaceholder(EXTRA[k] ? k : 'site');
    else if (s.kind === 'table') vTable(k);
    else if (s.kind === 'profile') vProfile();
    else if (s.kind === 'skills') vSkills();
    else if (s.kind === 'gallery') vGallery();
    else if (s.kind === 'testimonials') vTestimonials();
    else if (s.kind === 'cafe') vCafe();
    window.scrollTo(0, 0);
  }
  view.addEventListener('click', (e) => {
    const row = e.target.closest('[data-edit]');
    if (row) return editor(row.dataset.edit, +row.dataset.i);
    const nw = e.target.closest('[data-new]');
    if (nw) return editor(nw.dataset.new, null);
    const tab = e.target.closest('[data-tab]');
    if (tab) return vTestimonials(tab.dataset.tab);
    const te = e.target.closest('[data-t]');
    if (te) return tEditor(te.dataset.t);
    if (e.target.closest('[data-request]')) return requestModal();
    if (e.target.closest('[data-manual]')) return tEditor(4);
    const pn = e.target.closest('[data-panel]');
    if (pn) {
      const p = CAFE_PANELS.find((x) => x[1] === pn.dataset.panel);
      return openDrawer(`<div class="drawer-head"><div><div class="kicker">3D café · ${p[0]}</div><h2 id="drawerTitle">Panel text</h2></div><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
        <div class="drawer-body">${form([{ group: 'Panel' }, { k: 'kicker', label: 'Kicker', type: 'text', value: () => p[2] }, { k: 'title', label: 'Title', type: 'text', value: () => p[3] }, { k: 'body', label: 'Intro line', type: 'textarea', full: true, value: () => 'Every book on the shelf is a project. Pull one out.' }, { k: 'menu', label: 'Label in the café menu', type: 'text', value: () => p[4].split(' ')[0] }], {})}
        <div class="notice" style="margin:0">${icon('info')}<div>The list in this panel comes from <b>${p[4]}</b>.</div></div></div>
        <div class="drawer-foot"><span class="spacer"></span><button class="btn primary sm" data-toast="Panel saved">Save</button></div>`);
    }
    const ph = e.target.closest('[data-photo]');
    if (ph) openDrawer(`<div class="drawer-head"><div><div class="kicker">Gallery</div><h2 id="drawerTitle">Photo details</h2></div><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="drawer-body"><div class="video" style="aspect-ratio:4/3;background:${ph.querySelector('.img').style.background}"></div>${form([{ group: 'Details' }, { k: 'cap', label: 'Caption', type: 'text', full: true, value: () => ph.querySelector('b').textContent }, { k: 'alt', label: 'Alt text', type: 'text', full: true, hint: 'Describe the photo for screen readers' }, { k: 'where', label: 'Show in', type: 'select', opts: ['About gallery', 'About hero strip', 'Hobby card'] }, ...common], {})}</div>
      <div class="drawer-foot"><button class="btn ghost danger sm">${icon('trash')} Delete</button><span class="spacer"></span><button class="btn primary sm" data-toast="Photo saved">Save</button></div>`);
  });
  $('#menuBtn').addEventListener('click', () => { document.body.classList.add('nav-open'); scrim.classList.add('open'); });
  $('#themeBtn').addEventListener('click', () => {
    const r = document.documentElement;
    const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    r.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('nx-admin-theme', r.dataset.theme); } catch (e) {}
  });
  window.addEventListener('hashchange', route);
  route();
})();
