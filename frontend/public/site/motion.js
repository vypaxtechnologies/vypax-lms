/* Original motion implementation inspired by Vypax's public visual style. */
(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Set();
  const seen = new WeakSet();
  const easing = 'cubic-bezier(.22,1,.36,1)';
  function reveal(element, delay = 0) {
    if (seen.has(element) || preference.matches) return;
    seen.add(element);
    const animation = element.animate([
      { opacity: 0, transform: 'translateY(28px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 750, delay, easing, fill: 'backwards' });
    active.add(animation);
    animation.finished.catch(() => {}).finally(() => active.delete(animation));
  }
  document.querySelectorAll('.edtech-hero-content > *').forEach((element, index) => reveal(element, index * 80));
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      reveal(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: .12, rootMargin: '0px 0px -24px 0px' });
  document.querySelectorAll('.section-head, .section-heading, .course-card, #service-cards article, .hack-summary article, .hack-stage-list li, .hack-awards article').forEach(element => observer.observe(element));
  preference.addEventListener('change', () => {
    if (preference.matches) active.forEach(animation => animation.cancel());
  });
  // Newly rendered training cards get the same entrance treatment after filtering.
  const catalogue = document.querySelector('#course-cards');
  if (catalogue) new MutationObserver(() => {
    catalogue.querySelectorAll('.course-card').forEach(element => observer.observe(element));
  }).observe(catalogue, { childList: true });
})();

// Autoplay the muted hero video and loop continuously while this page is visible.
(() => {
 const video=document.querySelector('.hero-background-video');if(!video)return;
 video.defaultMuted=true;video.muted=true;video.autoplay=true;video.loop=true;video.playsInline=true;video.preload='auto';
 const play=()=>{if(!document.hidden)video.play().catch(()=>{});};
 video.addEventListener('loadeddata',play);video.addEventListener('canplay',play);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();else play()});
 document.addEventListener('pointerdown',play,{once:true});play();
})();

// Give catalog cards a full-area link, including cards added by filters.
(() => {
 const selector='#service-cards article,#course-cards article,#hackathon-cards article,.skill-card,.course-card,.hackathon-card,.goal-card';
 function connect(){document.querySelectorAll(selector).forEach(card=>{
  if(card.querySelector('.card-page-link,.course-card-link,.hack-card-link'))return;
  const primary=card.querySelector('a[href]');if(!primary)return;
  const title=card.querySelector('h3,h2')?.textContent?.trim()||'details';
  const link=document.createElement('a');link.className='card-page-link';link.setAttribute('aria-label','Open '+title);
  link.href=card.closest('#service-cards')?'contact.html?type=IT%20Services&interest='+encodeURIComponent(title)+'#enquiry':primary.href;
  card.classList.add('clickable-catalog-card');card.append(link);
 })}
 connect();new MutationObserver(connect).observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
})();
