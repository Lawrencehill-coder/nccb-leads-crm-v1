/**
 * NCCB-only Google Apps Script API.
 * Deploy as Web App: execute as owner, access anyone (requests must pass server-side Google ID-token verification).
 * Required Script Properties:
 * NCCB_GOOGLE_CLIENT_ID, NCCB_SHEET_ID, NCCB_SUPER_ADMIN_EMAIL
 * Sheet tabs: Leads (id,name,company,status,assignedTo,followUp), Users (email,role,active)
 * Never publish private client records in GitHub or share the spreadsheet publicly.
 */
function doGet(){return json_({ok:false,error:'Use authenticated POST requests'});}
function doPost(e){
  try {
    if(!e || !e.postData || !e.postData.contents) throw Error('Missing request');
    const p=JSON.parse(e.postData.contents);
    const user=verify_(p.idToken);
    const action=String(p.action||'');
    let output;
    if(action==='me') output={email:user.email,role:user.role};
    else if(action==='listLeads') output={leads:listLeads_(user)};
    else if(action==='listUsers'){requireRole_(user,['SUPER_ADMIN','ADMIN']);output={users:listUsers_(user)};}
    else if(action==='saveLead') output={lead:saveLead_(user,p.lead)};
    else if(action==='deleteLead') output={deleted:deleteLead_(user,p.id)};
    else if(action==='saveUser') output={user:saveUser_(user,p.user)};
    else throw Error('Unsupported action');
    return json_(Object.assign({ok:true},output));
  }catch(err){return json_({ok:false,error:String(err.message||err)});}
}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
function prop_(name){const v=PropertiesService.getScriptProperties().getProperty(name);if(!v)throw Error('Server setting missing: '+name);return v;}
function verify_(token){
  if(!token || typeof token!=='string'||token.length>6000)throw Error('Authentication required');
  // Google's tokeninfo endpoint verifies the ID token signature and validity. Never trust browser claims.
  const url='https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(token);
  const response=UrlFetchApp.fetch(url,{muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw Error('Invalid Google sign-in');
  const info=JSON.parse(response.getContentText());
  if(info.aud!==prop_('NCCB_GOOGLE_CLIENT_ID'))throw Error('Invalid application audience');
  if(info.iss!=='accounts.google.com'&&info.iss!=='https://accounts.google.com')throw Error('Invalid token issuer');
  if(info.email_verified!==true&&info.email_verified!=='true')throw Error('Email not verified');
  if(Number(info.exp)*1000<=Date.now())throw Error('Expired sign-in');
  const email=String(info.email||'').toLowerCase();
  const owner=prop_('NCCB_SUPER_ADMIN_EMAIL').toLowerCase();
  if(email===owner)return {email:email,role:'SUPER_ADMIN'};
  const row=rows_('Users').find(x=>String(x.email||'').toLowerCase()===email&&String(x.active||'').toLowerCase()==='true');
  if(!row||!['ADMIN','REPRESENTATIVE'].includes(String(row.role)))throw Error('Account not authorized');
  return {email:email,role:String(row.role)};
}
function requireRole_(user,allowed){if(!allowed.includes(user.role))throw Error('Permission denied');}
function rows_(tab){
  const sheet=SpreadsheetApp.openById(prop_('NCCB_SHEET_ID')).getSheetByName(tab);
  if(!sheet)throw Error('Missing backend tab: '+tab);
  const values=sheet.getDataRange().getDisplayValues();
  if(values.length<2)return [];
  const headings=values[0].map(x=>String(x).trim());
  return values.slice(1).filter(row=>row.some(Boolean)).map(row=>Object.fromEntries(headings.map((key,i)=>[key,row[i]||''])));
}
function listLeads_(user){
  const records=rows_('Leads');
  const visible=user.role==='REPRESENTATIVE'?records.filter(x=>String(x.assignedTo||'').toLowerCase()===user.email):records;
  return visible.map(x=>({id:x.id,name:x.name,company:x.company,status:x.status,assignedTo:x.assignedTo,followUp:x.followUp}));
}
function listUsers_(user){
  const users=rows_('Users').map(x=>({email:x.email,role:x.role,active:x.active}));
  // Admins may view the user roster; only Super Admin should be permitted to edit roles in future endpoints.
  return users;
}
function sheet_(tab){
  const sh=SpreadsheetApp.openById(prop_('NCCB_SHEET_ID')).getSheetByName(tab);
  if(!sh)throw Error('Missing backend tab: '+tab);
  return sh;
}
function audit_(actor,action,detail){
  const sh=sheet_('AuditLog');
  sh.appendRow([new Date().toISOString(),actor.email,actor.role,action,JSON.stringify(detail)]);
}
function validateText_(value,max,label){
  const s=String(value===undefined?'':value).trim();
  if(s.length>max)throw Error(label+' is too long');
  if(/^[=+@\-]/.test(s))throw Error(label+' begins with an unsafe spreadsheet formula prefix');
  return s;
}
function saveLead_(actor,lead){
  if(!lead||typeof lead!=='object')throw Error('Missing lead');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const sh=sheet_('Leads'),data=sh.getDataRange().getDisplayValues(),heads=data[0];
    const required=['id','name','company','status','assignedTo','followUp'];
    if(required.some(x=>!heads.includes(x)))throw Error('Lead headers mismatch');
    const id=validateText_(lead.id||'',100,'Lead ID');
    const index=id?data.findIndex((r,i)=>i>0&&r[heads.indexOf('id')]===id):-1;
    const existing=index>0?Object.fromEntries(heads.map((h,j)=>[h,data[index][j]])):null;
    if(actor.role==='REPRESENTATIVE'&&(!existing||existing.assignedTo.toLowerCase()!==actor.email))throw Error('Only assigned leads may be edited');
    const next={
      id:existing?existing.id:Utilities.getUuid(),
      name:validateText_(lead.name,200,'Lead name'),
      company:validateText_(lead.company,200,'Company'),
      status:validateText_(lead.status,40,'Status'),
      assignedTo:actor.role==='REPRESENTATIVE'?actor.email:validateText_(lead.assignedTo,200,'Assigned representative').toLowerCase(),
      followUp:validateText_(lead.followUp,40,'Follow-up')
    };
    if(!next.name)throw Error('Lead name required');
    if(!['New','Contacted','Follow-up','Qualified','Closed'].includes(next.status))throw Error('Invalid lead status');
    if(actor.role==='REPRESENTATIVE'&&existing&&next.assignedTo!==existing.assignedTo.toLowerCase())throw Error('Cannot reassign lead');
    const row=heads.map(h=>Object.prototype.hasOwnProperty.call(next,h)?next[h]:(existing?existing[h]:''));
    if(index>0)sh.getRange(index+1,1,1,heads.length).setValues([row]);else sh.appendRow(row);
    audit_(actor,existing?'lead_updated':'lead_created',{id:next.id});
    return next;
  }finally{lock.releaseLock();}
}
function deleteLead_(actor,id){
  requireRole_(actor,['SUPER_ADMIN','ADMIN']);
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const sh=sheet_('Leads'),data=sh.getDataRange().getDisplayValues(),column=data[0].indexOf('id');
    if(column<0)throw Error('Missing lead ID column');
    const i=data.findIndex((r,j)=>j>0&&r[column]===String(id));
    if(i<1)throw Error('Lead not found');
    sh.deleteRow(i+1);
    audit_(actor,'lead_deleted',{id:String(id)});
    return true;
  }finally{lock.releaseLock();}
}
function saveUser_(actor,entry){
  requireRole_(actor,['SUPER_ADMIN']);
  if(!entry||typeof entry!=='object')throw Error('Missing user');
  const email=validateText_(entry.email,200,'Email').toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Invalid email');
  const role=String(entry.role);
  if(!['ADMIN','REPRESENTATIVE'].includes(role))throw Error('Invalid role');
  if(email===prop_('NCCB_SUPER_ADMIN_EMAIL').toLowerCase())throw Error('Super Admin role is controlled by server settings');
  const active=entry.active===true||entry.active==='true'?'true':'false';
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const sh=sheet_('Users'),data=sh.getDataRange().getDisplayValues(),heads=data[0];
    if(['email','role','active'].some(x=>!heads.includes(x)))throw Error('User headers mismatch');
    const i=data.findIndex((r,j)=>j>0&&r[heads.indexOf('email')].toLowerCase()===email);
    const obj={email,role,active};
    const row=heads.map(h=>obj[h]||'');
    if(i>0)sh.getRange(i+1,1,1,heads.length).setValues([row]);else sh.appendRow(row);
    audit_(actor,'user_saved',{email,role,active});
    return obj;
  }finally{lock.releaseLock();}
}
