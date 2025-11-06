(function(){
  const E = window.Engine;

  function RunnerGame(){
    // base sizes for dynamic scaling
    this.base = { w: 32, normalH: 42, slideH: 24 };
    this.player = { x: 80, y: 600, w: this.base.w, h: this.base.normalH, vy: 0, onGround: true };
    this.groundY = 640;
    this.gravity = 1600; // slightly stronger gravity for tighter arcs
    this.fastFallAccel = 2200; // extra gravity when holding down in air
    this.jumpV = -420; // lower initial jump velocity (reduced max height)
    this.speed = 240; // base speed (will scale up over time)
    this.spawn = 0;
    this.obstacles = [];
    this.bars = [];
    this.rockets = [];
    this.rocketTimer = 0;
    this.time = 0;
    this.over = false;
    // slide (will scale with sizeScale)
    this.normalH = this.base.normalH; this.slideH = this.base.slideH; this.sliding = false;
    // variable jump
    this.jumpHeld = false; this.prevJumpHeld = false;

    // effects and level-up system
    this.sizeScale = 1; // 0.5 or 2 from cards
    this.shield = 0; // number of shields
    this.invulnTimer = 0; // brief invulnerability after shield hit
    this.slowUntil = 0; // game time until which stage speed is slowed
    this.sizeUntil = 0; // game time until which size change stays active
    this.scoreBonus = 0; // +200 card accumulates here
    // lives
    this.livesMax = 3;
    this.lives = this.livesMax;
    // EXP system (separate from score-based progression)
    this.exp = 0;               // current EXP toward next level
    this.expLevel = 0;          // number of EXP levels achieved
    this.expTargets = [100, 200, 400]; // EXP needed for next three level-ups
    this.expRate = 10;          // EXP per second (first level in ~10s)
    this.inLevelUp = false;
    this.levelCards = [];
    this.levelTimer = 0; // real-time countdown (seconds)
    this.prevMouseDown = false;
    this.resumeCountdown = 0; // countdown after selecting a card (3..1)

    // image assets
    this.images = {
      player: null,
      groundBlock: null,
      vertBar: null,
      bg: null,
    };
    this.loadImages();
    // background scroll state
    this.bgX = 0;      // current scroll offset in screen pixels
    this.bgFactor = 0.6; // parallax factor relative to world speed

    // sounds
    this.sfx = {
      jump: null,
      bg: null
    };
    try {
      this.sfx.jump = new Audio('sound/Super Mario Bros. Jump.mp3');
      this.sfx.jump.volume = 0.25;
      this.sfx.jump.preload = 'auto';
    } catch(e){}
    try {
      this.sfx.bg = new Audio('sound/1117. Liar.mp3');
      this.sfx.bg.loop = true;
      this.sfx.bg.volume = 0.2; // quieter background music
      this.sfx.bg.preload = 'auto';
    } catch(e){}
  }
  RunnerGame.prototype.loadImages = function(){
    const mk = (src)=>{ const i=new Image(); i.src = src; return i; };
  // Use assets from GameProject to avoid duplication
  // Note: index.html is at merged/merged/index.html, while GameProject is at ../../GameProject
  const base = '/image/';
    this.images.player = mk(base + '토끼.png');
    this.images.groundBlock = mk(base + '바닥장애물.png');
    this.images.vertBar = mk(base + '슬라이딩해서피해야하는장애물.png');
    // Background: try a few common filenames; load first that succeeds
    const tryList = [
      base + 'runner-bg.png',
      base + '배경.png',
      base + 'background.png',
      base + 'bg.png',
      base + '반복배경.jpg',
      base + 'runner-bg.jpg',
      base + 'background.jpg',
      base + 'bg.jpg'
    ];
    const bg = new Image();
    let idx = 0;
    bg.onerror = ()=>{ if(idx < tryList.length) bg.src = tryList[idx++]; };
    bg.onload = ()=>{};
    if(tryList.length){ bg.src = tryList[idx++]; }
    this.images.bg = bg;
  };
  RunnerGame.prototype.init = function(){
    this.obstacles.length=0; this.bars.length=0; this.rockets.length=0; this.time=0; this.over=false;
    this.sizeScale = 1; // reset size on new run
    this.sizeUntil = 0;
    this.normalH = this.base.normalH * this.sizeScale;
    this.slideH = this.base.slideH * this.sizeScale;
    this.player.w = this.base.w * this.sizeScale;
    this.player.h = this.normalH; this.player.y=this.groundY-this.player.h; this.player.vy=0; this.player.onGround=true; this.spawn=0; this.sliding=false;
    this.rocketTimer = 0;
    this.shield = 0; this.invulnTimer = 0; this.slowUntil = 0; this.scoreBonus = 0;
    this.lives = this.livesMax;
    this.exp = 0; this.expLevel = 0; this.inLevelUp = false; this.levelCards = []; this.levelTimer = 0; this.prevMouseDown = false; this.resumeCountdown = 0;

    // start background music (user interacted by selecting game)
    if (this.sfx.bg){ try { this.sfx.bg.currentTime = 0; this.sfx.bg.play(); } catch(e){} }
  };
  RunnerGame.prototype.control = function(){
    const isDown = E.keys.has('arrowdown') || E.keys.has('s');
    // Jump only via keyboard (space/up); mouse/touch no longer triggers jump
    this.jumpHeld = (E.keys.has(' ') || E.keys.has('arrowup')) ? true : false;

    if(this.player.onGround){
      // slide when holding down key (arrowdown or 's')
      this.sliding = isDown;
      // jump only on press edge and not sliding
      const justPressed = this.jumpHeld && !this.prevJumpHeld;
      if(justPressed && !this.sliding){
        this.player.vy = this.jumpV; this.player.onGround = false;
        if (this.sfx.jump){ try { this.sfx.jump.currentTime = 0; this.sfx.jump.play(); } catch(e){} }
      }
    }
    // remember last state for edge detection
    this.prevJumpHeld = this.jumpHeld;
  };
  RunnerGame.prototype.update = function(dt){ if(this.over) return;
    // EXP-based Level-up trigger (separate from score)
    if(!this.inLevelUp && this.expLevel < this.expTargets.length && this.exp >= this.expTargets[this.expLevel]){
      this.startLevelUp();
    }
    if(this.inLevelUp){
      this.levelTimer -= dt;
      const justClicked = E.mouse.down && !this.prevMouseDown;
      if(justClicked){
        const rects = this.getLevelCardRects();
        for(let i=0;i<rects.length;i++){
          const r = rects[i];
          if(E.mouse.x >= r.x && E.mouse.x <= r.x + r.w && E.mouse.y >= r.y && E.mouse.y <= r.y + r.h){
            this.applyCard(this.levelCards[i]);
            this.inLevelUp = false; this.levelCards = []; this.levelTimer = 0; this.expLevel++; this.exp = 0; this.resumeCountdown = 3;
            break;
          }
        }
      }
      if(this.levelTimer <= 0){
        this.inLevelUp = false; this.levelCards = []; this.levelTimer = 0; this.expLevel++; this.exp = 0;
      }
      this.prevMouseDown = E.mouse.down;
      return; // world frozen
    }

    if(this.resumeCountdown > 0){ this.resumeCountdown -= dt; this.prevMouseDown = E.mouse.down; return; }

    this.time += dt; this.control();
    if(this.expLevel < this.expTargets.length){ this.exp += this.expRate * dt; }

    if(this.sizeScale !== 1 && this.time >= this.sizeUntil){ this.sizeScale = 1; this.applySizeScale(); }

    let g = this.gravity;
    if(this.player.vy < 0){ g *= this.jumpHeld ? 0.75 : 2.4; }
    this.player.vy += g*dt;
    if(!this.player.onGround && (E.keys.has('arrowdown') || E.keys.has('s'))){ this.player.vy += this.fastFallAccel*dt; }
    this.player.y += this.player.vy*dt;
    if(this.player.y + this.player.h >= this.groundY){ this.player.y = this.groundY - this.player.h; this.player.vy = 0; this.player.onGround = true; }

    if(this.player.onGround){
      const targetH = this.sliding ? this.slideH : this.normalH;
      if(this.player.h !== targetH){ this.player.h = targetH; this.player.y = this.groundY - this.player.h; }
    }

    this.spawn -= dt * (1 + this.time*0.02);
    if(this.spawn<=0){
      this.spawn = E.rnd(0.8,1.4);
      if(Math.random()<0.35){
        const clearance = this.slideH + 6;
        const bottom = this.groundY - clearance;
        const top = E.rnd(80, 200);
        const h = Math.max(40, bottom - top);
        const w = E.rnd(16,24);
        this.bars.push({ x:E.width+40, y:top, w, h });
      } else {
        const h=E.rnd(28,46); this.obstacles.push({ x: E.width+40, y: this.groundY-h, w:E.rnd(20,32), h});
      }
    }

    const slowMul = (this.time < this.slowUntil) ? 0.5 : 1.0;
    const curSp = this.speed * (1 + this.time*0.03) * slowMul;
    const prect={x:this.player.x,y:this.player.y,w:this.player.w,h:this.player.h};
    const hitRect = (r)=> E.aabb(prect, r);
    for(const o of this.obstacles){
      o.x -= curSp*dt;
      const oc = this.getObstacleHitRect(o);
      if(hitRect(oc)){
        if(this.handleHit()){ this.over = true; } else { o._dead = true; }
      }
    }
    for(const b of this.bars){ b.x -= curSp*dt; if(hitRect(b)){ if(this.handleHit()){ this.over = true; } else { b._dead = true; } }}
    this.obstacles = this.obstacles.filter(o=>o.x>-60 && !o._dead);
    this.bars = this.bars.filter(b=>b.x>-160 && !b._dead);

    const bg = this.images.bg;
    if(bg && bg.complete && (bg.naturalWidth||bg.width) && (bg.naturalHeight||bg.height)){
      const iw = bg.naturalWidth || bg.width; const ih = bg.naturalHeight || bg.height;
      const scale = E.height / ih; const tileW = Math.max(1, Math.round(iw * scale));
      this.bgX = (this.bgX + curSp * this.bgFactor * dt) % tileW;
    }

    if(this.time >= 5){
      this.rocketTimer -= dt;
      if(this.rocketTimer <= 0){
        const elapsed = Math.max(0, this.time - 5);
        const diff = Math.min(2.5, 1 + elapsed/30);
        this.rocketTimer = (1.8 / diff) * E.rnd(0.7, 1.15);
        const startX = E.width + 40;
        const startY = E.rnd(-40, E.height*0.4);
        const base = curSp * E.rnd(1.1, 1.6) + 120;
        const slope = E.rnd(0.45, 0.8);
        const vx = -base;
        const vy = base * slope;
        this.rockets.push({ x:startX, y:startY, w:24, h:10, vx, vy });
      }
      for(const r of this.rockets){ r.x += r.vx*dt; r.y += r.vy*dt; if(hitRect(r)){ if(this.handleHit()){ this.over = true; } else { r._dead = true; } } }
      this.rockets = this.rockets.filter(r => r.x > -80 && r.y < E.height + 60 && !r._dead);
    }

    if(this.invulnTimer > 0) this.invulnTimer -= dt;
    this.prevMouseDown = E.mouse.down;
  };
  RunnerGame.prototype.draw = function(){ const c = E.ctx; E.clear();
    const bg = this.images.bg;
    if(bg && bg.complete && (bg.naturalWidth||bg.width)){
      const iw = bg.naturalWidth || bg.width; const ih = bg.naturalHeight || bg.height || 1;
      const scale = E.height / ih; const tileW = Math.max(1, Math.round(iw * scale));
      const start = -Math.floor(this.bgX % tileW);
      for(let x = start; x < E.width; x += tileW){ c.drawImage(bg, x, 0, tileW, E.height); }
    } else {
      c.fillStyle = '#f3d96d'; for(let i=0;i<12;i++){ c.fillRect(0, i*60+20, E.width, 6); }
    }
    c.fillStyle = '#e2c546';
    c.fillRect(0, this.groundY, E.width, E.height - this.groundY);
    c.fillStyle = '#d1b43e';
    c.fillRect(0, this.groundY, E.width, 4);

    for(const o of this.obstacles){
      const img = this.images.groundBlock;
      if(img && img.complete) {
        E.ctx.drawImage(img, o.x, o.y, o.w, o.h);
      } else {
        E.drawRoundRect(o.x,o.y,o.w,o.h,6,'#94c973','#3a7a2a');
      }
    }
    for(const b of this.bars){
      const ctx = E.ctx;
      ctx.fillStyle = '#000000';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(Math.floor(b.x)+0.5, Math.floor(b.y)+0.5, Math.floor(b.w)-1, Math.floor(b.h)-1);
    }
    const pimg = this.images.player;
    if(pimg && pimg.complete){
      const ctx = E.ctx; ctx.save();
      if(this.invulnTimer > 0){
        const blinkLow = (Math.floor(this.invulnTimer * 10) % 2) === 0;
        if(blinkLow) ctx.globalAlpha = 0.4;
      }
      ctx.scale(-1, 1);
      ctx.drawImage(pimg, -this.player.x - this.player.w, this.player.y, this.player.w, this.player.h);
      ctx.restore();
    } else {
      const c = E.ctx; c.save();
      if(this.invulnTimer > 0){
        const blinkLow = (Math.floor(this.invulnTimer * 10) % 2) === 0;
        if(blinkLow) c.globalAlpha = 0.4;
      }
      E.drawRoundRect(this.player.x,this.player.y,this.player.w,this.player.h,8,'#ffb570','#ce7a2a');
      c.restore();
    }

    if(this.shield > 0 || this.invulnTimer > 0){
      c.save();
      c.strokeStyle = this.invulnTimer > 0 ? '#8be9fd' : '#ffd54f';
      c.lineWidth = 3;
      c.strokeRect(this.player.x-4, this.player.y-4, this.player.w+8, this.player.h+8);
      c.restore();
    }

    for(const r of this.rockets){
      const ang = Math.atan2(r.vy, r.vx);
      c.save();
      c.translate(r.x + r.w/2, r.y + r.h/2);
      c.rotate(ang);
      c.fillStyle = '#555';
      c.fillRect(-r.w/2, -r.h/2, r.w, r.h);
      c.fillStyle = '#e84545';
      c.beginPath(); c.moveTo(r.w/2, 0); c.lineTo(r.w/2 - 6, -r.h/2); c.lineTo(r.w/2 - 6, r.h/2); c.closePath(); c.fill();
      c.fillStyle = '#d16a2d';
      c.fillRect(-r.w/2, -r.h/2, 4, r.h/2);
      c.fillRect(-r.w/2, 0, 4, r.h/2);
      c.restore();
    }
    E.drawText('러너: 스페이스=점프(길게=높이), ↓=슬라이딩/급강하', 12, 8, '#5a4a16', 14);

    this.drawLives();

    if(this.inLevelUp){
      c.save(); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0,0,E.width,E.height);
      E.drawText('레벨 업! 보상 카드를 고르세요', E.width/2, 180, '#fff', 22, 'center');
      E.drawText(`남은 시간: ${Math.ceil(this.levelTimer)}초`, E.width/2, 210, '#ffe179', 16, 'center');
      const rects = this.getLevelCardRects();
      for(let i=0;i<rects.length;i++){
        const r = rects[i];
        E.drawRoundRect(r.x, r.y, r.w, r.h, 12, '#ffffff', '#e2c546');
        const key = this.levelCards[i];
        const [title, desc] = this.getCardText(key);
        E.drawText(title, r.x + r.w/2, r.y + 18, '#3f3209', 16, 'center');
        E.drawText(desc, r.x + r.w/2, r.y + 44, '#6a5e33', 12, 'center');
      }
      c.restore();
    }

    if(!this.inLevelUp && this.resumeCountdown > 0){
      const n = Math.max(1, Math.ceil(this.resumeCountdown));
      c.save(); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0,0,E.width,E.height);
      E.drawText(String(n), E.width/2, E.height/2 - 28, '#ffffff', 72, 'center');
      c.restore();
    }

    if(!this.inLevelUp && this.sizeScale !== 1){
      const rem = this.sizeUntil - this.time;
      if(rem > 0 && rem <= 3){
        const n = Math.ceil(rem);
        const cx = E.width/2, cy = E.height/2 - 20;
        E.drawText(String(n), cx, cy, '#ffffff', 64, 'center');
      }
    }

    this.drawExpBar();
  };
  RunnerGame.prototype.getScore = function(){ return Math.floor(this.time*10) + this.scoreBonus; };
  Object.defineProperty(RunnerGame.prototype,'isOver',{ get(){ return this.over; }});

  RunnerGame.prototype.startLevelUp = function(){
    this.inLevelUp = true; this.levelTimer = 10;
    const pool = ['slow5','shield','sizeSmall','sizeBig','plus200'];
    const a = Math.floor(Math.random()*pool.length);
    let b = Math.floor(Math.random()*pool.length);
    if(b===a) b = (b+1)%pool.length; this.levelCards = [pool[a], pool[b]];
  };
  RunnerGame.prototype.getLevelCardRects = function(){
    const w = 160, h = 90; const gap = 20; const totalW = w*2 + gap; const x0 = (E.width - totalW)/2; const y = 260;
    return [ { x: x0, y, w, h }, { x: x0 + w + gap, y, w, h } ];
  };
  RunnerGame.prototype.getCardText = function(key){
    switch(key){
      case 'slow5': return ['스테이지 슬로우 (5초)', '속도만 느려집니다'];
      case 'shield': return ['보호막 1개', '한 번 더 버팁니다'];
      case 'sizeSmall': return ['크기 0.5x', '작아져서 잘 피해요'];
      case 'sizeBig': return ['크기 2x', '커져서 범위↑'];
      case 'plus200': return ['점수 +200', '즉시 점수 추가'];
      default: return ['알 수 없음',''];
    }
  };
  RunnerGame.prototype.applyCard = function(key){
    if(key === 'slow5'){
      this.slowUntil = Math.max(this.slowUntil, this.time + 5);
    } else if(key === 'shield'){
      this.shield += 1;
    } else if(key === 'sizeSmall'){
      this.sizeScale = 0.5; this.applySizeScale(); this.sizeUntil = Math.max(this.sizeUntil, this.time + 5);
    } else if(key === 'sizeBig'){
      this.sizeScale = 2.0; this.applySizeScale(); this.sizeUntil = Math.max(this.sizeUntil, this.time + 5);
    } else if(key === 'plus200'){
      this.scoreBonus += 200;
    }
  };
  RunnerGame.prototype.applySizeScale = function(){
    this.normalH = this.base.normalH * this.sizeScale; this.slideH = this.base.slideH * this.sizeScale; this.player.w = this.base.w * this.sizeScale;
    const targetH = this.sliding ? this.slideH : this.normalH; this.player.h = targetH; this.player.y = this.groundY - this.player.h;
  };
  RunnerGame.prototype.handleHit = function(){
    if(this.invulnTimer > 0) return false; if(this.shield > 0){ this.shield -= 1; this.invulnTimer = 2.0; return false; }
    if(this.lives > 0){ this.lives -= 1; if(this.lives > 0){ this.invulnTimer = 2.0; return false; } }
    return true;
  };
  RunnerGame.prototype.drawLives = function(){
    const c = E.ctx; const count = this.lives; const size = 8; const startX = 10; const y = 36;
    for(let i=0;i<this.livesMax;i++){
      const x = startX + i * 22; c.save(); c.globalAlpha = 0.25; this.pathHeart(x+10, y+6, size); c.fillStyle = '#ff6680'; c.fill(); c.restore();
      if(i < count){ c.save(); this.pathHeart(x+10, y+6, size); c.fillStyle = '#ff3366'; c.fill(); c.lineWidth = 1; c.strokeStyle = '#8b1e3f'; c.stroke(); c.restore(); }
      else { c.save(); this.pathHeart(x+10, y+6, size); c.lineWidth = 1; c.strokeStyle = '#8b1e3f'; c.stroke(); c.restore(); }
    }
  };
  RunnerGame.prototype.pathHeart = function(cx, cy, s){ const c = E.ctx; c.beginPath(); c.moveTo(cx, cy + s); c.bezierCurveTo(cx - s*2, cy - s, cx - s*3, cy + s*2, cx, cy + s*3); c.bezierCurveTo(cx + s*3, cy + s*2, cx + s*2, cy - s, cx, cy + s); c.closePath(); };
  RunnerGame.prototype.getObstacleHitRect = function(o){ const insetX = Math.min(6, o.w * 0.2); const insetY = Math.min(6, o.h * 0.25); const x = o.x + insetX; const y = o.y + insetY; const w = Math.max(1, o.w - insetX*2); const h = Math.max(1, o.h - insetY*2); return { x, y, w, h }; };
  RunnerGame.prototype.drawExpBar = function(){
    const c = E.ctx; const padX = 20; const barW = E.width - padX*2; const barH = 12; const y = E.height - 24; c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(padX-2, y-2, barW+4, barH+4);
    const target = this.expTargets[this.expLevel] || 1; const ratio = this.expLevel >= this.expTargets.length ? 1 : Math.max(0, Math.min(1, this.exp/target)); c.fillStyle = '#8fd16a'; c.fillRect(padX, y, Math.floor(barW * ratio), barH);
    c.strokeStyle = '#e2c546'; c.lineWidth = 2; c.strokeRect(padX, y, barW, barH); const label = this.expLevel >= this.expTargets.length ? `EXP Lv.${this.expLevel} MAX` : `EXP Lv.${this.expLevel} (${Math.floor(this.exp)}/${target})`; E.drawText(label, padX, y - 16, '#3a2f0b', 12, 'left');
  };

  // expose
  window.Games = Object.assign(window.Games || {}, { RunnerGame });
  // also expose as plain RunnerGame for merged main.js
  window.RunnerGame = RunnerGame;

  // Optional hook for main scene cleanup
  RunnerGame.prototype.stopAudio = function(){
    try { if(this.sfx.bg){ this.sfx.bg.pause(); this.sfx.bg.currentTime = 0; } } catch(e){}
  };
})();
