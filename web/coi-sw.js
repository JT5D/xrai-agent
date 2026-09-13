self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.cache==='only-if-cached'&&request.mode!=='same-origin')return;
  const sameOrigin=new URL(request.url).origin===self.location.origin;
  const runtimeAsset=sameOrigin&&(request.mode==='navigate'||['document','script','style'].includes(request.destination));
  const upstream=runtimeAsset?fetch(request,{cache:'no-store'}):fetch(request);
  event.respondWith(upstream.then(response=>{
    if(!response||response.status===0)return response;
    const headers=new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy','same-origin');
    headers.set('Cross-Origin-Embedder-Policy','require-corp');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }));
});
