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
  const quizUrl = number => lessonUrl(`practice-${number}`);
  const assessmentUrl = lessonUrl('assessment');
  const certificateUrl = lessonUrl('certificate');
  const quizMilestones = [];
  for (let number = 3; number < lessons.length; number += 3) quizMilestones.push(number);
  if (lessons.length && quizMilestones.at(-1) !== lessons.length) quizMilestones.push(lessons.length);
  const progressKey = `vypax-learning-progress:v1:${skill.slug}`;
  const certificateKey = `vypax-learning-certificate:v1:${skill.slug}`;
  const blankProgress = () => ({ completedModules: [], passedQuizzes: [], attempts: {}, scores: {} });
  let progress;

  function reportProgressError(error) {
    root.replaceChildren(
      element('h1', 'Learning progress unavailable'),
      element('p', error.message || 'Progress could not be saved in this browser.'),
      link('Return to learning path', overviewUrl, 'button')
    );
  }

  function readProgress() {
    let saved;
    try {
      const stored = localStorage.getItem(progressKey);
      saved = stored ? JSON.parse(stored) : blankProgress();
    } catch (error) {
      throw new Error(`Learning progress could not be read from this browser: ${error.message}`);
    }
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
      throw new Error('Saved learning progress has an invalid format. Clear this skill’s browser progress to start again.');
    }
    return {
      completedModules: [...new Set((Array.isArray(saved.completedModules) ? saved.completedModules : [])
        .filter(number => Number.isInteger(number) && number >= 1 && number <= lessons.length))],
      passedQuizzes: [...new Set((Array.isArray(saved.passedQuizzes) ? saved.passedQuizzes : [])
        .filter(number => quizMilestones.includes(number)))],
      attempts: saved.attempts && typeof saved.attempts === 'object' && !Array.isArray(saved.attempts)
        ? Object.fromEntries(Object.entries(saved.attempts).filter(([milestone, count]) =>
          quizMilestones.includes(Number(milestone)) && Number.isInteger(count) && count >= 0))
        : {},
      scores: saved.scores && typeof saved.scores === 'object' && !Array.isArray(saved.scores)
        ? Object.fromEntries(Object.entries(saved.scores).filter(([milestone, record]) =>
          quizMilestones.includes(Number(milestone)) &&
          record && Number.isInteger(record.score) && record.score >= 0 &&
          Number.isInteger(record.total) && record.total > 0 &&
          Number.isFinite(record.percentage) && typeof record.passed === 'boolean'))
        : {}
    };
  }

  function commitProgress(update) {
    const next = {
      completedModules: [...progress.completedModules],
      passedQuizzes: [...progress.passedQuizzes],
      attempts: { ...progress.attempts },
      scores: { ...progress.scores }
    };
    update(next);
    try {
      localStorage.setItem(progressKey, JSON.stringify(next));
      progress = next;
      return true;
    } catch (error) {
      showStatus(`Progress could not be saved in this browser: ${error.message}`);
      return false;
    }
  }

  function showStatus(message) {
    let status = root.querySelector('[role="status"]');
    if (!status) {
      status = element('p', undefined, 'learning-status');
      status.setAttribute('role', 'status');
      root.append(status);
    }
    status.textContent = message;
  }

  function isModuleComplete(number) {
    return progress.completedModules.includes(number);
  }

  function isCourseComplete() {
    return lessons.length > 0 &&
      lessons.every((_, index) => isModuleComplete(index + 1)) &&
      quizMilestones.every(milestone => progress.passedQuizzes.includes(milestone));
  }

  function precedingMilestone(number) {
    return quizMilestones.filter(milestone => milestone < number).at(-1);
  }

  function isModuleUnlocked(number) {
    const previous = precedingMilestone(number);
    return !previous || progress.passedQuizzes.includes(previous);
  }

  function quizRange(milestone) {
    const previous = precedingMilestone(milestone);
    return { first: previous ? previous + 1 : 1, last: milestone };
  }

  function moduleRangeLabel(range) {
    return range.first === range.last
      ? `Module ${range.first}`
      : `Modules ${range.first}–${range.last}`;
  }

  function isQuizUnlocked(milestone) {
    const { first, last } = quizRange(milestone);
    return isModuleUnlocked(first) &&
      Array.from({ length: last - first + 1 }, (_, index) => first + index).every(isModuleComplete);
  }

  function quizFor(milestone) {
    const { first, last } = quizRange(milestone);
    const factsForLesson = (lesson, module) => {
      const paragraphs = String(lesson.explanation || '').split(/\n\s*\n/).slice(0, 2);
      return paragraphs.flatMap(paragraph => {
        const statements = paragraph.match(/[^.!?]+[.!?]?(?=\s|$)/g) || [paragraph];
        return statements.map(statement => ({
          module,
          title: lesson.title,
          statement: statement.trim()
        })).filter(fact => fact.statement.length >= 20);
      });
    };
    const allFacts = lessons.flatMap((lesson, index) => factsForLesson(lesson, index + 1));
    const facts = allFacts.filter(fact => fact.module >= first && fact.module <= last);
    const uniqueFacts = [...new Map(facts.map(fact => [fact.statement, fact])).values()];
    const questions = [];

    for (const fact of uniqueFacts) {
      if (questions.length === 5) break;
      const targetStatements = new Set(allFacts
        .filter(candidate => candidate.module === fact.module)
        .map(candidate => candidate.statement));
      const distractors = [...new Map(allFacts
        .filter(candidate => candidate.module !== fact.module && !targetStatements.has(candidate.statement))
        .map(candidate => [candidate.statement, candidate])).values()];
      if (distractors.length < 3) continue;
      const options = distractors.slice(0, 3).map(candidate => candidate.statement);
      const correctIndex = questions.length % 4;
      options.splice(correctIndex, 0, fact.statement);
      questions.push({
        module: fact.module,
        title: fact.title,
        prompt: `Which statement appears in Module ${fact.module}, “${fact.title}”?`,
        options: options.map((text, index) => ({ id: String.fromCharCode(65 + index), text })),
        correctOptionId: String.fromCharCode(65 + correctIndex),
        explanation: `Module ${fact.module}, “${fact.title},” teaches: ${fact.statement}`
      });
    }

    return questions;
  }

  function renderModuleItem(number, current) {
    const item = element('li');
    const unlocked = isModuleUnlocked(number);
    const completed = isModuleComplete(number);
    item.className = `learning-item${completed ? ' is-complete' : ''}${!unlocked ? ' is-locked' : ''}`;
    if (unlocked) {
      const entry = link(`${completed ? '✓ ' : ''}${number}. ${lessons[number - 1].title}`, lessonUrl(number));
      if (number === current) entry.setAttribute('aria-current', 'step');
      item.append(entry);
    } else {
      const milestone = precedingMilestone(number);
      item.append(
        element('span', `🔒 ${number}. ${lessons[number - 1].title}`, 'locked-label'),
        element('span', `Locked — pass the Module ${milestone} Practice Test to unlock.`, 'locked-explanation')
      );
    }
    return item;
  }

  function renderQuizItem(milestone) {
    const item = element('li');
    const range = quizRange(milestone);
    const passed = progress.passedQuizzes.includes(milestone);
    const unlocked = isQuizUnlocked(milestone);
    item.className = `learning-item learning-quiz-item${passed ? ' is-complete' : ''}${!unlocked && !passed ? ' is-locked' : ''}`;
    if (passed) {
      item.append(link(`✓ Module ${milestone} Practice Test — Passed`, quizUrl(milestone)));
      const lastScore = progress.scores[milestone];
      if (lastScore) item.append(element('span', `Passed · ${lastScore.score}/${lastScore.total} (${lastScore.percentage}%) · ${progress.attempts[milestone] || 0} attempts`, 'quiz-entry-note'));
    } else if (unlocked) {
      item.append(link(`Module ${milestone} Practice Test`, quizUrl(milestone), 'quiz-entry'));
      const lastScore = progress.scores[milestone];
      if (lastScore) item.append(element('span', 'Not passed — retry available', 'quiz-state-badge is-failed'));
      item.append(element(
        'span',
        lastScore
          ? `Last attempt: ${lastScore.score}/${lastScore.total} (${lastScore.percentage}%) · ${progress.attempts[milestone] || 0} attempts · 80% required`
          : `${moduleRangeLabel(range)} complete · 80% required to pass`,
        'quiz-entry-note'
      ));
    } else {
      item.append(
        element('span', `🔒 Module ${milestone} Practice Test`, 'locked-label'),
        element('span', `Complete ${moduleRangeLabel(range)} to start this quiz.`, 'locked-explanation')
      );
    }
    return item;
  }

  function renderLearningList(current) {
    const items = element('ol', undefined, 'lesson-list');
    lessons.forEach((_, index) => {
      const number = index + 1;
      items.append(renderModuleItem(number, current));
      if (quizMilestones.includes(number)) items.append(renderQuizItem(number));
    });
    return items;
  }

  function renderOverview() {
    root.replaceChildren(link('All Skills', 'skills.html', 'breadcrumb'));
    document.title = `${skill.name} | Vypax Learning`;
    const hero = element('div', undefined, 'learning-hero');
    hero.append(
      element('p', `${skill.category.toUpperCase()} / SELF-PACED LEARNING`, 'eyebrow'),
      element('h1', skill.name),
      element('p', skill.description, 'intro'),
      element('p', 'Progress is saved in this browser only. It is not linked to an account and can be cleared or changed on this device.', 'fine')
    );
    if (isCourseComplete()) {
      hero.append(
        element('h2', 'Congratulations — course completed!'),
        link('Generate Your Certificate', certificateUrl, 'button')
      );
    }
    root.append(hero);
    const layout = element('div', undefined, 'learning-layout');
    const curriculum = element('div');
    curriculum.append(element('h2', 'Lessons and practice tests'), renderLearningList());
    const aside = element('aside', undefined, 'learning-aside');
    aside.append(element('h3', 'Practice project'), element('p', skill.project));
    if (skill.exercise) aside.append(element('h3', 'Practice'), element('p', skill.exercise));
    layout.append(curriculum, aside);
    root.append(layout);
  }

  function renderLockedModule(chapter) {
    const milestone = precedingMilestone(chapter);
    root.replaceChildren(
      element('h1', `🔒 Module ${chapter} is locked`),
      element('p', `Pass the Module ${milestone} Practice Test with at least 80% to unlock this module. Your progress is saved in this browser only.`),
      link('Return to course', overviewUrl, 'button')
    );
    if (isQuizUnlocked(milestone)) root.append(link(`Take Module ${milestone} Practice Test`, quizUrl(milestone), 'button'));
  }

  function renderAssessment() {
    root.replaceChildren(
      link('All Skills', 'skills.html', 'breadcrumb'),
      element('h1', `${skill.name} knowledge check`),
      element('p', skill.question || 'Review the lessons and reflect on what you learned.')
    );
    if (skill.answer) {
      const answer = element('details');
      answer.append(element('summary', 'Show a suggested answer'), element('p', skill.answer));
      root.append(answer);
    }
    if (isCourseComplete()) {
      root.append(
        element('h2', 'Congratulations — course completed!'),
        link('Generate Your Certificate', certificateUrl, 'button')
      );
    }
    root.append(link('Back to learning path', overviewUrl, 'button'));
  }

  function createCertificateId() {
    const random = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
    return `VXP-${new Date().getFullYear()}-${random.toUpperCase()}`;
  }

  function readCertificate() {
    let stored;
    try {
      const value = localStorage.getItem(certificateKey);
      stored = value ? JSON.parse(value) : null;
    } catch (error) {
      throw new Error(`Certificate details could not be read from this browser: ${error.message}`);
    }
    if (stored === null) return null;
    if (!stored || stored.skill !== skill.slug || typeof stored.name !== 'string' ||
      typeof stored.issueDate !== 'string' || typeof stored.id !== 'string') {
      throw new Error('Saved certificate details have an invalid format. Clear this skill’s certificate data to continue.');
    }
    return stored;
  }

  function renderCertificate() {
    root.parentElement?.classList.add('certificate-learning-page');
    root.replaceChildren(link('Back to learning path', overviewUrl, 'breadcrumb'));
    document.title = `Course Completion Certificate | ${skill.name}`;
    if (!isCourseComplete()) {
      root.append(
        element('h1', 'Certificate not available yet'),
        element('p', 'Complete every course module and pass every required practice test with at least 80% before generating a certificate. Progress is saved in this browser only.'),
        link('Return to course', overviewUrl, 'button')
      );
      return;
    }

    let savedCertificate;
    try {
      savedCertificate = readCertificate();
    } catch (error) {
      root.append(element('p', error.message, 'learning-status'));
      return;
    }

    const heading = element('h1', 'Congratulations — course completed!');
    const description = element('p', `You completed every module and passed every required practice test in ${skill.name}. Enter your name to preview and download your certificate.`);
    const action = element('button', 'Generate Your Certificate', 'button');
    action.type = 'button';
    root.append(
      heading,
      description,
      element('p', 'Certificate eligibility and saved details use browser-local progress; they are not independently verified by a server.', 'fine'),
      action
    );

    action.addEventListener('click', () => {
      const form = element('form', undefined, 'certificate-form');
      const label = element('label', 'Full name');
      const input = element('input');
      input.type = 'text';
      input.name = 'certificate-name';
      input.autocomplete = 'name';
      input.maxLength = 120;
      input.required = true;
      input.value = savedCertificate?.name || '';
      label.append(input);

      const validation = element('p', undefined, 'certificate-status');
      validation.setAttribute('role', 'status');
      const preview = element('section', undefined, 'certificate-preview');
      preview.setAttribute('aria-label', 'Certificate preview');
      const previewHeader = element('div', undefined, 'certificate-header');
      const brand = element('div', undefined, 'certificate-brand-lockup');
      const logo = element('img');
      logo.src = 'logo.svg';
      logo.alt = '';
      const brandCopy = element('div', undefined, 'certificate-brand-copy');
      brandCopy.append(
        element('strong', 'VYPAX'),
        element('span', 'TECHNOLOGIES'),
        element('small', 'Build beyond limit')
      );
      brand.append(logo, brandCopy);
      const previewId = element('p', undefined, 'certificate-number');
      previewHeader.append(brand, previewId);

      const watermark = element('img', undefined, 'certificate-watermark');
      watermark.src = 'logo.svg';
      watermark.alt = '';
      watermark.setAttribute('aria-hidden', 'true');
      const main = element('div', undefined, 'certificate-main');
      const previewTitle = element('h2', 'SKILL COMPLETION CERTIFICATE');
      const previewRecipient = element('p', 'THIS IS TO CERTIFY THAT', 'certificate-caption');
      const previewName = element('p', '', 'certificate-recipient');
      const completionLead = element('p', 'has successfully completed the skill course in', 'certificate-course');
      const previewCourse = element('h3', skill.name, 'certificate-skill');
      const completionAt = element('p', 'at Vypax Technologies.', 'certificate-course');
      const appreciation = element('p', 'We appreciate your dedication and wish you continued growth and success.', 'certificate-appreciation');
      main.append(previewTitle, previewRecipient, previewName, completionLead, previewCourse, completionAt, appreciation);

      const certificateFooter = element('div', undefined, 'certificate-footer');
      const values = element('div', undefined, 'certificate-values');
      [['</>', 'Web', 'Development'], ['◇', 'Digital', 'Solutions'], ['↗', 'Business', 'Growth'], ['◎', 'Technology', '& Innovation']]
        .forEach(([symbol, first, second]) => {
          const item = element('div', undefined, 'certificate-value');
          item.append(element('strong', symbol), element('span', first), element('span', second));
          values.append(item);
        });
      const signature = element('div', undefined, 'certificate-signature');
      signature.append(
        element('span', undefined, 'certificate-signature-line'),
        element('strong', 'VYPAX TECHNOLOGIES'),
        element('span', 'Authorized Representative')
      );
      const previewDate = element('p', '', 'certificate-meta');
      signature.append(previewDate);

      const seal = element('div', undefined, 'certificate-seal');
      const sealLogo = element('img');
      sealLogo.src = 'logo.svg';
      sealLogo.alt = '';
      seal.append(element('span', 'VYPAX TECHNOLOGIES'), sealLogo, element('small', 'BUILD BEYOND LIMIT'));
      certificateFooter.append(values, signature, seal);
      const disclaimer = element('p', 'Browser-generated certificate; course progress is not independently verified by a server.', 'certificate-disclaimer');
      preview.append(previewHeader, watermark, main, certificateFooter, disclaimer);

      const download = element('button', 'Generate & Download Certificate', 'button');
      download.type = 'submit';
      const back = element('button', 'Edit Name', 'button outline');
      back.type = 'button';
      back.addEventListener('click', () => {
        form.remove();
        action.hidden = false;
      });
      form.append(label, validation, preview, download, back);
      action.hidden = true;
      root.append(form);

      let currentCertificate;
      function updatePreview() {
        const name = input.value.trim().replace(/\s+/g, ' ');
        previewName.textContent = name || 'Your name will appear here';
        if (name) {
          currentCertificate = savedCertificate?.name === name
            ? savedCertificate
            : currentCertificate?.name === name
              ? currentCertificate
            : {
              skill: skill.slug,
              name,
              issueDate: new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(new Date()),
              id: createCertificateId()
            };
        } else {
          currentCertificate = null;
        }
        previewDate.textContent = `Issue date: ${currentCertificate?.issueDate || 'Set when generated'}`;
        previewId.textContent = `CERTIFICATE NO. ${currentCertificate?.id.replace(/^VXP-(\d{4})-(.+)$/, 'VXP/$1/$2') || 'SET WHEN GENERATED'}`;
        previewDate.textContent = `Issued: ${currentCertificate?.issueDate || 'Set when generated'}`;
      }

      input.addEventListener('input', updatePreview);
      updatePreview();
      input.focus();

      form.addEventListener('submit', async event => {
        event.preventDefault();
        const name = input.value.trim().replace(/\s+/g, ' ');
        if (!name || /[\u0000-\u001f\u007f]/.test(name)) {
          validation.textContent = 'Enter a valid full name without control characters.';
          input.setAttribute('aria-invalid', 'true');
          return;
        }
        input.removeAttribute('aria-invalid');
        updatePreview();
        if (!currentCertificate) return;

        download.disabled = true;
        validation.textContent = 'Preparing your PDF…';
        try {
          const { createCertificatePdf } = await import('./learning-pdf.js');
          const blob = await createCertificatePdf({ ...currentCertificate, course: skill.name });
          localStorage.setItem(certificateKey, JSON.stringify(currentCertificate));
          savedCertificate = currentCertificate;
          const safeName = name.normalize('NFC')
            .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
            .replace(/[^\p{L}\p{M}\p{N}_.-]+/gu, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 80) || 'Student';
          const safeCourse = skill.slug.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60) || 'Course';
          const objectUrl = URL.createObjectURL(blob);
          const anchor = element('a');
          anchor.href = objectUrl;
          anchor.download = `Vypax_Certificate_${safeCourse}_${safeName}.pdf`;
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
          validation.textContent = 'Your certificate PDF was generated and the download has started. Certificate details are stored only in this browser and are not independently verified by a server.';
        } catch (error) {
          validation.textContent = `The certificate could not be generated or saved: ${error.message}`;
        } finally {
          download.disabled = false;
        }
      });
    });
  }

  function renderQuiz(milestone) {
    const range = quizRange(milestone);
    const title = `Module ${milestone} Practice Test`;
    const questions = quizFor(milestone);
    root.replaceChildren(link('Back to learning path', overviewUrl, 'breadcrumb'), element('h1', title));

    if (!isQuizUnlocked(milestone)) {
      root.append(
        element('p', `Complete ${moduleRangeLabel(range)} before starting this practice test.`),
        link('Return to course', overviewUrl, 'button')
      );
      return;
    }
    if (questions.length < 5) {
      root.append(
        element('p', 'This practice test is unavailable because the course does not contain enough distinct lesson material.'),
        link('Return to course', overviewUrl, 'button')
      );
      return;
    }

    document.title = `${title} | ${skill.name}`;
    let questionIndex = 0;
    let score = 0;
    let answered = false;
    let attemptStarted = false;
    const panel = element('section', undefined, 'practice-quiz');
    const status = element('p', undefined, 'quiz-progress');
    const questionTitle = element('h2');
    const choices = element('fieldset', undefined, 'quiz-choices');
    const feedback = element('p', undefined, 'quiz-feedback');
    feedback.setAttribute('role', 'status');
    const action = element('button', 'Check Answer', 'button');
    action.type = 'button';
    panel.append(status, questionTitle, choices, feedback, action);
    root.append(panel);

    function showQuestion() {
      answered = false;
      feedback.textContent = '';
      feedback.className = 'quiz-feedback';
      status.textContent = `Question ${questionIndex + 1} of ${questions.length}`;
      questionTitle.textContent = questions[questionIndex].prompt;
      choices.replaceChildren(element('legend', 'Select one answer'));
      questions[questionIndex].options.forEach(option => {
        const label = element('label', undefined, 'quiz-option');
        const input = element('input');
        input.type = 'radio';
        input.name = 'quiz-answer';
        input.value = option.id;
        label.append(input, element('span', `${option.id}. ${option.text}`));
        choices.append(label);
      });
      action.textContent = 'Check Answer';
    }

    function renderResult(passed) {
      const percentage = Math.round(score / questions.length * 100);
      panel.replaceChildren(
        element('p', passed ? 'QUIZ PASSED' : 'QUIZ NOT PASSED', `quiz-result-badge${passed ? ' is-passed' : ' is-failed'}`),
        element('h2', `${title} result`),
        element('p', `Your score: ${score} of ${questions.length} (${percentage}%). ${passed ? 'You passed with the required 80%.' : 'You need at least 80% to pass.'}`)
      );
      if (passed) {
        if (milestone === lessons.length) {
          panel.append(link('Generate Your Certificate', certificateUrl, 'button'));
        }
        panel.append(link(
          milestone < lessons.length ? `Continue to Module ${milestone + 1}` : 'Continue to knowledge check',
          milestone < lessons.length ? lessonUrl(milestone + 1) : assessmentUrl,
          'button'
        ));
      } else {
        const retry = element('button', 'Retry Quiz', 'button');
        retry.type = 'button';
        retry.addEventListener('click', renderQuiz.bind(null, milestone));
        panel.append(retry);
      }
      panel.append(link('Return to course', overviewUrl, 'button outline'));
    }

    action.addEventListener('click', () => {
      if (!answered) {
        const selected = choices.querySelector('input:checked');
        if (!selected) {
          feedback.textContent = 'Choose an answer before continuing.';
          feedback.className = 'quiz-feedback is-error';
          return;
        }
        if (!attemptStarted) {
          const saved = commitProgress(next => {
            next.attempts[milestone] = (Number(next.attempts[milestone]) || 0) + 1;
          });
          if (!saved) return;
          attemptStarted = true;
        }
        answered = true;
        const question = questions[questionIndex];
        const isCorrect = selected.value === question.correctOptionId;
        if (isCorrect) score += 1;
        feedback.textContent = `${isCorrect ? 'Correct.' : 'Not quite.'} ${question.explanation}`;
        feedback.className = `quiz-feedback${isCorrect ? ' is-correct' : ' is-error'}`;
        action.textContent = questionIndex === questions.length - 1 ? 'See Results' : 'Next Question';
        return;
      }

      if (questionIndex < questions.length - 1) {
        questionIndex += 1;
        showQuestion();
        return;
      }

      const passed = score / questions.length >= 0.8;
      const percentage = Math.round(score / questions.length * 100);
      const saved = commitProgress(next => {
        next.scores[milestone] = { score, total: questions.length, percentage, passed };
        if (passed && !next.passedQuizzes.includes(milestone)) next.passedQuizzes.push(milestone);
      });
      if (!saved) return;
      renderResult(passed);
    });
    showQuestion();
  }

  function renderModule(chapter) {
    if (!isModuleUnlocked(chapter)) {
      root.replaceChildren(link('All Skills', 'skills.html', 'breadcrumb'));
      renderLockedModule(chapter);
      return;
    }

    const lesson = lessons[chapter - 1];
    if (!lesson) {
      root.append(element('h1', 'No lessons are available yet.'), link('Back to all skills', 'skills.html', 'button'));
      return;
    }

    root.replaceChildren(link('All Skills', 'skills.html', 'breadcrumb'));
    document.title = `${skill.name} | Vypax Learning`;
    const layout = element('div', undefined, 'learning-layout lesson-layout');
    const sidebar = element('aside', undefined, 'lesson-sidebar');
    sidebar.append(link(skill.name, overviewUrl), element('h2', 'Lessons and practice tests'), renderLearningList(chapter));

    const article = element('article', undefined, 'lesson-content');
    article.append(element('p', `MODULE ${chapter} OF ${lessons.length}`, 'eyebrow'), element('h1', lesson.title));
    for (const paragraph of lesson.explanation.split('\n\n')) {
      article.append(element('p', paragraph, 'lesson-explanation'));
    }
    if (lesson.exercise) article.append(element('h2', 'Practice'), element('p', lesson.exercise));

    const moduleStatus = element('p', isModuleComplete(chapter) ? '✓ Module completed' : 'Mark this module complete when you have finished the lesson.', 'module-completion-status');
    moduleStatus.setAttribute('role', 'status');
    if (isModuleComplete(chapter)) {
      article.append(moduleStatus);
    } else {
      const complete = element('button', 'Mark Module Complete', 'button');
      complete.type = 'button';
      complete.addEventListener('click', () => {
        if (commitProgress(next => next.completedModules.push(chapter))) renderModule(chapter);
      });
      article.append(complete, moduleStatus);
    }

    const actions = element('div', undefined, 'lesson-navigation');
    actions.append(link('Learning path', overviewUrl, 'button outline'));
    if (chapter > 1 && isModuleUnlocked(chapter - 1)) actions.append(link('Previous module', lessonUrl(chapter - 1), 'button outline'));
    if (chapter < lessons.length) {
      if (isModuleUnlocked(chapter + 1)) {
        actions.append(link('Next module', lessonUrl(chapter + 1), 'button'));
      } else {
        const milestone = precedingMilestone(chapter + 1);
        if (!quizMilestones.includes(chapter) && isQuizUnlocked(milestone)) {
          actions.append(link(`Take Module ${milestone} Practice Test`, quizUrl(milestone), 'button'));
        } else if (!quizMilestones.includes(chapter)) {
          actions.append(element('span', `Complete ${moduleRangeLabel(quizRange(milestone))}, then pass the practice test to unlock the next module.`, 'locked-explanation'));
        }
      }
    } else {
      actions.append(link('Knowledge check', assessmentUrl, 'button'));
    }
    if (quizMilestones.includes(chapter) && isQuizUnlocked(chapter)) {
      actions.append(link(`Take Module ${chapter} Practice Test`, quizUrl(chapter), 'button'));
    } else if (quizMilestones.includes(chapter)) {
      actions.append(element('span', `Complete ${moduleRangeLabel(quizRange(chapter))} to unlock the practice test.`, 'locked-explanation'));
    }
    article.append(actions);
    layout.append(sidebar, article);
    root.append(layout);
  }

  try {
    progress = readProgress();
  } catch (error) {
    reportProgressError(error);
    return;
  }

  const isAssessment = params.get('lesson') === 'assessment';
  const isCertificate = params.get('lesson') === 'certificate';
  const quizMatch = /^practice-(\d+)$/.exec(params.get('lesson') || '');
  const isLesson = location.pathname.endsWith('lesson.html') || location.pathname.endsWith('/lesson');

  if (isCertificate) {
    renderCertificate();
  } else if (isAssessment) {
    renderAssessment();
  } else if (quizMatch) {
    const milestone = Number(quizMatch[1]);
    if (quizMilestones.includes(milestone)) renderQuiz(milestone);
    else {
      root.replaceChildren(
        element('h1', 'Practice test not found'),
        link('Return to course', overviewUrl, 'button')
      );
    }
  } else if (isLesson) {
    const requested = Number(params.get('lesson'));
    const chapter = Number.isInteger(requested) && requested >= 1 && requested <= lessons.length ? requested : 1;
    renderModule(chapter);
  } else {
    renderOverview();
  }
})();
