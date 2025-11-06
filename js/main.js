(function(){
  const canvas = document.getElementById('game');
  const startBtn = document.getElementById('startBtn');

  let started = false;
  let E, game;

  // === 오디오 설정 ===
  const oceanBgm = new Audio('sound/ocean.mp3');
  oceanBgm.loop = true;
  oceanBgm.volume = 0.4;

  const castingLoop = new Audio('sound/casting.wav');
  castingLoop.loop = true;
  castingLoop.volume = 0.6;

  function playCastingLoop() {
    if (castingLoop.paused) {
      castingLoop.currentTime = 0;
      castingLoop.play().catch(()=>{});
    }
  }
  function stopCastingLoop() {
    castingLoop.pause();
    castingLoop.currentTime = 0;
  }

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

    // 배경음 재생
    oceanBgm.play().catch(()=>{});

    E.loop((dt)=>{
      const prevState = game.state;
      game.update(dt);
      game.draw();

      // state 변화 감지해서 효과음 제어
      const st = game.state;
      if (st === 'cast_timing' && prevState !== 'cast_timing') {
        playCastingLoop();
      } else if (
        (st === 'caught' || st === 'miss' || st === 'ready') &&
        (prevState === 'minigame' || prevState === 'wait' || prevState === 'cast_timing')
      ) {
        stopCastingLoop();
      }
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
