(() => {
  const root = document.querySelector('#announcement-list');
  if (!root) return;

  const message = document.createElement('p');
  message.textContent = 'No announcements are currently available.';
  root.replaceChildren(message);
})();
