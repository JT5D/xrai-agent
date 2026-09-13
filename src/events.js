import { EventEmitter } from 'node:events';
export class EventBus extends EventEmitter {
  constructor(){ super(); this.events=[]; }
  emitEvent(runId,type,summary,extra={}){
    const event={id:crypto.randomUUID(),ts:Date.now(),runId,type,summary,...extra};
    this.events.push(event); if(this.events.length>2000)this.events.shift();
    this.emit('event',event); return event;
  }
  forRun(id){return this.events.filter(e=>e.runId===id)}
}
export const bus=new EventBus();
