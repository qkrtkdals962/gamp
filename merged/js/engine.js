(function(){
  // Basic 2D canvas engine and helpers
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const Engine = {
    canvas: null,
    ctx: null,
    width: 480,
    height: 720,
    now: 0,
    dt: 0,
    acc: 0,
    running: false,
    keys: new Set(),
  mouse: { x:0, y:0, down:false, _downEdge:false, _wheel:0 },
    onResize(){
      const c = Engine.canvas;
      const w = Engine.width, h = Engine.height;
      c.width = Math.floor(w * DPR);
      c.height = Math.floor(h * DPR);
      Engine.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    },
    init(canvas){
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.onResize();
      window.addEventListener('resize', ()=>this.onResize());
      // keyboard
      window.addEventListener('keydown', e=>{ this.keys.add(e.key.toLowerCase()); });
      window.addEventListener('keyup', e=>{ this.keys.delete(e.key.toLowerCase()); });
      // mouse / touch
      const getPos = (clientX, clientY)=>{
        const rect = this.canvas.getBoundingClientRect();
        const x = (clientX - rect.left) * (this.width / rect.width);
        const y = (clientY - rect.top) * (this.height / rect.height);
        return { x, y };
      };
      this.canvas.addEventListener('mousemove', e=>{ this.mouse = { ...this.mouse, ...getPos(e.clientX, e.clientY) }; });
      this.canvas.addEventListener('mousedown', e=>{
        const pos = getPos(e.clientX, e.clientY);
        const wasDown = this.mouse.down;
        this.mouse = { ...this.mouse, down:true, ...pos };
        if(!wasDown) this.mouse._downEdge = true;
      });
      this.canvas.addEventListener('mouseup', ()=>{ this.mouse.down = false; });
      this.canvas.addEventListener('mouseleave', ()=>{ this.mouse.down = false; });
      // wheel accumulation (positive when wheel down)
      this.canvas.addEventListener('wheel', (e)=>{
        e.preventDefault();
        this.mouse._wheel += e.deltaY;
      }, { passive:false });
      this.canvas.addEventListener('touchstart', e=>{ const t = e.changedTouches[0]; this.mouse = { ...this.mouse, down:true, ...getPos(t.clientX, t.clientY) }; });
      this.canvas.addEventListener('touchmove', e=>{ const t = e.changedTouches[0]; this.mouse = { ...this.mouse, ...getPos(t.clientX, t.clientY) }; });
      this.canvas.addEventListener('touchend', ()=>{ this.mouse.down = false; });
    },
    loop(step){
      let last = performance.now();
      this.running = true;
      const tick = (t)=>{
        if(!this.running) return;
        const dt = (t - last) / 1000;
        last = t;
        step(dt);
        // reset per-frame edge/wheel flags
        this.mouse._downEdge = false;
        this.mouse._wheel = 0;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    clear(color = '#fff6cf'){
      this.ctx.fillStyle = color; this.ctx.fillRect(0,0,this.width,this.height);
    },
    rnd(min, max){ return Math.random()*(max-min)+min; },
    clamp(v, a, b){ return Math.max(a, Math.min(b, v)); },
    aabb(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; },
    drawText(text, x, y, color='#2a2106', size=18, align='left'){
      const c = this.ctx;
      c.fillStyle = color;
      c.font = `bold ${size}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      c.textAlign = align; c.textBaseline = 'top';
      c.fillText(text, x, y);
    },
    drawRoundRect(x,y,w,h,r,fill='#ffeaa1',stroke='#e2c546'){
      const c = this.ctx; c.beginPath();
      const rr = Math.min(r, w/2, h/2);
      c.moveTo(x+rr,y); c.arcTo(x+w,y,x+w,y+h,rr); c.arcTo(x+w,y+h,x,y+h,rr);
      c.arcTo(x,y+h,x,y,rr); c.arcTo(x,y,x+w,y,rr); c.closePath();
      c.fillStyle = fill; c.fill(); c.lineWidth = 2; c.strokeStyle = stroke; c.stroke();
    },
    // one-frame click edge, consumed by callers
    consumeClick(){ return this.mouse._downEdge; },
    // wheel delta accumulated this frame (positive means wheel moved down)
    peekWheel(){ return this.mouse._wheel; }
  };

  // Scene manager
  function SceneManager(){ this.current = null; }
  SceneManager.prototype.set = function(scene){
    if(this.current && this.current.onExit) this.current.onExit();
    this.current = scene; if(scene.onEnter) scene.onEnter();
  };
  SceneManager.prototype.update = function(dt){ if(this.current && this.current.update) this.current.update(dt); };
  SceneManager.prototype.draw = function(){ if(this.current && this.current.draw) this.current.draw(); };

  // Expose
  window.Engine = Engine;
  window.SceneManager = SceneManager;
})();
