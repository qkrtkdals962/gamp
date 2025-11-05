(function(){
  const canvas = document.getElementById('game');
  const startBtn = document.getElementById('startBtn');

  let started = false;
  let E, game;

  function startGame(){
    if (started) return;
    started = true;

    // 엔진/게임 초기화
    E = window.Engine;
    if (!E || !window.SimpleFishing){
      alert('엔진 또는 게임 로드 실패: engine.js / games.js 경로를 확인하세요.');
      return;
    }
    E.init(canvas);
    game = new window.SimpleFishing();
    game.reset();

    // 루프 시작
    E.loop((dt)=>{
      game.update(dt);
      game.draw();
    });

    // 버튼 숨김
    if (startBtn) startBtn.style.display = 'none';
  }

  // 버튼으로 시작
  if (startBtn) startBtn.addEventListener('click', startGame);

  // 혹시 버튼이 가려지거나 못 눌렀을 때를 위한 백업: 캔버스 첫 클릭으로 시작
  canvas.addEventListener('mousedown', ()=>{
    if (!started) startGame();
  }, { once:true });
})();
