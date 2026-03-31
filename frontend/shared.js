/* shared.js — loaded by every page */
'use strict';
const API = 'https://waste-mgmt-l1l1.onrender.com/api';

/* ── AUTH ────────────────────────────────────────────────────────── */
function getToken(){ return sessionStorage.getItem('wms_token'); }
function getUser(){  try{ return JSON.parse(sessionStorage.getItem('wms_user')||'null'); }catch{ return null; } }
function requireAuth(){
  if(!getToken()){ window.location.href='login.html'; return false; }
  return true;
}
function logout(){
  sessionStorage.removeItem('wms_token');
  sessionStorage.removeItem('wms_user');
  window.location.href='login.html';
}

/* ── FETCH HELPERS ───────────────────────────────────────────────── */
async function apiFetch(path, opts={}){
  const headers={'Content-Type':'application/json',...(opts.headers||{})};
  if(getToken()) headers['x-auth-token']=getToken();
  const res=await fetch(API+path,{...opts,headers});
  const data=await res.json().catch(()=>({}));
  return {ok:res.ok,status:res.status,data};
}
const apiGet=(path)=>apiFetch(path);
const apiPost=(path,body)=>apiFetch(path,{method:'POST',body:JSON.stringify(body)});
const apiPut=(path,body)=>apiFetch(path,{method:'PUT',body:JSON.stringify(body)});
const apiDel=(path)=>apiFetch(path,{method:'DELETE'});

/* ── TOAST ───────────────────────────────────────────────────────── */
function toast(msg,type='ok'){
  const el=document.getElementById('toast');
  if(!el)return;
  el.textContent=msg;
  el.className='show'+(type==='err'?' t-err':type==='warn'?' t-warn':'');
  clearTimeout(el._t);
  el._t=setTimeout(()=>el.className='',3500);
}

/* ── DARK MODE ───────────────────────────────────────────────────── */
function initTheme(){
  const saved=localStorage.getItem('wms_theme')||'light';
  document.documentElement.setAttribute('data-theme',saved);
  updateThemeBtn();
}
function toggleTheme(){
  const cur=document.documentElement.getAttribute('data-theme');
  const next=cur==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',next);
  localStorage.setItem('wms_theme',next);
  updateThemeBtn();
}
function updateThemeBtn(){
  const btn=document.getElementById('theme-btn');
  if(btn) btn.textContent=document.documentElement.getAttribute('data-theme')==='dark'?'☀️':'🌙';
}

