// Progressive image enrichment: only matching WooCommerce product names are accepted.
const API='https://pulsetiles.co.za/wp-json/wc/store/v1/products';
const memory=new Map();
const pending=new Map();
const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/&amp;/g,'and').replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
function findImage(row){return row?.images?.find(i=>/^https:\/\//.test(i?.src||''))?.src||'';}
async function retrieve(name){
 const u=new URL(API);u.searchParams.set('search',name);u.searchParams.set('per_page','20');
 const response=await fetch(u.href,{mode:'cors',credentials:'omit',signal:AbortSignal.timeout(11000)});
 if(!response.ok)throw new Error('Pulse image lookup unavailable: '+response.status);
 const rows=await response.json();if(!Array.isArray(rows))return '';
 const wanted=norm(name);
 // Only exact names accepted; no fuzzy guesses across product variants.
 const match=rows.find(row=>norm(row.name)===wanted);
 return match?findImage(match):'';
}
export function lookupHardwareImage(name){
 const key=norm(name);if(!key)return Promise.resolve('');
 if(memory.has(key))return Promise.resolve(memory.get(key));
 if(pending.has(key))return pending.get(key);
 const job=retrieve(name).catch(()=> '').then(src=>{if(src)memory.set(key,src);pending.delete(key);return src;});
 pending.set(key,job);return job;
}
export function hydrateHardwareCards(root,products){
 if(!root||!('IntersectionObserver' in window))return;
 const targets=[...root.querySelectorAll('.hardware-product-card[data-hw-index]')];
 if(!targets.length)return;
 const obs=new IntersectionObserver(entries=>{
  for(const entry of entries){if(!entry.isIntersecting)continue;
   const card=entry.target;obs.unobserve(card);
   const p=products[Number(card.dataset.hwIndex)];if(!p||p._type!=='hardware')continue;
   const placeholder=card.querySelector('.hardware-photo-placeholder');if(!placeholder)return;
   lookupHardwareImage(p._name).then(url=>{
    if(!url||!card.isConnected||!placeholder.isConnected)return;
    const img=document.createElement('img');img.loading='lazy';img.referrerPolicy='no-referrer';img.alt=p._name;
    img.onload=()=>{p._image=url;p.image=url;placeholder.replaceWith(img);};
    img.onerror=()=>img.remove();img.src=url;
   });
  }
 },{rootMargin:'280px'});
 targets.forEach(el=>obs.observe(el));
}
