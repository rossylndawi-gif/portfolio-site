
// ============================================
// 1. PRELOADER LOGIC (With Safety Fallback)
// ============================================
let resolvePreloader;
const preloaderFinished = new Promise(res => { resolvePreloader = res; });
let preloaderHiding = false;

const hidePreloader = () => {
  if (preloaderHiding) return;
  preloaderHiding = true;
  const loader = document.getElementById('preloader');
  if (!loader) {
    resolvePreloader();
    return;
  }
  loader.style.opacity = '0';
  setTimeout(() => {
    loader.style.display = 'none';
    resolvePreloader();
  }, 800);
};

// Hide as soon as the DOM is usable; waiting for every image and font made
// the page feel slower than it is.
document.addEventListener('DOMContentLoaded', hidePreloader);
// Fallback so preloader never blocks the page
setTimeout(hidePreloader, 800);

// ============================================
// === LENIS === smooth scrolling, driven by GSAP's ticker
// ============================================
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGsap = !!(window.gsap && window.ScrollTrigger);

if (!reduceMotion && window.Lenis && hasGsap) {
  gsap.registerPlugin(ScrollTrigger);
  // lerp-based glide: every frame closes 7% of the gap, so the page eases
  // to a stop instead of snapping. syncTouch gives phones the same glide.
  const lenis = new Lenis({
    lerp: 0.07,
    smoothWheel: true,
    wheelMultiplier: 0.9,
    syncTouch: true,
    syncTouchLerp: 0.075,
    touchInertiaMultiplier: 28
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis;
}

// Shared by nav links, scroll-to-contact CTAs and hash-on-load.
// Lands the target just below the fixed header.
function scrollToTarget(target, onDone) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  const offset = -(document.querySelector('header')?.offsetHeight || 0) - 20;
  const y = el.getBoundingClientRect().top + window.scrollY + offset;
  // Already there: some scrollers skip the callback for a zero-distance scroll.
  if (Math.abs(y - window.scrollY) < 2) {
    onDone && onDone();
    return;
  }
  if (window.__lenis) {
    window.__lenis.scrollTo(el, { offset, onComplete: onDone });
  } else {
    window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
    onDone && setTimeout(onDone, reduceMotion ? 0 : 600);
  }
}

// ============================================
// 2. HEADER SCROLL EFFECT
// ============================================
// Only toggles a class; the scrolled look lives in style.css (header.is-scrolled).
const siteHeader = document.querySelector('header');
if (siteHeader) {
  let scrollTicking = false;
  const updateHeader = () => {
    siteHeader.classList.toggle('is-scrolled', window.scrollY > 50);
    scrollTicking = false;
  };
  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(updateHeader);
    }
  }, { passive: true });
  updateHeader();
}

// ============================================
// 3. MOBILE NAVIGATION
// ============================================
const hamburger = document.querySelector('.hamburger');
const mobileNav = document.querySelector('.mobile-nav');

const setMobileNav = (open) => {
  if (!hamburger || !mobileNav) return;
  hamburger.classList.toggle('open', open);
  mobileNav.classList.toggle('open', open);
  hamburger.setAttribute('aria-expanded', String(open));
  hamburger.setAttribute('aria-label', open ? 'close menu' : 'menu');
  document.body.style.overflow = open ? 'hidden' : 'auto';
  if (open) window.__lenis?.stop();
  else window.__lenis?.start();
};

if (hamburger && mobileNav) {
  hamburger.addEventListener('click', () => {
    setMobileNav(!mobileNav.classList.contains('open'));
  });

  mobileNav.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') setMobileNav(false);
  });
}

// ============================================
// 4. SCROLL REVEALS
// GSAP when it loaded; otherwise the IntersectionObserver fallback below.
// ============================================
if (hasGsap) document.documentElement.classList.add('gsap-ready');

// --- Fallback: no GSAP ---
if (!hasGsap) {
  const revealElements = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  revealElements.forEach(el => revealObserver.observe(el));
}

