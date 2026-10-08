// Self-paced learning with server-scored assessments and server-issued certificates.
(async () => {
  const root = document.querySelector('#learning-root'); if (!root) return;
  const params = new URLSearchParams(location.search);
  const skill = window.VYPAX_LEARNING.find(item => item.slug === params.get('skill'));
  const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
  const link = (text, href, className) => { const node = el('a', text, className); node.href = href; return node; };
  if (!skill) { root.append(el('h1', 'Choose a skill'), link('Browse all skills', 'skills.html', 'button')); return; }
  const overview = 'skill.html?skill=' + encodeURIComponent(skill.slug);
  const chapterUrl = chapter => 'lesson.html?skill=' + encodeURIComponent(skill.slug) + '&lesson=' + chapter;
  const assessmentUrl = chapterUrl('assessment');
  let state;
  async function api(action, body) {
    let response;try{response = await fetch('/api/learning/' + action + (body ? '' : '?skill=' + encodeURIComponent(skill.slug)), {
      credentials: 'same-origin', ...(body ? { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({skill:skill.slug,...body}) } : {})
    });
    }catch{throw new Error('Cannot reach the learning server. Keep your answers on this page and try submitting again once the connection returns.');}
    const result = await response.json(); if(response.status===401){location.href='account.html?next='+encodeURIComponent(location.pathname.slice(1)+location.search);throw new Error('Sign in to continue.');} if (!response.ok) throw new Error(result.error || 'Please try again.'); return result;
  }
  const loading = el('p', 'Loading your saved learning progress…', 'learning-status'); root.append(loading);
  try { state = await api('state'); } catch (error) {
    loading.textContent = error.message + ' Open the site through Launch Website.cmd or configured hosting.';
    const retry = el('button', 'Retry', 'button'); retry.onclick = () => location.reload(); root.append(retry); return;
  }
  root.replaceChildren(link('All Skills', 'skills.html', 'breadcrumb'));
  document.title = skill.name + ' | Vypax Learning';
  function progressPanel() {
    const wrap = el('div', undefined, 'learning-progress');
    const label = el('p', `${state.completed.length} / ${skill.lessons.length} chapters completed`);
    const bar = el('progress'); bar.max = skill.lessons.length; bar.value = state.completed.length; bar.setAttribute('aria-label', 'Chapter progress');
    wrap.append(label, bar); return wrap;
  }
  function curriculum(current) {
    const list = el('ol', undefined, 'lesson-list');
    skill.lessons.forEach((lesson, i) => {
      const number = i + 1, unlocked = number === 1 || state.completed.includes(number - 1);
      const item = el('li');
      const text = `${number}. ${lesson.title}${state.completed.includes(number) ? ' ✓' : !unlocked ? ' · Locked' : ''}`;
      const entry = unlocked ? link(text, chapterUrl(number)) : el('span', text, 'locked-chapter');
      if (number === current) entry.setAttribute('aria-current', 'step'); item.append(entry); list.append(item);
    });
    const final = el('li'); final.append(state.completed.length === skill.lessons.length ? link('Final assessment', assessmentUrl) : el('span', 'Final assessment · Complete all chapters', 'locked-chapter')); list.append(final); return list;
  }
  function loginCertificate(){const section=el('section',undefined,'learning-certificate');section.append(el('h2','Your certificate is ready'),el('p','Sign in or create an account to save your result and download your named certificate.'),link('Click to download certificate — Login required','account.html?next='+encodeURIComponent(assessmentUrl),'button'));return section;}
  function certificateCard(cert) {
    const section = el('section', undefined, 'learning-certificate'); section.append(el('h2', 'Your certificate is ready'), el('p', `${cert.name} · ${cert.skillName}`));
    const url = '/api/learning/certificate?id=' + encodeURIComponent(cert.id);
    const image = el('img'); image.src = url; image.alt = `Certificate of Completion for ${cert.name} in ${cert.skillName}`; image.width = 1120; image.height = 790;
    const download = link('Download certificate', url, 'button'); download.download = `Vypax-${skill.slug}-certificate.svg`;
    const view = link('Open / print certificate', url, 'button outline'); view.target = '_blank'; view.rel = 'noopener';
    const actions = el('div', undefined, 'actions'); actions.append(download, view);
    section.append(image, actions, el('p', 'Download the certificate as an image, or open it and use your browser’s Print → Save as PDF. Keep your download: learning history is saved to your account.', 'fine')); return section;
  }
  const isLesson = location.pathname.endsWith('lesson.html');
  if (!isLesson) {
    const hero = el('div', undefined, 'learning-hero'); hero.append(el('p', `${skill.category.toUpperCase()} / TAKE ASSESSMENT AND EARN YOUR CERTIFICATE`, 'eyebrow'), el('h1', skill.name), el('p', skill.description, 'intro'), progressPanel());
    const next = Math.min(skill.lessons.length, state.completed.length + 1);
    hero.append(link(state.completed.length === skill.lessons.length ? 'Take final assessment' : state.completed.length ? 'Continue learning' : 'Start chapter 1', state.completed.length === skill.lessons.length ? assessmentUrl : chapterUrl(next), 'button'));
    root.append(hero);
    const layout = el('div', undefined, 'learning-layout'); const path = el('div'); path.append(el('h2', 'Your learning path'), curriculum());
    const aside = el('aside', undefined, 'learning-aside'); aside.append(el('h3', 'Practice project'), el('p', skill.project), el('h3', 'Earn your certificate'), el('p', 'Complete all 10 chapters and score at least 70% on the 10-question final assessment. Enter the name you want printed on your certificate.'), el('p', 'Learn without login. Guest progress stays with this browser for 30 days; sign in on this browser to save it to your account and download your certificate. This is a self-paced completion certificate, not an identity-verified qualification.', 'fine'));
    layout.append(path, aside); root.append(layout); if (state.certificate) root.append(certificateCard(state.certificate)); else if(state.certificateReady)root.append(loginCertificate()); return;
  }
  if (params.get('lesson') === 'assessment') {
    root.append(link(skill.name + ' learning path', overview), el('h1', 'Final assessment'), progressPanel());
    if (state.completed.length < skill.lessons.length) { root.append(el('p', 'Complete all chapters to unlock this assessment.'), link('Continue learning', chapterUrl(state.completed.length + 1), 'button')); return; }
    if(state.guest&&state.certificateReady){root.append(loginCertificate());return;}
    if (state.certificate) { root.append(certificateCard(state.certificate)); return; }
    let assessment;
    try { assessment = await api('assessment'); } catch (error) { root.append(el('p', error.message)); return; }
    root.append(el('p', `${assessment.questions.length} questions · ${assessment.passPercentage}% required to pass. Review your name carefully; it will be printed on your certificate.`));
    const form = el('form', undefined, 'skill-assessment'); const nameLabel = el('label', 'Full name for your certificate *'); const name = el('input'); name.name = 'studentName'; name.required = true; name.minLength = 2; name.maxLength = 80; name.autocomplete = 'name'; nameLabel.append(name); form.append(nameLabel);
    assessment.questions.forEach((question, index) => {
      const field = el('fieldset'); field.append(el('legend', `${index + 1}. ${question.prompt}`));
      question.options.forEach((option, value) => { const label = el('label', undefined, 'assessment-option'); const radio = el('input'); radio.type = 'radio'; radio.name = question.id; radio.value = String(value); radio.required = true; label.append(radio, el('span', option)); field.append(label); }); form.append(field);
    });
    const submit = el('button', 'Submit assessment', 'button'); submit.type = 'submit'; const status = el('p', '', 'learning-status'); status.setAttribute('role', 'status'); form.append(submit, status);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (!form.reportValidity()) return;
      submit.disabled = true; status.textContent = 'Scoring your answers…';
      try {
        const values = new FormData(form); const result = await api('assess', {name:name.value.trim(),answers:assessment.questions.map(q=>Number(values.get(q.id)))});
        status.textContent = `${result.score} / ${result.total} — ${result.passed ? 'Passed!' : 'Not yet passed. Review the chapters and try again after 30 seconds.'}`;
        if (result.passed) { form.querySelectorAll('input').forEach(input => input.disabled = true); root.append(result.guest?loginCertificate():certificateCard(result.certificate)); submit.hidden = true; }
      } catch (error) { status.textContent = error.message; }
      finally { submit.disabled = false; }
    }); root.append(form); return;
  }
  const raw = Number(params.get('lesson') || 1); const chapter = Number.isInteger(raw) && raw >= 1 && raw <= skill.lessons.length ? raw : 1;
  if (chapter > 1 && !state.completed.includes(chapter - 1)) { root.append(el('h1', 'Complete the previous chapter first'), link('Continue your path', chapterUrl(state.completed.length + 1), 'button')); return; }
  const lesson = skill.lessons[chapter - 1]; const layout = el('div', undefined, 'learning-layout lesson-layout'); const sidebar = el('aside', undefined, 'lesson-sidebar'); sidebar.append(link(skill.name, overview), progressPanel(), curriculum(chapter));
  const article = el('article', undefined, 'lesson-content'); article.append(el('p', `CHAPTER ${chapter} OF ${skill.lessons.length}`, 'eyebrow'), el('h1', lesson.title), ...lesson.explanation.split('\n\n').map(text=>el('p',text,'lesson-explanation')));
  const actions = el('div', undefined, 'lesson-navigation'); actions.append(link(chapter > 1 ? 'Previous chapter' : 'Learning path', chapter > 1 ? chapterUrl(chapter - 1) : overview, 'button outline'));
  const complete = el('button', state.completed.includes(chapter) ? 'Continue' : 'Mark complete & continue', 'button');
  const status = el('p', ''); status.setAttribute('role', 'status'); complete.addEventListener('click', async () => { complete.disabled = true; status.textContent = 'Saving progress…'; try { await api('complete', {chapter}); location.href = chapter === skill.lessons.length ? assessmentUrl : chapterUrl(chapter + 1); } catch(error) { status.textContent = error.message; complete.disabled = false; } });
  actions.append(complete); article.append(actions, status); layout.append(sidebar, article); root.append(layout);
})();
