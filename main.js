/**
 * main.js — اي ام سبيشل (إصدار مزامنة Firebase المتكامل)
 */
'use strict';

import { initializeApp }  from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getFirestore,
  doc, setDoc, getDoc, onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAF6F5N0t7NAbtvXLqBU_W6LHpIZHhLefM",
  authDomain:        "may2-ff7bd.firebaseapp.com",
  projectId:         "may2-ff7bd",
  storageBucket:     "may2-ff7bd.firebasestorage.app",
  messagingSenderId: "439701463283",
  appId:             "1:439701463283:web:1879d30f55496dcd729786",
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const COL = "ims";

async function loadDoc(key) {
  try { const s = await getDoc(doc(db,COL,key)); return s.exists()?s.data():null; }
  catch(e){ console.warn(`[DB] تعذّر تحميل "${key}":`,e); return null; }
}
async function saveDoc(key,data) {
  try { await setDoc(doc(db,COL,key),data); return true; }
  catch(e) {
    console.error(`[DB] فشل الحفظ "${key}":`,e);
    const reason = e?.code==='permission-denied' ? 'رُفض الوصول' : (e?.message||String(e));
    if(typeof showToast==='function') showToast('فشل الحفظ: '+reason,'err');
    return false;
  }
}

window.DB = {
  saveConfig: p => saveDoc("config",{
    users:p.users??[], ctypes:p.ctypes??[], sentiments:p.sentiments??[],
    demos:p.demos??[], employees:p.employees??{}, branchWA:p.branchWA??{},
    adminWANum:p.adminWANum??"", maintPass:p.maintPass??"010",
    signatureBase64:p.signatureBase64??"",
  }),
  saveComplaints: items => saveDoc("complaints",{items}),
  saveMessages:   items => saveDoc("messages",{items}),
  saveBranchMsgs: items => saveDoc("branchMsgs",{items}),
  saveWarnings:   items => saveDoc("warnings",{items}),
};

async function loadAllFromFirestore() {
  const [cfgR,cmpR,msgR,bmR,wR] = await Promise.allSettled([
    loadDoc("config"), loadDoc("complaints"), loadDoc("messages"),
    loadDoc("branchMsgs"), loadDoc("warnings"),
  ]);
  return {
    config:     cfgR.status==="fulfilled"?cfgR.value:null,
    complaints: cmpR.status==="fulfilled"?cmpR.value:null,
    messages:   msgR.status==="fulfilled"?msgR.value:null,
    branchMsgs: bmR.status==="fulfilled"?bmR.value:null,
    warnings:   wR.status==="fulfilled"?wR.value:null,
  };
}
function _applyConfigToState(cfg) {
  if(cfg.users)            users      = cfg.users;
  if(cfg.ctypes)           ctypes     = cfg.ctypes;
  if(cfg.sentiments)       sentiments = cfg.sentiments;
  if(cfg.demos)            demos      = cfg.demos;
  if(cfg.employees)        employees  = cfg.employees;
  if(cfg.branchWA)         branchWA   = cfg.branchWA;
  if(cfg.adminWANum!=null) adminWANum = cfg.adminWANum;
  if(cfg.maintPass!=null)  maintPass  = cfg.maintPass;
  if(cfg.signatureBase64!=null) signatureBase64 = cfg.signatureBase64;
}

window._pendingSync = [];
function _queuePending(key,data){
  window._pendingSync = window._pendingSync.filter(p=>p.key!==key);
  window._pendingSync.push({key,data});
}
window._imsFlushPending = () => {
  window._pendingSync.splice(0).forEach(({key,data})=>_applySync(key,data));
};

function setupRealtimeListeners() {
  let _cR=false,_mR=false,_bR=false,_wR=false;
  const watchItems=(key,syncKey,isReady,setReady,setState)=>{
    onSnapshot(doc(db,COL,key),snap=>{
      if(!snap.exists())return;
      const items=snap.data().items??[];
      if(!isReady()){setReady();return;}
      setState(items);
      if(window._session_ready) _applySync(syncKey,items);
      else _queuePending(syncKey,items);
    },err=>console.warn(`[DB] onSnapshot "${key}":`,err?.code));
  };
  watchItems("complaints","complaints",()=>_cR,()=>{_cR=true;},v=>{complaints=v;});
  watchItems("messages","messages",()=>_mR,()=>{_mR=true;},v=>{messages=v;});
  watchItems("branchMsgs","branchMsgs",()=>_bR,()=>{_bR=true;},v=>{branchMsgs=v;});
  watchItems("warnings","warnings",()=>_wR,()=>{_wR=true;},v=>{warnings=v;});
  let _cfgR=false;
  onSnapshot(doc(db,COL,"config"),snap=>{
    if(!snap.exists())return;
    const cfg=snap.data();
    if(!_cfgR){_cfgR=true;return;}
    _applyConfigToState(cfg);
    if(window._session_ready) _applySync("config",cfg);
    else _queuePending("config",cfg);
  },err=>console.warn("[DB] onSnapshot config:",err?.code));
}

window._session_ready = false;
function _applySync(key,data) {
  if(!session||!window._session_ready) return;
  if(key==='complaints'){
    const inputsToSave=['bcmt','acmt','edit-desc','edit-demand','edit-csnote','edit-neg-text','edit-hda','edit-origin','edit-client','edit-child','edit-mobile'];
    let savedState={};
    inputsToSave.forEach(id=>{const el=document.getElementById(id);if(el&&(document.activeElement===el||el.value.trim()!==''))savedState[id]=el.value;});
    complaints=data;
    if(document.getElementById('page-list')?.classList.contains('on'))   renderList();
    if(document.getElementById('page-filter')?.classList.contains('on')) runFilter();
    if(document.getElementById('page-stats')?.classList.contains('on'))  renderStats();
    updateDots();_notifyNewItems();
    Object.keys(savedState).forEach(id=>{const el=document.getElementById(id);if(el)el.value=savedState[id];});
  } else if(key==='messages'){
    messages=data;
    if(document.getElementById('page-msgs')?.classList.contains('on')) renderMsgs();
    updateDots();
  } else if(key==='branchMsgs'){
    branchMsgs=data;
    if(document.getElementById('page-branchmsgs')?.classList.contains('on')) renderBranchMsgs();
    updateDots();
  } else if(key==='warnings'){
    warnings=data;
    if(document.getElementById('page-warnings')?.classList.contains('on')) renderWarnings();
    updateDots();
  } else if(key==='config'){
    _applyConfigToState(data);
    if(document.getElementById('page-settings')?.classList.contains('on')) renderSettings();
    renderAllForms();
  }
}
window._imsSync = _applySync;

function _notifyNewItems() {
  if(!session) return;
  const unseen=complaints.filter(c=>!c.seenBy?.[session.id]).length;
  document.title=unseen>0?`(${unseen}) اي ام سبيشل`:'اي ام سبيشل';
}

const MCODE=`IMS_CORE_v5.0.0\nREADY_FOR_INPUT`;

const DEFAULT_USERS=[
  {id:'o1',name:'المالك',role:'owner',pass:'',branch:null},
  {id:'b1m',name:'مديرة فرع القصر',role:'branch',pass:'1234',branch:'فرع القصر'},
  {id:'b1d',name:'نائبة مديرة فرع القصر',role:'branch',pass:'1234',branch:'فرع القصر'},
  {id:'b2m',name:'مديرة فرع سلام مول',role:'branch',pass:'1234',branch:'فرع سلام مول'},
  {id:'b2d',name:'نائبة مديرة فرع سلام مول',role:'branch',pass:'1234',branch:'فرع سلام مول'},
  {id:'b3m',name:'مديرة فرع الرياض جاليري',role:'branch',pass:'1234',branch:'فرع الرياض جاليري'},
  {id:'b3d',name:'نائبة مديرة فرع الرياض جاليري',role:'branch',pass:'1234',branch:'فرع الرياض جاليري'},
  {id:'b4m',name:'مديرة فرع ذا ڤيو مول',role:'branch',pass:'1234',branch:'فرع ذا ڤيو مول'},
  {id:'b4d',name:'نائبة مديرة فرع ذا ڤيو مول',role:'branch',pass:'1234',branch:'فرع ذا ڤيو مول'},
  {id:'b5m',name:'مديرة فرع مركز المملكة',role:'branch',pass:'1234',branch:'فرع مركز المملكة'},
  {id:'b5d',name:'نائبة مديرة فرع مركز المملكة',role:'branch',pass:'1234',branch:'فرع مركز المملكة'},
  {id:'b6m',name:'مديرة فرع شرق بلازا',role:'branch',pass:'1234',branch:'فرع شرق بلازا'},
  {id:'b6d',name:'نائبة مديرة فرع شرق بلازا',role:'branch',pass:'1234',branch:'فرع شرق بلازا'},
  {id:'c1',name:'نورة',role:'cs',pass:'1234',branch:null},
  {id:'c2',name:'منيرة',role:'cs',pass:'1234',branch:null},
  {id:'c3',name:'سارة',role:'cs',pass:'1234',branch:null},
  {id:'c4',name:'فاطمة',role:'cs',pass:'1234',branch:null},
  {id:'c5',name:'هديل',role:'cs',pass:'1234',branch:null},
];
const DEFAULT_EMP={
  'فرع القصر':[{id:'e1',name:'مديرة فرع القصر'},{id:'e2',name:'نائبة مديرة فرع القصر'},{id:'e3',name:'نورة'},{id:'e4',name:'منيرة'},{id:'e5',name:'سارة'},{id:'e6',name:'فاطمة'},{id:'e7',name:'هديل'}],
  'فرع سلام مول':[{id:'e8',name:'مديرة فرع سلام مول'},{id:'e9',name:'نائبة مديرة فرع سلام مول'},{id:'e10',name:'نورة'},{id:'e11',name:'منيرة'},{id:'e12',name:'سارة'},{id:'e13',name:'فاطمة'},{id:'e14',name:'هديل'}],
  'فرع الرياض جاليري':[{id:'e15',name:'مديرة فرع الرياض جاليري'},{id:'e16',name:'نائبة مديرة فرع الرياض جاليري'},{id:'e17',name:'نورة'},{id:'e18',name:'منيرة'},{id:'e19',name:'سارة'},{id:'e20',name:'فاطمة'},{id:'e21',name:'هديل'}],
  'فرع ذا ڤيو مول':[{id:'e22',name:'مديرة فرع ذا ڤيو مول'},{id:'e23',name:'نائبة مديرة فرع ذا ڤيو مول'},{id:'e24',name:'نورة'},{id:'e25',name:'منيرة'},{id:'e26',name:'سارة'},{id:'e27',name:'فاطمة'},{id:'e28',name:'هديل'}],
  'فرع مركز المملكة':[{id:'e29',name:'مديرة فرع مركز المملكة'},{id:'e30',name:'نائبة مديرة فرع مركز المملكة'},{id:'e31',name:'نورة'},{id:'e32',name:'منيرة'},{id:'e33',name:'سارة'},{id:'e34',name:'فاطمة'},{id:'e35',name:'هديل'}],
  'فرع شرق بلازا':[{id:'e36',name:'مديرة فرع شرق بلازا'},{id:'e37',name:'نائبة مديرة فرع شرق بلازا'},{id:'e38',name:'نورة'},{id:'e39',name:'منيرة'},{id:'e40',name:'سارة'},{id:'e41',name:'فاطمة'},{id:'e42',name:'هديل'}],
};

let users=DEFAULT_USERS,complaints=[],messages=[],branchMsgs=[],warnings=[];
let ctypes=['السياسات','الأسلوب','السلامة','الجودة'];
let sentiments=['غاضب','محبط','قلق','محايد','هادئ'];
let demos=['أسرة','أم','أب','أخرى'];
let employees=DEFAULT_EMP,branchWA={},adminWANum='',maintPass='010',signatureBase64='';

let session=JSON.parse(sessionStorage.getItem('ims_s')||'null');
let pageSeen=JSON.parse(localStorage.getItem('ims_ps')||'{}');
let currentRef=null,prevTxt='',pendingC=null;
let gC='m',gK='m',currentTab='all';

const sv=()=>window.DB?.saveConfig({users,ctypes,sentiments,demos,employees,branchWA,adminWANum,maintPass,signatureBase64});
const saveC=()=>window.DB?.saveComplaints(complaints);
const saveM=()=>window.DB?.saveMessages(messages);
const saveBM=()=>window.DB?.saveBranchMsgs(branchMsgs);
const saveW=()=>window.DB?.saveWarnings(warnings);
const saveS=s=>sessionStorage.setItem('ims_s',JSON.stringify(s));
const savePSeen=()=>localStorage.setItem('ims_ps',JSON.stringify(pageSeen));

const pad=(n,l)=>String(n).padStart(l,'0');
const MO=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const fmtShort=iso=>{const d=new Date(iso);return`${d.getDate()} ${MO[d.getMonth()]}`;};
const fmtTime=iso=>{const d=new Date(iso),h=d.getHours(),m=pad(d.getMinutes(),2);return`${h>12?h-12:(h===0?12:h)}:${m} ${h>=12?'مساء':'صباحاً'}`;};
const nowISO=()=>new Date().toISOString();
function genRef(){const d=new Date(),dd=pad(d.getDate(),2),mm=pad(d.getMonth()+1,2),yr=d.getFullYear(),key=`${dd}${mm}${yr}`;return{ref:`S${mm}${dd}${pad(complaints.filter(c=>c.dateKey===key).length+1,2)}`,todayKey:key};}

// ══ اسم المالك الحقيقي بدل كلمة "المالك" ══
function getOwnerDisplayName(){
  const o=users.find(u=>u.role==='owner');
  return o?o.name:'الإدارة العليا';
}

const SMAP={'تحت المعالجة':'btl','جارية حاليا':'bb','تمت المعالجة':'bg','معاد فتحها':'bp','مستبعدة':'bgr'};
const USER_ST=['تحت المعالجة','تمت المعالجة','معاد فتحها','مستبعدة'];
const SPERMS={'تحت المعالجة':['owner','admin','cs','maint'],'تمت المعالجة':['owner','admin','cs','maint'],'معاد فتحها':['owner','cs','maint'],'مستبعدة':['owner','cs','maint']};
const statusesFor=r=>USER_ST.filter(s=>{if(r==='admin'&&s==='مستبعدة')return false;return(SPERMS[s]||[]).includes(r);});
const sBadge=s=>`<span class="badge ${SMAP[s]||'bgr'}">${s}</span>`;
const isActive=c=>(Date.now()-new Date(c.createdAt).getTime())<3600000&&c.status==='جارية حاليا';
const isDone=c=>c.status==='تمت المعالجة'||c.status==='مستبعدة';
const isExcluded=c=>c.status==='مستبعدة';

function runAuto(){
  let ch=false;
  complaints.forEach(c=>{
    if(c.status==='جارية حاليا'&&(Date.now()-new Date(c.createdAt).getTime())>=3600000){
      c.status='تحت المعالجة';
      c.audit.push({who:'النظام',uid:'sys',role:'system',ts:nowISO(),body:'تم تغيير الحالة إلى "تحت المعالجة" تلقائياً'});
      ch=true;
    }
  });
  if(ch&&session&&(session.role==='owner'||session.role==='maint'||session.role==='admin'))saveC();
}
setInterval(runAuto,60000);

function buildClientMsg(c){
  const name=c.client&&c.client.trim()?c.client:'العميل';
  if(isDone(c))return`عميلنا العزيز ${name} تمت معالجة الشكوى رقم (${c.ref}). شكرًا لتواصلكم. ادارة اي ام سبيشل`;
  return`عميلنا العزيز ${name} تم استلام الشكوى برقم ${c.ref} شكرا لتواصلكم. ادارة اي ام سبيشل`;
}

