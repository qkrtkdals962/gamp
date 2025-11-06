(function(){
  // Challenge mode configuration: 5 rounds with increasing targets
  const config = {
    rounds: 5,
    timeLimitFishing: 30,
    timeLimitClicker: 30,
    thresholds: {
      // Runner score targets per round
      runner:  [200, 500, 800, 1100, 1500],
      // Fishing score targets per round (within 30s)
      fishing: [ 2, 4, 6,  8,  10],
      // Aim Trainer score targets per round (within 30s)
      clicker: [300, 450, 600,  800, 1000]
    }
  };

  function shuffle(arr){ const a = arr.slice(); for(let i=a.length-1;i>0;i--){const j=(Math.random()* (i+1))|0; [a[i],a[j]]=[a[j],a[i]];} return a; }

  window.Challenge = {
    config,
    shuffle,
    getTargets(roundIndex){
      return {
        runner:  config.thresholds.runner[roundIndex],
        fishing: config.thresholds.fishing[roundIndex],
        clicker: config.thresholds.clicker[roundIndex],
        timeFishing: config.timeLimitFishing,
        timeClicker: config.timeLimitClicker
      };
    }
  };
})();
