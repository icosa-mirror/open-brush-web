import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { parseArgs } from 'node:util';
import path from 'node:path';
const {values}=parseArgs({options:{output:{type:'string'}}});
if(!values.output)throw Error('Usage: node scripts/browser-shader-compile-control.mjs --output <new directory>. Check npx iwsdk xr status first; the test owns a temporary Vite server on port 4193.');
const output=values.output;await mkdir(path.dirname(path.resolve(output)),{recursive:true});await mkdir(output);
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--mode','mirror-http','--host','127.0.0.1','--port','4193','--strictPort','--open','false'],{stdio:['ignore','pipe','pipe']});
let serverLog='';server.stdout.on('data',b=>serverLog=(serverLog+b).slice(-5000));server.stderr.on('data',b=>serverLog=(serverLog+b).slice(-5000));
let browser;const errors=[];
try{
 const url='http://127.0.0.1:4193/';let ready=false;
 for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error('Owned server exited');try{if((await fetch(url)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
 if(!ready)throw Error('Server startup timed out');
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 const harness=new URL('__compile_audit_gpu__',url).href;
 await page.route(harness,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));await page.goto(harness);
 const results=await page.evaluate(async()=>{const m=await import('/src/brushes/brush-shader-compile-control.ts');return await m.testCompileAudit()});
 await writeFile(`${output}/results.json`,JSON.stringify({browserVersion:browser.version(),results,pageErrors:errors},null,2));
 if(errors.length)throw Error('Unexpected page errors');
 console.log(JSON.stringify(results.map(r=>({broken:r.broken,status:r.result.status,restored:r.restored,programs:r.result.programs.length}))));
}finally{await browser?.close();server.kill();await writeFile(`${output}/server.txt`,serverLog)}