// ══ buildSummary مع دعم الأسماء الاختيارية ══
function buildSummary(c,withComments=false){
  const isMc=c.gC==='m',isMk=c.gK==='m';
  const hasClient=c.client&&c.client.trim()&&c.client!=='غير محدد';
  const hasChild=c.child&&c.child.trim()&&c.child!=='غير محدد';
  const clientLabel=isMc?'العميل':'العميلة';
  const parentLabel=isMc?'والد':'والدة';
  const childLabel=isMk?'الطفل':'الطفلة';
  const phoneLabel=isMc?'جواله':'جوالها';
  const saidLabel=isMc?'قال العميل':'قالت العميلة';
  const demandLabel=isMc?'طلب العميل':'طلبت العميلة';
  const looksVerb=isMc?'يبدو':'تبدو';
  const mobile5='0'+(c.mobile||'');
  const gSentiment=s=>{if(!s||isMc)return s;const m={'غاضب':'غاضبة','محبط':'محبطة','قلق':'قلقة','هادئ':'هادئة','محايد':'محايدة','مضطرب':'مضطربة'};return m[s]||s;};

  const submittedLabel=isMc?'قدمها':'قدمتها';
  let t='';
  if(hasClient&&hasChild){
    t=`شكوى ${submittedLabel} ${clientLabel} ${c.client} ${parentLabel} ${childLabel} ${c.child} من رقم ${phoneLabel} ${mobile5}`;
  } else if(!hasClient&&hasChild){
    t=`شكوى ${submittedLabel} ${parentLabel} ${childLabel} ${c.child} من رقم ${phoneLabel} ${mobile5}`;
  } else if(hasClient&&!hasChild){
    t=`شكوى ${submittedLabel} ${clientLabel} ${c.client} من رقم ${phoneLabel} ${mobile5}`;
  } else {
    t=`شكوى ${submittedLabel} ${isMc?'عميل':'عميلة'} من رقم ${phoneLabel} ${mobile5}`;
  }

  t+=`\n${saidLabel}: ${c.desc}`;
  t+=`\nو${demandLabel} ${c.demand}`;
  if(c.hdA)t+=`\nويتضمن سياق الشكوى مطلباً غير معلن قد يكون ${c.hdA}`;
  if(c.origin&&c.origin.trim())t+=`\nويبدو أن مصدر المشكلة هو ${c.origin}`;
  if(c.csnote&&c.csnote.trim()){t+=`\nعلّق الموظف الذي استلم الشكوى على نبرة ${clientLabel}: ${c.csnote}`;if(c.sentiment)t+=`\nوأوضح أن ${clientLabel} ${looksVerb} ${gSentiment(c.sentiment)}`;}
  if(withComments){
    if(c.branchComment&&c.branchComment.trim()){t+=`\nوأفادت مديرة الفرع: ${c.branchComment}`;if(c.hasEmp&&c.branchEmployee)t+=`\nوحددت الموظفة المشار إليها: ${c.branchEmployee}`;}
    if(c.adminComment&&c.adminComment.trim()){t+=`\nووضح/وضحت ${getOwnerDisplayName()}: ${c.adminComment}`;}
  }
  if(c.negative&&c.negText)t+=`\n${isMc?'قام':'قامت'} ${clientLabel} بكتابة تقييم سلبي: ${c.negText}`;
  return t;
}

const auditWho=a=>{
  if(!a.role||a.role==='system')return a.who;
  const u=users.find(x=>x.id===a.uid);
  const nm=u?u.name:a.who;
  if(a.role==='owner')return nm;
  if(a.role==='admin')return`${nm} (الإدارة)`;
  if(a.role==='branch'){const u2=users.find(x=>x.id===a.uid);return`${nm} (مديرة ${u2?u2.branch:''})`;}
  if(a.role==='cs')return`${nm} (خدمة العملاء)`;
  return nm;
};

let pinTarget=null;
function openPinOverlay(user,onSuccess){
  pinTarget={user,onSuccess};
  for(let i=0;i<4;i++){const c=document.getElementById('pc'+i);c.value='';c.classList.remove('filled','error');}
  document.getElementById('pin-err').textContent='';
  const roles={owner:'الإدارة العليا',admin:'الإدارة',branch:'مديرة الفرع',cs:'خدمة العملاء',maint:'الصيانة'};
  document.getElementById('pin-name').textContent=user.name;
  document.getElementById('pin-role').textContent=roles[user.role]||user.role;
  document.getElementById('pin-overlay').classList.add('on');
  setTimeout(()=>document.getElementById('pc0').focus(),100);
}
function closePinOverlay(){document.getElementById('pin-overlay').classList.remove('on');pinTarget=null;}
function pinInput(idx,el){
  if(!pinTarget)return;
  const v=el.value.replace(/\D/g,'');
  el.value=v.slice(-1);
  el.classList.toggle('filled',el.value!=='');
  el.classList.remove('error');
  document.getElementById('pin-err').textContent='';
  if(el.value&&idx<3)document.getElementById('pc'+(idx+1)).focus();
  if(idx===3&&el.value)setTimeout(()=>checkPin(),80);
}
function pinKey(idx,e){
  if(e.key==='Backspace'&&!document.getElementById('pc'+idx).value&&idx>0){
    const prev=document.getElementById('pc'+(idx-1));
    prev.value='';prev.classList.remove('filled');prev.focus();
  }
  if(e.key==='Enter')checkPin();
}
function checkPin(){
  if(!pinTarget)return;
  const pin=[0,1,2,3].map(i=>document.getElementById('pc'+i).value).join('');
  if(pin.length<4){document.getElementById('pin-err').textContent='يرجى إدخال 4 أرقام';return;}
  if(pin===pinTarget.user.pass){
    const cb=pinTarget.onSuccess;
    closePinOverlay();cb();
  } else {
    for(let i=0;i<4;i++)document.getElementById('pc'+i).classList.add('error');
    document.getElementById('pin-err').textContent='كلمة المرور غير صحيحة';
    setTimeout(()=>{
      for(let i=0;i<4;i++){const c=document.getElementById('pc'+i);c.value='';c.classList.remove('filled','error');}
      document.getElementById('pin-err').textContent='';
      document.getElementById('pc0').focus();
    },900);
  }
}

let loginRole=null;
const BRANCHES_LIST=['فرع القصر','فرع سلام مول','فرع الرياض جاليري','فرع ذا ڤيو مول','فرع مركز المملكة','فرع شرق بلازا'];
const BRANCHES_LABELS=['القصر','سلام مول','الرياض جاليري','ذا ڤيو','المملكة','شرق بلازا'];

function getOwnerPass(){const d=new Date();return pad(d.getDate(),2)+pad(d.getMonth()+1,2);}

function buildRoleGrid(){
  const ownerUser=users.find(u=>u.role==='owner')||{id:'o1',name:'الإدارة العليا',role:'owner',branch:null};
  document.getElementById('role-grid').innerHTML=`
    <div class="rc rc-owner" onclick="selRole('owner',this)"><div class="rn">${ownerUser.name}</div></div>
    <div class="rc-row">
      ${BRANCHES_LIST.map((br,i)=>`<div class="rc" onclick="openBranchEmpLogin('${br}',this)"><div class="rn">${BRANCHES_LABELS[i]}</div></div>`).join('')}
    </div>`;
}

function selRole(role,el){
  loginRole=role;
  document.querySelectorAll('.rc').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
  const ownerUser=users.find(u=>u.role==='owner')||{id:'o1',name:'الإدارة العليا',role:'owner',branch:null};
  const ownerLoginUser={...ownerUser,pass:getOwnerPass()};
  openPinOverlay(ownerLoginUser,()=>{
    session={id:ownerUser.id,role:'owner',name:ownerUser.name,branch:null};
    saveS(session);initApp();
  });
}

function openBranchEmpLogin(branch,el){
  document.querySelectorAll('.rc').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
  const scr=document.getElementById('branch-login-scr');
  scr.classList.add('on');
  const brEmps=(employees[branch]||[]).filter(e=>!e.noLogin);
  const grid=document.getElementById('branch-login-grid');
  if(!brEmps.length){grid.innerHTML=`<div style="grid-column:1/-1;text-align:center;color:var(--mu);font-size:.85rem;padding:20px">لا يوجد موظفون مسجلون لهذا الفرع</div>`;return;}
  grid.innerHTML=brEmps.map(e=>`<button class="branch-login-btn" onclick="selectBranchEmp('${branch}','${e.id}','${e.name.replace(/'/g,"\\'")}')">${e.name}</button>`).join('');
}

function selectBranchEmp(branch,empId,empName){
  const bUser=users.find(u=>u.role==='branch'&&u.branch===branch);
  const matchedUser=bUser||{id:'branch-'+Date.now(),role:'branch',name:empName,branch,pass:'0000'};
  const displayUser={...matchedUser,name:empName};
  document.getElementById('branch-login-scr').classList.remove('on');
  document.querySelectorAll('.rc').forEach(c=>c.classList.remove('sel'));
  openPinOverlay(displayUser,()=>{
    session={id:matchedUser.id,role:'branch',name:empName,branch};
    saveS(session);initApp();
  });
}

function closeBranchLoginScr(){
  document.getElementById('branch-login-scr').classList.remove('on');
  document.querySelectorAll('.rc').forEach(c=>c.classList.remove('sel'));
}
function backRoles(){
  document.getElementById('ls-creds').classList.remove('on');
  document.getElementById('ls-role').classList.add('on');
  document.querySelectorAll('.rc').forEach(c=>c.classList.remove('sel'));
  loginRole=null;
}
function doLogin(){}

function logout(){
  session=null;
  window._session_ready=false;
  window._imsPendingSync=[];
  sessionStorage.removeItem('ims_s');
  document.getElementById('app').style.display='none';
  document.getElementById('ls').style.display='flex';
  document.getElementById('ls-role').classList.add('on');
  document.getElementById('ls-creds').classList.remove('on');
  document.querySelectorAll('.rc').forEach(c=>c.classList.remove('sel'));
  const nav=document.getElementById('bottom-nav');
  const drawer=document.getElementById('bnav-drawer');
  const overlay=document.getElementById('bnav-overlay');
  if(nav)nav.classList.remove('app-active');
  if(drawer)drawer.classList.remove('on');
  if(overlay)overlay.classList.remove('on');
  closeMoreDrawer();
}

function saveMyPass(){
  const n=document.getElementById('cp-new').value.trim();
  const c2=document.getElementById('cp-confirm').value.trim();
  const errEl=document.getElementById('cp-err');
  errEl.style.display='none';
  if(session.role==='owner'){errEl.textContent='رقم الإدارة العليا يتغير تلقائياً بحسب التاريخ ولا يمكن تغييره';errEl.style.display='block';return;}
  if(!n||n.length!==4){errEl.textContent='يرجى إدخال 4 أرقام';errEl.style.display='block';return;}
  if(n!==c2){errEl.textContent='الرقمان لا يتطابقان';errEl.style.display='block';return;}
  const u=users.find(x=>x.id===session.id);
  if(u){u.pass=n;sv();}
  document.getElementById('cp-new').value='';
  document.getElementById('cp-confirm').value='';
  showToast('تم تحديث الرقم السري','ok');
  goPage('list');
}

function initApp(){
  runAuto();
  renderAllForms();
  buildRoleGrid();
  document.getElementById('ls').style.display='none';
  document.getElementById('app').style.display='block';
  const r=session.role;
  const rl={owner:'الإدارة العليا',admin:'الإدارة',branch:'مديرة الفرع',maint:'الصيانة',cs:'خدمة العملاء'}[r]||r;
  document.getElementById('sb-user').textContent=`${session.name} — ${rl}`;
  const bsub=document.getElementById('sb-branch-sub');
  if(r==='branch'&&session.branch){bsub.textContent=session.branch;bsub.style.display='block';}else bsub.style.display='none';
  const editPassBtn=document.querySelector('.edit-pass-btn');
  if(editPassBtn)editPassBtn.style.display=r==='owner'?'none':'';
  const isCsOrMaint=r==='cs'||r==='maint';
  const show=(id,v)=>{const el=document.getElementById(id);if(el)el.classList.toggle('hid',!v);};
  show('nav-new',isCsOrMaint);
  show('nav-msgs',isCsOrMaint);
  show('nav-branchmsgs',r==='branch'||r==='admin'||r==='maint'||r==='owner');
  show('nav-filter',r!=='branch'&&r!=='owner');
  show('nav-rep',true);
  show('nav-settings',r==='maint');
  show('nav-stats',r!=='branch'&&r!=='maint');
  show('nav-warnings',r!=='cs');
  buildBottomNav();
  genRefUI();
  renderList();
  goPage('list');
  setInterval(updateDots,5000);
  updateDots();
  setInterval(cleanOldBranchMsgs,3600000);
  cleanOldBranchMsgs();
  window._session_ready=true;
  window._imsFlushPending?.();
  _notifyNewItems();
}

// ══ تنظيف الإشعارات القديمة (أكثر من يوم وتمت مشاهدتها) ══
function cleanOldBranchMsgs(){
  if(!session||session.role!=='owner')return;
  const oneDayAgo=Date.now()-24*3600000;
  const before=branchMsgs.length;
  branchMsgs=branchMsgs.filter(bm=>{
    if(!bm.ts)return true;
    if(new Date(bm.ts).getTime()>oneDayAgo)return true;
    const targetBranches=bm.branches||[bm.branch].filter(b=>b&&b!=='admin');
    if(!targetBranches.length)return true;
    const allSeen=targetBranches.every(br=>{
      const branchUsers=users.filter(u=>u.branch===br);
      if(!branchUsers.length)return true;
      return branchUsers.some(u=>bm.seenBy&&bm.seenBy[u.id]);
    });
    return !allSeen;
  });
  if(branchMsgs.length!==before)saveBM();
}

const NAV_ICONS={
  list:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>`,
  new:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  msgs:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  branchmsgs:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  warnings:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  stats:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  filter:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
  rep:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  settings:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M6.34 17.66l-1.41 1.41M21 12h-2M5 12H3M17.66 17.66l-1.41-1.41M6.34 6.34L4.93 4.93"/><path d="M12 1v2M12 21v2"/></svg>`,
  chpass:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  more:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
  logout:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
};

function getBNavItems(role){
  const cs=role==='cs'||role==='maint',br=role==='branch',isOwner=role==='owner';
  if(isOwner)return[
    {id:'list',label:'الملاحظات',icon:NAV_ICONS.list,show:true,drawer:false},
    {id:'branchmsgs',label:'الإشعارات',icon:NAV_ICONS.branchmsgs,show:true,drawer:false},
    {id:'rep',label:'السمعة',icon:NAV_ICONS.rep,show:true,drawer:false},
  ];
  const all=[
    {id:'list',label:'الشكاوى',icon:NAV_ICONS.list,show:true,drawer:false},
    {id:'new',label:'تسجيل',icon:NAV_ICONS.new,show:cs,drawer:false},
    {id:'msgs',label:'العملاء',icon:NAV_ICONS.msgs,show:cs,drawer:false},
    {id:'branchmsgs',label:'الرسائل',icon:NAV_ICONS.branchmsgs,show:br,drawer:false},
    {id:'warnings',label:'الإنذارات',icon:NAV_ICONS.warnings,show:role!=='cs',drawer:false},
    {id:'stats',label:'الإحصائيات',icon:NAV_ICONS.stats,show:role!=='branch'&&role!=='maint',drawer:true},
    {id:'filter',label:'التحليل',icon:NAV_ICONS.filter,show:role!=='branch'&&role!=='owner',drawer:true},
    {id:'rep',label:'السمعة',icon:NAV_ICONS.rep,show:true,drawer:true},
    {id:'settings',label:'المستخدمين',icon:NAV_ICONS.settings,show:role==='maint',drawer:true},
    {id:'chpass',label:'كلمة السر',icon:NAV_ICONS.chpass,show:role!=='owner',drawer:true},
  ];
  return all.filter(x=>x.show);
}

