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