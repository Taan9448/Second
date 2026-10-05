# 천외검결 — 새 프로젝트

턴제 파티 덱빌딩 전략 카드 게임. 이 저장소는 2026-10-04 설계 검토부터 새로 시작한다.

현재는 **첫 플레이 버전 v0.1**이다. 승인한 SD 픽셀 디자인 목업을 실제 브라우저 화면으로 구현했다. 메인·로비·준비 덱·이야기·1스테이지 분기 원정·전투·보상·야영·보스·3인 전투 연습을 플레이할 수 있다. 전체 게임의 완성은 아니다.

TypeScript + React + Vite, 순수 전투 엔진, IndexedDB 자동 저장을 사용한다. 강화·소모품·유물은 기본 시스템 뒤에 구현한다. 현재 규칙의 임시 수치와 미구현 범위는 [첫 버전 구현 기준](docs/IMPLEMENTATION_V01.md)에 기록했다.

## 실행과 확인

```bash
cd /workspace/Second
npm ci
npm run dev
```

실행한 환경에서 http://localhost:5173 을 연다. 외부에 배포한 공개 URL은 없다. 메인의 **여정 시작 → 빈 저장 슬롯 → 원정 떠나기**로 첫 번째 장을 플레이한다. 로비의 **세 캐릭터 전투 연습**은 본편 저장과 분리된다. 로컬 저장은 브라우저와 origin에 종속된다.

```bash
npm test
npm run build
# dev 서버가 실행 중이어야 한다. 시스템 Chromium 경로를 바꿀 때는 CHROMIUM_PATH를 설정한다.
npm run test:browser
```

단축키: `1~9/0` 카드 선택, `Esc` 취소, `E` 턴 종료, `D/F/X/P` 더미, `L` 로그. 기본 브라우저 포커스로도 대상을 선택할 수 있다.

## 설계 문서

- [요구사항·규칙·결정 대기](docs/RULES.md)
- [기본 규칙 검토안·후속 기능 보류](docs/RULE_PROPOSALS.md)
- [코드 구조·전투·저장 설계](docs/ARCHITECTURE.md)
- [스토리·15스테이지 초안](docs/STORY.md)
- [세계관·동기·복선·필수 장면 상세](docs/STORY_DETAILS.md)
- [연속 이벤트와 독립 사건40개 초안](docs/EVENT_STORIES.md)
- [모듈형 스테이지 경로와 반복 플레이 초안](docs/EXPEDITION_MODULES.md)
- [상용 게임 비교·보완 우선순위·노말 엔딩 시간 예상](docs/COMMERCIAL_REVIEW.md)
- [화면·픽셀 아트 설계](docs/PRESENTATION.md)
- [구현 순서·검수·진행표](docs/PROGRESS.md)
- [현재 작업 인계](docs/HANDOFF.md)

Claude와 Codex 모두 작업 시작 전에 [AGENTS.md](AGENTS.md)와 인계 문서를 읽는다. 각 도구의 파일 자동 로딩 여부에 의존하지 않고, 시작 프롬프트에 해당 파일 읽기를 명시한다.

## 디자인 기준

[승인한 목업과 기준](design/mockups/README.md), [에셋 출처와 규격](public/art/README.md)을 확인한다. 이전 수작업 임시 아트는 사용하지 않는다. 현재 스프라이트 동작은 CSS 이동·타격 표현이며 프레임별 동작 에셋은 후속 제작이다.
