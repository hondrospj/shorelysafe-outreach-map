import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {timingSafeEqual} from 'node:crypto';
import {normalize} from './core.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const assets=new Set(['index.html','app.js','core.js','style.css','favicon.svg','towns.geojson','vendor/leaflet.js','vendor/leaflet.css']);
export function createServer({apiKey=process.env.DASHBOARD_KEY||'',origin=process.env.ALLOWED_ORIGIN||'',activityFile=process.env.ACTIVITY_FILE||path.join(root,'private/activity.json')}={}){
 return http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  if(pathname==='/api/snapshot'){
   res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
   if(req.headers.origin){if(req.headers.origin!==origin){res.writeHead(403).end('{"error":"Origin not allowed"}');return;}res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
   if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Headers','Authorization');res.setHeader('Access-Control-Allow-Methods','GET');res.writeHead(204).end();return;}
   const provided=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+apiKey);
   if(!apiKey||provided.length!==expected.length||!timingSafeEqual(provided,expected)){res.writeHead(401).end('{"error":"Unauthorized"}');return;}
   if(req.method!=='GET'){res.writeHead(405).end();return;}
   try{const result=normalize(JSON.parse(await readFile(activityFile,'utf8')));res.end(JSON.stringify(result));}catch{res.writeHead(503).end('{"error":"No valid activity snapshot available"}');}return;
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  const name=pathname==='/'?'index.html':pathname.slice(1);if(!assets.has(name)){res.writeHead(404).end('Not found');return;}
  try{const body=await readFile(path.join(root,name));res.setHeader('Content-Type',({'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8','svg':'image/svg+xml','geojson':'application/geo+json'})[name.split('.').at(-1)]||'application/octet-stream');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");res.end(req.method==='HEAD'?undefined:body);}catch{res.writeHead(404).end('Not found');}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const host=process.env.HOST||'127.0.0.1',key=process.env.DASHBOARD_KEY||'';if(!['127.0.0.1','localhost','::1'].includes(host)&&key.length<32)throw Error('External hosting requires DASHBOARD_KEY with at least 32 characters.');const port=Number(process.env.PORT||8870);createServer().listen(port,host,()=>console.log(`Outreach dashboard: http://${host}:${port}`));
}