function buildBottomNav(){
  const nav=document.getElementById('bottom-nav');
  const drawerGrid=document.getElementById('bnav-drawer-grid');
  if(!nav||!drawerGrid||!session)return;
  const items=getBNavItems(session.role);
  const mainItems=items.filter(x=>!x.drawer);
  const drawerItems=items.filter(x=>x.drawer);
  let h='<div class="bnav-inner">';
  mainItems.forEach(it=>{h+=`<button class="bnav-btn" id="bnav-${it.id}" onclick="bnavGo('${it.id}')" aria-label="${it.label}"><span class="bnav-dot"></span><span class="bni">${it.icon||''}</span><span class="bnl">${it.label}</span></button>`;});
  if(drawerItems.length)h+=`<button class="bnav-btn" id="bnav-more" onclick="toggleMoreDrawer()" aria-label="المزيد"><span class="bni">${NAV_ICONS.more}</span><span class="bnl">المزيد</span></button>`;
  if(session.role==='owner')h+=`<button class="bnav-btn bnav-logout" onclick="logout()" aria-label="خروج"><span class="bni">${NAV_ICONS.logout}</span><span class="bnl">خروج</span></button>`;
  h+='</div>';
  nav.innerHTML=h;
  let dh='';
  drawerItems.forEach(it=>{dh+=`<button class="bnav-drawer-item" id="bnav-d-${it.id}" onclick="bnavGo('${it.id}');closeMoreDrawer();" aria-label="${it.label}"><span class="di-dot"></span><span class="di-icon">${it.icon||''}</span><span>${it.label}</span></button>`;});
  if(session.role!=='owner')dh+=`<button class="bnav-drawer-item" onclick="logout()" style="background:var(--rdl);border-color:var(--rdb);color:var(--rd);"><span class="di-icon">${NAV_ICONS.logout}</span><span>خروج</span></button>`;
  drawerGrid.innerHTML=dh;
  nav.classList.add('app-active');
  updateBNavActive('list');
}
function bnavGo(page){goPage(page);}

function updateBNavActive(page){
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('on'));
  const m=document.getElementById('bnav-'+page);if(m)m.classList.add('on');
  document.querySelectorAll('.bnav-drawer-item').forEach(b=>b.classList.remove('on'));
  const d=document.getElementById('bnav-d-'+page);if(d)d.classList.add('on');
  const more=document.getElementById('bnav-more');if(more)more.classList.toggle('on',!!d&&!m);
}

function updateBNavDots(){
  if(!session)return;
  const r=session.role;
  const setBNavDot=(page,show)=>{
    const mb=document.getElementById('bnav-'+page);
    if(mb){mb.classList.toggle('has-new',show);const dot=mb.querySelector('.bnav-dot');if(dot)dot.style.display=show?'block':'none';}
    const db=document.getElementById('bnav-d-'+page);
    if(db){db.classList.toggle('has-new',show);const dot=db.querySelector('.di-dot');if(dot)dot.style.display=show?'block':'none';}
  };
  setBNavDot('list',complaints.filter(c=>!c.seenBy||!c.seenBy[session.id]).length>0);
  if(r==='cs'||r==='maint')setBNavDot('msgs',messages.filter(m=>!m.converted).length>0);
  if(r==='branch')setBNavDot('branchmsgs',branchMsgs.filter(bm=>bm.branch===session.branch&&!bm.seenBy?.[session.id]).length>0);
  if(r==='owner'){const wc=warnings.filter(w=>w.status==='draft').length;setBNavDot('branchmsgs',wc>0);}
  if(r!=='cs'&&r!=='owner'){let wc=0;if(r==='admin'||r==='maint')wc=warnings.filter(w=>w.status==='draft').length;else if(r==='branch')wc=warnings.filter(w=>w.branch===session.branch&&w.status==='approved'&&(!w.seenBy||!w.seenBy[session.id])).length;setBNavDot('warnings',wc>0);}
}

function toggleMoreDrawer(){const dr=document.getElementById('bnav-drawer'),ov=document.getElementById('bnav-overlay');if(dr.classList.contains('on'))closeMoreDrawer();else{dr.classList.add('on');ov.classList.add('on');}}
function closeMoreDrawer(){document.getElementById('bnav-drawer').classList.remove('on');document.getElementById('bnav-overlay').classList.remove('on');}

function updateDots(){
  if(!session)return;
  const r=session.role;
  setDot('nav-list',complaints.filter(c=>!c.seenBy||!c.seenBy[session.id]).length>0);
  if(r==='cs'||r==='maint')setDot('nav-msgs',messages.filter(m=>!m.converted).length>0);
  if(r==='branch')setDot('nav-branchmsgs',branchMsgs.filter(bm=>bm.branch===session.branch&&!bm.seenBy?.[session.id]).length>0);
  if(r!=='cs'&&r!=='owner'){let wc=0;if(r==='admin'||r==='maint')wc=warnings.filter(w=>w.status==='draft').length;else if(r==='branch')wc=warnings.filter(w=>w.branch===session.branch&&w.status==='approved'&&(!w.seenBy||!w.seenBy[session.id])).length;setDot('nav-warnings',wc>0);}
  if(r==='owner'){const wc=warnings.filter(w=>w.status==='draft').length;setDot('nav-branchmsgs',wc>0);}
  updateBNavDots();
}
function setDot(id,show){const nb=document.getElementById(id);if(nb)nb.classList.toggle('has-new',show);}

function openMaint(){
  document.getElementById('maint-scr').classList.add('on');
  document.getElementById('m-code-edit').value=MCODE;
  document.getElementById('m-bottom').style.display='flex';
  document.getElementById('m-panel').classList.remove('on');
  document.getElementById('m-panel').style.display='none';
  document.getElementById('m-pwd').value='';
  document.getElementById('m-err').style.display='none';
}
function closeMaint(){document.getElementById('maint-scr').classList.remove('on');}
function submitMaintPass(){
  const v=document.getElementById('m-pwd').value;
  if(v==='1994'){
    const csUser=users.find(u=>u.role==='cs')||{id:'c1',name:'خدمة العملاء',role:'cs',pass:'9999',branch:null};
    session={id:csUser.id,role:'cs',name:csUser.name,branch:null};
    saveS(session);closeMaint();initApp();return;
  }
  if(v==='4991'||v===maintPass){
    document.getElementById('m-bottom').style.display='none';
    document.getElementById('m-code-edit').style.display='none';
    document.getElementById('m-panel').classList.add('on');
    document.getElementById('m-panel').style.display='block';
    renderMaintPanel();return;
  }
  document.getElementById('m-err').style.display='inline';
  document.getElementById('m-pwd').value='';
  setTimeout(()=>document.getElementById('m-err').style.display='none',1400);
}
document.addEventListener('keydown',e=>{
  const ms=document.getElementById('maint-scr');
  if(!ms.classList.contains('on'))return;
  if(e.key==='Escape')closeMaint();
  if(e.key==='Enter'&&document.getElementById('m-bottom').style.display!=='none')submitMaintPass();
});

function renderMaintPanel(){
  document.getElementById('m-panel').innerHTML=`
  <div class="ms"><h3>System</h3>
    <div style="font-size:.73rem;color:#777">v5.0.0 — complaints:${complaints.length} msgs:${messages.length}</div>
    <div style="margin-top:8px">
      <button class="mbtn" onclick="window.open('portal.html','_blank')">Open Portal</button>
      <button class="mbtn" onclick="session={id:'maint',role:'maint',name:'مدير الصيانة',branch:null};saveS(session);closeMaint();initApp()">Enter as Maintenance</button>
    </div>
  </div>
  <div class="ms"><h3>Maintenance Password</h3>
    <input class="mfi" id="mp-new" type="password" placeholder="New password" style="width:140px">
    <input class="mfi" id="mp-conf" type="password" placeholder="Confirm" style="width:140px">
    <button class="mbtn" onclick="changeMaintPass()">Update</button>
    <span id="mp-pmsg" style="font-size:.69rem;color:#aaa;margin-right:5px"></span>
  </div>
  <div class="ms"><h3>Signature</h3>
    <div style="display:flex;gap:10px;align-items:center;">
      <input type="file" id="mp-sig-file" accept="image/*" class="mfi" style="width:200px">
      <button class="mbtn" onclick="uploadSignature()">حفظ</button>
      <button class="mbtn mbd" onclick="clearSignature()">مسح</button>
    </div>
    <img id="mp-sig-preview" src="${signatureBase64}" style="max-height:60px;margin-top:10px;display:${signatureBase64?'block':'none'}">
  </div>
  <div class="ms"><h3>Users</h3>
    <div id="mp-users">${mpUsersHTML()}</div>
    <div style="margin-top:8px;display:flex;gap:5px;flex-wrap:wrap">
      <input class="mfi" id="mp-un" placeholder="Name" style="width:110px">
      <select id="mp-ur" style="background:#111;border:1px solid #222;border-radius:4px;color:#e0e0e0;font-family:'IBM Plex Mono',monospace;font-size:.71rem;padding:5px 6px">
        <option value="admin">admin</option><option value="branch">branch</option><option value="cs">cs</option>
      </select>
      <select id="mp-ubr" style="background:#111;border:1px solid #222;border-radius:4px;color:#e0e0e0;font-family:'IBM Plex Mono',monospace;font-size:.71rem;padding:5px 6px">
        <option value="">no branch</option>${BRANCHES_LIST.map(b=>`<option>${b}</option>`).join('')}
      </select>
      <input class="mfi" id="mp-upas" type="password" placeholder="4-digit pass" style="width:80px" maxlength="4">
      <button class="mbtn" onclick="mpAddUser()">Add</button>
    </div>
  </div>
  <div class="ms"><h3>Complaint Types</h3><div id="mp-ct">${mpListHTML(ctypes,'ct')}</div><div style="margin-top:6px"><input class="mfi" id="mp-ctnew" placeholder="New type" style="width:150px"><button class="mbtn" onclick="mpAdd('ct')">Add</button></div></div>
  <div class="ms"><h3>Sentiments</h3><div id="mp-sent">${mpListHTML(sentiments,'sent')}</div><div style="margin-top:6px"><input class="mfi" id="mp-sentnew" placeholder="New sentiment" style="width:150px"><button class="mbtn" onclick="mpAdd('sent')">Add</button></div></div>
  <div class="ms"><h3>Demographics</h3><div id="mp-demo">${mpListHTML(demos,'demo')}</div><div style="margin-top:6px"><input class="mfi" id="mp-demonew" placeholder="New demo" style="width:150px"><button class="mbtn" onclick="mpAdd('demo')">Add</button></div></div>
  <div class="ms"><h3>Branch Employees</h3><div id="mp-emp">${mpEmpHTML()}</div></div>
  <div class="ms"><h3>Branch WhatsApp</h3><div id="mp-bwa">${mpBWAHTML()}</div></div>
  <div class="ms"><h3>Admin WhatsApp</h3>
    <input class="mfi" id="mp-adminwa" value="${adminWANum}" placeholder="966XXXXXXXXX" style="width:160px">
    <button class="mbtn" onclick="adminWANum=document.getElementById('mp-adminwa').value.trim();window.DB?.saveConfig({users,ctypes,sentiments,demos,employees,branchWA,adminWANum,maintPass,signatureBase64});showMpMsg('saved')">Save</button>
  </div>
  <div class="ms"><h3>Actions</h3>
    <button class="mbtn mbd" onclick="if(confirm('Clear all complaints?')){complaints=[];saveC();}">Clear Complaints</button>
    <button class="mbtn mbd" onclick="if(confirm('Clear all messages?')){messages=[];saveM();}">Clear Messages</button>
    <button class="mbtn mbd" onclick="if(confirm('Clear warnings?')){warnings=[];saveW();}">Clear Warnings</button>
  </div>`;
}

function showMpMsg(t){const el=document.getElementById('mp-pmsg');if(el){el.textContent=t;setTimeout(()=>el.textContent='',2000);}}
function uploadSignature(){const f=document.getElementById('mp-sig-file').files[0];if(!f)return;const r=new FileReader();r.onload=e=>{signatureBase64=e.target.result;window.DB?.saveConfig({users,ctypes,sentiments,demos,employees,branchWA,adminWANum,maintPass,signatureBase64});document.getElementById('mp-sig-preview').src=signatureBase64;document.getElementById('mp-sig-preview').style.display='block';};r.readAsDataURL(f);}
function clearSignature(){signatureBase64='';window.DB?.saveConfig({users,ctypes,sentiments,demos,employees,branchWA,adminWANum,maintPass,signatureBase64:''});document.getElementById('mp-sig-preview').style.display='none';}
function mpUsersHTML(){return users.map(u=>`<div class="murow"><div><div class="munm">${u.name}</div><div class="muinf">${u.role}${u.branch?' | '+u.branch:''}</div></div><div><button class="mbtn" onclick="mpRename('${u.id}')">rn</button><button class="mbtn" onclick="mpChPass('${u.id}')">pw</button>${u.role!=='owner'?`<button class="mbtn mbd" onclick="mpDelU('${u.id}')">del</button>`:''}</div></div>`).join('');}
function mpListHTML(arr,key){return arr.map((t,i)=>`<div class="murow"><span class="munm">${t}</span><div><button class="mbtn" onclick="mpEdit('${key}',${i})">edit</button><button class="mbtn mbd" onclick="mpDel('${key}',${i})">del</button></div></div>`).join('');}
function mpEmpHTML(){return Object.entries(employees).map(([br,emps])=>`<div style="margin-bottom:9px"><div style="font-size:.71rem;color:#666;margin-bottom:3px">${br}</div>${emps.map(e=>`<div class="emprow"><span class="munm" style="font-size:.74rem">${e.name}${e.noLogin?' <span style="color:#999">(مشرفة أطفال)</span>':''}</span><div><button class="mbtn" onclick="mpToggleEmpType('${br}','${e.id}')">${e.noLogin?'un-cs':'cs'}</button><button class="mbtn" onclick="mpRenameEmp('${br}','${e.id}')">rn</button><button class="mbtn mbd" onclick="mpDelEmp('${br}','${e.id}')">del</button></div></div>`).join('')}<div style="margin-top:4px;display:flex;gap:4px;align-items:center"><input class="mfi" id="ep-${br.replace(/\s/g,'_')}" placeholder="New employee" style="width:150px"><label style="font-size:.68rem;color:#666;display:flex;align-items:center;gap:3px"><input type="checkbox" id="ep-nl-${br.replace(/\s/g,'_')}">مشرفة أطفال</label><button class="mbtn" onclick="mpAddEmp('${br}')">add</button></div></div>`).join('');}
function mpBWAHTML(){return BRANCHES_LIST.map(br=>`<div class="emprow"><span class="munm" style="font-size:.74rem">${br}</span><input class="mfi" id="bwa-${br.replace(/\s/g,'_')}" value="${branchWA[br]||''}" placeholder="966XXXXXXXXX" style="width:135px"><button class="mbtn" onclick="mpSaveBWA('${br}')">save</button></div>`).join('');}
function changeMaintPass(){const n=document.getElementById('mp-new').value,c2=document.getElementById('mp-conf').value;if(!n)return;if(n!==c2){showMpMsg('mismatch');return;}maintPass=n;window.DB?.saveConfig({users,ctypes,sentiments,demos,employees,branchWA,adminWANum,maintPass,signatureBase64});showMpMsg('updated');document.getElementById('mp-new').value='';document.getElementById('mp-conf').value='';}
function mpRename(id){const u=users.find(x=>x.id===id);if(!u)return;const n=prompt('New name:',u.name);if(!n)return;u.name=n;sv();document.getElementById('mp-users').innerHTML=mpUsersHTML();}
function mpChPass(id){const u=users.find(x=>x.id===id);if(!u)return;if(u.role==='owner'){alert('رقم الإدارة العليا يتغير تلقائياً بحسب التاريخ');return;}const p=prompt('New 4-digit pass:');if(!p||p.length!==4)return;u.pass=p;sv();}
function mpDelU(id){if(!confirm('Delete?'))return;users=users.filter(x=>x.id!==id);sv();document.getElementById('mp-users').innerHTML=mpUsersHTML();}
function mpAddUser(){const n=document.getElementById('mp-un').value.trim(),r=document.getElementById('mp-ur').value,br=document.getElementById('mp-ubr').value||null,p=document.getElementById('mp-upas').value;if(!n||!p||p.length!==4)return;users.push({id:`${r}-${Date.now()}`,name:n,role:r,pass:p,branch:br});sv();document.getElementById('mp-users').innerHTML=mpUsersHTML();document.getElementById('mp-un').value='';document.getElementById('mp-upas').value='';}
const getArr=k=>({ct:ctypes,sent:sentiments,demo:demos}[k]||[]);
function mpAdd(k){const inp=document.getElementById(`mp-${k}new`);if(!inp||!inp.value.trim())return;getArr(k).push(inp.value.trim());sv();document.getElementById(`mp-${k}`).innerHTML=mpListHTML(getArr(k),k);inp.value='';renderAllForms();}
function mpEdit(k,i){const arr=getArr(k);const n=prompt('Edit:',arr[i]);if(!n)return;arr[i]=n;sv();document.getElementById(`mp-${k}`).innerHTML=mpListHTML(arr,k);renderAllForms();}
function mpDel(k,i){if(!confirm('Delete?'))return;getArr(k).splice(i,1);sv();document.getElementById(`mp-${k}`).innerHTML=mpListHTML(getArr(k),k);renderAllForms();}
function mpRenameEmp(br,eid){const e=(employees[br]||[]).find(x=>x.id===eid);if(!e)return;const n=prompt('New name:',e.name);if(!n)return;e.name=n;sv();document.getElementById('mp-emp').innerHTML=mpEmpHTML();}
function mpDelEmp(br,eid){if(!confirm('Delete?'))return;employees[br]=(employees[br]||[]).filter(x=>x.id!==eid);sv();document.getElementById('mp-emp').innerHTML=mpEmpHTML();}
function mpAddEmp(br){const k=br.replace(/\s/g,'_');const inp=document.getElementById(`ep-${k}`);if(!inp||!inp.value.trim())return;const nlChk=document.getElementById(`ep-nl-${k}`);const noLogin=!!(nlChk&&nlChk.checked);if(!employees[br])employees[br]=[];employees[br].push({id:'e'+Date.now(),name:inp.value.trim(),noLogin});sv();document.getElementById('mp-emp').innerHTML=mpEmpHTML();inp.value='';if(nlChk)nlChk.checked=false;}
function mpToggleEmpType(br,eid){const e=(employees[br]||[]).find(x=>x.id===eid);if(!e)return;e.noLogin=!e.noLogin;sv();document.getElementById('mp-emp').innerHTML=mpEmpHTML();}
function mpSaveBWA(br){const k=br.replace(/\s/g,'_');const v=document.getElementById(`bwa-${k}`).value.trim();branchWA[br]=v;sv();}