// ============================================
// === GSAP MOTION === reveals, title splits, hero pin/fade
// gsap.matchMedia scopes everything and reverts it when a condition flips.
// ============================================
if (hasGsap) {
  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(SplitText);

  const REVEAL_FROM = { opacity: 0, y: 28 };
  const REVEAL_TO = { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' };
  const STAGGER_GRIDS = '.svc-grid, .works-grid, .playlist, .carousel-track';

  const mm = gsap.matchMedia();
  mm.add({
    desktop: '(min-width: 769px)',
    mobile: '(max-width: 768px)',
    motion: '(prefers-reduced-motion: no-preference)'
  }, (ctx) => {
    const { desktop, mobile, motion } = ctx.conditions;

    // Reduced motion: everything visible, no triggers, no pin, no splits.
    if (!motion) {
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
      return;
    }

    const handled = new Set();

    // --- Staggered grids: one ScrollTrigger per grid ---
    // Cards hidden by the portfolio filter are left out of the stagger and
    // marked visible so they appear normally when a filter shows them.
    // --- Services: cards swing up out of the page as you scroll (scrubbed,
    // so they follow the scrollbar both ways), then each one "arms": its
    // glyph draws itself and the signal bar lights. ---
    document.querySelectorAll('.svc-grid').forEach(grid => {
      const cells = Array.from(grid.children);
      cells.forEach(el => { handled.add(el); el.classList.add('active'); });
      gsap.set(grid, { perspective: 1200 });
      gsap.fromTo(cells,
        { opacity: 0, y: 90, rotateX: -38, scale: 0.9, transformOrigin: '50% 100%' },
        {
          opacity: 1, y: 0, rotateX: 0, scale: 1, ease: 'power2.out',
          stagger: desktop ? 0.12 : 0,
          scrollTrigger: {
            trigger: grid, start: 'top 92%', end: desktop ? 'top 38%' : 'top 55%', scrub: 0.8
          }
        });
      cells.forEach(cell => {
        const item = cell.querySelector('.svc-item');
        const strokes = cell.querySelectorAll('.svc-glyph path, .svc-glyph rect, .svc-glyph circle');
        strokes.forEach(s => {
          const len = s.getTotalLength ? s.getTotalLength() : 100;
          gsap.set(s, { strokeDasharray: len, strokeDashoffset: len });
        });
        ScrollTrigger.create({
          trigger: cell, start: 'top 72%', end: 'bottom 20%',
          toggleClass: { targets: item, className: 'is-armed' },
          onEnter: () => gsap.to(strokes, {
            strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', stagger: 0.12, overwrite: true
          }),
          onEnterBack: () => gsap.to(strokes, {
            strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', stagger: 0.12, overwrite: true
          })
        });
      });
    });

    document.querySelectorAll('.works-grid').forEach(grid => {
      const items = Array.from(grid.children);
      items.forEach(el => handled.add(el));
      const shown = items.filter(el => el.offsetParent !== null);
      items.filter(el => el.offsetParent === null).forEach(el => el.classList.add('active'));
      if (!shown.length) return;
      gsap.fromTo(shown, REVEAL_FROM, {
        ...REVEAL_TO,
        stagger: 0.08,
        scrollTrigger: { trigger: grid, start: 'top 82%', once: true }
      });
    });

    // --- Sounds player: the panel reveals, then its cards stagger in ---
    // Cards (.track), not their <li> slots: script.js owns each slot's 3D
    // transform. (The client carousel is a marquee and is not staggered.)
    document.querySelectorAll('.player.reveal').forEach(player => {
      handled.add(player);
      const rows = player.querySelectorAll('.playlist > li > .track');
      const tl = gsap.timeline({ scrollTrigger: { trigger: player, start: 'top 82%', once: true } });
      tl.fromTo(player, REVEAL_FROM, REVEAL_TO);
      if (rows.length) {
        tl.fromTo(rows, { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.08 }, 0.2);
      }
    });

    // --- Individual reveals ---
    document.querySelectorAll('.reveal').forEach(el => {
      if (handled.has(el) || el.parentElement.closest(STAGGER_GRIDS)) return;
      gsap.fromTo(el, REVEAL_FROM, {
        ...REVEAL_TO,
        scrollTrigger: { trigger: el, start: 'top 82%', once: true }
      });
    });

    // --- Title word reveals (SplitText keeps nested markup + a11y label) ---
    if (window.SplitText) {
      document.querySelectorAll('.section-title, .trusted-title, .portfolio-hero-title').forEach(el => {
        SplitText.create(el, {
          type: 'words', mask: 'words', aria: 'auto', autoSplit: true,
          onSplit: (self) => gsap.from(self.words, {
            yPercent: 100, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.04,
            scrollTrigger: { trigger: el, start: 'top 85%', once: true }
          })
        });
      });
    }

    // --- Hero ---
    if (document.querySelector('.hero')) {
      if (desktop) {
        // Pinned scrub. Targets are wrappers/children — never .hero-content,
        // which the 3D tilt owns.
        gsap.timeline({
          scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=45%', pin: true, scrub: 1 }
        })
          .to('.hero-logo-wrap', { scale: 0.85, y: -20, opacity: 0.7, rotationX: 28, transformPerspective: 900 }, 0)
          .to('.hero-content .title', { y: -30, opacity: 0 }, 0.1)
          .to('.hero-content .subtitle', { y: -20, opacity: 0 }, 0.15)
          .to('.hero-actions', { y: -10, opacity: 0 }, 0.2);
      }
      if (mobile) {
        gsap.to('.hero-fade', {
          opacity: 0, y: -30, ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 40%', scrub: true }
        });
        // The logo tips back in 3D as it scrolls away.
        gsap.to('.hero-logo-wrap', {
          rotationX: 32, scale: 0.9, transformPerspective: 900, ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 40%', scrub: true }
        });
      }
    }

    // --- Scroll feel: sections lean very slightly with scroll speed and
    // settle back when the page stops (the hero is pinned, so it is left out). ---
    const leaners = Array.from(document.querySelectorAll('main > section:not(.hero)'));
    if (leaners.length) {
      const skewTo = leaners.map(el => gsap.quickTo(el, 'skewY', { duration: 0.6, ease: 'power3.out' }));
      ScrollTrigger.create({
        onUpdate: (self) => {
          const skew = gsap.utils.clamp(-2.2, 2.2, self.getVelocity() / -450);
          skewTo.forEach(fn => fn(skew));
        }
      });
      let settle = 0;
      window.addEventListener('scroll', () => {
        clearTimeout(settle);
        settle = setTimeout(() => skewTo.forEach(fn => fn(0)), 120);
      }, { passive: true });
    }
  });
}

// === LAYOUT READY === measure once fonts + preloader are done, then honour
// a hash in the URL (e.g. portfolio.html → index.html#contact).
Promise.all([preloaderFinished, document.fonts ? document.fonts.ready : null]).then(() => {
  if (hasGsap) ScrollTrigger.refresh();
  const id = decodeURIComponent(location.hash.slice(1));
  const el = id && document.getElementById(id);
  if (el) scrollToTarget(el);
});

// ============================================
// 5. AMBIENT DARK STARFIELD / DUST CANVAS (Optimized)
// ============================================
const canvas = document.getElementById('starfield');
if (canvas && canvas.getContext) {
  const ctx = canvas.getContext('2d');
  let width, height;
  let particles = [];
  let mouseX = 0, mouseY = 0;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Only run if not reduced motion
  if (!prefersReduced) {
    let frameId = null;
    let isVisible = true;

    function resize() {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;

      // Avoid full particle wipe on minor mobile address bar resize
      if (particles.length > 0 && Math.abs(width - newWidth) < 20 && Math.abs(height - newHeight) < 120) {
        width = canvas.width = newWidth;
        height = canvas.height = newHeight;
        return;
      }

      width = canvas.width = newWidth;
      height = canvas.height = newHeight;
      particles = [];
      const count = Math.min(80, Math.floor((width * height) / 15000));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 1.2 + 0.3,
          alpha: Math.random() * 0.4 + 0.1,
          speedX: (Math.random() - 0.5) * 0.15,
          speedY: (Math.random() - 0.5) * 0.15,
          pulseSpeed: Math.random() * 0.015 + 0.005,
          color: Math.random() > 0.4 ? '244, 239, 232' : '255, 160, 77'
        });
      }
    }

    // Throttled mouse move
    let mouseTimeout;
    window.addEventListener('mousemove', (e) => {
      if (!mouseTimeout) {
        mouseTimeout = requestAnimationFrame(() => {
          mouseX = (e.clientX - width / 2) * 0.035;
          mouseY = (e.clientY - height / 2) * 0.035;
          mouseTimeout = null;
        });
      }
    });

    window.addEventListener('resize', resize);

    // Pause animation when tab is hidden
    document.addEventListener('visibilitychange', () => {
      isVisible = !document.hidden;
      if (isVisible && !frameId) {
        render();
      }
    });

    function render() {
      if (!isVisible) {
        frameId = null;
        return;
      }

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.speedX;
        p.y += p.speedY;
        p.alpha += Math.sin(Date.now() * p.pulseSpeed) * 0.005;
        p.alpha = Math.max(0.08, Math.min(0.65, p.alpha));

        if (p.x < 0) p.x += width;
        if (p.x > width) p.x -= width;
        if (p.y < 0) p.y += height;
        if (p.y > height) p.y -= height;

        const drawX = p.x - mouseX * (p.radius * 0.6);
        const drawY = p.y - mouseY * (p.radius * 0.6);

        ctx.beginPath();
        ctx.arc(drawX, drawY, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
        ctx.fill();
      }

      frameId = requestAnimationFrame(render);
    }

    resize();
    render();
  }
}

