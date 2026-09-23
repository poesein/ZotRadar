import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
const root=path.resolve(import.meta.dirname,'..');
const schema={type:'object',properties:{ok:{type:'boolean'}},required:['ok']};
const good={choices:[{message:{content:'{"ok":true}'}}],message:{content:'{"ok":true}'},content:[{type:'thinking',thinking:'private'},{type:'text',text:'{"ok":true}'}],candidates:[{content:{parts:[{thought:true,text:'private'},{text:'{"ok":true}'}]}}]};
function setup(values={},responder=()=>good){
 const prefs=new Map(Object.entries(values)),calls=[];
 const ZR={Config:{subscriptions:{subscriptions:[]}},Utils:{getPref:(k,d)=>prefs.has(k)?prefs.get(k):d,setPref:(k,v)=>prefs.set(k,v),safeJSON:(s,d)=>{try{return JSON.parse(s)}catch{return d}}}};
 const Zotero={HTTP:{request:async(method,url,options)=>{const call={method,url,body:JSON.parse(options.body),options};calls.push(call);return{responseText:JSON.stringify(await responder(call))}}}};
 for(const file of ['ollama','settings','i18n'])vm.runInNewContext(fs.readFileSync(path.join(root,'content/scripts/'+file+'.js'),'utf8'),{ZR,Zotero});
 return{ZR,prefs,calls,chat:()=>ZR.Ollama.chat([{role:'user',content:'test'}],schema)};
}
const remote={modelProvider:'openai_compatible',apiBaseURL:'https://api.commandcode.ai/provider/v1',apiModel:'deepseek/deepseek-v4-flash',apiKey:'fixture-key'};
test('default preserves existing provider routing, limits and cache ID',async()=>{
 const h=setup(remote);await h.chat();assert.equal(h.calls[0].url,'https://api.commandcode.ai/provider/v1/chat/completions');assert.equal(h.calls[0].body.reasoning_effort,undefined);assert.equal(h.calls[0].body.max_tokens,1024);assert.equal(h.ZR.Ollama.modelID(),'openai_compatible:deepseek/deepseek-v4-flash');
 h.prefs.set('modelProvider','deepseek');await h.chat();assert.equal(h.calls[1].url,'https://api.deepseek.com/chat/completions');
});
test('third-party API sends each selected effort without changing route or auth',async()=>{
 for(const effort of ['none','minimal','low','medium','high','xhigh','max']){
  const h=setup({...remote,reasoningEffort:effort});await h.chat();const c=h.calls[0];
  assert.equal(c.body.reasoning_effort,effort);assert.equal(c.url,'https://api.commandcode.ai/provider/v1/chat/completions');assert.equal(c.options.headers.Authorization,'Bearer fixture-key');
  assert.equal(c.body.max_tokens,effort==='none'?1024:['xhigh','max'].includes(effort)?32768:16384);
 }
});
test('DeepSeek official enables thinking; OpenAI uses completion-token budget',async()=>{
 const h=setup({...remote,modelProvider:'deepseek',reasoningEffort:'high'});await h.chat();assert.equal(h.calls[0].body.thinking.type,'enabled');assert.equal(h.calls[0].body.reasoning_effort,'high');
 h.prefs.set('reasoningEffort','none');await h.chat();assert.equal(h.calls[1].body.thinking.type,'disabled');
 h.prefs.set('modelProvider','openai');h.prefs.set('reasoningEffort','medium');await h.chat();assert.equal(h.calls[2].body.max_completion_tokens,16384);assert.equal(h.calls[2].body.max_tokens,undefined);
});
test('Ollama default/off remain off, ordinary models use bool, gpt-oss uses level',async()=>{
 const h=setup();await h.chat();assert.equal(h.calls[0].body.think,false);assert.equal(h.calls[0].body.options.num_predict,1024);
 h.prefs.set('reasoningEffort','high');await h.chat();assert.equal(h.calls[1].body.think,true);
 h.prefs.set('screeningModel','gpt-oss:20b');await h.chat();assert.equal(h.calls[2].body.think,'high');
 h.prefs.set('reasoningEffort','max');await assert.rejects(h.chat,/Reasoning setting/);assert.equal(h.calls.length,3);
});
test('Anthropic adaptive effort survives structured-output fallback',async()=>{
 let n=0;const h=setup({...remote,modelProvider:'anthropic',apiModel:'claude-sonnet-4-6',reasoningEffort:'high'},()=>{if(++n===1){const e=new Error('unsupported output_config.format');e.status=400;throw e}return good});
 assert.equal((await h.chat()).content,'{"ok":true}');assert.equal(h.calls[1].body.thinking.type,'adaptive');assert.equal(h.calls[1].body.output_config.effort,'high');assert.equal(h.calls[1].body.output_config.format,undefined);
});
test('legacy Claude and Gemini 2.5 map strength to explicit token budgets',async()=>{
 const h=setup({...remote,modelProvider:'anthropic',apiModel:'claude-sonnet-4-20250514',reasoningEffort:'high'});await h.chat();assert.equal(h.calls[0].body.thinking.budget_tokens,8192);assert.ok(h.calls[0].body.max_tokens>8192);
 h.prefs.set('modelProvider','gemini');h.prefs.set('apiModel','gemini-2.5-flash');h.prefs.set('reasoningEffort','medium');assert.equal((await h.chat()).content,'{"ok":true}');assert.equal(h.calls[1].body.generationConfig.thinkingConfig.thinkingBudget,4096);
 h.prefs.set('apiModel','gemini-2.5-pro');h.prefs.set('reasoningEffort','none');await assert.rejects(h.chat,/cannot be disabled/);
});
test('Gemini 3 receives thinkingLevel and unsupported levels fail before dispatch',async()=>{
 const h=setup({...remote,modelProvider:'gemini',apiModel:'gemini-3-flash-preview',reasoningEffort:'low'});await h.chat();assert.equal(h.calls[0].body.generationConfig.thinkingConfig.thinkingLevel,'low');
 h.prefs.set('reasoningEffort','max');await assert.rejects(h.chat,/Reasoning setting/);assert.equal(h.calls.length,1);
});
test('cache distinguishes effort while preserving old default identity',()=>{
 const h=setup();assert.equal(h.ZR.Ollama.modelID(),'qwen3:8b');h.prefs.set('reasoningEffort','high');assert.equal(h.ZR.Ollama.modelID(),'qwen3:8b:reasoning=high');h.prefs.set('reasoningEffort','auto');assert.equal(h.ZR.Ollama.modelID(),'qwen3:8b');
});
test('settings persist strength, redact keys, reject explicit invalid values atomically',async()=>{
 const h=setup(remote);await h.ZR.Settings.update({reasoningEffort:'high'});assert.equal(h.prefs.get('reasoningEffort'),'high');assert.equal(h.ZR.Settings.getAll({redactSecrets:true}).values.apiKey,'');
 await assert.rejects(()=>h.ZR.Settings.update({showChineseTitle:false,reasoningEffort:'invalid'}));assert.equal(h.prefs.has('showChineseTitle'),false);
 h.prefs.set('reasoningEffort','stale');assert.equal(h.ZR.Settings.get('reasoningEffort'),'auto');
 const def=h.ZR.Settings.publicSchema().find(d=>d.key==='reasoningEffort');assert.equal(def.type,'enum');assert.equal(def.choices.length,8);assert.equal(h.ZR.I18n.t('setting.reasoningEffort',{},'zh-CN'),'思考强度');
});
test('thinking connection test uses configured timeout and sufficient budget',async()=>{
 const h=setup({...remote,reasoningEffort:'high',timeoutSeconds:180});await h.ZR.Ollama.testConnection();assert.equal(h.calls[0].body.max_tokens,16384);assert.equal(h.calls[0].options.timeout,180000);
});
