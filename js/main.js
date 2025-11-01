(function(){
  const canvas = document.getElementById('gameCanvas');
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

  const menu = document.getElementById('menu');
  const cards = menu.querySelectorAll('.card');

  const E = window.Engine; E.init(canvas);

  const mgr = new window.SceneManager();

  // Game scene wrapper to connect HUD + selected minigame
  function GameScene(gameKey){
    this.key = gameKey; this.game = null; this.bestKey = 'best_' + gameKey;
  }
  GameScene.prototype.onEnter = function(){
    const map = { runner: window.Games.RunnerGame, catcher: window.Games.CatcherGame, clicker: window.Games.ClickerGame };
    this.game = new map[this.key]();
    this.game.init();

    menu.classList.remove('show');
    hud.classList.remove('hidden');
    overWrap.classList.add('hidden');
    timerWrap.classList.toggle('hidden', this.key!=='clicker');
  };
  GameScene.prototype.update = function(dt){
    // global back to menu
    if(E.keys.has('r')){ mgr.set(new MenuScene()); return; }

    this.game.update(dt);
    // HUD
    scoreEl.textContent = this.game.getScore();
    const best = Number(localStorage.getItem(this.bestKey) || 0);
    bestEl.textContent = best;
    if(this.key==='clicker') timerEl.textContent = Math.ceil(this.game.time);

    if(this.game.isOver){
      const sc = this.game.getScore();
      if(sc>best) localStorage.setItem(this.bestKey, String(sc));
      finalScore.textContent = sc;
      finalBest.textContent = Math.max(sc, best);
      overWrap.classList.remove('hidden');
      // simple restart on click
      retryBtn.onclick = ()=>{ this.game.init(); overWrap.classList.add('hidden'); };
      menuBtn.onclick = ()=>{ mgr.set(new MenuScene()); };
    }
  };
  GameScene.prototype.draw = function(){ this.game.draw(); };

  // Menu scene: uses overlay buttons
  function MenuScene(){}
  MenuScene.prototype.onEnter = function(){
    hud.classList.add('hidden');
    menu.classList.add('show');
  };
  MenuScene.prototype.update = function(){ /* no-op */ };
  MenuScene.prototype.draw = function(){ E.clear('#fff6cf'); E.drawText('게임을 선택하세요', 240, 340, '#3a2f0b', 18, 'center'); };

  // wire menu buttons
  cards.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const key = btn.getAttribute('data-game');
      mgr.set(new GameScene(key));
    });
  });

  mgr.set(new MenuScene());

  // main loop
  E.loop((dt)=>{
    mgr.update(dt);
    mgr.draw();
  });
})();
