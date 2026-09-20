(function(ZR){'use strict';
  function schema(){ return ZR.Settings.publicSchema(); }
  function getAll(){ return ZR.Settings.getAll({redactSecrets:true}); }
  async function update(values, options={}){
    const r=await ZR.Settings.update(values, options);
    ZR.Events?.emit('settings:changed',{keys:Object.keys(values||{})});
    return r;
  }
  ZR.Services=ZR.Services||{};
  ZR.Services.Settings={schema,getAll,update,get:ZR.Settings.get};
})(ZR);