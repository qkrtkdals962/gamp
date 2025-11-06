(function(){
  const canvas2D = document.getElementById('gameCanvas');
  const canvas3D = document.getElementById('renderCanvas3D');

  const hud = document.getElementById('hud');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const timerWrap = document.getElementById('timerWrap');
  const timerEl = document.getElementById('timer');
  const overWrap = document.getElementById('gameOver');
  const finalScore = document.getElementById('finalScore');
  const finalBest = document.getElementById('finalBest');
  const retryBtn = document.getElementById('retryBtn');
  const menuBtn = document.getElementById('menuBtn');

  const aimStatsEl = document.getElementById('aimStats');
  const accuracyEl = document.getElementById('accuracy');
  const comboEl = document.getElementById('combo');
  const hitsEl = document.getElementById('hits');
  const aimScoreEl = document.getElementById('aimScore');
  const aimTimeEl = document.getElementById('aimTime');
  const aimTargetWrap = document.getElementById('aimTargetWrap');
  const aimTargetEl = document.getElementById('aimTarget');
  const extraStatsEl = document.getElementById('extraStats');
  const finalAccuracy = document.getElementById('finalAccuracy');
  const finalMaxCombo = document.getElementById('finalMaxCombo');
  const finalShots = document.getElementById('finalShots');
  const finalHits = document.getElementById('finalHits');
  const gameOverTitle = document.getElementById('gameOverTitle');
  const gameOverMessage = document.getElementById('gameOverMessage');

  const crosshairEl = document.getElementById('crosshair');
  const countdownEl = document.getElementById('countdown');
  const countdownNumberEl = document.getElementById('countdownNumber');
  const targetWrap = document.getElementById('targetWrap');
  const targetText = document.getElementById('targetText');
  const goalWrap = document.getElementById('goalWrap');
  const goalValue = document.getElementById('goalValue');
  const aimTrainerStartEl = document.getElementById('aimTrainerStart');
  const aimTrainerPlayBtn = document.getElementById('aimTrainerPlayBtn');
  const backButton = document.getElementById('backButton');

  const menu = document.getElementById('menu');
  const cards = menu.querySelectorAll('.card');

  const E = window.Engine; E.init(canvas2D);
  const mgr = new window.SceneManager();

  let babylonEngine = null; let babylonScene = null;
  function ensureBabylon(){ if (!babylonEngine) { babylonEngine = new BABYLON.Engine(canvas3D, true); window.addEventListener('resize', ()=>babylonEngine.resize()); } }

  function GameScene(gameKey){
    this.key = gameKey; this.game = null; this.bestKey = 'best_' + gameKey;
    this.is3D = (gameKey === 'clicker'); this.isAimTrainer = this.is3D;
    this.gameOverTriggered = false; this.isReady = !this.isAimTrainer; this.gameStarted = false;
  }

  GameScene.prototype.onEnter = function(){
  const map = { runner: window.RunnerGame, clicker: window.ClickerGame, fishing: window.GameFishing };

    if (babylonEngine) { babylonEngine.stopRenderLoop(); }

    if (this.isAimTrainer) {
      // Remove the start overlay and jump straight into the Aim Trainer
      if (aimTrainerStartEl) { aimTrainerStartEl.classList.remove('show'); aimTrainerStartEl.classList.add('hidden'); }
      menu.classList.remove('show');
      if (backButton) { backButton.classList.add('show'); }
      this.startAimTrainerGame();
      return;
    }

    if (this.is3D) {
      canvas2D.style.display = 'none'; canvas3D.style.display = 'block';
      document.body.style.background = '#0a0a0f'; document.body.classList.add('aim-trainer-mode');
      if (aimStatsEl && crosshairEl) { aimStatsEl.classList.add('show'); crosshairEl.classList.add('show'); }
      if (!babylonEngine) { babylonEngine = new BABYLON.Engine(canvas3D, true); window.addEventListener('resize', ()=>babylonEngine.resize()); }
      this.game = new map[this.key](); babylonScene = this.game.init3D(babylonEngine, canvas3D);
      babylonEngine.runRenderLoop(function(){ if (babylonScene) babylonScene.render(); });
    } else {
      canvas2D.style.display = 'block'; canvas3D.style.display = 'none';
      document.body.style.background = '#f7e08b'; if (aimStatsEl && crosshairEl) { aimStatsEl.classList.remove('show'); crosshairEl.classList.remove('show'); }
      this.game = new map[this.key](); this.game.init();
    }

  menu.classList.remove('show'); hud.classList.remove('hidden'); hud.classList.add('show'); overWrap.classList.add('hidden');
  if (aimTargetWrap) aimTargetWrap.classList.add('hidden');
  if (this.key === 'clicker') { 
    timerWrap.classList.remove('hidden'); 
    timerWrap.classList.remove('warning'); 
    // Center timer for Clicker
    timerWrap.classList.remove('right'); 
    timerEl.textContent = Math.ceil(this.game.time); 
  } else { 
    // Hide timer for standalone Fishing and Runner
    timerWrap.classList.add('hidden'); 
    timerWrap.classList.remove('right'); 
  }
    // Show target/current for normal games (use default goals)
    const defaults = { runner: 200, fishing: 60, clicker: 300 };
    if (!this.isAimTrainer){
      if (this.key === 'fishing'){
        // Standalone Fishing: hide center target/current
        if (targetWrap) targetWrap.classList.add('hidden');
      } else if (targetWrap && targetText){
        targetWrap.classList.remove('hidden');
        targetText.textContent = formatTargetText(this.key, { runner: defaults.runner, fishing: defaults.fishing, clicker: defaults.clicker }, 0);
      }
      // Hide compact goal box (requested)
      if (goalWrap) goalWrap.classList.add('hidden');
    } else {
      if (targetWrap) targetWrap.classList.add('hidden');
      if (goalWrap) goalWrap.classList.add('hidden');
    }
    if (backButton) { backButton.classList.add('show'); }
    if (this.is3D) { canvas3D.style.pointerEvents = 'auto'; }

    const targetCanvas = this.is3D ? canvas3D : canvas2D; const otherCanvas = this.is3D ? canvas2D : canvas3D;
    targetCanvas.style.cursor = (this.key === 'clicker' && this.is3D) ? 'none' : 'default'; otherCanvas.style.cursor = 'default';
  };

  GameScene.prototype.startAimTrainerGame = function(){
    const map = { clicker: window.ClickerGame };
    if (aimTrainerStartEl) { aimTrainerStartEl.classList.remove('show'); aimTrainerStartEl.classList.add('hidden'); }
    this.isReady = true; this.gameStarted = true; canvas2D.style.display='none'; canvas3D.style.display='block';
    document.body.style.background = '#0a0a0f'; document.body.classList.add('aim-trainer-mode'); if (aimStatsEl && crosshairEl) { aimStatsEl.classList.add('show'); crosshairEl.classList.add('show'); }
    if (!babylonEngine) { babylonEngine = new BABYLON.Engine(canvas3D, true); window.addEventListener('resize', ()=>babylonEngine.resize()); }
    this.game = new map['clicker'](); babylonScene = this.game.init3D(babylonEngine, canvas3D);
    babylonEngine.runRenderLoop(function(){ if (babylonScene) babylonScene.render(); });
  canvas3D.style.pointerEvents='auto'; canvas3D.style.cursor='none'; hud.classList.remove('hidden'); hud.classList.add('show'); overWrap.classList.add('hidden'); timerWrap.classList.remove('hidden'); timerWrap.classList.remove('warning');
    if (aimTargetWrap) aimTargetWrap.classList.add('hidden');
    // Hide center target/current badge in normal Aim mode
    if (targetWrap) targetWrap.classList.add('hidden');
  };

  GameScene.prototype.onExit = function(){ if (babylonEngine) { babylonEngine.stopRenderLoop(); }
    if (aimTrainerStartEl) { aimTrainerStartEl.classList.remove('show'); aimTrainerStartEl.classList.add('hidden'); }
    if (this.game && typeof this.game.stopAudio === 'function'){ try { this.game.stopAudio(); } catch(e){} }
    if (targetWrap) targetWrap.classList.add('hidden');
    if (goalWrap) goalWrap.classList.add('hidden');
    document.body.classList.remove('aim-trainer-mode'); canvas2D.style.cursor='default'; canvas3D.style.cursor='default'; };

  GameScene.prototype.update = function(dt){
    if (this.isAimTrainer && !this.gameStarted) { return; }
  this.game.update(dt);
  const scNow = this.game.getScore();
  scoreEl.textContent = scNow; const best = Number(localStorage.getItem(this.bestKey) || 0); bestEl.textContent = best;
  // Update target HUD in normal mode
  if (targetWrap && targetText && !this.isAimTrainer && this.key !== 'fishing'){
    const defaults = { runner: 200, fishing: 60, clicker: 300 };
    targetText.textContent = formatTargetText(this.key, { runner: defaults.runner, fishing: defaults.fishing, clicker: defaults.clicker }, scNow);
  }
  if(this.key === 'clicker'){ 
    const timeLeft = Math.ceil(this.game.time); 
    timerEl.textContent = timeLeft; 
    if (timeLeft <= 10 && timeLeft > 0) { timerWrap.classList.add('warning'); } else { timerWrap.classList.remove('warning'); } 
  }
  if (this.isAimTrainer && this.game.getStats){ const stats=this.game.getStats(); if (accuracyEl) accuracyEl.textContent = stats.accuracy + '%'; if (comboEl){ comboEl.textContent = '×' + stats.combo; if (stats.combo>=5){ comboEl.style.color='#ff0066'; comboEl.style.fontSize='1.3rem'; } else if (stats.combo>=3){ comboEl.style.color='#ff6600'; comboEl.style.fontSize='1.2rem'; } else { comboEl.style.color='#ff3366'; comboEl.style.fontSize='1.1rem'; } } if (hitsEl) hitsEl.textContent = stats.hits + '/' + stats.shots; }
  if (this.isAimTrainer){ if (aimScoreEl && this.game.getScore) { try { aimScoreEl.textContent = String(this.game.getScore()); } catch(e){} } if (aimTimeEl && typeof this.game.time === 'number'){ aimTimeEl.textContent = Math.max(0, Math.ceil(this.game.time)) + 's'; } }

    if(this.game.isOver && !this.gameOverTriggered){ this.gameOverTriggered = true; if (this.isAimTrainer){ document.body.classList.remove('aim-trainer-mode'); canvas3D.style.cursor='default'; if (crosshairEl) crosshairEl.classList.remove('show'); 
        // Disable canvas input so left-click acts as normal UI click after time-out
        try { canvas3D.style.pointerEvents = 'none'; if (document.pointerLockElement === canvas3D && document.exitPointerLock){ document.exitPointerLock(); } } catch(e){}
      }
      const sc=this.game.getScore(); if(sc>best) localStorage.setItem(this.bestKey, String(sc)); finalScore.textContent=sc; finalBest.textContent = Math.max(sc, best);
      if (this.isAimTrainer && this.game.getStats && extraStatsEl){ const stats=this.game.getStats(); extraStatsEl.classList.add('show'); if (gameOverTitle) gameOverTitle.textContent='시간 종료!'; if (gameOverMessage) gameOverMessage.textContent='30초 동안의 결과입니다'; if (finalAccuracy) finalAccuracy.textContent = stats.accuracy + '%'; if (finalMaxCombo) finalMaxCombo.textContent = '×' + stats.maxCombo; if (finalShots) finalShots.textContent = stats.shots + '발'; if (finalHits) finalHits.textContent = stats.hits + '발'; } else { if (extraStatsEl) extraStatsEl.classList.remove('show'); if (gameOverTitle) gameOverTitle.textContent='게임 오버'; if (gameOverMessage) gameOverMessage.textContent=''; }
      overWrap.classList.remove('hidden');
      retryBtn.onclick = ()=>{ mgr.set(new GameScene(this.key)); };
      menuBtn.onclick = ()=>{ mgr.set(new MenuScene()); };
    }
  };

  GameScene.prototype.draw = function(){ if (!this.is3D) { this.game.draw(); } };

  // Challenge Scene: orchestrates 3 games across 5 rounds with increasing targets
  function ChallengeScene(){
    this.round = 1; this.order = []; this.idx = -1; this.state = 'init';
    this.currentKey = null; this.game = null; this.timer = 0; this.successes = 0;
    this.targets = window.Challenge.getTargets(this.round-1);
    this.countdown = 0;
  }

  function formatTargetText(key, targets, score){
    if (key==='runner') return `러너 목표: ${targets.runner} | 현재: ${score}`;
    if (key==='fishing') return `낚시 목표: ${targets.fishing} | 현재: ${score}`;
    if (key==='clicker') return `에임 목표: ${targets.clicker} | 현재: ${score}`;
      return `현재: ${score}`; // default (non-challenge) fallback
  if (this.isAimTrainer){ if (aimScoreEl && this.game.getScore) { try { aimScoreEl.textContent = String(this.game.getScore()); } catch(e){} } if (aimTimeEl && typeof this.game.time === 'number'){ aimTimeEl.textContent = Math.max(0, Math.ceil(this.game.time)) + 's'; } }
  }

  ChallengeScene.prototype.shuffleOrder = function(){ this.order = window.Challenge.shuffle(['runner','fishing','clicker']); this.idx = -1; };

  ChallengeScene.prototype.onEnter = function(){
  this.shuffleOrder(); menu.classList.remove('show'); overWrap.classList.add('hidden'); hud.classList.remove('hidden'); hud.classList.add('show');
    backButton && backButton.classList.add('show');
    this.state = 'countdown'; this.countdown = 3.0; this.nextKey(); this.updateCountdownUI(true);
  };

  ChallengeScene.prototype.updateCountdownUI = function(show){
    if (!countdownEl || !countdownNumberEl) return;
    if (show){ countdownEl.classList.remove('hidden'); countdownEl.classList.add('show'); }
    else { countdownEl.classList.add('hidden'); countdownEl.classList.remove('show'); }
  };

  ChallengeScene.prototype.nextKey = function(){ this.idx++; if (this.idx>=this.order.length){ this.round++; if (this.round>window.Challenge.config.rounds){ this.finishChallenge(true); return; } this.targets = window.Challenge.getTargets(this.round-1); this.shuffleOrder(); this.idx=0; }
    this.currentKey = this.order[this.idx]; };

  ChallengeScene.prototype.startCurrentGame = function(){
    // Tear down previous if any
    if (this.game){
      if (this.currentIs3D && babylonEngine){ babylonEngine.stopRenderLoop(); }
      if (this.currentIs3D){ document.body.classList.remove('aim-trainer-mode'); aimStatsEl && aimStatsEl.classList.remove('show'); crosshairEl && crosshairEl.classList.remove('show'); }
      if (typeof this.game.stopAudio === 'function'){ try { this.game.stopAudio(); } catch(e){} }
    }

    const key = this.currentKey; this.timer = 0; this.currentIs3D = (key==='clicker');
    if (this.currentIs3D){
      // Setup 3D Aim Trainer without start overlay
      canvas2D.style.display = 'none'; canvas3D.style.display = 'block'; document.body.style.background = '#0a0a0f';
      ensureBabylon(); this.game = new window.ClickerGame(); babylonScene = this.game.init3D(babylonEngine, canvas3D); babylonEngine.runRenderLoop(function(){ if (babylonScene) babylonScene.render(); });
      document.body.classList.add('aim-trainer-mode'); aimStatsEl && aimStatsEl.classList.add('show'); crosshairEl && crosshairEl.classList.add('show'); canvas3D.style.pointerEvents='auto'; canvas3D.style.cursor='none';
  timerWrap.classList.remove('hidden'); timerWrap.classList.remove('warning'); timerWrap.classList.remove('right');
      // Show 목표 in Aim HUD during Challenge Aim rounds
      if (aimTargetWrap) aimTargetWrap.classList.remove('hidden');
      if (aimTargetEl) aimTargetEl.textContent = String(this.targets.clicker);
      if (goalWrap) goalWrap.classList.add('hidden');
    } else {
      // 2D
      canvas2D.style.display = 'block'; canvas3D.style.display = 'none'; document.body.style.background = '#f7e08b';
      aimStatsEl && aimStatsEl.classList.remove('show'); crosshairEl && crosshairEl.classList.remove('show');
      this.game = (key==='runner') ? new window.RunnerGame() : new window.GameFishing(); this.game.init();
  // Timer only for fishing in challenge
  if (aimTargetWrap) aimTargetWrap.classList.add('hidden');
  // Hide compact goal during Challenge as requested
  if (goalWrap) goalWrap.classList.add('hidden');
  if (key==='fishing'){ 
    timerWrap.classList.remove('hidden'); 
    timerWrap.classList.remove('warning'); 
    // Center timer for fishing in Challenge as well
    timerWrap.classList.remove('right'); 
  } else { 
    timerWrap.classList.add('hidden'); 
    timerWrap.classList.remove('right'); 
  }
    }
    overWrap.classList.add('hidden');
    // Show center target/current only for 2D games; hide for Aim
    if (targetWrap && targetText){
      if (key !== 'clicker') { targetWrap.classList.remove('hidden'); targetText.textContent = formatTargetText(key, this.targets, 0); }
      else { targetWrap.classList.add('hidden'); }
    }
  };

  ChallengeScene.prototype.finishSubGame = function(success){
    // Stop 3D if needed
    if (this.currentIs3D && babylonEngine){ babylonEngine.stopRenderLoop(); }
    if (this.currentIs3D){ document.body.classList.remove('aim-trainer-mode'); aimStatsEl && aimStatsEl.classList.remove('show'); crosshairEl && crosshairEl.classList.remove('show'); }
    if (this.game && typeof this.game.stopAudio === 'function'){ try { this.game.stopAudio(); } catch(e){} }
  if (targetWrap) targetWrap.classList.add('hidden');
  if (aimTargetWrap) aimTargetWrap.classList.add('hidden');
  if (goalWrap) goalWrap.classList.add('hidden');
    if (!success){ this.finishChallenge(false); return; }
    // Prepare next
    this.nextKey(); this.state='countdown'; this.countdown = 3.0; this.updateCountdownUI(true);
  };

  ChallengeScene.prototype.finishChallenge = function(success){
    // Stop any running loops and show game over overlay
    if (babylonEngine){ babylonEngine.stopRenderLoop(); }
    document.body.classList.remove('aim-trainer-mode'); aimStatsEl && aimStatsEl.classList.remove('show'); crosshairEl && crosshairEl.classList.remove('show');
    this.updateCountdownUI(false);
  if (targetWrap) targetWrap.classList.add('hidden');
  if (aimTargetWrap) aimTargetWrap.classList.add('hidden');
  if (goalWrap) goalWrap.classList.add('hidden');
  if (this.game && typeof this.game.stopAudio === 'function'){ try { this.game.stopAudio(); } catch(e){} }
  hud.classList.remove('hidden'); hud.classList.add('show'); overWrap.classList.remove('hidden');
    gameOverTitle && (gameOverTitle.textContent = success ? '챌린지 완료!' : '챌린지 실패');
    gameOverMessage && (gameOverMessage.textContent = success ? `모든 ${window.Challenge.config.rounds}라운드 달성` : '목표를 달성하지 못했습니다');
    finalScore.textContent = this.round-1; finalBest.textContent = Math.max(Number(localStorage.getItem('best_challenge')||0), this.round-1);
    localStorage.setItem('best_challenge', String(this.round-1));
    retryBtn.onclick = ()=>{ mgr.set(new ChallengeScene()); };
    menuBtn.onclick = ()=>{ mgr.set(new MenuScene()); };
    this.state='finished';
  };

  ChallengeScene.prototype.onExit = function(){
    // Hide countdown and center badges
    this.updateCountdownUI(false);
    if (targetWrap) targetWrap.classList.add('hidden');
    if (aimTargetWrap) aimTargetWrap.classList.add('hidden');
    if (goalWrap) goalWrap.classList.add('hidden');
    // Stop any running audio from the current subgame (e.g., Runner BGM)
    if (this.game && typeof this.game.stopAudio === 'function'){
      try { this.game.stopAudio(); } catch(e){}
    }
    // Stop 3D render loop if active
    if (babylonEngine){ babylonEngine.stopRenderLoop(); }
    document.body.classList.remove('aim-trainer-mode');
  };
  // Ensure Aim 목표 hidden when leaving Challenge scene
  

  ChallengeScene.prototype.update = function(dt){
    if (this.state==='finished') return;
    // Countdown phase
    if (this.state==='countdown'){
      this.countdown -= dt; const n = Math.max(1, Math.ceil(this.countdown)); if (countdownNumberEl) countdownNumberEl.textContent = String(n);
      if (this.countdown <= 0){ this.updateCountdownUI(false); this.state='playing'; this.startCurrentGame(); }
      return;
    }
    // Playing current subgame
  const key = this.currentKey; const targets = this.targets; const score = this.game.getScore(); const bestChallenge = Number(localStorage.getItem('best_challenge')||0); bestEl.textContent = bestChallenge;
    this.game.update(dt);
    scoreEl.textContent = score;
    if (targetWrap && targetText){
      if (key !== 'clicker') { targetWrap.classList.remove('hidden'); targetText.textContent = formatTargetText(key, targets, score); }
      else { targetWrap.classList.add('hidden'); }
    }
    if (targetWrap && targetText && this.state==='playing' && key !== 'clicker'){ targetText.textContent = formatTargetText(key, targets, score); }

    if (key==='runner'){
      // Runner has no timer; just wait for score; failure if dead
      if (score >= targets.runner){ this.finishSubGame(true); return; }
      if (this.game.isOver){ this.finishSubGame(false); return; }
    }
    else if (key==='fishing'){
      // Fishing: 30s limit and target score
      this.timer += dt; const timeLeft = Math.max(0, targets.timeFishing - this.timer); timerEl.textContent = Math.ceil(timeLeft); if (timeLeft <= 10 && timeLeft>0){ timerWrap.classList.add('warning'); } else { timerWrap.classList.remove('warning'); }
      if (score >= targets.fishing){ this.finishSubGame(true); return; }
      if (this.timer >= targets.timeFishing){ this.finishSubGame(false); return; }
    }
    else if (key==='clicker'){
      // Aim Trainer: internal time, but also allow early success
      const timeLeft = Math.max(0, this.game.time); timerEl.textContent = Math.ceil(timeLeft); if (timeLeft <= 10 && timeLeft>0){ timerWrap.classList.add('warning'); } else { timerWrap.classList.remove('warning'); }
      if (this.game.getStats){ const stats=this.game.getStats(); if (accuracyEl) accuracyEl.textContent = stats.accuracy + '%'; if (comboEl){ comboEl.textContent = '×' + stats.combo; if (stats.combo>=5){ comboEl.style.color='#ff0066'; comboEl.style.fontSize='1.3rem'; } else if (stats.combo>=3){ comboEl.style.color='#ff6600'; comboEl.style.fontSize='1.2rem'; } else { comboEl.style.color='#ff3366'; comboEl.style.fontSize='1.1rem'; } } if (hitsEl) hitsEl.textContent = stats.hits + '/' + stats.shots; }
      if (aimScoreEl){ aimScoreEl.textContent = String(score); }
      if (aimTimeEl){ aimTimeEl.textContent = Math.max(0, Math.ceil(this.game.time)) + 's'; }
      if (score >= targets.clicker){ this.finishSubGame(true); return; }
      if (this.game.isOver){ this.finishSubGame(score >= targets.clicker); return; }
    }
  };

  ChallengeScene.prototype.draw = function(){ if (!this.currentIs3D && this.game && this.state==='playing'){ this.game.draw(); } };

  function MenuScene(){}
  MenuScene.prototype.onEnter = function(){ if (babylonEngine) { babylonEngine.stopRenderLoop(); }
    hud.classList.add('hidden'); hud.classList.remove('show'); menu.classList.add('show'); overWrap.classList.add('hidden'); if (timerWrap) { timerWrap.classList.add('hidden'); timerWrap.classList.remove('warning'); }
    if (targetWrap) { targetWrap.classList.add('hidden'); }
    if (goalWrap) { goalWrap.classList.add('hidden'); }
    if (backButton) { backButton.classList.remove('show'); } if (aimStatsEl && crosshairEl) { aimStatsEl.classList.remove('show'); crosshairEl.classList.remove('show'); }
    document.body.style.background = '#f7e08b'; document.body.classList.remove('aim-trainer-mode'); canvas2D.style.display='block'; canvas3D.style.display='none'; canvas2D.style.cursor='default'; };
  MenuScene.prototype.update = function(){};
  MenuScene.prototype.draw = function(){ E.clear('#fff6cf'); };

  cards.forEach(btn=>{ btn.addEventListener('click', ()=>{ const key = btn.getAttribute('data-game'); if (key==='challenge'){ mgr.set(new ChallengeScene()); } else { mgr.set(new GameScene(key)); } }); });
  if (backButton) { backButton.addEventListener('click', ()=>{ mgr.set(new MenuScene()); }); }

  mgr.set(new MenuScene());
  E.loop((dt)=>{ mgr.update(dt); mgr.draw(); });
})();
