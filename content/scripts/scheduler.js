(function (ZR) {
  'use strict';
  let timer=null;
  function due(){if(!ZR.Utils.getPref('autoRun',true))return false;const last=ZR.Utils.getPref('lastDailyRun',''),hour=Number(ZR.Utils.getPref('dailyHour',8)),now=new Date(),today=ZR.Utils.localDayKey(now);if(!last)return now.getHours()>=hour;const lastDay=ZR.Utils.localDayKey(last);return lastDay!==today&&now.getHours()>=hour;}
  async function tick(){if(ZR.State.shuttingDown||ZR.State.runInProgress)return;if(due()){try{await ZR.Screening.runFeeds();ZR.Utils.log('scheduled run complete');}catch(e){Zotero.logError(e);}}}
  function start(){stop();timer=setInterval(()=>tick(),15*60*1000);ZR.timers.push(timer);setTimeout(()=>tick(),10000);}
  function stop(){if(timer){clearInterval(timer);timer=null;}}
  ZR.Scheduler={start,stop,tick,due};
})(ZR);
