(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // An explicit Play works with mouse, keyboard and touch. Pause off-screen demos.
  const videoObserver = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) target.pause();
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.show-video').forEach(video => {
    const frame = document.createElement('div');
    frame.className = 'video-frame';
    video.parentNode.insertBefore(frame, video);
    frame.appendChild(video);

    const playButton = document.createElement('button');
    playButton.type = 'button';
    playButton.className = 'video-play-button';
    playButton.setAttribute('aria-label', video.getAttribute('aria-label').replace('Video demo:', 'Play demo:'));
    playButton.textContent = '▶  Watch demo';
    playButton.addEventListener('click', () => video.play().then(() => video.focus()).catch(() => {}));
    video.addEventListener('play', () => { playButton.hidden = true; });
    video.addEventListener('pause', () => { playButton.hidden = false; });
    frame.appendChild(playButton);
    videoObserver.observe(video);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) document.querySelectorAll('.show-video').forEach(video => video.pause());
  });

  // Mobile nav
  const burger = document.getElementById('navBurger');
  const navMobile = document.getElementById('navMobile');

  burger.addEventListener('click', () => {
    const open = navMobile.classList.toggle('open');
    burger.classList.toggle('active');
    burger.setAttribute('aria-expanded', open);
  });

  navMobile.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navMobile.classList.remove('open');
      burger.classList.remove('active');
    });
  });

  // Scroll-reveal
  if (!reducedMotion) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.feature-card, .how-step, .proof-stat, .show-row').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(16px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      observer.observe(el);
    });

    // Style for .visible
    const style = document.createElement('style');
    style.textContent = '.visible{opacity:1!important;transform:none!important}';
    document.head.appendChild(style);
  }
})();