// ============================================
// 5b. AUDIO BUS — only one sound on the page at a time
// Each player registers a controller with a pause() method and calls
// claim() before it starts. Declared here so block 7 can pause everything
// when a video opens.
// ============================================
const AudioBus = {
  current: null,
  claim(ctrl) {
    if (this.current && this.current !== ctrl) this.current.pause();
    this.current = ctrl;
  },
  release(ctrl) {
    if (this.current === ctrl) this.current = null;
  },
  pauseAll() {
    if (this.current) this.current.pause();
    this.current = null;
  }
};

// Shared m:ss formatter for the players below.
const formatTime = (sec) => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
};

// ============================================
// 6. PORTFOLIO AUDIO LOGIC
// ============================================
const audioPlayers = document.querySelectorAll('.audio-item');
let currentAudio = null;

audioPlayers.forEach(item => {
  const audio = item.querySelector('audio');
  const span = item.querySelector('.overlay span');

  if (audio) {
    item.addEventListener('click', () => {
      if (audio.paused) {
        if (currentAudio && currentAudio !== audio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
          currentAudio.parentElement.querySelector('.overlay span').textContent = 'play';
        }
        audio.play();
        span.textContent = 'pause';
        currentAudio = audio;
      } else {
        audio.pause();
        span.textContent = 'play';
        currentAudio = null;
      }
    });

    audio.addEventListener('ended', () => {
      span.textContent = 'play';
      currentAudio = null;
    });
  }
});

// ============================================
// 7. YOUTUBE VIDEO MODAL (WORK CARDS & VIDEO ITEMS)
// ============================================
const modal = document.getElementById('video-modal');
const modalIframe = modal ? modal.querySelector('iframe') : null;
const closeModal = modal ? modal.querySelector('.close-modal') : null;
let modalReturnFocus = null;

// Function to open video modal
function openVideoModal(videoId) {
  // Stop any playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.parentElement.querySelector('.overlay span').textContent = 'play';
    currentAudio = null;
  }
  AudioBus.pauseAll();

  if (modal && modalIframe) {
    modalReturnFocus = document.activeElement;
    modalIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    window.__lenis?.stop();
    if (closeModal) closeModal.focus();
  }
}

// Function to close video modal
function closeVideoModal() {
  if (modal && modalIframe && modal.classList.contains('open')) {
    modal.classList.remove('open');
    modalIframe.src = '';
    document.body.style.overflow = 'auto';
    window.__lenis?.start();
    if (modalReturnFocus && modalReturnFocus.focus) modalReturnFocus.focus();
    modalReturnFocus = null;
  }
}

// Close modal with × button
if (closeModal) {
  closeModal.addEventListener('click', closeVideoModal);
}

// Close modal on outside click
if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeVideoModal();
  });
}

// Handle work-card clicks (Mix & Master videos)
document.querySelectorAll('.work-card').forEach(item => {
  item.addEventListener('click', () => {
    const videoId = item.getAttribute('data-video');
    if (videoId) {
      openVideoModal(videoId);
    }
  });
});

// Handle video-item clicks (Film Sound videos)
document.querySelectorAll('.video-item').forEach(item => {
  item.addEventListener('click', () => {
    const videoId = item.getAttribute('data-video');
    if (videoId) {
      openVideoModal(videoId);
    }
  });
});

// ============================================
// 8. COVER ART MODAL
// ============================================
function openCoverModal(imageSrc, title, artist) {
  let coverModal = document.getElementById('cover-modal');

  // Create modal if it doesn't exist
  if (!coverModal) {
    coverModal = document.createElement('div');
    coverModal.id = 'cover-modal';
    coverModal.className = 'modal';
    coverModal.setAttribute('role', 'dialog');
    coverModal.setAttribute('aria-modal', 'true');
    coverModal.setAttribute('aria-label', 'cover art');
    coverModal.setAttribute('data-lenis-prevent', '');
    coverModal.innerHTML = `
      <div class="modal-content" style="max-width: 580px; aspect-ratio: auto; background: transparent; display: flex; flex-direction: column; align-items: center; position: relative; border: none; box-shadow: none;">
        <button type="button" aria-label="close" class="close-modal" id="cover-close-btn" style="position: absolute; top: -42px; right: 4px; color: var(--text-secondary); font-size: 2.2rem; cursor: pointer; z-index: 10; opacity: 0.8; transition: opacity 0.2s, color 0.2s;">&times;</button>
        <img id="cover-modal-img" src="" alt="Cover Art" style="width: 100%; height: auto; border-radius: 18px; box-shadow: 0 12px 40px rgba(0,0,0,0.75); border: 1px solid rgba(255, 255, 255, 0.08);">
        <div style="text-align: center; margin-top: 1.4rem; color: var(--text-primary);">
          <h3 id="cover-modal-title" style="font-size: 1.35rem; font-weight: 500; letter-spacing: 0; margin-bottom: 0.25rem; font-family: inherit; color: var(--text-primary);">Title</h3>
          <p id="cover-modal-artist" style="font-size: 0.92rem; color: var(--text-muted); font-family: inherit;">Artist</p>
        </div>
      </div>
    `;
    document.body.appendChild(coverModal);

    // Close on outside click
    coverModal.addEventListener('click', function (e) {
      if (e.target === coverModal) {
        closeCoverModal();
      }
    });

    // Close with × button
    document.getElementById('cover-close-btn')?.addEventListener('click', function () {
      closeCoverModal();
    });
  }

  // Update modal content
  const img = document.getElementById('cover-modal-img');
  const titleEl = document.getElementById('cover-modal-title');
  const artistEl = document.getElementById('cover-modal-artist');

  if (img) img.src = imageSrc;
  if (titleEl) titleEl.textContent = title;
  if (artistEl) artistEl.textContent = artist;

  // Open modal
  coverReturnFocus = document.activeElement;
  coverModal.classList.add('open');
  document.body.style.overflow = 'hidden';
  window.__lenis?.stop();
  document.getElementById('cover-close-btn')?.focus();
}

let coverReturnFocus = null;

