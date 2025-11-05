# 미니게임 허브 (Runner + Aim Trainer)

두 프로젝트(GameProject, gamp_clicker)를 합쳐 러너와 에임 트레이너 두 게임을 하나의 페이지에서 선택해 즐길 수 있도록 통합했습니다.

## 구성
- 러너: 2D 캔버스 러닝 게임 (고급 버전: 레벨업 카드, 로켓, 실드, 라이프 포함)
- 에임 트레이너: Babylon.js 기반 3D 타겟 슈팅 (30초 제한, 콤보/정확도 통계)

## 실행 방법
- `merged/index.html` 파일을 브라우저로 열어 실행 (로컬 파일로 열어도 동작)
- 또는 정적 서버로 열기 (권장)

```cmd
:: PowerShell이 아닌 cmd.exe 기준 예시 (Python 내장 서버)
:: 프로젝트 루트(d:\margeGame)에서
python -m http.server 5173
:: 브라우저에서 http://localhost:5173/merged/ 접속
```

## 단축키/조작
- 러너: 스페이스/위=점프(꾹 누르면 높이), 아래=슬라이딩/급강하, R은 사용하지 않음(좌상단 메뉴 버튼 사용)
- 에임 트레이너: 좌클릭 발사, [ / ] 로 감도 조절, 첫 클릭 시 포인터락 및 오디오 활성화

## 에셋
- 러너 이미지: `../GameProject/assets/images/` 경로의 에셋을 사용 (중복 복사 없음)
- 에임 트레이너 총소리: `merged/js/gunshot.mp3` 파일이 있으면 재생됩니다. (없어도 게임 진행 가능)

## 참고
- 기존 폴더는 그대로 유지하며, `merged/` 가 통합 허브 역할을 합니다.
- 필요 시 러너 배경 이미지는 `GameProject/assets/images/반복배경.jpg` 등이 자동으로 탐색됩니다.