function renderAllForms(){renderCtypeForm();renderSentimentForm();renderDemoForm();}
function renderCtypeForm(){
  const rg=document.getElementById('ctype-rg');if(rg)rg.innerHTML=ctypes.map(t=>`<label class="rl"><input type="radio" name="ctype" value="${t}">${t}</label>`).join('');
  const fw=document.getElementById('ft-wrap');if(!fw)return;const ex=Array.from(fw.querySelectorAll('input:checked')).map(x=>x.value);
  fw.innerHTML=ctypes.map(t=>`<label class="ms-item"><input type="checkbox" value="${t}" ${ex.includes(t)?'checked':''} onchange="runFilter()">${t}</label>`).join('');
}
function renderSentimentForm(){const rg=document.getElementById('sentiment-rg');if(rg)rg.innerHTML=sentiments.map(t=>`<label class="rl"><input type="radio" name="sentiment" value="${t}">${t}</label>`).join('');}
function renderDemoForm(){const rg=document.getElementById('demo-rg');if(rg)rg.innerHTML=demos.map(t=>`<label class="rl"><input type="radio" name="demo" value="${t}">${t}</label>`).join('');}

function setG(who,g){
  if(who==='c'){gC=g;document.getElementById('gb-cm').className='gb'+(g==='m'?' on':'');document.getElementById('gb-cf').className='gb'+(g==='f'?' on':'');document.getElementById('lbl-c').textContent=g==='m'?'اسم العميل (اختياري)':'اسم العميلة (اختياري)';}
  else{gK=g;document.getElementById('gb-km').className='gb'+(g==='m'?' on':'');document.getElementById('gb-kf').className='gb'+(g==='f'?' on':'');document.getElementById('lbl-k').textContent=g==='m'?'اسم الطفل (اختياري)':'اسم الطفلة (اختياري)';}
}
function genRefUI(){const el=document.getElementById('f-ref');if(el)el.value=genRef().ref;}
function cond(id,show){const el=document.getElementById(id);if(!el)return;el.classList.toggle('h',!show);el.classList.toggle('v',show);}

function goPage(p){
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.nb').forEach(x=>x.classList.remove('on'));
  const pg=document.getElementById('page-'+p);if(pg)pg.classList.add('on');
  const nb=document.getElementById('nav-'+p);if(nb)nb.classList.add('on');
  const isOwner=session&&session.role==='owner';
  const ownerTitles={list:'الملاحظات',branchmsgs:'الإشعارات الصادرة',rep:'حماية السمعة'};
  const tt={new:'تسجيل شكوى',list:'سجل الشكاوى',msgs:'رسائل العملاء',branchmsgs:'الإشعارات الصادرة',warnings:'سجل الإنذارات',stats:'الإحصائيات',filter:'تحليل الشكاوى',rep:'حماية السمعة',settings:'إدارة المستخدمين',chpass:'تغيير الرقم السري'};
  const title=isOwner&&ownerTitles[p]?ownerTitles[p]:(tt[p]||'');
  const titleEl=document.getElementById('tbtitle');if(titleEl)titleEl.textContent=title;
  closeDetail();
  if(p==='list')renderList();
  if(p==='msgs')renderMsgs();
  if(p==='branchmsgs')renderBranchMsgs();
  if(p==='ownercast')renderOwnerCast();
  if(p==='warnings')renderWarnings();
  if(p==='stats')renderStats();
  if(p==='filter')runFilter();
  if(p==='rep')renderRep();
  if(p==='settings')renderSettings();
  if(p==='new')genRefUI();
  if(session){if(!pageSeen[session.id])pageSeen[session.id]={};pageSeen[session.id][p]=nowISO();savePSeen();}
  closeSb();
  updateBNavActive(p);
  setTimeout(updateDots,300);
}

function normalizeSaudiMobile(raw){
  let d=raw.replace(/[\s\-]/g,'');
  if(d.startsWith('+966'))d=d.slice(4);
  else if(d.startsWith('00966'))d=d.slice(5);
  else if(d.startsWith('966'))d=d.slice(3);
  if(d.startsWith('0'))d=d.slice(1);
  return /^5[0-9]{8}$/.test(d)?d:null;
}

function previewC(){
  const ref=document.getElementById('f-ref').value;
  const branch=document.getElementById('f-branch').value;
  const ctype=(document.querySelector('input[name="ctype"]:checked')||{}).value||'';
  const mobile=document.getElementById('f-mobile').value.trim();
  const client=document.getElementById('f-client').value.trim();
  const child=document.getElementById('f-child').value.trim();
  const desc=document.getElementById('f-desc').value.trim();
  const demand=document.getElementById('f-demand').value.trim();
  const hdQ=document.querySelector('input[name="hd"]:checked').value;
  const hdA=document.getElementById('f-hidden').value.trim();
  const origin=document.getElementById('f-origin').value.trim();
  const financial=document.getElementById('f-financial').checked;
  const hasEmp=document.getElementById('f-hasemp').checked;
  const negative=document.getElementById('f-negative').checked;
  const negText=document.getElementById('f-neg-text').value.trim();
  const sentiment=(document.querySelector('input[name="sentiment"]:checked')||{}).value||'';
  const demo=(document.querySelector('input[name="demo"]:checked')||{}).value||'';
  const csnote=document.getElementById('f-csnote').value.trim();
  if(!branch){showToast('يرجى اختيار الفرع','err');return;}
  if(!ctype){showToast('يرجى اختيار نوع الشكوى','err');return;}
  if(!mobile||!desc||!demand){showToast('يرجى تعبئة الحقول المطلوبة','err');return;}
  const mobileNorm=normalizeSaudiMobile(mobile);
  if(!mobileNorm){showToast('رقم الجوال غير صحيح','err');return;}
  if(hdQ==='yes'&&!hdA){showToast('يرجى تحديد المطلب غير المعلن','err');return;}
  const now=new Date(),dd=pad(now.getDate(),2),mm=pad(now.getMonth()+1,2),yr=now.getFullYear();
  pendingC={ref,branch,ctype,dateKey:`${dd}${mm}${yr}`,dateDisplay:`${dd}/${mm}/${yr}`,timeDisplay:`${pad(now.getHours(),2)}:${pad(now.getMinutes(),2)}`,createdAt:nowISO(),mobile:mobileNorm,client,child,desc,demand,hdQ,hdA:hdQ==='yes'?hdA:null,origin,financial,hasEmp,negative,negText:negative?negText:'',sentiment,demo,csnote,gC,gK,status:'جارية حاليا',ownerPriority:false,adminComment:null,branchComment:null,branchEmployee:null,seenBy:{},tasks:[{id:'t1',label:'إرسال إشعار للعميل باستلام الشكوى',done:false},{id:'t2',label:'معالجة الشكوى',done:false}],audit:[{who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:'تم إنشاء الشكوى'}],addedBy:session.name};
  prevTxt=buildSummary(pendingC,false);
  document.getElementById('prev-text').textContent=prevTxt;
  document.getElementById('prov').classList.add('on');
}
function closePrev(){document.getElementById('prov').classList.remove('on');}
function confirmSubmit(){if(!pendingC)return;complaints.unshift(pendingC);saveC();closePrev();clearForm();showToast('تم حفظ الشكوى بنجاح','ok');updateDots();}
function clearForm(){
  ['f-mobile','f-client','f-child','f-desc','f-demand','f-hidden','f-origin','f-neg-text','f-csnote'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('f-branch').value='';
  document.getElementById('f-financial').checked=false;
  document.getElementById('f-hasemp').checked=false;
  document.getElementById('f-negative').checked=false;
  cond('emp-cond',false);cond('neg-cond',false);cond('hd-box',false);
  document.querySelectorAll('input[name="ctype"],input[name="hd"],input[name="sentiment"],input[name="demo"]').forEach(r=>r.checked=false);
  document.querySelector('input[name="hd"][value="no"]').checked=true;
  pendingC=null;gC='m';gK='m';setG('c','m');setG('k','m');genRefUI();
}

function renderList(){
  runAuto();
  const r=session.role,isOwner=r==='owner';
  let vis=[...complaints];
  if(r==='branch')vis=vis.filter(c=>c.branch===session.branch);
  const activeC=vis.filter(c=>isActive(c)).length;
  const pendCnt=vis.filter(c=>!isActive(c)&&!isDone(c)).length;
  const negC=vis.filter(c=>c.negative).length;
  const tabs=[{id:'all',label:'الكل',count:vis.length},{id:'active',label:'حديثة',count:activeC},{id:'pending',label:'جارية',count:pendCnt},{id:'negative',label:'تقييمات سلبية',count:negC}];
  if(r==='branch'){const nc=vis.filter(c=>!c.branchComment&&!isDone(c)).length;tabs.splice(1,0,{id:'needs',label:'يتطلب إفادتك',count:nc});}
  const phEl=document.querySelector('#page-list .ph h2');
  if(phEl)phEl.textContent=isOwner?'سجل الملاحظات':'سجل الشكاوى';
  document.getElementById('stat-tabs').innerHTML=tabs.map(t=>`<div class="stab${currentTab===t.id?' on':''}" onclick="setTab('${t.id}')"><div class="sn">${t.count}</div><div class="sl">${t.label}</div></div>`).join('');
  let shown=vis;
  if(currentTab==='active')shown=vis.filter(c=>isActive(c));
  else if(currentTab==='pending')shown=vis.filter(c=>!isActive(c)&&!isDone(c));
  else if(currentTab==='negative')shown=vis.filter(c=>c.negative);
  else if(currentTab==='needs')shown=vis.filter(c=>!c.branchComment&&!isDone(c)&&!isActive(c));
  document.getElementById('list-content').innerHTML=shown.length?shown.map(c=>cCard(c,r)).join(''):'';
  document.getElementById('list-empty').style.display=shown.length?'none':'block';
  if(currentRef){
    const openC=complaints.find(x=>x.ref===currentRef);
    const card=document.querySelector(`.cc[data-ref="${currentRef}"]`);
    if(card&&openC){const ex=document.getElementById('detail-inline-'+currentRef);if(!ex){const dv=document.createElement('div');dv.className='cc-detail-inline';dv.id='detail-inline-'+currentRef;card.parentNode.insertBefore(dv,card.nextSibling);renderDetail(openC,dv,r);}}
    else currentRef=null;
  }
}
function setTab(id){currentTab=id;closeDetail();renderList();}

function markSeen(ref){const c=complaints.find(x=>x.ref===ref);if(!c)return;if(!c.seenBy)c.seenBy={};if(!c.seenBy[session.id]){c.seenBy[session.id]=nowISO();saveC();setTimeout(()=>{saveC();renderList();updateDots();},60000);}}
function isNew(c){if(!c.seenBy)return true;return!c.seenBy[session.id];}

function cCard(c,r){
  const SC={'تحت المعالجة':'s-bo','جارية حاليا':'s-bb','تمت المعالجة':'s-bg','معاد فتحها':'s-bp','مستبعدة':'s-bgr'};
  const sc=c.ownerPriority?'pri-ow':(SC[c.status]||'s-bgr');
  const hasClient=c.client&&c.client.trim();
  const hasChild=c.child&&c.child.trim();
  const clientName=hasClient?c.client:(c.gC==='f'?'عميلة':'عميل');
  const childLbl=hasChild?`${c.gK==='f'?'الطفلة':'الطفل'} ${c.child}`:'';
  const dShort=c.demand?c.demand.substring(0,55)+(c.demand.length>55?'…':''):'';
  return`<div class="cc ${sc}" data-ref="${c.ref}" onclick="showDetail('${c.ref}')">
    <div class="cci">
      <div style="min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          ${sBadge(c.status)}${isNew(c)?`<span class="bnew">جديد</span>`:''}${c.negative?`<span class="badge bpk" style="font-size:.65rem">تقييم سلبي</span>`:''}
        </div>
        <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:5px">
          <span class="cc-name">${clientName}</span>${childLbl?`<span style="font-size:.78rem;color:var(--mu)">— ${childLbl}</span>`:''}
          <span style="font-size:.78rem;color:var(--mu2)">·</span><span style="font-size:.78rem;color:var(--mu);font-weight:500">${c.branch}</span>
        </div>
        <div class="cc-desc">شكوى بسبب <strong>${c.ctype||'—'}</strong>${dShort?`، المطلب: ${dShort}`:''}</div>
      </div>
      <div style="text-align:left;flex-shrink:0;padding-right:6px;display:flex;flex-direction:column;align-items:flex-end;gap:5px">
        <div class="cc-dt">${fmtShort(c.createdAt)}</div>
        <div class="cc-tm">${fmtTime(c.createdAt)}</div>
        ${c.financial?`<span style="font-size:.62rem;font-weight:800;color:var(--rd)">مالية</span>`:''}
      </div>
    </div>
  </div>`;
}

function showDetail(ref){
  const c=complaints.find(x=>x.ref===ref);if(!c)return;
  if(currentRef===ref){closeDetail();return;}
  closeDetail();currentRef=ref;
  const r=session.role;markSeen(ref);
  if(c.status==='جارية حاليا'&&(Date.now()-new Date(c.createdAt).getTime())>=3600000){c.status='تحت المعالجة';c.audit.push({who:'النظام',uid:'sys',role:'system',ts:nowISO(),body:'تم تغيير الحالة تلقائياً'});saveC();}
  const card=document.querySelector(`.cc[data-ref="${ref}"]`);
  const dv=document.createElement('div');dv.className='cc-detail-inline';dv.id='detail-inline-'+ref;
  if(card&&card.parentNode)card.parentNode.insertBefore(dv,card.nextSibling);
  else document.getElementById('list-content').appendChild(dv);
  renderDetail(c,dv,r);
  setTimeout(()=>{if(card)card.scrollIntoView({behavior:'smooth',block:'start'});},60);
}

function closeDetail(){if(currentRef){const el=document.getElementById('detail-inline-'+currentRef);if(el)el.remove();}currentRef=null;}

function renderDetail(c,inner,r){
  if(r==='owner')renderOwnerDetail(c,inner);
  else if(r==='branch')renderBranchDetail(c,inner);
  else renderFullDetail(c,inner,r);
}

function renderOwnerDetail(c,inner){
  const txt=buildSummary(c,true);
  // زر لفت النظر يظهر فقط إذا تم تحديد الموظفة المشار إليها
  const showWarnBtn=c.hasEmp&&c.branchEmployee;
  const ownerName=getOwnerDisplayName();
  const adminBtn=adminWANum?`<button class="btn wa" onclick="sendSummaryToAdminWA('${c.ref}')">إرسال للإدارة</button>`:'';
  inner.innerHTML=`<div class="owner-card${c.ownerPriority?' pri-ow':''}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:12px">
      <div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${sBadge(c.status)}<span style="font-family:'IBM Plex Mono',monospace;font-size:.82rem;color:var(--mu)">${c.ref}</span>${c.needsClarification?`<span class="badge bam">التبرير مطلوب</span>`:''}</div>
        <div style="font-size:.78rem;color:var(--mu);margin-top:5px">${fmtShort(c.createdAt)} — ${fmtTime(c.createdAt)}</div>
      </div>
      <div class="brow">
        <button class="btn amb" onclick="togglePriority('${c.ref}')">${c.ownerPriority?'إلغاء الأولوية':'أولوية قصوى'}</button>
        <button class="btn" style="background:var(--pul);color:var(--pu);border-color:var(--pub)" onclick="requestClarification('${c.ref}')">${c.needsClarification?'إلغاء التوضيح':'طلب توضيح'}</button>
        ${showWarnBtn?`<button class="btn gn" onclick="sendOwnerWarning('${c.ref}')">تجهيز لفت نظر</button>`:''}
        ${adminBtn}
        <button class="btn" onclick="closeDetail()">إغلاق</button>
      </div>
    </div>
    ${c.ownerPriority?`<div class="pri-banner">يجب البدء فورًا بمعالجة هذه الشكوى <small>(${ownerName})</small></div>`:''}
    <div class="owner-text">${txt}</div>
  </div>`;
}

function renderBranchDetail(c,inner){
  const txt=buildSummary(c,false);
  const brEmps=employees[c.branch]||[];
  const empOpts=brEmps.map(e=>`<option value="${e.name}" ${c.branchEmployee===e.name?'selected':''}>${e.name}</option>`).join('');
  const isExc=isExcluded(c);
  const empSec=c.hasEmp&&!isExc?`<div class="fg" style="margin-top:16px"><label class="fl">الموظفة المشار إليها <span style="font-size:.73rem;color:var(--or)">(مطلوب)</span></label><select class="fsel" id="branch-emp-sel" onchange="saveBranchEmployee('${c.ref}',this.value)"><option value="">-- اختر الموظفة --</option>${empOpts}</select></div>`:'';
  inner.innerHTML=`<div class="branch-view">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:8px">${sBadge(c.status)}<span style="font-family:'IBM Plex Mono',monospace;font-size:.82rem;color:var(--mu)">${c.ref}</span></div>
      <div><div class="dh-dt">${fmtShort(c.createdAt)}</div><div class="dh-tm">${fmtTime(c.createdAt)}</div></div>
    </div>
    ${c.ownerPriority?`<div class="pri-banner" style="margin-bottom:14px">يجب البدء فورًا بمعالجة هذه الشكوى <small>(${getOwnerDisplayName()})</small></div>`:''}
    <div class="branch-text">${txt}</div>
    ${empSec}
    ${!isExc?`<div class="fg" style="margin-top:14px"><label class="fl">إفادة مديرة الفرع</label><textarea class="ft" id="bcmt" rows="3" placeholder="أضف إفادتك وتوضيحك هنا...">${c.branchComment||''}</textarea></div>
    <div class="brow" style="margin-top:10px"><button class="btn pri" onclick="saveComment('branch')">حفظ الإفادة</button><button class="btn" onclick="closeDetail()">إغلاق</button></div>`
    :`<div class="brow" style="margin-top:14px"><button class="btn" onclick="closeDetail()">إغلاق</button></div>`}
  </div>`;
}

function saveBranchEmployee(ref,emp){const c=complaints.find(x=>x.ref===ref);if(!c||!emp)return;c.branchEmployee=emp;c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:`تم تحديد الموظفة المشار إليها: ${emp}`});saveC();}

