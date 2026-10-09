// Shared account navigation. Content authorization remains on the server.
(async()=>{
 const links=[...document.querySelectorAll('.account-nav')];
 try{const response=await fetch('https://vypax-lms-backend.onrender.com/api/auth/me',{credentials:'include'});if(!response.ok)throw Error(`Account check failed (${response.status}).`);const {user}=await response.json();if(user)links.forEach(a=>{a.textContent=user.role==='ADMIN'?'Admin Dashboard':'My Dashboard';a.href=user.role==='ADMIN'?'admin.html':'portal.html'})}catch(error){console.error('Unable to check account navigation state:',error)}
})();
