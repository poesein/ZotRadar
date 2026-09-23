(function (ZR) {
  'use strict';

  const SCHEMA = [
    {key:'modelProvider', labelKey:'setting.modelProvider', group:'models', type:'enum', default:'ollama', choices:[
      {value:'ollama',labelKey:'setting.providerOllama'},
      {value:'deepseek',labelKey:'setting.providerDeepSeek'},
      {value:'openai',labelKey:'setting.providerOpenAI'},
      {value:'anthropic',labelKey:'setting.providerAnthropic'},
      {value:'gemini',labelKey:'setting.providerGemini'},
      {value:'qwen',labelKey:'setting.providerQwen'},
      {value:'openai_compatible',labelKey:'setting.providerCompatible'}
    ]},
    {key:'ollamaBaseURL', labelKey:'setting.ollamaBaseURL', group:'models', type:'string', default:'http://127.0.0.1:11434', placeholder:'http://127.0.0.1:11434'},
    {key:'screeningModel', labelKey:'setting.screeningModel', group:'models', type:'string', default:'qwen3:8b', placeholder:'qwen3:8b'},
    {key:'apiBaseURL', labelKey:'setting.apiBaseURL', group:'models', type:'string', default:'', placeholderKey:'setting.apiBaseURLHint'},
    {key:'apiKey', labelKey:'setting.apiKey', group:'models', type:'secret', default:'', placeholderKey:'setting.apiKeyHint'},
    {key:'apiModel', labelKey:'setting.apiModel', group:'models', type:'string', default:'', placeholderKey:'setting.apiModelHint'},
    {key:'reasoningEffort', labelKey:'setting.reasoningEffort', group:'models', type:'enum', default:'auto', choices:[
      {value:'auto',labelKey:'setting.effortAuto'}, {value:'none',labelKey:'setting.effortNone'},
      {value:'minimal',labelKey:'setting.effortMinimal'}, {value:'low',labelKey:'setting.effortLow'},
      {value:'medium',labelKey:'setting.effortMedium'}, {value:'high',labelKey:'setting.effortHigh'},
      {value:'xhigh',labelKey:'setting.effortXHigh'}, {value:'max',labelKey:'setting.effortMax'}
    ]},
    {key:'numCtx', labelKey:'setting.numCtx', group:'models', type:'integer', default:16384, min:2048, max:131072, step:1024},
    {key:'timeoutSeconds', labelKey:'setting.timeoutSeconds', group:'models', type:'integer', default:120, min:10, max:900, step:10},
    {key:'defaultSubscription', labelKey:'setting.defaultSubscription', group:'screening', type:'subscription', default:'protein_design'},
    {key:'autoRun', labelKey:'setting.autoRun', group:'scheduler', type:'boolean', default:true},
    {key:'dailyHour', labelKey:'setting.dailyHour', group:'scheduler', type:'integer', default:8, min:0, max:23, step:1},
    {key:'maxFeedItems', labelKey:'setting.maxFeedItems', group:'scheduler', type:'integer', default:100, min:1, max:1000, step:10},
    {key:'easyScholarKey', labelKey:'setting.easyScholarKey', group:'journal', type:'secret', default:'', placeholderKey:'common.optional'},
    {key:'titleLinkTarget', labelKey:'setting.titleLinkTarget', group:'display', type:'enum', default:'pubmed', choices:[{value:'pubmed',labelKey:'setting.linkPubMed'},{value:'doi',labelKey:'setting.linkDOI'}]},
    {key:'showChineseTitle', labelKey:'setting.showChineseTitle', group:'display', type:'boolean', default:true},
    {key:'showScopeColumn', labelKey:'setting.showScopeColumn', group:'display', type:'boolean', default:true},
    {key:'showTopicColumn', labelKey:'setting.showTopicColumn', group:'display', type:'boolean', default:false},
    {key:'priorityAuthors', labelKey:'setting.priorityAuthors', group:'display', type:'multiline', default:''},
    {key:'debug', labelKey:'setting.debug', group:'advanced', type:'boolean', default:false}
  ];

  const byKey = new Map(SCHEMA.map(x => [x.key, x]));

  function cloneSchema({localized=false}={}) {
    return SCHEMA.map(x => {
      const out={...x};
      if(localized){
        out.label = ZR.I18n ? ZR.I18n.t(x.labelKey || x.key) : (x.label || x.key);
        if(x.placeholderKey) out.placeholder = ZR.I18n ? ZR.I18n.t(x.placeholderKey) : '';
        if(x.choices) out.choices=x.choices.map(c=>({...c,label:ZR.I18n?ZR.I18n.t(c.labelKey):c.value}));
      }
      return out;
    });
  }

  function normalizeField(def, value) {
    if (!def) throw new Error('Unknown setting');
    if (def.type === 'boolean') return typeof value==='string'?value.toLowerCase()==='true'||value==='1':!!value;
    if (def.type === 'integer') {
      let n = Number(value);
      if (!Number.isFinite(n)) n = Number(def.default || 0);
      n = Math.round(n);
      if (def.min != null) n = Math.max(Number(def.min), n);
      if (def.max != null) n = Math.min(Number(def.max), n);
      return n;
    }
    if(def.type==='enum'){
      const selected=String(value==null?'':value).trim();
      return def.choices.some(c=>c.value===selected)?selected:def.default;
    }
    let s = String(value == null ? '' : value).trim();
    if (!s && def.type !== 'secret' && def.key !== 'priorityAuthors') s = String(def.default == null ? '' : def.default);
    if (def.key === 'ollamaBaseURL') s = s.replace(/\/+$/, '') || def.default;
    if (def.key === 'apiBaseURL') s = s.replace(/\/+$/, '');
    return s;
  }

  function get(key) {
    const def = byKey.get(key);
    if (!def) throw new Error(`Unknown setting: ${key}`);
    const value=normalizeField(def, ZR.Utils.getPref(key, def.default));
    if(key==='defaultSubscription'){
      const rows=ZR.Config?.subscriptions?.subscriptions||[];
      if(rows.length&&!rows.some(x=>x.id===value&&x.enabled!==false))return String(rows.find(x=>x.default&&x.enabled!==false)?.id||rows.find(x=>x.enabled!==false)?.id||value);
    }
    return value;
  }

  function getAll({redactSecrets=false}={}) {
    const out = {};
    const meta = {};
    for (const def of SCHEMA) {
      const value = get(def.key);
      if (def.type === 'secret' && redactSecrets) {
        out[def.key] = '';
        meta[`${def.key}Configured`] = !!value;
      }
      else out[def.key] = value;
    }
    return {values: out, meta};
  }

  async function update(values, {preserveBlankSecrets=false, clearSecrets=[]}={}) {
    values = values || {};
    const clear = new Set(clearSecrets || []);
    let defaultChanged = false;
    const normalized=[];
    for (const [key, raw] of Object.entries(values)) {
      const def = byKey.get(key);
      if (!def) continue;
      if(key==='reasoningEffort'&&!def.choices.some(c=>c.value===String(raw).trim()))throw new Error('Reasoning setting: invalid effort');
      if (def.type === 'secret' && preserveBlankSecrets && !clear.has(key) && String(raw == null ? '' : raw).trim() === '') continue;
      const value = clear.has(key) ? '' : normalizeField(def, raw);
      if(key==='defaultSubscription'&&ZR.Config?.subscriptions){
        const rows=ZR.Config.subscriptions.subscriptions||[];
        if(!rows.some(x=>x.id===value&&x.enabled!==false))throw new Error('Unknown or disabled subscription: '+value);
      }
      normalized.push([key,def,value]);
    }
    const prospective={};
    for(const def of SCHEMA)prospective[def.key]=get(def.key);
    for(const [key,,value] of normalized)prospective[key]=value;
    if(prospective.modelProvider==='ollama'&&!/^https?:\/\//i.test(String(prospective.ollamaBaseURL||'')))throw new Error('Ollama URL must start with http:// or https://');
    if(prospective.modelProvider!=='ollama'){
      if(!prospective.apiKey)throw new Error('API key is required for the selected provider');
      if(prospective.modelProvider!=='deepseek'&&!prospective.apiModel)throw new Error('API model is required for the selected provider');
      if(prospective.modelProvider==='openai_compatible'&&!prospective.apiBaseURL)throw new Error('API base URL is required for an OpenAI-compatible provider');
      if(prospective.modelProvider==='openai_compatible'&&!/^https?:\/\//i.test(String(prospective.apiBaseURL)))throw new Error('API base URL must start with http:// or https://');
    }
    for (const [key,def,value] of normalized) {
      if (key === 'defaultSubscription' && value !== ZR.Utils.getPref(key, def.default)) defaultChanged = true;
      ZR.Utils.setPref(key, value);
      const roundTrip=ZR.Utils.getPref(key, def.default);
      if(normalizeField(def,roundTrip)!==value)throw new Error(`Failed to persist setting: ${key}`);
    }
    if (defaultChanged && ZR.DB && ZR.DB.conn) {
      try { await ZR.DB.loadItemCache(); } catch (_) {}
      try { ZR.UI && ZR.UI.refreshColumns && ZR.UI.refreshColumns(); } catch (_) {}
    }
    return getAll({redactSecrets:true});
  }

  async function migrateLegacyBrand() {
    if (ZR.Utils.getPref('brandMigrationV1', false)) return {migrated:false, reason:'already-done'};
    const keys = SCHEMA.map(x => x.key).concat(['browserToken','lastDailyRun','lastProfileRebuild']);
    let prefCount = 0;
    for (const key of keys) {
      try {
        const old = Zotero.Prefs.get(`extensions.literature-sentinel.${key}`, true);
        if (old !== undefined && old !== null && old !== '') {
          Zotero.Prefs.set(`extensions.zotradar.${key}`, old, true);
          prefCount++;
        }
      } catch (_) {}
    }

    let dataCopied = false, dataMigrationError = null;
    try {
      const oldDir = PathUtils.join(Zotero.DataDirectory.dir, 'literature-sentinel');
      const newDir = PathUtils.join(Zotero.DataDirectory.dir, 'zotradar');
      if (await IOUtils.exists(oldDir)) {
        await IOUtils.makeDirectory(newDir, {ignoreExisting:true, createAncestors:true});
        const oldDB = PathUtils.join(oldDir, 'literature-sentinel.sqlite');
        const newDB = PathUtils.join(newDir, 'zotradar.sqlite');
        if ((await IOUtils.exists(oldDB)) && !(await IOUtils.exists(newDB))) {
          await IOUtils.copy(oldDB, newDB);
          dataCopied = true;
        }
        const oldSC = PathUtils.join(oldDir, 'scorecards');
        const newSC = PathUtils.join(newDir, 'scorecards');
        if ((await IOUtils.exists(oldSC)) && !(await IOUtils.exists(newSC))) {
          await IOUtils.copy(oldSC, newSC, {recursive:true});
          dataCopied = true;
        }
      }
    } catch (e) {
      dataMigrationError = String(e && e.message || e);
      try { Zotero.logError(e); } catch (_) {}
    }
    if (!dataMigrationError) ZR.Utils.setPref('brandMigrationV1', true);
    return {migrated: prefCount > 0 || dataCopied, prefCount, dataCopied, error:dataMigrationError};
  }

  function publicSchema() { return cloneSchema({localized:true}); }
  ZR.Settings = {SCHEMA:cloneSchema(), publicSchema, get, getAll, update, migrateLegacyBrand};
})(ZR);
