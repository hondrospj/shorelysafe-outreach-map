export const TOWNS=[
 {id:'bay-head',name:'Bay Head',lat:40.069,lng:-74.0478,county:'Ocean'},
 {id:'lavallette',name:'Lavallette',lat:39.9695,lng:-74.07,county:'Ocean'},
 {id:'surf-city',name:'Surf City',lat:39.6641,lng:-74.1698,county:'Ocean'},
 {id:'long-beach-township',name:'Long Beach Township',lat:39.6119,lng:-74.206,county:'Ocean'},
 {id:'beach-haven',name:'Beach Haven',lat:39.563,lng:-74.2425,county:'Ocean'}
];
export const blankData=()=>({version:1,updatedAt:null,source:{name:'HubSpot',status:'not_connected'},contacts:[],emails:[],events:[]});
export function townId(value){const s=String(value||'').toLowerCase().replace(/\b(borough|township|new jersey|nj)\b/g,'').replace(/[^a-z0-9]/g,'');return TOWNS.find(t=>t.id.replace(/-/g,'')===s||t.name.toLowerCase().replace(/\b(borough|township)\b/g,'').replace(/[^a-z0-9]/g,'')===s)?.id||null;}
export function safeURL(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}}
export function parseCSV(text){
 text=String(text).replace(/^\uFEFF/,'');let rows=[],row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell){quoted=!quoted;}else throw new Error('Unexpected quote in CSV.');}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw new Error('Unclosed quoted field in CSV.');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);if(rows.length<2)throw new Error('The CSV needs a header and at least one event.');
 const head=rows.shift().map(h=>h.trim());if(new Set(head.map(h=>h.toLowerCase())).size!==head.length)throw new Error('CSV headers must be unique.');return rows.map((r,i)=>{if(r.length!==head.length)throw new Error(`CSV row ${i+2} has ${r.length} fields; expected ${head.length}.`);return Object.fromEntries(head.map((h,j)=>[h,r[j]]));});
}
const key=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
function pick(row,...names){const entries=Object.entries(row);for(const n of names){const found=entries.find(([k])=>key(k)===key(n));if(found&&found[1]!==''&&found[1]!=null)return found[1];}return null;}
function timestamp(v){if(typeof v==='string'&&/^\d{10,13}$/.test(v))v=Number(v);if(typeof v==='number'&&v<1e12)v*=1000;const n=new Date(v).getTime();return Number.isFinite(n)&&v!=null?new Date(n).toISOString():null;}
const eventType=v=>({click:'click',clicked:'click',open:'open',opened:'open',sent:'sent',send:'sent',delivered:'delivered',bounce:'bounce',bounced:'bounce',reply:'reply',replied:'reply',deferred:'deferred',dropped:'bounce'})[String(v||'').toLowerCase()]||null;
const scalar=v=>v&&typeof v==='object'?(v.email||v.address||''):String(v||'');
export function normalize(input){
 const raw=typeof input==='string'?(/^[\s\uFEFF]*[\[{]/.test(input)?JSON.parse(input):parseCSV(input)):input;
 if(!raw||typeof raw!=='object')throw new Error('Choose a JSON snapshot or event CSV.');
 const rows=Array.isArray(raw)?raw:(raw.events||raw.results);if(!Array.isArray(rows))throw new Error('No events array found.');if(rows.length>50000)throw new Error('Import at most 50,000 events at a time.');
 const contacts=(raw.contacts||[]).map(c=>({...c,email:String(c.email||'').toLowerCase(),townId:townId(c.townId||c.town)}));
 const emails=(raw.emails||[]).map(e=>({...e,id:String(e.id),townId:townId(e.townId||e.town)}));
 let skipped=0;const issues=[];const events=[];
 rows.forEach((r,i)=>{
  const type=eventType(pick(r,'type','eventType','event type','activity'));const at=timestamp(pick(r,'timestamp','created','time','date','occurredAt'));
  if(!type||!at){skipped++;issues.push(`Row ${i+1}: ${!type?'unknown event type':'missing or invalid timestamp'}`);return;}
  const recipient=scalar(pick(r,'recipient','recipientEmail','email address','email')).trim().toLowerCase();
  const contact=contacts.find(c=>c.email===recipient);const id=String(pick(r,'emailId','emailCampaignId','email id','campaignId')||'');const email=emails.find(e=>e.id===id);
  const subject=String(pick(r,'subject','emailSubject','email subject')||email?.subject||'Untitled email');
  const explicitTown=townId(pick(r,'townId','town','municipality'));
  const matching=TOWNS.filter(t=>subject.toLowerCase().includes(t.name.toLowerCase()));
  const town=explicitTown||contact?.townId||email?.townId||(matching.length===1?matching[0].id:null);
  const attribution=String(pick(r,'attribution','confidence')||'').toLowerCase();
  const identified=/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(recipient)&&!['unknown','someone','unattributed','group'].includes(attribution);
  const ev={id:String(pick(r,'id','eventId','event id')||''),type,timestamp:at,recipient:identified?recipient:null,name:identified?String(pick(r,'contactName','contact name','name')||contact?.name||recipient):'Unattributed recipient',townId:town,emailId:id||subject,subject,url:safeURL(pick(r,'url','clickedUrl','clicked URL','link')),attribution:identified?'identified':'unknown',bot:pick(r,'bot','filteredEvent','isBot')===true||String(pick(r,'bot','filteredEvent','isBot')).toLowerCase()==='true',source:String(pick(r,'source')||raw.source?.name||'Imported activity')};
  events.push(ev);
 });
 const unique=dedupe(events);return {version:1,updatedAt:new Date().toISOString(),source:{name:raw.source?.name||'Imported activity',status:'imported'},contacts,emails,events:unique,importReport:{accepted:unique.length,duplicates:events.length-unique.length,skipped,issues}};
}
export function dedupe(events){const seen=new Set();return events.filter(e=>{const k=e.id?`${e.source||''}:${e.id}`:[e.type,e.timestamp,e.recipient||'',e.emailId||'',e.townId||'',e.url||'',Boolean(e.bot)].join('|');if(seen.has(k))return false;seen.add(k);return true;});}
export function mergeData(a,b){return {...b,contacts:[...new Map([...a.contacts,...b.contacts].map(c=>[c.email||c.id,c])).values()],emails:[...new Map([...a.emails,...b.emails].map(e=>[e.id,e])).values()],events:dedupe([...a.events,...b.events])};}
export function filterEvents(events,{town='all',type='all',search='',days='all',includeBots=false,now=Date.now()}={}){const q=search.trim().toLowerCase();const since=days==='all'?-Infinity:now-Number(days)*86400000;return events.filter(e=>(includeBots||!e.bot)&&(town==='all'||(town==='unassigned'?!e.townId:e.townId===town))&&(type==='all'||e.type===type)&&Date.parse(e.timestamp)>=since&&[e.name,e.recipient,e.subject,e.url,TOWNS.find(t=>t.id===e.townId)?.name].join(' ').toLowerCase().includes(q)).sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp));}
export function stats(events){const clicks=events.filter(e=>e.type==='click'&&!e.bot),opens=events.filter(e=>e.type==='open'&&!e.bot);return {clicks:clicks.length,people:new Set(clicks.filter(e=>e.attribution==='identified').map(e=>e.recipient)).size,towns:new Set(clicks.map(e=>e.townId).filter(Boolean)).size,emails:new Set(clicks.map(e=>e.emailId)).size,opens:opens.length,unknown:clicks.filter(e=>e.attribution!=='identified').length};}
export function csvExport(events){const rows=[['Town','Contact name','Recipient','Subject','Email ID','Event type','Timestamp','Clicked URL','Attribution','Source','Bot']];for(const e of events)rows.push([TOWNS.find(t=>t.id===e.townId)?.name||'',e.name,e.recipient||'',e.subject,e.emailId,e.type,e.timestamp,e.url||'',e.attribution,e.source,e.bot]);return rows.map(r=>r.map(v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}
export function sampleData(){const now=Date.now();const contacts=TOWNS.map(t=>({name:'Example OEM contact',email:`${t.id}@example.org`,townId:t.id}));const emails=TOWNS.map(t=>({id:`example-${t.id}`,townId:t.id,subject:`${t.name} Coastal Flood Mapping, Statistics, & Forecasting`}));let rows=[];for(const [i,t] of TOWNS.entries()){for(let j=0;j<5-i;j++)rows.push({id:`sample-${i}-${j}`,type:j===0?'open':'click',timestamp:new Date(now-(i*9+j*2)*3600000).toISOString(),recipient:contacts[i].email,name:contacts[i].name,townId:t.id,emailId:emails[i].id,subject:emails[i].subject,url:'https://example.org/flood-mapper',source:'Sample data'});}rows.push({id:'sample-unknown',type:'click',timestamp:new Date(now-3600000).toISOString(),townId:'bay-head',emailId:'example-bay-head',subject:emails[0].subject,attribution:'unknown',url:'https://example.org/flood-mapper',source:'Sample data'});return normalize({source:{name:'Sample data'},contacts,emails,events:rows});}
