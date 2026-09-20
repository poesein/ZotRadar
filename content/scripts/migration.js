(function (ZR) {
  'use strict';

  async function tableExists(db, name) {
    try {
      const n = await db.valueQueryAsync("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND lower(name)=lower(?)", [String(name)]);
      return Number(n || 0) > 0;
    } catch (_) { return false; }
  }

  async function tableColumns(db, name) {
    if (!(await tableExists(db, name))) return new Set();
    const rows = await db.queryAsync(`PRAGMA table_info(${name})`) || [];
    return new Set(rows.map(r => String(r.name)));
  }

  async function schemaInfo(db) {
    const tables = {};
    for (const t of ['papers','v4_screenings','screenings','journal_metrics','feedback_v4','v4_meta','meta']) {
      tables[t] = await tableExists(db, t);
    }
    let schemaVersion = null, zotRadarVersion = null;
    if (tables.v4_meta) { try { schemaVersion = await db.valueQueryAsync("SELECT value FROM v4_meta WHERE key='schema_version'"); } catch (_) {} }
    if (tables.meta) { try { zotRadarVersion = await db.valueQueryAsync("SELECT value FROM meta WHERE key='schema_version'"); } catch (_) {} }
    return {tables, schema_version:schemaVersion || null, zotradar_schema_version:zotRadarVersion || null};
  }

  async function legacyCopy(path) {
    if (!path || !(await IOUtils.exists(path))) throw new Error('Legacy database file does not exist');
    if (await IOUtils.exists(path + '-wal')) {
      const wal = await IOUtils.stat(path + '-wal');
      if (Number(wal.size || 0) > 0) throw new Error('Legacy database has an active WAL file. Close its owning application and make a consistent backup before import.');
    }
    const copy = PathUtils.join(ZR.Paths.dir, `migration-read-${ZR.Utils.randomToken(16)}.db`);
    await IOUtils.copy(path, copy);
    return copy;
  }

  async function inspectV4SQLite(path) {
    const copy = await legacyCopy(path);
    const db = new Zotero.DBConnection(copy);
    try {
      const schema = await schemaInfo(db);
      const counts = {};
      for (const table of ['papers','v4_screenings','screenings','journal_metrics','feedback_v4']) {
        counts[table] = schema.tables[table] ? Number(await db.valueQueryAsync(`SELECT COUNT(*) FROM ${table}`) || 0) : 0;
      }
      return {schema,counts,supported:!!schema.tables.papers&&!String(schema.zotradar_schema_version||'').startsWith('5.')};
    }
    finally { await db.closeDatabase(); await IOUtils.remove(copy).catch(()=>{}); }
  }

  async function importV4SQLite(path) {
    if (!path || !(await IOUtils.exists(path))) throw new Error('Legacy database file does not exist');
    const stat = await IOUtils.stat(path).catch(() => ({size:0,lastModified:0}));
    const fingerprint = ZR.Utils.hashString(`${path}|${stat.size||0}|${stat.lastModified||0}`);
    const marker = `migration:v4:${fingerprint}`;
    if (await ZR.DB.getMeta(marker)) return {already_imported:true,fingerprint,papers:0,screenings:0,feedback:0,journals:0};

    const copy = await legacyCopy(path);
    const legacy = new Zotero.DBConnection(copy);
    const map = new Map();
    const stats = {already_imported:false,fingerprint,schema_version:null,papers:0,screenings:0,feedback:0,journals:0,legacy_screenings_skipped:0};
    try {
      const info = await schemaInfo(legacy);
      stats.schema_version = info.schema_version;
      if (info.zotradar_schema_version && String(info.zotradar_schema_version).startsWith('5.')) throw new Error('Selected file is already a ZotRadar 5.x database; choose the old Python sentinel.db instead');
      if (!info.tables.papers) {
        const available = Object.entries(info.tables).filter(([,v])=>v).map(([k])=>k).join(', ') || 'none';
        throw new Error(`Not a supported Python v4 database: papers table missing (detected tables: ${available})`);
      }

      const paperCols = await tableColumns(legacy, 'papers');
      const psel = ['id','title','abstract','authors_json','published','doi','pmid','pmcid','url','journal','citation_count','zotero_item_key']
        .filter(c => paperCols.has(c));
      const papers = await legacy.queryAsync(`SELECT ${psel.join(',')} FROM papers ORDER BY id`) || [];

      let screenings = [];
      if (info.tables.v4_screenings) {
        const sc = await tableColumns(legacy, 'v4_screenings');
        const wanted = ['id','paper_id','run_id','subscription_id','scorecard_id','scorecard_version','scorecard_hash','scope','strength','topics_json','transferable_topic','rule_evidence_json','judgement_json','model_judgement_json','raw_model_json','model','prompt_contract_version','scoring_policy_version','base_relevance','feedback_adjustment','personalized_relevance','journal_score','journal_adjustment','reading_priority','grade','preference_profile_version','embedding_model_version','feedback_details_json','user_overridden','created_at'];
        const cols = wanted.filter(c => sc.has(c));
        screenings = await legacy.queryAsync(`SELECT ${cols.join(',')} FROM v4_screenings ORDER BY id`) || [];
      }

      let feedback = [];
      if (info.tables.feedback_v4) {
        const fc = await tableColumns(legacy, 'feedback_v4');
        const wanted = ['id','paper_id','scorecard_id','model_scope','model_strength','corrected_scope','corrected_strength','priority_feedback','note','active','created_at','updated_at','supersedes_feedback_id'];
        const cols = wanted.filter(c => fc.has(c));
        feedback = await legacy.queryAsync(`SELECT ${cols.join(',')} FROM feedback_v4 WHERE active=1 ORDER BY id`) || [];
      }

      let journals = [];
      if (info.tables.journal_metrics) {
        const jc = await tableColumns(legacy, 'journal_metrics');
        const wanted = ['name_key','journal','impact_factor','cas_tier','cas_top','jcr','jci','cas_score','if_score','journal_score','source'];
        const cols = wanted.filter(c => jc.has(c));
        journals = await legacy.queryAsync(`SELECT ${cols.join(',')} FROM journal_metrics`) || [];
      }

      if (info.tables.screenings) {
        try { stats.legacy_screenings_skipped = Number(await legacy.valueQueryAsync('SELECT COUNT(*) FROM screenings') || 0); } catch (_) {}
      }

      await ZR.DB.conn.executeTransaction(async () => {
        for (const p of papers) {
          const itemKey = paperCols.has('zotero_item_key') ? (p.zotero_item_key || null) : null;
          const np = {
            zotero_library_id: itemKey ? Zotero.Libraries.userLibraryID : null,
            zotero_key: itemKey,
            title: p.title || 'Untitled', abstract: p.abstract || '',
            authors: ZR.Utils.safeJSON(p.authors_json, []), published: p.published || null,
            doi: p.doi || null, pmid: p.pmid || null, pmcid: p.pmcid || null,
            url: p.url || '', journal: p.journal || '', citation_count: Number(p.citation_count || 0),
            source_records: []
          };
          const nid = await ZR.DB.upsertPaper(np);
          map.set(Number(p.id), nid); stats.papers++;
        }

        for (const r of screenings) {
          const pid = map.get(Number(r.paper_id)); if (!pid) continue;
          const j = ZR.Utils.safeJSON(r.judgement_json, {
            scope:r.scope || 'UNCERTAIN', strength:r.strength || null,
            topics:ZR.Utils.safeJSON(r.topics_json, []), transferable_topic:r.transferable_topic || null,
            reason:'Imported Python v4 judgement', positive_evidence:[], negative_evidence:[], uncertainty:null
          });
          const mj = ZR.Utils.safeJSON(r.model_judgement_json, j);
          const scores = {
            base_relevance:r.base_relevance == null ? null : Number(r.base_relevance),
            feedback_adjustment:Number(r.feedback_adjustment || 0),
            personalized_relevance:r.personalized_relevance == null ? null : Number(r.personalized_relevance),
            journal_score:r.journal_score == null ? 50 : Number(r.journal_score),
            journal_adjustment:Number(r.journal_adjustment || 0),
            reading_priority:r.reading_priority == null ? null : Number(r.reading_priority),
            grade:r.grade || null
          };
          await ZR.DB.saveScreening('legacy-import', {
            paper_id:pid, subscription_id:r.subscription_id || 'legacy_v4', scorecard_id:r.scorecard_id || 'legacy_v4',
            scorecard_version:Number(r.scorecard_version || 1), scorecard_hash:r.scorecard_hash || 'legacy-v4',
            judgement:j, model_judgement:mj, rule_evidence:ZR.Utils.safeJSON(r.rule_evidence_json, {}), scores,
            model:r.model || 'legacy-v4', prompt_contract_version:r.prompt_contract_version || 'scope-screening-v1',
            scoring_policy_version:r.scoring_policy_version || 'generic-scoring-v1',
            preference_profile_version:r.preference_profile_version == null ? null : Number(r.preference_profile_version),
            embedding_model_version:r.embedding_model_version || null, raw_model_json:r.raw_model_json || null,
            feedback_details:ZR.Utils.safeJSON(r.feedback_details_json, {}), user_overridden:!!r.user_overridden,
            created_at:r.created_at || ZR.Utils.nowISO()
          });
          stats.screenings++;
        }

        for (const r of feedback) {
          const pid = map.get(Number(r.paper_id)); if (!pid) continue;
          await ZR.DB.addFeedback({paper_id:pid, scorecard_id:r.scorecard_id || 'legacy_v4', model_scope:r.model_scope || null,
            model_strength:r.model_strength || null, corrected_scope:r.corrected_scope || null,
            corrected_strength:r.corrected_strength || null, priority_feedback:r.priority_feedback || null,
            note:r.note || 'Imported from Python v4.1', source:'USER_EXPLICIT', weight:1},{withinTransaction:true});
          stats.feedback++;
        }

        for (const r of journals) {
          let js = Number(r.journal_score == null ? 50 : r.journal_score);
          if (js >= 0 && js <= 1) js *= 100;
          await ZR.DB.saveJournalMetric({name_key:r.name_key, journal:r.journal || '', impact_factor:r.impact_factor,
            cas_tier:r.cas_tier, cas_score:r.cas_score, if_score:r.if_score, source:r.source || 'legacy-v4',
            journal_score:js, jcr:r.jcr, jci:r.jci, cas_top:!!r.cas_top});
          stats.journals++;
        }
        await ZR.DB.setMeta(marker, JSON.stringify({path,fingerprint,schema:info,stats,at:ZR.Utils.nowISO()}));
      });
    }
    finally { await legacy.closeDatabase(); await IOUtils.remove(copy).catch(()=>{}); }

    for (const c of ZR.Scorecards.all()) {
      const f = await ZR.DB.activeFeedback(c.id);
      if (f.length) await ZR.Feedback.rebuild(c.id);
    }
    await ZR.DB.loadItemCache();
    return stats;
  }

  ZR.Migration = {importV4SQLite, inspectV4SQLite, schemaInfo, tableExists, tableColumns};
})(ZR);
