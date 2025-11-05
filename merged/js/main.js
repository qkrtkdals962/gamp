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
  const extraStatsEl = document.getElementById('extraStats');
  const finalAccuracy = document.getElementById('finalAccuracy');
  const finalMaxCombo = document.getElementById('finalMaxCombo');
  const finalShots = document.getElementById('finalShots');
  const finalHits = document.getElementById('finalHits');
  const gameOverTitle = document.getElementById('gameOverTitle');
  const gameOverMessage = document.getElementById('gameOverMessage');

  const crosshairEl = document.getElementById('crosshair');
  const aimTrainerStartEl = document.getElementById('aimTrainerStart');
  const aimTrainerPlayBtn = document.getElementById('aimTrainerPlayBtn');
  const backButton = document.getElementById('backButton');

  const menu = document.getElementById('menu');
  const cards = menu.querySelectorAll('.card');

  const E = window.Engine; E.init(canvas2D);
  const mgr = new window.SceneManager();

  let babylonEngine = null; let babylonScene = null;

  function GameScene(gameKey){
    this.key = gameKey; this.game = null; this.bestKey = 'best_' + gameKey;
    this.is3D = (gameKey === 'clicker'); this.isAimTrainer = this.is3D;
    this.gameOverTriggered = false; this.isReady = !this.isAimTrainer; this.gameStarted = false;
  }

  GameScene.prototype.onEnter = function(){
  const map = { runner: window.RunnerGame, clicker: window.ClickerGame, fishing: window.GameFishing };

    if (babylonEngine) { babylonEngine.stopRenderLoop(); }

    if (this.isAimTrainer) {
      if (aimTrainerStartEl) { aimTrainerStartEl.classList.remove('hidden'); aimTrainerStartEl.classList.add('show'); }
      menu.classList.remove('show');
      canvas2D.style.display = 'none'; canvas3D.style.display = 'none';
      document.body.style.background = '#0a0a0f';
      if (aimTrainerPlayBtn) { aimTrainerPlayBtn.onclick = () => { this.startAimTrainerGame(); }; }
      if (backButton) { backButton.classList.add('show'); }
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

    menu.classList.remove('show'); hud.classList.remove('hidden'); overWrap.classList.add('hidden');
  if (this.key === 'clicker') { timerWrap.classList.remove('hidden'); timerWrap.classList.remove('warning'); } else { timerWrap.classList.add('hidden'); }
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
    canvas3D.style.pointerEvents='auto'; canvas3D.style.cursor='none'; hud.classList.remove('hidden'); overWrap.classList.add('hidden'); timerWrap.classList.remove('hidden'); timerWrap.classList.remove('warning');
  };

  GameScene.prototype.onExit = function(){ if (babylonEngine) { babylonEngine.stopRenderLoop(); }
    if (aimTrainerStartEl) { aimTrainerStartEl.classList.remove('show'); aimTrainerStartEl.classList.add('hidden'); }
    document.body.classList.remove('aim-trainer-mode'); canvas2D.style.cursor='default'; canvas3D.style.cursor='default'; };

  GameScene.prototype.update = function(dt){
    if (this.isAimTrainer && !this.gameStarted) { return; }
    this.game.update(dt);
    scoreEl.textContent = this.game.getScore(); const best = Number(localStorage.getItem(this.bestKey) || 0); bestEl.textContent = best;
  if(this.key === 'clicker'){ const timeLeft = Math.ceil(this.game.time); timerEl.textContent = timeLeft; if (timeLeft <= 10 && timeLeft > 0) { timerWrap.classList.add('warning'); } else { timerWrap.classList.remove('warning'); } }
    if (this.isAimTrainer && this.game.getStats){ const stats=this.game.getStats(); if (accuracyEl) accuracyEl.textContent = stats.accuracy + '%'; if (comboEl){ comboEl.textContent = '×' + stats.combo; if (stats.combo>=5){ comboEl.style.color='#ff0066'; comboEl.style.fontSize='1.3rem'; } else if (stats.combo>=3){ comboEl.style.color='#ff6600'; comboEl.style.fontSize='1.2rem'; } else { comboEl.style.color='#ff3366'; comboEl.style.fontSize='1.1rem'; } } if (hitsEl) hitsEl.textContent = stats.hits + '/' + stats.shots; }

    if(this.game.isOver && !this.gameOverTriggered){ this.gameOverTriggered = true; if (this.isAimTrainer){ document.body.classList.remove('aim-trainer-mode'); canvas3D.style.cursor='default'; if (crosshairEl) crosshairEl.classList.remove('show'); }
      const sc=this.game.getScore(); if(sc>best) localStorage.setItem(this.bestKey, String(sc)); finalScore.textContent=sc; finalBest.textContent = Math.max(sc, best);
      if (this.isAimTrainer && this.game.getStats && extraStatsEl){ const stats=this.game.getStats(); extraStatsEl.classList.add('show'); if (gameOverTitle) gameOverTitle.textContent='시간 종료!'; if (gameOverMessage) gameOverMessage.textContent='30초 동안의 결과입니다'; if (finalAccuracy) finalAccuracy.textContent = stats.accuracy + '%'; if (finalMaxCombo) finalMaxCombo.textContent = '×' + stats.maxCombo; if (finalShots) finalShots.textContent = stats.shots + '발'; if (finalHits) finalHits.textContent = stats.hits + '발'; } else { if (extraStatsEl) extraStatsEl.classList.remove('show'); if (gameOverTitle) gameOverTitle.textContent='게임 오버'; if (gameOverMessage) gameOverMessage.textContent=''; }
      overWrap.classList.remove('hidden');
      retryBtn.onclick = ()=>{ mgr.set(new GameScene(this.key)); };
      menuBtn.onclick = ()=>{ mgr.set(new MenuScene()); };
    }
  };

  GameScene.prototype.draw = function(){ if (!this.is3D) { this.game.draw(); } };

  function MenuScene(){}
  MenuScene.prototype.onEnter = function(){ if (babylonEngine) { babylonEngine.stopRenderLoop(); }
    hud.classList.add('hidden'); menu.classList.add('show'); overWrap.classList.add('hidden'); if (timerWrap) { timerWrap.classList.add('hidden'); timerWrap.classList.remove('warning'); }
    if (backButton) { backButton.classList.remove('show'); } if (aimStatsEl && crosshairEl) { aimStatsEl.classList.remove('show'); crosshairEl.classList.remove('show'); }
    document.body.style.background = '#f7e08b'; document.body.classList.remove('aim-trainer-mode'); canvas2D.style.display='block'; canvas3D.style.display='none'; canvas2D.style.cursor='default'; };
  MenuScene.prototype.update = function(){};
  MenuScene.prototype.draw = function(){ E.clear('#fff6cf'); E.drawText('게임을 선택하세요', 240, 340, '#3a2f0b', 18, 'center'); };

  cards.forEach(btn=>{ btn.addEventListener('click', ()=>{ const key = btn.getAttribute('data-game'); mgr.set(new GameScene(key)); }); });
  if (backButton) { backButton.addEventListener('click', ()=>{ mgr.set(new MenuScene()); }); }

  mgr.set(new MenuScene());
  E.loop((dt)=>{ mgr.update(dt); mgr.draw(); });
})();
