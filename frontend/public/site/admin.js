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
    const { apiRequest, API_BASE_URL } = await import('./api-client.js');

    async function loadPayments() {
      const { payments } = await apiRequest('admin/payments');
      const list = document.querySelector('#payment-list');
      list.replaceChildren();
      const text = (parent, tag, value) => { const element = document.createElement(tag); element.textContent = value; parent.append(element); return element; };
      if (!payments.length) text(list, 'p', 'No payments have been submitted yet.');
      for (const payment of payments.sort((a,b) => Number(b.status === 'PENDING') - Number(a.status === 'PENDING'))) {
        const card = document.createElement('article'); card.className = 'portal-internship';
        text(card, 'h3', payment.name || payment.domain || payment.course || payment.event);
        text(card, 'p', `${payment.learner.name} (${payment.learner.email}) · ₹${payment.fee} · ${payment.status}`);
        if (payment.paymentProof) {
          text(card, 'p', 'Transaction reference: ' + payment.paymentProof.reference);
          if (payment.paymentProof.receiptUploadId) {
            const receipt = text(card, 'a', 'Download receipt');
            receipt.href = API_BASE_URL + '/admin/receipts/' + encodeURIComponent(payment.paymentProof.receiptUploadId);
            receipt.target = '_blank'; receipt.rel = 'noopener';
          }
        }
        if (payment.feedback) text(card, 'p', 'Review: ' + payment.feedback);
        if (payment.status === 'PENDING') {
          const label = text(card, 'label', 'Review note (required for rejection)');
          const note = document.createElement('textarea'); note.maxLength = 1000; label.append(note);
          for (const [decision, title] of [['VERIFIED','Approve payment'],['REJECTED','Reject payment']]) {
            const button = text(card, 'button', title); button.type = 'button'; button.className = 'button outline';
            button.onclick = async () => {
              if (decision === 'REJECTED' && !note.value.trim()) { status.textContent = 'Give a reason so the learner can correct the payment proof.'; note.focus(); return; }
              const buttons = [...card.querySelectorAll('button')]; buttons.forEach(item => item.disabled = true);
              try {
                const result = await apiRequest('admin/payments/review', { method:'POST', json:{ userId:payment.userId, id:payment.id, decision, feedback:note.value.trim() } });
                status.textContent = result.message; await loadPayments();
              } catch (error) { status.textContent = error.message; buttons.forEach(item => item.disabled = false); }
            };
          }
        }
        list.append(card);
      }
    }
    document.querySelector('#refresh-payments').onclick = () => loadPayments().catch(error => { status.textContent = error.message; });

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
        await loadPayments();
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
