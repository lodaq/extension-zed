import fs from 'node:fs'
import path from 'node:path'
const roots=['src','public/scripts/inspectMode.js','public/screenshot-clipboard.html']
const violations=[]
function check(file) {
 const stat=fs.statSync(file)
 if(stat.isDirectory()){for(const name of fs.readdirSync(file))check(path.join(file,name));return}
 if(!/\.(css|tsx?|html|js)$/.test(file)||file.endsWith('tokens.css')||/\.test\./.test(file))return
 // Host-page measurements, screenshot pixels and intentional page transformations are not UI styles.
 const text=fs.readFileSync(file,'utf8')
 for(const [index,line] of text.split('\n').entries()){
  if(/#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\([^)]*\)|(?:border-radius|borderRadius|font-size|fontSize)\s*:\s*["']?\d+(?:px|rem|em|%)|text-\[\d+(?:px|rem)\]/i.test(line))violations.push(`${file}:${index+1}: ${line.trim()}`)
 }
}
for(const root of roots)check(root)
if(violations.length){console.error(violations.join('\n'));process.exit(1)}
console.log('Extension UI uses design tokens.')
