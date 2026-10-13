'use strict';
const $ = id => document.getElementById(id);
const directions = {rx:'仅接收 RX',tx:'仅发送 TX',sum:'双向相加 RX + TX',max:'双向取大 max(RX, TX)'};
let nodes = [], selected = '', days = 30, page = 'fleet', editing = null, credential = null;
let timer, toastTimer, wizardStep=1, detailVersion=0;
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
async function showDashboard() { $('login').hidden=true; $('dashboard').hidden=false; await refresh(); clearInterval(timer); timer=setInterval(()=>refresh().catch(e=>toast(e.message)),60000); }
async function refresh() {
  $('refresh').disabled=true;
  try {
    const data=await api('fleet'); nodes=data.nodes;
    if(page!=='fleet'&&selected)await loadDetail(selected);
    if(!nodes.some(n=>n.id===selected))selected=nodes.find(n=>!n.config.archived)?.id||nodes[0]?.id||'';
    $('node-select').replaceChildren(...nodes.map(n=>{const o=element('option',n.config.name);o.value=n.id;return o;}));
    $('node-select').value=selected; $('node-select').hidden=!nodes.length;
    render();
  } catch(e) { setText('status','读取失败'); $('status').classList.add('warning'); toast(e.message); }
  finally { $('refresh').disabled=false; }
}
function activeNode(){return nodes.find(n=>n.id===selected);}
function dl(target, rows) { $(target).replaceChildren(...rows.map(([key,val])=>{const row=element('div');row.append(element('dt',key),element('dd',val));return row;})); }
async function navigate(next){page=next;const title={fleet:'全部 VPS',overview:'用量概览',history:'历史账本',settings:'套餐设置'}[page];setText('heading',title);setText('page-label',title);document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('fleet-page').hidden=page!=='fleet';for(const name of ['overview','history','settings'])$(name+'-page').hidden=name!==page;try{if(page!=='fleet'&&selected)await loadDetail(selected);render();}catch(e){toast(e.message);}}
function render() {
  renderFleet();
  if(page==='fleet'){$('node-content').hidden=true;$('empty').hidden=nodes.length>0;setText('subtitle','集中查看每台 VPS 的账期用量与连接情况。');setText('status','每 5 分钟采集');$('status').classList.remove('warning');return;}
  const n=activeNode(); $('empty').hidden=!!n; $('node-content').hidden=!n;
  if(!n){setText('status','等待添加节点');setText('subtitle','添加 VPS 后，开始记录你的第一份流量账本。');return;}
  if(!n.daily)return;
  const {config:c,summary:s}=n, zone=c.timezone, hasData=s.recorded_buckets>0||s.baseline_applied>0;
  setText('archive-node',c.archived?'恢复使用':'归档节点');
  setText('subtitle',`${c.name} · ${date(s.start,zone)} — ${date(s.end,zone)} · ${zone}`);
  setText('status',(c.archived?'已归档 · ':'')+connectionNames[n.connection]); $('status').classList.toggle('warning',!s.reliable);
  const notices=[];
  if(!c.confirmed)notices.push('套餐规则待确认，请按实际订单核实额度、计费方向与重置日。');
  if(!s.complete)notices.push(`本账期记录不完整，缺少约 ${(s.missing_buckets/12).toLocaleString('zh-CN',{maximumFractionDigits:1})} 小时；未知用量未计入。`);
  if(s.stale)notices.push('采集数据尚未到达，或超过 15 分钟未更新。');
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
  dl('health',[['连接状态',connectionNames[n.connection]],['采集网卡',n.agent.interface||'等待上报'],['最新采集',date(s.last_sample,zone,true)],['最新上报',date(s.last_received,zone,true)],['本账期记录',s.complete?'完整':'有缺口 / 期初未知'],['接收 RX',bytes(s.rx,c.unit)],['发送 TX',bytes(s.tx,c.unit)]]);
  drawChart(n.daily.slice(-days),c.unit);
  setText('chart-note','无记录日期显示为空，不能视为零用量。历史图表为原始采集数据，不包含期初补录。');
  if(!n.alerts.length){const q=element('div',undefined,'quiet');q.append(element('span','✓'),element('p',s.reliable?'目前没有额度提醒。':c.confirmed?'已知用量尚未达到提醒阈值；未记录用量可能使实际用量更高。':'核实套餐规则后，将按 80% / 90% / 95% 提醒。'));$('alerts').replaceChildren(q);}else{$('alerts').replaceChildren(...n.alerts.map(a=>{const row=element('div',undefined,'alert-row');row.append(element('span',`${a.cycle} 账期 · 已知统计用量至少达到 ${a.threshold}%`),element('span',date(a.created,zone,true),'fine'));return row;}));}
  $('history-body').replaceChildren(...n.months.map(m=>{const row=element('tr'),known=m.recorded_buckets>0||m.baseline_applied>0;[m.cycle,known?bytes(m.rx,c.unit):'—',known?bytes(m.tx,c.unit):'—',known?bytes(m.used,c.unit)+(m.baseline_applied?' *':''):'—',m.complete?'记录完整':known?'记录不完整':'尚无记录'].forEach(t=>row.append(element('td',t)));return row;}));
  dl('settings-list',[['节点名称',c.name],['服务商 / 地区',`${c.provider||'未填写'} / ${c.region||'未填写'}`],['连接地址',c.host?`${c.host} · SSH ${c.ssh_port}`:'未填写'],['实际采集网卡',n.agent.interface||c.interface],['服务器系统',n.agent.os||'等待首次上报'],['采集器版本',n.agent.version||'等待首次上报'],['备注',c.notes||'—'],['套餐额度',s.quota_known?`${c.quota} ${c.unit} / 月`:c.quota_mode==='unlimited'?'不限流量':'待确认'],['计算方式',directions[c.direction]],['重置日',`每月 ${c.reset_day} 日（短月取月底）`],['时区',zone],['套餐规则',c.confirmed?'已核实':'待确认'],['节点 ID',n.id]]);
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
  f.elements.baseline_amount.value=c.baseline_bytes/(c.unit==='GiB'?2**30:1e9);
  const cut=new Date((c.baseline_cutover||Math.floor(Date.now()/300000)*300)*1000);cut.setMinutes(cut.getMinutes()-cut.getTimezoneOffset());f.elements.baseline_cutover.value=cut.toISOString().slice(0,16);
  $('baseline-details').hidden=create;$('baseline-details').open=false;setText('dialog-title',create?'添加节点':'套餐设置');setText('settings-error','');wizardStep=1;updateWizard();$('settings-dialog').showModal();
}
function showToken(id,token){credential={id,token};$('token-node').value=id;$('token-value').value=token;setText('install-commands',`tar -xzf traffic-agent-${id}.tar.gz\nsudo install -m 600 traffic-agent.env /etc/traffic-agent.env\nsudo bash deploy/install-agent.sh`);$('token-dialog').showModal();}
function closeToken(){credential=null;$('token-value').value='';$('token-dialog').close();}
async function loadDetail(id){
  const version=++detailVersion, detail=await api(`nodes/${id}`);
  if(version!==detailVersion)return;
  const index=nodes.findIndex(n=>n.id===id);if(index>=0)nodes[index]=detail;
}
function attention(n){return ['offline','delayed'].includes(n.connection)||(n.config.confirmed&&n.summary.quota_known&&n.summary.percent>=80);}
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
      ['本账期',`${date(s.start,c.timezone)} — ${date(s.end,c.timezone)}`],
      ['剩余额度',c.quota_mode==='unlimited'?'不限流量':!s.quota_known?'待确认':s.reliable?bytes(s.remaining,c.unit):'待校准'],
      ['最新上报',date(s.last_received,c.timezone,true)],['记录状态',!known?'等待首批数据':s.reliable?'完整':!c.confirmed?'套餐待核实':'记录有缺口']]){
        const row=element('div');row.append(element('dt',label),element('dd',value));facts.append(row);
    }card.append(facts);
    const foot=element('div',undefined,'fleet-card-foot'),button=element('button','查看与管理 →','secondary');button.onclick=async()=>{selected=n.id;$('node-select').value=selected;await navigate('overview');};
    foot.append(element('span',c.host||n.agent.hostname||'地址未填写','fine'),button);card.append(foot);return card;
  }));
}
function updateWizard(){
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
$('refresh').onclick=refresh;$('node-select').onchange=async e=>{selected=e.target.value;await navigate('overview');};
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>navigate(b.dataset.page));
document.querySelectorAll('[data-days]').forEach(b=>b.onclick=()=>{days=Number(b.dataset.days);document.querySelectorAll('[data-days]').forEach(x=>x.classList.toggle('selected',x===b));render();});
$('add-node').onclick=$('empty-add').onclick=()=>openSettings(true);$('edit-settings').onclick=()=>openSettings(false);
document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>$('settings-dialog').close());document.querySelectorAll('.close-token').forEach(b=>b.onclick=closeToken);$('token-dialog').addEventListener('cancel',closeToken);
$('settings-form').addEventListener('submit',async e=>{e.preventDefault();if(!editing&&wizardStep===1){$('wizard-next').click();return;}const f=e.currentTarget,b=f.querySelector('[type=submit]');b.disabled=true;setText('settings-error','');try{const c={name:f.elements.name.value,provider:f.elements.provider.value,region:f.elements.region.value,host:f.elements.host.value,ssh_port:Number(f.elements.ssh_port.value),interface:f.elements.interface.value||'auto',notes:f.elements.notes.value,archived:editing?.config.archived||false,quota_mode:f.elements.quota_mode.value,quota:Number(f.elements.quota.value),unit:f.elements.unit.value,direction:f.elements.direction.value,reset_day:Number(f.elements.reset_day.value),timezone:f.elements.timezone.value,confirmed:f.elements.confirmed.checked,baseline_known:!!editing&&f.elements.baseline_known.checked,baseline_bytes:Math.round(Number(f.elements.baseline_amount.value)*(f.elements.unit.value==='GiB'?2**30:1e9)),baseline_cutover:Math.floor(new Date(f.elements.baseline_cutover.value).getTime()/300000)*300,baseline_cycle:editing?.summary.cycle||''};if(editing&&(c.reset_day!==editing.config.reset_day||c.timezone!==editing.config.timezone)&&c.baseline_known)throw new Error('修改重置日或时区时，请先关闭期初补录；保存后再按新账期补录。');if(!c.baseline_known){c.baseline_cutover=0;c.baseline_bytes=0;}if(editing){await api(`nodes/${editing.id}/settings`,c);$('settings-dialog').close();toast('套餐设置已保存');}else{const result=await api('nodes',c);selected=result.node_id;$('settings-dialog').close();page='fleet';await navigate('fleet');showToken(result.node_id,result.token);}await refresh();}catch(err){setText('settings-error',err.message);}finally{b.disabled=false;}});
$('rotate').onclick=async()=>{if(!window.confirm('重新生成会使旧采集令牌立即失效。生成后请更新 VPS 配置，继续吗？'))return;try{const r=await api(`nodes/${selected}/rotate`,{});showToken(selected,r.token);}catch(e){toast(e.message);}};
$('ack-sources').onclick=async()=>{try{await api(`nodes/${selected}/ack-sources`,{});await refresh();toast('来源变化已核对；实际采集缺口仍会保留');}catch(e){toast(e.message);}};
$('export').onclick=()=>{window.location.href=`./api/nodes/${selected}/export`;};
$('download-agent').onclick=()=>{if(!credential)return;const content=`# Store at /etc/traffic-agent.env with mode 600\nINGEST_URL=${new URL('./api/ingest', location.href).href}\nNODE_ID=${credential.id}\nINGEST_TOKEN=${credential.token}\n# Set to the VPS public interface (check: ip route get 1.1.1.1)\nINTERFACE=${nodes.find(n=>n.id===credential.id)?.config.interface||'auto'}\nSTATE_DIR=/var/lib/traffic-agent\n`;const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));const a=element('a');a.href=url;a.download='traffic-agent.env';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('配置已下载，auto 会在安装时识别网卡');};
(async()=>{try{const s=await api('session');$('login-form').elements.user.value=s.user;if(s.authenticated)await showDashboard();else showLogin();}catch(e){showLogin();setText('login-error','服务暂时无法访问：'+e.message);}})();
