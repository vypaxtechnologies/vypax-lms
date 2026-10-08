/* Fixed, curated FAQ chatbot. No AI provider or network requests. */
(() => {
  const panel = document.querySelector('#assistant-panel');
  if (!panel) return;
  const launcher = document.querySelector('#assistant-launcher');
  const messages = document.querySelector('#assistant-messages');
  const input = document.querySelector('#assistant-input');
  const form = document.querySelector('#assistant-form');
  const questions = [
    ['What training programs are available?', programs.map(p => `${p[1]} — ${p[2]} months`).join('\n') + '\nExplore Programs for the curriculum and application details.'],
    ['What hackathons are available?', 'November 2026: remote App & Web Development, teams of 2–4, ₹99 per person. Registration closes 10 November 2026. Prize pool up to ₹1,00,000.\n\nPrahar: Open to students and professionals competing together. Registration: ₹0 — Free, teams of 1–2. Awards: 1st–3rd receive a trophy and certificate; 4th–5th receive a medal and certificate. Every participant receives a certificate of participation. Round details are coming soon; final: coming soon.\n\nMarch 2027: ₹99 per person; schedule and awards to be announced. Sign in through View Hackathon Details for schedules and submission forms.'],
    ['How do I apply for a program?', 'Open Programs, choose a course, and select Apply for This Program. Send your interest to discuss fees, batch availability and enrolment requirements. An enquiry does not confirm admission or payment.'],
    ['When does the next batch start?', 'Contact the team with your preferred program and timings to confirm the next batch and seat availability.'],
    ['How much does training cost?', 'Use the enquiry form on your selected program page to request current fees and payment terms.'],
    ['Will I receive a training certificate?', 'Certificates are provided after the agreed training completion requirements are met. Confirm attendance, assignment and project requirements before enrolling.'],
    ['How do I register for a hackathon?', 'Open Programs → Hackathons, choose an event and use its registration link when registration is available. For registration questions, use the hackathon enquiry form.'],
    ['Is Prahar free?', 'Yes. Prahar registration is ₹0 — Free. Students and professionals can compete in teams of 1–2.'],
    ['What are the Prahar awards?', '1st, 2nd and 3rd place: Trophy + Certificate. 4th and 5th place: Medal + Certificate. Every participant receives a Certificate of Participation.'],
    ['How do I contact training support?', 'Use the Training enquiry form with your course name and question.'],
    ['How do I contact hackathon support?', 'Use the enquiry form on the event page with your event name and question.'],
    ...programs.map(p => [`Tell me about ${p[1]}`, `${p[1]} lasts ${p[2]} months. ${p[3]}\n\nTopics: ${p[4].split('|').join(', ')}. View the program page to enquire.`]),
  ];
  let visitor = null, pendingQueries = [], sending = false;
  const contactForm=document.createElement('div');contactForm.className='chat-intro';
  contactForm.innerHTML='<p class="chat-bubble assistant">Welcome! What should we call you? <small>Name and mobile are optional. You can skip both.</small></p><label class="visually-hidden" for="chat-intro-reply">Your reply (optional)</label><input id="chat-intro-reply" type="text" autocomplete="name" maxlength="100" placeholder="Type your name, or skip"><div class="chat-intro-actions"><button type="button" id="chat-intro-next">Continue</button><button type="button" id="chat-intro-skip">Skip</button></div><p class="fine">When you close the chat, your selected questions and any details you choose to share are saved and sent to the relevant Vypax team.</p>';
  panel.querySelector('.assistant-notice').after(contactForm);
  const chatParts=[messages,form,panel.querySelector('.assistant-prompts'),panel.querySelector('.assistant-foot')];
  function intake(show){contactForm.hidden=!show;chatParts.forEach(part=>part.hidden=show)}
  intake(true);let introStep=0,introName='';const introReply=contactForm.querySelector('input'),introBubble=contactForm.querySelector('.chat-bubble');
  function advanceIntro(skip=false){
    if(introStep===0){introName=skip?'':introReply.value.trim();introStep=1;introBubble.textContent='Would you like to share a mobile number so our team can follow up? This is optional.';introReply.value='';introReply.type='tel';introReply.autocomplete='tel';introReply.maxLength=20;introReply.placeholder='Type your mobile number, or skip';introReply.focus();return;}
    const phone=skip?'':introReply.value.trim();if(phone&&!/^[+0-9 ()-]{7,20}$/.test(phone)){introBubble.textContent='Please enter a valid mobile number, or select Skip.';return;}
    visitor={name:introName,phone};intake(false);input.focus();
  }
  contactForm.querySelector('#chat-intro-next').onclick=()=>advanceIntro();contactForm.querySelector('#chat-intro-skip').onclick=()=>advanceIntro(true);
  introReply.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();advanceIntro()}});
  const delivery = document.createElement('div'); delivery.className = 'chat-delivery'; delivery.hidden = true; delivery.setAttribute('role', 'status');
  document.body.append(delivery);
  function deliveryMessage(message, retry = false) {
    delivery.replaceChildren(document.createTextNode(message)); delivery.hidden = false;
    if (retry) { const button = document.createElement('button'); button.textContent = 'Retry'; button.addEventListener('click', sendEnquiry); delivery.append(button); }
    const dismiss = document.createElement('button'); dismiss.textContent = 'Dismiss'; dismiss.addEventListener('click', () => delivery.hidden = true); delivery.append(dismiss);
  }
  async function sendEnquiry() {
    if (!visitor || !pendingQueries.length || sending) return;
    sending = true;
    deliveryMessage('Sending your enquiry…');
    try {
      for (const category of ['Training', 'Hackathon']) {
        const batch = pendingQueries.filter(item => item.category === category);
        if (!batch.length) continue;
        const email = category === 'Hackathon' ? 'vypaxtechlogies@gmail.com' : 'vypaxtechlogies@gmail.com';
        const response = await fetch('/api/enquiries', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...visitor, category, message: batch.map(item => item.question + '\n' + item.answer).join('\n\n'), consent: true, chat: true }),
          signal: AbortSignal.timeout(15000)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Delivery failed');
        pendingQueries = pendingQueries.filter(item => !batch.includes(item));
      }
      deliveryMessage('Your enquiry is saved for Vypax. An email notification is queued for the team.');
    } catch { deliveryMessage('We could not send your enquiry. Retry, or use Let’s Talk to contact Vypax.', true); }
    finally { sending = false; }
  }
  function bubble(text, role) {
    const node = document.createElement('p');
    node.className = 'chat-bubble ' + role;
    node.textContent = text;
    messages.append(node);
    messages.scrollTop = messages.scrollHeight;
  }
  function welcome() { bubble('Welcome to Vypax! Choose a training or hackathon question for a prepared answer. For more help with your course or event, select Talk to our team.', 'assistant'); }
  function close() { panel.hidden = true; launcher.setAttribute('aria-expanded', 'false'); launcher.focus(); sendEnquiry(); }
  launcher.addEventListener('click', () => {
    if (!panel.hidden) return close();
    panel.hidden = false; launcher.setAttribute('aria-expanded', 'true'); (visitor ? input : introReply).focus();
  });
  document.querySelector('#assistant-close').addEventListener('click', close);
  document.querySelector('#assistant-reset').addEventListener('click', () => { messages.replaceChildren(); input.value = ''; welcome(); });
  questions.forEach(([question], index) => input.add(new Option(question, String(index))));
  function answer(index) {
    const entry = questions[index];
    if (!entry || !visitor) return;
    if (!pendingQueries.some(item => item.question === entry[0])) pendingQueries.push({question:entry[0], answer:entry[1], category:/hackathon|prahar/i.test(entry[0]) ? 'Hackathon' : 'Training'});
    bubble(entry[0], 'user'); bubble(entry[1], 'assistant'); input.value = String(index);
    const hackathon = /hackathon|prahar/i.test(entry[0]);
    document.querySelector('#assistant-enquiry').href = hackathon ? 'hackathons.html#hackathon-enquiry' : 'contact.html?type=Training#enquiry';
  }
  form.addEventListener('submit', event => { event.preventDefault(); if (input.value !== '') answer(Number(input.value)); });
  const prompts = document.querySelector('.assistant-prompts');
  prompts.replaceChildren();
  [0, 1, 2, 4, 7, 8].forEach(index => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = questions[index][0];
    button.addEventListener('click', () => answer(index)); prompts.append(button);
  });
  document.querySelector('#assistant-enquiry').addEventListener('click', close);
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') return close();
    if (event.key !== 'Tab') return;
    const nodes = [...panel.querySelectorAll('button,input,select,a')].filter(node => !node.disabled && node.getClientRects().length);
    if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0].focus(); }
  });
  welcome();
})();
