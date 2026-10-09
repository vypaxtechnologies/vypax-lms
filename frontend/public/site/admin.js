(() => {
  const welcome = document.querySelector('#admin-welcome');
  const status = document.querySelector('#admin-status');
  const content = document.querySelector('#admin-content');
  const logout = document.querySelector('#admin-logout');
  const learnersBody = document.querySelector('#learner-list');

  const cell = (row, value) => {
    const item = document.createElement('td');
    item.textContent = value;
    row.append(item);
  };

  async function start() {
    const { apiRequest } = await import('./api-client.js');

    async function loadDashboard() {
      try {
        const result = await apiRequest('admin/overview');
        welcome.textContent = `Welcome, ${result.admin.name}.`;
        document.querySelector('#learner-count').textContent = result.totalLearners;
        document.querySelector('#position-count').textContent = result.openPositions;
        for (const learner of result.learners) {
          const row = document.createElement('tr');
          cell(row, learner.name || '—');
          cell(row, learner.email);
          cell(row, learner.createdAt ? new Date(learner.createdAt).toLocaleDateString() : '—');
          learnersBody.append(row);
        }
        document.querySelector('#empty-learners').hidden = result.learners.length > 0;
        content.hidden = false;
      } catch (error) {
        if (error.status === 401 && error.isJson) {
          location.replace('account.html?next=admin.html');
          return;
        }
        status.textContent = error.message || 'Unable to load the admin dashboard.';
        welcome.textContent = 'Your dashboard could not be loaded.';
      }
    }

    logout.addEventListener('click', async () => {
      logout.disabled = true;
      status.textContent = 'Signing out…';
      try {
        await apiRequest('auth/logout', { method: 'POST', json: {} });
        location.replace('account.html');
      } catch (error) {
        status.textContent = error.message;
        logout.disabled = false;
      }
    });

    loadDashboard();
  }

  start().catch(error => {
    status.textContent = error.message || 'Unable to load the admin dashboard.';
    welcome.textContent = 'Your dashboard could not be loaded.';
  });
})();
