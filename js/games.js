(function(){
  const E = window.Engine;
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));

  function depthToConfig(depth01){
    const rarity     = Math.round(5 + depth01*15);
    const biteWait   = 0.7 + (1.6 - depth01*0.9)*Math.random();
    const fishSpeed  = 80 + depth01*140;
    const barSize    = 120 - depth01*40;
    const fillRate   = 0.65;
    const drainRate  = 0.55;
    const barVMax    = 260 + depth01*180;
    const wheelStep  = 70 + depth01*55;
    const friction   = 2.2;
    return { rarity, biteWait, fishSpeed, barSize, fillRate, drainRate, barVMax, wheelStep, friction };
  }

  function GameFishing(){
    this.state = 'ready';
    this.score = 0;
    this.charge = 0;
    this.waterTop = 180;

    this.depth01 = 0;
    this.cfg = depthToConfig(0);
    this.waitTimer = 0;

    this.lane = { x: E.width*0.5, top: this.waterTop+30, bottom: E.height-60 };
    this.bar = { y: 0, h: 120, v: 0 };
    this.fish = { y: 0, vy: 0, target: 0, spd: 120, t: 0 };

    this.catchMeter = 0;
    this.grace = 0;
    this._waveT = 0;
  }

  GameFishing.prototype.resetRound = function(){
    this.state='ready';
    this.charge=0;
  };

  GameFishing.prototype._confirmCast = function(){
    this.depth01 = clamp(this.charge, 0.02, 1);
    this.cfg = depthToConfig(this.depth01);
    this.waitTimer = this.cfg.biteWait;
    this.castX = Math.round(60 + Math.random()*(E.width-120));
    this.castY = this.waterTop + 40 + this.depth01*(E.height - this.waterTop - 120);
    this.state='wait';
  };

  GameFishing.prototype.update = function(dt){
    if(E.keys.has('r')){ this.score=0; this.resetRound(); }

    const clicked   = E.consumeClick();
    const mouseDown = E.mouse.down;
    const wheel     = E.peekWheel();

    this._waveT += dt;

    // === ready 상태 ===
    if(this.state==='ready'){
      if(Math.abs(wheel) > 0){
        this.state='charge';
        // 방향 반전: 휠 내림(δY>0) → 깊이 증가
        this.charge = clamp(this.charge + Math.sign(wheel)*0.03, 0, 1);
      }else if(clicked || mouseDown){
        this.state='charge';
        this.charge = 0;
      }
    }
    // === charge 상태 ===
    else if(this.state==='charge'){
      if(mouseDown) this.charge = clamp(this.charge + dt*0.8, 0, 1);
      if(Math.abs(wheel) > 0){
        // 반전된 방향
        this.charge = clamp(this.charge + Math.sign(wheel)*0.03, 0, 1);
      }
      if(E.keys.has(' ') || E.keys.has('enter')){
        this._confirmCast();
      }
    }
    // === wait 상태 ===
    else if(this.state==='wait'){
      this.waitTimer -= dt;
      if(this.waitTimer<=0){
        const ln=this.lane;
        this.bar.h = this.cfg.barSize;
        this.bar.y = (ln.top + ln.bottom - this.bar.h)/2;
        this.bar.v = 0;

        this.fish.y = ln.top + Math.random()*(ln.bottom - ln.top);
        this.fish.spd = this.cfg.fishSpeed;
        this.fish.t = 0; this.fish.target = this.fish.y;

        this.catchMeter = 0.35;
        this.grace = 5.0;
        this.state='minigame';
      }
    }
    // === minigame ===
    else if(this.state==='minigame'){
      const ln=this.lane;

      // 휠 방향 반전: 휠 내림(δY>0) → 아래로 이동(+v)
      if(Math.abs(wheel) > 0){
        const notch = (wheel > 0) ? +1 : -1;
        this.bar.v += notch * this.cfg.wheelStep;
        this.bar.v = clamp(this.bar.v, -this.cfg.barVMax, this.cfg.barVMax);
      }else{
        const k = this.cfg.friction;
        this.bar.v *= Math.exp(-k * dt);
        if(Math.abs(this.bar.v) < 5) this.bar.v = 0;
      }

      this.bar.y += this.bar.v * dt;
      if(this.bar.y < ln.top){ this.bar.y = ln.top; this.bar.v = 0; }
      if(this.bar.y > ln.bottom - this.bar.h){ this.bar.y = ln.bottom - this.bar.h; this.bar.v = 0; }

      // 물고기 이동
      this.fish.t += dt;
      if(this.fish.t > 0.6 + Math.random()*0.9){
        this.fish.t = 0;
        this.fish.target = ln.top + Math.random()*(ln.bottom - ln.top);
      }
      const dir = Math.sign(this.fish.target - this.fish.y);
      this.fish.y += (dir * this.fish.spd * dt) + (Math.sin(performance.now()*0.004)*12*dt);
      this.fish.y = clamp(this.fish.y, ln.top+6, ln.bottom-6);

      // 캐치 게이지
      const inBar = (this.fish.y >= this.bar.y && this.fish.y <= this.bar.y + this.bar.h);
      if(inBar){
        this.catchMeter += this.cfg.fillRate * dt;
      }else{
        if(this.grace > 0){
          this.catchMeter = Math.max(0.15, this.catchMeter - this.cfg.drainRate * dt * 0.5);
        }else{
          this.catchMeter -= this.cfg.drainRate * dt;
        }
      }
      this.catchMeter = clamp(this.catchMeter, 0, 1);
      if(this.grace > 0) this.grace -= dt;

      if(this.catchMeter >= 1){
        this.state='caught';
        this.score += this.cfg.rarity;
        this._resultTimer = 1.0;
      }else if(this.catchMeter <= 0 && this.grace <= 0){
        this.state='miss';
        this._resultTimer = 1.0;
      }
    }
    // === 결과 ===
    else if(this.state==='caught' || this.state==='miss'){
      this._resultTimer -= dt;
      if(this._resultTimer<=0) this.resetRound();
    }
  };

  GameFishing.prototype.draw = function(){
    const c=E.ctx; E.clear('#0b1220');
    const waterTop = this.waterTop;
    c.fillStyle='#0f213a'; c.fillRect(0,waterTop,E.width,E.height-waterTop);
    c.strokeStyle='rgba(180,220,255,.35)'; c.lineWidth=2; c.beginPath();
    for(let x=0;x<=E.width;x+=8){
      const y = waterTop + Math.sin((x+performance.now()*0.08)*0.02)*3;
      if(x===0) c.moveTo(x,y); else c.lineTo(x,y);
    }
    c.stroke();

    E.drawText(`점수: ${this.score}`, 12, 12, '#cfe6ff', 16);

    if(this.state==='ready'){
      E.drawText('휠로 깊이 조절 → 스페이스/엔터로 캐스팅', 12, 36, '#9dc1ff', 14);
    }
    if(this.state==='charge'){
      E.drawText('휠↓ 깊이↑ / 휠↑ 깊이↓ — 스페이스/엔터로 캐스팅', 12, 36, '#9dc1ff', 14);
      this.drawDepthGauge(24, waterTop+20, 16, E.height-waterTop-80, this.charge);
    }
    if(this.state==='wait'){
      E.drawText('입질 대기 중...', 12, 36, '#9dc1ff', 14);
      this.drawBobber(this.castX, this.castY);
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
    c.strokeStyle='rgba(188,208,255,.9)';
    c.lineWidth=1.5;
    c.beginPath();
    c.moveTo(E.width*0.5, this.waterTop-10);
    c.quadraticCurveTo(x-20, this.waterTop+20, x, y);
    c.stroke();
    c.fillStyle='#ff6058'; c.beginPath(); c.arc(x,y,8,0,Math.PI*2); c.fill();
    c.fillStyle='#fff'; c.beginPath(); c.arc(x,y-3,4,0,Math.PI*2); c.fill();
  };

  GameFishing.prototype.drawDepthGauge = function(x,y,w,h,val01){
    const c=E.ctx;
    c.fillStyle='rgba(255,255,255,0.12)'; c.fillRect(x, y, w, h);
    const filled = h * val01;
    c.fillStyle='#9dc1ff'; c.fillRect(x, y + (h-filled), w, filled);
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
    c.fillStyle='rgba(255,255,255,0.07)';
    c.fillRect(ln.x-70, ln.top, 140, ln.bottom - ln.top);
    c.fillStyle='#79c2ff';
    c.beginPath(); c.arc(ln.x+25, this.fish.y, 10, 0, Math.PI*2); c.fill();
    c.beginPath();
    c.moveTo(ln.x+15, this.fish.y);
    c.lineTo(ln.x+5, this.fish.y-6);
    c.lineTo(ln.x+5, this.fish.y+6);
    c.closePath(); c.fillStyle='#5aa9e6'; c.fill();
    c.fillStyle='rgba(255,209,102,0.35)';
    c.fillRect(ln.x-55, this.bar.y, 110, this.bar.h);
    c.strokeStyle='rgba(255,209,102,0.9)';
    c.lineWidth=2;
    c.strokeRect(ln.x-55, this.bar.y, 110, this.bar.h);
    const gx = 40, gy = this.waterTop - 30, gw = E.width-80, gh = 8;
    c.fillStyle='rgba(255,255,255,0.12)'; c.fillRect(gx,gy,gw,gh);
    c.fillStyle='#a3d6a6'; c.fillRect(gx,gy,gw*this.catchMeter,gh);
    const info = (this.grace>0 ? `무적 ${this.grace.toFixed(1)}s • ` : '')
               + `휠 내림=아래로, 휠 올림=위로 · v=${this.bar.v.toFixed(0)}px/s`;
    E.drawText(info, 12, 36, '#9dc1ff', 14);
  };

  window.GameFishing = GameFishing;
})();
