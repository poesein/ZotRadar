(function (ZR) {
  'use strict';
  async function readResourceJSON(path) { return await ZR.Utils.readResourceJSON(path); }
  async function readJSONFile(path, fallback=null) {
    try { if (!(await IOUtils.exists(path))) return fallback; return JSON.parse(await IOUtils.readUTF8(path)); }
    catch (e) { Zotero.logError(e); return fallback; }
  }
  async function writeJSONFile(path, value) { await IOUtils.writeUTF8(path, JSON.stringify(value, null, 2)); return value; }
  async function ensureDirs() {
    const dir = PathUtils.join(Zotero.DataDirectory.dir, 'zotradar');
    const scDir = PathUtils.join(dir, 'scorecards');
    const backupDir = PathUtils.join(dir, 'backups');
    await IOUtils.makeDirectory(dir, { ignoreExisting:true, createAncestors:true });
    await IOUtils.makeDirectory(scDir, { ignoreExisting:true, createAncestors:true });
    await IOUtils.makeDirectory(backupDir, { ignoreExisting:true, createAncestors:true });
    ZR.Paths = {
      dir, scorecards:scDir, backups:backupDir,
      db:PathUtils.join(dir,'zotradar.sqlite'),
      subscriptions:PathUtils.join(dir,'subscriptions.json'),
      feeds:PathUtils.join(dir,'feeds.json')
    };
  }
  async function load() {
    await ensureDirs();
    const [scoring, feedback, bundledFeeds, bundledSubs] = await Promise.all([
      readResourceJSON('config/scoring.json'), readResourceJSON('config/feedback.json'),
      readResourceJSON('config/feeds.json'), readResourceJSON('config/subscriptions.json')
    ]);
    const feeds = await readJSONFile(ZR.Paths.feeds, bundledFeeds) || bundledFeeds;
    const subscriptions = await readJSONFile(ZR.Paths.subscriptions, bundledSubs) || bundledSubs;
    ZR.Config = { scoring, feedback, feeds, subscriptions, bundledFeeds, bundledSubscriptions:bundledSubs };
    return ZR.Config;
  }
  async function saveSubscriptions(cfg) {
    if (!cfg || !Array.isArray(cfg.subscriptions)) throw new Error('subscriptions config must contain subscriptions[]');
    await writeJSONFile(ZR.Paths.subscriptions, cfg); ZR.Config.subscriptions = cfg; return cfg;
  }
  async function saveFeeds(cfg) {
    if (!cfg || !Array.isArray(cfg.feeds)) throw new Error('feeds config must contain feeds[]');
    await writeJSONFile(ZR.Paths.feeds, cfg); ZR.Config.feeds = cfg; return cfg;
  }
  async function resetSubscriptions(){ try{await IOUtils.remove(ZR.Paths.subscriptions);}catch(_){} ZR.Config.subscriptions=ZR.Config.bundledSubscriptions; return ZR.Config.subscriptions; }
  async function resetFeeds(){ try{await IOUtils.remove(ZR.Paths.feeds);}catch(_){} ZR.Config.feeds=ZR.Config.bundledFeeds; return ZR.Config.feeds; }
  async function writeTemplateIfMissing() {
    const dest = PathUtils.join(ZR.Paths.scorecards, '_template.json');
    if (!(await IOUtils.exists(dest))) await IOUtils.writeUTF8(dest, await ZR.Utils.readResourceText('config/scorecards/_template.json'));
  }
  ZR.ConfigManager = { readResourceJSON, load, ensureDirs, writeTemplateIfMissing, saveSubscriptions, saveFeeds, resetSubscriptions, resetFeeds };
})(ZR);