function renderFullDetail(c,inner,r){
  const mob=c.mobile.replace(/\D/g,'');const intl=mob.startsWith('0')?'966'+mob.slice(1):mob;
  const waStatus=encodeURIComponent(buildClientMsg(c));
  const brWA=branchWA[c.branch]||'';
  const branchMsg=encodeURIComponent(`${buildSummary(c,false)}\n\nعزيزتي مديرة ${c.branch} نرجو تقديم إفادتك`);
  const brWABtn=brWA?`<button class="btn wa" onclick="window.open('https://wa.me/${brWA}?text=${branchMsg}','_blank')">طلب إفادة المديرة</button>`:'';
  const adminWABtnFull=adminWANum?`<button class="btn gn" onclick="sendSummaryToAdminWA('${c.ref}')">إرسال للإدارة</button>`:'';
  const canDel=r==='maint';
  const adminLocked=r==='admin'&&isExcluded(c);
  const canStatus=!adminLocked&&(r==='admin'||r==='cs'||r==='maint');
  const canAdminC=r==='admin'||r==='maint';
  const canEdit=r==='cs'||r==='maint';
  const isExc=isExcluded(c);
  const showActions=!isExc||(r==='cs'||r==='maint');
  const showWarnBtn=c.hasEmp&&c.branchEmployee&&(r==='admin'||r==='maint');
  let statusHTML='';
  if(canStatus&&showActions){const avail=statusesFor(r);statusHTML=`<select class="ssel" id="qa-ssel">${avail.map(s=>`<option value="${s}" ${s===c.status?'selected':''}>${s}</option>`).join('')}</select><button class="btn pri" style="padding:10px 14px;font-size:.85rem" onclick="changeStatus()">تحديث</button>`;}
  let tasksHTML='';
  if(canAdminC&&showActions&&c.tasks){tasksHTML=`<div style="margin-top:16px"><hr class="d" style="margin:0 0 12px"><div style="font-size:.78rem;font-weight:800;color:var(--mu);margin-bottom:10px;text-transform:uppercase">إجراءات الشكوى</div>${c.tasks.map(t=>`<div class="task-item"><input type="checkbox" class="task-cb" ${t.done?'checked':''} onchange="toggleTask('${c.ref}','${t.id}',this.checked)"><span class="task-lbl${t.done?' task-done':''}">${t.label}</span></div>`).join('')}</div>`;}
  const auditHTML=(c.audit||[]).map(a=>`<div class="audit-item"><div class="audit-left"><div class="audit-date">${fmtShort(a.ts)}</div><div class="audit-time">${fmtTime(a.ts)}</div></div><div class="audit-body">${a.body}<br><span style="font-size:.73rem;color:var(--mu2)">${auditWho(a)}</span></div></div>`).join('');
  const sumTxt=buildSummary(c,true);
  const hasClient=c.client&&c.client.trim();
  const hasChild=c.child&&c.child.trim();
  inner.innerHTML=`
  <div class="qa-bar">
    <button class="qa-close" onclick="closeDetail()"></button>
    ${showActions&&canStatus?`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${statusHTML}</div>`:''}
    ${showActions&&canEdit?`<button class="btn" onclick="startEdit('${c.ref}')">تعديل</button>`:''}
    ${showActions?`<button class="btn" id="detail-mode-btn" onclick="toggleDetailMode()">تفاصيل كاملة</button>`:''}
    ${showActions?`<button class="btn wa" onclick="window.open('https://wa.me/${intl}?text=${waStatus}','_blank')">إشعار العميل</button>`:''}
    ${showActions?brWABtn:''}
    ${showActions?adminWABtnFull:''}
    ${showWarnBtn?`<button class="btn gn" onclick="sendOwnerWarning('${c.ref}')">تجهيز لفت نظر</button>`:''}
    ${canDel?`<button class="btn dan" onclick="tryDelete()">حذف</button>`:''}
  </div>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px;flex-wrap:wrap">
    <div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:.82rem;color:var(--mu)">${c.ref}</span>
        ${sBadge(c.status)}${c.financial?'<span class="badge br" style="font-size:.68rem">مطالبة مالية</span>':''}${c.negative?'<span class="badge bpk" style="font-size:.68rem">تقييم سلبي</span>':''}
      </div>
      <div style="font-weight:800;font-size:1.05rem;color:var(--tx)">${hasClient?c.client:(c.gC==='f'?'عميلة':'عميل')}${hasChild?` — ${c.gK==='f'?'الطفلة':'الطفل'} ${c.child}`:''}</div>
      <div style="font-size:.83rem;font-weight:600;color:var(--mu);margin-top:3px">${c.branch} · ${c.ctype||'—'} · ${fmtShort(c.createdAt)} ${fmtTime(c.createdAt)}</div>
    </div>
  </div>
  ${c.ownerPriority?`<div class="pri-banner" style="margin-bottom:14px">يجب البدء فورًا بمعالجة هذه الشكوى <small>(${getOwnerDisplayName()})</small></div>`:''}
  <div id="summary-sec" style="margin-bottom:14px">
    <div class="sbox" style="margin-bottom:10px">${sumTxt}</div>
    <div class="cmsg-box">${buildClientMsg(c)}</div>
  </div>
  <div id="details-sec" style="display:none;margin-bottom:14px">
    <div class="dp">
      <div class="dp-section"><div class="dp-section-title">بيانات العميل</div>
        ${hasClient?`<div class="ir"><span class="ik">اسم العميل</span><span class="iv">${c.client}</span></div>`:''}
        ${hasChild?`<div class="ir"><span class="ik">اسم الطفل</span><span class="iv">${c.child}</span></div>`:''}
        <div class="ir"><span class="ik">رقم الجوال</span><span class="iv">${c.mobile}</span></div>
        ${c.demo?`<div class="ir"><span class="ik">الفئة الديموغرافية</span><span class="iv">${c.demo}</span></div>`:''}
      </div>
      <div class="dp-section"><div class="dp-section-title">تفاصيل الشكوى</div>
        <div class="ir"><span class="ik">الفرع</span><span class="iv">${c.branch}</span></div>
        <div class="ir"><span class="ik">نوع الشكوى</span><span class="iv">${c.ctype||'—'}</span></div>
        <div class="ir"><span class="ik">وصف الشكوى</span><span class="iv">${c.desc}</span></div>
        <div class="ir"><span class="ik">المطلب المُعلن</span><span class="iv">${c.demand}</span></div>
        ${c.hdA?`<div class="ir"><span class="ik">مطلب غير معلن</span><span class="iv">${c.hdA}</span></div>`:''}
        ${c.origin&&c.origin.trim()?`<div class="ir"><span class="ik">مصدر المشكلة</span><span class="iv">${c.origin}</span></div>`:''}
        ${c.sentiment?`<div class="ir"><span class="ik">تقرير المشاعر</span><span class="iv">${c.sentiment}</span></div>`:''}
        ${c.csnote&&c.csnote.trim()?`<div class="ir"><span class="ik">ملاحظة خدمة العملاء</span><span class="iv">${c.csnote}</span></div>`:''}
        ${c.hasEmp&&c.branchEmployee?`<div class="ir"><span class="ik">الموظفة المشار إليها</span><span class="iv">${c.branchEmployee}</span></div>`:''}
        ${c.reopenReason?`<div class="ir"><span class="ik">سبب إعادة الفتح</span><span class="iv">${c.reopenReason}</span></div>`:''}
      </div>
      ${c.branchComment||c.adminComment?`<div class="dp-section"><div class="dp-section-title">الإفادات</div>
        ${c.branchComment?`<div class="ir"><span class="ik">إفادة مديرة الفرع</span><span class="iv">${c.branchComment}</span></div>`:''}
        ${c.adminComment?`<div class="ir"><span class="ik">توضيح الإدارة</span><span class="iv">${c.adminComment}</span></div>`:''}
      </div>`:''}
    </div>
    ${tasksHTML}
    ${canAdminC&&showActions?`<div style="margin-top:14px;background:var(--sur);border:1px solid var(--border-light);border-radius:var(--r);padding:18px;box-shadow:var(--shs)">
      <div class="fg" style="margin-bottom:10px"><label class="fl">توضيح من الإدارة <span style="font-weight:600;color:var(--mu2);font-size:.73rem">(للإدارة العليا فقط)</span></label>
      <textarea class="ft" id="acmt" rows="2" placeholder="أضف توضيحاً...">${c.adminComment||''}</textarea></div>
      <button class="btn pri" style="font-size:.85rem" onclick="saveComment('admin')">حفظ التوضيح</button></div>`:''}
    ${c.audit&&c.audit.length?`<div style="margin-top:14px;background:var(--sur);border:1px solid var(--border-light);border-radius:var(--r);padding:18px;box-shadow:var(--shs)"><div class="audit-t">سجل الإجراءات</div><div>${auditHTML}</div></div>`:''}
  </div>
  <div id="edit-sec" style="display:none;margin-bottom:14px">
    <div class="card" style="margin:0 0 12px">
      <div class="two"><div class="fg"><label class="fl">اسم العميل (اختياري)</label><input class="fi" id="edit-client" value="${c.client||''}"></div><div class="fg"><label class="fl">اسم الطفل (اختياري)</label><input class="fi" id="edit-child" value="${c.child||''}"></div></div>
      <div class="fg"><label class="fl">رقم الجوال</label><input class="fi" id="edit-mobile" value="${c.mobile}"></div>
      <div class="fg"><label class="fl">الفرع</label><select class="fsel" id="edit-branch">${['فرع القصر','فرع سلام مول','فرع الرياض جاليري','فرع ذا ڤيو مول','فرع مركز المملكة','فرع شرق بلازا'].map(b=>`<option ${c.branch===b?'selected':''}>${b}</option>`).join('')}</select></div>
      <div class="fg"><label class="fl">وصف الشكوى</label><textarea class="ft" id="edit-desc" rows="3">${c.desc}</textarea></div>
      <div class="fg"><label class="fl">المطلب المُعلن</label><textarea class="ft" id="edit-demand" rows="2">${c.demand}</textarea></div>
      <div class="fg"><label class="fl">المطلب غير المعلن</label><input class="fi" id="edit-hda" value="${c.hdA||''}"></div>
      <div class="fg"><label class="fl">مصدر المشكلة</label><input class="fi" id="edit-origin" value="${c.origin||''}"></div>
      <div class="fg"><label class="fl">ملاحظة خدمة العملاء</label><textarea class="ft" id="edit-csnote" rows="2">${c.csnote||''}</textarea></div>
      <label class="ck" style="margin-bottom:10px"><input type="checkbox" id="edit-financial" ${c.financial?'checked':''}>مطالبة مالية</label>
      <label class="ck" style="margin-bottom:10px"><input type="checkbox" id="edit-hasemp" ${c.hasEmp?'checked':''}>إشارة إلى موظفة</label>
      <label class="ck" style="margin-bottom:10px"><input type="checkbox" id="edit-neg" ${c.negative?'checked':''} onchange="cond('edit-neg-cond',this.checked)">تقييم سلبي</label>
      <div class="cond ${c.negative?'v':'h'}" id="edit-neg-cond"><textarea class="ft" id="edit-neg-text" rows="2">${c.negText||''}</textarea></div>
      <div class="brow" style="margin-top:12px">
        <button class="btn pri" onclick="saveEdit('${c.ref}')">حفظ التعديلات</button>
        <button class="btn" onclick="document.getElementById('edit-sec').style.display='none'">إلغاء</button>
      </div>
    </div>
  </div>`;
}