/* ── FORMAT HELPERS ──────────────────────────────────────────────── */
function fmtDate(d){ return d?new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—'; }
function fmtDateTime(d){ return d?new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'; }
function fmtNum(n){ return Number(n||0).toLocaleString('en-IN'); }
function sanitize(s){ return typeof s==='string'?s.replace(/[<>"'%;()&+]/g,'').trim():s; }

/* ── FILL BAR ────────────────────────────────────────────────────── */
function fillBar(pct){
  const p=Math.min(100,Math.max(0,pct||0));
  const col=p>80?'#ef4444':p>50?'#f59e0b':'#22c55e';
  const textCol=p>80?'#ef4444':p>50?'#d97706':'#16a34a';
  return `<div class="fill-wrap">
    <div class="fill-track"><div class="fill-bar" style="width:${p}%;background:${col}"></div></div>
    <span class="fill-pct" style="color:${textCol}">${p}%</span>
  </div>`;
}

/* ── BADGES ──────────────────────────────────────────────────────── */
function statusBadge(s){
  const map={pending:'badge-amber',in_progress:'badge-blue',resolved:'badge-green',
             active:'badge-green',idle:'badge-gray',maintenance:'badge-red',
             general:'badge-gray',recyclable:'badge-blue',organic:'badge-green',hazardous:'badge-red'};
  return `<span class="badge ${map[s]||'badge-gray'}">${(s||'').replace('_',' ')}</span>`;
}
function priorityBadge(p){
  return `<span class="badge ${p==='urgent'?'badge-red':p==='moderate'?'badge-amber':'badge-green'}">${p}</span>`;
}

/* ── SIDEBAR BUILDER ─────────────────────────────────────────────── */
const NAV=[
  {section:'Overview'},
  {icon:'📊',label:'Dashboard',href:'dashboard.html'},
  {section:'City Management'},
  {icon:'👥',label:'Citizens',href:'citizens.html'},
  {icon:'🗑',label:'Smart Bins',href:'bins.html'},
  {icon:'🚛',label:'Trucks & Routes',href:'trucks.html'},
  {icon:'📋',label:'Complaints',href:'complaints.html'},
  {section:'Analytics'},
  {icon:'🗺',label:'Live Map',href:'map.html'},
  {icon:'🤖',label:'AI Predictions',href:'ai.html'},
];

function buildSidebar(activePage){
  const user=getUser()||{name:'Admin',role:'admin'};
  const initials=user.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();

  let navHtml='';
  for(const item of NAV){
    if(item.section){
      navHtml+=`<div class="nav-section"><div class="nav-section-label">${item.section}</div>`;
    } else {
      const active=item.href===activePage?'active':'';
      navHtml+=`<a href="${item.href}" class="nav-item ${active}">
        <span class="nav-icon">${item.icon}</span>${item.label}
      </a>`;
      if(item.href==='complaints.html'&&window._complaintCount){
        navHtml=navHtml.replace('</a>',`<span class="nav-badge" id="nav-complaint-badge">${window._complaintCount}</span></a>`);
      }
    }
    if(!item.href&&!item.section&&NAV[NAV.indexOf(item)+1]?.section){navHtml+='</div>';}
    else if(item.href&&NAV[NAV.indexOf(item)+1]?.section){navHtml+='</div>';}
  }
  navHtml+='</div>';

  return `
  <div class="sidebar" id="sidebar">
    <div class="sidebar-brand">
      <div class="logo-box">♻️</div>
      <div class="brand-text">
        <strong>WasteIQ</strong>
        <span>PMC Dashboard</span>
      </div>
    </div>
    <div class="sidebar-user">
      <div class="avatar">${initials}</div>
      <div class="user-info">
        <strong>${user.name}</strong>
        <span>${user.role==='admin'?'Administrator':'Zone Officer'}</span>
      </div>
    </div>
    <nav class="sidebar-nav">${navHtml}</nav>
    <div class="sidebar-footer">
      <button class="btn-logout" onclick="logout()">
        <span>🚪</span> Sign Out
      </button>
    </div>
  </div>
  <div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()"></div>`;
}

function buildTopbar(title,breadcrumb=''){
  return `
  <div class="topbar">
    <button class="ham" onclick="openSidebar()" aria-label="Menu">
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
    </button>
    <div>
      <div class="topbar-title">${title}</div>
      ${breadcrumb?`<div class="topbar-breadcrumb">${breadcrumb}</div>`:''}
    </div>
    <div class="topbar-right">
      <button class="topbar-btn" id="theme-btn" onclick="toggleTheme()" title="Toggle dark mode">🌙</button>
      <button class="topbar-btn" id="notif-btn" onclick="toggleNotifPanel()" title="Notifications">
        🔔<span class="notif-dot" id="notif-dot" style="display:none"></span>
      </button>
    </div>
  </div>
  ${buildNotifPanel()}`;
}

function buildNotifPanel(){
  return `<div class="notif-panel" id="notif-panel">
    <div class="notif-head">
      <h4>🔔 Notifications</h4>
      <button class="btn btn-sm btn-secondary" onclick="markAllRead()">Mark all read</button>
    </div>
    <div class="notif-list" id="notif-list"><div class="empty-state"><div class="empty-icon">🔕</div><p>No notifications</p></div></div>
  </div>`;
}

function openSidebar(){
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebar-overlay')?.classList.add('show');
}
function closeSidebar(){
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('show');
}

async function loadNotifications(){
  try{
    const {data}=await apiGet('/notifications');
    const unread=data.filter(n=>!n.is_read).length;
    const dot=document.getElementById('notif-dot');
    const badge=document.getElementById('nav-notif-badge');
    if(dot) dot.style.display=unread?'block':'none';
    if(badge) badge.textContent=unread;

    const list=document.getElementById('notif-list');
    if(!list)return;
    if(!data.length){list.innerHTML='<div class="empty-state"><div class="empty-icon">🔕</div><p>No notifications</p></div>';return;}
    list.innerHTML=data.slice(0,20).map(n=>`
      <div class="notif-item ${n.is_read?'':'unread'}">
        <div class="notif-item-icon ${n.type}">${n.type==='alert'?'🚨':n.type==='complaint'?'📢':'ℹ️'}</div>
        <div><strong>${n.title}</strong><span>${n.message||''}<br>${fmtDateTime(n.created_at)}</span></div>
      </div>`).join('');
  }catch{}
}

function toggleNotifPanel(){
  const p=document.getElementById('notif-panel');
  p?.classList.toggle('open');
}

async function markAllRead(){
  await apiPut('/notifications/read-all',{});
  loadNotifications();
  toast('All notifications marked as read');
}

/* ── CHART DEFAULTS ──────────────────────────────────────────────── */
function chartDefaults(){
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  return {
    fontColor: dark?'#8b949e':'#6b7280',
    gridColor: dark?'rgba(255,255,255,.06)':'rgba(0,0,0,.06)',
    tooltipBg: dark?'#1c2128':'#111827',
    font: "'DM Sans', sans-serif",
  };
}
function applyChartDefaults(cd){
  if(!window.Chart)return;
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  Chart.defaults.color=cd.fontColor;
  Chart.defaults.font.family=cd.font;
  Chart.defaults.plugins.tooltip.backgroundColor=cd.tooltipBg;
  Chart.defaults.plugins.tooltip.padding=10;
  Chart.defaults.plugins.tooltip.cornerRadius=8;
  Chart.defaults.plugins.tooltip.titleFont={family:cd.font,weight:'bold',size:13};
}

/* ── PAGE INIT HELPER ────────────────────────────────────────────── */
function pageInit(pageName,title,breadcrumb=''){
  if(!requireAuth())return false;
  initTheme();
  document.body.innerHTML=`
    ${buildSidebar(pageName)}
    <div class="main-wrap">
      ${buildTopbar(title,breadcrumb)}
      <div class="page-content" id="page-content"></div>
    </div>
    <div id="toast"></div>`;
  loadNotifications();
  setInterval(loadNotifications,30000);
  return true;
}
