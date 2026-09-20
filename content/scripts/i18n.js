(function (ZR) {
  'use strict';

  const STRINGS = {
    'en-US': {
      'app.subtitle': 'Zotero Native · Generic Scorecards · Personal Relevance Learning',
      'common.connecting': 'Connecting…', 'common.save': 'Save', 'common.cancel': 'Cancel',
      'common.optional': 'Optional', 'common.configured': 'Configured', 'common.notConfigured': 'Not configured',
      'common.clear': 'Clear', 'common.refresh': 'Refresh', 'common.test': 'Test', 'common.failed': 'Failed',
      'common.saved': 'Saved', 'common.none': '(none)', 'common.loading': 'Loading…', 'common.yes': 'yes', 'common.no': 'no',
      'group.models': 'Models & inference', 'group.screening': 'Screening', 'group.scheduler': 'Feeds & schedule',
      'group.journal': 'Journal prior', 'group.advanced': 'Advanced',
      'setting.ollamaBaseURL': 'Ollama URL', 'setting.screeningModel': 'Screening model', 'setting.embeddingModel': 'Embedding model',
      'setting.numCtx': 'Context window', 'setting.timeoutSeconds': 'Request timeout (seconds)', 'setting.defaultScorecard': 'Default Scorecard', 'setting.defaultSubscription': 'Default subscription',
      'setting.autoRun': 'Enable daily catch-up run', 'setting.dailyHour': 'Daily run hour (0–23)', 'setting.maxFeedItems': 'Maximum items per feed',
      'setting.easyScholarKey': 'easyScholar secret key', 'setting.debug': 'Enable debug logging',
      'secret.savedHint': 'Configured — leave blank to keep the current key', 'secret.emptyHint': 'Optional',
      'secret.clearLabel': 'Clear saved key', 'secret.savedBadge': '✓ Configured',
      'prefs.intro': 'Zotero-native literature radar with local Ollama, generic Scorecards, feedback learning, and an integrated ZotRadar Dashboard.',
      'prefs.settingsTitle': 'Settings', 'prefs.settingsDesc': 'Program, model and scheduler settings. Research directions are managed in ZotRadar.',
      'prefs.saveSettings': 'Save settings', 'prefs.testOllama': 'Test Ollama', 'prefs.testEasyScholar': 'Test easyScholar', 'prefs.openDashboard': 'Manage subscriptions & Scorecards…',
      'prefs.settingsUnavailable': 'Settings schema is unavailable because the ZotRadar core has not loaded yet. See Startup diagnostics below.',
      'prefs.saved': 'Saved. ZotRadar now uses the updated values.', 'prefs.saveFailed': 'Save failed: {error}',
      'prefs.testingOllama': 'Testing Ollama…', 'prefs.ollamaConnected': 'Connected. Models: {models}', 'prefs.ollamaFailed': 'Failed: {error}',
      'prefs.testingEasyScholar': 'Testing easyScholar…', 'prefs.easyScholarOK': 'easyScholar key is valid. Test journal: {journal}.',
      'prefs.easyScholarFailed': 'easyScholar test failed: {error}', 'prefs.easyScholarMissing': 'Enter and save an easyScholar key first.',
      'prefs.scorecardsTitle': 'Scorecards', 'prefs.scorecardsDesc': 'Zotero and the browser Dashboard use the same Scorecard store. Bundled cards can be overridden, disabled, and restored.',
      'prefs.saveOverride': 'Save / Override', 'prefs.new': 'New', 'prefs.copy': 'Copy', 'prefs.deleteDisable': 'Delete / Disable', 'prefs.restoreBundled': 'Restore bundled',
      'prefs.activeDirections': 'Active subscription directions:', 'prefs.bundled': 'bundled', 'prefs.user': 'user', 'prefs.override': 'override', 'prefs.disabled': 'disabled',
      'prefs.scorecardSaved': 'Saved.', 'prefs.newID': 'New Scorecard ID (letters/numbers/_/-):', 'prefs.displayLabel': 'Display label:',
      'prefs.copyID': 'Copy to new Scorecard ID:', 'prefs.deleteConfirm': 'Delete/disable Scorecard "{id}"? Bundled cards can be restored later.',
      'prefs.restoreFailed': 'Restore failed: {error}',
      'prefs.migrationTitle': 'Import legacy Python v4.1 database', 'prefs.migrationDesc': 'Import papers, v4 screenings, active feedback, and journal cache from an old sentinel.db. The source file is never modified.',
      'prefs.migrationPlaceholder': 'Absolute path to old sentinel.db', 'prefs.import': 'Import', 'prefs.enterMigrationPath': 'Enter an absolute path to the old sentinel.db.',
      'prefs.migrationUnavailable': 'Migration service is unavailable.', 'prefs.importing': 'Importing…', 'prefs.importComplete': 'Import complete: {stats}', 'prefs.importFailed': 'Import failed: {error}',
      'prefs.systemStatus': 'System status', 'prefs.refreshSystemStatus': 'Refresh system status', 'prefs.startupDiagnostics': 'Startup diagnostics', 'prefs.refreshDiagnostics': 'Refresh diagnostics',
      'prefs.coreUnavailable': 'Core object unavailable.', 'prefs.dashboardUnavailable': 'Dashboard unavailable because the core did not finish startup. See diagnostics.',
      'web.runNow': 'Fetch & score now', 'web.tabPapers': 'Papers', 'web.tabFeedback': 'Feedback learning', 'web.tabScorecards': 'Scorecards', 'web.tabSettings': 'Settings',
      'web.subscription': 'Subscription', 'web.searchPlaceholder': 'Search title / abstract / authors', 'web.allGrades': 'All grades', 'web.allScopes': 'All scopes', 'web.allTopics': 'All topics',
      'web.correctedOnly': 'User-corrected only', 'web.colGrade': 'Grade', 'web.colPriority': 'Priority', 'web.colPaper': 'Paper', 'web.colScope': 'Scope', 'web.colJournal': 'Journal', 'web.colDate': 'Date',
      'web.newScorecard': 'New', 'web.saveOverride': 'Save / Override', 'web.copy': 'Copy', 'web.deleteDisable': 'Delete / Disable', 'web.restoreBundled': 'Restore bundled',
      'web.scorecardHint': 'Bundled Scorecards can be edited as user overrides. Deleting a bundled card disables it and it can be restored later. Custom Scorecards are deleted directly.',
      'web.noSubscriptions': 'No active subscription directions.', 'web.items': '{count} items', 'web.transferPrefix': 'Transfer: ', 'web.inZotero': 'In Zotero', 'web.import': 'Import', 'web.imported': 'Imported into Zotero',
      'web.reason': 'Reason', 'web.positiveEvidence': 'Positive evidence', 'web.negativeEvidence': 'Negative evidence', 'web.uncertainty': 'Uncertainty: {value}', 'web.abstract': 'Abstract', 'web.noAbstract': 'No abstract',
      'web.feedback': 'User feedback', 'web.relation': 'Relation', 'web.strength': 'Strength', 'web.transferTopic': 'Transfer topic', 'web.unspecifiedTransfer': 'Unspecified transfer topic',
      'web.priority': 'Priority', 'web.priorityNormal': 'Normal', 'web.priorityHigh': 'System ranked too high', 'web.priorityLow': 'System ranked too low', 'web.note': 'Note (optional)',
      'web.saveFeedback': 'Save feedback', 'web.revokeFeedback': 'Revoke feedback', 'web.feedbackSaved': 'Feedback saved', 'web.feedbackRevoked': 'Feedback revoked',
      'web.rebuildProfile': 'Rebuild Profile', 'web.rollback': 'Rollback', 'web.rollbackTo': 'Rollback to ', 'web.notBuilt': 'Not built', 'web.pendingRebuild': 'pending rebuild',
      'web.profileRebuilt': 'Profile rebuilt', 'web.profileRolledBack': 'Profile rolled back', 'web.disabled': '[disabled] ', 'web.scorecardSaved': 'Scorecard saved', 'web.created': 'Created', 'web.copied': 'Copied',
      'web.deletedDisabled': 'Deleted/disabled', 'web.restoredBundled': 'Bundled Scorecard restored', 'web.newScorecardID': 'New Scorecard ID (letters/numbers/_/-):', 'web.copyScorecardID': 'Copy to new Scorecard ID:',
      'web.displayName': 'Display name:', 'web.deleteConfirm': 'Delete/disable {label} ({id})? Bundled Scorecards can be restored later.', 'web.saveFailed': 'Save failed: {error}',
      'web.settingsActions': 'Save & connection tests', 'web.saveSettings': 'Save settings', 'web.testOllama': 'Test Ollama', 'web.testEasyScholar': 'Test easyScholar',
      'web.settingsSaved': 'Settings saved', 'web.ollamaConnected': 'Ollama connected: {models}', 'web.ollamaUnavailable': 'Ollama unavailable: {error}',
      'web.easyScholarOK': 'easyScholar key is valid. Test journal: {journal}', 'web.easyScholarFailed': 'easyScholar test failed: {error}', 'web.easyScholarMissing': 'Save an easyScholar key first.',
      'web.migrationTitle': 'Import Python v4.1 database', 'web.migrationDesc': 'Enter the absolute path to an old sentinel.db. The real v4.1.0 schema is detected automatically; the source file is never modified.',
      'web.migrationPlaceholder': 'Absolute path to old sentinel.db', 'web.startMigration': 'Start import', 'web.migrationDone': 'Import complete: papers {papers}, v4 screenings {screenings}, journals {journals}', 'web.migrationFailed': 'Import failed: {error}',
      'web.subscriptionsTitle': 'Subscription directions', 'web.systemStatus': 'System status', 'web.running': 'Running…', 'web.runDone': 'Done: fetched {fetched}, scored {screenings}',
      'web.readOnly': 'ZotRadar is in read-only browser mode. Use the Zotero toolbar button to open the native window for feedback and other write actions.',
      'web.startupFailed': 'Dashboard startup failed', 'web.startupHint': 'Try /zotradar/api/ping and /zotradar/api/status in the same browser.',
      "native.phase1Badge": "Native Dashboard · Phase 1/3",
      "native.tab.papers": "Papers",
      "native.tab.subscriptions": "Subscriptions",
      "native.tab.scorecards": "Scorecards",
      "native.tab.feedback": "Feedback",
      "native.tab.system": "System",
      "native.phase2Placeholder": "This workspace is reserved for Phase 2/3. Phase 1 intentionally validates the native shell and Papers workflow first.",
      "native.noSubscriptions": "No active subscriptions.",
      "native.runCurrent": "Fetch & score now",
      "native.running": "Running current subscription…",
      "native.runDone": "Fetched {fetched}; screened {screenings}; errors {errors}.",
      "native.searchPlaceholder": "Search title / abstract / journal",
      "native.allGrades": "All grades",
      "native.allScopes": "All scopes",
      "native.allTopics": "All topics",
      "native.papersSummary": "{subscription} → {scorecard} · {count} papers",
      "native.emptyPapers": "No papers for this subscription yet. Run it once to populate results.",
      "native.reason": "Reason",
      "native.abstract": "Abstract",
      "native.noAbstract": "No abstract",
      "native.baseRelevance": "Base relevance",
      "native.feedbackAdj": "Feedback adjustment",
      "native.journalAdj": "Journal adjustment",
      "native.personalized": "Personalized relevance",
      "native.priority": "Reading priority",
      "native.positiveEvidence": "Positive evidence",
      "native.negativeEvidence": "Negative evidence",
      "native.uncertainty": "Uncertainty",
      "native.rescreen": "Re-screen",
      "native.rescreened": "Re-screen complete",
      "native.inZotero": "In Zotero",
      "native.importZotero": "Import to Zotero",
      "native.imported": "Imported into Zotero",
      "native.markRead": "Mark read",
      "native.markedRead": "Marked read",
      "native.pageOf": "Page {page} / {pages}",
      "native.phase2Badge": "Native Dashboard · Phase 2/3",
      "native.phase3Placeholder": "This workspace is intentionally deferred to Phase 3/3.",
      "native.subscriptionsTitle": "Subscriptions & Feeds", "native.subscriptionsDesc": "Each research direction binds feeds to one Scorecard. Switching direction changes the actual screening context.",
      "native.newSubscription": "New subscription", "native.selectSubscription": "Select a subscription", "native.selectSubscriptionHint": "Choose a direction on the left or create a new one.",
      "native.subscriptionID": "Subscription ID", "native.label": "Label", "native.enabled": "Enabled", "native.makeDefault": "Make default", "native.scorecard": "Scorecard", "native.feeds": "feeds", "native.papers": "papers", "native.default": "Default", "native.disabled": "Disabled",
      "native.idHint": "Letters, numbers, _ and - only", "native.editSubscription": "Edit {label}", "native.subscriptionSaved": "Subscription saved", "native.copySubscriptionID": "New subscription ID:", "native.displayName": "Display name:", "native.subscriptionDuplicated": "Subscription duplicated", "native.deleteSubscriptionConfirm": "Delete subscription “{label}”? Existing screening history is kept.", "native.subscriptionDeleted": "Subscription deleted", "native.setDefault": "Set default", "native.defaultUpdated": "Default subscription updated",
      "native.feedLibrary": "Feed library", "native.feedLibraryDesc": "Feeds can be shared by multiple subscriptions. A feed in use cannot be deleted.", "native.newFeed": "New feed", "native.notUsed": "Not used", "native.testingFeed": "Testing feed…", "native.feedTestResult": "Fetched {fetched}; errors {errors}", "native.copyFeedID": "New feed ID:", "native.feedDuplicated": "Feed duplicated", "native.deleteFeedConfirm": "Delete feed “{label}”?", "native.feedDeleted": "Feed deleted", "native.feedSaved": "Feed saved", "native.feedID": "Feed ID", "native.feedName": "Feed name", "native.feedType": "Feed type", "native.feedURL": "URL", "native.feedQuery": "Query", "native.maxItems": "Maximum items", "native.feedNote": "Notes",
      "native.scorecardsTitle": "Scorecards", "native.scorecardsDesc": "Manage long-lived research semantics independently from subscriptions.", "native.newScorecard": "New Scorecard", "native.newScorecardID": "New Scorecard ID:", "native.scorecardCreated": "Scorecard created", "native.bundled": "Bundled", "native.userDefined": "User", "native.override": "Override", "native.formEditor": "Form editor", "native.advancedJSON": "Advanced JSON", "native.applyJSON": "Apply JSON", "native.scorecardDependencies": "Used by subscriptions: {list}. Remove or rebind those subscriptions before disabling/deleting this Scorecard.", "native.scorecardSaved": "Scorecard saved", "native.copyScorecardID": "Copy to Scorecard ID:", "native.scorecardDuplicated": "Scorecard duplicated", "native.restoreBundled": "Restore bundled", "native.resetBundled": "Reset bundled", "native.resetScorecardConfirm": "Discard the override and restore bundled “{label}”?", "native.scorecardRestored": "Bundled Scorecard restored", "native.scorecardReset": "Bundled Scorecard reset", "native.disableScorecard": "Disable", "native.disableScorecardConfirm": "Disable bundled Scorecard “{label}”?", "native.scorecardDisabled": "Scorecard disabled", "native.deleteScorecardConfirm": "Delete Scorecard “{label}”?", "native.scorecardDeleted": "Scorecard deleted", "native.scorecardID": "Scorecard ID", "native.version": "Version", "native.description": "Description", "native.directScope": "Direct scope", "native.contextualScope": "Contextual scope", "native.transferableScope": "Transferable scope", "native.anchors": "Anchors", "native.aliases": "Aliases", "native.onePerLine": "One value per line", "native.topics": "Topics", "native.transferableTopics": "Transferable topics", "native.topicID": "Topic ID", "native.addTopic": "Add topic", "native.addTransferableTopic": "Add transferable topic", "native.exclusions": "Exclusions", "native.examples": "Examples", "native.semanticProfile": "Semantic profile", "native.positiveDescriptions": "Positive descriptions", "native.negativeDescriptions": "Negative descriptions", "native.transferableDescriptions": "Transferable descriptions",
      "common.edit": "Edit", "common.delete": "Delete", "common.duplicate": "Duplicate", "common.remove": "Remove",
      'ui.settings': 'ZotRadar Settings', 'ui.dashboard': 'Open ZotRadar', 'ui.runNow': 'Run ZotRadar now', 'ui.diagnostics': 'ZotRadar Startup Diagnostics',
      'ui.noSelected': 'No regular items selected.', 'ui.screeningItems': 'Screening {count} selected item(s)…', 'ui.completed': 'Completed: {done}, errors: {errors}',
      'ui.fetching': 'Fetching and screening feeds…', 'ui.runSummary': 'Fetched {fetched}; screened {screenings}; errors {errors}.', 'ui.runFailed': 'Run failed. Check Error Console.',
      'ui.selectRegular': 'Select a regular bibliographic item.', 'ui.noScore': 'No ZotRadar score yet.', 'ui.screenItem': 'Screen this item', 'ui.reScreen': 'Re-screen', 'ui.confirm': '✓ Confirm judgment',
      'ui.openEdit': 'Open ZotRadar / Edit', 'ui.judgmentSaved': 'Judgment confirmed and saved as feedback.', 'ui.feedbackFailed': 'Could not save feedback.', 'ui.noTopic': 'No topic label',
      'ui.settingsOpenFailed': 'Could not open Settings. Use Edit → Settings and select ZotRadar.'
    },
    'zh-CN': {
      'app.subtitle': 'Zotero 原生 · 通用 Scorecard · 个性化相关性学习',
      'common.connecting': '连接中…', 'common.save': '保存', 'common.cancel': '取消',
      'common.optional': '可选', 'common.configured': '已配置', 'common.notConfigured': '未配置',
      'common.clear': '清除', 'common.refresh': '刷新', 'common.test': '测试', 'common.failed': '失败',
      'common.saved': '已保存', 'common.none': '（无）', 'common.loading': '加载中…', 'common.yes': '是', 'common.no': '否',
      'group.models': '模型与推理', 'group.screening': '筛选', 'group.scheduler': '抓取与调度', 'group.journal': '期刊先验', 'group.advanced': '高级',
      'setting.ollamaBaseURL': 'Ollama 地址', 'setting.screeningModel': '筛选模型', 'setting.embeddingModel': 'Embedding 模型',
      'setting.numCtx': '上下文长度', 'setting.timeoutSeconds': '请求超时（秒）', 'setting.defaultScorecard': '默认 Scorecard', 'setting.defaultSubscription': '默认订阅方向',
      'setting.autoRun': '启用每日补跑', 'setting.dailyHour': '每日运行小时（0–23）', 'setting.maxFeedItems': '每个 Feed 最大条目数',
      'setting.easyScholarKey': 'easyScholar Secret Key', 'setting.debug': '启用调试日志',
      'secret.savedHint': '已配置——留空将保留当前 Key', 'secret.emptyHint': '可选', 'secret.clearLabel': '清除已保存 Key', 'secret.savedBadge': '✓ 已配置',
      'prefs.intro': 'Zotero 原生文献雷达：本地 Ollama、通用 Scorecard、反馈学习与内置 ZotRadar Dashboard。',
      'prefs.settingsTitle': '设置', 'prefs.settingsDesc': '程序、模型与调度设置。研究方向请在 ZotRadar Dashboard 中管理。',
      'prefs.saveSettings': '保存设置', 'prefs.testOllama': '测试 Ollama', 'prefs.testEasyScholar': '测试 easyScholar', 'prefs.openDashboard': '管理订阅与 Scorecards…',
      'prefs.settingsUnavailable': 'ZotRadar 核心尚未加载，设置 Schema 暂不可用。请查看下方启动诊断。',
      'prefs.saved': '已保存。ZotRadar 已使用更新后的设置。', 'prefs.saveFailed': '保存失败：{error}',
      'prefs.testingOllama': '正在测试 Ollama…', 'prefs.ollamaConnected': '连接成功。模型：{models}', 'prefs.ollamaFailed': '失败：{error}',
      'prefs.testingEasyScholar': '正在测试 easyScholar…', 'prefs.easyScholarOK': 'easyScholar Key 有效。测试期刊：{journal}。',
      'prefs.easyScholarFailed': 'easyScholar 测试失败：{error}', 'prefs.easyScholarMissing': '请先填写并保存 easyScholar Key。',
      'prefs.scorecardsTitle': 'Scorecards', 'prefs.scorecardsDesc': 'Zotero 与浏览器 Dashboard 使用同一份 Scorecard 存储。内置卡可覆盖编辑、禁用并恢复。',
      'prefs.saveOverride': '保存 / 覆盖', 'prefs.new': '新建', 'prefs.copy': '复制', 'prefs.deleteDisable': '删除 / 禁用', 'prefs.restoreBundled': '恢复内置',
      'prefs.activeDirections': '当前启用的订阅方向：', 'prefs.bundled': '内置', 'prefs.user': '用户', 'prefs.override': '覆盖', 'prefs.disabled': '已禁用',
      'prefs.scorecardSaved': '已保存。', 'prefs.newID': '新 Scorecard ID（字母/数字/_/-）：', 'prefs.displayLabel': '显示名称：',
      'prefs.copyID': '复制到新的 Scorecard ID：', 'prefs.deleteConfirm': '删除/禁用 Scorecard“{id}”？内置卡稍后可以恢复。', 'prefs.restoreFailed': '恢复失败：{error}',
      'prefs.migrationTitle': '导入旧 Python v4.1 数据库', 'prefs.migrationDesc': '从旧 sentinel.db 导入论文、v4 评分、有效反馈和期刊缓存。源文件不会被修改。',
      'prefs.migrationPlaceholder': '旧 sentinel.db 的绝对路径', 'prefs.import': '导入', 'prefs.enterMigrationPath': '请输入旧 sentinel.db 的绝对路径。',
      'prefs.migrationUnavailable': '迁移服务不可用。', 'prefs.importing': '正在导入…', 'prefs.importComplete': '导入完成：{stats}', 'prefs.importFailed': '导入失败：{error}',
      'prefs.systemStatus': '系统状态', 'prefs.refreshSystemStatus': '刷新系统状态', 'prefs.startupDiagnostics': '启动诊断', 'prefs.refreshDiagnostics': '刷新诊断',
      'prefs.coreUnavailable': '核心对象不可用。', 'prefs.dashboardUnavailable': '核心未完成启动，Dashboard 不可用。请查看诊断。',
      'web.runNow': '立即抓取与评分', 'web.tabPapers': '文献', 'web.tabFeedback': '反馈学习', 'web.tabScorecards': 'Scorecards', 'web.tabSettings': '设置',
      'web.subscription': '订阅方向', 'web.searchPlaceholder': '搜索标题 / 摘要 / 作者', 'web.allGrades': '全部等级', 'web.allScopes': '全部 Scope', 'web.allTopics': '全部 Topic',
      'web.correctedOnly': '仅人工修正', 'web.colGrade': '级别', 'web.colPriority': '优先级', 'web.colPaper': '论文', 'web.colScope': 'Scope', 'web.colJournal': '期刊', 'web.colDate': '日期',
      'web.newScorecard': '新建', 'web.saveOverride': '保存 / 覆盖', 'web.copy': '复制', 'web.deleteDisable': '删除 / 禁用', 'web.restoreBundled': '恢复内置',
      'web.scorecardHint': '内置 Scorecard 可编辑为用户 override；删除内置卡会将其禁用，之后可恢复。自定义 Scorecard 会直接删除。',
      'web.noSubscriptions': '没有启用的订阅方向。', 'web.items': '{count} 条', 'web.transferPrefix': '迁移：', 'web.inZotero': '已在 Zotero', 'web.import': '导入', 'web.imported': '已导入 Zotero',
      'web.reason': '判断理由', 'web.positiveEvidence': '正向证据', 'web.negativeEvidence': '负向证据', 'web.uncertainty': '不确定性：{value}', 'web.abstract': '摘要', 'web.noAbstract': '无摘要',
      'web.feedback': '人工反馈', 'web.relation': '相关关系', 'web.strength': '强度', 'web.transferTopic': '迁移主题', 'web.unspecifiedTransfer': '未指定迁移主题',
      'web.priority': '优先级', 'web.priorityNormal': '正常', 'web.priorityHigh': '系统排高了', 'web.priorityLow': '系统排低了', 'web.note': '备注（可选）',
      'web.saveFeedback': '保存反馈', 'web.revokeFeedback': '撤销反馈', 'web.feedbackSaved': '反馈已保存', 'web.feedbackRevoked': '反馈已撤销',
      'web.rebuildProfile': '重建 Profile', 'web.rollback': '回滚', 'web.rollbackTo': '回滚到 ', 'web.notBuilt': '未建立', 'web.pendingRebuild': '等待重建',
      'web.profileRebuilt': 'Profile 已重建', 'web.profileRolledBack': 'Profile 已回滚', 'web.disabled': '[已禁用] ', 'web.scorecardSaved': 'Scorecard 已保存', 'web.created': '已新建', 'web.copied': '已复制',
      'web.deletedDisabled': '已删除/禁用', 'web.restoredBundled': '已恢复内置 Scorecard', 'web.newScorecardID': '新 Scorecard ID（字母/数字/_/-）：', 'web.copyScorecardID': '复制到新的 Scorecard ID：',
      'web.displayName': '显示名称：', 'web.deleteConfirm': '删除/禁用 {label} ({id})？内置 Scorecard 可稍后恢复。', 'web.saveFailed': '保存失败：{error}',
      'web.settingsActions': '保存与连接测试', 'web.saveSettings': '保存设置', 'web.testOllama': '测试 Ollama', 'web.testEasyScholar': '测试 easyScholar',
      'web.settingsSaved': '设置已保存', 'web.ollamaConnected': 'Ollama 已连接：{models}', 'web.ollamaUnavailable': 'Ollama 不可用：{error}',
      'web.easyScholarOK': 'easyScholar Key 有效。测试期刊：{journal}', 'web.easyScholarFailed': 'easyScholar 测试失败：{error}', 'web.easyScholarMissing': '请先保存 easyScholar Key。',
      'web.migrationTitle': '迁移 Python v4.1 数据库', 'web.migrationDesc': '输入旧 sentinel.db 的绝对路径。会自动识别真实 v4.1.0 schema；源文件不会被修改。',
      'web.migrationPlaceholder': '旧 sentinel.db 绝对路径', 'web.startMigration': '开始迁移', 'web.migrationDone': '迁移完成：papers {papers}，v4 screenings {screenings}，journals {journals}', 'web.migrationFailed': '迁移失败：{error}',
      'web.subscriptionsTitle': '订阅方向', 'web.systemStatus': '系统状态', 'web.running': '运行中…', 'web.runDone': '完成：抓取 {fetched}，评分 {screenings}',
      'web.readOnly': 'ZotRadar 当前为浏览器只读模式。请点击 Zotero 工具栏中的 ZotRadar 按钮，打开原生窗口以启用反馈和其他写操作。',
      'web.startupFailed': 'Dashboard 启动失败', 'web.startupHint': '请在同一浏览器中尝试 /zotradar/api/ping 和 /zotradar/api/status。',
      "native.phase1Badge": "原生 Dashboard · 第 1/3 阶段",
      "native.tab.papers": "文献",
      "native.tab.subscriptions": "订阅",
      "native.tab.scorecards": "Scorecards",
      "native.tab.feedback": "反馈",
      "native.tab.system": "系统",
      "native.phase2Placeholder": "此工作区将在第 2/3 阶段实现。本阶段只验收原生窗口骨架与文献工作流，避免把未完成的 CRUD 冒充已交付。",
      "native.noSubscriptions": "没有启用的订阅方向。",
      "native.runCurrent": "立即抓取与评分",
      "native.running": "正在运行当前订阅…",
      "native.runDone": "抓取 {fetched}；评分 {screenings}；错误 {errors}。",
      "native.searchPlaceholder": "搜索标题 / 摘要 / 期刊",
      "native.allGrades": "全部等级",
      "native.allScopes": "全部 Scope",
      "native.allTopics": "全部 Topic",
      "native.papersSummary": "{subscription} → {scorecard} · {count} 篇",
      "native.emptyPapers": "当前订阅尚无文献，请先运行一次抓取与评分。",
      "native.reason": "判断理由",
      "native.abstract": "摘要",
      "native.noAbstract": "无摘要",
      "native.baseRelevance": "基础相关性",
      "native.feedbackAdj": "反馈修正",
      "native.journalAdj": "期刊修正",
      "native.personalized": "个性化相关性",
      "native.priority": "阅读优先级",
      "native.positiveEvidence": "正向证据",
      "native.negativeEvidence": "负向证据",
      "native.uncertainty": "不确定性",
      "native.rescreen": "重新评分",
      "native.rescreened": "重新评分完成",
      "native.inZotero": "已在 Zotero",
      "native.importZotero": "导入 Zotero",
      "native.imported": "已导入 Zotero",
      "native.markRead": "标记已读",
      "native.markedRead": "已标记已读",
      "native.pageOf": "第 {page} / {pages} 页",
      'ui.settings': 'ZotRadar 设置', 'ui.dashboard': '打开 ZotRadar', 'ui.runNow': '立即运行 ZotRadar', 'ui.diagnostics': 'ZotRadar 启动诊断',
      'ui.noSelected': '未选择常规文献条目。', 'ui.screeningItems': '正在评分 {count} 个已选条目…', 'ui.completed': '完成：{done}，错误：{errors}',
      'ui.fetching': '正在抓取并评分订阅文献…', 'ui.runSummary': '抓取 {fetched}；评分 {screenings}；错误 {errors}。', 'ui.runFailed': '运行失败，请查看错误控制台。',
      'ui.selectRegular': '请选择一个常规文献条目。', 'ui.noScore': '尚无 ZotRadar 评分。', 'ui.screenItem': '评分此条目', 'ui.reScreen': '重新评分', 'ui.confirm': '✓ 确认判断',
      'ui.openEdit': '打开 ZotRadar / 编辑', 'ui.judgmentSaved': '判断已确认并保存为反馈。', 'ui.feedbackFailed': '无法保存反馈。', 'ui.noTopic': '无 Topic 标签',
      'ui.settingsOpenFailed': '无法打开设置。请使用 编辑 → 设置，并选择 ZotRadar。'
    }
  };

  Object.assign(STRINGS['zh-CN'], {
      "native.phase2Badge": "原生 Dashboard · 第 2/3 阶段",
      "native.phase3Placeholder": "此工作区按计划留到第 3/3 阶段实现。",
      "native.subscriptionsTitle": "订阅与 Feed", "native.subscriptionsDesc": "每个研究方向把一组 Feed 绑定到一个 Scorecard；切换方向会真正改变筛选上下文。",
      "native.newSubscription": "新建订阅", "native.selectSubscription": "选择一个订阅方向", "native.selectSubscriptionHint": "从左侧选择，或新建一个研究方向。",
      "native.subscriptionID": "订阅 ID", "native.label": "名称", "native.enabled": "启用", "native.makeDefault": "设为默认", "native.scorecard": "Scorecard", "native.feeds": "个 Feed", "native.papers": "篇文献", "native.default": "默认", "native.disabled": "已禁用",
      "native.idHint": "仅允许字母、数字、_ 和 -", "native.editSubscription": "编辑 {label}", "native.subscriptionSaved": "订阅已保存", "native.copySubscriptionID": "新的订阅 ID：", "native.displayName": "显示名称：", "native.subscriptionDuplicated": "订阅已复制", "native.deleteSubscriptionConfirm": "删除订阅“{label}”？已有评分历史会保留。", "native.subscriptionDeleted": "订阅已删除", "native.setDefault": "设为默认", "native.defaultUpdated": "默认订阅已更新",
      "native.feedLibrary": "Feed 库", "native.feedLibraryDesc": "Feed 可以被多个订阅复用；仍被订阅引用的 Feed 不能删除。", "native.newFeed": "新建 Feed", "native.notUsed": "未被使用", "native.testingFeed": "正在测试 Feed…", "native.feedTestResult": "抓取 {fetched}；错误 {errors}", "native.copyFeedID": "新的 Feed ID：", "native.feedDuplicated": "Feed 已复制", "native.deleteFeedConfirm": "删除 Feed“{label}”？", "native.feedDeleted": "Feed 已删除", "native.feedSaved": "Feed 已保存", "native.feedID": "Feed ID", "native.feedName": "Feed 名称", "native.feedType": "Feed 类型", "native.feedURL": "URL", "native.feedQuery": "查询式", "native.maxItems": "最大条目数", "native.feedNote": "备注",
      "native.scorecardsTitle": "Scorecards", "native.scorecardsDesc": "长期研究语义与订阅方向分离管理。", "native.newScorecard": "新建 Scorecard", "native.newScorecardID": "新 Scorecard ID：", "native.scorecardCreated": "Scorecard 已创建", "native.bundled": "内置", "native.userDefined": "用户", "native.override": "覆盖", "native.formEditor": "表单编辑", "native.advancedJSON": "高级 JSON", "native.applyJSON": "应用 JSON", "native.scorecardDependencies": "正在被这些订阅使用：{list}。请先删除订阅或改绑其他 Scorecard，再禁用/删除。", "native.scorecardSaved": "Scorecard 已保存", "native.copyScorecardID": "复制到 Scorecard ID：", "native.scorecardDuplicated": "Scorecard 已复制", "native.restoreBundled": "恢复内置", "native.resetBundled": "重置内置", "native.resetScorecardConfirm": "丢弃用户覆盖并恢复内置“{label}”？", "native.scorecardRestored": "内置 Scorecard 已恢复", "native.scorecardReset": "内置 Scorecard 已重置", "native.disableScorecard": "禁用", "native.disableScorecardConfirm": "禁用内置 Scorecard“{label}”？", "native.scorecardDisabled": "Scorecard 已禁用", "native.deleteScorecardConfirm": "删除 Scorecard“{label}”？", "native.scorecardDeleted": "Scorecard 已删除", "native.scorecardID": "Scorecard ID", "native.version": "版本", "native.description": "描述", "native.directScope": "直接相关范围", "native.contextualScope": "上下文相关范围", "native.transferableScope": "可迁移范围", "native.anchors": "锚点", "native.aliases": "别名", "native.onePerLine": "每行一个值", "native.topics": "Topics", "native.transferableTopics": "可迁移 Topics", "native.topicID": "Topic ID", "native.addTopic": "添加 Topic", "native.addTransferableTopic": "添加可迁移 Topic", "native.exclusions": "排除模式", "native.examples": "示例", "native.semanticProfile": "语义画像", "native.positiveDescriptions": "正向描述", "native.negativeDescriptions": "负向描述", "native.transferableDescriptions": "可迁移描述",
      "common.edit": "编辑", "common.delete": "删除", "common.duplicate": "复制", "common.remove": "移除",
  });
  Object.assign(STRINGS['en-US'], {
    'native.correctJudgement':'Feedback correction','native.relation':'Relation','native.strength':'Strength','native.transferTopic':'Transfer topic','native.feedbackNote':'Note','native.confirmCorrect':'Confirm model judgment','native.saveCorrection':'Save correction','native.confirmedNote':'Confirmed in ZotRadar','native.feedbackSaved':'Feedback saved and rescored','native.feedbackTitle':'Feedback & Profile','native.rebuildProfile':'Rebuild profile','native.profileRebuilt':'Profile rebuilt','native.profileMaturity':'Profile maturity','native.activeVersion':'Active version','native.pendingRebuild':'Pending rebuild','native.total':'Total','native.positive':'Positive','native.negative':'Negative','native.transferable':'Transferable','native.maturityCap':'Maximum feedback adjustment','native.profileVersions':'Profile versions','native.rollback':'Roll back','native.rollbackConfirm':'Restore profile version {version}?','native.recentFeedback':'Recent feedback','native.active':'Active','native.revoked':'Revoked','native.revoke':'Revoke','native.revokeConfirm':'Revoke this feedback?','native.systemTitle':'System','native.zotradar':'ZotRadar','native.zotero':'Zotero','native.ollama':'Ollama','native.qwen':'Screening model','native.embedding':'Embedding model','native.easyScholar':'easyScholar','native.database':'Database (papers / screenings / feedback)','native.api':'Local API','native.diagnostics':'Diagnostics','native.logs':'Recent runs','native.noLogs':'No run history','native.migrationTitle':'Import legacy v4.1 database','native.migrationDesc':'Inspect the old sentinel.db before importing. The original file is read only; the import is transactional and fingerprinted.','native.migrationPath':'Absolute path to sentinel.db','native.inspectMigration':'Inspect database','native.runMigration':'Import database','native.migrationConfirm':'Import this legacy database into ZotRadar?','native.migrationDone':'Migration completed'
  });
  Object.assign(STRINGS['zh-CN'], {
    'native.correctJudgement':'反馈纠正','native.relation':'关联关系','native.strength':'强度','native.transferTopic':'迁移主题','native.feedbackNote':'备注','native.confirmCorrect':'确认模型判断正确','native.saveCorrection':'保存纠正','native.confirmedNote':'在 ZotRadar 中确认正确','native.feedbackSaved':'反馈已保存并重新计算评分','native.feedbackTitle':'反馈与 Profile','native.rebuildProfile':'重建 Profile','native.profileRebuilt':'Profile 已重建','native.profileMaturity':'Profile 成熟度','native.activeVersion':'当前版本','native.pendingRebuild':'等待重建','native.total':'总数','native.positive':'正例','native.negative':'负例','native.transferable':'可迁移','native.maturityCap':'反馈修正上限','native.profileVersions':'Profile 历史版本','native.rollback':'回滚','native.rollbackConfirm':'恢复 Profile 版本 {version}？','native.recentFeedback':'最近反馈','native.active':'有效','native.revoked':'已撤销','native.revoke':'撤销','native.revokeConfirm':'撤销这条反馈？','native.systemTitle':'系统','native.zotradar':'ZotRadar','native.zotero':'Zotero','native.ollama':'Ollama','native.qwen':'筛选模型','native.embedding':'向量模型','native.easyScholar':'easyScholar','native.database':'数据库（文献 / 评分 / 反馈）','native.api':'本地 API','native.diagnostics':'诊断','native.logs':'近期运行记录','native.noLogs':'暂无运行记录','native.migrationTitle':'导入旧版 v4.1 数据库','native.migrationDesc':'先预检旧 sentinel.db。原文件只读；导入使用事务和指纹防重复。','native.migrationPath':'sentinel.db 的绝对路径','native.inspectMigration':'预检数据库','native.runMigration':'导入数据库','native.migrationConfirm':'将此旧数据库导入 ZotRadar？','native.migrationDone':'迁移完成'
  });
  STRINGS['en-US']['web.compatibilityNotice']='Developer / compatibility interface. Open ZotRadar in Zotero for normal use.';
  STRINGS['zh-CN']['web.compatibilityNotice']='开发／兼容界面。日常使用请从 Zotero 中打开 ZotRadar。';
  Object.assign(STRINGS['en-US'],{'native.available':'Available','native.missing':'Model missing','native.unreachable':'Unreachable','native.ready':'Ready','native.notReady':'Not ready'});
  Object.assign(STRINGS['zh-CN'],{'native.available':'可用','native.missing':'模型未找到','native.unreachable':'无法连接','native.ready':'就绪','native.notReady':'未就绪'});
  Object.assign(STRINGS['en-US'],{'common.close':'Close','system.runDone':'done','system.runRunning':'running','system.runErrors':'errors','system.historyUnavailable':'Run history unavailable'});
  Object.assign(STRINGS['zh-CN'],{'common.close':'关闭','system.runDone':'完成','system.runRunning':'运行中','system.runErrors':'错误','system.historyUnavailable':'无法读取运行记录'});
  Object.assign(STRINGS['en-US'],{'group.display':'Paper display','setting.titleLinkTarget':'Title link opens','setting.linkPubMed':'PubMed title search','setting.linkDOI':'DOI (fall back to PubMed)','setting.showChineseTitle':'Show Chinese title translation','setting.colorStyle':'Color style','setting.styleMinimal':'Minimal','setting.styleMulticolor':'Multicolor','setting.priorityAuthors':'Highlighted authors (one per line)','prefs.technicalDetails':'Technical details','prefs.healthPlugin':'Plugin','prefs.healthPapers':'Papers','prefs.healthScreenings':'Screenings','prefs.healthOllama':'Ollama','prefs.healthEasyScholar':'easyScholar','prefs.healthAPI':'Local API','native.sortPriority':'Priority score ↓','native.sortIFDesc':'Impact factor ↓','native.translationPending':'Chinese translation pending…','native.translationUnavailable':'Translation unavailable','native.feedSelection':'Feed sources','native.subscriptionDirection':'Research direction','native.colGrade':'Grade','native.colScore':'Score','native.colPaper':'Paper · authors','native.colJournal':'Journal','native.colScope':'Scope','native.colTopics':'Topics','native.colDate':'Date','native.scope.DIRECT':'Direct','native.scope.CONTEXTUAL':'Contextual','native.scope.TRANSFERABLE':'Transferable','native.scope.OUT_OF_SCOPE':'Out of scope','native.scope.UNCERTAIN':'Uncertain','native.strength.HIGH':'High','native.strength.MEDIUM':'Medium','native.strength.LOW':'Low'});
  Object.assign(STRINGS['zh-CN'],{'group.display':'文献展示','setting.titleLinkTarget':'标题点击后打开','setting.linkPubMed':'PubMed 标题检索','setting.linkDOI':'DOI（无 DOI 时转 PubMed）','setting.showChineseTitle':'显示中文标题翻译','setting.colorStyle':'配色风格','setting.styleMinimal':'简约','setting.styleMulticolor':'多色','setting.priorityAuthors':'重点作者（每行一位）','prefs.technicalDetails':'技术详情','prefs.healthPlugin':'插件','prefs.healthPapers':'文献','prefs.healthScreenings':'评分记录','prefs.healthOllama':'Ollama','prefs.healthEasyScholar':'easyScholar','prefs.healthAPI':'本地 API','native.sortPriority':'按优先分 ↓','native.sortIFDesc':'按影响因子 ↓','native.translationPending':'中文译题生成中…','native.translationUnavailable':'暂无法翻译','native.feedSelection':'订阅源','native.feeds':'个订阅源','native.subscriptionDirection':'研究方向','native.colGrade':'等级','native.colScore':'分数','native.colPaper':'论文与作者','native.colJournal':'期刊','native.colScope':'范围','native.colTopics':'主题','native.colDate':'日期','native.allScopes':'全部范围','native.scope.DIRECT':'直接相关','native.scope.CONTEXTUAL':'背景相关','native.scope.TRANSFERABLE':'可迁移','native.scope.OUT_OF_SCOPE':'超出范围','native.scope.UNCERTAIN':'待确认','native.strength.HIGH':'高','native.strength.MEDIUM':'中','native.strength.LOW':'低'});
  Object.assign(STRINGS['en-US'],{'setting.showScopeColumn':'Show Scope column','setting.showTopicColumn':'Show Topic column','native.preprint':'Preprint'});
  Object.assign(STRINGS['zh-CN'],{'setting.showScopeColumn':'显示范围列','setting.showTopicColumn':'显示主题列','native.preprint':'预印本'});
  Object.assign(STRINGS['en-US'],{'native.papersGradeSummary':'A {A} · B {B} · C {C} · D {D} · Unclassified {other} · Total {total} papers'});
  Object.assign(STRINGS['zh-CN'],{'native.papersGradeSummary':'A级 {A} 篇 · B级 {B} 篇 · C级 {C} 篇 · D级 {D} 篇 · 待判定 {other} 篇 · 共 {total} 篇'});

  Object.assign(STRINGS['zh-CN'],{'app.subtitle':'Zotero 原生 · 评分 · 个性化相关性学习','prefs.intro':'Zotero 原生文献雷达：本地 Ollama、评分、反馈学习与独立面板。','prefs.settingsDesc':'程序、模型与调度选项。订阅和评分请在独立面板管理。','prefs.openDashboard':'管理订阅与评分…','setting.easyScholarKey':'easyScholar 密钥','setting.embeddingModel':'向量模型','secret.clearLabel':'清除已保存密钥','native.subscriptionsTitle':'订阅与订阅源','native.subscriptionsDesc':'每个研究方向将订阅源绑定到一套评分；切换方向会改变实际筛选上下文。','web.allScopes':'全部范围','web.allTopics':'全部主题','web.colScope':'范围','web.scorecardHint':'内置评分可由用户覆盖；删除内置评分只会禁用，之后可恢复。自定义评分会直接删除。'});
  Object.assign(STRINGS['en-US'],{'native.searchPlaceholder':'Search title / abstract / author / journal','native.emptyPapers':'No papers match the current filters.','native.all':'All','native.read':'Read','native.unread':'Unread','native.multiSelect':'Select multiple','native.closeMultiSelect':'Close selection','native.select':'Select','native.selectPaper':'Select {title}','native.selectedCount':'Selected: {count}','native.selectPage':'Select this page','native.invertSelection':'Invert','native.clearSelection':'Clear','native.copyTitles':'Copy titles','native.selectPapers':'Select at least one paper.','native.copiedTitles':'Copied {count} titles','native.bulkImported':'Imported {imported}; already in Zotero {alreadyInZotero}; failed {failed}','native.markReadBulk':'✓ Mark read','native.markUnreadBulk':'↺ Mark unread','native.markUnread':'Mark unread','native.markedUnread':'Marked unread','native.bulkRead':'Marked {count} papers read','native.bulkUnread':'Marked {count} papers unread'});
  Object.assign(STRINGS['zh-CN'],{'native.searchPlaceholder':'搜索标题/摘要/作者/期刊','native.emptyPapers':'当前筛选下没有文献。','native.all':'全部','native.read':'已读','native.unread':'未读','native.multiSelect':'多选','native.closeMultiSelect':'收起多选','native.select':'选择','native.selectPaper':'选择《{title}》','native.selectedCount':'已选 {count} 篇','native.selectPage':'全选本页','native.invertSelection':'反选','native.clearSelection':'清空','native.copyTitles':'复制标题','native.selectPapers':'请先选择文献。','native.copiedTitles':'已复制 {count} 个标题','native.bulkImported':'已导入 {imported} 篇；已在 Zotero {alreadyInZotero} 篇；失败 {failed} 篇','native.markReadBulk':'✓ 标记已读','native.markUnreadBulk':'↺ 标为未读','native.markUnread':'标为未读','native.markedUnread':'已标为未读','native.bulkRead':'已将 {count} 篇标记为已读','native.bulkUnread':'已将 {count} 篇标为未读'});
  STRINGS['en-US']['native.selectPage']='Select all results';
  STRINGS['zh-CN']['native.selectPage']='全选当前结果';
  STRINGS['en-US']['native.fetchedAll']='Fetched';
  STRINGS['zh-CN']['native.fetchedAll']='已获取';
  STRINGS['en-US']['native.filtering']='Filtering papers…';
  STRINGS['zh-CN']['native.filtering']='正在筛选文献…';
  STRINGS['en-US']['prefs.saving']='Saving settings…';
  STRINGS['zh-CN']['prefs.saving']='正在保存设置…';
  Object.assign(STRINGS['en-US'],{'native.rescreenBulk':'↻ Re-score selected','native.rescreening':'Re-screening with the configured model…','native.rescreenUnscored':'Model finished, but evidence is insufficient for a score.','native.bulkRescreened':'Scored {rescored}; uncertain {unscored}; failed {failed}','native.notYetScored':'No score yet','native.unscoredHint':'This paper has no defensible score yet. Check model status, then re-screen or enter a manual correction.','native.noFeedbackApplied':'No feedback adjustment','native.manualFeedbackApplied':'Manual correction or confirmation','native.noJournalChange':'No numeric change in this screening','native.journalScoreValue':'Journal score: {score}'});
  Object.assign(STRINGS['zh-CN'],{'native.rescreenBulk':'↻ 重新打分','native.rescreening':'正在调用设置中的模型重新评分…','native.rescreenUnscored':'模型已完成，但证据不足，仍无法给出分数。','native.bulkRescreened':'已评分 {rescored} 篇；待判定 {unscored} 篇；失败 {failed} 篇','native.notYetScored':'尚无分数','native.unscoredHint':'当前证据不足，尚无可靠分数。请检查模型状态后重新评分，或录入人工纠正。','native.noFeedbackApplied':'尚无反馈数值修正','native.manualFeedbackApplied':'人工纠正或确认','native.noJournalChange':'本次评分无数值变化','native.journalScoreValue':'期刊评分：{score}'});
  Object.assign(STRINGS['en-US'],{'native.sortScoreDesc':'Sort by score; click again to reset','native.sortDateDesc':'Sort by newest date; click again to reset','native.filterPriorityAuthors':'Show papers with a highlighted author; click again to reset'});
  Object.assign(STRINGS['zh-CN'],{'native.sortScoreDesc':'按分数从高到低；再点恢复','native.sortDateDesc':'按日期从新到旧；再点恢复','native.filterPriorityAuthors':'只看包含重点作者的论文；再点恢复'});
  Object.assign(STRINGS['en-US'],{'native.importStatus':'Zotero import status','native.imported':'Imported','native.unimported':'Not imported','native.disabledSubscriptionHidden':'{subscription} is disabled. Its papers are hidden; choose an enabled direction to continue.','native.chooseSubscription':'Choose a research direction'});
  Object.assign(STRINGS['zh-CN'],{'native.importStatus':'Zotero 导入状态','native.imported':'已导入','native.unimported':'未导入','native.disabledSubscriptionHidden':'{subscription} 已停用；该方向文献已隐藏。请选择一个启用的方向继续。','native.chooseSubscription':'选择研究方向'});
  for(const locale of ['en-US','zh-CN'])for(const key of ['setting.embeddingModel','native.embedding','setting.colorStyle','setting.styleMinimal','setting.styleMulticolor'])delete STRINGS[locale][key];
  for(const [key,value] of Object.entries(STRINGS['zh-CN'])){
    if(typeof value==='string')STRINGS['zh-CN'][key]=value.replace(/研究评估卡|评估卡|Scorecards?/g,'评分').replace(/\bFeeds?\b/g,'订阅源').replace(/([\u4e00-\u9fff])\s+评分/g,'$1评分').replace(/评分\s+(?=[\u4e00-\u9fff])/g,'评分').replace(/([\u4e00-\u9fff])\s+订阅源/g,'$1订阅源').replace(/订阅源\s+(?=[\u4e00-\u9fff])/g,'订阅源');
  }
  for(const [key,value] of Object.entries(STRINGS['en-US'])){
    if(typeof value==='string')STRINGS['en-US'][key]=value.replace(/Scorecards?/g,'Scoring');
  }

  Object.assign(STRINGS['en-US'],{
    'native.profileMaturity':'Feedback overview',
    'native.profileVersions':'Feedback snapshots',
    'native.rollback':'Select snapshot',
    'native.profileManualOnly':'Profiles are snapshots of explicit feedback; automatic similarity-based score adjustments are off.',
    'native.rollbackConfirm':'Select profile snapshot {version}? This will not undo or change any explicit paper corrections.'
  });
  Object.assign(STRINGS['zh-CN'],{
    'native.profileMaturity':'反馈概况',
    'native.profileVersions':'反馈快照',
    'native.rollback':'切换快照',
    'native.profileManualOnly':'Profile 仅记录人工反馈快照；自动相似度加分目前关闭。',
    'native.rollbackConfirm':'切换到 Profile 快照 {version}？这不会撤销或改变任何论文的人工纠正。'
  });

  function detectedLocale() {
    let raw = '';
    try { raw = (typeof Services !== 'undefined' && Services.locale && Services.locale.appLocaleAsBCP47) || ''; } catch (_) {}
    try { if (!raw && typeof Zotero !== 'undefined') raw = Zotero.locale || Zotero.appLocale || ''; } catch (_) {}
    raw = String(raw || 'en-US');
    return /^zh(?:-|$)/i.test(raw) ? 'zh-CN' : 'en-US';
  }
  function locale() { return detectedLocale(); }
  function dictionary(loc = locale()) { return {...(STRINGS[loc] || STRINGS['en-US'])}; }
  function format(text, vars = {}) { return String(text == null ? '' : text).replace(/\{([A-Za-z0-9_]+)\}/g, (_, k) => vars[k] == null ? '' : String(vars[k])); }
  function t(key, vars = {}, loc = locale()) {
    const d = STRINGS[loc] || STRINGS['en-US'];
    const fallback = STRINGS['en-US'][key];
    return format(d[key] != null ? d[key] : (fallback != null ? fallback : key), vars);
  }
  function bundle(loc = locale()) { return {locale: loc, strings: dictionary(loc)}; }

  function error(err, loc=locale()) {
    const raw=String(err?.message||err||'');
    if(/Ollama did not return valid structured JSON/i.test(raw))return loc==='zh-CN'?'模型两次返回的内容都不是完整 JSON；原评分已保留，请稍后重试。':'The model returned incomplete JSON twice; the previous score was preserved. Please retry.';
    if(/timed?\s*out|NS_ERROR_NET_TIMEOUT/i.test(raw))return loc==='zh-CN'?'模型请求超时；原评分已保留。可在设置中延长请求超时后重试。':'The model request timed out; the previous score was preserved. Increase the request timeout and retry.';
    if(loc!=='zh-CN')return raw.replace(/Scorecards?/g,'Scoring');
    const messages=[
      ['Subscription required','需要填写订阅信息'],['Invalid subscription ID','订阅 ID 只能包含字母、数字、下划线和连字符'],['Subscription label required','订阅名称不能为空'],['Unknown or disabled Scorecard','Scorecard 不存在或已禁用'],['feed_ids must be an array','Feed 列表格式无效'],['Unknown feed','Feed 不存在'],['Subscription ID already exists','订阅 ID 已存在'],['At least one enabled subscription is required','至少需要保留一个已启用订阅'],['Unknown subscription','订阅不存在'],['Cannot remove the last subscription','不能删除最后一个订阅'],['Subscription is disabled','订阅已禁用'],
      ['Feed required','需要填写 Feed 信息'],['Invalid feed ID','Feed ID 格式无效'],['Feed ID already exists','Feed ID 已存在'],['Feed name required','Feed 名称不能为空'],['Feed type required','Feed 类型不能为空'],['Feed URL required','Feed URL 不能为空'],['Feed is used by subscriptions','Feed 正被订阅使用'],
      ['Invalid scorecard','Scorecard 结构无效'],['Invalid Scorecard ID','Scorecard ID 格式无效'],['New Scorecard ID may contain only','新 Scorecard ID 只能包含字母、数字、下划线和连字符'],['Scorecard ID already exists','Scorecard ID 已存在'],['Unknown Scorecard','Scorecard 不存在'],['Scorecard is used by subscriptions','Scorecard 正被订阅使用'],['Scorecard ID cannot be changed','不能直接修改 Scorecard ID，请使用复制'],['Cannot delete/disable the last active Scorecard','不能禁用或删除最后一个有效 Scorecard'],['Not a bundled Scorecard','这不是内置 Scorecard'],
      ['paper and scorecard required','需要文献和 Scorecard'],['invalid corrected scope','纠正关系无效'],['this scope has no strength','此关系不应填写强度'],['invalid corrected strength','纠正强度无效'],['transfer topic requires TRANSFERABLE','只有可迁移关系才能填写迁移主题'],['screening not found','找不到评分记录'],['confirmation must match model judgment','确认正确必须与模型原判断一致'],['feedback not found','找不到反馈'],['profile version not found','找不到 Profile 版本'],['paper not found','找不到文献'],['Ollama unavailable','Ollama 无法连接，请检查模型地址和服务'],['Screening model not installed','设置中的筛选模型未安装'],
      ['Legacy database file does not exist','旧数据库文件不存在'],['Legacy database has an active WAL file','旧数据库正在使用 WAL，请先关闭占用它的程序并建立一致的备份'],['Selected file is already a ZotRadar','所选文件已是 ZotRadar 数据库'],['Not a supported Python v4 database','这不是受支持的 Python v4 数据库'],['Unknown setting','设置项不存在'],['Failed to persist secret setting','密钥设置保存失败'],['FORBIDDEN','无权限执行此操作']
    ];
    for(const [prefix,translated] of messages)if(raw.startsWith(prefix))return translated.replace(/Scorecards?/g,'评分')+(raw.includes(':')?'：'+raw.slice(raw.indexOf(':')+1).trim():'');
    return '操作失败，请查看 ZotRadar 诊断。';
  }

  ZR.I18n = {STRINGS, locale, t, bundle, format, error};
})(ZR);
