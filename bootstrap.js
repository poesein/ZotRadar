var ZotRadar = null;
var ZRContext = null;
var ZRPreferencePaneID = null;
var ZRToolbarWindows = new Set();
var ZRChromeHandle = null;

function install() {}

function _getZotero() {
  // Zotero 7+ injects the Zotero object directly into bootstrap scope.
  // Do not use the obsolete @zotero.org/Zotero;1 XPCOM service here.
  return Zotero;
}

function _setStartupState(Zotero, stage, errorText) {
  try {
    Zotero.Prefs.set('extensions.zotradar.startupStage', String(stage || ''), true);
    Zotero.Prefs.set('extensions.zotradar.startupError', String(errorText || ''), true);
  }
  catch (_) {}
  if (ZotRadar) {
    ZotRadar.startupStage = String(stage || '');
    ZotRadar.startupError = String(errorText || '');
  }
}


function _bootstrapLocale() {
  let raw = '';
  try { raw = Services.locale && Services.locale.appLocaleAsBCP47 || ''; } catch (_) {}
  return /^zh(?:-|$)/i.test(String(raw || '')) ? 'zh-CN' : 'en-US';
}
function _bt(en, zh) { return _bootstrapLocale() === 'zh-CN' ? zh : en; }

function _formatError(e) {
  try { return e && e.stack ? String(e.stack) : String(e); }
  catch (_) { return 'Unknown startup error'; }
}

async function _registerPreferencePane(Zotero, rootURI) {
  if (ZRPreferencePaneID) return ZRPreferencePaneID;
  try {
    ZRPreferencePaneID = await Zotero.PreferencePanes.register({
      pluginID: 'zotradar@poesein',
      src: rootURI + 'content/preferences/preferences.xhtml',
      scripts: [rootURI + 'content/preferences/preferences.js'],
      stylesheets: [rootURI + 'content/preferences/preferences.css'],
      label: 'ZotRadar',
      image: rootURI + 'content/icons/zotradar-48.png'
    });
    if (ZotRadar) ZotRadar.preferencePaneID = ZRPreferencePaneID;
  }
  catch (e) {
    try { Zotero.logError(e); } catch (_) {}
  }
  return ZRPreferencePaneID;
}

function _openSettings(Zotero) {
  try {
    if (ZRPreferencePaneID) return Zotero.Utilities.Internal.openPreferences(ZRPreferencePaneID);
    return Zotero.Utilities.Internal.openPreferences();
  }
  catch (e) {
    try { Zotero.logError(e); } catch (_) {}
  }
}

function _showDiagnostics(Zotero) {
  let stage = 'unknown', error = '';
  try { stage = Zotero.Prefs.get('extensions.zotradar.startupStage', true) || 'unknown'; } catch (_) {}
  try { error = Zotero.Prefs.get('extensions.zotradar.startupError', true) || ''; } catch (_) {}
  const message = `Version: ${ZotRadar && ZotRadar.version || '5.3.1'}\nStartup stage: ${stage}\n\n${error ? 'Startup error:\n' + error : 'No startup error was recorded.'}`;
  try { Zotero.alert(null, 'ZotRadar Diagnostics', message); }
  catch (_) {
    try { Services.prompt.alert(null, 'ZotRadar Diagnostics', message); } catch (_) {}
  }
}

