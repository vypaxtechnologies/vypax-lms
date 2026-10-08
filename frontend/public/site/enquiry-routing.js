/* Keep recipient selection in one place for static and dynamically added forms. */
(() => {
  const selector = 'form[action^="https://formsubmit.co/"]';
  function update(form) {
    const category = (form.dataset.enquiryCategory || form.querySelector('[name="enquiry_type"]')?.value || '').toLowerCase();
    const email = category.includes('hackathon') ? 'vypaxtechlogies@gmail.com'
      : category.includes('internship') ? 'vypaxtechlogies@gmail.com'
      : category.includes('service') ? 'vypaxtechlogies@gmail.com' : 'vypaxtechlogies@gmail.com';
    form.action = 'https://formsubmit.co/' + email;
    let note = form.querySelector('.enquiry-recipient');
    if (!note) {
      note = document.createElement('p');
      note.className = 'fine enquiry-recipient';
      note.setAttribute('role', 'status');
      form.append(note);
    }
    note.textContent = 'Your submission is saved for the Vypax team.';
  }
  const updateAll = () => document.querySelectorAll(selector).forEach(update);
  updateAll();
  document.addEventListener('change', event => {
    const form = event.target.closest(selector);
    if (form) update(form);
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-interest]')) queueMicrotask(updateAll);
  });
  document.addEventListener('submit', event => {
    if (!event.target.matches(selector)) return;
    update(event.target);
    if (location.protocol === 'file:') {
      event.preventDefault();
      event.target.querySelector('.enquiry-recipient').textContent = 'Open Launch Website.cmd before submitting, or email the team directly.';
    }
  }, true);
})();
