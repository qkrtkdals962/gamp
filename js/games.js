(function(){
  const E = window.Engine;

  // BaseGame interface (documented by usage):
  // - init()
  // - update(dt)
  // - draw()
  // - getScore() -> number
  // - isOver -> boolean

  // 1) Runner Game: jump over obstacles
  function RunnerGame(){
    this.player = { x: 80, y: 600, w: 32, h: 42, vy: 0, onGround: true };
    this.groundY = 640;
    this.gravity = 1400;
    this.jumpV = -580;
    this.speed = 240;
    this.spawn = 0;
    this.obstacles = [];
    this.time = 0;
    this.over = false;
  }
  RunnerGame.prototype.init = function(){ this.obstacles.length=0; this.time=0; this.over=false; this.player.y=this.groundY-this.player.h; this.player.vy=0; this.player.onGround=true; this.spawn=0; };
  RunnerGame.prototype.control = function(){
    if(this.player.onGround){
      if(E.keys.has(' ')||E.keys.has('arrowup')||E.mouse.down){ this.player.vy = this.jumpV; this.player.onGround = false; }
    }
  };
  RunnerGame.prototype.update = function(dt){ if(this.over) return; this.time += dt; this.control();
    // physics
    this.player.vy += this.gravity*dt; this.player.y += this.player.vy*dt;
    if(this.player.y + this.player.h >= this.groundY){ this.player.y = this.groundY - this.player.h; this.player.vy = 0; this.player.onGround = true; }
    // spawn obstacles
    this.spawn -= dt; if(this.spawn<=0){ this.spawn = E.rnd(0.8,1.4); const h=E.rnd(28,46); this.obstacles.push({ x: E.width+40, y: this.groundY-h, w:E.rnd(20,32), h}); }
    // move & collision
    for(const o of this.obstacles){ o.x -= this.speed*dt; if(E.aabb({x:this.player.x,y:this.player.y,w:this.player.w,h:this.player.h},o)){ this.over = true; }}
    // cleanup
    this.obstacles = this.obstacles.filter(o=>o.x>-60);
  };
  RunnerGame.prototype.draw = function(){ const c = E.ctx; E.clear();
    // background stripes
    c.fillStyle = '#f3d96d'; for(let i=0;i<12;i++){ c.fillRect(0, i*60+20, E.width, 6); }
    // ground
    c.fillStyle = '#e2c546'; c.fillRect(0,this.groundY, E.width, 6);
    // obstacles
    for(const o of this.obstacles){ E.drawRoundRect(o.x,o.y,o.w,o.h,6,'#94c973','#3a7a2a'); }
    // player
    E.drawRoundRect(this.player.x,this.player.y,this.player.w,this.player.h,8,'#ffb570','#ce7a2a');
    E.drawText('러너: 스페이스/터치로 점프', 12, 8, '#5a4a16', 14);
  };
  RunnerGame.prototype.getScore = function(){ return Math.floor(this.time*10); };
  Object.defineProperty(RunnerGame.prototype,'isOver',{ get(){ return this.over; }});

  // 2) Catcher Game: catch stars, avoid bombs
  function CatcherGame(){
    this.player = { x: E.width/2-30, y: E.height-90, w: 60, h: 20, speed: 360 };
    this.items = [];
    this.spawn=0; this.time=0; this.over=false; this.score=0; this.lives=3;
  }
  CatcherGame.prototype.init = function(){ this.items.length=0; this.spawn=0; this.time=0; this.over=false; this.score=0; this.lives=3; };
  CatcherGame.prototype.update = function(dt){ if(this.over) return; this.time+=dt;
    // control
    let dir=0; if(E.keys.has('arrowleft')||E.keys.has('a')) dir-=1; if(E.keys.has('arrowright')||E.keys.has('d')) dir+=1;
    if(E.mouse.down){ // drag to move
      const mx = E.mouse.x; this.player.x = E.clamp(mx - this.player.w/2, 0, E.width-this.player.w);
    } else { this.player.x = E.clamp(this.player.x + dir*this.player.speed*dt, 0, E.width-this.player.w); }
    // spawn
    this.spawn -= dt; if(this.spawn<=0){ this.spawn=E.rnd(0.4,0.9); const bad=Math.random()<0.22; this.items.push({
      x:E.rnd(10,E.width-10), y:-20, r:12, vy:E.rnd(120,220), bad
    }); }
    // move & check
    for(const it of this.items){ it.y += it.vy*dt; const box={x:this.player.x,y:this.player.y,w:this.player.w,h:this.player.h}; const b={x:it.x-it.r,y:it.y-it.r,w:it.r*2,h:it.r*2};
      if(E.aabb(box,b)){
        if(it.bad){ this.lives--; } else { this.score+=10; }
        it.y = E.height+50;
      }
    }
    // floor
    for(const it of this.items){ if(it.y>E.height+30) it.remove=true; }
    this.items = this.items.filter(i=>!i.remove);
    if(this.lives<=0) this.over=true;
  };
  CatcherGame.prototype.draw = function(){ const c=E.ctx; E.clear('#fff7d9');
    // bg dots
    c.fillStyle = '#f0deb0'; for(let y=20;y<E.height;y+=40){ for(let x=20;x<E.width;x+=40){ c.fillRect(x,y,3,3); }}
    // basket
    E.drawRoundRect(this.player.x,this.player.y,this.player.w,this.player.h,6,'#9bd1ff','#246a96');
    // items
    for(const it of this.items){ c.beginPath(); c.fillStyle = it.bad? '#ff6961':'#ffd166'; c.arc(it.x,it.y,it.r,0,Math.PI*2); c.fill(); }
    E.drawText(`캐쳐: 방향키/드래그`,12,8,'#5a4a16',14);
    E.drawText(`목숨 ${this.lives}`, E.width-12, 8, '#a12d2d', 14, 'right');
  };
  CatcherGame.prototype.getScore = function(){ return this.score; };
  Object.defineProperty(CatcherGame.prototype,'isOver',{ get(){ return this.over; }});

  // 3) Clicker Game: hit targets fast (30s)
  function ClickerGame(){ this.targets=[]; this.time=30; this.score=0; this.over=false; this.spawn=0; }
  ClickerGame.prototype.init = function(){ this.targets.length=0; this.time=30; this.score=0; this.over=false; this.spawn=0; };
  ClickerGame.prototype.update = function(dt){ if(this.over) return; this.time -= dt; if(this.time<=0){ this.time=0; this.over=true; return; }
    this.spawn -= dt; if(this.spawn<=0){ this.spawn=E.rnd(0.4,0.8); this.targets.push({ x:E.rnd(40,E.width-40), y:E.rnd(100,E.height-80), r:E.rnd(16,26), life:E.rnd(1.2,2.2)}); }
    // shrink / expire
    for(const t of this.targets){ t.life -= dt; if(t.life<=0) t.remove=true; }
    // click
    if(E.mouse.down){ const m={x:E.mouse.x, y:E.mouse.y}; for(const t of this.targets){ const dx=m.x-t.x, dy=m.y-t.y; if(dx*dx+dy*dy <= t.r*t.r){ this.score += 5; t.remove=true; }} }
    this.targets = this.targets.filter(t=>!t.remove);
  };
  ClickerGame.prototype.draw = function(){ const c=E.ctx; E.clear('#fff7e8');
    // bg waves
    c.strokeStyle = '#f2c97a'; c.lineWidth = 2; for(let i=0;i<6;i++){ c.beginPath(); for(let x=0;x<=E.width;x+=10){ const y=120+i*40 + Math.sin((x+i*20)/40)*6; if(x===0) c.moveTo(x,y); else c.lineTo(x,y);} c.stroke(); }
    // targets
    for(const t of this.targets){ c.beginPath(); c.fillStyle='#6ed0ff'; c.arc(t.x,t.y,t.r,0,Math.PI*2); c.fill(); c.beginPath(); c.strokeStyle='#1f6d86'; c.lineWidth=2; c.arc(t.x,t.y,t.r+2,0,Math.PI*2); c.stroke(); }
    E.drawText('클리커: 목표를 빠르게 터치/클릭', 12, 8, '#5a4a16', 14);
  };
  ClickerGame.prototype.getScore = function(){ return this.score; };
  Object.defineProperty(ClickerGame.prototype,'isOver',{ get(){ return this.over; }});

  // expose
  window.Games = { RunnerGame, CatcherGame, ClickerGame };
})();