function toggleDetailMode(){const ss=document.getElementById('summary-sec'),ds=document.getElementById('details-sec'),btn=document.getElementById('detail-mode-btn');if(!ss||!ds)return;if(ss.style.display!=='none'){ss.style.display='none';ds.style.display='block';if(btn)btn.textContent='العودة للنص';}else{ds.style.display='none';ss.style.display='block';if(btn)btn.textContent='تفاصيل كاملة';}}
function startEdit(ref){const sec=document.getElementById('edit-sec');if(!sec)return;sec.style.display=sec.style.display==='none'?'block':'none';}
function saveEdit(ref){
  const c=complaints.find(x=>x.ref===ref);if(!c)return;
  c.client=document.getElementById('edit-client').value.trim();
  c.child=document.getElementById('edit-child').value.trim();
  c.mobile=document.getElementById('edit-mobile').value.trim()||c.mobile;
  c.branch=document.getElementById('edit-branch').value||c.branch;
  c.desc=document.getElementById('edit-desc').value.trim()||c.desc;
  c.demand=document.getElementById('edit-demand').value.trim()||c.demand;
  c.hdA=document.getElementById('edit-hda').value.trim()||null;
  c.origin=document.getElementById('edit-origin').value.trim()||null;
  c.csnote=document.getElementById('edit-csnote').value.trim()||'';
  c.financial=document.getElementById('edit-financial').checked;
  c.hasEmp=document.getElementById('edit-hasemp').checked;if(!c.hasEmp)c.branchEmployee=null;
  c.negative=document.getElementById('edit-neg').checked;
  c.negText=document.getElementById('edit-neg-text').value.trim()||'';
  c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:'تم تعديل بيانات الشكوى'});
  saveC();closeDetail();showDetail(ref);showToast('تم حفظ التعديلات','ok');
}
function sendSummaryToAdminWA(ref){if(!adminWANum){showToast('لم يتم إدخال رقم الإدارة','err');return;}const c=complaints.find(x=>x.ref===ref);if(!c)return;const msg=encodeURIComponent(buildSummary(c,true));const adm=adminWANum.replace(/\D/g,'');const admIntl=adm.startsWith('0')?'966'+adm.slice(1):adm;window.open(`https://wa.me/${admIntl}?text=${msg}`,'_blank');}
function tryDelete(){if(session.role!=='maint'&&session.role!=='owner'){showModal('','ليس لديك صلاحية الحذف');return;}if(!confirm('هل أنت متأكد من حذف هذه الشكوى نهائياً؟'))return;complaints=complaints.filter(c=>c.ref!==currentRef);saveC();closeDetail();renderList();showToast('تم الحذف','ok');}
function changeStatus(){
  const c=complaints.find(x=>x.ref===currentRef);if(!c)return;
  const r=session.role;if(r==='admin'&&isExcluded(c)){showToast('لا يمكن تغيير حالة مستبعدة','err');return;}
  const sel=document.getElementById('qa-ssel');if(!sel)return;const nv=sel.value;
  if(nv==='معاد فتحها'){const reason=prompt('يرجى كتابة سبب إعادة فتح الشكوى:');if(!reason)return;c.reopenReason=reason;}
  if(!(SPERMS[nv]||[]).includes(r)){showToast('ليس لديك صلاحية لهذه الحالة','err');return;}
  const old=c.status;c.status=nv;if(nv==='تمت المعالجة')c.ownerPriority=false;
  // حذف رسائل طلب التوضيح عند تغيير الحالة لـ "تمت المعالجة"
  if(nv==='تمت المعالجة'&&c.needsClarification){
    c.needsClarification=false;
    branchMsgs=branchMsgs.filter(bm=>!(bm.type==='clarification'&&bm.complaintRef===c.ref));
    saveBM();
  }
  c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:`تم تغيير الحالة من "${old}" إلى "${nv}"`+(c.reopenReason&&nv==='معاد فتحها'?` — السبب: ${c.reopenReason}`:'')});
  saveC();closeDetail();showDetail(c.ref);renderList();showToast('تم تحديث الحالة','ok');
}
function saveComment(type){
  const c=complaints.find(x=>x.ref===currentRef);if(!c)return;
  const inp=document.getElementById(type==='admin'?'acmt':'bcmt');if(!inp){showToast('حقل التعليق غير موجود','err');return;}
  const txt=inp.value.trim();if(!txt){showToast('الحقل فارغ','err');return;}
  if(type==='admin')c.adminComment=txt;
  else{c.branchComment=txt;const empNote=c.hasEmp&&c.branchEmployee?` وحددت الموظفة: ${c.branchEmployee}`:'';c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:`أضافت ${session.name} إفادة على الشكوى${empNote}`});}
  saveC();closeDetail();showDetail(c.ref);showToast('تم الحفظ','ok');
}
function toggleTask(ref,tid,done){
  const c=complaints.find(x=>x.ref===ref);if(!c)return;
  const t=(c.tasks||[]).find(x=>x.id===tid);if(!t)return;
  t.done=done;if(t.id==='t2'&&done){c.status='تمت المعالجة';c.ownerPriority=false;}
  c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:`${done?'تم إتمام':'تم إلغاء'} المهمة: ${t.label}`});
  saveC();closeDetail();showDetail(ref);
}
function togglePriority(ref){
  const c=complaints.find(x=>x.ref===ref);if(!c)return;
  c.ownerPriority=!c.ownerPriority;
  const ownerName=getOwnerDisplayName();
  c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:c.ownerPriority?`قام/قامت ${ownerName} بتعيين الشكوى كأولوية قصوى`:`قام/قامت ${ownerName} بإلغاء الأولوية`});
  saveC();closeDetail();showDetail(ref);renderList();
  showToast(c.ownerPriority?'تم تعيين أولوية قصوى':'تم إلغاء الأولوية','ok');
}
function requestClarification(ref){
  const c=complaints.find(x=>x.ref===ref);if(!c)return;
  const ownerName=getOwnerDisplayName();
  const wasActive=c.needsClarification;
  c.needsClarification=!wasActive;
  if(c.needsClarification){
    const alreadyExists=branchMsgs.some(bm=>bm.type==='clarification'&&bm.complaintRef===ref&&bm.branch===c.branch);
    if(!alreadyExists){
      const msgText=`طلب ${ownerName} إفادتكم فيما يتعلق بالشكوى رقم (${ref})`;
      const ts=nowISO();
      branchMsgs.unshift({id:'bm-'+Date.now(),branch:c.branch,complaintRef:ref,from:ownerName,ts,seenBy:{},text:msgText,type:'clarification'});
      branchMsgs.unshift({id:'am-'+Date.now()+1,branch:'admin',complaintRef:ref,from:ownerName,ts,seenBy:{},text:msgText,type:'clarification'});
      saveBM();
    }
    c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:'طلب التوضيح والتبرير للشكوى'});
  } else {
    branchMsgs=branchMsgs.filter(bm=>!(bm.type==='clarification'&&bm.complaintRef===ref));
    saveBM();
    c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:'تم إلغاء طلب التوضيح'});
  }
  saveC();closeDetail();showDetail(ref);updateDots();
  showToast(c.needsClarification?'تم إرسال طلب التوضيح':'تم إلغاء طلب التوضيح','ok');
}

function renderMsgs(){
  const el=document.getElementById('msgs-content');
  if(!messages.length){el.innerHTML=`<div class="empty"><p>لا توجد رسائل من العملاء</p></div>`;return;}
  el.innerHTML=messages.map(m=>`<div class="msg-card">
    <div class="msg-meta">${fmtShort(m.ts)} — ${fmtTime(m.ts)} | ${m.mobile}${m.branch?' | '+m.branch:''}</div>
    <div class="msg-text">${m.text}</div>
    ${m.converted?`<div class="msg-info">تم التحويل بواسطة ${m.convertedBy} إلى شكوى</div>`:`<div class="brow"><button class="btn pri" onclick="convertMsg('${m.id}')">تحويلها إلى شكوى</button></div>`}
  </div>`).join('');
}

function convertMsg(id){
  const m=messages.find(x=>x.id===id);if(!m||m.converted)return;
  const now=new Date(),dd=pad(now.getDate(),2),mm2=pad(now.getMonth()+1,2),yr=now.getFullYear();
  const {ref}=genRef();
  const c={ref,branch:m.branch||'',ctype:'',dateKey:`${dd}${mm2}${yr}`,dateDisplay:`${dd}/${mm2}/${yr}`,timeDisplay:`${pad(now.getHours(),2)}:${pad(now.getMinutes(),2)}`,createdAt:nowISO(),mobile:m.mobile,client:'',child:'',desc:m.text,demand:'',hdQ:'no',hdA:null,origin:'رسالة العميل عبر البوابة',financial:false,hasEmp:false,negative:false,negText:'',sentiment:'',demo:'',csnote:'',gC:'m',gK:'m',status:'جارية حاليا',ownerPriority:false,adminComment:null,branchComment:null,branchEmployee:null,seenBy:{},tasks:[{id:'t1',label:'إرسال إشعار للعميل',done:false},{id:'t2',label:'معالجة الشكوى',done:false}],audit:[{who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:'تم تحويل رسالة العميل إلى شكوى'}],addedBy:session.name};
  complaints.unshift(c);saveC();
  m.converted=true;m.convertedBy=session.name;saveM();
  renderMsgs();goPage('list');
  showToast('تم تحويل الرسالة إلى شكوى — يرجى إكمال البيانات','ok');
  setTimeout(()=>showDetail(ref),300);
  updateDots();
}

// ══ وسوم قراءة رسائل المالك ══
function getOwnerMsgReadBadges(bm){
  if(!bm.seenBy)return'';
  const targetBranches=(bm.branches||[bm.branch]).filter(b=>b&&b!=='admin');
  if(!targetBranches.length)return'';
  const readBranches=[],unreadBranches=[];
  targetBranches.forEach(br=>{
    const branchUsers=users.filter(u=>u.branch===br);
    const seen=branchUsers.some(u=>bm.seenBy[u.id]);
    if(seen)readBranches.push(br.replace('فرع ',''));
    else unreadBranches.push(br.replace('فرع ',''));
  });
  let badges='';
  if(readBranches.length)badges+=`<span class="badge bg" style="font-size:.65rem">✓ ${readBranches.join('، ')}</span>`;
  if(unreadBranches.length)badges+=`<span class="badge bgr" style="font-size:.65rem">${unreadBranches.join('، ')}</span>`;
  return badges?`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">${badges}</div>`:'';
}

function renderBranchMsgs(){
  const el=document.getElementById('branch-msgs-content');const r=session.role;
  let myMsgs=[];
  if(r==='branch')myMsgs=branchMsgs.filter(bm=>bm.branch===session.branch);
  else if(r==='admin'||r==='maint')myMsgs=branchMsgs.filter(bm=>bm.branch==='admin'||bm.type==='clarification');
  else if(r==='owner')myMsgs=branchMsgs.filter(bm=>bm.branch==='admin'||bm.branch===null||bm.type==='clarification');

  if(r==='owner'){
    const sentMap={};
    branchMsgs.forEach(bm=>{
      if(bm.type==='ownercast'&&bm.branch!=='admin'){
        const key=bm.msgGroup||bm.id;
        if(!sentMap[key])sentMap[key]={...bm,branches:[bm.branch]};
        else sentMap[key].branches.push(bm.branch);
      }
    });
    const sentMsgs=Object.values(sentMap).sort((a,b)=>new Date(b.ts)-new Date(a.ts));
    const ownerName=getOwnerDisplayName();

    let html=`<div style="margin-bottom:16px">
      <button class="btn pri" onclick="openOwnerSendModal()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:6px"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        إرسال رسالة للفروع
      </button>
    </div>`;

    if(sentMsgs.length){
      html+=`<div style="font-size:.8rem;font-weight:800;color:var(--mu);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;margin-top:4px">الرسائل المُرسلة للفروع</div>`;
      html+=sentMsgs.map(bm=>{
        const branchBadges=(bm.branches||[bm.branch]).map(br=>`<span class="badge bb" style="font-size:.67rem;padding:3px 9px">${br.replace('فرع ','')}</span>`).join(' ');
        const readBadges=getOwnerMsgReadBadges(bm);
        return`<div class="branch-msg-card" style="border-right-color:var(--bl)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:8px">
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${branchBadges}</div>
            <div style="display:flex;gap:6px">
              <button class="btn" style="font-size:.75rem;padding:5px 10px;min-height:32px" onclick="editOwnerMsg('${bm.msgGroup||bm.id}')">تعديل</button>
              <button class="btn dan" style="font-size:.75rem;padding:5px 10px;min-height:32px" onclick="deleteOwnerMsg('${bm.msgGroup||bm.id}')">حذف</button>
            </div>
          </div>
          <div class="bm-body">${bm.text}</div>
          <div class="bm-meta">${fmtShort(bm.ts)} — ${fmtTime(bm.ts)}</div>
          ${readBadges}
        </div>`;
      }).join('');
    }

    const ownerWarnings=warnings.filter(w=>w.status!=='excluded');
    if(ownerWarnings.length){
      html+=`<div style="font-size:.8rem;font-weight:800;color:var(--mu);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;margin-top:16px">الإنذارات ولفت النظر</div>`;
      html+=ownerWarnings.map(w=>{
        const wBadges={draft:'<span class="badge bam">بانتظار المراجعة</span>',approved:'<span class="badge bg">معتمد</span>',revoked:'<span class="badge bo">مسحوب</span>',excluded:'<span class="badge bgr">مستبعد</span>'};
        return`<div class="branch-msg-card" style="border-right-color:var(--am)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span class="badge bam" style="font-size:.7rem">انذار</span>${wBadges[w.status]||''}</div>
          <div class="bm-title" style="color:var(--am)">${w.title}</div>
          <div class="bm-body">${w.emp} — ${w.branch}</div>
          <div class="bm-meta">${fmtShort(w.ts)} | الشكوى: ${w.ref}</div>
          <div style="margin-top:10px"><button class="btn" style="font-size:.8rem;padding:7px 14px;min-height:36px" onclick="reviewA4('${w.id}',false)">معاينة المستند</button></div>
        </div>`;
      }).join('');
    }

    if(myMsgs.length){
      html+=`<div style="font-size:.8rem;font-weight:800;color:var(--mu);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;margin-top:16px">الرسائل الواردة</div>`;
      html+=myMsgs.map(bm=>{
        if(!bm.seenBy)bm.seenBy={};if(!bm.seenBy[session.id]){bm.seenBy[session.id]=nowISO();saveBM();}
        const title=bm.type==='warning'?'رسالة نظام':bm.type==='clarification'?'طلب توضيح':'الإدارة العليا';
        const navBtn=bm.complaintRef?`<button class="btn" style="font-size:.8rem;padding:6px 14px;margin-top:10px;min-height:36px" onclick="goToComplaintFromMsg('${bm.complaintRef}')">الانتقال إلى الشكوى</button>`:'';
        return`<div class="branch-msg-card"><div class="bm-title">${title}</div><div class="bm-body">${bm.text}</div>${bm.complaintRef?`<div class="bm-meta">مرتبطة بالشكوى: ${bm.complaintRef} | ${fmtShort(bm.ts)} — ${fmtTime(bm.ts)}</div>`:''}${navBtn}</div>`;
      }).join('');
    }

    if(!sentMsgs.length&&!ownerWarnings.length&&!myMsgs.length)html+=`<div class="empty"><p>لا توجد رسائل أو إنذارات</p></div>`;
    el.innerHTML=html;
    setTimeout(updateDots,200);
    return;
  }

  if(!myMsgs.length){el.innerHTML=`<div class="empty"><p>لا توجد رسائل</p></div>`;return;}
  el.innerHTML=myMsgs.map(bm=>{
    if(!bm.seenBy)bm.seenBy={};if(!bm.seenBy[session.id]){bm.seenBy[session.id]=nowISO();saveBM();}
    const title=bm.type==='warning'?'رسالة نظام':bm.type==='clarification'?'طلب توضيح من الإدارة العليا':'الإدارة العليا';
    const navBtn=bm.complaintRef?`<button class="btn" style="font-size:.8rem;padding:6px 14px;margin-top:10px;min-height:36px" onclick="goToComplaintFromMsg('${bm.complaintRef}')">الانتقال إلى الشكوى</button>`:'';
    return`<div class="branch-msg-card"><div class="bm-title">${title}</div><div class="bm-body">${bm.text}</div>${bm.complaintRef?`<div class="bm-meta">مرتبطة بالشكوى: ${bm.complaintRef} | ${fmtShort(bm.ts)} — ${fmtTime(bm.ts)}</div>`:''}${navBtn}</div>`;
  }).join('');
  setTimeout(updateDots,200);
}
function goToComplaintFromMsg(ref){goPage('list');setTimeout(()=>showDetail(ref),120);}
function renderOwnerCast(){const el=document.getElementById('ownercast-content');if(!el)return;if(!session||session.role!=='owner'){el.innerHTML='';return;}goPage('branchmsgs');}

function openOwnerSendModal(){
  const modal=document.getElementById('owner-send-modal');if(!modal)return;
  document.getElementById('owner-msg-text').value='';
  document.getElementById('owner-send-err').style.display='none';
  const container=document.getElementById('owner-branch-checkboxes');
  container.innerHTML=BRANCHES_LIST.map(br=>`<label class="ms-item"><input type="checkbox" value="${br}" checked>${br}</label>`).join('');
  modal.classList.add('on');
}
function closeOwnerSendModal(){const modal=document.getElementById('owner-send-modal');if(modal)modal.classList.remove('on');}
function selectAllBranches(){document.querySelectorAll('#owner-branch-checkboxes input[type="checkbox"]').forEach(cb=>cb.checked=true);}
function clearAllBranches(){document.querySelectorAll('#owner-branch-checkboxes input[type="checkbox"]').forEach(cb=>cb.checked=false);}

