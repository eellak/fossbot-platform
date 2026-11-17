(() => {
  window.stageProfile?.dispose();
  const restored = [], samples = [], input = [], tasks = [];
  let running = false, label = '', frame = 0, previous = 0, calls = 0, triangles = 0, pressed = false, start = 0;
  const quantiles = values => {
    const a = values.slice().sort((a,b)=>a-b);
    const q = p => a.length ? a[Math.min(a.length-1, Math.ceil(a.length*p)-1)] : null;
    return { samples:a.length, p50:q(.5), p95:q(.95), p99:q(.99), max:a.at(-1) ?? null };
  };
  for (const type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!type) continue;
    for (const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']) {
      const original = type.prototype[name]; if (!original) continue;
      type.prototype[name] = function(...args) {
        if (running) { calls++; const n=name.includes('Arrays')?args[2]:args[1]; if(args[0]===this.TRIANGLES)triangles+=n/3*(name.endsWith('Instanced')?args.at(-1):1); }
        return original.apply(this,args);
      };
      restored.push(()=>{ type.prototype[name]=original; });
    }
  }
  const observer = new PerformanceObserver(list => { if(running) tasks.push(...list.getEntries().map(x=>x.duration)); });
  observer.observe({entryTypes:['longtask']});
  const down = () => { pressed=true; };
  const up = () => { pressed=false; };
  const event = e => {
    if(!running || (e.type==='pointermove'&&!pressed)) return;
    const stamp=e.timeStamp;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{ if(running) input.push({type:e.type,ms:performance.now()-stamp}); }));
  };
  window.addEventListener('pointerdown',down,true);window.addEventListener('pointerup',up,true);
  window.addEventListener('click',event,true);window.addEventListener('pointermove',event,true);
  const tick = t => { if(!running)return; if(previous)samples.push({ms:t-previous,calls,triangles,drag:pressed});previous=t;calls=triangles=0;frame=requestAnimationFrame(tick); };
  const env=()=>{
    const canvas=[...document.querySelectorAll('canvas')].find(c=>c.width>300), gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl'), ext=gl?.getExtension('WEBGL_debug_renderer_info');
    return {userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory,viewport:[innerWidth,innerHeight],pixelRatio:devicePixelRatio,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,visibility:document.visibilityState,heapUsed:performance.memory?.usedJSHeapSize};
  };
  window.stageProfile={
    start(name){samples.length=input.length=tasks.length=0;label=name;previous=calls=triangles=0;start=performance.now();running=true;frame=requestAnimationFrame(tick);return env();},
    stop(){running=false;cancelAnimationFrame(frame);return {label,durationMs:performance.now()-start,environment:env(),frameIntervals:quantiles(samples.map(x=>x.ms)),renderingFrameIntervals:quantiles(samples.filter(x=>x.calls).map(x=>x.ms)),drawCallsPerRenderingFrame:quantiles(samples.filter(x=>x.calls).map(x=>x.calls)),trianglesPerRenderingFrame:quantiles(samples.filter(x=>x.calls).map(x=>x.triangles)),dragFrameIntervals:quantiles(samples.filter(x=>x.drag).map(x=>x.ms)),inputToSecondAnimationFrame:quantiles(input.map(x=>x.ms)),longTasks:quantiles(tasks),note:'Animation-frame intervals and second-frame input latency are CPU/browser proxies, not GPU completion or visual feedback guarantees. Shared renderer counts include the library when visible.'};},
    dispose(){running=false;cancelAnimationFrame(frame);observer.disconnect();restored.forEach(f=>f());window.removeEventListener('pointerdown',down,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('click',event,true);window.removeEventListener('pointermove',event,true);delete window.stageProfile;}
  };
  return 'Profile ready';
})()
