(function (ZR) {
  'use strict';

  const BUNDLED_FILES = {
    protein_design: 'protein_design.json'
  };
  const DISABLED_PREF = 'disabledScorecards';

  function assert(cond, msg) { if (!cond) throw new Error('Invalid scorecard: ' + msg); }
  function validID(x) { return typeof x === 'string' && /^[A-Za-z0-9_-]+$/.test(x); }

  function validate(card) {
    const stringArray = (x, name) => {
      assert(Array.isArray(x), `${name} must be an array`);
      assert(x.every(v => typeof v === 'string'), `${name} must contain strings only`);
    };
    const validateBranch = (x, name) => {
      assert(x && typeof x === 'object', `${name} missing`);
      assert(typeof x.description === 'string', `${name}.description must be a string`);
      stringArray(x.anchors || [], `${name}.anchors`);
      stringArray(x.aliases || [], `${name}.aliases`);
      x.anchors = x.anchors || [];
      x.aliases = x.aliases || [];
    };
    assert(card && card.schema_version === 'scorecard-v1', 'schema_version must be scorecard-v1');
    assert(validID(card.id), 'invalid id');
    assert(Number.isInteger(card.version) && card.version >= 1, 'version must be >=1');
    assert(typeof card.label === 'string' && card.label.trim(), 'label required');
    assert(typeof card.description === 'string', 'description must be a string');
    assert(card.scope && typeof card.scope === 'object', 'scope missing');
    validateBranch(card.scope.direct, 'scope.direct');
    validateBranch(card.scope.contextual, 'scope.contextual');
    assert(card.scope.transferable && typeof card.scope.transferable === 'object', 'scope.transferable missing');
    assert(typeof card.scope.transferable.description === 'string', 'scope.transferable.description must be a string');
    card.scope.transferable.topics = Array.isArray(card.scope.transferable.topics) ? card.scope.transferable.topics : [];
    card.topics = Array.isArray(card.topics) ? card.topics : [];
    for (const [kind, rows] of [['topic', card.topics], ['transferable topic', card.scope.transferable.topics]]) {
      for (const t of rows) {
        assert(t && typeof t === 'object', `${kind} must be an object`);
        assert(validID(t.id), `invalid ${kind} id`);
        assert(typeof t.label === 'string' && t.label.trim(), `${kind} label required`);
        assert(typeof t.description === 'string', `${kind} description must be a string`);
        stringArray(t.anchors || [], `${kind}.anchors`);
        stringArray(t.aliases || [], `${kind}.aliases`);
        t.anchors = t.anchors || [];
        t.aliases = t.aliases || [];
      }
    }
    const ids = card.topics.map(x => x.id), tids = card.scope.transferable.topics.map(x => x.id);
    assert(new Set(ids).size === ids.length, 'duplicate topic id');
    assert(new Set(tids).size === tids.length, 'duplicate transferable topic id');
    assert(!ids.some(x => tids.includes(x)), 'topic IDs and transferable topic IDs must not collide');
    if (card.scope.exclusions) {
      assert(typeof card.scope.exclusions.description === 'string', 'scope.exclusions.description must be a string');
      stringArray(card.scope.exclusions.examples || [], 'scope.exclusions.examples');
      card.scope.exclusions.examples = card.scope.exclusions.examples || [];
    }
    if (card.evidence_policy) {
      const policy = card.evidence_policy;
      assert(typeof policy === 'object' && !Array.isArray(policy), 'evidence_policy must be an object');
      for (const key of ['direct_requires_anchor', 'contextual_requires_direct_anchor',
        'promote_direct_title_question', 'allow_title_quote_recovery',
        'direct_high_requires_abstract_corroboration']) {
        if (policy[key] != null) assert(typeof policy[key] === 'boolean', `evidence_policy.${key} must be boolean`);
      }
      stringArray(policy.contextual_require_any || [], 'evidence_policy.contextual_require_any');
      stringArray(policy.clinical_title_terms || [], 'evidence_policy.clinical_title_terms');
      stringArray(policy.descriptive_title_terms || [], 'evidence_policy.descriptive_title_terms');
      if (policy.direct_discriminative_anchors != null) {
        assert(Array.isArray(policy.direct_discriminative_anchors),
          'evidence_policy.direct_discriminative_anchors must be an array');
        for (const row of policy.direct_discriminative_anchors) {
          if (typeof row === 'string') { assert(row.trim(), 'empty discriminative anchor'); continue; }
          assert(row && typeof row === 'object' && !Array.isArray(row) &&
            typeof row.term === 'string' && row.term.trim(), 'invalid discriminative anchor');
          stringArray(row.requires_any || [], 'discriminative anchor requires_any');
          assert((row.requires_any || []).length > 0, 'discriminative anchor requires context');
        }
      }
    }
    if (card.semantic_profile) {
      for (const k of ['positive_descriptions', 'negative_descriptions', 'transferable_descriptions']) {
        stringArray(card.semantic_profile[k] || [], `semantic_profile.${k}`);
      }
    }
    if (card.scoring) {
      const mapping = card.scoring.relevance && card.scoring.relevance.mapping;
      assert(mapping && typeof mapping === 'object', 'scoring.relevance.mapping missing');
      for (const scope of ['DIRECT', 'CONTEXTUAL', 'TRANSFERABLE']) {
        const row = mapping[scope];
        assert(row && typeof row === 'object', `scoring ${scope} mapping missing`);
        const values = ['HIGH', 'MEDIUM', 'LOW'].map(k => row[k]);
        assert(values.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100), `scoring ${scope} values must be 0-100`);
        assert(values[0] > values[1] && values[1] > values[2], `scoring ${scope} must descend HIGH > MEDIUM > LOW`);
      }
      assert(typeof mapping.OUT_OF_SCOPE === 'number' && mapping.OUT_OF_SCOPE >= 0 && mapping.OUT_OF_SCOPE <= 100, 'scoring OUT_OF_SCOPE must be 0-100');
      assert(mapping.UNCERTAIN === null, 'scoring UNCERTAIN must be null');
      if (card.scoring.priority && card.scoring.priority.weights) {
        const weights = card.scoring.priority.weights;
        assert(typeof weights.relevance === 'number' && typeof weights.journal === 'number' &&
          weights.relevance >= 0 && weights.journal >= 0 &&
          Math.abs(weights.relevance + weights.journal - 1) < 1e-9,
        'scoring.priority.weights must be nonnegative and sum to one');
      }
    }
    return card;
  }

  function disabledSet() {
    const raw = String(ZR.Utils.getPref(DISABLED_PREF, '[]') || '[]');
    const rows = ZR.Utils.safeJSON(raw, []);
    return new Set(Array.isArray(rows) ? rows.map(String) : []);
  }
  function saveDisabled(set) { ZR.Utils.setPref(DISABLED_PREF, JSON.stringify([...set].sort())); }

  async function loadJSONFile(path) {
    const text = await Zotero.File.getContentsAsync(path);
    return { data: JSON.parse(text), text };
  }

  async function bundledCards() {
    const map = new Map(), textMap = new Map();
    for (const [id, file] of Object.entries(BUNDLED_FILES)) {
      const text = await ZR.Utils.readResourceText('config/scorecards/' + file);
      const card = validate(JSON.parse(text));
      map.set(id, card); textMap.set(id, text);
    }
    return {map, textMap};
  }

  async function load() {
    const {map: bundledMap, textMap: bundledText} = await bundledCards();
    const disabled = disabledSet();
    const cards = new Map(), hashes = new Map(), sources = new Map(), metadata = new Map();

    for (const [id, card] of bundledMap) {
      if (!disabled.has(id)) {
        cards.set(id, card);
        hashes.set(id, ZR.Utils.hashString(bundledText.get(id)));
        sources.set(id, 'bundled');
      }
      metadata.set(id, {id, label:card.label, version:card.version, bundled:true, overridden:false, disabled:disabled.has(id), source:'bundled'});
    }

    const children = await IOUtils.getChildren(ZR.Paths.scorecards).catch(() => []);
    for (const path of children) {
      const name = String(path).split(/[\\/]/).pop();
      if (!/\.json$/i.test(path) || name.startsWith('_')) continue;
      try {
        const {data, text} = await loadJSONFile(path);
        const card = validate(data);
        const isBundled = bundledMap.has(card.id);
        metadata.set(card.id, {id:card.id, label:card.label, version:card.version, bundled:isBundled, overridden:isBundled, disabled:disabled.has(card.id), source:'user'});
        if (!disabled.has(card.id)) {
          cards.set(card.id, card);
          hashes.set(card.id, ZR.Utils.hashString(text));
          sources.set(card.id, path);
        }
      }
      catch (e) { Zotero.logError(new Error(`ZotRadar scorecard load failed: ${path}: ${e}`)); }
    }

    ZR.Scorecards = {
      cards, hashes, sources, metadata, bundledMap, disabled,
      get(id) { const c = cards.get(id); if (!c) throw new Error('Unknown or disabled scorecard: ' + id); return c; },
      has(id) { return cards.has(id); },
      hash(id) { return hashes.get(id); },
      all() { return Array.from(cards.values()); },
      list({includeDisabled=false}={}) {
        const rows = Array.from(metadata.values());
        return rows.filter(x => includeDisabled || !x.disabled).sort((a,b)=>a.label.localeCompare(b.label));
      },
      validate
    };

    // Keep defaultScorecard valid after delete/disable.
    const current = String(ZR.Utils.getPref('defaultScorecard', 'protein_design') || 'protein_design');
    if (!cards.has(current) && cards.size) ZR.Utils.setPref('defaultScorecard', cards.keys().next().value);
    return ZR.Scorecards;
  }

  async function saveUserScorecard(card) {
    validate(card);
    const path = PathUtils.join(ZR.Paths.scorecards, `${card.id}.json`);
    await IOUtils.writeUTF8(path, JSON.stringify(card, null, 2));
    const d = disabledSet(); d.delete(card.id); saveDisabled(d);
    await load();
    return path;
  }

  async function copyScorecard(sourceID, newID, newLabel=null) {
    if (!validID(newID)) throw new Error('New Scorecard ID may contain only letters, numbers, _ and -');
    if (ZR.Scorecards.metadata.has(newID)) throw new Error('Scorecard ID already exists: ' + newID);
    const src = ZR.Scorecards.has(sourceID) ? ZR.Scorecards.get(sourceID) : ZR.Scorecards.bundledMap.get(sourceID);
    if (!src) throw new Error('Unknown Scorecard: ' + sourceID);
    const card = JSON.parse(JSON.stringify(src));
    card.id = newID;
    card.label = String(newLabel || `${src.label} Copy`).trim();
    card.version = 1;
    return await saveUserScorecard(card);
  }

  async function createFromTemplate(id, label) {
    if (!validID(id)) throw new Error('Invalid Scorecard ID');
    if (ZR.Scorecards.metadata.has(id)) throw new Error('Scorecard ID already exists: ' + id);
    const text = await ZR.Utils.readResourceText('config/scorecards/_template.json');
    const card = JSON.parse(text);
    card.id = id;
    card.label = String(label || id).trim();
    card.version = 1;
    return await saveUserScorecard(card);
  }

  async function deleteScorecard(id) {
    id = String(id || '');
    const meta = ZR.Scorecards.metadata.get(id);
    if (!meta) throw new Error('Unknown Scorecard: ' + id);
    if (!meta.disabled && ZR.Scorecards.cards.size <= 1) throw new Error('Cannot delete/disable the last active Scorecard');
    const path = PathUtils.join(ZR.Paths.scorecards, `${id}.json`);
    if (await IOUtils.exists(path)) await IOUtils.remove(path);
    if (meta.bundled) {
      const d = disabledSet(); d.add(id); saveDisabled(d);
    }
    await load();
    return {id, disabled:!!meta.bundled, deleted:!meta.bundled};
  }

  async function restoreBundled(id) {
    id = String(id || '');
    if (!Object.prototype.hasOwnProperty.call(BUNDLED_FILES, id)) throw new Error('Not a bundled Scorecard: ' + id);
    const path = PathUtils.join(ZR.Paths.scorecards, `${id}.json`);
    if (await IOUtils.exists(path)) await IOUtils.remove(path);
    const d = disabledSet(); d.delete(id); saveDisabled(d);
    await load();
    return ZR.Scorecards.get(id);
  }

  async function resetOverride(id) {
    id = String(id || '');
    if (!Object.prototype.hasOwnProperty.call(BUNDLED_FILES, id)) throw new Error('Not a bundled Scorecard: ' + id);
    const path = PathUtils.join(ZR.Paths.scorecards, `${id}.json`);
    if (await IOUtils.exists(path)) await IOUtils.remove(path);
    const d = disabledSet(); d.delete(id); saveDisabled(d);
    await load();
    return ZR.Scorecards.get(id);
  }

  function activeSubscriptions() {
    const rows = (ZR.Config && ZR.Config.subscriptions && ZR.Config.subscriptions.subscriptions) || [];
    return rows.filter(s => s.enabled !== false && ZR.Scorecards && ZR.Scorecards.has(s.scorecard));
  }

  function subscriptionScorecard(subscriptionID) {
    const row = activeSubscriptions().find(x => String(x.id) === String(subscriptionID));
    if (!row) throw new Error('Unknown or disabled subscription: ' + subscriptionID);
    return ZR.Scorecards.get(row.scorecard);
  }

  function subscription(subscriptionID) {
    const row = activeSubscriptions().find(x => String(x.id) === String(subscriptionID));
    if (!row) throw new Error('Unknown or disabled subscription: ' + subscriptionID);
    return row;
  }

  ZR.ScorecardManager = {
    load, saveUserScorecard, copyScorecard, createFromTemplate, deleteScorecard,
    restoreBundled, resetOverride, subscriptionScorecard, subscription,
    activeSubscriptions, validate, validID
  };
})(ZR);
