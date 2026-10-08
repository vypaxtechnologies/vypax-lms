// Shared account navigation. Content authorization remains on the server.
(async()=>{
 const links=[...document.querySelectorAll('.account-nav')];
 try{const response=await fetch('/api/auth/me',{credentials:'same-origin'});if(!response.ok)return;const {user}=await response.json();if(user)links.forEach(a=>{a.textContent='My Dashboard';a.href='portal.html'})}catch{}
})();
