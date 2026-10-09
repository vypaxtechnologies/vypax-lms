(() => {
  const form = document.querySelector('#public-internship-form');
  if (!form) return;

  const requestedDomain = new URLSearchParams(location.search).get('domain');
  const domainSelect = form.querySelector('[name=domain]');
  if (requestedDomain && [...domainSelect.options].some(option => option.value === requestedDomain)) {
    domainSelect.value = requestedDomain;
  }
})();
