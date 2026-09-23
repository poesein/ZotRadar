import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const source=fs.readFileSync(path.join(root,'content/scripts/ollama.js'),'utf8');
const schema={type:'object',required:['ok'],properties:{ok:{type:'boolean'}}};

function harness(values,responder){
  const calls=[];
  const ZR={Utils:{getPref:(key,fallback)=>Object.prototype.hasOwnProperty.call(values,key)?values[key]:fallback,
    safeJSON:(text,fallback)=>{try{return JSON.parse(text)}catch{return fallback}}}};
  const Zotero={HTTP:{request:async(method,url,options={})=>{calls.push({method,url,options,body:options.body?JSON.parse(options.body):null});const payload=await responder({method,url,options,body:calls.at(-1).body});return{responseText:JSON.stringify(payload)}}}};
  vm.runInNewContext(source,{ZR,Zotero},{filename:'ollama.js'});
  return{ZR,calls};
}

{
  const {ZR,calls}=harness({modelProvider:'ollama',ollamaBaseURL:'http://127.0.0.1:11434/',screeningModel:'qwen3:8b'},async()=>({models:[{name:'qwen3:8b'}]}));
  assert.equal(ZR.Ollama.modelID(),'qwen3:8b');
  const health=await ZR.Ollama.health();
  assert.equal(health.ok,true);assert.equal(Array.from(health.models).join(','),'qwen3:8b');
  assert.equal(calls[0].url,'http://127.0.0.1:11434/api/tags');
}

{
  const {ZR,calls}=harness({modelProvider:'deepseek',apiKey:'secret',apiModel:''},async()=>({choices:[{message:{content:'{"ok":true}'}}]}));
  const out=await ZR.Ollama.chat([{role:'user',content:'test'}],schema);
  assert.equal(out.content,'{"ok":true}');
  assert.equal(ZR.Ollama.modelID(),'deepseek:deepseek-flash');
  assert.equal(calls[0].url,'https://api.deepseek.com/chat/completions');
  assert.equal(calls[0].options.headers.Authorization,'Bearer secret');
  assert.equal(calls[0].body.response_format.type,'json_object');
}

{
  const {ZR,calls}=harness({modelProvider:'anthropic',apiKey:'secret',apiModel:'claude-example'},async()=>({content:[{type:'text',text:'{"ok":true}'}]}));
  const out=await ZR.Ollama.chat([{role:'system',content:'system'},{role:'user',content:'test'}],schema);
  assert.equal(out.content,'{"ok":true}');
  assert.equal(calls[0].url,'https://api.anthropic.com/v1/messages');
  assert.equal(calls[0].options.headers['x-api-key'],'secret');
  assert.equal(calls[0].body.system,'system');
  assert.equal(calls[0].body.output_config.format.type,'json_schema');
}

{
  const {ZR,calls}=harness({modelProvider:'gemini',apiKey:'secret',apiModel:'gemini-example'},async()=>({candidates:[{content:{parts:[{text:'{"ok":true}'}]}}]}));
  const out=await ZR.Ollama.chat([{role:'user',content:'test'}],schema);
  assert.equal(out.content,'{"ok":true}');
  assert.equal(calls[0].url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-example:generateContent');
  assert.equal(calls[0].options.headers['x-goog-api-key'],'secret');
  assert.equal(calls[0].body.generationConfig.responseMimeType,'application/json');
}

{
  const {ZR,calls}=harness({modelProvider:'openai_compatible',apiKey:'secret',apiModel:'custom-model',apiBaseURL:'http://127.0.0.1:8080/v1/'},async()=>({choices:[{message:{content:'{"ok":true}'}}]}));
  await ZR.Ollama.chat([{role:'user',content:'test'}],schema);
  assert.equal(calls[0].url,'http://127.0.0.1:8080/v1/chat/completions');
}

{
  const prefs=new Map([['modelProvider','ollama'],['ollamaBaseURL','http://127.0.0.1:11434'],['screeningModel','qwen3:8b'],['apiKey','saved-key']]);
  const ZR={Utils:{getPref:(key,fallback)=>prefs.has(key)?prefs.get(key):fallback,setPref:(key,value)=>prefs.set(key,value)},Config:{subscriptions:{subscriptions:[]}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'content/scripts/settings.js'),'utf8'),{ZR,Zotero:{}},{filename:'settings.js'});
  const redacted=ZR.Settings.getAll({redactSecrets:true});
  assert.equal(redacted.values.apiKey,'');assert.equal(redacted.meta.apiKeyConfigured,true);
  await ZR.Settings.update({modelProvider:'deepseek',apiKey:'new-key',apiModel:''},{preserveBlankSecrets:true});
  assert.equal(prefs.get('modelProvider'),'deepseek');assert.equal(prefs.get('apiKey'),'new-key');
  await assert.rejects(()=>ZR.Settings.update({modelProvider:'openai_compatible',apiBaseURL:'',apiModel:'custom'}),/API base URL is required/);
  assert.equal(prefs.get('modelProvider'),'deepseek','invalid provider settings must not partially persist');
}

console.log('Model provider adapters: PASS');
