(function(){
  const E = window.Engine;

  // 난이도/보상은 깊이에 따라 스케일
  function depthToConfig(depth01){
    // 0~1 범위(얕음→깊음). 깊을수록 가치↑, 난이도↑
    const rarity = Math.round(5 + depth01*15);          // 점수
    const biteWait = 0.7 + (1.6 - depth01*0.9)*Math.random(); // 입질까지 대기(가볍게 랜덤)
    const fishSpeed = 80 + depth01*140;                 // 물고기 상하 속도
    const barSize = 120 - depth01*40;                   // 플레이어 바 높이(깊을수록 작게)
    const upAccel = 520;                                 // 바 올릴 때 가속
    const gravity = 700;                                 // 바 내릴 때 중력
    const fillRate = 0.65;                               // 겹칠 때 게이지 차는 속도 (/s)
    const drainRate = 0.55;                              // 겹치지 않으면 빠지는 속도 (/s)
    return { rarity, biteWait, fishSpeed, barSize, upAccel, gravity, fillRate, drainRate };
  }

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  function GameFishing(){
    // 상태
    this.state = 'ready'; // ready | charge | wait | minigame | caught | miss
    this.score = 0;

    // 캐스팅(깊이) 게이지
    this.charge = 0;            // 0~1, 마우스 누르면 상승
    this.chargeDir = 1;         // (옵션) 핑퐁 원하면 사용

    // 환경
    this.waterTop = 180;

    // 캐스팅 결과(깊이/설정치)
    this.depth01 = 0;           // 0~1
    this.cfg = depthToConfig(0);
    this.waitTimer = 0;

    // 미니게임 상태
    this.lane = { x: E.width*0.5, top: this.waterTop+30, bottom: E.height-60 };
    this.bar = {
      y: 0, vy: 0, h: 120
    };
    this.fish = {
      y: 0, vy: 0, target: 0, spd: 120, t: 0
    };
    this.catchMeter = 0; // 0~1
  }

  GameFishing.prototype.resetRound = function(){
    this.state = 'ready';
    this.charge = 0;
  };

  GameFishing.prototype.update = function(dt){
    if(E.keys.has('r')){
      this.score = 0;
      this.resetRound();
    }

    const clicked = E.consumeClick();
    const mouseDown = E.mouse.down;

    // 물 배경/연출용 위상
    this._waveT = (this._waveT||0) + dt;

    // 상태 머신
    if(this.state==='ready'){
      // 눌러서 깊이 게이지 채우기 시작
      if(clicked || mouseDown){
        this.state='charge';
        this.charge = 0;
      }
    }
    else if(this.state==='charge'){
      // 길게 누를수록 깊어짐
      if(mouseDown){
        this.charge += dt * 0.8; // 1.25초쯤에 풀게이지
        this.charge = clamp(this.charge, 0, 1);
      }else{
        // 떼는 순간 캐스팅 확정
        this.depth01 = this.charge; // 0~1
        this.cfg = depthToConfig(this.depth01);
        this.waitTimer = this.cfg.biteWait;

        // 찌 위치(깊이 감상용)
        this.castX = Math.round(60 + Math.random()*(E.width-120));
        this.castY = this.waterTop + 40 + this.depth01*(E.height - this.waterTop - 120);

        this.state='wait';
      }
    }
    else if(this.state==='wait'){
      this.waitTimer -= dt;
      if(this.waitTimer<=0){
        // 미니게임 세팅
        const ln = this.lane;
        this.bar.h = this.cfg.barSize;
        this.bar.y = (ln.top + ln.bottom - this.bar.h)/2;
        this.bar.vy = 0;

        this.fish.y = ln.top + Math.random()*(ln.bottom - ln.top);
        this.fish.vy = 0;
        this.fish.spd = this.cfg.fishSpeed;
        this.fish.target = this.fish.y;
        this.catchMeter = 0.35; // 시작치 약간

        this.state='minigame';
      }
    }
    else if(this.state==='minigame'){
      const ln = this.lane;

      // 플레이어 바: 누르면 위로 가속, 떼면 중력
      if(mouseDown){
        this.bar.vy -= this.cfg.upAccel * dt;
      }else{
        this.bar.vy += this.cfg.gravity * dt;
      }
      // 감속
      this.bar.vy *= 0.98;
      this.bar.y += this.bar.vy * dt;
      this.bar.y = clamp(this.bar.y, ln.top, ln.bottom - this.bar.h);

      // 물고기: 목표 높이를 랜덤하게 갱신하며 따라감(난이도=속도)
      this.fish.t += dt;
      if(this.fish.t > 0.6 + Math.random()*0.9){
        this.fish.t = 0;
        this.fish.target = ln.top + Math.random()*(ln.bottom - ln.top);
      }
      const dir = Math.sign(this.fish.target - this.fish.y);
      this.fish.vy = dir * this.fish.spd;
      // 약간의 소음
      this.fish.y += (this.fish.vy * dt) + (Math.sin(performance.now()*0.004)*12*dt);
      this.fish.y = clamp(this.fish.y, ln.top+6, ln.bottom-6);

      // 겹침 체크 (바가 물고기 중심을 품으면 채워짐)
      const inBar = (this.fish.y >= this.bar.y && this.fish.y <= this.bar.y + this.bar.h);
      if(inBar){
        this.catchMeter += this.cfg.fillRate * dt;
      }else{
        this.catchMeter -= this.cfg.drainRate * dt;
      }
      this.catchMeter = clamp(this.catchMeter, 0, 1);

      if(this.catchMeter >= 1){
        this.state='caught';
        this.score += this.cfg.rarity; // 깊을수록 점수 큼
        this._resultTimer = 1.0;
      }else if(this.catchMeter <= 0){
        this.state='miss';
        this._resultTimer = 1.0;
      }
    }
    else if(this.state==='caught' || this.state==='miss'){
      this._resultTimer -= dt;
      if(this._resultTimer<=0){
        this.resetRound();
      }
    }
  };

  GameFishing.prototype.draw = function(){
    const c=E.ctx; E.clear('#0b1220');

    // 물/수면
    const waterTop = this.waterTop;
    c.fillStyle='#0f213a'; c.fillRect(0,waterTop,E.width,E.height-waterTop);
    c.strokeStyle='rgba(180,220,255,.35)'; c.lineWidth=2; c.beginPath();
    for(let x=0;x<=E.width;x+=8){
      const y = waterTop + Math.sin((x+performance.now()*0.08)*0.02)*3;
      if(x===0) c.moveTo(x,y); else c.lineTo(x,y);
    }
    c.stroke();

    // 점수
    E.drawText(`점수: ${this.score}`, 12, 12, '#cfe6ff', 16);

    // 상태별 UI ----------------------------------------------------
    if(this.state==='ready'){
      E.drawText('마우스를 꾹 눌러 깊이를 정하세요', 12, 36, '#9dc1ff', 14);
    }

    if(this.state==='charge'){
      E.drawText('떼면 캐스팅 (깊을수록 보상↑·난이도↑)', 12, 36, '#9dc1ff', 14);
      // 왼쪽 깊이 게이지
      this.drawDepthGauge(24, waterTop+20, 16, E.height-waterTop-80, this.charge);
    }

    if(this.state==='wait'){
      E.drawText('입질 대기 중...', 12, 36, '#9dc1ff', 14);
      // 캐스팅 위치에 찌
      this.drawBobber(this.castX, this.castY);
      // 깊이 게이지 (고정 표시)
      this.drawDepthGauge(24, waterTop+20, 16, E.height-waterTop-80, this.depth01);
    }

    if(this.state==='minigame'){
      this.drawFishingMini();
    }

    if(this.state==='caught'){
      E.drawText('잡았다! 점수 +' + this.cfg.rarity, 12, 36, '#9dc1ff', 14);
      this.drawBobber(this.castX, this.castY);
      this.drawDepthGauge(24, waterTop+20, 16, E.height-waterTop-80, this.depth01);
    }

    if(this.state==='miss'){
      E.drawText('놓쳤다...', 12, 36, '#9dc1ff', 14);
      this.drawBobber(this.castX, this.castY);
      this.drawDepthGauge(24, waterTop+20, 16, E.height-waterTop-80, this.depth01);
    }
  };

  GameFishing.prototype.drawBobber = function(x,y){
    const c=E.ctx;
    // 라인
    c.strokeStyle='rgba(188,208,255,.9)';
    c.lineWidth=1.5;
    c.beginPath();
    c.moveTo(E.width*0.5, this.waterTop-10);
    c.quadraticCurveTo(x-20, this.waterTop+20, x, y);
    c.stroke();
    // 찌
    c.fillStyle='#ff6058'; c.beginPath(); c.arc(x,y,8,0,Math.PI*2); c.fill();
    c.fillStyle='#fff'; c.beginPath(); c.arc(x,y-3,4,0,Math.PI*2); c.fill();
  };

  GameFishing.prototype.drawDepthGauge = function(x,y,w,h,val01){
    const c=E.ctx;
    // 테두리
    c.fillStyle='rgba(255,255,255,0.12)';
    c.fillRect(x, y, w, h);
    // 채움(아래에서 위로)
    const filled = h * val01;
    c.fillStyle='#9dc1ff';
    c.fillRect(x, y + (h-filled), w, filled);
    // 눈금
    c.strokeStyle='rgba(255,255,255,0.25)'; c.lineWidth=1;
    c.beginPath();
    for(let i=0;i<=5;i++){
      const yy = y + h*i/5;
      c.moveTo(x-6, yy); c.lineTo(x+w+6, yy);
    }
    c.stroke();
  };

  GameFishing.prototype.drawFishingMini = function(){
    const c=E.ctx, ln=this.lane;

    // 레인 배경
    c.fillStyle='rgba(255,255,255,0.07)';
    c.fillRect(ln.x-70, ln.top, 140, ln.bottom - ln.top);

    // 물고기
    c.fillStyle='#79c2ff';
    c.beginPath(); c.arc(ln.x+25, this.fish.y, 10, 0, Math.PI*2); c.fill();
    // 꼬리
    c.beginPath();
    c.moveTo(ln.x+15, this.fish.y);
    c.lineTo(ln.x+5, this.fish.y-6);
    c.lineTo(ln.x+5, this.fish.y+6);
    c.closePath(); c.fillStyle='#5aa9e6'; c.fill();

    // 플레이어 바
    c.fillStyle='#ffd166';
    c.fillRect(ln.x-55, this.bar.y, 110, this.bar.h);

    // 캐치 게이지 상단
    const gx = 40, gy = this.waterTop - 30, gw = E.width-80, gh = 8;
    c.fillStyle='rgba(255,255,255,0.12)'; c.fillRect(gx,gy,gw,gh);
    c.fillStyle='#a3d6a6'; c.fillRect(gx,gy,gw*this.catchMeter,gh);

    // 안내
    E.drawText('입질! 클릭 유지로 바를 올려 물고기를 겹치게 유지', 12, 36, '#9dc1ff', 14);
  };

  window.GameFishing = GameFishing;
})();
