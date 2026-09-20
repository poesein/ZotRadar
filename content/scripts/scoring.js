(function (ZR) {
  'use strict';
  const POLICY='generic-scoring-v1.2';
  function forCard(card){const base=ZR.Config.scoring,override=card&&card.scoring;if(!override)return base;return{...base,relevance:{...base.relevance,...(override.relevance||{})},priority:{...base.priority,...(override.priority||{})}};}
  function baseRelevance(j,cfg=ZR.Config.scoring){const m=cfg.relevance.mapping||{};if(j.scope==='UNCERTAIN')return null;const row=m[j.scope];if(row&&typeof row==='object'){if(!j.strength)return null;const v=row[j.strength];return v==null?null:ZR.Utils.clamp(v);}return row==null?null:ZR.Utils.clamp(row);}
  function gradeFor(v,cfg=ZR.Config.scoring){if(v==null)return null;const g=cfg.grades||{A:80,B:65,C:45,D:0};for(const k of ['A','B','C','D'])if(v>=Number(g[k]||0))return k;return'D';}
  function journalAdjustment(journalScore,cfg=ZR.Config.scoring,relevance=50){const b=cfg.journal||{},weights=cfg.priority&&cfg.priority.weights||{relevance:.8,journal:.2};const j=journalScore==null?Number(b.unknown_score??50):ZR.Utils.clamp(journalScore);return Number(weights.journal)*(j-relevance);}
  function score(j,{feedbackAdjustment=0,baselineJudgement=null,journalScore=null,isPreprint=false,cfg=ZR.Config.scoring}={}){
    const correctedBase=baseRelevance(j,cfg);
    if(correctedBase==null)return{base_relevance:null,feedback_adjustment:0,personalized_relevance:null,journal_score:journalScore,journal_adjustment:0,reading_priority:null,grade:null};
    // Explicit feedback changes the scope/strength before scoring. Show that
    // change as a numeric delta against the model's original judgement while
    // leaving the final calibrated score unchanged. UNKNOWN has no numeric
    // baseline, so the human-corrected value becomes the first known score.
    const modelBase=baselineJudgement?baseRelevance(baselineJudgement,cfg):correctedBase;
    const base=modelBase==null?correctedBase:modelBase;
    const personal=ZR.Utils.clamp(correctedBase+Number(feedbackAdjustment||0));
    const journal=journalScore==null?Number((cfg.journal&&cfg.journal.unknown_score)??50):ZR.Utils.clamp(journalScore);
    const final=isPreprint?personal:ZR.Utils.clamp(personal+journalAdjustment(journal,cfg,personal));
    return{base_relevance:+base.toFixed(2),feedback_adjustment:+(personal-base).toFixed(2),personalized_relevance:+personal.toFixed(2),journal_score:journalScore,journal_adjustment:+(final-personal).toFixed(2),reading_priority:+final.toFixed(2),grade:gradeFor(final,cfg)};
  }
  ZR.Scoring={POLICY,forCard,baseRelevance,gradeFor,journalAdjustment,score};
})(ZR);
