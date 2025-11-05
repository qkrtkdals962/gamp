// 규칙: 좌클릭으로 캐스팅 → 1~10초 랜덤 후 '입질' → 좌클릭 성공(획득) / 놓치면 실패
(function(){
  const E = window.Engine;

  function SimpleFishing(){
    this.state = 'ready'; // ready|casted|bite|caught|miss
    this.timer = 0;       // 대기/입질 남은 시간
    this.score = 0;

    // 연출용
    this.rod = { x: E.width/2, y: 120 };
    this.bobber = { x: E.width/2, y: 220, bob: 0 };
    this.lineTo = { x: this.bobber.x, y: this.bobber.y };
  }

  SimpleFishing.prototype.reset = function(){
    this.state='ready';
    this.timer=0;
    this.bobber.x = E.width/2;
    this.bobber.y = 220;
    this.lineTo.x = this.bobber.x;
    this.lineTo.y = this.bobber.y;
  };

  SimpleFishing.prototype.update = function(dt){
    // 리셋 키
    if(E.keys.has('r')){ this.score=0; this.reset(); }

    // 클릭 에지
    const clicked = E.consumeClick();

    // 상태 머신
    if(this.state==='ready'){
      if(clicked){
        // 캐스팅 시작 → 착수 지점 랜덤 + 대기시간 랜덤
        this.bobber.x = Math.round(60 + Math.random()*(E.width-120));
        this.bobber.y = 260 + Math.random()*260;
        this.lineTo.x = this.bobber.x; this.lineTo.y = this.bobber.y;
        this.timer = 1 + Math.random()*9; // 1~10초
        this.state = 'casted';
      }
    }
    else if(this.state==='casted'){
      this.timer -= dt;
      if(this.timer <= 0){
        this.state = 'bite';
        this.timer = 1.2; // 입질 유지시간 (잡을 수 있는 창)
      }
    }
    else if(this.state==='bite'){
      this.timer -= dt;
      if(clicked){
        this.state='caught';
        this.timer = 0.9; // 결과 보여주는 시간
        this.score += 1;
      }else if(this.timer<=0){
        this.state='miss';
        this.timer=0.9;
      }
    }
    else if(this.state==='caught' || this.state==='miss'){
      this.timer -= dt;
      if(this.timer<=0){ this.reset(); }
    }

    // 찌 흔들림(연출)
    this.bobber.bob += dt*6;
  };

  SimpleFishing.prototype.draw = function(){
    const c=E.ctx; E.clear('#0b1220');

    // 물/수면
    const waterTop = 180;
    c.fillStyle='#0f213a'; c.fillRect(0,waterTop,E.width,E.height-waterTop);
    c.strokeStyle='rgba(180,220,255,.35)'; c.lineWidth=2; c.beginPath();
    for(let x=0;x<=E.width;x+=8){
      const y = waterTop + Math.sin((x+performance.now()*0.08)*0.02)*3;
      if(x===0) c.moveTo(x,y); else c.lineTo(x,y);
    }
    c.stroke();

    // 낚싯대
    c.strokeStyle = '#b58b56'; c.lineWidth = 4; c.beginPath();
    const rx = this.rod.x, ry=this.rod.y;
    c.moveTo(rx-120, ry-40); c.quadraticCurveTo(rx-30, ry-60, rx, ry); c.stroke();

    // 라인
    c.strokeStyle = '#bcd0ff'; c.lineWidth=1.5; c.beginPath();
    c.moveTo(rx, ry); c.quadraticCurveTo(this.lineTo.x-20, this.lineTo.y-40, this.lineTo.x, this.lineTo.y); c.stroke();

    // 찌
    const bob = Math.sin(this.bobber.bob)*2;
    let bx=this.bobber.x, by=this.bobber.y + bob;
    if(this.state==='bite'){ by += Math.sin(this.bobber.bob*6)*4; }
    c.fillStyle='#ff6058'; c.beginPath(); c.arc(bx,by,8,0,Math.PI*2); c.fill();
    c.fillStyle='#fff'; c.beginPath(); c.arc(bx,by-3,4,0,Math.PI*2); c.fill();

    // HUD
    E.drawText(`점수: ${this.score}`, 12, 12, '#cfe6ff', 16);
    const msg = (
      this.state==='ready'  ? '좌클릭: 캐스팅' :
      this.state==='casted' ? '입질 대기 중...' :
      this.state==='bite'   ? '입질! 지금 클릭하면 잡습니다' :
      this.state==='caught' ? '잡았다! 곧 다음 캐스팅' :
      this.state==='miss'   ? '놓쳤다... 곧 다음 캐스팅' : ''
    );
    E.drawText(msg, 12, 36, '#9dc1ff', 14);
  };

  window.SimpleFishing = SimpleFishing;
})();
