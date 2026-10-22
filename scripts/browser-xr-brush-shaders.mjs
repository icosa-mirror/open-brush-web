import {parseArgs} from "node:util";
import {readFile,readdir,mkdir,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {spawn,spawnSync} from "node:child_process";
import path from "node:path";
import {chromium} from "playwright";
import {selectRequiredFixtures} from "./compare-unity-mesh-fixtures.mjs";
import {validateXrBrushShaderAudit,xrGraphicsWarnings} from "./brush-xr-shader-contract.mjs";

const hash=b=>createHash("sha256").update(b).digest("hex");
async function main(){
const {values}=parseArgs({options:{fixtures:{type:"string"},output:{type:"string"},url:{type:"string"},brush:{type:"string",multiple:true}}});
if(!values.fixtures||!values.output)throw Error("Usage: node scripts/browser-xr-brush-shaders.mjs --fixtures <native fixture directory> --output <new directory> [--brush <name/GUID>] [--url <existing Vite URL>]. Check npx iwsdk xr status first.");
const inventoryBytes=await readFile("src/brushes/generated/brush-assets.json"), inventory=JSON.parse(inventoryBytes);
const required=new Set(Object.entries(inventory.brushes).filter(([,b])=>b.catalogSection&&!b.tags?.includes("broken")&&(b.tags?.includes("default")||b.tags?.includes("experimental"))).map(([guid])=>guid.toLowerCase()));
const generationBytes=await readFile("docs/evidence/brush-fidelity/native-2026-10-21/manifest.json"),generation=JSON.parse(generationBytes);
const recorded=new Map(generation.artifacts.map(r=>[r.brushGuid.toLowerCase(),r.mesh.sha256]));
const records=[];
for(const file of (await readdir(values.fixtures)).filter(f=>f.endsWith(".mesh.json"))){const bytes=await readFile(path.join(values.fixtures,file)),parsed=JSON.parse(bytes.toString().replace(/^\uFEFF/,""));const fixture={schemaVersion:parsed.schemaVersion,brushGuid:parsed.brushGuid,durableName:parsed.durableName,strokes:parsed.strokes?.map(stroke=>({input:stroke.input}))};records.push({guid:fixture.brushGuid.toLowerCase(),file,fixture,sha256:hash(bytes)});}
let inputs=selectRequiredFixtures(records,required);
if(values.brush?.length)inputs=values.brush.map(query=>{const matches=inputs.filter(r=>r.guid===query.toLowerCase()||r.fixture.durableName.toLowerCase()===query.toLowerCase());if(matches.length!==1)throw Error(`Expected one required brush for ${query}`);return matches[0]});
if(new Set(inputs.map(r=>r.guid)).size!==inputs.length)throw Error("Duplicate brush selection");
for(const input of inputs)if(recorded.get(input.guid)!==input.sha256)throw Error(`Native input drift: ${input.file}`);
await mkdir(path.dirname(path.resolve(values.output)),{recursive:true});await mkdir(values.output);
const sourceFiles=["src/three-workarounds.ts","src/brushes/brush-xr-shader-audit.ts","src/brushes/brush-visual-conformance.ts","src/brushes/brush-shader-compile-audit.ts","src/brushes/brush-shader-library.ts","src/brushes/brush-shader-materials.ts","src/brushes/iwsdk-tilt-material.ts","src/brushes/brush-render-material.ts","src/brushes/brush-asset-base-url.ts","src/brushes/brush-catalog.ts","src/brushes/brush-inventory.ts","scripts/brush-xr-shader-harness.html","scripts/browser-xr-brush-shaders.mjs","scripts/brush-xr-shader-contract.mjs","node_modules/@iwsdk/vite-plugin-dev/dist/injection-bundle.js"];
const report={schemaVersion:1,startedAt:new Date().toISOString(),scope:"IWER emulated immersive session shader compile/link; no physical headset, pixel-parity or performance pass",appRevision:spawnSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).stdout.trim(),inventorySha256:hash(inventoryBytes),lockfileSha256:hash(await readFile("package-lock.json")),nativeGenerationManifestSha256:hash(generationBytes),nativeRevision:generation.nativeRevision,sourceHashes:Object.fromEntries(await Promise.all(sourceFiles.map(async f=>[f,hash(await readFile(f))]))),requiredCount:required.size,selectedCount:inputs.length,results:[]};
const save=()=>writeFile(path.join(values.output,"results.json"),JSON.stringify(report,null,2)+"\n");
let browser,server,serverLog="",serverSpawnError;const messages=[],pageErrors=[];
try{
 const url=values.url??"http://127.0.0.1:4194/";
 if(!values.url){server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--mode","mirror-http","--host","127.0.0.1","--port","4194","--strictPort","--open","false"],{stdio:["ignore","pipe","pipe"]});server.on("error",error=>{serverSpawnError=error.message});const collect=b=>serverLog=(serverLog+b).slice(-10000);server.stdout.on("data",collect);server.stderr.on("data",collect);let ready=false;for(const deadline=Date.now()+60000;Date.now()<deadline;){if(serverSpawnError)throw Error(`Owned Vite spawn failed: ${serverSpawnError}`);if(server.exitCode!==null)throw Error("Owned Vite server exited");try{if((await fetch(url,{signal:AbortSignal.timeout(1000)})).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}if(!ready)throw Error("Owned Vite server did not start");}
 browser=await chromium.launch({channel:"chrome",headless:true,args:["--enable-unsafe-swiftshader","--use-angle=swiftshader"]});report.browserVersion=browser.version();
 const page=await browser.newPage();page.setDefaultTimeout(120000);page.on("pageerror",e=>pageErrors.push(e.message));page.on("console",m=>messages.push({type:m.type(),text:m.text().slice(0,1000)}));
 await page.goto(new URL("scripts/brush-xr-shader-harness.html",url).href,{timeout:120000});await page.waitForFunction(()=>document.documentElement.dataset.xrShaderHarness==="ready");await page.click("#enter-xr");await page.waitForFunction(()=>window.xrBrushTest.status().presenting);
 report.renderer=await page.evaluate(()=>window.xrBrushTest.status().renderer);
 for(const input of inputs){
  const row={guid:input.guid,name:input.fixture.durableName,meshSha256:input.sha256,status:"pending"};report.results.push(row);
  try{const f=input.fixture;if(f.schemaVersion!==1||f.strokes?.length!==1)throw Error("Expected one native fixture stroke");const i=f.strokes[0].input;if(i.brushGuid.toLowerCase()!==input.guid)throw Error("Native input identity mismatch");
   if(!Array.isArray(i.localToWorldMatrix)||i.localToWorldMatrix.length!==16||i.localToWorldMatrix.some((v,n)=>!Number.isFinite(v)||Math.abs(v-(n%5===0?1:0))>1e-6))throw Error("Non-identity native canvas transforms are outside this audit");
   const stroke={...i,guid:input.guid,brushSize:i.brushSize*0.1,flags:Number(i.flags),groupId:0,layerIndex:0,controlPoints:i.controlPoints.map(p=>({...p,position:[p.position[0]*0.1,p.position[1]*0.1,-p.position[2]*0.1],orientation:[-p.orientation[0],-p.orientation[1],p.orientation[2],p.orientation[3]]}))};
   let timer;try{Object.assign(row,await Promise.race([page.evaluate(({guid,stroke})=>window.xrBrushTest.run(guid,stroke),{guid:input.guid,stroke}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error("XR brush audit exceeded 60 seconds")),60000)})]));}finally{clearTimeout(timer)}
   validateXrBrushShaderAudit(row);row.status="emulated-xr-linked";
  }catch(e){row.status="audit-failed";row.error=e.message;}
  await save();if(report.results.length%10===0||row.status!=="emulated-xr-linked")console.log(`${report.results.length}/${inputs.length}: ${row.name}: ${row.status}`);if(row.status!=="emulated-xr-linked")break;
 }
 await page.evaluate(()=>window.xrBrushTest.end());await page.waitForFunction(()=>!window.xrBrushTest.status().presenting);
 report.sessionEnded=true;report.completedAt=new Date().toISOString();
}catch(e){report.error=e.message;process.exitCode=1;}finally{
 await browser?.close();server?.kill();report.consoleErrorCount=messages.filter(m=>m.type==="error").length;report.graphicsWarningCount=xrGraphicsWarnings(messages).length;report.pageErrors=pageErrors;report.notAttempted=inputs.slice(report.results.length).map(r=>({guid:r.guid,name:r.fixture.durableName}));await save();await writeFile(path.join(values.output,"browser-log.json"),JSON.stringify({messages,pageErrors},null,2));await writeFile(path.join(values.output,"server.txt"),serverLog);
}
const linked=report.results.filter(r=>r.status==="emulated-xr-linked").length;console.log(`Emulated XR shader audit: ${linked}/${inputs.length} linked; browser errors ${report.consoleErrorCount+pageErrors.length}; graphics warnings ${report.graphicsWarningCount}.`);
if(linked!==inputs.length||!report.sessionEnded||report.consoleErrorCount||pageErrors.length||report.graphicsWarningCount)process.exitCode=1;
}
main().catch(error=>{console.error(`XR audit bootstrap failed: ${error.message}`);process.exitCode=1});
