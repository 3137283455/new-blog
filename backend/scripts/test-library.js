const AdmZip=require('adm-zip')
const fs=require('fs'),os=require('os'),path=require('path')
const {spawn}=require('child_process')
const port=31993,origin='http://127.0.0.1:'+port,temp=fs.mkdtempSync(path.join(os.tmpdir(),'boke-library-test-')),dbPath=path.join(temp,'blog.db')
function epub(){
 const z=new AdmZip()
 z.addFile('mimetype',Buffer.from('application/epub+zip'))
 z.addFile('META-INF/container.xml',Buffer.from('<?xml version="1.0"?><container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>'))
 z.addFile('OPS/book.opf',Buffer.from('<?xml version="1.0"?><package><metadata><title>跨设备小说</title><creator>测试作者</creator></metadata><manifest><item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/><item id="v1" href="v1.xhtml" media-type="application/xhtml+xml"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="v2" href="v2.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="cover"/><itemref idref="v1"/><itemref idref="c1"/><itemref idref="v2"/><itemref idref="c2"/></spine></package>'))
 z.addFile('OPS/cover.xhtml',Buffer.from('<html><head><title>Cover</title></head><body><h1>Cover</h1><p>封面。</p></body></html>'))
 z.addFile('OPS/v1.xhtml',Buffer.from('<html><head><title>NO GAME NO LIFE BD VOL.01 特典</title></head><body><h1>NO GAME NO LIFE BD VOL.01 特典</h1><p>第一卷卷首。</p></body></html>'))
 z.addFile('OPS/c1.xhtml',Buffer.from('<html><head><title>第一章</title></head><body><h1>第一章</h1><p>第一章正文。</p></body></html>'))
 z.addFile('OPS/v2.xhtml',Buffer.from('<html><head><title>NO GAME NO LIFE BD Vol2 外传</title></head><body><h1>NO GAME NO LIFE BD Vol2 外传</h1><p>第二卷卷首。</p></body></html>'))
 z.addFile('OPS/c2.xhtml',Buffer.from('<html><head><title>第二章</title></head><body><h1>第二章</h1><p>第二章正文。</p></body></html>'))
 return z.toBuffer()
}
function verifyLegacyRestructure(){
 process.env.DB_PATH=dbPath
 process.env.UPLOAD_DIR=path.join(temp,'uploads')
 const {migrate}=require('../dist/database/schema')
 const db=require('../dist/config/database').default
 migrate()
 const book=db.prepare("INSERT INTO books (title,slug,status) VALUES ('旧结构小说','legacy-structure','published')").run()
 const volume=db.prepare("INSERT INTO book_volumes (book_id,title,slug,sort_order) VALUES (?,'正文','body',0)").run(book.lastInsertRowid)
 const insert=db.prepare('INSERT INTO book_chapters (volume_id,title,slug,sort_order) VALUES (?,?,?,?)')
 ;['Cover','NO GAME NO LIFE BD VOL.01 特典','第一章','NO GAME NO LIFE BD Vol2 外传','第二章'].forEach((title,index)=>insert.run(volume.lastInsertRowid,title,'legacy-'+index,index))
 migrate()
 const volumes=db.prepare('SELECT title FROM book_volumes WHERE book_id=? AND deleted_at IS NULL ORDER BY sort_order,id').all(book.lastInsertRowid)
 const chapters=db.prepare('SELECT COUNT(DISTINCT volume_id) count FROM book_chapters WHERE volume_id IN (SELECT id FROM book_volumes WHERE book_id=?)').get(book.lastInsertRowid)
 if(volumes.length!==2||chapters.count!==2||volumes.some(item=>item.title==='正文'))throw new Error('旧正文卷自动重构失败 '+JSON.stringify(volumes))
 db.close()
}async function wait(child){
 let out='';child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>out+=c)
 for(let i=0;i<240;i++){if(child.exitCode!==null)throw new Error('后端退出\n'+out);try{if((await fetch(origin+'/api/health')).ok)return}catch{}await new Promise(r=>setTimeout(r,200))}
 throw new Error('启动超时\n'+out)
}
async function main(){
 verifyLegacyRestructure()
 const child=spawn(process.execPath,['dist/app.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:String(port),BACKEND_HOST:'127.0.0.1',NODE_ENV:'test',JWT_SECRET:'library-test-secret-at-least-thirty-two-characters',ADMIN_PASSWORD:'library-test-password',DB_PATH:dbPath,UPLOAD_DIR:path.join(temp,'uploads'),CORS_ORIGIN:origin},stdio:['ignore','pipe','pipe']})
 try{
  await wait(child)
  const loginRes=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'library-test-password'})}),login=await loginRes.json()
  if(!login.data?.token)throw new Error('登录失败 '+JSON.stringify(login))
  const auth={Authorization:'Bearer '+login.data.token,'Content-Type':'application/json'}
  async function call(url,options={},allowError=false){const res=await fetch(origin+'/api'+url,{...options,headers:{...auth,...(options.headers||{})}}),body=await res.json();if(!allowError&&(!res.ok||body.success===false))throw new Error((options.method||'GET')+' '+url+' '+JSON.stringify(body));return {res,body}}
  const firstDevice=(await call('/admin/devices/register',{method:'POST',body:JSON.stringify({name:'测试私人设备',platform:'node',client_id:'library-test-device'})})).body.data
  const device=(await call('/admin/devices/register',{method:'POST',body:JSON.stringify({name:'测试私人设备（更新）',platform:'node-test',client_id:'library-test-device'})})).body.data
  if(device.id!==firstDevice.id||device.reused!==true)throw new Error('同一设备重复登记未复用原记录')
  const privateHeaders={'Content-Type':'application/json','X-Device-Token':device.token}
  const nav0=await fetch(origin+'/api/private/navigation',{headers:privateHeaders}),nav0j=await nav0.json()
  const nav1=await fetch(origin+'/api/private/navigation',{method:'PUT',headers:privateHeaders,body:JSON.stringify({revision:nav0j.data.revision,state:{favorites:['1'],workspace:'study'}})}),nav1j=await nav1.json()
  if(!nav1.ok||nav1j.data.revision!==1)throw new Error('导航同步失败')
  const conflict=await fetch(origin+'/api/private/navigation',{method:'PUT',headers:privateHeaders,body:JSON.stringify({revision:0,state:{favorites:['2']}})})
  if(conflict.status!==409)throw new Error('导航冲突未返回 409')
  const form=new FormData();form.append('files',new Blob([epub()],{type:'application/epub+zip'}),'whole-book.epub')
  const previewRes=await fetch(origin+'/api/admin/books/epub/preview',{method:'POST',headers:{Authorization:'Bearer '+login.data.token},body:form}),preview=await previewRes.json()
  if(!previewRes.ok||preview.data?.volumes?.length!==2||preview.data.volumes[0].chapter_count!==3||preview.data.volumes[1].chapter_count!==2)throw new Error('EPUB 分卷预览失败 '+JSON.stringify(preview))
  const committed=(await call('/admin/books/epub/commit',{method:'POST',body:JSON.stringify({token:preview.data.token,title:'跨设备小说',action:'separate'})})).body.data
  const books=(await call('/books')).body.data,book=books.find(item=>item.id===committed.book_id)
  if(!book||book.volume_count!==2||book.chapter_count!==5)throw new Error('公开书库统计错误')
  const detail=(await call('/books/'+book.slug)).body.data,volume=detail.volumes[0]
  const vd=(await call('/books/'+book.slug+'/'+volume.slug)).body.data,chapter=vd.volume.chapters[0]
  const chapterPage=(await call('/books/'+book.slug+'/'+volume.slug+'/'+chapter.slug)).body.data
  if(chapterPage.navigation.length!==5||new Set(chapterPage.navigation.map(item=>item.volume_id)).size!==2)throw new Error('阅读目录没有按整本书分卷')
  const progress=await fetch(origin+'/api/private/books/'+book.id+'/progress',{method:'PUT',headers:privateHeaders,body:JSON.stringify({volume_id:volume.id,chapter_id:chapter.id,position:.42,mode:'scroll',settings:{theme:'eye'},revision:0})}),progressJson=await progress.json()
  if(!progress.ok||progressJson.data.revision!==1)throw new Error('进度同步失败')
  const sameDeviceUpdate=await fetch(origin+'/api/private/books/'+book.id+'/progress',{method:'PUT',headers:privateHeaders,body:JSON.stringify({volume_id:volume.id,chapter_id:chapter.id,position:.8,revision:0})}),sameDeviceJson=await sameDeviceUpdate.json()
  if(!sameDeviceUpdate.ok||sameDeviceJson.data.revision!==2)throw new Error('同设备翻章被误判为同步冲突')
