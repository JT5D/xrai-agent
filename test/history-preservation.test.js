import test from 'node:test';
import assert from 'node:assert/strict';

test('startup preserves conversation history containing obsolete runtime errors',async()=>{
  const rows=new Map();
  const storage={getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};
  const state={messages:[{id:'kept',role:'agent',text:'The public GitHub Pages runtime does not have those capabilities.'}],lastTask:'Fix our conversation memory',events:[]};
  for(const key of ['xrai-ui-v4','xrai-ui-v3'])storage.setItem(key,JSON.stringify(state));
  const before=[...rows];
  const prior=globalThis.window;
  try{
    globalThis.window={localStorage:storage};
    await import('../web/input-guard.js?history-preservation');
    assert.deepEqual([...rows],before);
  }finally{if(prior===undefined)delete globalThis.window;else globalThis.window=prior}
});
