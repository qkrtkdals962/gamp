(function(){
  const canvas = document.getElementById('game');
  const startBtn = document.getElementById('startBtn');

  let started = false;
  let E, game;

  function startGame(){
    if (started) return;
    started = true;

    E = window.Engine;
    if (!E || !window.GameFishing){
      alert('로드 실패: js/engine.js 또는 js/games.js 경로 확인');
      return;
    }

    E.init(canvas);
    game = new window.GameFishing();

    E.loop((dt)=>{
      game.update(dt);
      game.draw();
    });

    if (startBtn) startBtn.style.display = 'none';
  }

  // 버튼으로 시작
  if (startBtn) startBtn.addEventListener('click', startGame);
  // 백업: 캔버스 첫 클릭으로도 시작
  canvas.addEventListener('mousedown', ()=>{
    if (!started) startGame();
  }, { once:true });
})();
