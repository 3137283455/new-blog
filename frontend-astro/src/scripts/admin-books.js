(() => {
  const root=document.querySelector('.admin-shell')
  const apiBase=root?.dataset.apiBase||'/api'
  const token=()=>localStorage.getItem('boke_admin_token')||''
  const $=(selector)=>document.querySelector(selector)
  const html=(value)=>String(value??'').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
  const state={books:[],preview:null,previewKind:'epub',active:null}
  const notify=(message,failed=false)=>window.notifyAdmin?.(message,failed)
  function deviceClientId(){
    const key='boke_private_device_client_id'
    let id=localStorage.getItem(key)
    if(!id){id=globalThis.crypto?.randomUUID?.()||'device-'+Date.now()+'-'+Math.random().toString(36).slice(2);localStorage.setItem(key,id)}
    return id
  }
  async function api(path,options={}){
    const isForm=options.body instanceof FormData
    const response=await fetch(apiBase+path,{...options,headers:{...(isForm?{}:{'Content-Type':'application/json'}),Authorization:'Bearer '+token(),...(options.headers||{})}})
    const json=await response.json().catch(()=>({}))
    if(!response.ok||json.success===false)throw new Error(json.message||'请求失败')
    return json.data
  }
  async function loadBooks(){
    state.books=await api('/admin/books')||[]
    const list=$('#admin-book-list');if(!list)return
    list.innerHTML=state.books.map((book)=>'<article class="admin-personal-item '+(book.deleted_at?'is-done':'')+'"><header><span>'+(book.deleted_at?'回收站':html(book.reading_status||'阅读中'))+'</span><small>'+Number(book.volume_count||0)+' 卷</small></header><strong>'+html(book.title)+'</strong><p>'+html(book.author||'作者未填写')+'</p><footer>'+(book.deleted_at?'<button data-book-restore="'+book.id+'">恢复</button>':'<button data-book-edit="'+book.id+'">编辑分卷</button><a href="/books/'+encodeURIComponent(book.slug)+'" target="_blank">查看</a><button class="is-danger" data-book-delete="'+book.id+'">删除</button>')+'</footer></article>').join('')||'<p class="text-sm text-base-content/45">还没有书籍。</p>'
  }
  function renderPreview(){
    const target=$('#book-import-preview'),p=state.preview;if(!target)return
    if(!p){target.innerHTML='<p class="text-sm text-base-content/45">选择文件后会先解析，不会立即写入书库。</p>';return}
    target.innerHTML='<form id="book-import-form" class="grid gap-3"><div class="grid gap-2 md:grid-cols-2"><input class="input input-bordered rounded-xl" name="title" value="'+html(p.title)+'" placeholder="书名" required><input class="input input-bordered rounded-xl" name="author" value="'+html(p.author||'')+'" placeholder="作者"></div><div class="grid gap-2 md:grid-cols-2"><select class="select select-bordered rounded-xl" name="action"><option value="separate">新建独立书籍</option><option value="append">追加到已有书籍</option><option value="overwrite">覆盖已有书籍</option></select><select class="select select-bordered rounded-xl" name="book_id"><option value="">自动匹配同名书</option>'+state.books.filter((b)=>!b.deleted_at).map((b)=>'<option value="'+b.id+'">'+html(b.title)+'</option>').join('')+'</select></div><div class="admin-book-preview-volumes">'+p.volumes.map((v,vi)=>'<details open><summary><label><input type="checkbox" data-preview-volume="'+vi+'" checked> <b>'+html(v.title)+'</b> · '+v.chapter_count+' 章</label></summary><input class="input input-bordered input-sm w-full rounded-xl" data-preview-volume-title="'+vi+'" value="'+html(v.title)+'"><div>'+v.chapters.map((c,ci)=>'<label><input type="checkbox" data-preview-chapter="'+vi+':'+ci+'" checked><span>'+html(c.title)+'</span></label>').join('')+'</div></details>').join('')+'</div><button class="ryu-btn-primary" type="submit">确认结构并导入</button></form>'
    $('#book-import-form')?.addEventListener('submit',commitPreview)
  }
  async function previewFiles(files){
    if(!files.length)return
    const form=new FormData();Array.from(files).forEach((file)=>form.append('files',file))
    $('#book-import-preview').innerHTML='<p>正在解析图书，请稍候…</p>'
    try{state.preview=await api(state.previewKind==='text'?'/admin/books/text/preview':'/admin/books/epub/preview',{method:'POST',body:form});renderPreview();notify('预览生成完成，请检查分卷与章节')}catch(error){state.preview=null;renderPreview();notify(error.message,true)}
  }
  async function commitPreview(event){
    event.preventDefault();const form=event.currentTarget,data=new FormData(form)
    const volumes=state.preview.volumes.map((volume,vi)=>({index:vi,enabled:Boolean(form.querySelector('[data-preview-volume="'+vi+'"]')?.checked),title:form.querySelector('[data-preview-volume-title="'+vi+'"]')?.value||volume.title,chapters:volume.chapters.map((_,ci)=>ci).filter((ci)=>form.querySelector('[data-preview-chapter="'+vi+':'+ci+'"]')?.checked)}))
    try{const result=await api(state.previewKind==='text'?'/admin/books/text/commit':'/admin/books/epub/commit',{method:'POST',body:JSON.stringify({token:state.preview.token,title:data.get('title'),author:data.get('author'),action:data.get('action'),book_id:data.get('book_id')||undefined,volumes})});state.preview=null;renderPreview();await loadBooks();notify('导入完成：'+result.volume_count+' 卷，'+result.chapter_count+' 章')}catch(error){notify(error.message,true)}
  }
  async function editBook(id){
    const book=await api('/admin/books/'+id);state.active=book
    const card=$('#book-editor-card'),form=$('#book-form');card.classList.remove('hidden')
    ;['id','title','author','slug','cover','description','reading_mode','reading_url','source_format'].forEach((name)=>{form.elements.namedItem(name).value=book[name]||''})
    $('#book-volume-editor').innerHTML='<div class="flex items-center justify-between"><h4 class="font-black">分卷与章节</h4><button class="ryu-btn btn-sm" type="button" data-volume-add="'+book.id+'">新增分卷</button></div><div class="mt-3 grid gap-2">'+(book.volumes||[]).map((v)=>'<details class="rounded-xl border border-base-content/10 p-3"><summary><b>'+html(v.title)+'</b> · '+(v.chapters?.length||0)+' 章</summary><div class="mt-2 grid gap-1">'+(v.chapters||[]).map((c)=>'<div class="flex justify-between gap-2 text-sm"><span>'+html(c.title)+'</span><button class="text-error" data-chapter-delete="'+c.id+'" data-volume-id="'+v.id+'">删除</button></div>').join('')+'</div><footer class="mt-3 flex gap-2"><button data-volume-rename="'+v.id+'">重命名</button><button class="text-error" data-volume-delete="'+v.id+'">移入回收站</button></footer></details>').join('')+'</div>'
    const pending=await api('/admin/books/'+book.id+'/annotations/pending')||[]
    if(pending.length)$('#book-volume-editor').insertAdjacentHTML('beforeend','<section class="mt-5 rounded-xl border border-warning/30 p-4"><h4 class="font-black">待恢复标注 '+pending.length+' 条</h4><p class="text-xs opacity-55">覆盖导入后未能按章节名和原文自动匹配，请指定新的章节 ID。</p>'+pending.map((item)=>'<article class="mt-2 flex items-center justify-between gap-2 text-sm"><span>'+html(item.note||item.quote||item.type)+'</span><button data-annotation-resolve="'+item.id+'">重新定位</button></article>').join('')+'</section>')
    card.scrollIntoView({behavior:'smooth',block:'start'})
  }
  async function loadDevices(){
    const list=$('#private-device-list');if(!list)return
    const devices=await api('/admin/devices')||[]
    list.innerHTML=devices.map((device)=>'<article class="admin-personal-item '+(device.revoked_at?'is-done':'')+'"><header><span>'+(device.revoked_at?'已撤销':'同步中')+'</span><small>'+html(String(device.last_seen_at||'').slice(0,16))+'</small></header><strong>'+html(device.name)+'</strong><p>'+html(device.platform||'')+'</p><footer>'+(device.revoked_at?'':'<button class="is-danger" data-device-revoke="'+device.id+'">撤销设备</button>')+'</footer></article>').join('')
  }
  async function registerDevice(){
    const data=await api('/admin/devices/register',{method:'POST',body:JSON.stringify({name:(navigator.userAgentData?.platform||'设备')+' · '+(navigator.userAgent.includes('Mobile')?'移动端':'浏览器'),platform:navigator.userAgent,client_id:deviceClientId()})})
    if(data.token){localStorage.setItem('boke_private_device_token',data.token);localStorage.setItem('boke_private_device_registered_client_id',deviceClientId())}
    await loadDevices();notify(data.reused?'当前设备信息已更新，没有重复添加':'当前设备已登记并开始同步')
  }
  document.addEventListener('click',async(event)=>{
    const button=event.target.closest('button');if(!button||!token())return
    try{
      if(button.closest('[data-panel-tab="books"]'))await loadBooks()
      if(button.closest('[data-personal-tab="devices"]'))await loadDevices()
      if(button.dataset.bookEdit)await editBook(button.dataset.bookEdit)
      if(button.dataset.bookDelete&&confirm('把这本书移入回收站吗？')){await api('/admin/books/'+button.dataset.bookDelete,{method:'DELETE'});await loadBooks()}
      if(button.dataset.bookRestore){await api('/admin/books/'+button.dataset.bookRestore+'/restore',{method:'PUT'});await loadBooks()}
      if(button.dataset.volumeAdd){const title=prompt('新分卷名称','正文');if(title){await api('/admin/books/'+button.dataset.volumeAdd+'/volumes',{method:'POST',body:JSON.stringify({title})});await editBook(button.dataset.volumeAdd)}}
      if(button.dataset.volumeRename){const title=prompt('新的卷名');if(title){await api('/admin/books/'+state.active.id+'/volumes/'+button.dataset.volumeRename,{method:'PUT',body:JSON.stringify({title})});await editBook(state.active.id)}}
      if(button.dataset.volumeDelete&&confirm('把这个分卷移入回收站吗？')){await api('/admin/books/'+state.active.id+'/volumes/'+button.dataset.volumeDelete,{method:'DELETE'});await editBook(state.active.id)}
      if(button.dataset.chapterDelete&&confirm('删除这个章节吗？')){await api('/admin/books/'+state.active.id+'/volumes/'+button.dataset.volumeId+'/chapters/'+button.dataset.chapterDelete,{method:'DELETE'});await editBook(state.active.id)}
      if(button.dataset.annotationResolve){const chapterId=prompt('请输入新的章节 ID');if(chapterId){await api('/admin/books/'+state.active.id+'/annotations/'+button.dataset.annotationResolve+'/resolve',{method:'PUT',body:JSON.stringify({chapter_id:Number(chapterId)})});await editBook(state.active.id);notify('标注已重新定位')}}
      if(button.dataset.deviceRevoke&&confirm('撤销后该设备将无法读取或同步私人数据，继续吗？')){await api('/admin/devices/'+button.dataset.deviceRevoke,{method:'DELETE'});await loadDevices()}
    }catch(error){notify(error.message,true)}
  })
  $('#book-epub-files')?.addEventListener('change',(event)=>{state.previewKind='epub';previewFiles(event.target.files)})
  $('#book-text-files')?.addEventListener('change',(event)=>{state.previewKind='text';previewFiles(event.target.files)})
  $('#book-pdf-file')?.addEventListener('change',async(event)=>{const file=event.target.files?.[0];if(!file)return;const title=prompt('书名',file.name.replace(/\.pdf$/i,''));if(!title){event.target.value='';return}const form=new FormData();form.append('file',file);form.append('title',title);try{await api('/admin/books/pdf/import',{method:'POST',body:form});await loadBooks();notify('PDF 已加入书库，将保留原版式打开')}catch(error){notify(error.message,true)}finally{event.target.value=''}})
  $('#book-new')?.addEventListener('click',()=>{const form=$('#book-form');form.reset();form.elements.namedItem('id').value='';form.elements.namedItem('reading_mode').value='chapters';form.elements.namedItem('source_format').value='epub';$('#book-volume-editor').innerHTML='';$('#book-editor-card').classList.remove('hidden')})
  $('#book-editor-close')?.addEventListener('click',()=>$('#book-editor-card').classList.add('hidden'))
  $('#book-form')?.addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget,payload=Object.fromEntries(new FormData(form));const id=payload.id;delete payload.id;try{const book=await api(id?'/admin/books/'+id:'/admin/books',{method:id?'PUT':'POST',body:JSON.stringify(payload)});await loadBooks();await editBook(book.id);notify('书籍已保存')}catch(error){notify(error.message,true)}})
  $('#register-current-device')?.addEventListener('click',()=>registerDevice().catch((error)=>notify(error.message,true)))
})()