function _installToolbarButton(win) {
  if (!win || !win.document) return;
  const doc = win.document;
  const popup = doc.getElementById('menu_ToolsPopup');
  // Remove the four former Tools entries and older ZotRadar menu remnants.
  try {
    for (const node of [...(popup?.querySelectorAll('[id^="zotradar-"]')||[])]) node.remove();
    for (const id of ['zotradar-tools','zotradar-item']) {
      try { doc.getElementById(id)?.remove(); } catch (_) {}
    }
    for (const node of [...doc.querySelectorAll('menuitem[data-l10n-id^="zotradar-"], menu[data-l10n-id^="zotradar-"]')]) node.remove();
  } catch (_) {}
  try {
    const toolbar=doc.getElementById('zotero-items-toolbar');
    if (!toolbar) return;
    if (doc.getElementById('zotradar-toolbar-open')) return;
    const button=doc.createXULElement ? doc.createXULElement('toolbarbutton') : doc.createElement('toolbarbutton');
    button.id='zotradar-toolbar-open';
    button.className='zotero-tb-button';
    button.setAttribute('tabindex','-1');
    button.setAttribute('tooltiptext',_bt('Open ZotRadar in a separate window','在独立窗口打开 ZotRadar'));
    button.setAttribute('aria-label',_bt('Open ZotRadar','打开 ZotRadar'));
    button.setAttribute('image',(ZotRadar?.rootURI||'')+'content/icons/zotradar-16.png');
    button.addEventListener('command',()=>{
      try { if (ZotRadar && ZotRadar.UI) ZotRadar.UI.openDashboard(); else _showDiagnostics(_getZotero()); } catch (e) { try {_getZotero().logError(e);}catch(_){} }
    });
    toolbar.insertBefore(button,toolbar.querySelector('spacer[flex="1"]')||null);
    ZRToolbarWindows.add(win);
  }
  catch (e) { try { _getZotero().logError(e); } catch (_) {} }
}
function _removeToolbarButton(win) {
  if (!win || !win.document) return;
  for (const id of ['zotradar-toolbar-open','zotradar-fallback-settings','zotradar-fallback-dashboard','zotradar-fallback-run','zotradar-fallback-diagnostics','zotradar-fallback-separator','zotradar-tools','zotradar-item']) {
    try { win.document.getElementById(id)?.remove(); } catch (_) {}
  }
  ZRToolbarWindows.delete(win);
}

