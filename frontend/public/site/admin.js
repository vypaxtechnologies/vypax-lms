(() => {
  const API_BASE = 'https://vypax-lms-backend.onrender.com/api';
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

  async function loadDashboard() {
    try {
      const response = await fetch(`${API_BASE}/admin/overview`, { credentials: 'include' });
      const result = await response.json();
      if (response.status === 401) {
        location.replace('account.html?next=admin.html');
        return;
      }
      if (!response.ok) throw Error(result.error || 'Unable to load the admin dashboard.');

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
      status.textContent = error.message || 'Unable to load the admin dashboard.';
      welcome.textContent = 'Your dashboard could not be loaded.';
    }
  }

  logout.addEventListener('click', async () => {
    logout.disabled = true;
    status.textContent = 'Signing out…';
    try {
      const response = await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw Error('Sign out failed. Please try again.');
      location.replace('account.html');
    } catch (error) {
      status.textContent = error.message;
      logout.disabled = false;
    }
  });

  loadDashboard();
})();
