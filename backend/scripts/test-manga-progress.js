const {test}=require('node:test');
const assert=require('node:assert/strict');
const Database=require('better-sqlite3');
const {ReadingProgressRepository}=require('../dist/modules/manga/library/reading-progress');
function fixture(){
  const db=new Database(':memory:');
  db.exec(`CREATE TABLE manga_items(id INTEGER PRIMARY KEY,library_type TEXT);CREATE TABLE manga_volumes(id INTEGER PRIMARY KEY,manga_id INTEGER);CREATE TABLE manga_chapters(id INTEGER PRIMARY KEY,volume_id INTEGER);CREATE TABLE manga_reading_states(user_id INTEGER,manga_id INTEGER,volume_id INTEGER,chapter_id INTEGER,page_index INTEGER,mode TEXT,settings TEXT,revision INTEGER,device_id INTEGER,updated_at TEXT,PRIMARY KEY(user_id,manga_id));INSERT INTO manga_items VALUES(1,'local'),(2,'local');INSERT INTO manga_volumes VALUES(10,1),(20,2);INSERT INTO manga_chapters VALUES(11,10),(21,20);`);
  return{db,repository:new ReadingProgressRepository(db)};
}
test('double-page mode and settings survive a repository reconstruction',()=>{
  const{db,repository}=fixture();try{
    assert.deepEqual(repository.save(1,7,1,{volume_id:10,chapter_id:11,page_index:2,mode:'double',settings:{direction:'rtl'},revision:0}),{status:'saved',revision:1});
    const restored=new ReadingProgressRepository(db).get(1,1);
    assert.equal(restored.mode,'double');assert.deepEqual(restored.settings,{direction:'rtl'});assert.equal(restored.page_index,2);assert.equal(repository.get(2,1),null);
  }finally{db.close();}
});
test('foreign chapters and conflicting devices cannot silently overwrite progress',()=>{
  const{db,repository}=fixture();try{
    const progress={volume_id:10,chapter_id:11,page_index:0,mode:'paged',revision:0};
    assert.equal(repository.save(1,7,1,progress).status,'saved');
    assert.equal(repository.save(1,7,1,{...progress,volume_id:20,chapter_id:21}).status,'invalid-chapter');
    assert.equal(repository.save(1,8,1,progress).status,'conflict');
    assert.equal(repository.get(1,1).revision,1);
    assert.deepEqual(repository.save(1,8,1,{...progress,force:true}),{status:'saved',revision:2});
  }finally{db.close();}
});
