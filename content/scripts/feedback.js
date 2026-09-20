(function (ZR) {
  'use strict';
  function maturityCap(total,cfg=ZR.Config.feedback){const rows=[...(cfg.maturity||[])].sort((a,b)=>Number(b.min_examples)-Number(a.min_examples));for(const r of rows)if(total>=Number(r.min_examples||0))return Number(r.max_adjustment||0);return 0;}
  // Explicit feedback still overrides a paper's judgment. The former vector
  // similarity adjustment is retired; no second model is loaded or called.
  async function adjustment(){return{adjustment:0,version:null,details:{reason:'manual feedback only'}};}
  async function rebuild(scorecardID){return ZR.DB.buildProfile(scorecardID,'manual-feedback-v1',{method:'explicit-feedback'});}
  async function maybeRebuild(scorecardID){const cfg=ZR.Config.feedback,rows=await ZR.DB.activeFeedback(scorecardID),min=Number(cfg.minimum_examples||10),every=Number((cfg.profile_rebuild||{}).after_new_feedback||10);if(rows.length<min||!every||rows.length%every!==0)return null;return rebuild(scorecardID);}
  ZR.Feedback={maturityCap,adjustment,rebuild,maybeRebuild};
})(ZR);
