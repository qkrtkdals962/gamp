(function(){
    // 랜덤 함수 헬퍼
    function rnd(min, max) {
        return Math.random() * (max - min) + min;
    }
    
    function ClickerGame(){ 
        this.targets = []; 
        this.time = 30; // 30초로 변경
        this.score = 0; 
        this.over = false; 
        this.spawnTimer = 0; 
        
        // 통계 추적
        this.shots = 0;
        this.hits = 0;
        this.combo = 0;
        this.maxCombo = 0;
        
        // 3D 관련 변수
        this.scene = null;
        this.engine = null;
        this.canvas = null;
        this.camera = null;
        this.targetMaterials = {};
        this.targetsParent = null;
        this.particleTexture = null;
        this.isPointerDown = false;
        
        // 조준점
        this.crosshairMesh = null;
        
        // 오디오 컨텍스트
        this.audioContext = null;
        this.soundEnabled = true;
        
        // 🔫 총소리 오디오 (HTML5 Audio)
        this.gunshotAudio = null;
        
        // 🎯 카메라 감도 설정
        this.sensitivity = 5; // 기본 감도 (1~10)
    }

    // 3D 초기화
    ClickerGame.prototype.init3D = function(engine, canvas){ 
        console.log("🎯 Initializing Aim Trainer...");
        
        this.engine = engine;
        this.canvas = canvas;
        this.scene = new BABYLON.Scene(engine);
        
        // 오디오 컨텍스트 초기화
        this.initAudio();
        
        // 어두운 배경
        this.scene.clearColor = new BABYLON.Color3(0.05, 0.05, 0.08);

        // 1인칭 FPS 카메라 설정
        this.camera = new BABYLON.UniversalCamera("camera", 
            new BABYLON.Vector3(0, 1.6, -3), this.scene);
        this.camera.setTarget(new BABYLON.Vector3(0, 1.6, 5));
        
        // 🎯 관성 제거 (즉각 반응)
        this.camera.inertia = 0;
        
        // 키보드 입력만 제거 (마우스는 유지)
        this.camera.inputs.removeByType("FreeCameraKeyboardMoveInput");
        
        // 🎮 FPS 스타일 마우스 컨트롤 활성화 (noPreventDefault = true)
        this.camera.attachControl(canvas, true);
        
        // 카메라 회전 속도 조정 (감도 기반)
        this.updateSensitivity();
        this.camera.fov = 1.3; // 시야각 조정
        
        // 🎯 마우스 입력 최적화
        const mouseInput = this.camera.inputs.attached.mouse;
        if (mouseInput) {
            // 모든 마우스 버튼 허용
            mouseInput.buttons = [0, 1, 2];
        }
        
        // ⭐ CRITICAL: 총이 보이도록 near plane 조정
        this.camera.minZ = 0.01; // 기본값 1.0에서 0.01로 변경
        this.camera.maxZ = 1000;

        // 조명 설정 (더 어두운 FPS 분위기)
        const light1 = new BABYLON.HemisphericLight("light1", 
            new BABYLON.Vector3(0, 1, 0), this.scene);
        light1.intensity = 0.3;
        
        const light2 = new BABYLON.PointLight("light2", 
            new BABYLON.Vector3(0, 5, 0), this.scene);
        light2.intensity = 0.5;
        light2.diffuse = new BABYLON.Color3(0.8, 0.9, 1);

        // 배경 환경
        this.createFPSEnvironment();

        // 타겟 재질들 생성
        this.createTargetMaterials();

        // 🔫 총 모델 생성 (FPS 스타일)
        this.createGunModel();

        // 3D 조준점 생성
        this.createCrosshair();

        // 타겟 컨테이너
        this.targetsParent = new BABYLON.TransformNode("targetsParent", this.scene);
        
        // 파티클 시스템 준비
        this.setupParticleSystem();
        
        // 이벤트 연결
        canvas.addEventListener("pointerdown", this.onPointerDown.bind(this));
        canvas.addEventListener("pointerup", this.onPointerUp.bind(this));
        
        // 🔒 캔버스 클릭 시 Pointer Lock 자동 활성화
        const requestLock = () => {
            // 🔊 첫 클릭 시 오디오 활성화 (브라우저 자동재생 정책)
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume().then(() => {
                    console.log("🔊 Audio context resumed");
                });
            }
            
            // Pointer Lock 요청
            if (document.pointerLockElement !== canvas) {
                canvas.requestPointerLock = canvas.requestPointerLock || 
                                           canvas.mozRequestPointerLock || 
                                           canvas.webkitRequestPointerLock;
                if (canvas.requestPointerLock) {
                    canvas.requestPointerLock();
                }
            }
        };
        
        canvas.addEventListener("click", requestLock);
        
        // Pointer Lock 해제 시 재활성화 안내
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement !== canvas && !this.over) {
                console.log("🔓 Pointer Lock 해제됨 - 다시 클릭하세요");
            }
        });
        
        // ⌨️ 감도 조절 키 이벤트
        document.addEventListener("keydown", this.onKeyDown.bind(this));
        
        this.resetGameLogic();
        
        console.log("✅ Aim Trainer initialized!");
        
        return this.scene;
    };

    // FPS 스타일 환경 생성
    ClickerGame.prototype.createFPSEnvironment = function() {
        // 바닥 (더 넓게)
        const ground = BABYLON.MeshBuilder.CreateGround("ground", 
            {width: 40, height: 40}, this.scene);
        ground.position.y = 0;
        
        const groundMat = new BABYLON.StandardMaterial("groundMat", this.scene);
        groundMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.18);
        groundMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        ground.material = groundMat;

        // 후면 벽 (사격장 스타일)
        const wall = BABYLON.MeshBuilder.CreatePlane("wall", 
            {width: 40, height: 20}, this.scene);
        wall.position.z = 15;
        wall.position.y = 10;
        
        const wallMat = new BABYLON.StandardMaterial("wallMat", this.scene);
        wallMat.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.15);
        wallMat.emissiveColor = new BABYLON.Color3(0.03, 0.03, 0.05);
        wall.material = wallMat;

        // 측면 벽들
        const sideWallLeft = BABYLON.MeshBuilder.CreatePlane("sideWallLeft", 
            {width: 30, height: 20}, this.scene);
        sideWallLeft.position.x = -20;
        sideWallLeft.position.y = 10;
        sideWallLeft.position.z = 0;
        sideWallLeft.rotation.y = Math.PI / 2;
        sideWallLeft.material = wallMat;

        const sideWallRight = BABYLON.MeshBuilder.CreatePlane("sideWallRight", 
            {width: 30, height: 20}, this.scene);
        sideWallRight.position.x = 20;
        sideWallRight.position.y = 10;
        sideWallRight.position.z = 0;
        sideWallRight.rotation.y = -Math.PI / 2;
        sideWallRight.material = wallMat;

        // 천장
        const ceiling = BABYLON.MeshBuilder.CreatePlane("ceiling", 
            {width: 40, height: 40}, this.scene);
        ceiling.position.y = 20;
        ceiling.rotation.x = Math.PI / 2;
        ceiling.material = wallMat;

        // 바닥 그리드 라인 (FPS 느낌)
        const gridMat = new BABYLON.StandardMaterial("gridMat", this.scene);
        gridMat.diffuseColor = new BABYLON.Color3(0.2, 0.3, 0.4);
        gridMat.wireframe = true;
        gridMat.alpha = 0.3;
        
        const gridPlane = BABYLON.MeshBuilder.CreateGround("grid", 
            {width: 40, height: 40, subdivisions: 20}, this.scene);
        gridPlane.position.y = 0.01;
        gridPlane.material = gridMat;
    };

    // 타겟 재질 생성
    ClickerGame.prototype.createTargetMaterials = function() {
        // 일반 타겟 (파랑)
        this.targetMaterials.normal = new BABYLON.StandardMaterial("normalTarget", this.scene);
        this.targetMaterials.normal.diffuseColor = new BABYLON.Color3(0.2, 0.6, 1);
        this.targetMaterials.normal.emissiveColor = new BABYLON.Color3(0.1, 0.3, 0.5);

        // 빠른 타겟 (빨강)
        this.targetMaterials.fast = new BABYLON.StandardMaterial("fastTarget", this.scene);
        this.targetMaterials.fast.diffuseColor = new BABYLON.Color3(1, 0.2, 0.2);
        this.targetMaterials.fast.emissiveColor = new BABYLON.Color3(0.5, 0.1, 0.1);

        // 보너스 타겟 (금색)
        this.targetMaterials.bonus = new BABYLON.StandardMaterial("bonusTarget", this.scene);
        this.targetMaterials.bonus.diffuseColor = new BABYLON.Color3(1, 0.84, 0);
        this.targetMaterials.bonus.emissiveColor = new BABYLON.Color3(0.5, 0.42, 0);

        // 명중 시 재질
        this.targetMaterials.hit = new BABYLON.StandardMaterial("hitTarget", this.scene);
        this.targetMaterials.hit.emissiveColor = new BABYLON.Color3(2, 2, 2);
    };

    // 조준점 생성 (HTML 조준점 사용으로 비활성화)
    ClickerGame.prototype.createCrosshair = function() {
        // HTML 조준점을 사용하므로 3D 조준점은 생성하지 않음
        this.crosshairMesh = null;
    };

    // 🔫 권총 모델 생성 (GLB 파일 로드)
    ClickerGame.prototype.createGunModel = function() {
        console.log("🔫 Starting gun model creation...");
        
        // 권총 컨테이너 (카메라에 부모로 설정하여 따라다니게)
        this.gunParent = new BABYLON.TransformNode("gunParent", this.scene);
        this.gunParent.parent = this.camera;
        
        // 위치 - 화면 오른쪽 아래 끝, 화면 밖으로 많이
        this.gunParent.position = new BABYLON.Vector3(0.3, -0.35, 0.9);
        
        console.log("📂 Attempting to load: beretta_92_clean.glb");
        
        // GLB 모델 로드 시도
        BABYLON.SceneLoader.ImportMesh(
            "", 
            "", 
            "beretta_92_clean.glb",
            this.scene,
            (meshes) => {
                console.log("✅ Beretta 92 loaded successfully!");
                console.log("📦 Total meshes:", meshes.length);
                
                if (meshes && meshes.length > 0) {
                    console.log("🔧 Setting up Beretta 92...");
                    
                    // 모든 메시를 gunParent의 자식으로
                    meshes.forEach((mesh, i) => {
                        if (mesh) {
                            mesh.parent = this.gunParent;
                            mesh.isVisible = true;
                            mesh.setEnabled(true);
                        }
                    });
                    
                    this.gunMesh = meshes[0];
                    
                    // 크기 - 작지만 보이는 정도
                    this.gunParent.scaling = new BABYLON.Vector3(0.017, 0.017, 0.017);
                    
                    // 회전 조정
                   this.gunParent.rotation = new BABYLON.Vector3(
    -Math.PI / 2,
    0,
    0
);
                    console.log("✅ Beretta 92 positioned - minimal screen coverage!");
                }
            },
            null,
            (scene, message, exception) => {
                console.error("❌ Failed to load Beretta 92");
                console.error("Error:", message);
                // GLB 로딩 실패해도 총 없이 플레이 가능
            }
        );
        
        console.log("🔫 Gun loading initiated...");
    };
    
    // 총 반동 애니메이션 (권총 스타일)
    ClickerGame.prototype.playGunRecoil = function() {
        if (!this.gunParent) return;
        
        const originalPos = this.gunParent.position.clone();
        const originalRot = this.gunParent.rotation.clone();
        
        // 권총 반동 효과 (위로 튀어오름)
        const recoilZ = -0.08;  // 뒤로 밀림 (약간 적게)
        const recoilY = 0.05;   // 위로 튀어오름
        const recoilX = 0.15;   // 위로 회전 (많이)
        const duration = 0.12;
        let elapsed = 0;
        
        const animationLoop = () => {
            elapsed += this.engine.getDeltaTime() / 1000;
            const progress = Math.min(elapsed / duration, 1);
            
            if (progress < 0.25) {
                // 빠르게 뒤로 + 위로
                const t = progress / 0.25;
                this.gunParent.position.z = originalPos.z + recoilZ * t;
                this.gunParent.position.y = originalPos.y + recoilY * t;
                this.gunParent.rotation.x = originalRot.x + recoilX * t;
            } else {
                // 천천히 원위치
                const t = (progress - 0.25) / 0.75;
                this.gunParent.position.z = originalPos.z + recoilZ * (1 - t);
                this.gunParent.position.y = originalPos.y + recoilY * (1 - t);
                this.gunParent.rotation.x = originalRot.x + recoilX * (1 - t);
            }
            
            if (progress < 1) {
                requestAnimationFrame(animationLoop);
            } else {
                this.gunParent.position = originalPos;
                this.gunParent.rotation = originalRot;
            }
        };
        
        requestAnimationFrame(animationLoop);
    };

    // 총구 섬광 효과
    ClickerGame.prototype.createMuzzleFlash = function() {
        if (!this.camera || !this.gunParent) return;
        
        // 🎯 총구 위치 - Beretta 92
        const gunOffset = new BABYLON.Vector3(0.4, -0.39, 0.6);
        const muzzleWorldPos = this.camera.position.add(
            this.camera.getDirection(BABYLON.Axis.Z).scale(gunOffset.z)
                .add(this.camera.getDirection(BABYLON.Axis.X).scale(gunOffset.x))
                .add(this.camera.getDirection(BABYLON.Axis.Y).scale(gunOffset.y))
        );
        
        // 💡 포인트 라이트
        const flashLight = new BABYLON.PointLight("muzzleFlash", muzzleWorldPos, this.scene);
        flashLight.intensity = 2;
        flashLight.range = 2.5;
        flashLight.diffuse = new BABYLON.Color3(1, 0.8, 0.3);
        
        setTimeout(() => {
            flashLight.dispose();
        }, 30);
        
        // 🔥 파티클 효과 - 총구에서 앞으로 분출
        // 1️⃣ 메인 화염 파티클
        const flashParticles = new BABYLON.ParticleSystem("muzzleFlash", 25, this.scene);
        flashParticles.particleTexture = this.particleTexture;
        
        flashParticles.emitter = muzzleWorldPos; // 총구 위치
        flashParticles.minSize = 0.1;
        flashParticles.maxSize = 0.2;
        flashParticles.minLifeTime = 0.06;
        flashParticles.maxLifeTime = 0.12;
        flashParticles.emitRate = 1000;
        
        flashParticles.color1 = new BABYLON.Color4(1, 0.9, 0.4, 1);
        flashParticles.color2 = new BABYLON.Color4(1, 0.6, 0.1, 0.8);
        flashParticles.colorDead = new BABYLON.Color4(0.4, 0.2, 0, 0);
        
        // 총구에서 앞으로 강하게 분출
        flashParticles.minEmitPower = 4;
        flashParticles.maxEmitPower = 7;
        
        // 원뿔 형태로 퍼지며 앞으로
        flashParticles.createConeEmitter(0.05, Math.PI / 16);
        
        flashParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        
        // 2️⃣ 연기 파티클
        const smokeParticles = new BABYLON.ParticleSystem("muzzleSmoke", 12, this.scene);
        smokeParticles.particleTexture = this.particleTexture;
        
        smokeParticles.emitter = muzzleWorldPos;
        smokeParticles.minSize = 0.1;
        smokeParticles.maxSize = 0.2;
        smokeParticles.minLifeTime = 0.25;
        smokeParticles.maxLifeTime = 0.45;
        smokeParticles.emitRate = 400;
        
        smokeParticles.color1 = new BABYLON.Color4(0.5, 0.5, 0.5, 0.4);
        smokeParticles.color2 = new BABYLON.Color4(0.3, 0.3, 0.3, 0.25);
        smokeParticles.colorDead = new BABYLON.Color4(0.2, 0.2, 0.2, 0);
        
        smokeParticles.minEmitPower = 1.5;
        smokeParticles.maxEmitPower = 2.5;
        
        // 연기도 원뿔 형태로 앞으로
        smokeParticles.createConeEmitter(0.08, Math.PI / 12);
        
        smokeParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        
        // 모든 파티클 시작
        flashParticles.start();
        smokeParticles.start();
        
        // 파티클 정리
        setTimeout(() => {
            flashParticles.stop();
            setTimeout(() => {
                flashParticles.dispose();
            }, 150);
        }, 70);
        
        setTimeout(() => {
            smokeParticles.stop();
            setTimeout(() => {
                smokeParticles.dispose();
            }, 450);
        }, 90);
    };

    // 🎯 탄피 배출 효과 (Bullet Casing Ejection)
    ClickerGame.prototype.createBulletCasing = function() {
        if (!this.camera) return;
        
        console.log("🔫 Ejecting bullet casing...");
        
        // 탄피 배출 위치 - Beretta 92
        const ejectPos = this.camera.position.add(
    this.camera.getDirection(BABYLON.Axis.Z).scale(0.25)   // 앞
        .add(this.camera.getDirection(BABYLON.Axis.X).scale(0.15)) // 오른쪽
        .add(this.camera.getDirection(BABYLON.Axis.Y).scale(-0.1)) // 아래
);
        
        // 탄피 생성 (더 큰 실린더)
        const casing = BABYLON.MeshBuilder.CreateCylinder("casing", {
            height: 0.025,  // 0.015에서 0.045로 (3배)
            diameter: 0.012, // 0.008에서 0.024로 (3배)
            tessellation: 12 // 더 부드러운 외관
        }, this.scene);
        
        casing.position = ejectPos.clone();
        
        // 탄피 재질 (금속 느낌)
        const casingMat = new BABYLON.StandardMaterial("casingMat", this.scene);
        casingMat.diffuseColor = new BABYLON.Color3(0.8, 0.7, 0.3); // 황동색
        casingMat.specularColor = new BABYLON.Color3(0.6, 0.5, 0.2);
        casingMat.specularPower = 64;
        casing.material = casingMat;
        
        // 탄피 배출 방향 및 속도 (오른쪽 위로 튕겨나감)
        const rightDir = this.camera.getDirection(BABYLON.Axis.X);
        const upDir = this.camera.getDirection(BABYLON.Axis.Y);
        
        const ejectVelocity = rightDir.scale(2)
            .add(upDir.scale(1.5))
            .add(this.camera.getDirection(BABYLON.Axis.Z).scale(-0.5));
        
        // 회전 속도
        const rotationSpeed = new BABYLON.Vector3(
            Math.random() * 10 - 5,
            Math.random() * 10 - 5,
            Math.random() * 10 - 5
        );
        
        // 탄피 물리 애니메이션
        const startTime = Date.now();
        const lifetime = 1.5; // 1.5초간 존재
        const gravity = -9.8;
        
        const animateCasing = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            
            if (elapsed >= lifetime || !casing || casing.isDisposed()) {
                if (casing && !casing.isDisposed()) {
                    casing.dispose();
                }
                return;
            }
            
            const dt = 1/60; // 프레임 시간
            
            // 위치 업데이트 (포물선 운동)
            casing.position.addInPlace(ejectVelocity.scale(dt));
            ejectVelocity.y += gravity * dt; // 중력 적용
            
            // 회전 업데이트
            casing.rotation.addInPlace(rotationSpeed.scale(dt));
            
            // 바닥에 닿으면 튕김
            if (casing.position.y < 0.05) {
                casing.position.y = 0.05;
                ejectVelocity.y *= -0.3; // 반발계수
                ejectVelocity.x *= 0.7; // 마찰
                ejectVelocity.z *= 0.7;
                rotationSpeed.scaleInPlace(0.5);
                
                // 탄피 땅에 닿는 소리 (주석 처리 - 오류 방지)
                // this.playCasingSound();
            }
            
            // 페이드 아웃 (마지막 0.5초)
            if (elapsed > lifetime - 0.5) {
                const fadeProgress = (elapsed - (lifetime - 0.5)) / 0.5;
                casingMat.alpha = 1 - fadeProgress;
            }
            
            requestAnimationFrame(animateCasing);
        };
        
        requestAnimationFrame(animateCasing);
    };

    // 🔊 탄피 땅에 닿는 소리
    ClickerGame.prototype.playCasingSound = function() {
        if (!this.soundEnabled || !this.audioContext) return;
        
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        
        // 짧은 금속 소리
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
        
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + 0.05);
    };

    // 오디오 시스템 초기화
    ClickerGame.prototype.initAudio = function() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log("🔊 Audio system initialized");
        } catch (e) {
            console.warn("⚠️ Web Audio API not supported");
            this.soundEnabled = false;
        }
        
        // 🔫 총소리 파일 로드 (여러 인스턴스 생성 방식)
        try {
            // 프로젝트 구조상 오디오는 merged/sound/gunshot.mp3 경로에 존재
            // Audio()의 경로는 HTML 파일 기준 상대경로이므로 'sound/gunshot.mp3'로 지정
            this.gunshotAudio = new Audio('sound/gunshot.mp3');
            this.gunshotAudio.volume = 0.7; // 볼륨 70%
            this.gunshotAudio.preload = 'auto';
            
            // 로딩 완료 확인
            this.gunshotAudio.addEventListener('canplaythrough', () => {
                console.log("🔫 Gunshot sound loaded and ready!");
            });
            
            this.gunshotAudio.addEventListener('error', (e) => {
                console.error("❌ Gunshot loading error:", e);
            });
        } catch (e) {
            console.warn("⚠️ Could not load gunshot sound:", e);
        }
    };

    // 총소리 재생 (mp3 파일 사용)
    ClickerGame.prototype.playGunshot = function() {
        if (!this.gunshotAudio) {
            console.warn("⚠️ Gunshot audio not loaded");
            return;
        }
        
        try {
            // 🔫 현재 재생 중이면 처음부터 다시 시작
            this.gunshotAudio.currentTime = 0;
            this.gunshotAudio.volume = 0.7;
            
            const playPromise = this.gunshotAudio.play();
            
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log("🔊 Gunshot played successfully");
                }).catch(e => {
                    console.warn("⚠️ Could not play gunshot:", e.message);
                    // 사용자 상호작용 필요할 수 있음
                });
            }
        } catch (e) {
            console.error("❌ Gunshot playback error:", e);
        }
    };

    // 타격음 생성
    ClickerGame.prototype.playHitSound = function(isBonus) {
        if (!this.soundEnabled || !this.audioContext) return;
        
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        
        if (isBonus) {
            // 보너스 타겟 - 높은 음의 반짝이는 소리
            for (let i = 0; i < 3; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800 + i * 400, now + i * 0.05);
                
                gain.gain.setValueAtTime(0.2, now + i * 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.15);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start(now + i * 0.05);
                osc.stop(now + i * 0.05 + 0.15);
            }
        } else {
            // 일반 타겟 - 타격음
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
            
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(now);
            osc.stop(now + 0.1);
        }
    };

    // 콤보 사운드
    ClickerGame.prototype.playComboSound = function(comboCount) {
        if (!this.soundEnabled || !this.audioContext) return;
        
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        // 콤보가 높을수록 높은 음
        const frequency = 400 + Math.min(comboCount * 50, 800);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, now);
        
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + 0.2);
    };

    // 파티클 시스템 설정
    ClickerGame.prototype.setupParticleSystem = function() {
        const particleTexture = new BABYLON.DynamicTexture("particleTexture", 
            64, this.scene, false);
        const ctx = particleTexture.getContext();
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(32, 32, 30, 0, Math.PI * 2);
        ctx.fill();
        particleTexture.update();
        
        this.particleTexture = particleTexture;
    };

    // 파티클 효과 생성 (향상된 버전)
    ClickerGame.prototype.createHitParticles = function(position, isBonus) {
        // 💥 메인 폭발 파티클 (더 많고 크게)
        const particleSystem = new BABYLON.ParticleSystem("particles", 100, this.scene);
        particleSystem.particleTexture = this.particleTexture;
        
        particleSystem.emitter = position;
        particleSystem.minSize = 0.15;
        particleSystem.maxSize = isBonus ? 0.6 : 0.5;
        particleSystem.minLifeTime = 0.4;
        particleSystem.maxLifeTime = 0.9;
        particleSystem.emitRate = 500;
        
        // 색상 설정 (더 밝고 화려하게)
        if (isBonus) {
            particleSystem.color1 = new BABYLON.Color4(1, 1, 0, 1);
            particleSystem.color2 = new BABYLON.Color4(1, 0.5, 0, 1);
            particleSystem.colorDead = new BABYLON.Color4(1, 0, 0, 0);
        } else {
            particleSystem.color1 = new BABYLON.Color4(0.3, 1, 1, 1);
            particleSystem.color2 = new BABYLON.Color4(1, 1, 1, 1);
            particleSystem.colorDead = new BABYLON.Color4(0, 0.5, 1, 0);
        }
        
        particleSystem.minEmitPower = 3;
        particleSystem.maxEmitPower = 8;
        particleSystem.gravity = new BABYLON.Vector3(0, -9.81, 0);
        
        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        
        particleSystem.start();
        
        // ⭐ 스파크 파티클 (더 많고 빠르게)
        const sparkSystem = new BABYLON.ParticleSystem("sparks", 60, this.scene);
        sparkSystem.particleTexture = this.particleTexture;
        sparkSystem.emitter = position;
        sparkSystem.minSize = 0.05;
        sparkSystem.maxSize = 0.2;
        sparkSystem.minLifeTime = 0.3;
        sparkSystem.maxLifeTime = 0.6;
        sparkSystem.emitRate = 300;
        
        sparkSystem.color1 = new BABYLON.Color4(1, 1, 1, 1);
        sparkSystem.color2 = new BABYLON.Color4(1, 0.8, 0.3, 1);
        sparkSystem.colorDead = new BABYLON.Color4(1, 0.3, 0, 0);
        
        sparkSystem.minEmitPower = 5;
        sparkSystem.maxEmitPower = 12;
        sparkSystem.gravity = new BABYLON.Vector3(0, -20, 0);
        sparkSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        
        sparkSystem.start();
        
        // 🌟 빛나는 링 이펙트
        const ringSystem = new BABYLON.ParticleSystem("ring", 30, this.scene);
        ringSystem.particleTexture = this.particleTexture;
        ringSystem.emitter = position;
        ringSystem.minSize = 0.3;
        ringSystem.maxSize = 0.8;
        ringSystem.minLifeTime = 0.3;
        ringSystem.maxLifeTime = 0.5;
        ringSystem.emitRate = 200;
        
        if (isBonus) {
            ringSystem.color1 = new BABYLON.Color4(1, 0.9, 0.3, 1);
            ringSystem.color2 = new BABYLON.Color4(1, 0.6, 0, 0.8);
        } else {
            ringSystem.color1 = new BABYLON.Color4(0.5, 1, 1, 1);
            ringSystem.color2 = new BABYLON.Color4(0.2, 0.8, 1, 0.8);
        }
        ringSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0);
        
        ringSystem.minEmitPower = 1;
        ringSystem.maxEmitPower = 3;
        ringSystem.gravity = new BABYLON.Vector3(0, 0, 0);
        ringSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        
        ringSystem.start();
        
        // 💡 섬광 효과 (빛)
        const flashLight = new BABYLON.PointLight("hitFlash", position, this.scene);
        flashLight.intensity = isBonus ? 15 : 10;
        flashLight.range = 5;
        flashLight.diffuse = isBonus ? 
            new BABYLON.Color3(1, 0.8, 0) : 
            new BABYLON.Color3(0.3, 0.8, 1);
        
        // 빛 페이드 아웃
        let fadeTime = 0;
        const fadeInterval = setInterval(() => {
            fadeTime += 50;
            flashLight.intensity *= 0.7;
            if (fadeTime >= 300) {
                clearInterval(fadeInterval);
                flashLight.dispose();
            }
        }, 50);
        
        // 정리
        setTimeout(() => {
            particleSystem.stop();
            sparkSystem.stop();
            ringSystem.stop();
            setTimeout(() => {
                particleSystem.dispose();
                sparkSystem.dispose();
                ringSystem.dispose();
            }, 900);
        }, 200);
    };

    ClickerGame.prototype.resetGameLogic = function() {
        this.targets.length = 0; 
        this.time = 30; // 30초로 변경
        this.score = 0; 
        this.over = false; 
        this.spawnTimer = 0; 
        this.isPointerDown = false;
        this.shots = 0;
        this.hits = 0;
        this.combo = 0;
        this.maxCombo = 0;
        
        console.log("🔄 에임 트레이너 리셋 - 30초 시작!");
        
        if (this.targetsParent) {
            this.targetsParent.dispose(false, true);
            this.targetsParent = new BABYLON.TransformNode("targetsParent", this.scene);
        }
    };

    // 타겟 생성
    ClickerGame.prototype.spawnTarget = function(){
        const range = 8; // 좌우 범위 확대
        const zRange = 12; // 깊이 범위 확대
        
        // 타겟 타입 결정
        const rand = Math.random();
        let type, size, speed, points, life;
        
        if (rand < 0.1) { // 10% 보너스
            type = 'bonus';
            size = rnd(0.3, 0.4);
            speed = rnd(2, 3);
            points = 15;
            life = rnd(0.8, 1.2);
        } else if (rand < 0.35) { // 25% 빠른 타겟
            type = 'fast';
            size = rnd(0.4, 0.5);
            speed = rnd(1.5, 2.5);
            points = 10;
            life = rnd(1.0, 1.5);
        } else { // 65% 일반
            type = 'normal';
            size = rnd(0.5, 0.7);
            speed = rnd(0.5, 1.5);
            points = 5;
            life = rnd(1.5, 2.5);
        }

        // 구체 생성
        const sphere = BABYLON.MeshBuilder.CreateSphere("target", 
            { diameter: size * 2 }, this.scene);
        
        // 위치 설정 (FPS 시점에 맞게 조정)
        sphere.position.x = rnd(-range, range);
        sphere.position.y = rnd(1, 4); // 눈높이 기준
        sphere.position.z = rnd(3, zRange); // 앞쪽에 배치
        
        sphere.material = this.targetMaterials[type];
        sphere.parent = this.targetsParent;

        // 이동 방향
        const moveDir = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? 1 : -1);
        const moveAxis = Math.random() < 0.5 ? 'x' : 'y';

        const targetData = {
            mesh: sphere,
            life: life,
            remove: false,
            hit: false,
            type: type,
            points: points,
            speed: speed,
            moveDir: moveDir,
            moveAxis: moveAxis,
            originalPos: sphere.position.clone()
        };
        this.targets.push(targetData);
        
        console.log("🎯 Target spawned:", type, "at", sphere.position);
    };

    ClickerGame.prototype.update = function(dt){ 
        if(this.over) return; 
        
        this.time -= dt; 
        if(this.time <= 0){ 
            this.time = 0; 
            this.over = true;
            console.log("⏱️ 시간 종료! 에임 트레이너 게임오버");
            console.log("📊 최종 통계:", {
                점수: this.score,
                명중: this.hits,
                발사: this.shots,
                정확도: this.getAccuracy() + '%',
                최대콤보: this.maxCombo
            });
            return; 
        }

        // 🔫 총 위치 업데이트 (마우스 추적)
        this.updateGunPosition();

        // 타겟 생성
        this.spawnTimer -= dt; 
        if(this.spawnTimer <= 0){ 
            this.spawnTimer = rnd(0.3, 0.7);
            if (this.targets.length < 8) {
                this.spawnTarget();
            }
        }

        // 타겟 업데이트
        for(const t of this.targets){ 
            t.life -= dt; 
            if(t.life <= 0) {
                t.remove = true;
                if (!t.hit) {
                    this.combo = 0;
                }
            }
            
            // 타겟 이동
            if (t.moveDir !== 0 && !t.hit) {
                const offset = t.speed * dt * t.moveDir;
                if (t.moveAxis === 'x') {
                    t.mesh.position.x += offset;
                    if (Math.abs(t.mesh.position.x - t.originalPos.x) > 3) {
                        t.moveDir *= -1;
                    }
                } else {
                    t.mesh.position.y += offset;
                    if (Math.abs(t.mesh.position.y - t.originalPos.y) > 2) {
                        t.moveDir *= -1;
                    }
                }
            }
        }
        
        // 제거
        this.targets = this.targets.filter(t => {
            if (t.remove) {
                t.mesh.dispose();
            }
            return !t.remove;
        });

        // 🔫 총 위치 업데이트 (마우스 움직임에 반응)
        this.updateGunPosition();
        
        // 조준점 색상 변화
        this.updateCrosshairColor();
    };

    // 조준점 색상 업데이트 (HTML 조준점 사용으로 비활성화)
    ClickerGame.prototype.updateCrosshairColor = function() {
        // HTML 조준점을 사용하므로 필요 없음
    };

    // 포인터 다운 (발사)
    ClickerGame.prototype.onPointerDown = function(event){
        // 좌클릭만 발사
        if (event.button !== 0) return;
        
        console.log("🖱️ Pointer down detected!");
        
        if (this.over) {
            console.log("⚠️ Game is over, ignoring click");
            return;
        }
        
        if (this.isPointerDown) {
            console.log("⚠️ Already clicking, ignoring");
            return;
        }

        this.isPointerDown = true;
        this.shots++;
        
        // 🔫 총 반동 애니메이션
        this.playGunRecoil();
        
        // 💥 총구 섬광 효과
        this.createMuzzleFlash();
        
        // 🎯 탄피 배출 효과
        this.createBulletCasing();
        
        // 총소리 재생
        this.playGunshot();
        
        console.log("💥 Shot fired! Total shots:", this.shots);
        
        // 🎯 화면 중앙에서 레이캐스팅 (십자선 위치)
        const canvas = this.canvas;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        const pickResult = this.scene.pick(centerX, centerY);
        
        console.log("🎯 Pick result:", pickResult.hit, pickResult.pickedMesh ? pickResult.pickedMesh.name : "none");
        
        if (pickResult.hit && pickResult.pickedMesh.name === "target") {
            const hitMesh = pickResult.pickedMesh;
            
            console.log("✅ HIT TARGET!");
            
            for(const t of this.targets){
                if(t.mesh === hitMesh && !t.hit){
                    this.hits++;
                    this.combo++;
                    if (this.combo > this.maxCombo) {
                        this.maxCombo = this.combo;
                    }
                    
                    // 점수 계산 (콤보 보너스)
                    const comboBonus = Math.min(this.combo - 1, 5) * 2;
                    const totalPoints = t.points + comboBonus;
                    this.score += totalPoints;
                    
                    console.log("📊 Score +", totalPoints, "| Total:", this.score, "| Combo:", this.combo);
                    
                    t.hit = true; 
                    t.remove = true; 
                    
                    // 타격음 재생
                    this.playHitSound(t.type === 'bonus');
                    
                    // 콤보 사운드 (2콤보 이상)
                    if (this.combo >= 2) {
                        this.playComboSound(this.combo);
                    }
                    
                    // 명중 피드백
                    hitMesh.material = this.targetMaterials.hit;
                    
                    // 📳 화면 흔들림 효과
                    this.screenShake(t.type === 'bonus' ? 0.05 : 0.03);
                    
                    // 향상된 파티클 효과
                    this.createHitParticles(hitMesh.position, t.type === 'bonus');
                    
                    // 타겟이 터지는 애니메이션
                    this.animateTargetDestruction(hitMesh);
                    
                    break;
                }
            }
        } else {
            console.log("❌ Miss! No target hit");
            this.combo = 0;
        }
    };
    
    ClickerGame.prototype.onPointerUp = function(event){
        if (event.button === 0) {
            this.isPointerDown = false;
        }
    };

    // 🎯 마우스 움직임 추적 (이제는 Babylon.js가 카메라를 자동으로 회전시킴)
    // ⌨️ 키보드 이벤트 처리 (감도 조절)
    ClickerGame.prototype.onKeyDown = function(event){
        if (this.over) return; // 게임 오버 시 무시
        
        // [ 키: 감도 낮추기
        if (event.key === '[') {
            this.sensitivity = Math.max(1, this.sensitivity - 1);
            this.updateSensitivity();
            this.showSensitivity();
        }
        // ] 키: 감도 올리기
        else if (event.key === ']') {
            this.sensitivity = Math.min(10, this.sensitivity + 1);
            this.updateSensitivity();
            this.showSensitivity();
        }
    };

    // 🎯 감도 업데이트 함수
    ClickerGame.prototype.updateSensitivity = function(){
        if (!this.camera) return;
        
        // angularSensibility: 값이 클수록 느리게 회전
        // 더 낮은 값으로 조정하여 부드럽고 빠른 반응
        // 감도 1 = 1800 (매우 느림)
        // 감도 5 = 1000 (보통)
        // 감도 10 = 200 (매우 빠름)
        const sensitivity = 2000 - (this.sensitivity * 180);
        
        // 단일 감도값 사용 (대각선 문제 방지)
        this.camera.angularSensibility = sensitivity;
    };

    // 📊 감도 표시 함수
    ClickerGame.prototype.showSensitivity = function(){
        const display = document.getElementById('sensitivityDisplay');
        const valueEl = document.getElementById('sensitivityValue');
        
        if (display && valueEl) {
            valueEl.textContent = this.sensitivity;
            display.classList.remove('show');
            
            // 강제 리플로우
            void display.offsetWidth;
            
            display.classList.add('show');
            
            // 2초 후 자동 숨김
            setTimeout(() => {
                display.classList.remove('show');
            }, 2000);
        }
    };

    // 🔫 총 위치 업데이트 (카메라 방향에 따라 자연스럽게)
    ClickerGame.prototype.updateGunPosition = function(){
        if (!this.gunParent) return;
        
        // 총의 기본 위치는 카메라 기준으로 고정
        // 카메라가 회전하면 총도 자동으로 따라감 (부모-자식 관계)
        
        // 가벼운 총 흔들림 효과 (걷는 듯한 느낌)
        const time = Date.now() * 0.001;
        const bobAmount = 0.01;
        const bobSpeed = 2;
        
        // 사인파를 이용한 자연스러운 흔들림
        const bobX = Math.sin(time * bobSpeed) * bobAmount;
        const bobY = Math.abs(Math.cos(time * bobSpeed * 0.5)) * bobAmount;
        
        // 기본 위치에 흔들림 추가
        this.gunParent.position.x = 0.2 + bobX;
        this.gunParent.position.y = -0.2 + bobY;
        this.gunParent.position.z = 0.5;
        
        // 약간의 회전 효과 (더 역동적으로)
        this.gunParent.rotation.z = bobX * 0.5;
    };

    // 📳 화면 흔들림 효과
    ClickerGame.prototype.screenShake = function(intensity) {
        if (!this.camera) return;
        
        const originalPos = this.camera.position.clone();
        const duration = 0.2; // 0.2초
        let elapsed = 0;
        
        const shakeLoop = () => {
            elapsed += this.engine.getDeltaTime() / 1000;
            
            if (elapsed < duration) {
                // 랜덤 오프셋
                const progress = elapsed / duration;
                const currentIntensity = intensity * (1 - progress); // 점점 약해짐
                
                this.camera.position.x = originalPos.x + (Math.random() - 0.5) * currentIntensity;
                this.camera.position.y = originalPos.y + (Math.random() - 0.5) * currentIntensity;
                this.camera.position.z = originalPos.z + (Math.random() - 0.5) * currentIntensity;
                
                requestAnimationFrame(shakeLoop);
            } else {
                // 원래 위치로 복구
                this.camera.position.copyFrom(originalPos);
            }
        };
        
        requestAnimationFrame(shakeLoop);
    };

    // 타겟 파괴 애니메이션 (더 극적으로!)
    ClickerGame.prototype.animateTargetDestruction = function(mesh) {
        const startScale = mesh.scaling.clone();
        const startPos = mesh.position.clone();
        const duration = 0.25; // 조금 더 길게
        let elapsed = 0;
        
        // 랜덤 회전 방향
        const rotSpeedX = (Math.random() - 0.5) * 2;
        const rotSpeedY = (Math.random() - 0.5) * 2;
        const rotSpeedZ = (Math.random() - 0.5) * 2;
        
        const animationLoop = () => {
            elapsed += this.engine.getDeltaTime() / 1000;
            const progress = Math.min(elapsed / duration, 1);
            
            // 💥 더 극적인 팽창 후 폭발
            let scale;
            if (progress < 0.3) {
                // 빠르게 팽창
                scale = 1 + progress * 5; // 1 -> 2.5
            } else if (progress < 0.6) {
                // 최대 크기 유지
                scale = 2.5;
            } else {
                // 빠르게 축소하며 사라짐
                scale = 2.5 - ((progress - 0.6) / 0.4) * 2.5; // 2.5 -> 0
            }
            
            mesh.scaling.x = startScale.x * scale;
            mesh.scaling.y = startScale.y * scale;
            mesh.scaling.z = startScale.z * scale;
            
            // 🌀 빠른 회전 효과
            mesh.rotation.x += rotSpeedX;
            mesh.rotation.y += rotSpeedY;
            mesh.rotation.z += rotSpeedZ;
            
            // 📈 위로 살짝 떠오르는 효과
            mesh.position.y = startPos.y + Math.sin(progress * Math.PI) * 0.3;
            
            // 💫 투명도 감소 (후반부)
            if (progress > 0.6 && mesh.material) {
                mesh.material.alpha = 1 - ((progress - 0.6) / 0.4);
            }
            
            if (progress < 1) {
                requestAnimationFrame(animationLoop);
            }
        };
        
        requestAnimationFrame(animationLoop);
    };

    ClickerGame.prototype.draw = function(){ 
        // 3D 게임이므로 별도 draw 불필요
    };

    // 정확도 계산
    ClickerGame.prototype.getAccuracy = function() {
        if (this.shots === 0) return 0;
        return Math.round((this.hits / this.shots) * 100);
    };

    ClickerGame.prototype.getScore = function(){ return this.score; };
    
    ClickerGame.prototype.getStats = function() {
        return {
            accuracy: this.getAccuracy(),
            combo: this.combo,
            maxCombo: this.maxCombo,
            hits: this.hits,
            shots: this.shots
        };
    };
    
    Object.defineProperty(ClickerGame.prototype,'isOver',{ 
        get(){ return this.over; }
    });

    window.ClickerGame = ClickerGame;
    
    console.log("✅ ClickerGame loaded!");
})();
