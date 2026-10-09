(async()=>{
 const root=document.querySelector('#portal-root'),params=new URLSearchParams(location.search);
 const mode=['login','signup','forgot','reset'].includes(params.get('mode'))?params.get('mode'):'login';
 const next=params.get('next');const target=next&&/^(admin|portal|skill|lesson)\.html(?:\?|$)/.test(next)?next:'portal.html';
 root.innerHTML='<div class="account-box"><p class="eyebrow">VYPAX ACCOUNT</p><h1></h1><p class="account-intro"></p><form id="account-form"></form><p id="account-status" role="status"></p><div class="actions" id="account-links"></div></div>';
 const title={login:'Welcome back',signup:'Create your account',forgot:'Reset your password',reset:'Choose a new password'};
 root.querySelector('h1').textContent=title[mode];root.querySelector('.account-intro').textContent='Access course details, hackathon submissions, learning progress and your internship workspace.';
 const form=root.querySelector('form'),status=root.querySelector('#account-status');
 function field(label,name,type,min){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement('input');input.name=name;input.type=type;input.required=true;input.maxLength=name==='password'?128:name==='name'?100:name==='phone'?20:254;if(min)input.minLength=min;input.autocomplete=name==='password'?(mode==='login'?'current-password':'new-password'):name==='phone'?'tel':name;wrap.append(input);form.append(wrap);}
 if(mode==='signup'){field('Full name','name','text',2);field('Mobile number','phone','tel',7)}
 if(mode!=='reset')field('Email address','email','email');
 if(mode!=='forgot')field('Password (at least 12 characters)','password','password',12);
 if(mode==='signup'){const label=document.createElement('label');label.className='consent';label.innerHTML='<input type="checkbox" name="consent" required><span>I agree to store my account details and learning activity, and send account contact notifications to the Vypax team. My password will not be emailed.</span>';form.append(label)}
 const submit=document.createElement('button');submit.className='button';submit.type='submit';submit.textContent={login:'Sign in',signup:'Create account',forgot:'Send reset link',reset:'Update password'}[mode];form.append(submit);
 for(const [m,label] of [['login','Sign in'],['signup','Create account'],['forgot','Forgot password?']]){if(m===mode)continue;const a=document.createElement('a');a.href='account.html?mode='+m+'&next='+encodeURIComponent(target);a.textContent=label;root.querySelector('#account-links').append(a)}
 form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity())return;submit.disabled=true;status.textContent='Please wait…';const data=Object.fromEntries(new FormData(form));if(mode==='reset')data.token=new URLSearchParams(location.hash.slice(1)).get('token');try{const response=await fetch('/api/auth/'+(mode==='signup'?'register':mode),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw Error(result.error);if(result.user)location.href=target;else{status.textContent=result.message;if(mode==='reset')history.replaceState(null,'','account.html?mode=login')}}catch(error){status.textContent=error.message||'Please try again.'}finally{submit.disabled=false}});
})();
