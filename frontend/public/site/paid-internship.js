(async () => {
  const form = document.querySelector('#public-internship-form');
  if (!form) return;

  const { apiRequest } = await import('./api-client.js');
  const params = new URLSearchParams(location.search);
  const requestedDomain = params.get('domain');
  const domainSelect = form.querySelector('[name=domain]');
  if (requestedDomain && [...domainSelect.options].some(option => option.value === requestedDomain)) {
    domainSelect.value = requestedDomain;
  }
  const months = form.elements.months;
  if (['1','2','3','6'].includes(params.get('months'))) months.value = params.get('months');
  const status = form.querySelector('[role=status]');
  const button = form.querySelector('button[type=submit]');
  function signIn() {
    const next = 'internship-application.html?' + new URLSearchParams({ domain:domainSelect.value, months:months.value });
    location.href = 'account.html?next=' + encodeURIComponent(next);
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); event.stopImmediatePropagation();
    if (!form.reportValidity()) return;
    button.disabled = true; status.textContent = 'Saving your internship application…';
    try {
      const result = await apiRequest('portal/internship', { method:'POST', json:{ domain:domainSelect.value, months:Number(months.value) } });
      location.href = 'portal.html?payment=' + encodeURIComponent(result.id);
    } catch (error) {
      if (error.status === 401) { signIn(); return; }
      status.textContent = error.message; button.disabled = false;
    }
  }, true);
  try {
    const { user } = await apiRequest('auth/me');
    if (!user) { signIn(); return; }
    for (const name of ['name','email','phone']) { form.elements[name].value = user[name] || ''; form.elements[name].readOnly = true; }
  } catch (error) { status.textContent = error.message; }
})();