function closeCoverModal() {
  const coverModal = document.getElementById('cover-modal');
  if (coverModal && coverModal.classList.contains('open')) {
    coverModal.classList.remove('open');
    document.body.style.overflow = 'auto';
    window.__lenis?.start();
    if (coverReturnFocus && coverReturnFocus.focus) coverReturnFocus.focus();
    coverReturnFocus = null;
  }
}

// Bind to window for global inline onclick support
window.openCoverModal = openCoverModal;
window.closeCoverModal = closeCoverModal;
window.openVideoModal = openVideoModal;
window.closeVideoModal = closeVideoModal;

// ============================================
// 9. CLOSE MODALS WITH ESCAPE KEY
// ============================================
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeVideoModal();
    closeCoverModal();
    if (mobileNav && mobileNav.classList.contains('open')) {
      setMobileNav(false);
      hamburger.focus();
    }
  }
});

// ============================================
// 10. BOOKING SESSION SELECTION & PREFILL
// ============================================
const bookingButtons = document.querySelectorAll('.booking-btn');
const contactMessage = document.getElementById('contact-message');

bookingButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const plan = btn.getAttribute('data-plan');
    if (contactMessage && plan) {
      contactMessage.value = `Hello Ocompos,\n\nI would like to book a session for: ${plan}.\n\nPreferred dates/times:\nArtist / Project Name:\nAdditional notes: `;
      setTimeout(() => {
        contactMessage.focus();
      }, 350);
    }
  });
});

// === SOCIAL PLACEHOLDERS ===
// Never ship a broken link: hide any button whose href is still a placeholder.
document.querySelectorAll('a[href*="REPLACE_WITH"]').forEach(a => { a.hidden = true; });

// ============================================
// 11. IN-PAGE ANCHORS → scrollToTarget()
// Delegated. The skip link is left native so it moves keyboard focus.
// ============================================
const isPlainClick = (e) =>
  !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

document.addEventListener('click', (e) => {
  if (!isPlainClick(e)) return;
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.matches('[data-scroll-to-contact], .skip-link')) return;
  const id = decodeURIComponent(a.getAttribute('href').slice(1));
  const target = id && document.getElementById(id);
  if (!target) return;
  e.preventDefault();
  if (mobileNav && mobileNav.classList.contains('open')) setMobileNav(false);
  scrollToTarget(target);
});

// === SCROLL TO CONTACT === scroll, then put the cursor in the name field.
document.addEventListener('click', (e) => {
  if (!isPlainClick(e)) return;
  const cta = e.target.closest('[data-scroll-to-contact]');
  const contact = document.getElementById('contact');
  if (!cta || !contact) return;
  e.preventDefault();
  if (mobileNav && mobileNav.classList.contains('open')) setMobileNav(false);
  scrollToTarget(contact, () => {
    document.getElementById('contact-name')?.focus({ preventScroll: true });
  });
  history.replaceState(null, '', '#contact');
});

// ============================================
// 12. 3D HERO INTERACTION (Viewport Client Coordinates)
// ============================================
// Owns .hero-content's transform. GSAP animates .hero-fade (outside it) and
// the children inside it, never this element. Desktop pointers only.
const container = document.querySelector('.hero-container');
const content = document.getElementById('heroContent');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

if (container && content && !reduceMotion) {
  let heroInView = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      heroInView = entry.isIntersecting;
    }).observe(container);
  }

  const handleTilt = (clientX, clientY) => {
    if (!heroInView || !finePointer.matches) return;
    const rect = container.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const percentX = (clientX - centerX) / (rect.width / 2);
    const percentY = (clientY - centerY) / (rect.height / 2);

    const maxDeg = 10;
    const rotateY = Math.max(-maxDeg, Math.min(maxDeg, -percentX * maxDeg));
    const rotateX = Math.max(-maxDeg, Math.min(maxDeg, percentY * maxDeg));

    content.style.transform = `rotateY(${rotateY.toFixed(2)}deg) rotateX(${rotateX.toFixed(2)}deg)`;
  };

  // Mouse Movement (Desktop)
  container.addEventListener('mousemove', (e) => {
    handleTilt(e.clientX, e.clientY);
  });

  // Reset to flat when mouse leaves
  container.addEventListener('mouseleave', () => {
    content.style.transform = 'rotateY(0deg) rotateX(0deg)';
    content.style.transition = 'transform 0.6s ease-out';
  });

  // Remove transition on mouse enter for smooth follow
  container.addEventListener('mouseenter', () => {
    content.style.transition = 'none';
  });
}

// ============================================
// 12a. HERO LOGO 3D
// The logo floats with a slow 3D sway; a tap / click spins it a full turn
// in depth. GSAP owns the <picture> (the wrap belongs to the scroll
// timeline and the <img> keeps its CSS hover scale).
// ============================================
const logo3d = document.querySelector('.hero-logo-wrap picture');
if (logo3d && hasGsap && !reduceMotion) {
  gsap.set(logo3d, { transformPerspective: 900, transformStyle: 'preserve-3d' });
  gsap.to(logo3d, { rotationX: 7, y: -8, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  gsap.fromTo(logo3d, { rotationZ: -1.2 }, { rotationZ: 1.2, duration: 4.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });

  let spinning = false;
  const spin = () => {
    if (spinning) return;
    spinning = true;
    gsap.timeline({ onComplete: () => { spinning = false; gsap.set(logo3d, { rotationY: 0 }); } })
      .to(logo3d, { rotationY: '+=360', duration: 1.3, ease: 'power3.inOut' }, 0)
      .to(logo3d, { scale: 1.12, z: 80, duration: 0.65, ease: 'power2.out' }, 0)
      .to(logo3d, { scale: 1, z: 0, duration: 0.8, ease: 'back.out(2)' }, 0.65);
    document.querySelector('.hero-logo-wrap .hero-glow')?.classList.add('is-lit');
    setTimeout(() => document.querySelector('.hero-logo-wrap .hero-glow')?.classList.remove('is-lit'), 1300);
  };
  const logoImg = logo3d.querySelector('img');
  logoImg.style.cursor = 'pointer';
  logoImg.setAttribute('role', 'button');
  logoImg.setAttribute('tabindex', '0');
  logoImg.setAttribute('aria-label', 'Ocompos — spin logo');
  logoImg.addEventListener('click', spin);
  logoImg.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); spin(); }
  });
}

