import { evaluateLineGeometry } from '../../sim/src/stages/lineGeometryCore.js';
import { buildLineVisual, lineSegmentsFromEntry } from '../../sim/src/stages/visuals.ts';
import { isOverLine } from '../../sim/src/sensors/line/probe.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const stats = (values:number[]) => { const a=values.slice().sort((a,b)=>a-b); const q=(p:number)=>a[Math.min(a.length-1,Math.ceil(a.length*p)-1)]; return {n:a.length,p50:q(.5),p95:q(.95),p99:q(.99)}; };
const directory = process.argv[2] || '/tmp/stage-editor-perf';
const results=[];
for (const name of ['short','normal','stress']) {
  const record=JSON.parse(readFileSync(`${directory}/curve-${name}.json`,'utf8'));
  const lines=record.config.filter((x:any)=>x.type==='line');
  let evaluated=lines.map(evaluateLineGeometry);
  assert(evaluated.every((x:any)=>x.runnable));
  const evalMs=[];
  for(let i=0;i<110;i++){const start=performance.now(); evaluated=lines.map(evaluateLineGeometry); if(i>=10)evalMs.push(performance.now()-start);}
  const segments=lines.flatMap((line:any,i:number)=>lineSegmentsFromEntry(line,evaluated[i]));
  const sensorMs=[];
  for(let i=0;i<1010;i++){const start=performance.now();for(const x of [-.03,0,.03])isOverLine(segments,x+100,100);if(i>=10)sensorMs.push(performance.now()-start);}
  const buildMs=[];let meshes=0,triangles=0;
  for(let i=0;i<10;i++){
    const start=performance.now();const roots=lines.map((line:any,j:number)=>buildLineVisual(line,evaluated[j]).object);buildMs.push(performance.now()-start);
    meshes=0;triangles=0;const geometries=new Set<any>(),materials=new Set<any>();
    roots.forEach((root:any)=>root.traverse((child:any)=>{if(child.isMesh){meshes++;triangles+=(child.geometry.index?.count??child.geometry.attributes.position.count)/3;geometries.add(child.geometry);materials.add(child.material);}}));
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
  assert.equal(segments.length,evaluated.reduce((sum:number,x:any)=>sum+x.segmentCount,0));
  results.push({name,paths:lines.length,nodes:lines.reduce((s:number,x:any)=>s+x.points.length,0),segments:segments.length,meshes,triangles,evaluateMs:stats(evalMs),constructMs:stats(buildMs),threeProbesWorstCaseMs:stats(sensorMs)});
}
const report={timestamp:new Date().toISOString(),environment:{runtime:process.version,platform:process.platform,arch:process.arch},scope:'CPU only. Actual shared evaluator, visual builder and three full-miss floor probes. Mesh count is not an observed GPU draw-call count.',results};
writeFileSync(`${directory}/curve-cpu-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