function sendOwnerCast(){
  const text=document.getElementById('owner-msg-text').value.trim();
  const errEl=document.getElementById('owner-send-err');
  const selected=Array.from(document.querySelectorAll('#owner-branch-checkboxes input:checked')).map(cb=>cb.value);
  errEl.style.display='none';
  if(!text){errEl.textContent='يرجى كتابة نص الرسالة';errEl.style.display='block';return;}
  if(!selected.length){errEl.textContent='يرجى اختيار فرع واحد على الأقل';errEl.style.display='block';return;}
  const ownerName=getOwnerDisplayName();
  const ts=nowISO(),msgGroup='og-'+Date.now();
  selected.forEach(br=>{branchMsgs.unshift({id:'oc-'+Date.now()+'-'+Math.random().toString(36).slice(2),msgGroup,branch:br,from:ownerName,ts,seenBy:{},text,type:'ownercast',complaintRef:null});});
  branchMsgs.unshift({id:'oc-admin-'+Date.now(),msgGroup,branch:'admin',from:ownerName,ts,seenBy:{},text,type:'ownercast',complaintRef:null});
  saveBM();closeOwnerSendModal();showToast(`تم إرسال الرسالة إلى ${selected.length} فرع`,'ok');renderBranchMsgs();updateDots();
}

function editOwnerMsg(msgGroup){
  const msgs=branchMsgs.filter(bm=>bm.msgGroup===msgGroup||bm.id===msgGroup);if(!msgs.length)return;
  const newText=prompt('تعديل نص الرسالة:',msgs[0].text);if(!newText||!newText.trim())return;
  msgs.forEach(bm=>{bm.text=newText.trim();});saveBM();renderBranchMsgs();showToast('تم تعديل الرسالة','ok');
}
function deleteOwnerMsg(msgGroup){
  if(!confirm('هل أنت متأكد من حذف هذه الرسالة من جميع الفروع؟'))return;
  branchMsgs=branchMsgs.filter(bm=>bm.msgGroup!==msgGroup&&bm.id!==msgGroup);
  saveBM();renderBranchMsgs();showToast('تم حذف الرسالة','ok');
}

function renderWarnings(){
  const el=document.getElementById('warnings-content');const r=session.role;
  let vis=[...warnings];
  if(r==='branch'){
    vis=warnings.filter(w=>w.branch===session.branch&&w.status==='approved');
    // يزول لفت النظر من شاشة المالك بعد ان تشاهده جميع موظفات الفرع المعني
    // ويبقى في شاشة جميع موظفات الفرع المعني
    vis=vis.filter(w=>{
      const branchUsers=users.filter(u=>u.branch===session.branch);
      if(!branchUsers.length)return true;
      const allSeen=branchUsers.every(u=>w.seenBy&&w.seenBy[u.id]);
      return!allSeen;
    });
  } else if(r!=='owner'&&r!=='admin'&&r!=='maint')vis=vis.filter(w=>w.status!=='excluded');
  if(!vis.length){el.innerHTML=`<div class="empty"><p>لا توجد إنذارات مسجلة</p></div>`;return;}
  vis.forEach(w=>{if(!w.seenBy)w.seenBy={};if(!w.seenBy[session.id])w.seenBy[session.id]=nowISO();});
  saveW();
  el.innerHTML=vis.map(w=>{
    const badges={draft:'<span class="badge bam">بانتظار المراجعة</span>',approved:'<span class="badge bg">معتمد</span>',revoked:'<span class="badge bo">مسحوب</span>',excluded:'<span class="badge bgr">مستبعد</span>'};
    const borders={draft:'border-right:5px solid var(--am)',approved:'border-right:5px solid var(--gn)',revoked:'border-right:5px solid var(--or)',excluded:'border-right:5px solid var(--mu2)'};
    return`<div class="card" style="margin-bottom:12px;padding:18px;${borders[w.status]||''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-weight:800;font-size:1.05rem;color:var(--tx)">${w.emp} <span style="font-size:.82rem;color:var(--mu);font-weight:600">(${w.branch})</span></div>
          <div style="font-size:.88rem;color:var(--tx2);margin-top:3px;font-weight:600">${w.title} — الشكوى: ${w.ref}</div>
          <div style="font-size:.78rem;color:var(--mu);margin-top:7px;display:flex;gap:10px;align-items:center">${badges[w.status]||''}<span>${fmtShort(w.ts)}</span></div>
        </div>
        <button class="btn pri" onclick="reviewA4('${w.id}')">معاينة المستند</button>
      </div>
    </div>`;
  }).join('');
  setTimeout(updateDots,200);
}

function sendOwnerWarning(ref){
  const c=complaints.find(x=>x.ref===ref);if(!c||!c.branchEmployee)return;
  const emp=c.branchEmployee;
  const existing=warnings.find(w=>w.ref===ref&&w.emp===emp);
  if(existing){showToast('يوجد إنذار مسجل مسبقاً!','err');goPage('warnings');setTimeout(()=>reviewA4(existing.id),500);return;}
  const prevWarns=warnings.filter(w=>w.emp===emp&&w.status!=='excluded');
  let wType='first';
  if(prevWarns.length>0)wType=prevWarns.some(w=>w.ctype===c.ctype)?'repeat':'different';
  const ownerName=getOwnerDisplayName();
  const title=wType==='first'?'لفت نظر إداري':wType==='repeat'?'إنذار كتابي - تكرار مخالفة':'إنذار كتابي - تعدد مخالفات';
  let text=`إلى الموظفة: <strong>${emp}</strong> المحترمة،<br><br>تحية طيبة وبعد،<br><br>`;
  if(wType==='first')text+=`بناءً على الشكوى الواردة إلينا برقم (<strong>${c.ref}</strong>) وتاريخ <strong>${fmtShort(c.createdAt)}</strong> بخصوص (<strong>${c.ctype||'مخالفة لسياسات العمل'}</strong>)، وبعد التحقق من التفاصيل الآتية:<br><br><span style="color:#475569;font-style:italic;">"${c.desc}"</span><br><br>فإننا نوجه إليكم <strong>لفت النظر هذا</strong>، مؤكدين على أهمية الالتزام التام بسياسات العمل ومعايير الجودة المعتمدة لدينا.`;
  else if(wType==='repeat')text+=`نظراً لورود شكوى جديدة برقم (<strong>${c.ref}</strong>) تتعلق <strong>بنفس المخالفة السابقة</strong> (<strong>${c.ctype}</strong>)، فإننا نوجه إليكم هذا <strong>الإنذار الكتابي</strong> لتكرار نفس المخالفة رغم التوجيهات السابقة.`;
  else text+=`لوحظ تعدد الملاحظات على أدائكم، وآخرها الشكوى برقم (<strong>${c.ref}</strong>) بخصوص (<strong>${c.ctype}</strong>). وعليه نوجه إليكم هذا <strong>الإنذار الكتابي لتراكم المخالفات</strong>.`;
  text+=`<br><br>مع خالص التحيات،<br><strong>${ownerName}</strong>`;
  const w={id:'W'+Date.now(),ref:c.ref,emp,branch:c.branch,ctype:c.ctype,title,text,ts:nowISO(),status:'draft',seenBy:{}};
  warnings.unshift(w);saveW();
  goPage('warnings');showToast('تم تجهيز مسودة لفت النظر','ok');
  setTimeout(()=>reviewA4(w.id),500);
}

let currentA4=null;
function reviewA4(id){
  currentA4=warnings.find(w=>w.id===id);if(!currentA4)return;
  const r=session.role,isOwner=r==='owner',canM=r==='owner'||r==='admin'||r==='maint';
  const logoEl=document.getElementById('a4-logo');if(logoEl){logoEl.textContent='اي ام سبيشل';logoEl.contentEditable=isOwner?'true':'false';}
  const titleEl=document.getElementById('a4-title');titleEl.textContent=currentA4.title;titleEl.contentEditable=isOwner?'true':'false';
  const ca=document.getElementById('a4-content');ca.innerHTML=currentA4.text;ca.contentEditable=isOwner?'true':'false';
  document.getElementById('a4-date').textContent=fmtShort(currentA4.ts);
  const sigEl=document.getElementById('a4-sig-img');
  if(signatureBase64&&currentA4.status==='approved'){sigEl.src=signatureBase64;sigEl.style.display='inline-block';}else sigEl.style.display='none';
  const tb=document.getElementById('a4-toolbar');if(tb)tb.style.display=isOwner?'flex':'none';
  let actionsHTML='';
  if(isOwner){
    if(currentA4.status==='draft'||currentA4.status==='revoked')actionsHTML=`<button class="btn pri" onclick="saveAndApproveWarning('${id}')">حفظ واعتماد</button><button class="btn" onclick="saveWarningText('${id}')">حفظ التعديلات</button><button class="btn dan" onclick="excludeWarning('${id}')">استبعاد</button><button class="btn" onclick="closeA4()">إغلاق</button>`;
    else if(currentA4.status==='approved')actionsHTML=`<button class="btn" onclick="saveWarningText('${id}')">حفظ التعديلات</button><button class="btn amb" onclick="revokeWarning('${id}')">سحب الإنذار</button><button class="btn" onclick="closeA4()">إغلاق</button>`;
    else actionsHTML=`<button class="btn" onclick="closeA4()">إغلاق</button>`;
  } else if(canM){
    if(currentA4.status==='draft'||currentA4.status==='revoked')actionsHTML=`<button class="btn pri" onclick="approveWarning('${id}')">اعتماد وإرسال</button><button class="btn dan" onclick="excludeWarning('${id}')">استبعاد</button><button class="btn" onclick="closeA4()">إغلاق</button>`;
    else if(currentA4.status==='approved')actionsHTML=`<button class="btn amb" onclick="revokeWarning('${id}')">سحب الإنذار</button><button class="btn" onclick="closeA4()">إغلاق</button>`;
    else actionsHTML=`<button class="btn" onclick="closeA4()">إغلاق</button>`;
  } else actionsHTML=`<button class="btn" onclick="closeA4()">إغلاق</button>`;
  document.getElementById('a4-actions').innerHTML=actionsHTML;
  document.getElementById('a4-modal').classList.add('on');
  if(isOwner)setTimeout(()=>ca.focus(),100);
}

function saveAndApproveWarning(id){saveWarningText(id);setTimeout(()=>approveWarning(id),100);}
function execCmd(cmd,val=null){document.execCommand(cmd,false,val);document.getElementById('a4-content').focus();}
function saveWarningText(id){const w=warnings.find(x=>x.id===id);if(!w||session.role!=='owner')return;w.text=document.getElementById('a4-content').innerHTML;w.title=document.getElementById('a4-title').textContent;saveW();showToast('تم حفظ التعديلات','ok');}
function closeA4(){document.getElementById('a4-modal').classList.remove('on');}
function approveWarning(id){
  const w=warnings.find(x=>x.id===id);if(!w)return;w.status='approved';saveW();
  const c=complaints.find(x=>x.ref===w.ref);
  const ownerName=getOwnerDisplayName();
  if(c){c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:`تم اعتماد "${w.title}" للموظفة ${w.emp}`});saveC();branchMsgs.unshift({id:'bm-'+Date.now(),branch:c.branch,complaintRef:c.ref,from:ownerName,ts:nowISO(),seenBy:{},text:`تم إصدار واعتماد "${w.title}" للموظفة ${c.branchEmployee}، يمكن مراجعته من سجل الإنذارات في النظام.`,type:'warning'});saveBM();}
  closeA4();renderWarnings();showToast('تم اعتماد الإنذار','ok');updateDots();
}
function revokeWarning(id){
  if(!confirm('هل أنت متأكد من سحب هذا الإنذار؟'))return;
  const w=warnings.find(x=>x.id===id);if(!w)return;w.status='revoked';saveW();
  const c=complaints.find(x=>x.ref===w.ref);if(c){c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:`تم سحب "${w.title}" للموظفة ${w.emp}`});saveC();}
  closeA4();renderWarnings();showToast('تم سحب الإنذار','ok');
}
function excludeWarning(id){
  if(!confirm('استبعاد نهائي؟'))return;
  const w=warnings.find(x=>x.id===id);if(!w)return;w.status='excluded';saveW();
  // حذف الإنذار من رسائل الفروع عند الاستبعاد
  branchMsgs=branchMsgs.filter(bm=>!(bm.type==='warning'&&bm.complaintRef===w.ref));saveBM();
  closeA4();renderWarnings();showToast('تم الاستبعاد','ok');
}

function renderStats(){
  const el=document.getElementById('stats-content');
  const msToH=ms=>{if(!ms||ms<0)return'—';const h=Math.floor(ms/3600000),d=Math.floor(h/24);if(d>0)return`${d} يوم`;if(h>0)return`${h} ساعة`;return'أقل من ساعة';};
  const done=complaints.filter(c=>c.status==='تمت المعالجة'),total=complaints.length;
  const closedC=complaints.filter(c=>isDone(c)).length,closeRate=total?Math.round(closedC/total*100):0;
  let avgDoneMs=0;if(done.length){const times=done.map(c=>{const last=(c.audit||[]).filter(a=>a.body&&a.body.includes('تمت المعالجة'));if(!last.length)return null;return new Date(last[last.length-1].ts)-new Date(c.createdAt);}).filter(x=>x!==null);if(times.length)avgDoneMs=times.reduce((a,b)=>a+b,0)/times.length;}
  let avgRespMs=0;const withResp=complaints.filter(c=>c.audit&&c.audit.length>1);if(withResp.length){const rts=withResp.map(c=>{const f=c.audit.find(a=>a.uid!=='sys'&&a.ts!==c.audit[0].ts);if(!f)return null;return new Date(f.ts)-new Date(c.createdAt);}).filter(x=>x!==null&&x>0);if(rts.length)avgRespMs=rts.reduce((a,b)=>a+b,0)/rts.length;}
  el.innerHTML=`<div class="stats-grid"><div class="stat-box"><h3>مؤشرات الشكاوى</h3><div class="stat-row"><span class="stat-lbl">إجمالي الشكاوى</span><span class="stat-val">${total}</span></div><div class="stat-row"><span class="stat-lbl">تمت المعالجة</span><span class="stat-val">${done.length}</span></div><div class="stat-row"><span class="stat-lbl">نسبة الإغلاق</span><span class="stat-val">${closeRate}%</span></div><div class="stat-row"><span class="stat-lbl">متوسط وقت المعالجة</span><span class="stat-val">${msToH(avgDoneMs)}</span></div><div class="stat-row"><span class="stat-lbl">متوسط الاستجابة الأولى</span><span class="stat-val">${msToH(avgRespMs)}</span></div></div></div>
  <div class="stats-grid"><div class="stat-mini"><div class="sn">${complaints.filter(c=>c.negative).length}</div><div class="sl">تقييمات سلبية</div></div><div class="stat-mini"><div class="sn">${complaints.filter(c=>c.financial).length}</div><div class="sl">مطالبات مالية</div></div><div class="stat-mini"><div class="sn">${messages.filter(m=>!m.converted).length}</div><div class="sl">رسائل عملاء جديدة</div></div><div class="stat-mini"><div class="sn">${warnings.filter(w=>w.status==='approved').length}</div><div class="sl">إنذارات معتمدة</div></div></div>`;
}

