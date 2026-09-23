(function (ZR) {
  'use strict';

  const PROMPT_VERSION = 'grounded-screening-v1.9.1';
  const RELATIONS = new Set(['DIRECT_FOCUS', 'DIRECT_TARGET', 'DIRECT_PRODUCT', 'SPECIFIC_CONTEXT', 'TRANSFERABLE_METHOD', 'NONE', 'UNKNOWN']);
  const CENTRALITIES = new Set(['CENTRAL', 'SUBSTANTIVE', 'PERIPHERAL', 'UNKNOWN']);
  const ROLES = new Set(['MAIN_SUBJECT', 'SPECIFIC_SECONDARY_RESULT', 'FAMILY_MEMBER_OR_PANEL', 'BACKGROUND_OR_PROXY', 'NO_SUPPORTED_LINK', 'UNKNOWN']);
  const LINKS = new Set(['DIRECT_CONFIGURED_CONTRIBUTION', 'SPECIFIC_EXPERIMENTAL_LINK', 'GENERIC_ASSOCIATION_OR_MENTION', 'REUSABLE_METHOD', 'NONE', 'UNKNOWN']);
  const DEPTHS = new Set(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']);
  const TYPES = new Set(['MECHANISM', 'FUNCTION', 'STRUCTURE', 'SPATIAL_SIGNALING', 'VARIANT', 'INTERVENTION', 'METHOD', 'SYNTHESIS', 'DESCRIPTIVE', 'CLINICAL', 'NONE']);

  const PROVIDERS = {
    ollama: {format:'ollama', label:'Ollama'},
    deepseek: {format:'openai', label:'DeepSeek', base:'https://api.deepseek.com', model:'deepseek-flash'},
    openai: {format:'openai', label:'OpenAI', base:'https://api.openai.com/v1'},
    anthropic: {format:'anthropic', label:'Anthropic', base:'https://api.anthropic.com/v1'},
    gemini: {format:'gemini', label:'Google Gemini', base:'https://generativelanguage.googleapis.com/v1beta'},
    qwen: {format:'openai', label:'Qwen / DashScope', base:'https://dashscope.aliyuncs.com/compatible-mode/v1'},
    openai_compatible: {format:'openai', label:'OpenAI-compatible API'}
  };

  function trimURL(value) { return String(value || '').trim().replace(/\/+$/, ''); }
  function joinURL(base, path) { return trimURL(base) + '/' + String(path || '').replace(/^\/+/, ''); }
  function providerConfig() {
    const selected = String(ZR.Utils.getPref('modelProvider', 'ollama') || 'ollama');
    const provider = PROVIDERS[selected] ? selected : 'ollama';
    const preset = PROVIDERS[provider];
    if (provider === 'ollama') {
      const model = String(ZR.Utils.getPref('screeningModel', 'qwen3:8b') || 'qwen3:8b').trim();
      return {provider, ...preset, base:trimURL(ZR.Utils.getPref('ollamaBaseURL', 'http://127.0.0.1:11434')), model, apiKey:''};
    }
    const customBase = provider === 'openai_compatible' ? trimURL(ZR.Utils.getPref('apiBaseURL', '')) : '';
    const base = customBase || preset.base || '';
    const model = String(ZR.Utils.getPref('apiModel', '') || preset.model || '').trim();
    const apiKey = String(ZR.Utils.getPref('apiKey', '') || '').trim();
    return {provider, ...preset, base, model, apiKey};
  }
  function validateProvider(cfg) {
    if (!cfg.base) throw new Error('API base URL is required for the selected provider');
    if (!cfg.model) throw new Error('API model is required for the selected provider');
    if (cfg.provider !== 'ollama' && !cfg.apiKey) throw new Error('API key is required for the selected provider');
    return cfg;
  }
  function modelName() { return validateProvider(providerConfig()).model; }
  function reasoningEffort() {
    const value=String(ZR.Utils.getPref('reasoningEffort','auto')||'auto');
    return ['auto','none','minimal','low','medium','high','xhigh','max'].includes(value)?value:'auto';
  }
  function modelID() { const cfg=validateProvider(providerConfig()),base=cfg.provider==='ollama'?cfg.model:`${cfg.provider}:${cfg.model}`,effort=reasoningEffort();return effort==='auto'?base:base+':reasoning='+effort; }
  function applyReasoning(cfg,body,effort) {
    if(effort==='auto')return;
    if(cfg.format==='ollama'){
      if(/gpt-oss/i.test(cfg.model)){
        if(!['low','medium','high'].includes(effort))throw new Error('Reasoning setting: Ollama gpt-oss supports low, medium or high');
        body.think=effort;
      }else body.think=effort!=='none';
    }else if(cfg.format==='openai'){
      if(cfg.provider==='deepseek'){
        body.thinking={type:effort==='none'?'disabled':'enabled'};
        if(effort!=='none')body.reasoning_effort=effort;
      }else body.reasoning_effort=effort;
      if(cfg.provider==='openai'){body.max_completion_tokens=body.max_tokens;delete body.max_tokens;}
    }else if(cfg.format==='anthropic'){
      if(effort==='none'){body.thinking={type:'disabled'};return;}
      if(/claude-3[-.]|claude-(?:sonnet|opus|haiku)-4(?:$|-[015](?:[-./]|$)|-\d{8}$)/i.test(cfg.model)){
        if(!['low','medium','high'].includes(effort))throw new Error('Reasoning setting: legacy Claude supports low, medium or high budgets');
        body.thinking={type:'enabled',budget_tokens:{low:1024,medium:4096,high:8192}[effort]};
      }else{
        if(effort==='minimal')throw new Error('Reasoning setting: Claude adaptive thinking does not support minimal');
        body.thinking={type:'adaptive'};body.output_config.effort=effort;
      }
    }else{
      if(/gemini-2\.5/i.test(cfg.model)){
        if(!['none','low','medium','high'].includes(effort))throw new Error('Reasoning setting: Gemini 2.5 supports off, low, medium or high budgets');
        if(effort==='none'&&/pro/i.test(cfg.model))throw new Error('Reasoning setting: Gemini 2.5 Pro thinking cannot be disabled');
        body.generationConfig.thinkingConfig={thinkingBudget:{none:0,low:1024,medium:4096,high:8192}[effort]};
      }else{
        if(!['minimal','low','medium','high'].includes(effort))throw new Error('Reasoning setting: Gemini thinking uses minimal, low, medium or high, depending on model');
        body.generationConfig.thinkingConfig={thinkingLevel:effort};
      }
    }
  }
  function timeoutMS(seconds=null) { return Number(seconds || ZR.Utils.getPref('timeoutSeconds', 120)) * 1000; }
  function responseJSON(xhr) { return JSON.parse(xhr.responseText || xhr.response || '{}'); }
  async function httpJSON(method, url, {body=null, headers={}, timeout=null}={}) {
    const options={headers:{...headers},responseType:'text',timeout:timeoutMS(timeout)};
    if(body!=null){options.body=JSON.stringify(body);options.headers['Content-Type']='application/json';}
    const xhr=await Zotero.HTTP.request(method,url,options);
    return responseJSON(xhr);
  }
  function providerHeaders(cfg) {
    if(cfg.format==='anthropic')return {'x-api-key':cfg.apiKey,'anthropic-version':'2023-06-01'};
    if(cfg.format==='gemini')return {'x-goog-api-key':cfg.apiKey};
    if(cfg.format==='openai')return {Authorization:`Bearer ${cfg.apiKey}`};
    return {};
  }
  function portableSchema(value) {
    if(Array.isArray(value))return value.map(portableSchema);
    if(!value||typeof value!=='object')return value;
    const out={};
    for(const [key,item] of Object.entries(value)){
      if(['maxLength','minLength','pattern'].includes(key))continue;
      out[key]=portableSchema(item);
    }
    if(out.type==='object'&&out.properties&&!Object.prototype.hasOwnProperty.call(out,'additionalProperties'))out.additionalProperties=false;
    return out;
  }
  function mayRetryWithoutStructuredOutput(error) {
    const status=Number(error?.status||error?.xmlhttp?.status||error?.response?.status||0);
    return [400,404,409,415,422].includes(status)||/schema|response.?format|output.?config|generation.?config/i.test(String(error?.message||error||''));
  }

  async function request(path, payload, timeoutSeconds = null) {
    const cfg=providerConfig();
    if(cfg.provider!=='ollama')throw new Error('Raw Ollama request is unavailable for remote API providers');
    return httpJSON('POST',joinURL(cfg.base,path),{body:payload,timeout:timeoutSeconds});
  }

  async function chat(messages, schema, {maxTokens=1024, timeout=null}={}) {
    const cfg=validateProvider(providerConfig()), cleanSchema=portableSchema(schema),effort=reasoningEffort();
    // Thinking shares the output budget; preserve the original limit in default/off mode.
    if(!['auto','none'].includes(effort))maxTokens=Math.max(maxTokens,['xhigh','max'].includes(effort)?32768:16384);
    if(cfg.format==='ollama'){
      const body={model:cfg.model,messages,stream:false,format:schema,think:false,
        options:{temperature:0,num_ctx:Number(ZR.Utils.getPref('numCtx',16384)),num_predict:maxTokens}};
      applyReasoning(cfg,body,effort);
      const raw=await httpJSON('POST',joinURL(cfg.base,'api/chat'),{body,timeout});
      return {content:String(raw?.message?.content||''),response:raw,provider:cfg.provider,model:cfg.model};
    }
    if(cfg.format==='openai'){
      const body={model:cfg.model,messages,stream:false,max_tokens:maxTokens,response_format:{type:'json_object'}};
      applyReasoning(cfg,body,effort);
      let raw;
      try{raw=await httpJSON('POST',joinURL(cfg.base,'chat/completions'),{body,headers:providerHeaders(cfg),timeout});}
      catch(e){if(!mayRetryWithoutStructuredOutput(e))throw e;delete body.response_format;raw=await httpJSON('POST',joinURL(cfg.base,'chat/completions'),{body,headers:providerHeaders(cfg),timeout});}
      return {content:String(raw?.choices?.[0]?.message?.content||''),response:raw,provider:cfg.provider,model:cfg.model};
    }
    if(cfg.format==='anthropic'){
      const system=messages.filter(x=>x.role==='system').map(x=>x.content).join('\n\n');
      const turns=messages.filter(x=>x.role!=='system').map(x=>({role:x.role==='assistant'?'assistant':'user',content:String(x.content||'')}));
      const body={model:cfg.model,max_tokens:maxTokens,messages:turns,output_config:{format:{type:'json_schema',schema:cleanSchema}}};
      if(system)body.system=system;
      applyReasoning(cfg,body,effort);
      let raw;
      try{raw=await httpJSON('POST',joinURL(cfg.base,'messages'),{body,headers:providerHeaders(cfg),timeout});}
      catch(e){if(!mayRetryWithoutStructuredOutput(e))throw e;delete body.output_config.format;raw=await httpJSON('POST',joinURL(cfg.base,'messages'),{body,headers:providerHeaders(cfg),timeout});}
      const content=(raw?.content||[]).filter(x=>x.type==='text').map(x=>x.text||'').join('');
      return {content:String(content),response:raw,provider:cfg.provider,model:cfg.model};
    }
    const system=messages.filter(x=>x.role==='system').map(x=>x.content).join('\n\n');
    const contents=messages.filter(x=>x.role!=='system').map(x=>({role:x.role==='assistant'?'model':'user',parts:[{text:String(x.content||'')}]}));
    const body={contents,generationConfig:{maxOutputTokens:maxTokens,responseMimeType:'application/json',responseJsonSchema:cleanSchema}};
    if(system)body.systemInstruction={parts:[{text:system}]};
    applyReasoning(cfg,body,effort);
    let raw;
    const url=joinURL(cfg.base,`models/${encodeURIComponent(cfg.model)}:generateContent`);
    try{raw=await httpJSON('POST',url,{body,headers:providerHeaders(cfg),timeout});}
    catch(e){if(!mayRetryWithoutStructuredOutput(e))throw e;delete body.generationConfig.responseMimeType;delete body.generationConfig.responseJsonSchema;raw=await httpJSON('POST',url,{body,headers:providerHeaders(cfg),timeout});}
    const content=(raw?.candidates?.[0]?.content?.parts||[]).filter(x=>!x.thought).map(x=>x.text||'').join('');
    return {content:String(content),response:raw,provider:cfg.provider,model:cfg.model};
  }

  function jsonSchema(card) {
    return {
      type: 'object',
      required: ['main_question', 'core_objects', 'interest_relation', 'centrality', 'focus_role', 'link_specificity', 'evidence_type',
        'evidence_depth', 'supporting_quotes', 'unknowns', 'topics', 'transferable_topic', 'reason'],
      properties: {
        main_question: { type: 'string', maxLength: 240 },
        core_objects: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 80 } },
        interest_relation: { enum: [...RELATIONS] },
        centrality: { enum: [...CENTRALITIES] },
        focus_role: { enum: [...ROLES] },
        link_specificity: { enum: [...LINKS] },
        evidence_type: { enum: [...TYPES] },
        evidence_depth: { enum: [...DEPTHS] },
        supporting_quotes: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 220 } },
        unknowns: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 120 } },
        topics: { type: 'array', maxItems: 8, items: { type: 'string', enum: (card.topics || []).map(t => t.id) } },
        transferable_topic: { type: ['string', 'null'], enum: [
          ...(card.scope.transferable.topics || []).map(t => t.id), null
        ] },
        reason: { type: 'string', maxLength: 240 }
      }
    };
  }

  function prompt(paper, card, ev) {
    const slim = { id: card.id, label: card.label, description: card.description, scope: card.scope, topics: card.topics };
    return `Extract a compact, evidence-grounded assessment of this scientific paper. The SCORECARD defines research interests; it is not evidence about the PAPER. Use ONLY TITLE and ABSTRACT for paper claims. Do not infer experiments, mechanisms, trajectories, variants or importance from a keyword, venue, or scorecard text. No numerical scores and no final scope label.

First state the paper's main question and up to five core objects, processes or methods. Then select exactly one interest_relation:
DIRECT_FOCUS = a configured primary research objective, including a biological object, physical process, design method or other domain-specific focus, is central to the paper's main findings or a focused synthesis.
DIRECT_TARGET = a configured target, variant, mechanism or intervention is central to the paper's main findings, or the paper is a focused synthesis about it. A second central factor does not demote a genuine target interaction.
DIRECT_PRODUCT = a molecular product independently named as a major interest by the scorecard is centrally measured or mechanistically studied; the upstream target need not be named.
SPECIFIC_CONTEXT = a concrete experimental result informs a configured research question, but that question is not the paper's central subject. A causal perturbation, substitution or rescue experiment about a configured target can qualify as a specific secondary result even when the paper's main question is elsewhere. A generic pathway association, clinical marker or inhibitor mention is NOT sufficient.
TRANSFERABLE_METHOD = an actual method or resource is directly reusable for a configured transferable task. Static localization does not imply dynamic tracking; generic sequencing does not imply variant-function mapping.
NONE = none of these relations is substantiated. UNKNOWN = the supplied title/abstract cannot decide.
Judge each configured target, product and method independently. A specific contribution by a configured target may be relevant even if another, non-configured product is the paper's main object; do not equate related but distinct products.
For NONE, focus_role must be BACKGROUND_OR_PROXY or NO_SUPPORTED_LINK, and link_specificity must be GENERIC_ASSOCIATION_OR_MENTION or NONE. Keep the three classifications mutually consistent.
If the reported effect is explicitly independent of the configured target or pathway, that result is not positive evidence for it. Another independent direct result would need its own supporting quotation.

Classify the configured interest along TWO independent axes before choosing a relation:
focus_role: MAIN_SUBJECT = the configured interest itself drives the main research question or a focused synthesis; SPECIFIC_SECONDARY_RESULT = a distinct, concrete result about it within a broader paper; FAMILY_MEMBER_OR_PANEL = it is one member of a broad family/panel screen and the paper's conclusion concerns that family or a general structure-activity series; BACKGROUND_OR_PROXY = it appears only as background, a generic pathway/marker, or a downstream proxy; NO_SUPPORTED_LINK = the abstract gives no link; UNKNOWN = cannot decide. A configured isoform or mutant being tested in a pan-family panel is FAMILY_MEMBER_OR_PANEL unless a distinct finding about it drives the main conclusion.
link_specificity: DIRECT_CONFIGURED_CONTRIBUTION = a result or focused synthesis directly measures, explains or develops a configured target, product, variant, mechanism, intervention, method or resource; SPECIFIC_EXPERIMENTAL_LINK = a concrete experimental finding directly informs a configured question without making that question the central subject; GENERIC_ASSOCIATION_OR_MENTION = a pathway/marker correlation, routine clinical association, broad review mention or inhibitor name without a specific link; REUSABLE_METHOD = a method not directly about the configured interest but clearly reusable for a configured transferable task; NONE = no link; UNKNOWN = insufficient information. A generic association does not become a specific link because a scorecard search term appears in the abstract.
centrality refers to the CONFIGURED RESEARCH INTEREST, not the overall paper or assay. CENTRAL = the configured interest drives the main question or main finding; SUBSTANTIVE = a specific supported secondary result; PERIPHERAL = an incidental model or assay; UNKNOWN = cannot determine. Compare the main question with the quoted results before selecting CENTRAL.
evidence_depth: HIGH = concrete mechanistic, functional, structural, spatial, variant, intervention or method evidence, or a focused synthesis integrating such evidence; MEDIUM = substantive but descriptive, applied or partial evidence; LOW = a focused milestone/approval or limited evidence; UNKNOWN = cannot determine. Choose the strongest actual evidence_type. One deeply relevant configured theme is enough; multiple themes are not required. Missing abstract evidence is UNKNOWN, not negative evidence.
METHOD means a reusable technique relevant to a configured task, not routine measurement, statistical association, or biomarker analysis. A downstream proxy or disease marker alone, without a specific connection to a configured research question, is NONE rather than SPECIFIC_CONTEXT.

supporting_quotes MUST contain 1-3 verbatim contiguous substrings from TITLE or ABSTRACT that support a positive relation, each at most 220 characters. For a direct relation, include a quotation naming the configured target or product when one is available; do not quote only a generic downstream outcome. Do not copy or paraphrase SCORECARD or TERM HITS. If a positive relation has no quotable support, use UNKNOWN. For NONE, an empty quote list is allowed. State material unknowns separately; do not turn absent details into negative findings. Return one compact JSON object matching the schema.

SCORECARD:
${JSON.stringify(slim)}

UNWEIGHTED TERM HITS (search hints only; not evidence of centrality):
${JSON.stringify(ev)}

TITLE:
${paper.title || ''}

ABSTRACT:
${paper.abstract || '[ABSTRACT NOT AVAILABLE]'}`;
  }

  function normalizedSurface(value) {
    return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  }

  function compactSurface(value) {
    return normalizedSurface(value).replace(/[\s‐‑‒–—-]+/g, '');
  }

  function formattingOnlyRepair(quote, paper) {
    const needle = compactSurface(quote);
    if (needle.length < 20) return null;
    for (const [source, body] of [['abstract', paper && paper.abstract], ['title', paper && paper.title]]) {
      const sentences = String(body || '').replace(/([.!?])\s+(?=[A-Z])/g, '$1\n').split('\n');
      for (const sentence of sentences) {
        const exact = sentence.trim();
        if (exact.length <= 500 && compactSurface(exact).includes(needle)) {
          return { quote: exact, source, repaired: 'whitespace-or-dash', original_candidate: quote };
        }
      }
    }
    return null;
  }

  function verifiedQuotes(raw, paper) {
    const title = normalizedSurface(paper && paper.title), abstract = normalizedSurface(paper && paper.abstract);
    const accepted = [], rejected = [], seen = new Set();
    for (const candidate of Array.isArray(raw) ? raw.slice(0, 3) : []) {
      const quote = String(candidate || '').trim();
      const surface = normalizedSurface(quote);
      if (surface.length < 10 || surface.length > 220 || seen.has(surface)) { rejected.push(quote); continue; }
      seen.add(surface);
      const source = abstract.includes(surface) ? 'abstract' : title.includes(surface) ? 'title' : null;
      if (source) accepted.push({ quote, source });
      else {
        const repaired = formattingOnlyRepair(quote, paper);
        if (repaired) accepted.push(repaired);
        else rejected.push(quote);
      }
    }
    return { accepted, rejected };
  }

  function contradictsTargetRelation(checked, card) {
    const terms = [
      ...(card.scope.direct.anchors || []), ...(card.scope.direct.aliases || []),
      ...(card.scope.contextual.anchors || []), ...(card.scope.contextual.aliases || [])
    ].map(normalizedSurface).filter(term => term.length >= 3);
    return checked.accepted.some(row => {
      const quote = normalizedSurface(row.quote).replace(/[‐‑‒–—]/g, '-');
      return terms.some(term => quote.includes(`${term}-independent`) ||
        quote.includes(`independent of ${term}`) || quote.includes(`${term}-unrelated`));
    });
  }

  function broadPanelTitle(paper) {
    const title = normalizedSurface(paper && paper.title).replace(/[‐‑‒–—]/g, '-');
    return /\bpan[-\s]|\bfamily[-\s]wide\b|\bbroad[-\s]spectrum\b|\bmulti[-\s]target\b|\b(?:any|all|across|multiple)\s+class\s+[ivx]+[a-d]?\b|\bclass\s+[ivx]+[a-d]?\s+\w*\s*isoforms?\b|\bacross (?:a |the )?(?:panel|family)\b|\bpanel of (?:targets|isoforms|proteins|enzymes|receptors|methods)\b/.test(title);
  }

  function hasTerm(text, term) {
    const surface = normalizedSurface(text), target = normalizedSurface(term);
    if (!surface || !target) return false;
    if (/^[a-z0-9]{1,3}$/.test(target)) {
      const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(surface);
    }
    return surface.includes(target);
  }

  function hasAnyTerm(text, terms) {
    return terms.some(term => hasTerm(text, term));
  }

  function discriminativeTerms(policy, paper) {
    const source = `${paper && paper.title || ''} ${paper && paper.abstract || ''}`;
    return (Array.isArray(policy.direct_discriminative_anchors) ? policy.direct_discriminative_anchors : [])
      .filter(row => typeof row === 'string' || (row && typeof row === 'object'))
      .filter(row => typeof row === 'string' || !Array.isArray(row.requires_any) ||
        hasAnyTerm(source, row.requires_any))
      .map(row => typeof row === 'string' ? row : row.term)
      .filter(row => typeof row === 'string' && row.trim());
  }

  function methodClaimSupported(paper, question, checked) {
    const focus = `${paper && paper.title || ''} ${question || ''}`;
    const quotes = checked.accepted.map(row => row.quote).join(' ');
    return /\b(method|assay|algorithm|workflow|pipeline|protocol|tool|technique|platform|framework)\b/i.test(focus) &&
      /\b(new|novel|develop\w*|introduc\w*|design\w*|validat\w*|establish\w*)\b/i.test(`${focus} ${quotes}`);
  }

  function descriptiveFocus(paper, question) {
    return /\b(frequency|prevalence|incidence|spectrum|association|coexistence|coexistent|distribution|heterogeneity|patterns?|characteriz\w*)\b/i.test(
      `${paper && paper.title || ''} ${question || ''}`);
  }

  function normalize(raw, card, ev, paper) {
    const x = raw && typeof raw === 'object' ? raw : {};
    const relation = RELATIONS.has(x.interest_relation) ? x.interest_relation : 'UNKNOWN';
    const centrality = CENTRALITIES.has(x.centrality) ? x.centrality : 'UNKNOWN';
    const role = ROLES.has(x.focus_role) ? x.focus_role : 'UNKNOWN';
    const link = LINKS.has(x.link_specificity) ? x.link_specificity : 'UNKNOWN';
    const evidenceType = TYPES.has(x.evidence_type) ? x.evidence_type : 'NONE';
    const depth = DEPTHS.has(x.evidence_depth) ? x.evidence_depth : 'UNKNOWN';
    const checked = verifiedQuotes(x.supporting_quotes, paper);
    const topicIDs = new Set((card.topics || []).map(row => row.id));
    const transferIDs = new Set((card.scope.transferable.topics || []).map(row => row.id));
    const topics = Array.isArray(x.topics) ? [...new Set(x.topics.filter(t => topicIDs.has(t)))].slice(0, 8) : [];
    const transferTopic = transferIDs.has(x.transferable_topic) ? x.transferable_topic : null;
    const unknowns = Array.isArray(x.unknowns) ? x.unknowns.map(v => String(v).slice(0, 120)).slice(0, 3) : [];
    const errors = [];
    let scope = 'UNCERTAIN', strength = null;

    const titleDirectHit = !!(ev && Array.isArray(ev.direct) && ev.direct.some(hit => hit.source === 'title'));
    const broadTitle = broadPanelTitle(paper);
    const policy = card.evidence_policy || {};
    const directTerms = [...(card.scope.direct.anchors || []), ...(card.scope.direct.aliases || []),
      ...discriminativeTerms(policy, paper)];
    const recoveredTitleQuote = !!(policy.allow_title_quote_recovery && !checked.accepted.length &&
      titleDirectHit && (relation === 'DIRECT_FOCUS' || relation === 'DIRECT_TARGET' || relation === 'DIRECT_PRODUCT') &&
      role === 'MAIN_SUBJECT' && centrality === 'CENTRAL' &&
      link === 'DIRECT_CONFIGURED_CONTRIBUTION' && String(paper && paper.title || '').trim());
    if (recoveredTitleQuote) checked.accepted.push({
      quote: String(paper.title).trim(), source: 'title', recovered: 'model-quote-rejected'
    });
    const quotes = checked.accepted.map(row => row.quote);
    const directAbstractQuote = checked.accepted.some(row => row.source === 'abstract' && hasAnyTerm(row.quote, directTerms));
    const directAbstractQuoteCount = checked.accepted.filter(row =>
      row.source === 'abstract' && hasAnyTerm(row.quote, directTerms)).length;
    const directVerifiedQuote = checked.accepted.some(row => hasAnyTerm(row.quote, directTerms));
    const questionDirectHit = hasAnyTerm(x.main_question, directTerms);
    const directSourceCorroborated = questionDirectHit &&
      hasAnyTerm(paper && paper.abstract, directTerms) &&
      checked.accepted.some(row => row.source === 'abstract');
    const conflictingDirectEvidence = questionDirectHit && directAbstractQuoteCount >= 2 &&
      checked.accepted.some(row => row.source === 'abstract');
    const methodSupported = methodClaimSupported(paper, x.main_question, checked);
    const descriptiveMainQuestion = descriptiveFocus(paper, x.main_question) ||
      hasAnyTerm(paper && paper.title, Array.isArray(policy.descriptive_title_terms) ?
        policy.descriptive_title_terms : []);
    const contextualRequired = Array.isArray(policy.contextual_require_any) ? policy.contextual_require_any : [];
    const contextualModeSupported = !contextualRequired.length ||
      checked.accepted.some(row => hasAnyTerm(row.quote, contextualRequired)) ||
      hasAnyTerm(paper && paper.title, contextualRequired);
    if (!paper || !String(paper.abstract || '').trim()) {
      errors.push('Abstract unavailable; absence of evidence is not negative evidence');
    } else if (!String(x.main_question || '').trim() ||
      !Array.isArray(x.core_objects) || !x.core_objects.some(value => String(value || '').trim())) {
      errors.push('Main question or core objects missing from extraction');
    } else if (relation === 'NONE' && titleDirectHit) {
      errors.push('OUT_OF_SCOPE conflicts with a direct-interest title hit; review required');
    } else if (relation === 'NONE' &&
      (role === 'MAIN_SUBJECT' || role === 'SPECIFIC_SECONDARY_RESULT' || role === 'FAMILY_MEMBER_OR_PANEL' ||
        link === 'DIRECT_CONFIGURED_CONTRIBUTION' || link === 'SPECIFIC_EXPERIMENTAL_LINK' || link === 'REUSABLE_METHOD')) {
      errors.push('OUT_OF_SCOPE conflicts with a classified positive interest link; review required');
    } else if (relation === 'NONE') scope = 'OUT_OF_SCOPE';
    else if ((relation === 'SPECIFIC_CONTEXT' || relation === 'UNKNOWN') &&
      role === 'BACKGROUND_OR_PROXY' && link === 'GENERIC_ASSOCIATION_OR_MENTION' &&
      !titleDirectHit && !conflictingDirectEvidence) {
      scope = 'OUT_OF_SCOPE';
    }
    else if (relation === 'UNKNOWN' || centrality === 'UNKNOWN' || role === 'UNKNOWN' ||
      link === 'UNKNOWN' || depth === 'UNKNOWN' || evidenceType === 'NONE') {
      errors.push('Insufficient classified evidence');
    } else if (!quotes.length) {
      errors.push('No supporting quotation was found verbatim in title or abstract');
    } else if (contradictsTargetRelation(checked, card)) {
      errors.push('A verified quotation states target independence; relation requires review');
    } else if (relation === 'TRANSFERABLE_METHOD' && !transferTopic) {
      errors.push('Transferable method lacks a configured transferable topic');
    } else if (role === 'NO_SUPPORTED_LINK' || link === 'NONE') {
      errors.push('Positive relation conflicts with an unsupported interest link');
    } else if (role === 'BACKGROUND_OR_PROXY' || link === 'GENERIC_ASSOCIATION_OR_MENTION') {
      if (titleDirectHit || conflictingDirectEvidence) {
        errors.push('Generic or proxy relation conflicts with a direct-interest question and multiple source quotations; review required');
      }
      else scope = 'OUT_OF_SCOPE';
    } else if (centrality === 'PERIPHERAL') {
      if (titleDirectHit) errors.push('Peripheral relation conflicts with a direct-interest title hit; review required');
      else scope = 'OUT_OF_SCOPE';
    } else {
      if (relation === 'DIRECT_FOCUS' || relation === 'DIRECT_TARGET' || relation === 'DIRECT_PRODUCT') {
        if (link !== 'DIRECT_CONFIGURED_CONTRIBUTION' && link !== 'SPECIFIC_EXPERIMENTAL_LINK') {
          errors.push('Direct relation lacks a specific target or product link');
        } else if (role === 'MAIN_SUBJECT' && centrality === 'CENTRAL' && link === 'DIRECT_CONFIGURED_CONTRIBUTION') {
          scope = 'DIRECT';
        } else if (role === 'SPECIFIC_SECONDARY_RESULT' || role === 'FAMILY_MEMBER_OR_PANEL' ||
          (role === 'MAIN_SUBJECT' && centrality === 'SUBSTANTIVE')) scope = 'CONTEXTUAL';
        else errors.push('Direct relation conflicts with the classified research focus');
      } else if (relation === 'SPECIFIC_CONTEXT') {
        if ((role === 'MAIN_SUBJECT' || role === 'SPECIFIC_SECONDARY_RESULT' || role === 'FAMILY_MEMBER_OR_PANEL') &&
          (link === 'DIRECT_CONFIGURED_CONTRIBUTION' || link === 'SPECIFIC_EXPERIMENTAL_LINK')) scope = 'CONTEXTUAL';
        else errors.push('Context relation lacks a specific experimental or functional link');
      } else if (relation === 'TRANSFERABLE_METHOD') {
        if (link === 'REUSABLE_METHOD' && (role === 'MAIN_SUBJECT' || role === 'SPECIFIC_SECONDARY_RESULT')) scope = 'TRANSFERABLE';
        else errors.push('Transferable relation lacks a specific reusable method');
      }
      if (scope !== 'UNCERTAIN') strength = depth;
      if (scope === 'CONTEXTUAL' && role === 'FAMILY_MEMBER_OR_PANEL' && strength === 'HIGH') {
        strength = 'MEDIUM';
        errors.push('Family/panel membership alone cannot establish HIGH interest depth');
      }
      if (strength === 'HIGH' && !checked.accepted.some(row => row.source === 'abstract')) {
        strength = 'LOW';
        errors.push('Title-only quotation cannot support HIGH evidence depth');
      }
      const highDepthCapTypes=Array.isArray(policy.high_depth_cap_types)?policy.high_depth_cap_types:['DESCRIPTIVE','CLINICAL'];
      if (strength === 'HIGH' && highDepthCapTypes.includes(evidenceType)) {
        strength = 'MEDIUM';
        errors.push('Scorecard evidence-type policy caps HIGH research depth for '+evidenceType);
      }
      if (strength === 'HIGH' && evidenceType === 'METHOD' &&
        descriptiveMainQuestion && !methodSupported) {
        strength = 'MEDIUM';
        errors.push('Routine descriptive analysis is not evidence of a new reusable METHOD');
      }
      if (strength === 'HIGH' && Array.isArray(policy.clinical_title_terms) &&
        hasAnyTerm(paper && paper.title, policy.clinical_title_terms)) {
        strength = 'MEDIUM';
        errors.push('Scorecard clinical-milestone preference caps abstract-only depth');
      }
      if (scope === 'DIRECT' && strength === 'HIGH' &&
        policy.direct_high_requires_abstract_corroboration &&
        !directAbstractQuote && !directSourceCorroborated) {
        strength = 'LOW';
        errors.push('Direct HIGH needs a direct-interest abstract quote or corroborated source context');
      }
      if (scope === 'DIRECT' && broadTitle && !titleDirectHit &&
        !(questionDirectHit && directAbstractQuoteCount >= 2 &&
          role === 'MAIN_SUBJECT' && centrality === 'CENTRAL' &&
          link === 'DIRECT_CONFIGURED_CONTRIBUTION')) {
        scope = 'CONTEXTUAL';
        if (strength === 'HIGH') strength = 'MEDIUM';
        errors.push('Broad family/panel title without a direct-interest title anchor caps the inferred focus');
      }
      if (scope === 'CONTEXTUAL' && policy.promote_direct_title_question && titleDirectHit &&
        questionDirectHit && directAbstractQuote && role !== 'FAMILY_MEMBER_OR_PANEL') {
        scope = 'DIRECT';
        errors.push('Direct-interest title, main question and abstract evidence establish focality');
      }
      if (scope === 'DIRECT' && policy.direct_requires_anchor &&
        !directVerifiedQuote && !titleDirectHit && !directSourceCorroborated) {
        scope = policy.contextual_requires_direct_anchor ? 'OUT_OF_SCOPE' : 'UNCERTAIN';
        strength = null;
        errors.push('Direct judgement has no verified scorecard-direct anchor');
      }
      if (scope === 'CONTEXTUAL' && policy.contextual_requires_direct_anchor &&
        !directVerifiedQuote && !titleDirectHit) {
        scope = 'OUT_OF_SCOPE'; strength = null;
        errors.push('Context lacks the scorecard-required specific-interest anchor');
      }
      if (scope === 'CONTEXTUAL' && !contextualModeSupported) {
        scope = titleDirectHit ? 'UNCERTAIN' : 'OUT_OF_SCOPE'; strength = null;
        errors.push('Context lacks the scorecard-required evidence mode');
      }
    }
    const reason = String(x.reason || x.main_question || 'No grounded model reason.').slice(0, 240);
    return {
      scope, strength, topics,
      transferable_topic: scope === 'TRANSFERABLE' ? transferTopic : null,
      reason, positive_evidence: quotes, negative_evidence: [],
      uncertainty: [...unknowns, ...errors].join('; ').slice(0, 600) || null,
      analysis: {
        main_question: String(x.main_question || '').slice(0, 240),
        core_objects: Array.isArray(x.core_objects) ? x.core_objects.map(v => String(v).slice(0, 80)).slice(0, 5) : [],
        interest_relation: relation, centrality, focus_role: role, link_specificity: link,
        evidence_type: evidenceType, evidence_depth: depth,
        focus_audit: { broad_panel_title: broadTitle, direct_interest_title_hit: titleDirectHit,
          direct_verified_quote: directVerifiedQuote, direct_abstract_quote: directAbstractQuote,
          direct_abstract_quote_count: directAbstractQuoteCount,
          direct_source_corroborated: directSourceCorroborated,
          conflicting_direct_evidence: conflictingDirectEvidence,
          method_claim_supported: methodSupported,
          descriptive_main_question: descriptiveMainQuestion,
          recovered_title_quote: recoveredTitleQuote,
          question_direct_hit: questionDirectHit, contextual_mode_supported: contextualModeSupported },
        unknowns
      },
      evidence_audit: {
        verified: checked.accepted,
        rejected: checked.rejected,
        verifier: 'source-quote-formatting-v2'
      }
    };
  }

  async function screen(paper, card, ev) {
    const model = modelID(), messages=[{ role: 'user', content: prompt(paper, card, ev) }], schema=jsonSchema(card);
    let resp = await chat(messages, schema, {maxTokens:1024});
    let content = resp.content || '';
    let parsed = ZR.Utils.safeJSON(content, null);
    if (!parsed) {
      // A complex scorecard can exhaust the first response budget mid-JSON.
      // Give the repair attempt enough room to emit a complete object.
      messages.push({ role: 'assistant', content: content.slice(0, 1000) });
      messages.push({ role: 'user', content: 'Return one compact JSON object matching the schema, with short verbatim supporting_quotes.' });
      resp = await chat(messages, schema, {maxTokens:2048});
      content = resp.content || '';
      parsed = ZR.Utils.safeJSON(content, null);
    }
    if (!parsed) throw new Error('Model provider did not return valid structured JSON after retry');
    return { judgement: normalize(parsed, card, ev, paper), raw: content, model };
  }

  async function embed(input) {
    const model = String(ZR.Utils.getPref('embeddingModel', 'bge-m3:latest'));
    const resp = await request('/api/embed', { model, input: Array.isArray(input) ? input : [input], truncate: true });
    const arr = resp.embeddings || [];
    if (!arr.length) throw new Error('Ollama embedding response has no embeddings');
    return arr;
  }

  async function health() {
    try {
      const cfg=validateProvider(providerConfig());let j,models=[];
      if(cfg.format==='ollama'){
        j=await httpJSON('GET',joinURL(cfg.base,'api/tags'),{timeout:5});models=(j.models||[]).map(m=>m.name);
      }else if(cfg.format==='gemini'){
        j=await httpJSON('GET',joinURL(cfg.base,'models'),{headers:providerHeaders(cfg),timeout:8});models=(j.models||[]).map(m=>String(m.name||'').replace(/^models\//,''));
      }else{
        j=await httpJSON('GET',joinURL(cfg.base,'models'),{headers:providerHeaders(cfg),timeout:8});models=(j.data||j.models||[]).map(m=>m.id||m.name).filter(Boolean);
      }
      return {ok:true,provider:cfg.provider,providerLabel:cfg.label,model:cfg.model,models};
    } catch (e) { const cfg=providerConfig();return {ok:false,provider:cfg.provider,providerLabel:cfg.label,model:cfg.model,error:String(e?.message||e)}; }
  }

  async function testConnection(){
    const schema={type:'object',required:['ok'],properties:{ok:{type:'boolean'}}};
    const response=await chat([{role:'user',content:'Return exactly one JSON object with {"ok": true}.'}],schema,{maxTokens:32,timeout:['auto','none'].includes(reasoningEffort())?30:null});
    const parsed=ZR.Utils.safeJSON(response.content,null);
    if(!parsed||parsed.ok!==true)throw new Error('Model API returned an unexpected test response');
    return {ok:true,provider:response.provider,model:response.model};
  }

  ZR.Ollama = { PROMPT_VERSION, PROVIDERS, providerConfig, modelName, modelID, request, chat, jsonSchema, prompt, verifiedQuotes, normalize, screen, embed, health, testConnection };
})(ZR);
