(function (ZR) {
  'use strict';

  function validateSubscriptions(){
    const feedIDs=new Set((ZR.Config.feeds.feeds||[]).map(f=>String(f.id)));
    for(const s of ZR.Config.subscriptions.subscriptions||[]){
      if(!s.scorecard) throw new Error(`Subscription ${s.id} has no scorecard`);
      if(s.enabled!==false && ZR.Scorecards.has(s.scorecard)) continue;
      if(s.enabled!==false && !ZR.Scorecards.metadata.has(s.scorecard)) throw new Error(`Subscription ${s.id} references missing scorecard ${s.scorecard}`);
      // A subscription whose bundled scorecard was disabled is intentionally hidden, not fatal.
      for(const f of s.feed_ids||[]) if(!feedIDs.has(String(f))) throw new Error(`Subscription ${s.id} references missing feed ${f}`);
    }
  }

  function stage(name) {
    ZR.startupStage = name;
    try {
      Zotero.Prefs.set('extensions.zotradar.startupStage', name, true);
      Zotero.Prefs.set('extensions.zotradar.startupError', '', true);
    } catch (_) {}
  }

  function componentError(name, e) {
    const text = ZR.Utils && ZR.Utils.formatError ? ZR.Utils.formatError(e) : (e && e.stack ? String(e.stack) : String(e));
    ZR.componentErrors[name] = text;
    ZR.startupError = text;
    try {
      Zotero.Prefs.set('extensions.zotradar.startupStage', `degraded:${name}`, true);
      Zotero.Prefs.set('extensions.zotradar.startupError', text, true);
      Zotero.logError(e);
    } catch (_) {}
  }

  async function startup(){
    stage('core:brand-migration');
    try { await ZR.Settings.migrateLegacyBrand(); } catch (e) { componentError('brand-migration', e); }
    if (!ZR.Utils.getPref('translationDefaultV2', false)) {
      // The schema/prefs default is already true. Never overwrite a user's false.
      ZR.Utils.setPref('translationDefaultV2', true);
    }

    stage('core:config');
    await ZR.ConfigManager.load();
    await ZR.ConfigManager.writeTemplateIfMissing();

    stage('core:scorecards');
    await ZR.ScorecardManager.load();
    validateSubscriptions();

    // Register Zotero-visible UI before optional/heavier services. Even if the
    // plugin-owned DB or HTTP endpoint fails, users still get columns/pane/menus.
    stage('core:zotero-ui');
    if (Zotero.uiReadyPromise) await Zotero.uiReadyPromise;
    try { await ZR.UI.init(); } catch (e) { componentError('zotero-ui', e); }

    stage('core:database');
    let dbReady = false;
    try { await ZR.DB.init(); dbReady = true; }
    catch (e) { componentError('database', e); }
    if (dbReady) {
      // Item Tree/Pane cache is optional. A cache failure must not suppress
      // the otherwise healthy Local HTTP API and scheduler.
      try { await ZR.DB.loadItemCache(); }
      catch (e) { componentError('item-cache', e); }
    }

    stage('core:http-server');
    if (dbReady) {
      try { await ZR.HTTPServer.init(); } catch (e) { componentError('http-server', e); }
    }

    stage('core:scheduler');
    if (dbReady) {
      try { ZR.Scheduler.start(); } catch (e) { componentError('scheduler', e); }
      // Backfill scored papers from older releases. This only queues work;
      // translations are cached and run after startup with the screening LLM.
      try { await ZR.Services.Papers.backfillTitleTranslations(); }
      catch (e) { componentError('title-translations', e); }
    }

    if (Object.keys(ZR.componentErrors).length) {
      const first = Object.entries(ZR.componentErrors)[0];
      ZR.startupStage = 'degraded:' + first[0];
      ZR.startupError = first[1];
      try {
        Zotero.Prefs.set('extensions.zotradar.startupStage', ZR.startupStage, true);
        Zotero.Prefs.set('extensions.zotradar.startupError', ZR.startupError, true);
      } catch (_) {}
    }
    else {
      ZR.startupStage = 'ready';
      ZR.startupError = '';
    }
    ZR.Utils.log('ZotRadar started',ZR.version,'scorecards',ZR.Scorecards.all().map(c=>c.id).join(','));
  }

  async function shutdown(){
    try { ZR.Scheduler.stop(); } catch (_) {}
    try { ZR.HTTPServer.shutdown(); } catch (_) {}
    try { await ZR.UI.shutdown(); } catch (e) { try { Zotero.logError(e); } catch (_) {} }
    try { await ZR.DB.close(); } catch (e) { try { Zotero.logError(e); } catch (_) {} }
  }
  ZR.Main={startup,shutdown,validateSubscriptions};
})(ZR);