async function startup({ id, version, rootURI }) {
  const Zotero = _getZotero();
  _setStartupState(Zotero, 'bootstrap:init', '');
  await Zotero.initializationPromise;
  await Zotero.unlockPromise;

  let ServicesRef, PathUtilsRef, IOUtilsRef;
  try {
    ServicesRef = Services;
    PathUtilsRef = (typeof PathUtils !== 'undefined')
      ? PathUtils
      : ChromeUtils.importESModule('resource://gre/modules/PathUtils.sys.mjs').PathUtils;
    IOUtilsRef = (typeof IOUtils !== 'undefined')
      ? IOUtils
      : ChromeUtils.importESModule('resource://gre/modules/IOUtils.sys.mjs').IOUtils;
  }
  catch (e) {
    _setStartupState(Zotero, 'bootstrap:platform-imports-failed', _formatError(e));
    try { Zotero.logError(e); } catch (_) {}
    return;
  }

  ZotRadar = {
    id,
    version,
    rootURI,
    started: false,
    startupStage: 'bootstrap:object-created',
    startupError: '',
    registrations: [],
    timers: [],
    componentErrors: {},
    State: {
      itemCache: new Map(),
      runInProgress: false,
      shuttingDown: false,
    },
  };
  Zotero.ZotRadar = ZotRadar;
  ZRContext = { Zotero, Services: ServicesRef, PathUtils: PathUtilsRef, IOUtils: IOUtilsRef, ChromeUtils, Components, ZR: ZotRadar };

  // Register a preference pane before any heavy initialization. This guarantees a
  // visible diagnostics/settings surface even if DB, HTTP, or a later module fails.
  _setStartupState(Zotero, 'bootstrap:register-preferences', '');
  await _registerPreferencePane(Zotero, rootURI);

  // Add one main-toolbar shortcut; the former Tools menu entries are removed.
  try {
    if (Zotero.uiReadyPromise) await Zotero.uiReadyPromise;
    for (const win of Zotero.getMainWindows()) _installToolbarButton(win);
  }
  catch (e) { try { Zotero.logError(e); } catch (_) {} }

  // XUL dialog documents must be opened with a registered chrome URL. Opening
  // the jar:file rootURI directly can produce an empty native window.
  _setStartupState(Zotero, 'bootstrap:register-chrome', '');
  try {
    const startupService = Components.classes['@mozilla.org/addons/addon-manager-startup;1']
      .getService(Components.interfaces.amIAddonManagerStartup);
    const manifestURI = Services.io.newURI(rootURI + 'manifest.json');
    ZRChromeHandle = startupService.registerChrome(manifestURI, [
      ['content', 'zotradar', rootURI + 'content/']
    ]);
  }
  catch (e) {
    _setStartupState(Zotero, 'bootstrap:register-chrome-failed', _formatError(e));
    try { Zotero.logError(e); } catch (_) {}
    return;
  }

  const scripts = [
    'content/scripts/utils.js',
    'content/scripts/i18n.js',
    'content/scripts/settings.js',
    'content/scripts/config.js',
    'content/scripts/scorecards.js',
    'content/scripts/db.js',
    'content/scripts/evidence.js',
    'content/scripts/scoring.js',
    'content/scripts/ollama.js',
    'content/scripts/journal.js',
    'content/scripts/feedback.js',
    'content/scripts/feeds.js',
    'content/scripts/screening.js',
    'content/scripts/migration.js',
    'content/scripts/scheduler.js',
    'content/services/events.js',
    'content/services/settings-service.js',
    'content/services/subscription-service.js',
    'content/services/feed-service.js',
    'content/services/scorecard-service.js',
    'content/services/paper-service.js',
    'content/services/feedback-service.js',
    'content/services/system-service.js',
    'content/scripts/zotero-ui.js',
    'content/scripts/http-server.js',
    'content/scripts/main.js'
  ];

  for (const path of scripts) {
    _setStartupState(Zotero, 'bootstrap:load:' + path, '');
    try {
      Services.scriptloader.loadSubScript(rootURI + path, ZRContext, 'UTF-8');
    }
    catch (e) {
      const msg = _formatError(e);
      ZotRadar.componentErrors[path] = msg;
      _setStartupState(Zotero, 'bootstrap:load-failed:' + path, msg);
      try { Zotero.logError(e); } catch (_) {}
      return; // Keep plugin alive with fallback Settings/Diagnostics visible.
    }
  }

  _setStartupState(Zotero, 'core:startup', '');
  try {
    await ZotRadar.Main.startup();
    ZotRadar.started = true;
    _setStartupState(Zotero, ZotRadar.startupStage || 'ready', ZotRadar.startupError || '');
  }
  catch (e) {
    const msg = _formatError(e);
    ZotRadar.componentErrors.core = msg;
    _setStartupState(Zotero, 'core:startup-failed', msg);
    try { Zotero.logError(e); } catch (_) {}
    // Do not rethrow. The diagnostic/settings surface must remain usable.
  }
}

async function shutdown() {
  if (!ZotRadar) return;
  const Zotero = ZRContext && ZRContext.Zotero ? ZRContext.Zotero : _getZotero();
  try {
    ZotRadar.State.shuttingDown = true;
    if (ZotRadar.Main) await ZotRadar.Main.shutdown();
  }
  catch (e) { try { Zotero.logError(e); } catch (_) {} }
  try {
    if (ZRPreferencePaneID && Zotero.PreferencePanes.unregister) {
      await Zotero.PreferencePanes.unregister(ZRPreferencePaneID);
    }
  }
  catch (e) { try { Zotero.logError(e); } catch (_) {} }
  ZRPreferencePaneID = null;
  try { for (const win of Zotero.getMainWindows()) _removeToolbarButton(win); } catch (_) {}
  try { if (ZRChromeHandle) ZRChromeHandle.destruct(); } catch (e) { try { Zotero.logError(e); } catch (_) {} }
  ZRChromeHandle = null;
  try { if (Zotero.ZotRadar === ZotRadar) delete Zotero.ZotRadar; } catch (_) {}
  ZotRadar = null;
  ZRContext = null;
}

function onMainWindowLoad({ window }) {
  _installToolbarButton(window);
}

function onMainWindowUnload({ window }) {
  _removeToolbarButton(window);
}

function uninstall() {}
