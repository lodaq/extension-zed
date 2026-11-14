import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
const executable=process.env.CHROME_PATH??'/home/sebaq/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'
const output=path.resolve('docs/design/screenshots')
await fs.mkdir(output,{recursive:true})
const html=(await fs.readFile('dist/index.html','utf8')).replace('<head>','<head><script src="/fixture.js"></script>')
const fixture=await fs.readFile('docs/design/fixture.js','utf8')
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return}if(url.pathname==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(fixture);return}const file=path.resolve('dist','.'+url.pathname);if(!file.startsWith(path.resolve('dist')+path.sep))throw Error('Invalid path');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':'image/png');res.end(await fs.readFile(file))}catch{res.statusCode=404;res.end()}})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const port=server.address().port
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'zed-design-'))
const child=spawn(executable,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--force-device-scale-factor=1','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']})
let ws
try{
 const endpoint=await new Promise((resolve,reject)=>{let text='';const timeout=setTimeout(()=>reject(Error('Chrome startup timed out')),15000);child.stderr.on('data',data=>{text+=data;const match=text.match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timeout);resolve(match[1])}});child.on('error',reject)})
 ws=new WebSocket(endpoint)
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
 let next=0;const pending=new Map()
 ws.onmessage=event=>{const result=JSON.parse(event.data);if(result.id){const promise=pending.get(result.id);pending.delete(result.id);result.error?promise.reject(Error(result.error.message)):promise.resolve(result.result)}}
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,sessionId}))})
 const {targetId}=await send('Target.createTarget',{url:'about:blank'})
 const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true})
 const command=(method,params)=>send(method,params,sessionId)
 const evaluate=async expression=>{const result=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value}
 await command('Page.enable')
 await command('Emulation.setDeviceMetricsOverride',{width:640,height:600,deviceScaleFactor:1,mobile:false})
 await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 async function settle(){await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')}
 async function click(label){await evaluate(`(()=>{const node=[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===${JSON.stringify(label)}||node.getAttribute('aria-label')===${JSON.stringify(label)});if(!node)throw Error('Missing button '+${JSON.stringify(label)});node.focus();node.click()})()`);await settle()}
 async function shot(name){await settle();const metrics=await evaluate(`(()=>{const shell=document.querySelector('main');const content=document.querySelector('.zed-content');return {w:shell.offsetWidth,h:shell.offsetHeight,overflow:content.scrollWidth>content.clientWidth,outer:document.documentElement.scrollHeight>600,focus:document.activeElement?.textContent?.trim()}})()`);assert.equal(metrics.w,640);assert.equal(metrics.h,600);assert.equal(metrics.overflow,false,`${name}: horizontal overflow`);assert.equal(metrics.outer,false,`${name}: outer scroll`);const {data}=await command('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:640,height:600,scale:1}});await fs.writeFile(path.join(output,name+'.png'),Buffer.from(data,'base64'));return metrics}
 await command('Page.navigate',{url:`http://127.0.0.1:${port}/`})
 for(let i=0;i<100;i++){if(await evaluate('!!document.querySelector(".zed-tiles")'))break;await new Promise(resolve=>setTimeout(resolve,50))}
 await evaluate('document.fonts.ready');await shot('01-misc')
 for(const [i,name]of ['Playback speed','Video quality','Password generator','Volume boost','Scrollbars','Modes','Capture screenshot'].entries()){
  await evaluate(`(()=>{const node=[...document.querySelectorAll('.zed-tile')].find(node=>node.textContent.includes(${JSON.stringify(name)}));node.focus();node.click()})()`);await settle();await shot(`${String(i+2).padStart(2,'0')}-${name.toLowerCase().replaceAll(' ','-')}`);await click('Back')
 }
 for(const name of ['Extensions','YouTube','Links','Shortcuts']){await click(name);await shot(name.toLowerCase())}
 await click('Settings');await shot('settings');await click('Reset settings to defaults');const dialog=await shot('reset-dialog');assert.equal(dialog.focus,'Cancel');
 await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',modifiers:8,windowsVirtualKeyCode:9});
 assert.equal(await evaluate('document.activeElement.textContent.trim()'),'Reset settings');
 await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 assert.equal(await evaluate('document.activeElement.textContent.trim()'),'Cancel');await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await settle();assert.equal(await evaluate('!!document.querySelector("dialog[open]")'),false);assert.equal(await evaluate('document.activeElement.textContent.trim()'),'Reset settings to defaults')
 await click('Settings');await click('Shortcuts');await evaluate('document.querySelector(".zed-inline").focus();document.querySelector(".zed-inline").click()');await shot('shortcut-recording');await command('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65});await shot('shortcut-error')
 await command('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',modifiers:9,windowsVirtualKeyCode:39});await shot('shortcut-conflict');
 assert.equal(await evaluate('document.querySelector(".zed-inline.zed-recording").textContent'),'Used by Faster');
 await click('Links');await evaluate('document.querySelector("input").focus()');await command('Input.insertText',{text:'https://example.com'});await click('Add');await shot('links-populated');assert.equal(await evaluate('document.querySelector(".zed-count").textContent'),'1 saved');await shot('toast');assert.equal(await evaluate('document.querySelector("[role=status]").textContent.includes("Link added")'),true);
 await evaluate('new Promise(resolve=>setTimeout(resolve,1900))');assert.equal(await evaluate('!!document.querySelector("[role=status][data-state=open]")'),false);
 await command('Page.navigate',{url:`http://127.0.0.1:${port}/?restricted`});for(let i=0;i<100;i++){if(await evaluate('!!document.querySelector(".zed-notice")'))break;await new Promise(resolve=>setTimeout(resolve,50))}await shot('restricted');assert.equal(await evaluate('document.querySelectorAll(".zed-tile:disabled").length'),6)
 console.log('Saved screenshots; verified 640 × 600, overflow, dialog focus trap/restore/Escape, shortcut conflicts, add-link storage, toast expiry, and restricted controls.')
}finally{ws?.close();child.kill();await new Promise(resolve=>server.close(resolve));await fs.rm(profile,{recursive:true,force:true}).catch(()=>{})}
