(()=>{
  const script=document.currentScript,version=new URL(script?.src||location.href).searchParams.get('v')||'dev';
  const modules=['input-guard.js','browser-enhancements.js','event-inspector.js','policy-inspector.js','improvement-guard.js','app.js'];
  const loadModules=async()=>{for(const name of modules)await import(`./${name}?v=${encodeURIComponent(version)}`)};
  const waitForActivation=worker=>new Promise(resolve=>{if(!worker||worker.state==='activated')return resolve();const done=()=>{if(worker.state==='activated'||worker.state==='redundant'){worker.removeEventListener('statechange',done);resolve()}};worker.addEventListener('statechange',done)});
  const reloadForController=()=>{const key=`xrai-coi-reload-${version}`;if(sessionStorage.getItem(key))return false;sessionStorage.setItem(key,'1');location.reload();return true};

  (async()=>{
    if(!('serviceWorker' in navigator)){await loadModules();return}
    try{
      const registration=await navigator.serviceWorker.register('./coi-sw.js',{scope:'./',updateViaCache:'none'});
      await registration.update().catch(()=>{});
      const replacing=registration.installing||registration.waiting;
      if(replacing){await waitForActivation(replacing);if(reloadForController())return}
      await navigator.serviceWorker.ready;
      if(!navigator.serviceWorker.controller&&!globalThis.crossOriginIsolated){if(reloadForController())return}
      sessionStorage.removeItem(`xrai-coi-reload-${version}`);
      await loadModules();
    }catch(error){
      console.warn('XRAI browser sandbox isolation unavailable:',error);
      await loadModules();
    }
  })();
})();