const privateLibrary=await (await fetch(origin+'/api/private/library',{headers:privateHeaders})).json()
  const continueBook=privateLibrary.data?.find(item=>item.id===book.id)
  if(!continueBook?.volume_slug||!continueBook?.chapter_slug||continueBook.overall_progress<=0)throw new Error('私人书库继续阅读信息错误 '+JSON.stringify(continueBook))
  const secondDevice=(await call('/admin/devices/register',{method:'POST',body:JSON.stringify({name:'另一台设备',platform:'node-second',client_id:'library-test-device-2'})})).body.data
  const secondHeaders={'Content-Type':'application/json','X-Device-Token':secondDevice.token}
  const progressConflict=await fetch(origin+'/api/private/books/'+book.id+'/progress',{method:'PUT',headers:secondHeaders,body:JSON.stringify({volume_id:volume.id,chapter_id:chapter.id,position:.2,revision:0})})
  if(progressConflict.status!==409)throw new Error('跨设备阅读冲突未返回 409')
  const annotation=await fetch(origin+'/api/private/books/'+book.id+'/annotations',{method:'POST',headers:privateHeaders,body:JSON.stringify({volume_id:volume.id,chapter_id:chapter.id,type:'note',note:'测试笔记',position:{progress:.42}})}),annotationJson=await annotation.json()
  if(!annotation.ok||!annotationJson.data?.id)throw new Error('私人笔记保存失败')
  const annotationList=await (await fetch(origin+'/api/private/books/'+book.id+'/annotations',{headers:privateHeaders})).json()
  const listedAnnotation=annotationList.data?.find(item=>item.id===annotationJson.data.id)
  if(!listedAnnotation?.chapter_slug||!listedAnnotation?.volume_slug)throw new Error('标注缺少章节定位信息')
  const annotationUpdate=await fetch(origin+'/api/private/books/'+book.id+'/annotations/'+annotationJson.data.id,{method:'PUT',headers:privateHeaders,body:JSON.stringify({note:'已编辑笔记',position:{progress:.5}})}),annotationUpdateJson=await annotationUpdate.json()
  if(!annotationUpdate.ok||annotationUpdateJson.data?.note!=='已编辑笔记')throw new Error('私人笔记编辑失败')
  const comment=await fetch(origin+'/api/book-volumes/'+volume.id+'/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({author_name:'读者',content:'本卷评论'})})
  const commentJson=await comment.json();if(!comment.ok)throw new Error('分卷评论失败 '+JSON.stringify(commentJson))
  await call('/admin/comments/'+commentJson.data.id+'/status',{method:'PUT',body:JSON.stringify({status:'approved'})})
  await call('/admin/books/'+book.id,{method:'DELETE'})
  if((await call('/books')).body.data.some(item=>item.id===book.id))throw new Error('书籍回收站未从公开书库隐藏')
  await call('/admin/books/'+book.id+'/restore',{method:'PUT'})
  const devices=(await call('/admin/devices')).body.data
  if(!devices.some(item=>item.id===device.id&&!item.revoked_at))throw new Error('设备列表错误')
  if(devices.filter(item=>item.client_id==='library-test-device').length!==1)throw new Error('同一设备产生了重复记录')
  const comments=(await fetch(origin+'/api/book-volumes/'+volume.id+'/comments')).json()
  const commentRows=await comments
  if(!commentRows.data?.length)throw new Error('分卷评论列表为空')
  await call('/admin/comments/'+commentRows.data[0].id+'/reply',{method:'POST',body:JSON.stringify({content:'站长回复'})})
  const replied=await (await fetch(origin+'/api/book-volumes/'+volume.id+'/comments')).json()
  if(!replied.data?.[0]?.children?.length)throw new Error('分卷评论后台回复失败')
  const fullResponse=await fetch(origin+'/api/admin/backup/full',{headers:{Authorization:'Bearer '+login.data.token}})
  if(!fullResponse.ok)throw new Error('完整备份下载失败')
  const backupZip=new AdmZip(Buffer.from(await fullResponse.arrayBuffer()))
  if(!backupZip.getEntry('blog.db')||!backupZip.getEntry('manifest.json'))throw new Error('完整备份缺少数据库或清单')
  console.log(JSON.stringify({success:true,book:{volumes:book.volume_count,chapters:book.chapter_count,structured_navigation:true},navigation_conflict:true,same_device_continuity:true,reading_conflict:true,legacy_restructure:true,annotation:true,volume_comment:true,comment_reply:true,recycle_bin:true,full_backup:true},null,2))
 }finally{child.kill('SIGTERM');await new Promise(r=>setTimeout(r,250));fs.rmSync(temp,{recursive:true,force:true})}
}
main().catch(error=>{console.error(error);process.exitCode=1})
