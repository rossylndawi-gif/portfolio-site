
// ============================================
// 1. PRELOADER LOGIC (With Safety Fallback)
// ============================================
const hidePreloader = () => {
  const loader = document.getElementById('preloader');
  if (loader && loader.style.display !== 'none') {
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.style.display = 'none';
    }, 800);
  }
};

// Hide as soon as the DOM is usable; waiting for every image and font made
// the page feel slower than it is.
document.addEventListener('DOMContentLoaded', hidePreloader);
// Fallback so preloader never blocks the page
setTimeout(hidePreloader, 800);

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
// 4. SCROLL REVEAL ANIMATIONS (IntersectionObserver)
// ============================================
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
    if (closeModal) closeModal.focus();
  }
}

// Function to close video modal
function closeVideoModal() {
  if (modal && modalIframe && modal.classList.contains('open')) {
    modal.classList.remove('open');
    modalIframe.src = '';
    document.body.style.overflow = 'auto';
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
  document.getElementById('cover-close-btn')?.focus();
}

let coverReturnFocus = null;

function closeCoverModal() {
  const coverModal = document.getElementById('cover-modal');
  if (coverModal && coverModal.classList.contains('open')) {
    coverModal.classList.remove('open');
    document.body.style.overflow = 'auto';
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

// ============================================
// 11. SMOOTH SCROLL FOR NAV LINKS
// ============================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href === '#') return;

    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      const headerHeight = document.querySelector('header')?.offsetHeight || 0;
      const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    }
  });
});

// ============================================
// 12. 3D HERO INTERACTION (Viewport Client Coordinates)
// ============================================
const container = document.querySelector('.hero-container');
const content = document.getElementById('heroContent');

if (container && content) {
  const handleTilt = (clientX, clientY) => {
    const rect = container.getBoundingClientRect();
    // Only tilt when hero is within viewport
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;

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

  // Touch Movement (Mobile/Tablet)
  container.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      handleTilt(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

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

  let index = -1;
  let pending = tracks.length;
  let available = 0;
  const ctrl = { pause: () => audio.pause() };

  const setProgress = (t, d) => {
    const pct = d > 0 ? (t / d) * 100 : 0;
    seek.style.setProperty('--progress', pct + '%');
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
    setProgress(audio.currentTime, audio.duration);
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

  audio.addEventListener('ended', () => {
    const next = nextAvailable(index);
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
  const opts = Array.from(abEl.querySelectorAll('.ab-opt'));
  const note = abEl.querySelector('[data-ab-status]');

  let side = 'raw';
  let active = null;
  let rafId = null;
  let playedBars = 0;

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
  };

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
    renderControls();
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

  opts.forEach(o => o.addEventListener('click', () => {
    side = o.dataset.side;
    applySide();
  }));

  applySide();
  if (states.length) select(states[0]);
}

// ============================================
// 17. CONSOLE LOG (optional)
// ============================================
console.log('🎵 ByOcompos - Audio Engineer');
console.log('📧 contact@byocompos.com');