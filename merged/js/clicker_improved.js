(function(){
    // 랜덤 함수 헬퍼
    function rnd(min, max) { return Math.random() * (max - min) + min; }
    function ClickerGame(){ 
        this.targets = []; this.time = 30; this.score = 0; this.over = false; this.spawnTimer = 0; 
        this.shots = 0; this.hits = 0; this.combo = 0; this.maxCombo = 0;
        this.scene = null; this.engine = null; this.canvas = null; this.camera = null; this.targetMaterials = {}; this.targetsParent = null; this.particleTexture = null; this.isPointerDown = false;
        this.crosshairMesh = null; this.audioContext = null; this.soundEnabled = true; this.gunshotAudio = null; this.sensitivity = 5;
        // Input handler references for clean removal
        this._boundPointerDown = null; this._boundPointerUp = null; this._boundClickLock = null; this._boundKeyDown = null; this._inputDisabled = false;
    }
    ClickerGame.prototype.init3D = function(engine, canvas){ 
        this.engine = engine; this.canvas = canvas; this.scene = new BABYLON.Scene(engine);
        this.initAudio(); this.scene.clearColor = new BABYLON.Color3(0.05, 0.05, 0.08);
        this.camera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(0, 1.6, -3), this.scene);
        this.camera.setTarget(new BABYLON.Vector3(0, 1.6, 5)); this.camera.inertia = 0; this.camera.inputs.removeByType("FreeCameraKeyboardMoveInput"); this.camera.attachControl(canvas, true);
        this.updateSensitivity(); this.camera.fov = 1.2; const mouseInput = this.camera.inputs.attached.mouse; if (mouseInput) { mouseInput.buttons = [0,1,2]; }
        this.camera.minZ = 0.01; this.camera.maxZ = 1000;
        const light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0,1,0), this.scene); light1.intensity = 0.3;
        const light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(0,5,0), this.scene); light2.intensity = 0.5; light2.diffuse = new BABYLON.Color3(0.8,0.9,1);
        this.createFPSEnvironment(); this.createTargetMaterials(); this.createGunModel(); this.createCrosshair(); this.targetsParent = new BABYLON.TransformNode("targetsParent", this.scene); this.setupParticleSystem();
        // Bind and register input listeners so we can remove them when the game ends
        this._boundPointerDown = this.onPointerDown.bind(this);
        this._boundPointerUp = this.onPointerUp.bind(this);
        canvas.addEventListener("pointerdown", this._boundPointerDown);
        canvas.addEventListener("pointerup", this._boundPointerUp);
        this._boundClickLock = () => {
          if (this.audioContext && this.audioContext.state === 'suspended') { this.audioContext.resume(); }
          if (document.pointerLockElement !== canvas) { canvas.requestPointerLock && canvas.requestPointerLock(); }
        };
        canvas.addEventListener("click", this._boundClickLock);
        this._boundKeyDown = this.onKeyDown.bind(this);
        document.addEventListener("keydown", this._boundKeyDown);
        document.addEventListener('pointerlockchange', () => { /* no-op */ });
        this.resetGameLogic(); return this.scene; };

    ClickerGame.prototype.createFPSEnvironment = function() {
      const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 40, height: 40}, this.scene); ground.position.y = 0;
      const groundMat = new BABYLON.StandardMaterial("groundMat", this.scene); groundMat.diffuseColor = new BABYLON.Color3(0.15,0.15,0.18); groundMat.specularColor = new BABYLON.Color3(0.1,0.1,0.1); ground.material = groundMat;
      const wall = BABYLON.MeshBuilder.CreatePlane("wall", {width: 40, height: 20}, this.scene); wall.position.z = 15; wall.position.y = 10;
      const wallMat = new BABYLON.StandardMaterial("wallMat", this.scene); wallMat.diffuseColor = new BABYLON.Color3(0.12,0.12,0.15); wallMat.emissiveColor = new BABYLON.Color3(0.03,0.03,0.05); wall.material = wallMat;
      const sideWallLeft = BABYLON.MeshBuilder.CreatePlane("sideWallLeft", {width: 30, height: 20}, this.scene); sideWallLeft.position.x=-20; sideWallLeft.position.y=10; sideWallLeft.position.z=0; sideWallLeft.rotation.y = Math.PI/2; sideWallLeft.material = wallMat;
      const sideWallRight = BABYLON.MeshBuilder.CreatePlane("sideWallRight", {width: 30, height: 20}, this.scene); sideWallRight.position.x=20; sideWallRight.position.y=10; sideWallRight.position.z=0; sideWallRight.rotation.y = -Math.PI/2; sideWallRight.material = wallMat;
      const ceiling = BABYLON.MeshBuilder.CreatePlane("ceiling", {width: 40, height: 40}, this.scene); ceiling.position.y = 20; ceiling.rotation.x = Math.PI/2; ceiling.material = wallMat;
      const gridMat = new BABYLON.StandardMaterial("gridMat", this.scene); gridMat.diffuseColor = new BABYLON.Color3(0.2,0.3,0.4); gridMat.wireframe = true; gridMat.alpha = 0.3;
      const gridPlane = BABYLON.MeshBuilder.CreateGround("grid", {width: 40, height: 40, subdivisions: 20}, this.scene); gridPlane.position.y=0.01; gridPlane.material = gridMat;
    };

    ClickerGame.prototype.createTargetMaterials = function(){
      this.targetMaterials.normal = new BABYLON.StandardMaterial("normalTarget", this.scene); this.targetMaterials.normal.diffuseColor = new BABYLON.Color3(0.2,0.6,1); this.targetMaterials.normal.emissiveColor = new BABYLON.Color3(0.1,0.3,0.5);
      this.targetMaterials.fast = new BABYLON.StandardMaterial("fastTarget", this.scene); this.targetMaterials.fast.diffuseColor = new BABYLON.Color3(1,0.2,0.2); this.targetMaterials.fast.emissiveColor = new BABYLON.Color3(0.5,0.1,0.1);
      this.targetMaterials.bonus = new BABYLON.StandardMaterial("bonusTarget", this.scene); this.targetMaterials.bonus.diffuseColor = new BABYLON.Color3(1,0.84,0); this.targetMaterials.bonus.emissiveColor = new BABYLON.Color3(0.5,0.42,0);
      this.targetMaterials.hit = new BABYLON.StandardMaterial("hitTarget", this.scene); this.targetMaterials.hit.emissiveColor = new BABYLON.Color3(2,2,2);
    };

    ClickerGame.prototype.createCrosshair = function(){ this.crosshairMesh = null; };

    ClickerGame.prototype.createGunModel = function(){
      // Container parent anchored to camera
      this.gunParent = new BABYLON.TransformNode("gunParent", this.scene);
      this.gunParent.parent = this.camera;
      this.gunParent.position = new BABYLON.Vector3(0.3, -0.35, 0.9);

      // Try to load external GLB model (Beretta). If unavailable, fall back to procedural model.
      let loaded = false;
      const onLoaded = (meshes)=>{
        loaded = true;
        if (meshes && meshes.length){
          meshes.forEach(m=>{ if (m){ m.parent = this.gunParent; m.isVisible = true; m.setEnabled(true);} });
          this.gunMesh = meshes[0];
          this.gunParent.scaling = new BABYLON.Vector3(0.017,0.017,0.017);
          this.gunParent.rotation = new BABYLON.Vector3(-Math.PI/2, 0, 0);
        }
      };
      const onError = ()=>{
        if (!loaded){ this.createPrimitiveGunModel(); }
      };
      try {
        BABYLON.SceneLoader.ImportMesh("", "", "beretta_92_clean.glb", this.scene, onLoaded, null, onError);
      } catch(e){ onError(); }
      // Fallback timer in case loader neither succeeds nor fails (e.g., blocked file protocol)
      setTimeout(()=>{ if(!loaded && this.gunParent && !this.gunMesh){ this.createPrimitiveGunModel(); } }, 1500);
    };

    // Simple procedural pistol model as a reliable fallback
    ClickerGame.prototype.createPrimitiveGunModel = function(){
      const slideMat = new BABYLON.StandardMaterial("slideMat", this.scene); slideMat.diffuseColor = new BABYLON.Color3(0.08,0.08,0.1); slideMat.specularColor = new BABYLON.Color3(0.4,0.4,0.45); slideMat.specularPower = 96;
      const barrelMat = new BABYLON.StandardMaterial("barrelMat", this.scene); barrelMat.diffuseColor = new BABYLON.Color3(0.1,0.1,0.12); barrelMat.specularColor = new BABYLON.Color3(0.3,0.3,0.35); barrelMat.specularPower = 128;
      const frameMat = new BABYLON.StandardMaterial("frameMat", this.scene); frameMat.diffuseColor = new BABYLON.Color3(0.15,0.15,0.17); frameMat.specularColor = new BABYLON.Color3(0.2,0.2,0.22); frameMat.specularPower = 48;
      const gripMat = new BABYLON.StandardMaterial("gripMat", this.scene); gripMat.diffuseColor = new BABYLON.Color3(0.05,0.05,0.06); gripMat.specularColor = new BABYLON.Color3(0.08,0.08,0.09); gripMat.specularPower = 32;
      const ledMat = new BABYLON.StandardMaterial("ledMat", this.scene); ledMat.emissiveColor = new BABYLON.Color3(0,0.7,1);

      const slide = BABYLON.MeshBuilder.CreateBox("slide", {width:0.06, height:0.05, depth:0.25}, this.scene); slide.parent = this.gunParent; slide.position.y=0.02; slide.position.z=0.05; slide.material = slideMat;
      const barrel = BABYLON.MeshBuilder.CreateCylinder("barrel", {diameter:0.025, height:0.12}, this.scene); barrel.parent=this.gunParent; barrel.rotation.x = Math.PI/2; barrel.position.z=0.24; barrel.position.y=0.02; barrel.material = barrelMat;
      const frame = BABYLON.MeshBuilder.CreateBox("frame", {width:0.06, height:0.08, depth:0.18}, this.scene); frame.parent=this.gunParent; frame.position.y=-0.02; frame.position.z=-0.02; frame.material = frameMat;
      const grip = BABYLON.MeshBuilder.CreateBox("grip", {width:0.05, height:0.12, depth:0.08}, this.scene); grip.parent=this.gunParent; grip.position.y=-0.1; grip.position.z=-0.08; grip.rotation.x=-0.2; grip.material = gripMat;
      const triggerGuard = BABYLON.MeshBuilder.CreateTorus("triggerGuard", {diameter:0.06, thickness:0.008, tessellation:16}, this.scene); triggerGuard.parent=this.gunParent; triggerGuard.rotation.x = Math.PI/2; triggerGuard.rotation.z = Math.PI/2; triggerGuard.position.y=-0.04; triggerGuard.position.z=0.01; triggerGuard.scaling.x=0.8; triggerGuard.scaling.y=1.2; triggerGuard.material = slideMat;
      const frontSight = BABYLON.MeshBuilder.CreateBox("frontSight", {width:0.015, height:0.025, depth:0.01}, this.scene); frontSight.parent=this.gunParent; frontSight.position.y=0.047; frontSight.position.z=0.15; frontSight.material = slideMat;
      const rearSight = BABYLON.MeshBuilder.CreateBox("rearSight", {width:0.03, height:0.02, depth:0.008}, this.scene); rearSight.parent=this.gunParent; rearSight.position.y=0.047; rearSight.position.z=-0.05; rearSight.material = slideMat;
      const hammer = BABYLON.MeshBuilder.CreateBox("hammer", {width:0.015, height:0.025, depth:0.02}, this.scene); hammer.parent=this.gunParent; hammer.position.y=0.04; hammer.position.z=-0.1; hammer.rotation.x=-0.3; hammer.material = slideMat;
      const led = BABYLON.MeshBuilder.CreateBox("led", {width:0.02, height:0.015, depth:0.015}, this.scene); led.parent=this.gunParent; led.position.x=0.035; led.position.y=0.01; led.position.z=0.08; led.material = ledMat; const led2 = BABYLON.MeshBuilder.CreateBox("led2", {width:0.02, height:0.015, depth:0.015}, this.scene); led2.parent=this.gunParent; led2.position.x=-0.035; led2.position.y=0.01; led2.position.z=0.08; led2.material = ledMat;
      this.gunMesh = slide;
      // Adjust parent closer to match our muzzle effect when using fallback
      this.gunParent.position = new BABYLON.Vector3(0.2, -0.2, 0.5);
    };

    ClickerGame.prototype.playGunRecoil = function(){ if (!this.gunParent) return; const originalPos = this.gunParent.position.clone(); const originalRot = this.gunParent.rotation.clone(); const recoilZ=-0.08, recoilY=0.05, recoilX=0.15, duration=0.12; let elapsed=0; const loop=()=>{ elapsed += this.engine.getDeltaTime()/1000; const p=Math.min(elapsed/duration,1); if(p<0.25){ const t=p/0.25; this.gunParent.position.z = originalPos.z + recoilZ*t; this.gunParent.position.y = originalPos.y + recoilY*t; this.gunParent.rotation.x = originalRot.x + recoilX*t; } else { const t=(p-0.25)/0.75; this.gunParent.position.z = originalPos.z + recoilZ*(1-t); this.gunParent.position.y = originalPos.y + recoilY*(1-t); this.gunParent.rotation.x = originalRot.x + recoilX*(1-t);} if(p<1) requestAnimationFrame(loop); else { this.gunParent.position = originalPos; this.gunParent.rotation = originalRot; } }; requestAnimationFrame(loop); };

    ClickerGame.prototype.createMuzzleFlash = function(){
      if (!this.camera || !this.gunParent) return;
      // Muzzle offset tuned for Beretta
      const gunOffset = new BABYLON.Vector3(0.4, -0.39, 0.6);
      const muzzleWorldPos = this.camera.position.add(
        this.camera.getDirection(BABYLON.Axis.Z).scale(gunOffset.z)
          .add(this.camera.getDirection(BABYLON.Axis.X).scale(gunOffset.x))
          .add(this.camera.getDirection(BABYLON.Axis.Y).scale(gunOffset.y))
      );
      const flashLight = new BABYLON.PointLight("muzzleFlash", muzzleWorldPos, this.scene);
      flashLight.intensity = 2; flashLight.range = 2.5; flashLight.diffuse = new BABYLON.Color3(1,0.8,0.3);
      setTimeout(()=>flashLight.dispose(), 30);
      // Flame
      const flashParticles = new BABYLON.ParticleSystem("muzzleFlash", 25, this.scene);
      flashParticles.particleTexture = this.particleTexture;
      flashParticles.emitter = muzzleWorldPos;
      flashParticles.minSize=0.1; flashParticles.maxSize=0.2;
      flashParticles.minLifeTime=0.06; flashParticles.maxLifeTime=0.12;
      flashParticles.emitRate=1000; flashParticles.color1=new BABYLON.Color4(1,0.9,0.4,1); flashParticles.color2=new BABYLON.Color4(1,0.6,0.1,0.8); flashParticles.colorDead=new BABYLON.Color4(0.4,0.2,0,0);
      flashParticles.minEmitPower=4; flashParticles.maxEmitPower=7; flashParticles.createConeEmitter(0.05, Math.PI/16);
      flashParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
      // Smoke
      const smokeParticles = new BABYLON.ParticleSystem("muzzleSmoke", 12, this.scene);
      smokeParticles.particleTexture = this.particleTexture; smokeParticles.emitter = muzzleWorldPos;
      smokeParticles.minSize=0.1; smokeParticles.maxSize=0.2; smokeParticles.minLifeTime=0.25; smokeParticles.maxLifeTime=0.45; smokeParticles.emitRate=400;
      smokeParticles.color1=new BABYLON.Color4(0.5,0.5,0.5,0.4); smokeParticles.color2=new BABYLON.Color4(0.3,0.3,0.3,0.25); smokeParticles.colorDead=new BABYLON.Color4(0.2,0.2,0.2,0);
      smokeParticles.minEmitPower=1.5; smokeParticles.maxEmitPower=2.5; smokeParticles.createConeEmitter(0.08, Math.PI/12); smokeParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
      flashParticles.start(); smokeParticles.start();
      setTimeout(()=>{ flashParticles.stop(); setTimeout(()=>flashParticles.dispose(),150); }, 70);
      setTimeout(()=>{ smokeParticles.stop(); setTimeout(()=>smokeParticles.dispose(),450); }, 90);
    };

    // Bullet casing ejection for extra feedback
    ClickerGame.prototype.createBulletCasing = function(){
      if (!this.camera) return;
      const ejectPos = this.camera.position.add(
        this.camera.getDirection(BABYLON.Axis.Z).scale(0.25)
          .add(this.camera.getDirection(BABYLON.Axis.X).scale(0.15))
          .add(this.camera.getDirection(BABYLON.Axis.Y).scale(-0.1))
      );
      const casing = BABYLON.MeshBuilder.CreateCylinder("casing", {height:0.025, diameter:0.012, tessellation:12}, this.scene);
      casing.position = ejectPos.clone();
      const casingMat = new BABYLON.StandardMaterial("casingMat", this.scene); casingMat.diffuseColor = new BABYLON.Color3(0.8,0.7,0.3); casingMat.specularColor = new BABYLON.Color3(0.6,0.5,0.2); casingMat.specularPower = 64; casing.material = casingMat;
      const rightDir = this.camera.getDirection(BABYLON.Axis.X); const upDir = this.camera.getDirection(BABYLON.Axis.Y);
      const ejectVelocity = rightDir.scale(2).add(upDir.scale(1.5)).add(this.camera.getDirection(BABYLON.Axis.Z).scale(-0.5));
      const rotationSpeed = new BABYLON.Vector3(Math.random()*10-5, Math.random()*10-5, Math.random()*10-5);
      const startTime = Date.now(); const lifetime = 1.5; const gravity = -9.8;
      const animate = () => {
        const elapsed = (Date.now()-startTime)/1000; if (elapsed>=lifetime || !casing || casing.isDisposed()){ if (casing && !casing.isDisposed()) casing.dispose(); return; }
        const dt = 1/60; casing.position.addInPlace(ejectVelocity.scale(dt)); ejectVelocity.y += gravity*dt; casing.rotation.addInPlace(rotationSpeed.scale(dt));
        if (casing.position.y < 0.05){ casing.position.y = 0.05; ejectVelocity.y *= -0.3; ejectVelocity.x *= 0.7; ejectVelocity.z *= 0.7; rotationSpeed.scaleInPlace(0.5); }
        if (elapsed > lifetime - 0.5){ const p = (elapsed - (lifetime-0.5))/0.5; casingMat.alpha = 1 - p; }
        requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    };

    ClickerGame.prototype.initAudio = function(){
      // Create audio context if available
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        this.soundEnabled = false;
      }

      // Default to synthesized gunshot so we always have sound
      this.playGunshot = this.playGunshotSynth.bind(this);

      // Try to load an optional MP3 from the merged/sound folder
      // Path is relative to index.html (merged/), so use 'sound/gunshot.mp3'
      if (this.audioContext) {
        fetch('sound/gunshot.mp3').then(res => {
          if (!res.ok) throw new Error('gunshot.mp3 not found');
          return res.arrayBuffer();
        }).then(buf => this.audioContext.decodeAudioData(buf)).then(decoded => {
          this.gunshotBuffer = decoded;
          this.playGunshot = this.playGunshotBuffer.bind(this);
        }).catch(() => {
          // Fallback to HTMLAudio even if AudioContext exists (useful for file:// or CORS)
          try {
            this.gunshotAudio = new Audio('sound/gunshot.mp3');
            this.gunshotAudio.volume = 0.7; this.gunshotAudio.preload = 'auto';
            this.playGunshot = () => { try { this.gunshotAudio.currentTime = 0; this.gunshotAudio.play(); } catch(e){} };
          } catch (e) {
            // keep synth fallback
          }
        });
      } else {
        // As a last resort, try HTMLAudioElement path (may be blocked by policies)
        try {
          this.gunshotAudio = new Audio('sound/gunshot.mp3');
          this.gunshotAudio.volume = 0.7; this.gunshotAudio.preload = 'auto';
          this.playGunshot = () => { try { this.gunshotAudio.currentTime = 0; this.gunshotAudio.play(); } catch(e){} };
        } catch (e) { /* no audio */ }
      }
    };

    // Play decoded AudioBuffer (if mp3 loaded successfully)
    ClickerGame.prototype.playGunshotBuffer = function(){
      if (!this.soundEnabled || !this.audioContext || !this.gunshotBuffer) { this.playGunshotSynth(); return; }
      try {
        const ctx = this.audioContext;
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        src.buffer = this.gunshotBuffer;
        gain.gain.value = 0.8;
        src.connect(gain); gain.connect(ctx.destination);
        src.start();
      } catch(e) { this.playGunshotSynth(); }
    };

    // Synthesized gunshot using noise + filter + quick envelope (no asset needed)
    ClickerGame.prototype.playGunshotSynth = function(){
      if (!this.soundEnabled || !this.audioContext) return;
      const ctx = this.audioContext;
      const now = ctx.currentTime;

      // White noise burst
      const bufferSize = 0.15; // seconds
      const sampleRate = ctx.sampleRate;
      const frameCount = Math.floor(sampleRate * bufferSize);
      const noiseBuffer = ctx.createBuffer(1, frameCount, sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i=0;i<frameCount;i++) { data[i] = (Math.random()*2 - 1) * (1 - i/frameCount); }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      // Highpass to remove low rumble, then bandpass to shape
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.9, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

      noise.connect(hp); hp.connect(bp); bp.connect(gain); gain.connect(ctx.destination);
      noise.start(now); noise.stop(now + bufferSize);

      // Low thump (oscillator) for punch
      const osc = ctx.createOscillator(); osc.type='square';
      const og = ctx.createGain(); og.gain.setValueAtTime(0.2, now);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
      osc.connect(og); og.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.12);
    };

    ClickerGame.prototype.playHitSound = function(isBonus){ if(!this.soundEnabled || !this.audioContext) return; const ctx=this.audioContext, now=ctx.currentTime; if(isBonus){ for(let i=0;i<3;i++){ const osc=ctx.createOscillator(); const gain=ctx.createGain(); osc.type='sine'; osc.frequency.setValueAtTime(800 + i*400, now + i*0.05); gain.gain.setValueAtTime(0.2, now + i*0.05); gain.gain.exponentialRampToValueAtTime(0.01, now + i*0.05 + 0.15); osc.connect(gain); gain.connect(ctx.destination); osc.start(now + i*0.05); osc.stop(now + i*0.05 + 0.15);} } else { const osc=ctx.createOscillator(); const gain=ctx.createGain(); osc.type='triangle'; osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(200, now + 0.1); gain.gain.setValueAtTime(0.25, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1); osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + 0.1);} };
    ClickerGame.prototype.playComboSound = function(combo){ if(!this.soundEnabled || !this.audioContext) return; const ctx=this.audioContext, now=ctx.currentTime; const osc=ctx.createOscillator(); const gain=ctx.createGain(); const freq = 400 + Math.min(combo*50, 800); osc.type='sine'; osc.frequency.setValueAtTime(freq, now); gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2); osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + 0.2); };

    ClickerGame.prototype.setupParticleSystem = function(){ const particleTexture = new BABYLON.DynamicTexture("particleTexture", 64, this.scene, false); const ctx = particleTexture.getContext(); ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI*2); ctx.fill(); particleTexture.update(); this.particleTexture = particleTexture; };

    ClickerGame.prototype.createHitParticles = function(position, isBonus){ const ps = new BABYLON.ParticleSystem("particles", 100, this.scene); ps.particleTexture = this.particleTexture; ps.emitter = position; ps.minSize=0.15; ps.maxSize=isBonus?0.6:0.5; ps.minLifeTime=0.4; ps.maxLifeTime=0.9; ps.emitRate=500; if(isBonus){ ps.color1=new BABYLON.Color4(1,1,0,1); ps.color2=new BABYLON.Color4(1,0.5,0,1); ps.colorDead=new BABYLON.Color4(1,0,0,0);} else { ps.color1=new BABYLON.Color4(0.3,1,1,1); ps.color2=new BABYLON.Color4(1,1,1,1); ps.colorDead=new BABYLON.Color4(0,0.5,1,0);} ps.minEmitPower=3; ps.maxEmitPower=8; ps.gravity = new BABYLON.Vector3(0,-9.81,0); ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD; ps.start(); const sp = new BABYLON.ParticleSystem("sparks", 60, this.scene); sp.particleTexture = this.particleTexture; sp.emitter = position; sp.minSize=0.05; sp.maxSize=0.2; sp.minLifeTime=0.3; sp.maxLifeTime=0.6; sp.emitRate=300; sp.color1=new BABYLON.Color4(1,1,1,1); sp.color2=new BABYLON.Color4(1,0.8,0.3,1); sp.colorDead=new BABYLON.Color4(1,0.3,0,0); sp.minEmitPower=5; sp.maxEmitPower=12; sp.gravity = new BABYLON.Vector3(0,-20,0); sp.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD; sp.start(); const ring = new BABYLON.ParticleSystem("ring", 30, this.scene); ring.particleTexture = this.particleTexture; ring.emitter = position; ring.minSize=0.3; ring.maxSize=0.8; ring.minLifeTime=0.3; ring.maxLifeTime=0.5; ring.emitRate=200; if(isBonus){ ring.color1=new BABYLON.Color4(1,0.9,0.3,1); ring.color2=new BABYLON.Color4(1,0.6,0,0.8);} else { ring.color1=new BABYLON.Color4(0.5,1,1,1); ring.color2=new BABYLON.Color4(0.2,0.8,1,0.8);} ring.colorDead=new BABYLON.Color4(0,0,0,0); ring.minEmitPower=1; ring.maxEmitPower=3; ring.gravity = new BABYLON.Vector3(0,0,0); ring.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD; ring.start(); const light = new BABYLON.PointLight("hitFlash", position, this.scene); light.intensity = isBonus?15:10; light.range=5; light.diffuse = isBonus? new BABYLON.Color3(1,0.8,0) : new BABYLON.Color3(0.3,0.8,1); let t=0; const iv=setInterval(()=>{ t+=50; light.intensity *= 0.7; if(t>=300){ clearInterval(iv); light.dispose(); } },50); setTimeout(()=>{ ps.stop(); sp.stop(); ring.stop(); setTimeout(()=>{ ps.dispose(); sp.dispose(); ring.dispose(); },900); },200); };

    ClickerGame.prototype.resetGameLogic = function(){ this.targets.length=0; this.time=30; this.score=0; this.over=false; this.spawnTimer=0; this.isPointerDown=false; this.shots=0; this.hits=0; this.combo=0; this.maxCombo=0; if (this.targetsParent) { this.targetsParent.dispose(false, true); this.targetsParent = new BABYLON.TransformNode("targetsParent", this.scene); } };

    ClickerGame.prototype.spawnTarget = function(){ const range=8, zRange=12; const rand=Math.random(); let type,size,speed,points,life; if(rand<0.1){ type='bonus'; size=rnd(0.3,0.4); speed=rnd(2,3); points=15; life=rnd(0.8,1.2);} else if(rand<0.35){ type='fast'; size=rnd(0.4,0.5); speed=rnd(1.5,2.5); points=10; life=rnd(1.0,1.5);} else { type='normal'; size=rnd(0.5,0.7); speed=rnd(0.5,1.5); points=5; life=rnd(1.5,2.5);} const sphere = BABYLON.MeshBuilder.CreateSphere("target", { diameter: size*2 }, this.scene); sphere.position.x = rnd(-range, range); sphere.position.y = rnd(1,4); sphere.position.z = rnd(3,zRange); sphere.material = this.targetMaterials[type]; sphere.parent = this.targetsParent; const moveDir = Math.random()<0.5?0:(Math.random()<0.5?1:-1); const moveAxis = Math.random()<0.5?'x':'y'; const targetData = { mesh:sphere, life:life, remove:false, hit:false, type, points, speed, moveDir, moveAxis, originalPos: sphere.position.clone() }; this.targets.push(targetData); };

    ClickerGame.prototype.update = function(dt){ if(this.over) return; this.time -= dt; if(this.time<=0){ this.time=0; this.over=true; this.disableInput(); return; } this.updateGunPosition(); this.spawnTimer -= dt; if(this.spawnTimer <= 0){ this.spawnTimer = rnd(0.3,0.7); if (this.targets.length < 8) this.spawnTarget(); }
      for(const t of this.targets){ t.life -= dt; if(t.life <= 0){ t.remove = true; if(!t.hit) this.combo = 0; } if (t.moveDir !== 0 && !t.hit){ const offset=t.speed*dt*t.moveDir; if(t.moveAxis==='x'){ t.mesh.position.x += offset; if(Math.abs(t.mesh.position.x - t.originalPos.x) > 3) t.moveDir *= -1; } else { t.mesh.position.y += offset; if(Math.abs(t.mesh.position.y - t.originalPos.y) > 2) t.moveDir *= -1; } } }
      this.targets = this.targets.filter(t=>{ if(t.remove){ t.mesh.dispose(); } return !t.remove; }); this.updateGunPosition(); };

    ClickerGame.prototype.updateCrosshairColor = function(){};

  ClickerGame.prototype.onPointerDown = function(event){ if (event.button !== 0) return; if (this.over || this.isPointerDown) return; this.isPointerDown = true; this.shots++; this.playGunRecoil(); this.createMuzzleFlash(); this.createBulletCasing(); this.playGunshot(); const canvas=this.canvas; const centerX=canvas.width/2, centerY=canvas.height/2; const pickResult = this.scene.pick(centerX, centerY); if (pickResult.hit && pickResult.pickedMesh && pickResult.pickedMesh.name === "target") { const hitMesh = pickResult.pickedMesh; for(const t of this.targets){ if(t.mesh===hitMesh && !t.hit){ this.hits++; this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); const comboBonus = Math.min(this.combo - 1, 5) * 2; const totalPoints = t.points + comboBonus; this.score += totalPoints; t.hit=true; t.remove=true; this.playHitSound(t.type==='bonus'); if (this.combo >= 2) { this.playComboSound(this.combo); } hitMesh.material = this.targetMaterials.hit; this.screenShake(t.type==='bonus'?0.05:0.03); this.createHitParticles(hitMesh.position, t.type==='bonus'); this.animateTargetDestruction(hitMesh); break; } } } else { this.combo = 0; } };
    ClickerGame.prototype.onPointerUp = function(event){ if (event.button === 0) this.isPointerDown = false; };

    ClickerGame.prototype.onKeyDown = function(event){ if (this.over) return; if (event.key === '['){ this.sensitivity = Math.max(1, this.sensitivity - 1); this.updateSensitivity(); this.showSensitivity(); } else if (event.key === ']'){ this.sensitivity = Math.min(10, this.sensitivity + 1); this.updateSensitivity(); this.showSensitivity(); } };
    ClickerGame.prototype.updateSensitivity = function(){ if(!this.camera) return; const sensitivity = 2000 - (this.sensitivity * 180); this.camera.angularSensibility = sensitivity; };
    ClickerGame.prototype.showSensitivity = function(){ const display=document.getElementById('sensitivityDisplay'); const valueEl=document.getElementById('sensitivityValue'); if(display && valueEl){ valueEl.textContent=this.sensitivity; display.classList.remove('show'); void display.offsetWidth; display.classList.add('show'); setTimeout(()=>display.classList.remove('show'),2000); } };

    ClickerGame.prototype.updateGunPosition = function(){ if (!this.gunParent) return; const time=Date.now()*0.001; const bobAmount=0.01, bobSpeed=2; const bobX=Math.sin(time*bobSpeed)*bobAmount; const bobY=Math.abs(Math.cos(time*bobSpeed*0.5))*bobAmount; this.gunParent.position.x = 0.2 + bobX; this.gunParent.position.y = -0.2 + bobY; this.gunParent.position.z = 0.5; this.gunParent.rotation.z = bobX * 0.5; };
    ClickerGame.prototype.screenShake = function(intensity){ if(!this.camera) return; const originalPos=this.camera.position.clone(); const duration=0.2; let elapsed=0; const loop=()=>{ elapsed += this.engine.getDeltaTime()/1000; if(elapsed<duration){ const p=elapsed/duration; const ci=intensity*(1-p); this.camera.position.x = originalPos.x + (Math.random()-0.5)*ci; this.camera.position.y = originalPos.y + (Math.random()-0.5)*ci; this.camera.position.z = originalPos.z + (Math.random()-0.5)*ci; requestAnimationFrame(loop); } else { this.camera.position.copyFrom(originalPos); } }; requestAnimationFrame(loop); };
    ClickerGame.prototype.animateTargetDestruction = function(mesh){ const startScale=mesh.scaling.clone(); const startPos=mesh.position.clone(); const duration=0.25; let elapsed=0; const rx=(Math.random()-0.5)*2, ry=(Math.random()-0.5)*2, rz=(Math.random()-0.5)*2; const loop=()=>{ elapsed += this.engine.getDeltaTime()/1000; const p=Math.min(elapsed/duration,1); let scale; if(p<0.3){ scale = 1 + p*5; } else if(p<0.6){ scale = 2.5; } else { scale = 2.5 - ((p-0.6)/0.4)*2.5; } mesh.scaling.x=startScale.x*scale; mesh.scaling.y=startScale.y*scale; mesh.scaling.z=startScale.z*scale; mesh.rotation.x += rx; mesh.rotation.y += ry; mesh.rotation.z += rz; mesh.position.y = startPos.y + Math.sin(p*Math.PI)*0.3; if(p>0.6 && mesh.material){ mesh.material.alpha = 1 - ((p-0.6)/0.4); } if(p<1) requestAnimationFrame(loop); }; requestAnimationFrame(loop); };

    ClickerGame.prototype.draw = function(){};
    ClickerGame.prototype.getAccuracy = function(){ if(this.shots===0) return 0; return Math.round((this.hits/this.shots)*100); };
    ClickerGame.prototype.getScore = function(){ return this.score; };
    ClickerGame.prototype.getStats = function(){ return { accuracy: this.getAccuracy(), combo: this.combo, maxCombo: this.maxCombo, hits: this.hits, shots: this.shots }; };
    Object.defineProperty(ClickerGame.prototype,'isOver',{ get(){ return this.over; }});
    
    // Disable input and pointer lock when the round ends or on scene exit
    ClickerGame.prototype.disableInput = function(){
      if (this._inputDisabled) return; this._inputDisabled = true;
      const canvas = this.canvas;
      try {
        if (canvas){
          if (this._boundPointerDown) canvas.removeEventListener('pointerdown', this._boundPointerDown);
          if (this._boundPointerUp) canvas.removeEventListener('pointerup', this._boundPointerUp);
          if (this._boundClickLock) canvas.removeEventListener('click', this._boundClickLock);
          // prevent canvas from catching clicks while game over overlay is shown
          canvas.style.pointerEvents = 'none';
        }
        if (this._boundKeyDown) document.removeEventListener('keydown', this._boundKeyDown);
        if (document.pointerLockElement === canvas && document.exitPointerLock){ document.exitPointerLock(); }
      } catch(e){}
    };

    // Optional stopAudio hook used by scene manager on exit; also cleanup inputs
    ClickerGame.prototype.stopAudio = function(){
      try {
        if (this.audioContext && this.audioContext.state === 'running'){ this.audioContext.suspend(); }
      } catch(e){}
      this.disableInput();
    };
    window.ClickerGame = ClickerGame;
})();
