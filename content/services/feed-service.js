(function(ZR){'use strict';
 function rows(){return (ZR.Config.feeds.feeds||[]).map(x=>JSON.parse(JSON.stringify(x)));}
 function validate(x,existingID=null){
   if(!x||typeof x!=='object')throw new Error('Feed required');
   const id=String(x.id||'').trim(); if(!/^[A-Za-z0-9_-]+$/.test(id))throw new Error('Invalid feed ID');
   if(!existingID&&rows().some(r=>r.id===id))throw new Error('Feed ID already exists');
   const name=String(x.name||'').trim(),type=String(x.type||'').trim(),url=String(x.url||'').trim(),query=String(x.query||'').trim();
   if(!name)throw new Error('Feed name required'); if(!type)throw new Error('Feed type required'); if(!url)throw new Error('Feed URL required');
   if(type.toLowerCase()==='europe_pmc_api'){
     if(/pubmed\.ncbi\.nlm\.nih\.gov\/rss\//i.test(url))throw new Error('PubMed RSS URL requires RSS/Atom or Link feed type');
     if(!query)throw new Error('Europe PMC API requires a query');
   }
   const max=Math.max(1,Math.min(1000,Number(x.max_items||100)||100));
   return {...x,id,name,type,url,enabled:x.enabled!==false,max_items:max,query,query_note:String(x.query_note||'')};
 }
 function deps(id){return (ZR.Config.subscriptions.subscriptions||[]).filter(s=>(s.feed_ids||[]).map(String).includes(String(id))).map(s=>({id:s.id,label:s.label,enabled:s.enabled!==false}));}
 async function persist(list){await ZR.ConfigManager.saveFeeds({...ZR.Config.feeds,feeds:list});ZR.Events?.emit('feeds:changed',{feeds:list});return list;}
 async function list(){return rows();}
 async function get(id){const x=rows().find(r=>r.id===String(id));if(!x)throw new Error('Unknown feed: '+id);return x;}
 async function create(x){const v=validate(x);await persist([...rows(),v]);return v;}
 async function update(id,x){const list=rows(),i=list.findIndex(r=>r.id===String(id));if(i<0)throw new Error('Unknown feed: '+id);const v=validate({...list[i],...x,id:String(id)},String(id));list[i]=v;await persist(list);return v;}
 async function duplicate(id,newID,newName){const src=await get(id);return create({...src,id:String(newID||''),name:String(newName||`${src.name} Copy`)});}
 async function remove(id){const used=deps(id);if(used.length)throw new Error('Feed is used by subscriptions: '+used.map(x=>x.label||x.id).join(', '));const list=rows(),i=list.findIndex(r=>r.id===String(id));if(i<0)throw new Error('Unknown feed: '+id);const [old]=list.splice(i,1);await persist(list);return old;}
 async function test(id){const f=await get(id);const r=await ZR.Feeds.fetchAll([f.id]);return {ok:r.errors===0,fetched:r.fetched,errors:r.errors,feed_errors:r.feed_errors||[],papers:(r.papers||[]).slice(0,5).map(p=>({title:p.title,url:p.url}))};}
 ZR.Services=ZR.Services||{};ZR.Services.Feeds={list,get,create,update,duplicate,remove,test,validate,deps};
})(ZR);
