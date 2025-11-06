// 최소 엔진: 캔버스, 루프, 입력(좌클릭 에지 + 휠), 유틸
(function(){
  const DPR = Math.min(2, window.devicePixelRatio || 1);

  const Engine = {
    canvas:null, ctx:null,
    width:480, height:720,
    _last:0,
    mouse:{x:0,y:0,down:false,_downEdge:false,_wheel:0},
    keys:new Set(),

    init(canvas){
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this._resize();
      window.addEventListener('resize', ()=>this._resize());

      // 마우스 포지션
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

      // 마우스 휠 (프레임 누적)
      canvas.addEventListener('wheel', (e)=>{
        e.preventDefault(); // 페이지 스크롤 방지
        this.mouse._wheel += e.deltaY; // 아래로 돌리면 +값
      }, {passive:false});

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
        // 1프레임 플래그 초기화
        this.mouse._downEdge=false;
        this.mouse._wheel=0;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },

    // 이번 프레임의 "딱 한번" 좌클릭 에지?
    consumeClick(){ return this.mouse._downEdge; },

    // 이번 프레임의 휠 누적량 가져오기(가져가면 0으로 초기화됨은 loop에서 수행)
    peekWheel(){ return this.mouse._wheel; },

    clear(col='#5fe7f1ff'){ this.ctx.fillStyle=col; this.ctx.fillRect(0,0,this.width,this.height); },

    drawText(txt,x,y,clr='#e9f1ff',size=18,align='left'){
      const c=this.ctx;
      c.fillStyle=clr; c.font=`700 ${size}px system-ui,Segoe UI,Roboto,Arial`;
      c.textAlign=align; c.textBaseline='top';
      c.fillText(txt,x,y);
    }
  };

  window.Engine = Engine;
})();
