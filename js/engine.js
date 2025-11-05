// 최소 엔진: 캔버스, 루프, 입력(좌클릭 에지), 유틸
(function(){
  const DPR = Math.min(2, window.devicePixelRatio || 1);

  const Engine = {
    canvas:null, ctx:null,
    width:480, height:720,
    _last:0,
    mouse:{x:0,y:0,down:false,_downEdge:false},
    keys:new Set(),

    init(canvas){
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this._resize();
      window.addEventListener('resize', ()=>this._resize());

      // 마우스
      const getPos = (cx,cy)=>{
        const r = canvas.getBoundingClientRect();
        return {
          x:(cx-r.left) * (this.width / r.width),
          y:(cy-r.top)  * (this.height/ r.height),
        };
      };
      canvas.addEventListener('mousemove', e=>{
        const p=getPos(e.clientX, e.clientY);
        this.mouse.x=p.x; this.mouse.y=p.y;
      });
      canvas.addEventListener('mousedown', e=>{
        const p=getPos(e.clientX, e.clientY);
        this.mouse.x=p.x; this.mouse.y=p.y;
        if(!this.mouse.down){ this.mouse._downEdge = true; }
        this.mouse.down=true;
      });
      window.addEventListener('mouseup', ()=>{
        this.mouse.down=false;
      });

      // 키
      window.addEventListener('keydown', e=>this.keys.add(e.key.toLowerCase()));
      window.addEventListener('keyup',   e=>this.keys.delete(e.key.toLowerCase()));
    },

    _resize(){
      const c=this.canvas;
      c.width=Math.floor(this.width*DPR);
      c.height=Math.floor(this.height*DPR);
      this.ctx.setTransform(DPR,0,0,DPR,0,0);
    },

    loop(step){
      const tick=(t)=>{
        const dt=Math.min(0.033,(t-this._last)/1000 || 0);
        this._last=t;
        step(dt);
        // 클릭 에지 플래그 소거(프레임당 1번만 true)
        this.mouse._downEdge=false;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },

    // 이번 프레임의 "딱 한번" 클릭(다운) 에지인지 반환
    consumeClick(){ return this.mouse._downEdge; },

    clear(col='#0b1020'){ this.ctx.fillStyle=col; this.ctx.fillRect(0,0,this.width,this.height); },

    drawText(txt,x,y,clr='#e9f1ff',size=18,align='left'){
      const c=this.ctx;
      c.fillStyle=clr; c.font=`700 ${size}px system-ui,Segoe UI,Roboto,Arial`;
      c.textAlign=align; c.textBaseline='top';
      c.fillText(txt,x,y);
    }
  };

  window.Engine = Engine;
})();
