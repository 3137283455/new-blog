'use strict';
const $ = id => document.getElementById(id);
const directions = {rx:'仅接收 RX',tx:'仅发送 TX',sum:'双向相加 RX + TX',max:'双向取大 max(RX, TX)'};
let nodes = [], selected = '', days = 30, page = 'fleet', editing = null, credential = null;
let timer, toastTimer, wizardStep=1, detailVersion=0;
let ingestUrl = new URL('./api/ingest', location.href).href;
let sshSetupId = '';
let deleting = null;
function notifyParent(type) {
  if (window.parent !== window) window.parent.postMessage({type}, location.origin);
}
function openDialog(dialog) {
  if (window.parent !== window) window.parent.postMessage({type:'boke-traffic-dialog',open:true},location.origin);
  dialog.showModal();
}
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close', () => {
  if (window.parent !== window) window.parent.postMessage({type:'boke-traffic-dialog',open:!!document.querySelector('dialog[open]')},location.origin);
}));
function matchAdminAppearance() {
  if (window.parent === window) return;
  try {
    const parent = window.parent, root = document.documentElement;
    const shell = parent.document.querySelector('.admin-shell');
    const card = parent.document.querySelector('#dashboard-panel .ryu-card, .admin-shell .ryu-card');
    // The outer add button is disabled during bootstrap; do not inherit its greyed-out styling.
    const button = parent.document.querySelector('.admin-shell .ryu-btn-primary:not(:disabled)');
    if (shell) root.style.setProperty('--admin-font', parent.getComputedStyle(shell).fontFamily);
    if (card) {
      const style = parent.getComputedStyle(card);
      root.style.setProperty('--admin-card-background', style.background);
      root.style.setProperty('--admin-card-radius', style.borderRadius);
      root.style.setProperty('--admin-card-shadow', style.boxShadow);
      root.style.setProperty('--line', style.borderTopColor);
      root.style.setProperty('--ink', style.color);
    }
    if (button) {
      const style = parent.getComputedStyle(button);
      root.style.setProperty('--admin-primary-background', style.background);
      root.style.setProperty('--admin-primary-color', style.color);
    }
  } catch { /* Standalone preview retains the matching fallback styles. */ }
}
matchAdminAppearance();
let sizeFrame = 0;
new ResizeObserver(() => {
  cancelAnimationFrame(sizeFrame);
  sizeFrame = requestAnimationFrame(() => {
    if (window.parent !== window) window.parent.postMessage({type:'boke-traffic-size',height:Math.ceil(document.body.getBoundingClientRect().height)},location.origin);
  });
}).observe(document.body);
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== window.parent) return;
  if (event.data?.type === 'boke-traffic-add-node') openSettings(true);
  if (event.data?.type === 'boke-traffic-help') openDialog($('help-dialog'));
  if (event.data?.type === 'boke-traffic-refresh') refresh();
});
const connectionNames={waiting:'等待接入',collecting:'已连接 · 待采样',online:'连接正常',delayed:'采样延迟',offline:'离线'};
const setText = (id, value) => { $(id).textContent = value; };
function toast(message) { setText('toast',message); $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').hidden=true,5000); }
function element(tag, text, className) { const e=document.createElement(tag); if(text!==undefined)e.textContent=text; if(className)e.className=className; return e; }
async function api(path, body) {
  const response = await fetch(`./api/${path}`, {method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json','X-Traffic-Request':'1'},body:body===undefined?undefined:JSON.stringify(body)});
  const data = await response.json();
  if (!response.ok) { if(response.status===401 && path!=='login') { showLogin(); if(window.parent!==window)window.parent.postMessage({type:'boke-traffic-reauth'},location.origin); } throw new Error(data.error||'请求失败'); }
  return data;
}
function bytes(value, unit='GB') {
  const divisor=unit==='GiB'?2**30:10**9;
  return `${(value/divisor).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})} ${unit}`;
}
function date(value, zone, withTime=false) {
  if(value===null||value===undefined) return '尚无记录';
  return new Intl.DateTimeFormat('zh-CN',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',...(withTime?{hour:'2-digit',minute:'2-digit',hour12:false}:{})}).format(new Date(value*1000));
}
function metric(id, value, unit) { $(id).replaceChildren(element('span',value),element('small',unit)); }
function showLogin() { $('login').hidden=false; $('dashboard').hidden=true; clearInterval(timer); }
async function showDashboard() { $('login').hidden=true; $('dashboard').hidden=false; await refresh(); notifyParent('boke-traffic-ready'); clearInterval(timer); timer=setInterval(()=>refresh().catch(e=>toast(e.message)),60000); }
async function refresh() {
  $('refresh').disabled=true;
  try {
    const data=await api('fleet'); nodes=data.nodes;
    if(!nodes.some(n=>n.id===selected))selected=nodes.find(n=>!n.config.archived)?.id||nodes[0]?.id||'';
    if(page!=='fleet'&&selected)await loadDetail(selected);
    $('node-select').replaceChildren(...nodes.map(n=>{const o=element('option',n.config.name);o.value=n.id;return o;}));
    $('node-select').value=selected; $('node-select').hidden=!nodes.length;
    render();
  } catch(e) { setText('status','读取失败'); $('status').classList.add('warning'); toast(e.message); }
  finally { $('refresh').disabled=false; }
}
function activeNode(){return nodes.find(n=>n.id===selected);}
async function editNode(id){
  selected=id;$('node-select').value=id;
  try{await loadDetail(id);openSettings(false);}catch(e){toast(e.message);}
}
function openDelete(id){
  const node=nodes.find(n=>n.id===id);if(!node)return;
  deleting={id,name:node.config.name};
  setText('delete-target',`准备删除：${deleting.name}（${node.config.host||'地址未填写'}）`);
  $('delete-confirm-name').value='';$('confirm-delete').disabled=true;setText('delete-error','');
  openDialog($('delete-dialog'));
}
function actionButton(label,action,className='secondary'){
  const button=element('button',label,className);button.type='button';
  button.onclick=async()=>{button.disabled=true;try{await action();}catch(e){toast(e.message);}finally{button.disabled=false;}};
  return button;
}
function renderNodeSummary(n){
  const c=n.config,ssh=c.collection_mode==='ssh';
  setText('node-summary-name',c.name);
  setText('node-summary-status',c.archived?'已归档':n.ssh?.error&&ssh?'拉取失败':connectionNames[n.connection]);
  $('node-summary-status').classList.toggle('warning',attention(n)||n.connection==='waiting');
  dl('node-summary-facts',[
    ['IP / 域名',c.host||'未填写'],['SSH 外部端口',String(c.ssh_port)],
    ['采集方式',ssh?'SSH 加密拉取':'HTTPS 上报'],['查询账号',ssh?c.ssh_user:'采集器令牌'],
    ['公网网卡',n.agent.interface||c.interface],['最近更新',date(n.summary.last_received,c.timezone,true)],
  ]);
  const step=c.archived?'节点已归档，SSH 拉取已暂停。恢复使用请前往节点设置。':
    ssh?n.ssh?.error?'拉取失败：'+n.ssh.error:!c.ssh_fingerprint?'尚未接入：点击“VPS 部署 / 接入”，在 VPS 执行命令，再填回指纹并测试。':
      !n.summary.last_received?'已保存指纹：点击“立即拉取”测试连接；若未配置查询公钥，请先完成 VPS 部署。':
        '已接入：博客每 5 分钟自动拉取；新安装 vnStat 需约 5–10 分钟生成首批流量。':
    '使用原采集器上报。修改方式请点“编辑资料 / 套餐”；重新下载采集器请前往节点设置。';
  setText('node-next-step',step);
  $('node-quick-setup').hidden=$('node-quick-pull').hidden=!ssh;
  $('node-quick-pull').disabled=c.archived;
}
function dl(target, rows) { $(target).replaceChildren(...rows.map(([key,val])=>{const row=element('div');row.append(element('dt',key),element('dd',val));return row;})); }
async function navigate(next){page=next;const title={fleet:'全部节点',overview:'用量概览',history:'历史账期',settings:'节点设置'}[page];setText('heading',title);setText('page-label',title);document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('fleet-page').hidden=page!=='fleet';for(const name of ['overview','history','settings'])$(name+'-page').hidden=name!==page;try{if(page!=='fleet'&&selected)await loadDetail(selected);render();}catch(e){toast(e.message);}}
function render() {
  renderFleet();
  if(page==='fleet'){$('node-content').hidden=true;$('empty').hidden=nodes.length>0;setText('subtitle','集中查看每台 VPS 的账期用量与连接情况。');setText('status','每 5 分钟采集');$('status').classList.remove('warning');return;}
  const n=activeNode(); $('empty').hidden=!!n; $('node-content').hidden=!n;
  if(!n){setText('status','等待添加节点');setText('subtitle','添加 VPS 后，开始记录你的第一份流量账本。');return;}
  if(!n.daily)return;
  renderNodeSummary(n);
  const {config:c,summary:s}=n, zone=c.timezone, hasData=s.recorded_buckets>0||s.baseline_applied>0;
  const ssh = c.collection_mode === 'ssh';
  $('ssh-settings-tools').hidden=page!=='settings'||!ssh;
  $('agent-settings-tools').hidden=ssh;
  $('rotate').hidden=ssh;
  setText('ssh-last-error',n.ssh?.error||'');
  setText('archive-node',c.archived?'恢复使用':'归档节点');
  setText('subtitle',`${c.name} · ${date(s.start,zone)} — ${date(s.end,zone)} · ${zone}`);
  setText('status',(c.archived?'已归档 · ':'')+connectionNames[n.connection]); $('status').classList.toggle('warning',!s.reliable);
  const notices=[];
  if(!c.confirmed)notices.push('套餐规则待确认，请按实际订单核实额度、计费方向与重置日。');
  if(!s.complete)notices.push(`本账期记录不完整，缺少约 ${(s.missing_buckets/12).toLocaleString('zh-CN',{maximumFractionDigits:1})} 小时；未知用量未计入。`);
  if(s.stale)notices.push('采集数据尚未到达，或超过 15 分钟未更新。');
  if(ssh&&n.ssh?.error)notices.push('SSH 拉取：'+n.ssh.error);
  if(s.source_review)notices.push('检测到采集数据库代次变化，请在套餐设置中核对。');
  $('source-review').hidden=!s.source_review;
  if(s.overage>0)notices.push(`统计用量已超过当前额度 ${bytes(s.overage,c.unit)}。`);
  setText('notice',notices.length?notices.join(' '):'当前记录完整。剩余额度根据网卡用量估算，最终计费以商家账单为准。'); $('notice').classList.toggle('ok',s.reliable&&s.overage===0);
  metric('used',hasData?(s.used/(c.unit==='GiB'?2**30:1e9)).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}):'—',hasData?c.unit:'');
  metric('quota',s.quota_known?String(c.quota):c.quota_mode==='unlimited'?'不限流量':'待确认',s.quota_known?c.unit:'');
  if(c.quota_mode==='unlimited')metric('remaining','不限流量','');else if(!s.quota_known)metric('remaining','待确认','');else if(s.reliable)metric('remaining',(s.remaining/(c.unit==='GiB'?2**30:1e9)).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}),c.unit);else metric('remaining','待校准','');
  metric('days',String(s.days_left),'天');
  setText('used-caption',directions[c.direction]+(s.baseline_applied?' · 含期初补录':''));setText('quota-caption',c.quota_mode==='unknown'?'套餐暂未确认':c.quota_mode==='unlimited'?'无额度上限':c.confirmed?'已核实套餐规则':'候选额度 · 尚未核实');setText('remaining-caption',s.reliable?'根据当前记录估算':'套餐规则或历史记录不完整');setText('reset-caption',date(s.end,zone)+' 重置');
  setText('cycle-label',date(s.start,zone)+' — '+date(s.end,zone));setText('percent',s.quota_known?s.percent.toLocaleString('zh-CN',{maximumFractionDigits:1})+'%':'—');
  $('progress-fill').style.width=Math.min(100,s.percent||0)+'%';$('progress-fill').style.background=s.percent>=95?'#b56e48':'#27a389';document.querySelector('.progress').setAttribute('aria-valuenow',Math.min(100,s.percent||0));setText('direction-label',directions[c.direction]+(!s.reliable?' · 仅含已知用量':''));
  dl('health',[['采集方式',ssh?'SSH 加密拉取':'HTTPS 上报'],['连接状态',connectionNames[n.connection]],['采集网卡',n.agent.interface||'等待采集'],['最新采集',date(s.last_sample,zone,true)],['最新更新',date(s.last_received,zone,true)],['本账期记录',s.complete?'完整':'有缺口 / 期初未知'],['接收 RX',bytes(s.rx,c.unit)],['发送 TX',bytes(s.tx,c.unit)]]);
  drawChart(n.daily.slice(-days),c.unit);
  setText('chart-note','无记录日期显示为空，不能视为零用量。历史图表为原始采集数据，不包含期初补录。');
  if(!n.alerts.length){const q=element('div',undefined,'quiet');q.append(element('span','✓'),element('p',s.reliable?'目前没有额度提醒。':c.confirmed?'已知用量尚未达到提醒阈值；未记录用量可能使实际用量更高。':'核实套餐规则后，将按 80% / 90% / 95% 提醒。'));$('alerts').replaceChildren(q);}else{$('alerts').replaceChildren(...n.alerts.map(a=>{const row=element('div',undefined,'alert-row');row.append(element('span',`${a.cycle} 账期 · 已知统计用量至少达到 ${a.threshold}%`),element('span',date(a.created,zone,true),'fine'));return row;}));}
  $('history-body').replaceChildren(...n.months.map(m=>{const row=element('tr'),known=m.recorded_buckets>0||m.baseline_applied>0;[m.cycle,known?bytes(m.rx,c.unit):'—',known?bytes(m.tx,c.unit):'—',known?bytes(m.used,c.unit)+(m.baseline_applied?' *':''):'—',m.complete?'记录完整':known?'记录不完整':'尚无记录'].forEach(t=>row.append(element('td',t)));return row;}));
  dl('settings-list',[
    ['节点名称',c.name],['采集方式',ssh?'SSH 加密拉取':'HTTPS 采集器上报'],
    ['服务商 / 地区',`${c.provider||'未填写'} / ${c.region||'未填写'}`],
    ['连接地址',c.host?`${c.host} · SSH ${c.ssh_port}`:'未填写'],['实际采集网卡',n.agent.interface||c.interface],
    ...(ssh?[['只读用户名',c.ssh_user],['最近尝试',date(n.ssh?.last_attempt,zone,true)],['主机指纹',c.ssh_fingerprint||'等待接入核实']]
      :[['服务器系统',n.agent.os||'等待首次上报'],['采集器版本',n.agent.version||'等待首次上报']]),
    ['备注',c.notes||'—'],['套餐额度',s.quota_known?`${c.quota} ${c.unit} / 月`:c.quota_mode==='unlimited'?'不限流量':'待确认'],
    ['计算方式',directions[c.direction]],['重置日',`每月 ${c.reset_day} 日（短月取月底）`],['时区',zone],
    ['套餐规则',c.confirmed?'已核实':'待确认'],['节点 ID',n.id],
  ]);
}
function drawChart(rows,unit){
  const svgNS='http://www.w3.org/2000/svg',svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox','0 0 760 218');svg.setAttribute('role','img');svg.setAttribute('aria-label',`最近 ${days} 天每日接收和发送流量`);
  const make=(name,attrs,text)=>{const e=document.createElementNS(svgNS,name);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;svg.append(e);return e;};
  const max=Math.max(1,...rows.map(r=>Math.max(r.rx,r.tx)))*1.15,base=185,left=55,width=695,step=width/rows.length;
  for(let i=0;i<4;i++){const y=base-i*53;make('line',{x1:left,x2:750,y1:y,y2:y,class:'grid'});make('text',{x:44,y:y+3,'text-anchor':'end'},(max*i/3/(unit==='GiB'?2**30:1e9)).toFixed(max<1e9?2:1));}
  make('text',{x:44,y:12,'text-anchor':'end'},unit);
  rows.forEach((r,i)=>{const x=left+i*step+step*.18,w=Math.max(1,step*.28);if(r.samples){for(const [v,offset,color] of [[r.rx,0,'#27a389'],[r.tx,w+1,'#acd6c8']]){const h=v/max*159;const rect=make('rect',{x:x+offset,y:base-h,width:w,height:Math.max(h,.7),rx:Math.min(2,w/2),fill:color});const title=document.createElementNS(svgNS,'title');title.textContent=`${r.date} · RX ${bytes(r.rx,unit)} · TX ${bytes(r.tx,unit)} · ${r.samples} 段记录`;rect.append(title);}}else{make('circle',{cx:x+w,cy:base-2,r:1.5,fill:'#cbd1d3'});}if(i===0||i===rows.length-1||i%Math.ceil(rows.length/5)===0)make('text',{x:x+w,y:210,'text-anchor':'middle'},r.date.slice(5).replace('-','/'));});
  $('chart').replaceChildren(svg);
}
function openSettings(create=false){
  const n=activeNode(); editing=create?null:n; const c=create?{name:'',provider:'',region:'',host:'',ssh_port:22,interface:'auto',notes:'',archived:false,quota_mode:'unknown',quota:100,unit:'GB',direction:'sum',reset_day:1,timezone:'Asia/Shanghai',confirmed:false,baseline_known:false,baseline_bytes:0,baseline_cutover:0}:n.config;
  const f=$('settings-form'); for(const k of ['name','provider','region','host','ssh_port','interface','notes','quota_mode','quota','unit','direction','reset_day','timezone'])f.elements[k].value=c[k];for(const k of ['confirmed','baseline_known'])f.elements[k].checked=c[k];
  f.elements.collection_mode.value=create?'ssh':c.collection_mode||'agent';
  f.elements.ssh_user.value=c.ssh_user||'traffic-monitor';
  updateSSHFields();
  f.elements.baseline_amount.value=c.baseline_bytes/(c.unit==='GiB'?2**30:1e9);
  const cut=new Date((c.baseline_cutover||Math.floor(Date.now()/300000)*300)*1000);cut.setMinutes(cut.getMinutes()-cut.getTimezoneOffset());f.elements.baseline_cutover.value=cut.toISOString().slice(0,16);
  $('baseline-details').hidden=create;$('baseline-details').open=false;setText('dialog-title',create?'添加节点':'编辑节点与套餐');setText('settings-error','');wizardStep=1;updateWizard();openDialog($('settings-dialog'));
}
function updateSSHFields(){
  const f=$('settings-form'),ssh=f.elements.collection_mode.value==='ssh';
  $('ssh-fields').hidden=!ssh;
  f.elements.host.required=ssh;
  f.elements.ssh_user.required=ssh;
  f.elements.ssh_user.disabled=!ssh;
}
async function showSSHSetup(id){
  try{
    const data=await api(`nodes/${id}/ssh-setup`);
    const c=nodes.find(n=>n.id===id)?.config;
    if(!c)throw new Error('节点不存在，请刷新列表');
    setText('ssh-target',`${c.name} · ${c.host} · SSH 外部端口 ${c.ssh_port} · 只读账号 ${c.ssh_user}`);
    setText('ssh-login',`ssh -p ${c.ssh_port} root@${c.host}`);
    sshSetupId=id;setText('ssh-commands',data.commands);$('ssh-fingerprint').value=data.fingerprint||'';setText('ssh-error','');
    openDialog($('ssh-dialog'));
  }catch(e){toast(e.message);}
}
async function pullSSH(id){
  const result=await api(`nodes/${id}/ssh-pull`,{});
  await refresh();
  return result.samples?`已拉取 ${result.samples} 段记录`:'SSH 已连通，等待 vnStat 生成首批 5 分钟记录';
}
function showToken(id,token){
  credential={id,token};$('token-node').value=id;$('token-value').value=token;
  setText('token-endpoint',ingestUrl);
  const https=ingestUrl.startsWith('https:');
  $('token-endpoint-note').hidden=https;
  setText('token-endpoint-note','节点资料已保存，但当前上报地址是 HTTP，采集器无法上报。请先配置博客 HTTPS，或设置 TRAFFIC_PUBLIC_URL 为博客的 HTTPS 地址，重启后台后重新生成采集令牌并下载安装包。');
  $('download-package').disabled=$('download-agent').disabled=!https;
  setText('install-commands',`tar -xzf traffic-agent-${id}.tar.gz\nsudo install -m 600 traffic-agent.env /etc/traffic-agent.env\nsudo bash deploy/install-agent.sh`);
  openDialog($('token-dialog'));
}
function closeToken(){credential=null;$('token-value').value='';$('token-dialog').close();}
async function loadDetail(id){
  const version=++detailVersion, detail=await api(`nodes/${id}`);
  if(version!==detailVersion)return;
  const index=nodes.findIndex(n=>n.id===id);if(index>=0)nodes[index]=detail;
}
function attention(n){return !!(n.config.collection_mode==='ssh'&&n.ssh?.error)||['offline','delayed'].includes(n.connection)||(n.config.confirmed&&n.summary.quota_known&&n.summary.percent>=80);}
function renderFleet(){
  const active=nodes.filter(n=>!n.config.archived);
  setText('fleet-total',active.length);setText('fleet-online',active.filter(n=>['online','collecting'].includes(n.connection)).length);
  setText('fleet-attention',active.filter(attention).length);setText('fleet-waiting',active.filter(n=>n.connection==='waiting').length);
  const query=$('fleet-search').value.toLowerCase().trim(),filter=$('fleet-filter').value;
  const filtered=nodes.filter(n=>{
    const c=n.config;
    return [c.name,c.provider,c.region,c.host,c.notes].join(' ').toLowerCase().includes(query)&&
      (filter==='all'||filter==='archived'&&c.archived||!c.archived&&(filter==='active'||filter==='waiting'&&n.connection==='waiting'||filter==='attention'&&attention(n)));
  });
  setText('fleet-count',`${filtered.length} 台 VPS`);$('fleet-none').hidden=filtered.length>0||!nodes.length;
  $('fleet-cards').replaceChildren(...filtered.map(n=>{
    const {config:c,summary:s}=n,card=element('article',undefined,'panel fleet-card');
    const head=element('div',undefined,'section-header'),identity=element('div');identity.append(element('h2',c.name),element('p',[c.provider,c.region].filter(Boolean).join(' · ')||'服务器资料待完善','muted'));
    head.append(identity,element('span',c.archived?'已归档':connectionNames[n.connection],`badge${attention(n)||n.connection==='waiting'?' warning':''}`));card.append(head);
    const known=s.recorded_buckets>0||s.baseline_applied>0;
    const amount=element('div',undefined,'fleet-amount');amount.append(element('strong',known?bytes(s.used,c.unit):'—'),element('span',s.quota_known?` / ${c.quota} ${c.unit}`:c.quota_mode==='unlimited'?' / 不限流量':' / 套餐待确认'));card.append(amount);
    const bar=element('div',undefined,'progress'),fill=element('div');fill.style.width=Math.min(100,s.percent||0)+'%';if((s.percent||0)>=80)fill.style.background='#b56e48';bar.append(fill);card.append(bar);
    const facts=element('dl');for(const [label,value]of [
      ['IP / 域名',c.host||'未填写'],['SSH 外部端口',String(c.ssh_port)],
      ['采集方式',c.collection_mode==='ssh'?'SSH 加密拉取':'HTTPS 上报'],
      ...(c.collection_mode==='ssh'?[['查询账号',c.ssh_user||'traffic-monitor']]:[]),
      ['本账期',`${date(s.start,c.timezone)} — ${date(s.end,c.timezone)}`],
      ['重置规则',`每月 ${c.reset_day} 日 · ${c.timezone}`],
      ['剩余额度',c.quota_mode==='unlimited'?'不限流量':!s.quota_known?'待确认':s.reliable?bytes(s.remaining,c.unit):'待校准'],
      ['最新更新',date(s.last_received,c.timezone,true)],['记录状态',!known?'等待首批数据':s.reliable?'完整':!c.confirmed?'套餐待核实':'记录有缺口']]){
        const row=element('div');row.append(element('dt',label),element('dd',value));facts.append(row);
    }card.append(facts);
    const actions=element('div',undefined,'node-actions');
    actions.append(actionButton('用量详情',async()=>{selected=n.id;$('node-select').value=selected;await navigate('overview');}),
      actionButton('编辑资料 / 套餐',()=>editNode(n.id)));
    if(c.collection_mode==='ssh'){
      actions.append(actionButton('VPS 部署 / 接入',()=>showSSHSetup(n.id),'primary'));
      const pull=actionButton('立即拉取',async()=>{toast(await pullSSH(n.id));});pull.disabled=c.archived;actions.append(pull);
      if(n.ssh?.error)card.append(element('p',n.ssh.error,'error'));
    }
    actions.append(actionButton('删除',()=>openDelete(n.id),'secondary danger'));card.append(actions);
    return card;
  }));
}
function updateWizard(){
  setText('save-node',editing?'保存设置':$('settings-form').elements.collection_mode.value==='ssh'?'保存并配置 SSH':'保存并连接采集器');
  $('server-fields').hidden=!editing&&wizardStep!==1;$('billing-fields').hidden=!editing&&wizardStep!==2;
  $('wizard-label').hidden=!!editing;setText('wizard-label',wizardStep===1?'1 / 3 · 服务器资料':'2 / 3 · 套餐与账期');
  $('wizard-next').hidden=!!editing||wizardStep!==1;$('wizard-back').hidden=!!editing||wizardStep!==2;$('save-node').hidden=!editing&&wizardStep!==2;
  const limited=$('settings-form').elements.quota_mode.value==='limited';$('quota-fields').hidden=!limited;
}
$('wizard-next').onclick=()=>{
  for(const input of $('server-fields').querySelectorAll('input'))if(!input.reportValidity())return;
  const f=$('settings-form');if(f.elements.host.value&&nodes.some(n=>n.id!==editing?.id&&n.config.host===f.elements.host.value&&n.config.ssh_port===Number(f.elements.ssh_port.value)))toast('已有相同地址与 SSH 端口，请确认没有重复添加。');
  wizardStep=2;updateWizard();
};
$('wizard-back').onclick=()=>{wizardStep=1;updateWizard();};
$('settings-form').elements.quota_mode.onchange=updateWizard;
$('settings-form').elements.collection_mode.onchange=()=>{updateSSHFields();updateWizard();};
$('open-ssh-setup').onclick=()=>showSSHSetup(selected);
$('node-quick-edit').onclick=()=>editNode(selected);
$('node-quick-setup').onclick=()=>showSSHSetup(selected);
$('node-quick-delete').onclick=$('delete-node').onclick=()=>openDelete(selected);
document.querySelectorAll('.close-delete').forEach(b=>b.onclick=()=>$('delete-dialog').close());
$('delete-confirm-name').oninput=()=>{$('confirm-delete').disabled=!deleting||$('delete-confirm-name').value!==deleting.name;};
$('delete-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!deleting)return;
  const target=deleting,b=$('confirm-delete');b.disabled=true;setText('delete-error','');
  try{
    await api(`nodes/${target.id}/delete`,{confirm_name:$('delete-confirm-name').value});
    detailVersion++;nodes=nodes.filter(n=>n.id!==target.id);if(selected===target.id)selected='';
    deleting=null;$('delete-dialog').close();await navigate('fleet');await refresh();
    toast('节点及其历史记录已删除；未卸载 VPS 软件，未修改其他节点');
  }catch(e){setText('delete-error',e.message);}finally{b.disabled=!deleting||$('delete-confirm-name').value!==deleting.name;}
});
document.querySelectorAll('.close-ssh').forEach(b=>b.onclick=()=>$('ssh-dialog').close());
$('copy-ssh-commands').onclick=async()=>{
  try{await navigator.clipboard.writeText($('ssh-commands').textContent);toast('已复制，请在对应 VPS 的 SSH 终端执行');}
  catch{const selection=getSelection(),range=document.createRange();range.selectNodeContents($('ssh-commands'));selection.removeAllRanges();selection.addRange(range);toast('浏览器不允许自动复制，已选中命令，请手动复制');}
};
$('ssh-test').onclick=async()=>{
  const b=$('ssh-test');b.disabled=true;setText('ssh-error','正在校验主机指纹并连接，首次测试可能需要约 30 秒，请勿重复点击…');
  try{
    const fingerprint=$('ssh-fingerprint').value.trim();
    if(!/^SHA256:[A-Za-z0-9+/]{43}$/.test(fingerprint))throw new Error('请粘贴 VPS 命令输出的 SHA256 主机指纹');
    await api(`nodes/${sshSetupId}/ssh-fingerprint`,{fingerprint});
    setText('ssh-error',await pullSSH(sshSetupId));
  }catch(e){setText('ssh-error',e.message);await refresh();}finally{b.disabled=false;}
};
$('pull-ssh-now').onclick=async e=>{
  const b=e.currentTarget;b.disabled=true;
  try{toast(await pullSSH(selected));}catch(e){toast(e.message);await refresh();}finally{b.disabled=false;}
};
$('node-quick-pull').onclick=$('pull-ssh-now').onclick;
$('fleet-search').oninput=$('fleet-filter').onchange=renderFleet;
$('archive-node').onclick=async()=>{
  const n=activeNode();if(!n)return;
  try{await api(`nodes/${n.id}/settings`,{...n.config,archived:!n.config.archived});await refresh();toast(n.config.archived?'已恢复使用':'已归档；历史记录和后续采集继续保留');}catch(e){toast(e.message);}
};
$('download-package').onclick=async()=>{
  if(!credential)return;const b=$('download-package');b.disabled=true;
  try{const r=await fetch(`./api/nodes/${credential.id}/package`,{method:'POST',headers:{'Content-Type':'application/json','X-Traffic-Request':'1'},body:JSON.stringify({token:credential.token})});
    if(!r.ok){const e=await r.json();throw new Error(e.error||'下载失败');}
    const url=URL.createObjectURL(await r.blob()),a=element('a');a.href=url;a.download=`traffic-agent-${credential.id}.tar.gz`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('安装包已下载，上传到对应 VPS 后按说明安装');
  }catch(e){toast(e.message);}finally{b.disabled=false;}
};
$('login-form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button');b.disabled=true;setText('login-error','');try{await api('login',{user:f.elements.user.value,password:f.elements.password.value});f.elements.password.value='';await showDashboard();}catch(err){setText('login-error',err.message);}finally{b.disabled=false;}});
$('logout').hidden=true; // Authentication is owned by the surrounding blog admin.
$('logout').onclick=async()=>{try{await api('logout',{});showLogin();}catch(e){toast(e.message);}};
$('refresh').onclick=refresh;$('node-select').onchange=async e=>{selected=e.target.value;await navigate(page==='fleet'?'overview':page);};
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>navigate(b.dataset.page));
document.querySelectorAll('[data-days]').forEach(b=>b.onclick=()=>{days=Number(b.dataset.days);document.querySelectorAll('[data-days]').forEach(x=>x.classList.toggle('selected',x===b));render();});
$('add-node').onclick=$('empty-add').onclick=()=>openSettings(true);$('edit-settings').onclick=()=>openSettings(false);
document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>$('settings-dialog').close());document.querySelectorAll('.close-token').forEach(b=>b.onclick=closeToken);$('token-dialog').addEventListener('cancel',closeToken);
document.querySelectorAll('.open-help').forEach(b=>b.onclick=()=>openDialog($('help-dialog')));
document.querySelectorAll('.close-help').forEach(b=>b.onclick=()=>$('help-dialog').close());
$('settings-form').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!editing&&wizardStep===1){$('wizard-next').click();return;}
  const f=e.currentTarget,b=f.querySelector('[type=submit]');b.disabled=true;setText('settings-error','');
  try{
    const c={name:f.elements.name.value,provider:f.elements.provider.value,region:f.elements.region.value,
      host:f.elements.host.value,ssh_port:Number(f.elements.ssh_port.value),interface:f.elements.interface.value||'auto',
      collection_mode:f.elements.collection_mode.value,ssh_user:f.elements.ssh_user.value||'traffic-monitor',
      ssh_fingerprint:editing?.config.ssh_fingerprint||'',notes:f.elements.notes.value,archived:editing?.config.archived||false,
      quota_mode:f.elements.quota_mode.value,quota:Number(f.elements.quota.value),unit:f.elements.unit.value,
      direction:f.elements.direction.value,reset_day:Number(f.elements.reset_day.value),timezone:f.elements.timezone.value,
      confirmed:f.elements.confirmed.checked,baseline_known:!!editing&&f.elements.baseline_known.checked,
      baseline_bytes:Math.round(Number(f.elements.baseline_amount.value)*(f.elements.unit.value==='GiB'?2**30:1e9)),
      baseline_cutover:Math.floor(new Date(f.elements.baseline_cutover.value).getTime()/300000)*300,baseline_cycle:editing?.summary.cycle||''};
    if(editing&&(c.reset_day!==editing.config.reset_day||c.timezone!==editing.config.timezone)&&c.baseline_known)
      throw new Error('修改重置日或时区时，请先关闭期初补录；保存后再按新账期补录。');
    if(editing&&(c.host!==editing.config.host||c.ssh_port!==editing.config.ssh_port))c.ssh_fingerprint='';
    if(!c.baseline_known){c.baseline_cutover=0;c.baseline_bytes=0;}
    if(editing){
      await api(`nodes/${editing.id}/settings`,c);$('settings-dialog').close();await refresh();toast('设置已保存');
      if(c.collection_mode==='ssh')await showSSHSetup(editing.id);
    }else{
      const result=await api('nodes',c);selected=result.node_id;$('settings-dialog').close();page='fleet';await refresh();await navigate('fleet');
      if(c.collection_mode==='ssh')await showSSHSetup(result.node_id);else showToken(result.node_id,result.token);
    }
    await refresh();
  }catch(err){setText('settings-error',err.message);}finally{b.disabled=false;}
});
$('rotate').onclick=async()=>{if(!window.confirm('重新生成会使旧采集令牌立即失效。生成后请更新 VPS 配置，继续吗？'))return;try{const r=await api(`nodes/${selected}/rotate`,{});showToken(selected,r.token);}catch(e){toast(e.message);}};
$('ack-sources').onclick=async()=>{try{await api(`nodes/${selected}/ack-sources`,{});await refresh();toast('来源变化已核对；实际采集缺口仍会保留');}catch(e){toast(e.message);}};
$('export').onclick=()=>{window.location.href=`./api/nodes/${selected}/export`;};
$('download-agent').onclick=()=>{if(!credential)return;const content=`# Store at /etc/traffic-agent.env with mode 600\nINGEST_URL=${ingestUrl}\nNODE_ID=${credential.id}\nINGEST_TOKEN=${credential.token}\n# Set to the VPS public interface (check: ip route get 1.1.1.1)\nINTERFACE=${nodes.find(n=>n.id===credential.id)?.config.interface||'auto'}\nSTATE_DIR=/var/lib/traffic-agent\n`;const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));const a=element('a');a.href=url;a.download='traffic-agent.env';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('配置已下载，auto 会在安装时识别网卡');};
(async()=>{try{const s=await api('session');ingestUrl=s.ingest_url||ingestUrl;$('login-form').elements.user.value=s.user;if(s.authenticated)await showDashboard();else showLogin();}catch(e){showLogin();setText('login-error','服务暂时无法访问：'+e.message);}})();
