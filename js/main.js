(function(){
  const canvas = document.getElementById('game');
  const E = window.Engine; E.init(canvas);

  const game = new window.SimpleFishing();
  game.reset();

  E.loop((dt)=>{
    game.update(dt);
    game.draw();
  });
})();