// ============================================
// 12b. HERO LOGO GLOW
// The soft light behind the logo follows the pointer / finger and flares
// on touch and while the page is being scrolled.
// ============================================
const heroGlow = document.querySelector('.hero-logo-wrap .hero-glow');
if (heroGlow && !reduceMotion) {
  const hero = document.querySelector('.hero-container') || heroGlow.parentElement;
  const moveGlow = (clientX, clientY) => {
    const r = heroGlow.getBoundingClientRect();
    const gx = Math.max(10, Math.min(90, ((clientX - r.left) / r.width) * 100));
    const gy = Math.max(15, Math.min(85, ((clientY - r.top) / r.height) * 100));
    heroGlow.style.setProperty('--gx', gx.toFixed(1) + '%');
    heroGlow.style.setProperty('--gy', gy.toFixed(1) + '%');
  };
  let litTimer = 0;
  const light = (ms = 700) => {
    heroGlow.classList.add('is-lit');
    clearTimeout(litTimer);
    litTimer = setTimeout(() => heroGlow.classList.remove('is-lit'), ms);
  };
  hero.addEventListener('pointermove', (e) => moveGlow(e.clientX, e.clientY), { passive: true });
  hero.addEventListener('pointerdown', (e) => {
    moveGlow(e.clientX, e.clientY);
    light();
  }, { passive: true });
  hero.addEventListener('pointerleave', () => {
    heroGlow.style.setProperty('--gx', '50%');
    heroGlow.style.setProperty('--gy', '50%');
  });
  // Scroll: flare while scrolling, only when the hero is on screen.
  let glowTicking = false;
  window.addEventListener('scroll', () => {
    if (glowTicking) return;
    glowTicking = true;
    requestAnimationFrame(() => {
      glowTicking = false;
      const r = hero.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) light(400);
    });
  }, { passive: true });
}

// ============================================
// 13. KEYBOARD ACCESS FOR CLICKABLE CARDS
// Video tiles and cover tiles are <div>/<article> elements with click
// handlers or inline onclick. Make them focusable and operable with
// Enter / Space without rewriting the card markup.
// ============================================
document.querySelectorAll('.work-card[data-video], [onclick*="openCoverModal"]').forEach(card => {
  if (card.tagName === 'A' || card.tagName === 'BUTTON') return;
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  if (!card.hasAttribute('aria-label')) {
    const heading = card.querySelector('h4, .work-title');
    const img = card.querySelector('img');
    const name = (heading && heading.textContent.trim()) || (img && img.alt) || '';
    card.setAttribute('aria-label', (card.dataset.video ? 'play video: ' : 'view cover: ') + name);
  }
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      card.click();
    }
  });
});

// ============================================
// 14. SCROLL-SPY — highlight the nav link of the section in view
// ============================================
const spyLinks = document.querySelectorAll('nav a[href^="#"]');
if (spyLinks.length && 'IntersectionObserver' in window) {
  const linkFor = new Map();
  spyLinks.forEach(link => {
    const sec = document.querySelector(link.getAttribute('href'));
    if (sec) linkFor.set(sec, link);
  });

  const spy = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      spyLinks.forEach(l => l.removeAttribute('aria-current'));
      const link = linkFor.get(entry.target);
      if (link) link.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });

  document.querySelectorAll('main > section').forEach(sec => spy.observe(sec));
}

