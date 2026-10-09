(() => {
  const root = document.querySelector('#learning-root');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const skills = Array.isArray(window.VYPAX_LEARNING) ? window.VYPAX_LEARNING : [];
  const skill = skills.find(item => item.slug === params.get('skill'));
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const link = (text, href, className) => {
    const node = element('a', text, className);
    node.href = href;
    return node;
  };

  if (!skill) {
    root.append(element('h1', 'Choose a skill'), link('Browse all skills', 'skills.html', 'button'));
    return;
  }

  const lessons = Array.isArray(skill.lessons) ? skill.lessons : [];
  const overviewUrl = `skill.html?skill=${encodeURIComponent(skill.slug)}`;
  const lessonUrl = number => `lesson.html?skill=${encodeURIComponent(skill.slug)}&lesson=${number}`;
  const list = current => {
    const items = element('ol', undefined, 'lesson-list');
    lessons.forEach((lesson, index) => {
      const number = index + 1;
      const item = element('li');
      const entry = link(`${number}. ${lesson.title}`, lessonUrl(number));
      if (number === current) entry.setAttribute('aria-current', 'step');
      item.append(entry);
      items.append(item);
    });
    return items;
  };
  const isLesson = location.pathname.endsWith('lesson.html');
  const isAssessment = params.get('lesson') === 'assessment';

  root.replaceChildren(link('All Skills', 'skills.html', 'breadcrumb'));
  document.title = `${skill.name} | Vypax Learning`;

  if (isAssessment) {
    root.append(element('h1', `${skill.name} knowledge check`));
    root.append(element('p', skill.question || 'Review the lessons and reflect on what you learned.'));
    if (skill.answer) {
      const answer = element('details');
      answer.append(element('summary', 'Show a suggested answer'), element('p', skill.answer));
      root.append(answer);
    }
    root.append(link('Back to learning path', overviewUrl, 'button'));
    return;
  }

  if (!isLesson) {
    const hero = element('div', undefined, 'learning-hero');
    hero.append(
      element('p', `${skill.category.toUpperCase()} / SELF-PACED LEARNING`, 'eyebrow'),
      element('h1', skill.name),
      element('p', skill.description, 'intro'),
      element('p', 'Lessons are available without an account. Progress is not saved on this static website.', 'fine')
    );
    root.append(hero);

    const layout = element('div', undefined, 'learning-layout');
    const curriculum = element('div');
    curriculum.append(element('h2', 'Lessons'), list());
    const aside = element('aside', undefined, 'learning-aside');
    aside.append(element('h3', 'Practice project'), element('p', skill.project));
    if (skill.exercise) aside.append(element('h3', 'Practice'), element('p', skill.exercise));
    layout.append(curriculum, aside);
    root.append(layout);
    return;
  }

  const requested = Number(params.get('lesson'));
  const chapter = Number.isInteger(requested) && requested >= 1 && requested <= lessons.length ? requested : 1;
  const lesson = lessons[chapter - 1];
  if (!lesson) {
    root.append(element('h1', 'No lessons are available yet.'), link('Back to all skills', 'skills.html', 'button'));
    return;
  }

  const layout = element('div', undefined, 'learning-layout lesson-layout');
  const sidebar = element('aside', undefined, 'lesson-sidebar');
  sidebar.append(link(skill.name, overviewUrl), element('h2', 'Lessons'), list(chapter));

  const article = element('article', undefined, 'lesson-content');
  article.append(element('p', `CHAPTER ${chapter} OF ${lessons.length}`, 'eyebrow'), element('h1', lesson.title));
  for (const paragraph of lesson.explanation.split('\n\n')) {
    article.append(element('p', paragraph, 'lesson-explanation'));
  }
  if (lesson.exercise) article.append(element('h2', 'Practice'), element('p', lesson.exercise));

  const actions = element('div', undefined, 'lesson-navigation');
  actions.append(link('Learning path', overviewUrl, 'button outline'));
  if (chapter > 1) actions.append(link('Previous lesson', lessonUrl(chapter - 1), 'button'));
  if (chapter < lessons.length) actions.append(link('Next lesson', lessonUrl(chapter + 1), 'button'));
  else actions.append(link('Knowledge check', lessonUrl('assessment'), 'button'));
  article.append(actions);
  layout.append(sidebar, article);
  root.append(layout);
})();
