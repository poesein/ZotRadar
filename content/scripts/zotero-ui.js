(function (ZR) {
  'use strict';
  const registered={columns:[],pane:null};
  const paneViews=new Map(),paneUnsubs=[];
  const t=(key,vars={})=>ZR.I18n?ZR.I18n.t(key,vars):key;
  function cacheFor(item){return ZR.State.itemCache.get(`${item.libraryID}:${item.key}`)||null;}
  function ensureToken(){let token=String(ZR.Utils.getPref('browserToken','')||'');if(!token){token=ZR.Utils.randomToken(48);ZR.Utils.setPref('browserToken',token);}return token;}
  function dashboardURL(){ensureToken();return 'http://127.0.0.1:23119/zotradar/';}
  function openBrowserDashboard(){Zotero.launchURL(dashboardURL());}
  function openDashboard(initial={}){
    try{
      if(ZR.UI.dashboardWindow&&!ZR.UI.dashboardWindow.closed){
        ZR.UI.dashboardWindow.focus();
        try{ZR.UI.dashboardWindow.ZotRadarDashboard&&ZR.UI.dashboardWindow.ZotRadarDashboard.navigate(initial.page||'papers',initial);}catch(_){}
        return ZR.UI.dashboardWindow;
      }
      const win=Zotero.getMainWindow();
      const w=win.openDialog('chrome://zotradar/content/ui/dashboard/dashboard.xhtml','zotradar-dashboard','chrome,centerscreen,resizable,dialog=no,width=1260,height=820',{ZR,Zotero,initial});
      w.addEventListener('load',()=>{
        if(w.document?.documentElement?.id!=='zotradar-dashboard-window'){
          const detail=String(w.document?.documentURI||'unknown document');
          progress('ZotRadar','Native dashboard document failed to load: '+detail);
          try{Zotero.logError(new Error('ZotRadar dashboard document failed to load: '+detail))}catch(_){}
        }
      },{once:true});
      ZR.UI.dashboardWindow=w;return w;
    }catch(e){Zotero.logError(e);progress('ZotRadar',String(e.message||e));return null;}
  }
  async function openSettings(){try{const paneID=ZR.preferencePaneID;if(paneID)return await Zotero.Utilities.Internal.openPreferences(paneID);return await Zotero.Utilities.Internal.openPreferences();}catch(e){Zotero.logError(e);progress('ZotRadar',t('ui.settingsOpenFailed'));}}
  function progress(title,text){try{const p=new Zotero.ProgressWindow();p.changeHeadline(title);p.addDescription(text);p.show();p.startCloseTimer(2500);}catch(_) {}}
  async function screenSelected(){const pane=Zotero.getActiveZoteroPane();const items=(pane&&pane.getSelectedItems&&pane.getSelectedItems())||[];if(!items.length){progress('ZotRadar',t('ui.noSelected'));return;}progress('ZotRadar',t('ui.screeningItems',{count:items.length}));const r=await ZR.Services.Papers.screenZoteroItems(items);progress('ZotRadar',t('ui.completed',{done:r.screened,errors:r.errors}));}
  async function runNow(){const sub=await ZR.Services.Subscriptions.defaultSubscription();if(!sub){progress('ZotRadar','No active subscription');return;}progress('ZotRadar',t('ui.fetching'));try{const r=await ZR.Services.Subscriptions.run(sub.id);progress('ZotRadar',t('ui.runSummary',{fetched:r.fetched,screenings:r.screenings,errors:r.errors}));}catch(e){Zotero.logError(e);progress('ZotRadar',t('ui.runFailed'));}}
  function refreshColumns(){for(const win of Zotero.getMainWindows()){try{win.ZoteroPane&&win.ZoteroPane.itemsView&&win.ZoteroPane.itemsView.refresh();}catch(_) {}}}
  async function screeningForItem(item){return await ZR.Services.Papers.forZoteroItem(item);}
  async function renderPaneAsync(body,item){
    if(body&&item)paneViews.set(body,item);
    if(!item||!item.isRegularItem||!item.isRegularItem()){body.textContent=t('ui.selectRegular');return;}
    const {screening:c,paper}=await screeningForItem(item);body.textContent='';const doc=body.ownerDocument,wrap=doc.createElement('div');wrap.style.cssText='padding:8px 4px;font-size:13px;';
    if(!c){wrap.innerHTML='<div style="opacity:.75;margin-bottom:8px">'+ZR.Utils.escapeHTML(t('ui.noScore'))+'</div>';const b=doc.createElement('button');b.textContent=t('ui.screenItem');b.addEventListener('click',()=>ZR.Services.Papers.screenZoteroItems([item]).then(()=>renderPaneAsync(body,item)));wrap.appendChild(b);body.appendChild(wrap);return;}
    wrap.innerHTML=`<div style="display:flex;gap:8px;align-items:baseline"><b style="font-size:20px">${ZR.Utils.escapeHTML(c.grade||'—')}</b><b>${c.reading_priority==null?'—':Number(c.reading_priority).toFixed(1)}</b><span>${ZR.Utils.escapeHTML(c.scope||'')}</span><span>${ZR.Utils.escapeHTML(c.strength||'')}</span></div><div style="margin:6px 0;opacity:.8">${(c.topics||[]).map(ZR.Utils.escapeHTML).join(' · ')||t('ui.noTopic')}</div><div style="margin:8px 0;opacity:.75">${ZR.Utils.escapeHTML(c.subscription_id||'')} → ${ZR.Utils.escapeHTML(c.scorecard_id||'')}</div>`;
    const row=doc.createElement('div');row.style.cssText='display:flex;gap:6px;flex-wrap:wrap';
    const screen=doc.createElement('button');screen.textContent=t('ui.reScreen');screen.addEventListener('click',()=>ZR.Services.Papers.screenZoteroItems([item]).then(()=>renderPaneAsync(body,item)));
    const confirm=doc.createElement('button');confirm.textContent=t('ui.confirm');confirm.addEventListener('click',async()=>{try{const p=paper;if(!p||!c)throw new Error('No screening found');const m=c.model_judgement||{};await ZR.Services.Feedback.add({paper_id:p.id,scorecard_id:c.scorecard_id,corrected_scope:m.scope||c.scope,corrected_strength:['OUT_OF_SCOPE','UNCERTAIN'].includes(m.scope||c.scope)?null:(m.strength||c.strength),note:'Confirmed in Zotero Item Pane',confirm_correct:true});progress('ZotRadar',t('ui.judgmentSaved'));await renderPaneAsync(body,item);}catch(e){Zotero.logError(e);progress('ZotRadar',t('ui.feedbackFailed'));}});
    const dash=doc.createElement('button');dash.textContent=t('ui.openEdit');dash.addEventListener('click',()=>openDashboard({page:'papers',paperID:paper?paper.id:c.paper_id,subscriptionID:c.subscription_id||ZR.Utils.getPref('defaultSubscription','protein_design')}));
    row.append(screen,confirm,dash);wrap.appendChild(row);body.appendChild(wrap);
  }
  async function registerColumns(){for(const spec of [{key:'zrGrade',label:'ZR Grade',get:c=>c&&c.grade||''},{key:'zrScore',label:'ZR Score',get:c=>c&&c.reading_priority!=null?Number(c.reading_priority).toFixed(1):''},{key:'zrScope',label:'ZR Scope',get:c=>c&&c.scope||''}]){try{const id=await Zotero.ItemTreeManager.registerColumn({dataKey:spec.key,label:spec.label,pluginID:ZR.id,dataProvider:item=>spec.get(cacheFor(item)),flex:1});registered.columns.push(id);}catch(e){Zotero.logError(e);}}}
  function registerPane(){try{registered.pane=Zotero.ItemPaneManager.registerSection({paneID:'zotradar-pane',pluginID:ZR.id,header:{l10nID:'zotradar-pane-header',icon:ZR.rootURI+'content/icons/zotradar-32.png'},sidenav:{l10nID:'zotradar-pane-header',icon:ZR.rootURI+'content/icons/zotradar-32.png'},onRender:({body})=>{body.textContent=t('common.loading');},onAsyncRender:async({body,item})=>{try{await renderPaneAsync(body,item);}catch(e){body.textContent='ZotRadar error';Zotero.logError(e);}}});}catch(e){Zotero.logError(e);}}
  async function refreshPanes(event){for(const [body,item] of paneViews){if(!body.isConnected){paneViews.delete(body);continue}try{const paper=await ZR.DB.paperByZotero(item.libraryID,item.key);if(event?.paperID&&Number(paper?.id)!==Number(event.paperID))continue;await renderPaneAsync(body,item)}catch(e){Zotero.logError(e)}}}
  async function init(){try{Zotero.ftl.addResourceIds(['zotradar.ftl']);}catch(_){}await registerColumns();registerPane();paneUnsubs.push(ZR.Events.on('feedback:changed',e=>refreshPanes(e)),ZR.Events.on('papers:changed',e=>refreshPanes(e)));}
  async function shutdown(){try{if(ZR.UI.dashboardWindow&&!ZR.UI.dashboardWindow.closed)ZR.UI.dashboardWindow.close();}catch(_){}for(const u of paneUnsubs)u();paneUnsubs.length=0;paneViews.clear();for(const id of registered.columns){try{await Zotero.ItemTreeManager.unregisterColumn(id);}catch(_){}}registered.columns.length=0;if(registered.pane){try{Zotero.ItemPaneManager.unregisterSection(registered.pane);}catch(_){}registered.pane=null;}try{Zotero.ftl.removeResourceIds(['zotradar.ftl']);}catch(_){} }
  ZR.UI={dashboardWindow:null,ensureToken,dashboardURL,openDashboard,openBrowserDashboard,openSettings,screenSelected,runNow,refreshColumns,renderPaneAsync,init,shutdown,progress};
})(ZR);