// ============================================
// 15. "SOUNDS I'VE PRODUCED" PLAYER
// One <audio>, a main transport, and a playlist of .track buttons.
// Each track is defined by data-audio / data-title / data-meta / data-year.
// Missing files are detected up front and their rows disabled.
// ============================================
const playerEl = document.querySelector('[data-player]');
if (playerEl) {
  const audio = new Audio();
  audio.preload = 'metadata';

  const toggle = playerEl.querySelector('.player-toggle');
  const titleEl = playerEl.querySelector('.now-title');
  const metaEl = playerEl.querySelector('.now-meta');
  const seek = playerEl.querySelector('.seek');
  const tCur = playerEl.querySelector('.t-cur');
  const tDur = playerEl.querySelector('.t-dur');
  const status = playerEl.querySelector('[data-player-status]');
  const tracks = Array.from(playerEl.querySelectorAll('.track'));
  const playlistEl = playerEl.querySelector('.playlist');
  const slots = tracks.map(t => t.closest('li'));
  const nowCover = playerEl.querySelector('.now-cover');
  const ambient = playerEl.querySelector('.player-ambient');
  const dotsEl = playerEl.querySelector('.player-dots');
  const dots = tracks.map(() => {
    const d = document.createElement('span');
    if (dotsEl) dotsEl.appendChild(d);
    return d;
  });

  let index = -1;     // loaded track
  let view = 0;       // centred card (differs from index only while browsing an empty playlist)
  let pending = tracks.length;
  let available = 0;
  const ctrl = { pause: () => audio.pause() };

  // --- Artwork: only tracks with a data-cover get an image ---
  const coverImg = (src) => {
    const img = new Image();
    img.alt = '';
    img.decoding = 'async';
    img.src = src;
    return img;
  };
  tracks.forEach(btn => {
    if (btn.dataset.cover) btn.querySelector('.track-cover')?.appendChild(coverImg(btn.dataset.cover));
  });
  const showCover = (btn) => {
    const src = btn && btn.dataset.cover;
    [nowCover, ambient].forEach(el => {
      if (!el) return;
      el.querySelector('img')?.remove();
      if (src) el.appendChild(coverImg(src));
    });
  };

  // --- Carousel (endless loop): each slot gets its shortest circular
  // distance from the centre card; CSS turns --offset / --abs into the 3D layout. ---
  const n = tracks.length;
  const wrap = (j) => ((j % n) + n) % n;

  // Next playable track in a direction, wrapping around; never the track itself.
  const availableFrom = (from, dir) => {
    for (let k = 1; k < n; k++) {
      const j = wrap(from + dir * k);
      if (!tracks[j].disabled) return j;
    }
    return -1;
  };

  const browsing = () => available === 0 || index === -1;

  // `drag` is a fractional card count while the carousel is being dragged,
  // so the cards follow the finger instead of jumping one step at a time.
  const positionCards = (drag = 0) => {
    slots.forEach((li, j) => {
      let offset = wrap(j - view);
      if (offset > n / 2) offset -= n;
      offset -= drag;
      const abs = Math.abs(offset);
      // A card wrapping from one end to the other would fly across the stage
      // behind the others; place it without a transition instead.
      const prev = Number(li.dataset.offset);
      const jump = !drag && li.dataset.offset !== undefined && Math.abs(offset - prev) > 2;
      if (jump) li.style.transition = 'none';
      li.style.setProperty('--offset', offset);
      li.style.setProperty('--abs', Math.min(abs, 3));
      li.style.zIndex = String(10 - Math.round(abs));
      li.classList.toggle('is-far', abs > 2.5);
      li.dataset.offset = offset;
      if (jump) {
        void li.offsetWidth;
        li.style.transition = '';
      }
    });
    dots.forEach((d, j) => d.classList.toggle('is-active', j === view));
  };

  // <audio> stays the source of truth. Playback eases the playhead; user
  // seeks and reduced motion set it instantly.
  const setProgress = (t, d, smooth) => {
    const pct = (d > 0 ? (t / d) * 100 : 0) + '%';
    if (smooth && hasGsap && !reduceMotion) {
      gsap.to(seek, { '--progress': pct, duration: 0.15, ease: 'none', overwrite: true });
    } else if (hasGsap) {
      gsap.set(seek, { '--progress': pct, overwrite: true });
    } else {
      seek.style.setProperty('--progress', pct);
    }
    tCur.textContent = formatTime(t);
  };

  const markUnavailable = (btn) => {
    if (btn.classList.contains('is-unavailable')) return;
    btn.classList.add('is-unavailable');
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    const meta = btn.querySelector('.track-meta');
    if (meta) meta.textContent = 'coming soon';
  };

  const nextAvailable = (from) => {
    for (let j = from + 1; j < tracks.length; j++) {
      if (!tracks[j].disabled) return j;
    }
    return -1;
  };

  const load = (i) => {
    index = i;
    const btn = tracks[i];
    audio.src = btn.dataset.audio;
    titleEl.textContent = btn.dataset.title || '';
    metaEl.textContent = [btn.dataset.meta, btn.dataset.year].filter(Boolean).join(' · ');
    tracks.forEach((t, j) => {
      t.classList.toggle('is-active', j === i);
      if (j === i) t.setAttribute('aria-current', 'true');
      else t.removeAttribute('aria-current');
    });
    seek.value = 0;
    setProgress(0, 0);
    tDur.textContent = formatTime(parseFloat(btn.dataset.duration));
    toggle.disabled = false;
    seek.disabled = false;
    playerEl.classList.remove('is-empty');
    view = i;
    showCover(btn);
    positionCards();
  };

  const play = () => {
    AudioBus.claim(ctrl);
    audio.play().catch(() => { });
  };

  const showEmpty = () => {
    playerEl.classList.add('is-empty');
    titleEl.textContent = 'tracks coming soon';
    metaEl.textContent = 'new releases are being added';
    toggle.disabled = true;
    seek.disabled = true;
  };

  const probeDone = () => {
    pending--;
    if (pending > 0) return;
    if (available === 0) showEmpty();
    else if (index === -1) load(nextAvailable(-1));
    positionCards();
  };

  // Probe every file once so missing ones show as disabled rather than failing on click.
  // Each probe is torn down after reading metadata so it doesn't keep downloading
  // the whole file and holding a connection the other players need.
  tracks.forEach(btn => {
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.addEventListener('loadedmetadata', () => {
      btn.dataset.duration = probe.duration;
      available++;
      if (tracks[index] === btn) tDur.textContent = formatTime(probe.duration);
      probe.removeAttribute('src');
      probe.load();
      probeDone();
    }, { once: true });
    probe.addEventListener('error', () => {
      if (btn.dataset.duration) return;   // teardown above, not a missing file
      markUnavailable(btn);
      probeDone();
    }, { once: true });
    probe.src = btn.dataset.audio;
  });

  tracks.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      if (i === index) {
        if (audio.paused) play();
        else audio.pause();
      } else {
        load(i);
        play();
      }
    });
  });

  toggle.addEventListener('click', () => {
    if (index === -1) return;
    if (audio.paused) play();
    else audio.pause();
  });

  // Prev / next: jump to the neighbouring playable track, keeping playback
  // going if it was already playing. With nothing playable, just browse cards.
  const step = (dir) => {
    if (browsing()) {
      view = wrap(view + dir);
      positionCards();
      return;
    }
    const j = availableFrom(index, dir);
    if (j === -1) return;
    const wasPlaying = !audio.paused;
    load(j);
    if (wasPlaying) play();
  };

  if (playlistEl) {
    playlistEl.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      step(e.key === 'ArrowRight' ? 1 : -1);
      const centre = tracks[view];
      if (centre && !centre.disabled) centre.focus({ preventScroll: true });
    });

    // --- Drag / swipe / horizontal wheel: the cards track the gesture
    // live, then glide to the nearest card on release. ---
    const spacing = () => (slots[0] ? slots[0].offsetWidth * 0.62 : 200);
    let drag = 0;
    let swallowClick = false;

    const settle = (velocity = 0) => {
      playlistEl.classList.remove('is-dragging');
      let count = Math.round(drag + velocity * 0.25);
      count = Math.max(-(n - 1), Math.min(n - 1, count));
      drag = 0;
      if (count === 0) { positionCards(); return; }
      const dir = Math.sign(count);
      for (let k = 0; k < Math.abs(count); k++) step(dir);
    };

    const follow = (value) => {
      drag = Math.max(-(n - 1), Math.min(n - 1, value));
      playlistEl.classList.add('is-dragging');
      positionCards(drag);
    };

    let wheelTimer = 0;
    playlistEl.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) < 2 || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      follow(drag + e.deltaX / spacing());
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => settle(), 140);
    }, { passive: false });

    // touch-action: pan-y leaves vertical scrolling native; a vertical
    // scroll cancels the pointer and the cards spring back.
    let swipe = null;
    playlistEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      swipe = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastT: performance.now(), v: 0, active: false };
    });
    window.addEventListener('pointermove', (e) => {
      if (!swipe) return;
      const dx = e.clientX - swipe.x;
      const dy = e.clientY - swipe.y;
      if (!swipe.active) {
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
        swipe.active = true;
      }
      const now = performance.now();
      const dt = Math.max(1, now - swipe.lastT);
      swipe.v = (-(e.clientX - swipe.lastX) / spacing()) / dt * 1000;   // cards per second
      swipe.lastX = e.clientX;
      swipe.lastT = now;
      follow(-dx / spacing());
    });
    const endSwipe = (cancelled) => {
      if (!swipe) return;
      const s = swipe;
      swipe = null;
      if (!s.active) return;
      if (cancelled) { drag = 0; playlistEl.classList.remove('is-dragging'); positionCards(); return; }
      settle(performance.now() - s.lastT > 90 ? 0 : s.v);
      // The drag also ends in a click on the card under the pointer; drop it.
      swallowClick = true;
      setTimeout(() => { swallowClick = false; }, 0);
    };
    window.addEventListener('pointerup', () => endSwipe(false));
    window.addEventListener('pointercancel', () => endSwipe(true));
    playlistEl.addEventListener('click', (e) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
    }, true);
  }

  positionCards();

  seek.addEventListener('input', () => {
    const t = parseFloat(seek.value);
    audio.currentTime = t;
    setProgress(t, audio.duration);
  });

  audio.addEventListener('loadedmetadata', () => {
    seek.max = audio.duration;
    tDur.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('timeupdate', () => {
    seek.value = audio.currentTime;
    setProgress(audio.currentTime, audio.duration, true);
  });

  audio.addEventListener('play', () => {
    playerEl.classList.add('is-playing');
    toggle.setAttribute('aria-label', 'pause');
    if (status) status.textContent = 'playing ' + (tracks[index]?.dataset.title || '');
  });

  audio.addEventListener('pause', () => {
    playerEl.classList.remove('is-playing');
    toggle.setAttribute('aria-label', 'play');
    if (status) status.textContent = 'paused';
  });

  // The playlist loops: after the last track it carries on from the first.
  audio.addEventListener('ended', () => {
    const next = availableFrom(index, 1);
    if (next !== -1) {
      load(next);
      play();
    } else {
      AudioBus.release(ctrl);
      audio.currentTime = 0;
    }
  });

  // A file that probed fine but fails at play time: disable it and move on.
  audio.addEventListener('error', () => {
    if (index === -1 || !audio.getAttribute('src')) return;
    markUnavailable(tracks[index]);
    const next = nextAvailable(index);
    if (next !== -1) load(next);
    else showEmpty();
    positionCards();
  });
}

// ============================================
// 16. BEFORE / AFTER (A/B) COMPARISON
// Each pair plays the raw and final files together, in sync. Only one is
// audible; the A/B toggle flips .muted, so switching is instant and never
// restarts the track. Raw is the master clock; the final file is snapped
// back whenever it drifts more than 50ms.
// ============================================
const abEl = document.querySelector('[data-ab]');
if (abEl) {
  const DRIFT = 0.05;
  const BAR_COUNT = 64;

  const pairs = Array.from(abEl.querySelectorAll('.ab-pair'));
  const tabsEl = abEl.querySelector('.ab-tabs');
  const stage = abEl.querySelector('.ab-stage');
  const playBtn = abEl.querySelector('.ab-play');
  const seek = abEl.querySelector('.seek');
  const tCur = abEl.querySelector('.t-cur');
  const tDur = abEl.querySelector('.t-dur');
  const label = abEl.querySelector('.ab-label');
  const barsEl = abEl.querySelector('.ab-bars');
  const visual = abEl.querySelector('.ab-visual');
  const timeTag = abEl.querySelector('.ab-time');
  const captionTitle = abEl.querySelector('.ab-caption-title');
  const opts = Array.from(abEl.querySelectorAll('.ab-opt'));
  const note = abEl.querySelector('[data-ab-status]');

  let side = 'raw';
  let active = null;
  let rafId = null;
  let playedBars = 0;
  // The sweep is feedback for a user's own A/B switch only — never on load,
  // scroll-in, or programmatic state changes.
  let userHasInteracted = false;

  // Waveform-style bars: seeded so the shape is the same on every load.
  let seed = 11;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const bars = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const envelope = 0.45 + 0.55 * Math.sin((i / BAR_COUNT) * Math.PI);
    const h = Math.max(0.12, Math.min(1, envelope * (0.45 + rand() * 0.55)));
    const bar = document.createElement('span');
    bar.className = 'ab-bar';
    bar.style.setProperty('--h', h.toFixed(3));
    bar.style.setProperty('--d', (-rand() * 0.9).toFixed(2) + 's');
    barsEl.appendChild(bar);
    bars.push(bar);
  }

  const setPlayedBars = (ratio) => {
    const n = Math.round(ratio * BAR_COUNT);
    if (n === playedBars) return;
    const [lo, hi] = n > playedBars ? [playedBars, n] : [n, playedBars];
    for (let i = lo; i < hi; i++) bars[i].classList.toggle('is-played', i < n);
    playedBars = n;
  };

  const states = pairs.map((el, i) => ({
    el,
    i,
    title: el.dataset.title || 'Track ' + (i + 1),
    raw: null,
    fin: null,
    ok: null,          // null = loading, true = both files ready, false = missing
    metaCount: 0,
    wantPlay: false,
    tab: null
  }));

  const updateTimes = (st) => {
    const d = st.raw && isFinite(st.raw.duration) ? st.raw.duration : 0;
    const t = st.raw ? st.raw.currentTime : 0;
    seek.value = t;
    seek.style.setProperty('--progress', (d > 0 ? (t / d) * 100 : 0) + '%');
    tCur.textContent = formatTime(t);
    setPlayedBars(d > 0 ? t / d : 0);
    updateTimeTag(st);
  };

  // Live "m:ss / m:ss" from the raw file: it's the master clock (the final
  // file is snapped to it), so this always agrees with the seek bar.
  const updateTimeTag = (st) => {
    if (!timeTag) return;
    const a = st && st.raw;
    const ready = st && st.ok === true && a && isFinite(a.duration);
    timeTag.textContent = ready
      ? formatTime(a.currentTime) + ' / ' + formatTime(a.duration)
      : '0:00 / –:––';
  };

  const sweep = (toFinal) => {
    if (!userHasInteracted || reduceMotion || !visual) return;
    visual.classList.remove('is-sweeping');
    visual.classList.toggle('is-reverse', !toFinal);
    void visual.offsetWidth; // restart the animation
    visual.classList.add('is-sweeping');
  };
  if (visual) {
    visual.addEventListener('animationend', (e) => {
      if (e.animationName === 'ab-sweep') visual.classList.remove('is-sweeping');
    });
  }

  const renderControls = () => {
    const st = active;
    const ready = st && st.ok === true;
    playBtn.disabled = !ready;
    seek.disabled = !ready;
    abEl.classList.toggle('is-unavailable', !!st && st.ok === false);
    if (!st || st.ok === null) note.textContent = 'loading…';
    else if (st.ok === false) note.textContent = 'this comparison is not available yet';
    else note.textContent = 'switch A / B while it plays — same moment, instant.';
    if (ready) {
      seek.max = st.raw.duration;
      tDur.textContent = formatTime(st.raw.duration);
    } else {
      tDur.textContent = '0:00';
    }
    if (st) updateTimes(st);
  };

  const applySide = () => {
    abEl.dataset.side = side;
    label.textContent = side === 'raw' ? 'RAW / ORIGINAL' : 'MIXED / MASTERED';
    opts.forEach(o => o.setAttribute('aria-pressed', String(o.dataset.side === side)));
    states.forEach(st => {
      if (!st.raw) return;
      st.raw.muted = side !== 'raw';
      st.fin.muted = side !== 'final';
    });
  };

  const stopLoop = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  };

  const tick = () => {
    const st = active;
    if (!st || !st.wantPlay) {
      rafId = null;
      return;
    }
    const { raw, fin } = st;
    if (!raw.seeking && !fin.seeking && !raw.paused && !fin.paused &&
      Math.abs(raw.currentTime - fin.currentTime) > DRIFT) {
      fin.currentTime = raw.currentTime;
    }
    updateTimes(st);
    rafId = requestAnimationFrame(tick);
  };

  const setPlayingUI = (on) => {
    abEl.classList.toggle('is-playing', on);
    playBtn.setAttribute('aria-label', on ? 'pause' : 'play');
  };

  const pausePair = (st) => {
    if (!st || !st.raw) return;
    st.wantPlay = false;
    st.raw.pause();
    st.fin.pause();
    if (st === active) {
      stopLoop();
      setPlayingUI(false);
      updateTimes(st);
    }
  };

  const ctrl = { pause: () => pausePair(active) };

  const playPair = (st) => {
    if (!st || st.ok !== true) return;
    AudioBus.claim(ctrl);
    st.wantPlay = true;
    if (Math.abs(st.raw.currentTime - st.fin.currentTime) > DRIFT) st.fin.currentTime = st.raw.currentTime;
    setPlayingUI(true);
    Promise.all([st.raw.play(), st.fin.play()])
      .then(() => {
        if (!rafId) rafId = requestAnimationFrame(tick);
      })
      .catch(() => pausePair(st));
  };

  const onEnded = (st) => () => {
    pausePair(st);
    st.raw.currentTime = 0;
    st.fin.currentTime = 0;
    AudioBus.release(ctrl);
    if (st === active) updateTimes(st);
  };

  const markPairUnavailable = (st) => {
    if (st.ok === false) return;
    st.ok = false;
    st.tab.classList.add('is-unavailable');
    st.tab.querySelector('.ab-tab-note').textContent = 'soon';
    if (st === active) renderControls();
  };

  const createAudio = (st) => {
    const make = (src) => {
      const a = new Audio();
      a.preload = 'metadata';
      a.src = src;
      return a;
    };
    st.raw = make(st.el.dataset.before);
    st.fin = make(st.el.dataset.after);

    [st.raw, st.fin].forEach(a => {
      a.addEventListener('loadedmetadata', () => {
        st.metaCount++;
        if (st.metaCount === 2 && st.ok !== false) {
          st.ok = true;
          if (st === active) renderControls();
        }
      }, { once: true });
      a.addEventListener('error', () => markPairUnavailable(st));
      a.addEventListener('ended', onEnded(st));
    });

    // Buffering: if one stalls, hold the other; resume both together.
    const hold = (other) => () => {
      if (st.wantPlay) other.pause();
    };
    const resume = () => {
      const { raw, fin } = st;
      if (!st.wantPlay || !(raw.paused || fin.paused)) return;
      if (raw.readyState < 3 || fin.readyState < 3) return;
      // Only re-seek when actually out of sync: a seek can itself trigger
      // 'waiting', which would otherwise loop hold → resume → seek.
      if (Math.abs(raw.currentTime - fin.currentTime) > DRIFT) fin.currentTime = raw.currentTime;
      raw.play().catch(() => { });
      fin.play().catch(() => { });
    };
    st.raw.addEventListener('waiting', hold(st.fin));
    st.fin.addEventListener('waiting', hold(st.raw));
    ['canplay', 'playing'].forEach(ev => {
      st.raw.addEventListener(ev, resume);
      st.fin.addEventListener(ev, resume);
    });
  };

  const select = (st, focus) => {
    if (active && active !== st) pausePair(active);
    active = st;
    playedBars = 0;
    bars.forEach(b => b.classList.remove('is-played'));
    states.forEach(s => {
      const on = s === st;
      s.tab.setAttribute('aria-selected', String(on));
      s.tab.tabIndex = on ? 0 : -1;
    });
    if (st.raw) {
      st.raw.preload = 'auto';
      st.fin.preload = 'auto';
    }
    if (focus) st.tab.focus();
    if (captionTitle) captionTitle.textContent = st.title;
    positionInk();
    renderControls();
  };

  // Sliding active underline for the segmented tabs (transform only).
  const ink = document.createElement('span');
  ink.className = 'ab-tabs-ink';
  ink.setAttribute('aria-hidden', 'true');
  const positionInk = () => {
    const tab = active && active.tab;
    if (!tab) return;
    // Pill highlight behind the active chip: size snaps, only the move animates.
    ink.style.width = tab.offsetWidth + 'px';
    ink.style.height = tab.offsetHeight + 'px';
    ink.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`;
  };

  // Build tabs
  stage.id = stage.id || 'ab-stage';
  stage.setAttribute('role', 'tabpanel');
  states.forEach(st => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'ab-tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', stage.id);
    tab.innerHTML = '<span class="ab-tab-title"></span><span class="ab-tab-note"></span>';
    tab.querySelector('.ab-tab-title').textContent = st.title;
    tab.addEventListener('click', () => select(st));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      select(states[(st.i + dir + states.length) % states.length], true);
    });
    tabsEl.appendChild(tab);
    st.tab = tab;
    createAudio(st);
  });
  tabsEl.appendChild(ink);
  tabsEl.classList.toggle('is-single', states.length < 2);
  // Chips change width when a "soon" note is added; keep the pill fitted.
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(positionInk);
    ro.observe(tabsEl);
    states.forEach(st => ro.observe(st.tab));
  }

  playBtn.addEventListener('click', () => {
    if (!active) return;
    if (active.wantPlay) pausePair(active);
    else playPair(active);
  });

  seek.addEventListener('input', () => {
    if (!active || !active.raw) return;
    const t = parseFloat(seek.value);
    active.raw.currentTime = t;
    active.fin.currentTime = t;
    updateTimes(active);
  });

  // The waveform is the visible progress bar: click a point to jump there.
  barsEl.addEventListener('click', (e) => {
    if (!active || active.ok !== true) return;
    const r = barsEl.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const t = ratio * active.raw.duration;
    active.raw.currentTime = t;
    active.fin.currentTime = t;
    updateTimes(active);
  });

  // Buttons fire click for Enter/Space too, so this covers keyboard toggles.
  opts.forEach(o => o.addEventListener('click', () => {
    userHasInteracted = true;
    if (o.dataset.side === side) return;
    side = o.dataset.side;
    applySide();
    if (active) updateTimeTag(active);
    sweep(side === 'final');
  }));

  applySide();
  if (states.length) select(states[0]);
}

// ============================================
// 17. CONSOLE LOG (optional)
// ============================================
console.log('🎵 ByOcompos - Audio Engineer');
console.log('📧 contact@byocompos.com');