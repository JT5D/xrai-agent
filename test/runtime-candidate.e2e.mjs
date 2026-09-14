import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base=(process.argv[2]||'http://127.0.0.1:8765/').replace(/\/?$/,'/');
const artifactDir='artifacts/runtime-candidate';
await fs.mkdir(artifactDir,{recursive:true});
const report={base,startedAt:new Date().toISOString(),consoleErrors:[],pageErrors:[]};
const browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-dev-shm-usage']});
const page=await browser.newPage();
page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
page.on('pageerror',e=>report.pageErrors.push(String(e)));
const save=()=>fs.writeFile(`${artifactDir}/probe.json`,JSON.stringify(report,null,2));
const deadline=(promise,ms,label)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} timed out after ${ms}ms`)),ms))]);

try{
  await page.goto(`${base}runtime-candidate-probe.html`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>Boolean(globalThis.__xraiCandidate),null,{timeout:10000});

  try{
    const lifo=await deadline(page.evaluate(()=>globalThis.__xraiCandidate.runLifo()),150000,'Lifo probe');
    report.lifo={
      ok:lifo?.node?.exitCode===0&&/XRAI_LIFO_OK/.test(lifo?.node?.stdout||'')&&lifo?.install?.exitCode===0&&lifo?.requireCheck?.exitCode===0&&/true/.test(lifo?.requireCheck?.stdout||'')&&lifo?.test?.exitCode===0,
      crossOriginIsolated:lifo?.crossOriginIsolated,
      node:{exitCode:lifo?.node?.exitCode,stdout:lifo?.node?.stdout,stderr:lifo?.node?.stderr},
      install:{exitCode:lifo?.install?.exitCode,stdout:String(lifo?.install?.stdout||'').slice(-4000),stderr:String(lifo?.install?.stderr||'').slice(-4000)},
      requireCheck:{exitCode:lifo?.requireCheck?.exitCode,stdout:lifo?.requireCheck?.stdout,stderr:lifo?.requireCheck?.stderr},
      test:{exitCode:lifo?.test?.exitCode,stdout:lifo?.test?.stdout,stderr:lifo?.test?.stderr}
    };
  }catch(error){report.lifo={ok:false,error:error instanceof Error?error.message:String(error)}}
  await save();

  try{
    await page.waitForFunction(()=>Boolean(globalThis.puter?.auth?.signIn&&globalThis.puter?.ai?.chat),null,{timeout:30000});
    const popupPromise=page.waitForEvent('popup',{timeout:10000}).catch(()=>null);
    await page.click('#auth');
    const popup=await popupPromise;
    if(popup){report.puterPopup={opened:true,url:popup.url()};await popup.waitForLoadState('domcontentloaded',{timeout:15000}).catch(()=>{});report.puterPopup.url=popup.url()}
    await page.waitForFunction(()=>globalThis.__xraiCandidate?.puterAuth!=null,null,{timeout:45000});
    report.puterAuth=await page.evaluate(()=>globalThis.__xraiCandidate.puterAuth);
    if(report.puterAuth?.ok){
      const puter=await deadline(page.evaluate(()=>globalThis.__xraiCandidate.runPuter()),60000,'Puter AI probe');
      report.puter={ok:puter?.text==='XRAI_OK',...puter};
    }else report.puter={ok:false,error:'temporary-user auth did not complete'};
  }catch(error){report.puter={ok:false,error:error instanceof Error?error.message:String(error)}}

  report.ok=Boolean(report.lifo?.ok&&report.puter?.ok);
  report.finishedAt=new Date().toISOString();
  await save();
  console.log(JSON.stringify(report,null,2));
  if(!report.ok)process.exitCode=1;
}finally{
  await browser.close();
}
