// Shared account navigation. Content authorization remains on the server.
(async()=>{
 const links=[...document.querySelectorAll('.account-nav')];
 if(!links.length||/(?:^|\/)portal(?:\.html)?\/?$/.test(location.pathname))return;
 try{const {apiRequest}=await import('./api-client.js');const {user}=await apiRequest('auth/me');if(user)links.forEach(a=>{a.textContent=user.role==='ADMIN'?'Admin Dashboard':'My Dashboard';a.href=user.role==='ADMIN'?'admin.html':'portal.html'})}catch(error){console.error('Unable to check account navigation state:',error)}
})();
