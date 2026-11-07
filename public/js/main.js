(() => {
  'use strict';
  document.documentElement.classList.add('js');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Missing image -> styled placeholder ---------- */
  const markMissing = (img) => {
    const box = img.closest('.media');
    if (box) box.classList.add('is-missing');
    if (img.hasAttribute('data-optional')) img.classList.add('is-missing');
  };
  document.querySelectorAll('img').forEach((img) => {
    if (img.complete && img.naturalWidth === 0) markMissing(img);
    else img.addEventListener('error', () => markMissing(img), { once: true });
  });

  /* ---------- Nav: scrolled state + mobile menu ---------- */
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 20);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  const setMenu = (open) => {
    links.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
    toggle.querySelector('use').setAttribute('href', open ? '#i-close' : '#i-menu');
  };
  toggle.addEventListener('click', () => setMenu(!links.classList.contains('is-open')));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  document.addEventListener('click', (e) => {
    if (links.classList.contains('is-open') && !links.contains(e.target) && !toggle.contains(e.target)) setMenu(false);
  });

  /* ---------- Active section highlight ---------- */
  const sections = [...document.querySelectorAll('[data-section]')];
  const navLinks = [...document.querySelectorAll('.nav__links a, .progress a')];
  const setActive = (id) => {
    navLinks.forEach((a) => {
      const active = a.getAttribute('href') === `#${id}`;
      a.classList.toggle('is-active', active);
      if (active) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  };
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) setActive(entry.target.id); });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => sectionObserver.observe(s));
  // last section is short: mark it active once the page bottom is reached
  window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      setActive(sections[sections.length - 1].id);
    }
  }, { passive: true });

  /* ---------- Reveal on scroll (staggered) ---------- */
  const reveals = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('is-in'));
  } else {
    // stagger siblings inside the same grid
    document.querySelectorAll('.cards, .videos, .acts, .hero__copy').forEach((group) => {
      group.querySelectorAll('.reveal').forEach((el, i) => el.style.setProperty('--d', `${Math.min(i, 6) * 70}ms`));
    });
    const revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); obs.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((el) => revealObserver.observe(el));
  }

  /* ---------- Count-up stats ---------- */
  const fmt = (n, decimals) => n.toFixed(decimals).replace('.', ',');
  const counters = document.querySelectorAll('[data-count]');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const countObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);
        const el = entry.target;
        const target = parseFloat(el.dataset.count);
        const decimals = parseInt(el.dataset.decimals || '0', 10);
        const suffix = el.dataset.suffix || '';
        const duration = 1200;
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = fmt(target * eased, decimals) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    counters.forEach((c) => countObserver.observe(c));
  }

  /* ---------- Video modal ---------- */
  const modal = document.getElementById('video-modal');
  const video = modal.querySelector('video');
  const sourceLink = modal.querySelector('.modal__source');
  let lastTrigger = null;

  const clearTikTok = () => {
    const frame = modal.querySelector('iframe');
    if (frame) frame.remove(); // removing the iframe stops playback
    sourceLink.hidden = true;
  };

  // Local mp4 (Gala performance, showreel)
  const openVideo = (trigger) => {
    lastTrigger = trigger;
    clearTikTok();
    video.hidden = false;
    if (video.getAttribute('src') !== trigger.dataset.video) {
      video.src = trigger.dataset.video;
      if (trigger.dataset.poster) video.poster = trigger.dataset.poster; else video.removeAttribute('poster');
    }
    modal.showModal();
    video.play().catch(() => {});
  };
  document.querySelectorAll('[data-video]').forEach((btn) => btn.addEventListener('click', () => openVideo(btn)));

  // TikTok videos play inside the page via TikTok's embed player
  const openTikTok = (card, id) => {
    lastTrigger = card;
    clearTikTok();
    video.pause();
    video.hidden = true;
    const frame = document.createElement('iframe');
    frame.className = 'modal__tiktok';
    frame.src = `https://www.tiktok.com/player/v1/${id}?autoplay=1&loop=0&music_info=1&description=1&rel=0&native_context_menu=1`;
    frame.title = card.querySelector('h3')?.textContent.trim() || 'Video TikTok';
    frame.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    modal.insertBefore(frame, sourceLink);
    sourceLink.href = card.href;
    sourceLink.hidden = false;
    modal.showModal();
  };
  document.querySelectorAll('a.vcard[href*="/video/"]').forEach((card) => {
    const id = (card.href.match(/\/video\/(\d+)/) || [])[1];
    if (!id) return;
    card.addEventListener('click', (e) => {
      // keep ctrl/cmd/shift/middle-click = open TikTok in a new tab
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      openTikTok(card, id);
    });
  });

  // Showreel button appears only when assets/videos/showreel.mp4 exists
  const reelBtn = document.getElementById('showreel-btn');
  fetch(reelBtn.dataset.video, { method: 'HEAD' })
    .then((r) => { if (r.ok && (r.headers.get('content-type') || '').startsWith('video')) reelBtn.hidden = false; })
    .catch(() => {});

  const closeModal = () => { video.pause(); modal.close(); };
  modal.querySelector('[data-close]').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  modal.addEventListener('close', () => {
    video.pause();
    clearTikTok();
    if (lastTrigger) lastTrigger.focus({ preventScroll: true });
  });

  /* ---------- Light / dark theme ---------- */
  const root = document.documentElement;
  const themeBtn = document.getElementById('theme-toggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const syncThemeUI = () => {
    const light = root.dataset.theme === 'light';
    const label = light ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng';
    themeBtn.setAttribute('aria-label', label);
    themeBtn.title = label;
    if (themeMeta) themeMeta.content = light ? '#f7f3ff' : '#0d0a1f';
  };
  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch (e) { /* storage blocked */ }
    syncThemeUI();
  };
  syncThemeUI();
  themeBtn.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    if (document.startViewTransition && !reduceMotion) document.startViewTransition(() => applyTheme(next));
    else applyTheme(next);
  });

  /* ---------- Footer year ---------- */
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
