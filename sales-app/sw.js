const APP=new URL('./',self.location.href);
const PREFIX='pulse-github-'+APP.pathname+'-', CACHE=PREFIX+'v1.2.6';
// Only cache application shell assets during install. Catalogues are fetched independently.
const FILES=['./','./index.html','./styles.css','./app.js','./pulse-storage.js','./decor-catalogue.js','./hardware-catalogue.js','./hardware-images.js','./firebase-config.js','./logo.png','./manifest.webmanifest','./app-version.json','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(FILES.map(item=>cache.add(new URL(item,APP).href)))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==APP.origin)return;
 // Never serve version or product data from cache: show server truth (including 404).
 if(url.pathname.includes('/data/')||url.pathname.endsWith('/app-version.json')||url.pathname.endsWith('/sw.js'))return;
 if(!url.pathname.startsWith(APP.pathname))return;
 event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});}return res;}).catch(async()=>{
  const cache=await caches.open(CACHE),saved=await cache.match(req,{ignoreSearch:true});if(saved)return saved;
  if(req.mode==='navigate'){const fallback=await cache.match(new URL('index.html',APP).href);if(fallback)return fallback;}
  return Response.error();
 }));
});