function runFilter(){
  renderCtypeForm();
  const brs=Array.from(document.querySelectorAll('#fb-wrap input:checked')).map(x=>x.value);
  const tps=Array.from(document.querySelectorAll('#ft-wrap input:checked')).map(x=>x.value);
  const sts=Array.from(document.querySelectorAll('#fst-wrap input:checked')).map(x=>x.value);
  let res=[...complaints];
  if(session.role==='branch')res=res.filter(c=>c.branch===session.branch);
  if(brs.length)res=res.filter(c=>brs.includes(c.branch));
  if(tps.length)res=res.filter(c=>tps.includes(c.ctype));
  if(sts.length)res=res.filter(c=>sts.includes(c.status));
  const done=res.filter(c=>c.status==='تمت المعالجة'),closedC=res.filter(c=>isDone(c)).length,closeRate=res.length?Math.round(closedC/res.length*100):0;
  const msToH=ms=>{if(!ms||ms<0)return'—';const h=Math.floor(ms/3600000),d=Math.floor(h/24);if(d>0)return`${d} يوم`;if(h>0)return`${h} ساعة`;return'أقل من ساعة';};
  let avgMs=0;if(done.length){const times=done.map(c=>{const last=(c.audit||[]).filter(a=>a.body&&a.body.includes('تمت المعالجة'));if(!last.length)return null;return new Date(last[last.length-1].ts)-new Date(c.createdAt);}).filter(x=>x!==null);if(times.length)avgMs=times.reduce((a,b)=>a+b,0)/times.length;}
  document.getElementById('filter-stats').innerHTML=`<h3>إحصائيات حسب التصفية</h3><div class="stat-row"><span class="stat-lbl">عدد الشكاوى</span><span class="stat-val">${res.length}</span></div><div class="stat-row"><span class="stat-lbl">متوسط المعالجة</span><span class="stat-val">${msToH(avgMs)}</span></div><div class="stat-row"><span class="stat-lbl">نسبة الإغلاق</span><span class="stat-val">${closeRate}%</span></div>`;
  document.getElementById('filter-count').textContent=`النتائج: ${res.length} شكوى مطابقة`;
  document.getElementById('filter-res').innerHTML=res.length?res.map(c=>cCard(c,session.role)).join(''):`<div class="empty"><p>لا توجد نتائج مطابقة</p></div>`;
}
function clearFilters(){document.querySelectorAll('#page-filter input[type=checkbox]').forEach(x=>x.checked=false);runFilter();}

function renderRep(){
  const el=document.getElementById('rep-content');const r=session.role;
  if(r!=='cs'&&r!=='owner'&&r!=='maint'&&r!=='admin'){el.innerHTML=`<div class="no-access"><h3>تم إلغاء صلاحية وصولك لهذه الصفحة</h3></div>`;return;}
  const threeM=Date.now()-90*24*3600000,recent=complaints.filter(c=>new Date(c.createdAt).getTime()>threeM);
  const cc={},ec={},bc={},tc={};
  complaints.forEach(c=>{const cl=c.client||'—';cc[cl]=(cc[cl]||0)+1;if(c.hasEmp&&c.branchEmployee)ec[c.branchEmployee]=(ec[c.branchEmployee]||0)+1;bc[c.branch]=(bc[c.branch]||0)+1;if(c.ctype)tc[c.ctype]=(tc[c.ctype]||0)+1;});
  const rcc={},rec={},rbc={},rtc={};
  recent.forEach(c=>{const cl=c.client||'—';rcc[cl]=(rcc[cl]||0)+1;if(c.hasEmp&&c.branchEmployee)rec[c.branchEmployee]=(rec[c.branchEmployee]||0)+1;rbc[c.branch]=(rbc[c.branch]||0)+1;if(c.ctype)rtc[c.ctype]=(rtc[c.ctype]||0)+1;});
  const sorted=obj=>Object.entries(obj).sort((a,b)=>b[1]-a[1]);
  const filtered=obj=>sorted(obj).filter(([,cnt])=>cnt>3);
  const allRisks=[...Object.entries(rcc).filter(([,n])=>n>=3).map(([nm,cnt])=>({nm,cnt,cat:'عميل'})),...Object.entries(rec).filter(([,n])=>n>=3).map(([nm,cnt])=>({nm,cnt,cat:'موظفة'})),...Object.entries(rbc).filter(([,n])=>n>=3).map(([nm,cnt])=>({nm,cnt,cat:'فرع'})),...Object.entries(rtc).filter(([,n])=>n>=3).map(([nm,cnt])=>({nm,cnt,cat:'نوع شكوى'}))].sort((a,b)=>b.cnt-a.cnt);
  let riskHTML=!allRisks.length?`<div class="risk-safe-banner"><div class="risk-safe-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--gn)"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg></div><div class="risk-safe-txt">مؤشر مخاطر السمعة منخفض وإيجابي</div><div class="risk-safe-sub">لا توجد مخاطر متكررة خلال آخر ٣ أشهر</div></div>`:`<div class="risk-grid">${allRisks.map(({nm,cnt,cat})=>{let cls='risk-card-y',level='تحذير';if(cnt>5){cls='risk-card-r';level='خطر عالٍ';}else if(cnt===5){cls='risk-card-o';level='تصاعد';}return`<div class="risk-card ${cls}"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="risk-card-count">${cnt}</div><div class="risk-card-name">${nm}</div></div><span class="risk-card-badge">${cat}</span></div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px"><div class="risk-card-label">تكرار / ٣ أشهر</div><span class="risk-card-badge">${level}</span></div></div>`;}).join('')}</div>`;
  const buildSec=(title,data)=>{if(!data.length)return'';const maxV=data[0][1];const fills=['#4f46e5','#7c3aed','#e11d48','#ea580c','#059669','#0ea5e9','#65a30d'];return`<div class="rep-section"><div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><span style="font-size:.93rem;font-weight:800;color:var(--tx)">${title}</span></div>${data.map(([name,cnt],i)=>`<div class="rep-row"><div class="rep-rank">${i+1}</div><div class="rep-name">${name}</div><div class="rep-track"><div class="rep-fill" style="width:${Math.round(cnt/maxV*100)}%;background:${fills[i%fills.length]}"></div></div><div class="rep-cnt" style="color:${fills[i%fills.length]}">${cnt}</div></div>`).join('')}</div>`;};
  const fCC=filtered(cc),fEC=filtered(ec),fBC=filtered(bc),fTC=filtered(tc);
  const hasData=fCC.length||fEC.length||fBC.length||fTC.length;
  el.innerHTML=`<div class="rep-page"><div class="rep-section"><div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><span style="font-size:.93rem;font-weight:800;color:var(--tx)">مخاطر السمعة النشطة</span><span style="font-size:.73rem;font-weight:600;color:var(--mu);margin-right:auto">آخر ٣ أشهر</span></div>${riskHTML}</div>${!hasData?`<div class="rep-section" style="text-align:center;padding:28px"><div style="font-size:.93rem;font-weight:700;color:var(--tx)">لا توجد بيانات كافية حالياً</div><div style="font-size:.83rem;color:var(--mu);margin-top:5px">تظهر المؤشرات عند تجاوز ٣ تكرارات</div></div>`:''}${buildSec('العملاء الأكثر تكراراً',fCC)}${buildSec('الموظفات المشار إليهن',fEC)}${buildSec('تحليل الفروع',fBC)}${buildSec('تكرار أنواع الشكاوى',fTC)}</div>`;
}

function gSearch(q){
  const drop=document.getElementById('gdrop');q=q.trim().toLowerCase();
  if(!q){drop.style.display='none';return;}
  let pool=[...complaints];
  if(session.role==='branch')pool=pool.filter(c=>c.branch===session.branch);
  const res=pool.filter(c=>c.ref.toLowerCase().includes(q)||(c.client||'').toLowerCase().includes(q)||(c.child||'').toLowerCase().includes(q)||c.mobile.includes(q)).slice(0,7);
  if(!res.length){drop.innerHTML=`<div class="di" style="color:var(--mu2);text-align:center">لا توجد نتائج</div>`;drop.style.display='block';return;}
  drop.innerHTML=res.map(c=>`<div class="di" onclick="jumpTo('${c.ref}')"><div class="di-ref">${c.ref}</div><div class="di-name">${c.client||'—'} — ${c.child||'—'}</div><div class="di-sub">${c.branch} | ${fmtShort(c.createdAt)}</div></div>`).join('');
  drop.style.display='block';
}
function jumpTo(ref){document.getElementById('gdrop').style.display='none';document.getElementById('gs').value='';goPage('list');setTimeout(()=>showDetail(ref),80);}
document.addEventListener('click',e=>{if(!e.target.closest('.tbsearch'))document.getElementById('gdrop').style.display='none';});

function renderSettings(){
  document.getElementById('users-list').innerHTML=users.map(u=>`<div class="ucard">
    <div><div class="un">${u.name}${u.branch?' — '+u.branch:''}</div><div class="ur">${{owner:'الإدارة العليا',admin:'الإدارة',branch:'مديرة الفرع',cs:'خدمة العملاء'}[u.role]||u.role}</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${u.role!=='owner'?`<button class="btn" style="font-size:.78rem;padding:6px 12px" onclick="editPass('${u.id}')">تغيير كلمة المرور</button>`:'<span style="font-size:.75rem;color:var(--mu);padding:6px 12px">الرقم يتغير بحسب التاريخ</span>'}
      <button class="btn" style="font-size:.78rem;padding:6px 12px" onclick="editName('${u.id}')">تغيير الاسم</button>
      ${u.role!=='owner'?`<button class="btn dan" style="font-size:.78rem;padding:6px 12px" onclick="delUser('${u.id}')">حذف</button>`:''}
    </div>
  </div>`).join('');
}
function editPass(id){const u=users.find(x=>x.id===id);if(!u)return;if(u.role==='owner'){showToast('رقم الإدارة العليا يتغير تلقائياً بحسب التاريخ','err');return;}const p=prompt('الرقم السري الجديد (4 أرقام):');if(!p||p.length!==4)return;u.pass=p;sv();showToast('تم تحديث الرقم السري','ok');}
function editName(id){const u=users.find(x=>x.id===id);if(!u)return;const n=prompt('الاسم الجديد:',u.name);if(!n)return;u.name=n;sv();renderSettings();showToast('تم تحديث الاسم','ok');}
function delUser(id){if(!confirm('حذف المستخدم نهائياً؟'))return;users=users.filter(x=>x.id!==id);sv();renderSettings();showToast('تم الحذف','ok');}
function showAddUser(){document.getElementById('add-user-form').style.display='block';}
function toggleBF(){document.getElementById('nu-bwrap').style.display=document.getElementById('nu-role').value==='branch'?'block':'none';}
function saveNewUser(){
  const name=document.getElementById('nu-name').value.trim();
  const role=document.getElementById('nu-role').value;
  const pass=document.getElementById('nu-pass').value;
  const branch=role==='branch'?document.getElementById('nu-branch').value:null;
  if(!name||!pass||pass.length!==4){showToast('يرجى تعبئة جميع الحقول وتأكد أن كلمة المرور 4 أرقام','err');return;}
  users.push({id:`${role}-${Date.now()}`,name,role,pass,branch});sv();renderSettings();
  document.getElementById('add-user-form').style.display='none';
  document.getElementById('nu-name').value='';document.getElementById('nu-pass').value='';
  showToast('تم إضافة المستخدم','ok');
}

function toggleSb(){const s=document.getElementById('sidebar'),o=document.getElementById('sbov');const cl=s.classList.toggle('cl');o.classList.toggle('on',!cl);}
function closeSb(){document.getElementById('sidebar').classList.add('cl');document.getElementById('sbov').classList.remove('on');}
function doCopy(t){navigator.clipboard.writeText(t).then(()=>showToast('تم النسخ','ok')).catch(()=>{const e=document.createElement('textarea');e.value=t;document.body.appendChild(e);e.select();document.execCommand('copy');document.body.removeChild(e);showToast('تم النسخ','ok');});}
function showModal(t,m){document.getElementById('m-title').textContent=t||'';document.getElementById('m-msg').textContent=m;document.getElementById('modal').classList.add('on');}
function closeModal(){document.getElementById('modal').classList.remove('on');}
let _toastTimer=null;
function showToast(msg,type=''){
  const t=document.getElementById('toast');
  if(_toastTimer){clearTimeout(_toastTimer);t.classList.remove('on');}
  void t.offsetWidth;
  t.textContent=msg;t.className=`toast ${type} on`;
  _toastTimer=setTimeout(()=>{t.classList.remove('on');_toastTimer=null;},2800);
}

let fsLevel=parseFloat(localStorage.getItem('ims_fs')||'1');
function applyFontSize(){document.documentElement.style.fontSize=(fsLevel*16)+'px';const el=document.getElementById('fs-val');if(el)el.textContent=Math.round(fsLevel*100)+'%';localStorage.setItem('ims_fs',fsLevel);}
function changeFontSize(dir){const steps=[0.8,0.875,0.95,1,1.075,1.15,1.25];const idx=steps.reduce((b,v,i)=>Math.abs(v-fsLevel)<Math.abs(steps[b]-fsLevel)?i:b,0);fsLevel=steps[Math.max(0,Math.min(steps.length-1,idx+dir))];applyFontSize();}
applyFontSize();

const MOON_SVG=`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const SUN_SVG=`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

let isDark=localStorage.getItem('ims_dark')==='1';
function applyTheme(){document.documentElement.setAttribute('data-theme',isDark?'dark':'');const icon=isDark?SUN_SVG:MOON_SVG;['theme-btn-login','theme-btn-app'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=icon;});localStorage.setItem('ims_dark',isDark?'1':'0');}
function toggleTheme(){isDark=!isDark;applyTheme();}
applyTheme();

Object.assign(window,{
  openPinOverlay,closePinOverlay,pinInput,pinKey,checkPin,
  buildRoleGrid,selRole,openBranchEmpLogin,selectBranchEmp,
  closeBranchLoginScr,backRoles,doLogin,logout,saveMyPass,
  initApp,buildBottomNav,bnavGo,updateBNavActive,updateBNavDots,
  toggleMoreDrawer,closeMoreDrawer,updateDots,setDot,toggleSb,closeSb,
  openMaint,closeMaint,submitMaintPass,renderMaintPanel,
  showMpMsg,uploadSignature,clearSignature,
  mpUsersHTML,mpListHTML,mpEmpHTML,mpBWAHTML,
  changeMaintPass,mpRename,mpChPass,mpDelU,mpAddUser,
  mpAdd,mpEdit,mpDel,mpRenameEmp,mpDelEmp,mpAddEmp,mpToggleEmpType,mpSaveBWA,
  renderAllForms,renderCtypeForm,renderSentimentForm,renderDemoForm,
  setG,cond,genRefUI,goPage,previewC,closePrev,confirmSubmit,clearForm,
  renderList,setTab,markSeen,showDetail,closeDetail,
  renderDetail,renderOwnerDetail,renderBranchDetail,
  saveBranchEmployee,renderFullDetail,toggleDetailMode,startEdit,saveEdit,
  sendSummaryToAdminWA,tryDelete,changeStatus,saveComment,
  toggleTask,togglePriority,requestClarification,
  renderMsgs,convertMsg,renderBranchMsgs,goToComplaintFromMsg,renderOwnerCast,
  openOwnerSendModal,closeOwnerSendModal,selectAllBranches,clearAllBranches,
  sendOwnerCast,editOwnerMsg,deleteOwnerMsg,renderWarnings,sendOwnerWarning,
  reviewA4,saveAndApproveWarning,execCmd,saveWarningText,
  closeA4,approveWarning,revokeWarning,excludeWarning,
  renderStats,runFilter,clearFilters,renderRep,gSearch,jumpTo,
  renderSettings,editPass,editName,delUser,showAddUser,toggleBF,saveNewUser,
  doCopy,showModal,closeModal,showToast,applyFontSize,changeFontSize,applyTheme,toggleTheme,
  getOwnerDisplayName,
  _getUsers:()=>users,
  _getSession:()=>session,
  _setSession:s=>{session=s;saveS(s);},
  _getMaintPass:()=>maintPass,
  _getData:()=>({users,ctypes,sentiments,demos,employees,branchWA,adminWANum,signatureBase64,maintPass}),
  _setAdminWANum:v=>{adminWANum=v;sv();},
  _clearComplaints:()=>{complaints=[];saveC();},
  _clearMessages:()=>{messages=[];saveM();},
  _clearWarnings:()=>{warnings=[];saveW();},
});

try {
  const remote=await loadAllFromFirestore();
  if(remote.config)            _applyConfigToState(remote.config);
  if(remote.complaints?.items) complaints=remote.complaints.items;
  if(remote.messages?.items)   messages=remote.messages.items;
  if(remote.branchMsgs?.items) branchMsgs=remote.branchMsgs.items;
  if(remote.warnings?.items)   warnings=remote.warnings.items;
} catch(err){ console.warn('[IMS] تعذّر التزامن الأولي:',err); }

setupRealtimeListeners();
if(session) initApp(); else buildRoleGrid();
