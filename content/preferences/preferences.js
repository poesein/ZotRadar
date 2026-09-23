var zrPrefsHTML=tag=>document.createElementNS('http://www.w3.org/1999/xhtml',tag);
window.ZotRadarPrefs = {
  controls:new Map(), baseline:new Map(), secretClearChecks:new Map(), pendingDisplaySaves:new Set(),
  get ZR(){ return Zotero.ZotRadar || null; },
  i18n(){ return this.ZR && this.ZR.I18n || null; },
  t(key,vars={}){ const I=this.i18n(); return I ? I.t(key,vars) : key; },
  settings(){ return this.ZR && this.ZR.Settings || null; },
  groupLabel(group){ return this.t('group.'+group)||group; },
  setText(id,key){ const el=document.getElementById(id); if(el) el.textContent=this.t(key); },
  setLabel(id,key){ const el=document.getElementById(id); if(el) el.textContent=this.t(key); },
  applyStaticI18n(){
    for(const [id,key] of Object.entries({
      'zr-pref-intro':'prefs.intro','zr-pref-settings-title':'prefs.settingsTitle','zr-pref-settings-desc':'prefs.settingsDesc',
      'zr-pref-system-title':'prefs.systemStatus','zr-pref-diagnostics-title':'prefs.startupDiagnostics','zr-pref-raw-title':'prefs.technicalDetails'
    })) this.setText(id,key);
    for(const [id,key] of Object.entries({
      'zr-pref-save':'prefs.saveSettings','zr-pref-test-ollama':'prefs.testModel','zr-pref-test-easyscholar':'prefs.testEasyScholar',
      'zr-pref-open-dashboard':'prefs.openDashboard','zr-pref-system-refresh':'prefs.refreshSystemStatus','zr-pref-diagnostics-refresh':'prefs.refreshDiagnostics'
    })) this.setLabel(id,key);
  },
  async waitForI18n(){ for(let i=0;i<40;i++){ if(this.i18n())return true; await new Promise(r=>setTimeout(r,50)); } return false; },
  bindActions(){if(this.actionsBound)return;this.actionsBound=true;for(const [id,method] of Object.entries({'zr-pref-save':'save','zr-pref-test-ollama':'testModel','zr-pref-test-easyscholar':'testEasyScholar','zr-pref-open-dashboard':'openDashboard','zr-pref-system-refresh':'refreshSystemStatus','zr-pref-diagnostics-refresh':'refreshDiagnostics'})){document.getElementById(id)?.addEventListener('click',()=>{Promise.resolve().then(()=>this[method]()).catch(e=>{const status=document.getElementById('zr-pref-status');if(status)status.textContent=this.ZR?.I18n?.error(e)||String(e);try{Zotero.logError(e)}catch(_){}})})}},
  init(){if(this.initPromise)return this.initPromise;this.initPromise=(async()=>{try{await this.waitForI18n();this.applyStaticI18n();this.bindActions();this.renderSettings();this.refreshDiagnostics();await this.refreshSystemStatus()}catch(e){try{Zotero.logError(e)}catch(_){}}})();return this.initPromise},
  renderSettings(){
    const box=document.getElementById('zr-pref-settings-fields'); if(!box)return; box.textContent=''; this.controls.clear(); this.baseline.clear(); this.secretClearChecks.clear();
    const S=this.settings(); if(!S){ box.textContent=this.t('prefs.settingsUnavailable'); return; }
    const pack=S.getAll({redactSecrets:true}), schema=S.publicSchema(), current=pack.values, meta=pack.meta, groups=[];
    for(const def of schema){ let g=groups.find(x=>x.key===def.group); if(!g){g={key:def.group,defs:[]};groups.push(g);} g.defs.push(def); }
    for(const g of groups){
      const section=document.createElementNS('http://www.w3.org/1999/xhtml','details'); section.className='zr-settings-group'; if(['display','models','journal'].includes(g.key))section.open=true; const h=document.createElementNS('http://www.w3.org/1999/xhtml','summary'); h.textContent=this.groupLabel(g.key); section.appendChild(h);
      for(const def of g.defs){
        const row=zrPrefsHTML('div'); row.className='zr-setting-row'; row.dataset.setting=def.key; const label=zrPrefsHTML('label'); label.textContent=def.label; row.appendChild(label); let input;
        if(def.type==='boolean'){
          const wrap=zrPrefsHTML('div'); wrap.className='zr-setting-bool'; input=zrPrefsHTML('input'); input.type='checkbox'; input.checked=!!current[def.key]; wrap.appendChild(input); row.appendChild(wrap);
        } else if(def.type==='enum'){
          input=zrPrefsHTML('select'); for(const choice of def.choices||[]){const o=zrPrefsHTML('option');o.value=choice.value;o.textContent=choice.label;o.selected=choice.value===current[def.key];input.appendChild(o)}row.appendChild(input);
        } else if(def.type==='subscription'){
          input=zrPrefsHTML('select'); const choices=((this.ZR.Config&&this.ZR.Config.subscriptions&&this.ZR.Config.subscriptions.subscriptions)||[]).filter(x=>x.enabled!==false);
          for(const c of choices){ const o=zrPrefsHTML('option'); o.value=c.id; o.textContent=`${c.label} (${c.id})`; if(c.id===current[def.key])o.selected=true; input.appendChild(o); } row.appendChild(input);
        } else {
          input=zrPrefsHTML(def.type==='multiline'?'textarea':'input'); if(def.type!=='multiline')input.type=def.type==='secret'?'password':def.type==='integer'?'number':'text'; if(def.min!=null)input.min=def.min; if(def.max!=null)input.max=def.max; if(def.step!=null)input.step=def.step;
          if(def.type==='secret'){
            input.value=''; const configured=!!meta[def.key+'Configured']; input.placeholder=configured?this.t('secret.savedHint'):(def.placeholder||this.t('common.optional'));
            const box2=zrPrefsHTML('div'); box2.className='zr-secret-box'; box2.appendChild(input); const badge=zrPrefsHTML('span'); badge.className='zr-setting-note'; badge.textContent=configured?this.t('secret.savedBadge'):this.t('common.notConfigured'); box2.appendChild(badge);
            const clearWrap=zrPrefsHTML('label'); clearWrap.className='zr-setting-note'; const clear=zrPrefsHTML('input'); clear.type='checkbox'; this.secretClearChecks.set(def.key,clear); clearWrap.append(clear,document.createTextNode(' '+this.t('secret.clearLabel'))); box2.appendChild(clearWrap); row.appendChild(box2);
          } else { input.value=current[def.key]==null?'':current[def.key]; if(def.placeholder)input.placeholder=def.placeholder; row.appendChild(input); }
        }
        input.id='zr-setting-'+def.key; label.htmlFor=input.id; this.controls.set(def.key,{def,input}); this.baseline.set(def.key,def.type==='boolean'?input.checked:def.type==='integer'?Number(input.value):input.value);
        if(['showChineseTitle','showScopeColumn','showTopicColumn'].includes(def.key))input.addEventListener('change',()=>{this.saveDisplaySetting(def.key,input)});
        if(def.key==='modelProvider')input.addEventListener('change',()=>this.applyModelVisibility());
        section.appendChild(row);
        if(def.key==='reasoningEffort'){const note=zrPrefsHTML('p');note.className='zr-setting-note';note.textContent=this.t('setting.reasoningHint');section.appendChild(note);}
      }
      box.appendChild(section);
    }
    this.applyModelVisibility();
  },
  applyModelVisibility(){const provider=this.controls.get('modelProvider')?.input?.value||'ollama',local=provider==='ollama';for(const key of ['ollamaBaseURL','screeningModel','numCtx']){const row=document.querySelector(`[data-setting="${key}"]`);if(row)row.hidden=!local;}for(const key of ['apiKey','apiModel']){const row=document.querySelector(`[data-setting="${key}"]`);if(row)row.hidden=local;}const base=document.querySelector('[data-setting="apiBaseURL"]');if(base)base.hidden=provider!=='openai_compatible';},
  saveDisplaySetting(key,input){
    const S=this.settings(),value=input.checked,status=document.getElementById('zr-pref-status');
    if(!S||value===this.baseline.get(key))return;
    if(status)status.textContent=this.t('prefs.saving');
    const task=(async()=>{
      try{
        await (this.ZR.Services?.Settings?.update||S.update)({[key]:value});
        const saved=S.get(key);if(saved!==value)throw new Error('Setting did not persist: '+key);
        this.baseline.set(key,saved);
        if(this.controls.get(key)?.input===input&&input.checked===value&&status)status.textContent=this.t('prefs.saved');
      }catch(e){
        if(this.controls.get(key)?.input===input&&input.checked===value)input.checked=!!this.baseline.get(key);
        if(status)status.textContent=this.t('prefs.saveFailed',{error:this.ZR?.I18n?.error(e)||String(e)});
        try{Zotero.logError(e)}catch(_){}
      }
    })();
    this.pendingDisplaySaves.add(task);task.finally(()=>this.pendingDisplaySaves.delete(task));
  },
  async save(){
    await Promise.all([...this.pendingDisplaySaves]);
    const S=this.settings(); if(!S)throw new Error('ZotRadar settings service is unavailable'); const values={},clearSecrets=[];
    for(const [key,{def,input}] of this.controls){const value=def.type==='boolean'?input.checked:def.type==='integer'?Number(input.value):input.value;const clear=def.type==='secret'&&this.secretClearChecks.get(key)?.checked;if(clear)clearSecrets.push(key);if(clear||value!==this.baseline.get(key))values[key]=value;}
    try{ if(Object.keys(values).length)await (this.ZR.Services?.Settings?.update||S.update)(values,{preserveBlankSecrets:true,clearSecrets});for(const [key,value] of Object.entries(values)){const def=this.controls.get(key)?.def;if(def?.type==='boolean'&&S.get(key)!==value)throw new Error('Setting did not persist: '+key)}document.getElementById('zr-pref-status').textContent=this.t('prefs.saved'); this.renderSettings(); await this.refreshSystemStatus(); }
    catch(e){ document.getElementById('zr-pref-status').textContent=this.t('prefs.saveFailed',{error:this.ZR.I18n.error(e)}); throw e; }
  },
  async testModel(){ await this.save(); const s=document.getElementById('zr-pref-status'); s.textContent=this.t('prefs.testingModel'); try{const r=await this.ZR.Ollama.testConnection();s.textContent=this.t('prefs.modelConnected',{provider:r.provider,model:r.model});}catch(e){s.textContent=this.t('prefs.modelFailed',{error:String(e&&e.message||e)});} },
  async testEasyScholar(){ await this.save(); const s=document.getElementById('zr-pref-status'); if(!this.ZR.Settings.get('easyScholarKey')){s.textContent=this.t('prefs.easyScholarMissing');return;} s.textContent=this.t('prefs.testingEasyScholar'); try{const r=await this.ZR.Journal.testEasyScholar();s.textContent=r.ok?this.t('prefs.easyScholarOK',{journal:r.journal}):this.t('prefs.easyScholarFailed',{error:r.error||'unknown'});}catch(e){s.textContent=this.t('prefs.easyScholarFailed',{error:String(e&&e.message||e)});} },
  async refreshSystemStatus(){ const el=document.getElementById('zr-pref-system-status'); if(!el)return; if(!this.ZR||!this.ZR.Services?.System){el.textContent=this.t('prefs.coreUnavailable');return;} try{const s=await this.ZR.Services.System.status();el.textContent=JSON.stringify(s,null,2);const model=s.model||s.ollama||{};const grid=document.getElementById('zr-pref-health-cards');if(grid){grid.replaceChildren();const rows=[['prefs.healthPlugin',s.plugin?.ready?this.t('native.ready'):this.t('native.notReady'),!!s.plugin?.ready],['prefs.healthPapers',String(s.counts?.papers??0),true],['prefs.healthScreenings',String(s.counts?.screenings??0),true],['prefs.healthModel',model.ok?`${model.providerLabel||model.provider||''} · ${model.model||''}`:this.t('native.unreachable'),!!model.ok],['prefs.healthEasyScholar',s.settings_meta?.easyScholarKeyConfigured?this.t('common.configured'):this.t('common.notConfigured'),!!s.settings_meta?.easyScholarKeyConfigured],['prefs.healthAPI',s.api?.registered?this.t('native.available'):this.t('native.unreachable'),!!s.api?.registered]];for(const [label,value,ok] of rows){const card=zrPrefsHTML('div');card.className='zr-pref-health-card';const cap=zrPrefsHTML('div');cap.className='zr-pref-health-label';cap.textContent=this.t(label);const val=zrPrefsHTML('div');val.className='zr-pref-health-value';val.dataset.state=ok?'ok':'bad';val.textContent=value;card.append(cap,val);grid.appendChild(card)}}}catch(e){el.textContent=String(e&&e.message||e);} },
  refreshDiagnostics(){ let stage='unknown',error=''; try{stage=Zotero.Prefs.get('extensions.zotradar.startupStage',true)||'unknown';}catch(_){} try{error=Zotero.Prefs.get('extensions.zotradar.startupError',true)||'';}catch(_){} const core=!!this.ZR,started=!!(this.ZR&&this.ZR.started),el=document.getElementById('zr-pref-diagnostics'); if(el)el.textContent=`Core object: ${core?this.t('common.yes'):this.t('common.no')} | Core ready: ${started?this.t('common.yes'):this.t('common.no')} | Startup: ${stage}${error?'\n\n'+error:''}`; },
  openDashboard(){ const Z=this.ZR; if(Z&&Z.UI&&typeof Z.UI.openDashboard==='function')return Z.UI.openDashboard({page:'subscriptions'}); document.getElementById('zr-pref-status').textContent=this.t('prefs.dashboardUnavailable'); }
};
window.addEventListener('load',()=>{try{window.ZotRadarPrefs.init();}catch(e){try{Zotero.logError(e);}catch(_){}}},{once:true});
