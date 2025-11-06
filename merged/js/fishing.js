(function(){
  // Enhanced Fishing: undertale-style cast timing + sprite fish, adapted to hub APIs
  const E = window.Engine;
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));
  const lerp  = (a,b,t)=>a+(b-a)*t;
  const rand  = (a,b)=>a + Math.random()*(b-a);

  // Sprite paths (inside merged/merged/image)
  const FISH_SPRITES = {
    small: 'image/작은-물고기.png',
    mid:   'image/중간-물고기.png',
    big:   'image/큰-물고기.png',
  };
  const FISH_SPRITE_HEIGHT = { small: 26, mid: 36, big: 52 };

  // Optional background-white-to-transparent postprocess (skips under file://)
  function loadImage(src){
    const img = new Image();
    const useCross = location.protocol.startsWith('http');
    if(useCross) img.crossOrigin = 'anonymous';
    img._canvas = null;
    img.addEventListener('load', ()=>{
      if(!useCross) return;
      try{
        const w=img.naturalWidth, h=img.naturalHeight; if(!w||!h) return;
        const off=document.createElement('canvas'); off.width=w; off.height=h; const oc=off.getContext('2d');
        oc.drawImage(img,0,0,w,h); const data=oc.getImageData(0,0,w,h); const px=data.data; const tol=36;
        for(let i=0;i<px.length;i+=4){ const r=px[i],g=px[i+1],b=px[i+2],a=px[i+3]; if(a===0) continue; const bright=(r+g+b)/3; const dist=Math.abs(255-r)+Math.abs(255-g)+Math.abs(255-b); if(bright>245||dist<=tol) px[i+3]=0; }
        oc.putImageData(data,0,0); img._canvas=off;
      }catch(e){ img._canvas=null; }
    });
    img.src = src; return img;
  }

  // Probabilities
  function roll(weights){ const ent=Object.entries(weights); const sum=ent.reduce((s,[,w])=>s+w,0); let r=Math.random()*sum; for(const [k,w] of ent){ r-=w; if(r<=0) return k; } return ent[ent.length-1][0]; }
  function pickZoneByAccuracy(dist, perfectWin, nearWin){
    if(dist <= perfectWin)   return roll({ deep:0.8, mid:0.2, surface:0.0 });
    if(dist <= nearWin)      return roll({ deep:0.2, mid:0.5, surface:0.3 });
                              return roll({ deep:0.0, mid:0.2, surface:0.8 });
  }
  function pickSizeByZone(zone){
    if(zone==='surface') return roll({ small:0.80, mid:0.19, big:0.01 });
    if(zone==='mid')     return roll({ small:0.50, mid:0.30, big:0.20 });
                         return roll({ small:0.15, mid:0.50, big:0.35 });
  }
  function pointsFor(size){ return size==='small'?1:(size==='mid'?3:5); }

  // Fish movement profiles
  const FISH_PROFILES = {
    small:{ amp:18, freq:1.4, jitter:1,  burstProb:0.15, burstDur:0.25, burstForce:140, mass:0.8 },
    mid:  { amp:44, freq:1.1, jitter:2,  burstProb:0.25, burstDur:0.35, burstForce:170, mass:1.1 },
    big:  { amp:80, freq:0.8, jitter:4,  burstProb:0.45, burstDur:0.50, burstForce:220, mass:1.6 }
  };

  function depthToConfig(depth01){
    const fishSpeed  = 80 + depth01*140;
    const barSize    = 120 - depth01*40;
    const fillRate   = 0.325;
    const drainRate  = 0.55;
    const barVMax    = 260 + depth01*180;
    const wheelStep  = 70 + depth01*55;
    const friction   = 2.2;
    return { fishSpeed, barSize, fillRate, drainRate, barVMax, wheelStep, friction };
  }

  // Game
  function GameFishing(){
    this.state = 'ready';                 // ready → cast_timing → wait → minigame → caught/miss
  this.score = 0;                       // HUD uses getScore()
  // No time limit in standalone fishing; Challenge manages its own timer
  this.time = Infinity;

    this.lastCatchText = '';
    this.waterTop = 180;
    this.lane = { x: E.width*0.5, top: this.waterTop+30, bottom: E.height-60 };

    this.bar = { y:0, h:120, v:0 };
    this.fish = { y:0, vy:0, baseY:0, t:0, oscT:0, burstT:0, spd:120, profile:FISH_PROFILES.small };
    this.fishSize = 'small';
    this.zone = 'surface';
    this.catchMeter = 0; this.grace=0;

    this.timing = { x:24, y:0, w:16, h:0, markerY:0, dir:1, speed:360, centerY:0, perfectWin:8, nearWin:28 };
    this.castX = E.width*0.6; this.castY = this.waterTop+60;

    this.depth01 = 0.4; this.cfg = depthToConfig(this.depth01);
    this.waitTimer = 0; this._resTimer=0; this._waveT=0;

    // Sprites (optional; code falls back to shapes if missing)
    this.fishImages = {
      small: loadImage(FISH_SPRITES.small),
      mid:   loadImage(FISH_SPRITES.mid),
      big:   loadImage(FISH_SPRITES.big)
    };
    this.currentFishImg = this.fishImages.small;

    // Audio (optional): ambient ocean and casting sfx
    this.sfx = { ocean:null, cast:null };
    try {
      this.sfx.ocean = new Audio('sound/ocean.mp3');
      this.sfx.ocean.loop = true; this.sfx.ocean.volume = 0.18; this.sfx.ocean.preload = 'auto';
    } catch(e){}
    try {
      this.sfx.cast = new Audio('sound/casting.wav');
      this.sfx.cast.volume = 0.5; this.sfx.cast.preload = 'auto';
    } catch(e){}
  }

  GameFishing.prototype.resetRound = function(){ this.state='ready'; };

  GameFishing.prototype._startCastTiming = function(){
    const y=this.waterTop+20; const h=E.height - this.waterTop - 80;
    Object.assign(this.timing, { y, h, centerY: y + h*0.5, markerY: y + 8, dir: 1 });
    this.state = 'cast_timing';
  };

  GameFishing.prototype._confirmCastFromTiming = function(){
    const t=this.timing; const dist=Math.abs(t.markerY - t.centerY);
    // 1) zone
    const zone = pickZoneByAccuracy(dist, t.perfectWin, t.nearWin); this.zone = zone;
    // 2) bobber depth inside that third
    const y0=this.waterTop+20; const h=E.height - this.waterTop - 80; const seg=h/3; const idx=(zone==='surface')?0:(zone==='mid'?1:2);
    this.castY = y0 + seg*idx + Math.random()*seg; this.castX = Math.round(60 + Math.random()*(E.width-120));
    // 3) fish size/profile
    this.fishSize = pickSizeByZone(zone); this.fish.profile = FISH_PROFILES[this.fishSize]; this.currentFishImg = this.fishImages[this.fishSize];
    // 4) difficulty
    this.depth01 = clamp((this.castY - y0)/h, 0.02, 1.0); this.cfg = depthToConfig(this.depth01);
    // 5) wait to bite
    this.waitTimer = 0.7 + (1.6 - this.depth01*0.9)*Math.random(); this.state='wait';
  };

  GameFishing.prototype.init = function(){
    this.resetRound();
    // start ambient once player enters game (user gesture already happened)
    if(this.sfx && this.sfx.ocean){ try { this.sfx.ocean.currentTime = 0; this.sfx.ocean.play(); } catch(e){} }
  };

  GameFishing.prototype.update = function(dt){
    const clicked = E.consumeClick(); const wheel = E.peekWheel(); this._waveT += dt;

  // session timer: only count if time is finite (e.g., clicker). Fishing uses Infinity by default
  if(Number.isFinite(this.time) && this.time>0){ this.time -= dt; if(this.time<=0){ this.time=0; this.state='done'; } }

    if(this.state==='ready'){ if(E.keys.has(' ')||E.keys.has('enter')||clicked){ this._startCastTiming(); } return; }

    if(this.state==='cast_timing'){
      const t=this.timing; t.markerY += t.dir*t.speed*dt; const yMin=t.y+8, yMax=t.y+t.h-8; if(t.markerY<=yMin){ t.markerY=yMin; t.dir=+1;} if(t.markerY>=yMax){ t.markerY=yMax; t.dir=-1; }
      if(E.keys.has(' ')||E.keys.has('enter')||clicked){
        if(this.sfx && this.sfx.cast){ try { this.sfx.cast.currentTime = 0; this.sfx.cast.play(); } catch(e){} }
        this._confirmCastFromTiming();
      }
      return;
    }

    if(this.state==='wait'){
      this.waitTimer -= dt; if(this.waitTimer<=0){
        const ln=this.lane; this.bar.h=this.cfg.barSize; this.bar.y=(ln.top + ln.bottom - this.bar.h)/2; this.bar.v=0;
        const p=this.fish.profile; Object.assign(this.fish,{ oscT:0,t:0,burstT:0,vy:0, baseY:this.castY, y:clamp(this.castY, ln.top+6, ln.bottom-6), spd:this.cfg.fishSpeed });
        this.catchMeter=0.35; this.grace=3.0; this.state='minigame';
      }
      return;
    }

    if(this.state==='minigame'){
      const ln=this.lane;
      // player bar
      if(Math.abs(wheel)>0){ const notch = (wheel>0)?+1:-1; this.bar.v += notch*this.cfg.wheelStep; this.bar.v=clamp(this.bar.v, -this.cfg.barVMax, this.cfg.barVMax); }
      else { this.bar.v *= Math.exp(-this.cfg.friction*dt); if(Math.abs(this.bar.v)<5) this.bar.v=0; }
      this.bar.y += this.bar.v*dt; if(this.bar.y<ln.top){ this.bar.y=ln.top; this.bar.v=0;} if(this.bar.y>ln.bottom-this.bar.h){ this.bar.y=ln.bottom-this.bar.h; this.bar.v=0; }

      // fish AI
      const pr=this.fish.profile; this.fish.oscT+=dt; this.fish.t+=dt;
      if(this.fish.t>0.8+Math.random()*0.9){ this.fish.t=0; this.fish.baseY = clamp(this.fish.baseY + rand(-40,40), ln.top+16, ln.bottom-16); }
      if(this.fish.burstT<=0 && Math.random()<pr.burstProb*dt){ this.fish.burstT=pr.burstDur; const sgn=(Math.random()<0.5?-1:+1); this.fish.vy += sgn*pr.burstForce; }
      if(this.fish.burstT>0) this.fish.burstT -= dt; else this.fish.vy *= Math.exp(-2.0*dt*pr.mass);
      const osc=Math.sin(this.fish.oscT*Math.PI*2*pr.freq)*pr.amp; const jitt=(Math.random()*2-1)*pr.jitter;
      const targetY = clamp(this.fish.baseY + osc + jitt, ln.top+6, ln.bottom-6);
      const follow = 8/pr.mass; this.fish.y = lerp(this.fish.y, targetY, clamp(follow*dt,0,1)); this.fish.y += this.fish.vy*dt; this.fish.y = clamp(this.fish.y, ln.top+6, ln.bottom-6);

      // progress
      const inBar = (this.fish.y>=this.bar.y && this.fish.y<=this.bar.y+this.bar.h);
      if(inBar) this.catchMeter += this.cfg.fillRate*dt; else { if(this.grace>0) this.catchMeter=Math.max(0.15, this.catchMeter - this.cfg.drainRate*dt*0.5); else this.catchMeter -= this.cfg.drainRate*dt; }
      this.catchMeter = clamp(this.catchMeter,0,1); if(this.grace>0) this.grace -= dt;
      if(this.catchMeter>=1){ this.state='caught'; const pts=pointsFor(this.fishSize); this.score += pts; this._resTimer=1.1; this.lastCatchText=`잡았다! +${pts}점`; }
      else if(this.catchMeter<=0 && this.grace<=0){ this.state='miss'; this._resTimer=1.0; this.lastCatchText='입질 실패'; }
      return;
    }

    if(this.state==='caught' || this.state==='miss'){ this._resTimer -= dt; if(this._resTimer<=0) this.resetRound(); }
  };

  GameFishing.prototype.draw = function(){
    const c=E.ctx; E.clear('#0b2020ff');
    const waterTop=this.waterTop;
    // water
    c.fillStyle='#244778ff'; c.fillRect(0, waterTop, E.width, E.height-waterTop);
    c.strokeStyle='rgba(65, 213, 249, 0.35)'; c.lineWidth=2; c.beginPath();
    for(let x=0;x<=E.width;x+=8){ const y = waterTop + Math.sin((x+performance.now()*0.08)*0.02)*3; if(x===0) c.moveTo(x,y); else c.lineTo(x,y);} c.stroke();

    // thirds guide
    const gy0=this.waterTop+20; const gh=E.height - this.waterTop - 80; c.strokeStyle='rgba(255,255,255,0.12)'; c.lineWidth=1; for(let i=1;i<=2;i++){ const yy=gy0 + gh*(i/3); c.beginPath(); c.moveTo(8,yy); c.lineTo(E.width-8,yy); c.stroke(); }

    // HUD
    E.drawText(`점수: ${this.score}`, 12, 12, '#cfe6ff', 16);
    if(this.lastCatchText) E.drawText(this.lastCatchText, 12, 58, '#9dc1ff', 14);

    if(this.state==='ready'){
      E.drawText('스페이스/엔터/클릭 → 캐스팅 타이밍!', 12, 36, '#9dc1ff', 14);
      this.drawCastGaugeFrame();
    }else if(this.state==='cast_timing'){
      E.drawText('왼쪽 세로바: 중앙에 맞춰 눌러라! (중앙 가까울수록 심해 확률↑)', 12, 36, '#9dc1ff', 14);
      this.drawCastTimingBar();
    }else if(this.state==='wait'){
      E.drawText('입질 대기 중...', 12, 36, '#9dc1ff', 14);
      this.drawBobber(this.castX, this.castY);
      this.drawCastGaugeFrame();
    }else if(this.state==='minigame'){
      this.drawFishingMini();
    }else if(this.state==='caught' || this.state==='miss'){
      E.drawText(this.state==='caught'?'잡았다!':'놓쳤다...', 12, 36, '#9dc1ff', 14);
      this.drawBobber(this.castX, this.castY);
      this.drawCastGaugeFrame();
    }
  };

  GameFishing.prototype.drawCastGaugeFrame = function(){
    const c=E.ctx; const x=24, y=this.waterTop+20, w=16, h=E.height-this.waterTop-80;
    c.fillStyle='rgba(255,255,255,0.12)'; c.fillRect(x,y,w,h);
    c.strokeStyle='rgba(255,255,255,0.25)'; c.lineWidth=1; c.beginPath(); for(let i=0;i<=5;i++){ const yy=y + h*i/5; c.moveTo(x-6,yy); c.lineTo(x+w+6,yy);} c.stroke();
  };

  GameFishing.prototype.drawCastTimingBar = function(){
    const c=E.ctx, t=this.timing;
    c.fillStyle='rgba(255,255,255,0.12)'; c.fillRect(t.x, t.y, t.w, t.h);
    c.fillStyle='rgba(255,80,80,0.10)'; c.fillRect(t.x-2, t.y, t.w+4, 22); c.fillRect(t.x-2, t.y+t.h-22, t.w+4, 22);
    c.fillStyle='rgba(255,220,120,0.12)'; c.fillRect(t.x-2, t.centerY - t.nearWin, t.w+4, t.nearWin*2);
    c.fillStyle='rgba(120,255,180,0.18)'; c.fillRect(t.x-2, t.centerY - t.perfectWin, t.w+4, t.perfectWin*2);
    c.strokeStyle='rgba(173,216,255,0.7)'; c.lineWidth=1.5; c.beginPath(); c.moveTo(t.x-6, t.centerY); c.lineTo(t.x+t.w+6, t.centerY); c.stroke();
    c.fillStyle='#e8f1ff'; c.fillRect(t.x-2, t.markerY-6, t.w+4, 12); c.strokeStyle='#bcd2ff'; c.strokeRect(t.x-2, t.markerY-6, t.w+4, 12);
  };

  GameFishing.prototype.drawBobber = function(x,y){
    const c=E.ctx; c.strokeStyle='rgba(188,208,255,.9)'; c.lineWidth=1.5; c.beginPath(); c.moveTo(E.width*0.5, this.waterTop-10); c.quadraticCurveTo(x-20, this.waterTop+20, x, y); c.stroke(); c.fillStyle='#ff6058'; c.beginPath(); c.arc(x,y,8,0,Math.PI*2); c.fill(); c.fillStyle='#fff'; c.beginPath(); c.arc(x,y-3,4,0,Math.PI*2); c.fill();
  };

  GameFishing.prototype.drawFishingMini = function(){
    const c=E.ctx, ln=this.lane;
    // track
    c.fillStyle='rgba(147, 161, 240, 0.07)'; c.fillRect(ln.x-70, ln.top, 140, ln.bottom - ln.top);

    // fish sprite (fallback to circle if not ready)
    const img=this.currentFishImg; const targetH=FISH_SPRITE_HEIGHT[this.fishSize]||32; const src = img && img._canvas ? img._canvas : img; const hasSrc = src && ((src.complete===undefined) || src.complete) && (src.naturalWidth || src.width);
    if(hasSrc){ const sw=src.naturalWidth||src.width, sh=src.naturalHeight||src.height, ar=sw/sh; const drawW=Math.max(1, targetH*ar); const drawX=ln.x - drawW/2; const drawY=this.fish.y - targetH/2; const prev=c.imageSmoothingEnabled; c.imageSmoothingEnabled=true; c.drawImage(src, drawX, drawY, drawW, targetH); c.imageSmoothingEnabled=prev; }
    else { c.fillStyle='#79c2ff'; c.beginPath(); c.arc(ln.x+25, this.fish.y, 10, 0, Math.PI*2); c.fill(); }

    // player bar
    const barW=70; c.fillStyle='rgba(255,209,102,0.35)'; c.fillRect(ln.x - barW/2, this.bar.y, barW, this.bar.h); c.strokeStyle='rgba(255,209,102,0.9)'; c.lineWidth=2; c.strokeRect(ln.x - barW/2, this.bar.y, barW, this.bar.h);

    // progress
    const gx=40, gy=this.waterTop - 30, gw=E.width-80, gh=8; c.fillStyle='rgba(255, 255, 255, 0.12)'; c.fillRect(gx,gy,gw,gh); c.fillStyle='#a3d6a6'; c.fillRect(gx,gy,gw*this.catchMeter,gh);
    const zoneK=this.zone==='surface'?'수면':this.zone==='mid'?'중앙':'심해'; const sizeK=this.fishSize==='small'?'작은':(this.fishSize==='mid'?'중간':'큰');
    const info=(this.grace>0?`무적 ${this.grace.toFixed(1)}s • `:'') + `${zoneK} • ${sizeK} 물고기 • 휠↓=아래, ↑=위`;
    E.drawText(info, 12, 36, '#9dc1ff', 14);
  };

  GameFishing.prototype.getScore = function(){ return this.score; };
  Object.defineProperty(GameFishing.prototype,'isOver',{ get(){ return Number.isFinite(this.time) && this.time <= 0; }});

  window.GameFishing = GameFishing;
  // Optional cleanup hook used by scenes
  GameFishing.prototype.stopAudio = function(){ try { if(this.sfx && this.sfx.ocean){ this.sfx.ocean.pause(); this.sfx.ocean.currentTime = 0; } } catch(e){} };
})();
