> 최신 상태: 2026-10-05 게임 제작이 승인되어 첫 플레이 버전을 구현했다. 실제 기술과 도메인/콘텐츠/명령/저장/화면 경계는 IMPLEMENTATION_V01을 따른다. 아래의 전체 구조는 장기 설계이며 아직 없는 모듈도 포함한다.

# 코드 설계

상태: PC 브라우저용 설계 초안. 아래 디렉터리와 타입은 예정 구조이며 아직 구현되어 있지 않다.

갱신: 2026-10-05. 이번 요청은 **코드 작성 없이 초안만**이다. 기본 캠페인·파티·덱·전투·모듈형 원정·선택 기록·저장을 먼저 잡고 강화·소모품·유물은 이후 확장한다. 아래 전체 목표 구조의 economy/relics/consumables·강화 필드는 장기 배치 설명이며 초기 구현 필수 모듈이 아니다. 후속 기능을 위해 처음부터 일반적인 플러그인 프레임워크를 만들 필요는 없다.

모듈형 지도와 이벤트 연결의 상세 기획은 [EXPEDITION_MODULES](EXPEDITION_MODULES.md)와 [EVENT_STORIES](EVENT_STORIES.md)를 따른다. StageBlueprint의 필수 장면, RouteModule의 작은 그래프, RoomTemplate의 내용 후보를 분리하고 캠페인 사실과 원정 시도의 미확정 선택도 구분한다. 강화 수치 표는 현재 설계에서 철회했다.

## 1. 권장 기술 구성

| 영역 | 선택 | 목적 |
| --- | --- | --- |
| 언어 | TypeScript strict | 카드 효과·명령·상태의 누락과 잘못된 연결 검출 |
| 앱 구성 | Vite + React | 로비·카드·지도·설정·도감과 빠른 브라우저 확인 |
| 전투 무대 | PixiJS | 픽셀 스프라이트, 타일 배경, 전투 애니메이션·효과 |
| 데이터 검증 | Zod | 콘텐츠와 저장의 런타임 스키마 검증 |
| 저장 | IndexedDB + idb | 상태·거래 기록을 원자적으로 저장 |
| 검수 | Vitest + fast-check + Playwright | 규칙·불변조건·브라우저 동작 검증 |

UI용 상태 라이브러리는 처음부터 추가하지 않는다. React는 엔진의 읽기 전용 스냅샷을 구독하고 명령을 보낸다. 실제 패키지 버전은 프로젝트 초기화 때 호환성을 확인해 lockfile에 고정한다. 초기 버전에는 서버나 로그인 없이 로컬 저장을 사용하고, 내보내기/가져오기를 제공한다. PC 앱 포장은 이후 별도 실행 방식 결정이다.

React의 DOM은 텍스트·카드·버튼·접근성에, PixiJS는 전투 무대에 사용한다. 둘이 서로의 상태를 직접 변경하지 않는다. 픽셀 그림 때문에 한글 텍스트까지 낮은 해상도로 만들지 않는다.

## 2. 모듈 배치

```text
src/
  app/                   부팅, 라우팅, 슬롯 선택, 구성 연결
  domain/
    ids.ts               ID 타입과 검증
    commands.ts          플레이어의 명령
    events.ts            판정 결과와 발생 사건
    combat/              턴, 효과, 피해, 카드 구역, 적 의도, 종료
    deck/                준비 덱 검증, 스테이지 복사, 카드 수명
    party/               합류, 편성, 쓰러짐, 영구 사망
    expedition/          그래프 생성, 방 전이, 방별 해결
    economy/             구매, 판매 정책, 강화 거래, 보상
    progression/         이야기, 해금, 업적, 통계
    rng/                 시드 난수, 스트림과 버전
  content/
    schemas/             카드·적·유물·아이템·이벤트 등의 스키마
    cards/               brush, elements, paladin, common, combos
    enemies/             일반, 정예, 중간보스, 보스
    relics/ consumables/ events/ stages/ story/ achievements/ gifts/
    balance/             강화 표, 난이도, 경제 상수
    registry.ts          참조 무결성과 개수 검증
  application/           command handler, 저장 거래, 구독, 중복 차단
  persistence/           스키마, 마이그레이션, IndexedDB, 백업
  presentation/
    screens/             title, lobby, deck, world, expedition, battle 등
    components/          카드, 대상 선택, 더미, 로그, 선택창
    view-models/         사용 불가 사유, 예고, 계산 내역
  renderer/              Pixi 무대, 스프라이트, 애니메이션 큐
  assets/                manifest, 팔레트, sprite atlas
tests/                   domain, content, persistence, e2e
docs/                    규칙, 설계, 결정, 진행, 인계
```

`domain`은 React·Pixi·DOM·IndexedDB를 import하지 않는다. 저장과 렌더러는 도메인을 사용하지만 도메인은 이들을 모른다. 콘텐츠는 스키마로 검증한 선언 데이터이며, 임의 문자열 스크립트를 실행하지 않는다. 특수 보스는 이름 있는 도메인 핸들러로 확장한다. 모듈을 작은 파일로 나누되 기능을 찾기 어렵게 과도하게 분할하지 않는다.

## 3. 주요 데이터 모델

```ts
// 형태를 설명하는 축약 예시. 실제 선언과 검증기는 다음 구현 단계에 작성한다.
type CardDefinition = {
  id: CardDefinitionId;
  owner: CharacterId | 'common' | 'combo';
  rarity: Rarity;
  school: 'martial' | 'magic' | 'fusion';
  type: CardType;
  elements: Element[];
  baseCost: number;
  targetRule: TargetRule;
  conditions: Condition[];
  effects: Effect[];
  keywords: Keyword[];
  upgradeRuleId: UpgradeRuleId;
};

type DeckEntry = {
  entryId: DeckEntryId;
  definitionId: CardDefinitionId;
  upgrade: number;
  origin: CardOrigin;
};

type CombatCardInstance = {
  instanceId: CardInstanceId;
  deckEntryId?: DeckEntryId;
  definitionId: CardDefinitionId;
  ownerId: CharacterId | 'common' | 'combo';
  upgrade: number;
  costModifiers: TimedModifier[];
  keywordModifiers: TimedModifier[];
  lifetime: 'battle' | 'stage';
  origin: CardOrigin;
};

type CombatState = {
  battleId: BattleId;
  phase: CombatPhase;
  round: number;
  party: Combatant[];
  enemies: Combatant[];
  sharedEnergy: number; // 공용 에너지안 검토 후 확정
  cards: Record<CardInstanceId, CombatCardInstance>;
  zones: CardZones;
  effectQueue: SerializableEffect[];
  pendingChoice?: PendingChoice;
  declaredIntents: EnemyIntent[];
  rng: RngSnapshot;
  outcome?: BattleOutcome;
};
```

소유 카드 종류의 영구 수집 기록, 준비 덱의 사본, 원정 덱의 사본, 전투 인스턴스는 별개다. 영구 강화가 종류 전체에 적용되는지 사본에 적용되는지는 규칙 검토 후 필드를 고정한다. 영구 소유와 원정 임시 획득을 `origin`으로 구분해 복귀 시 오염을 막는다.

`SaveSlot`은 mode·campaign·collection·preparedDecks·party·activeExpedition을 갖는다. `ExpeditionState`는 stageDecks·map·currentNode·partyHealth·temporaryEffects·shops·rooms·receipts·activeCombat을 갖는다. 상태 안에 함수, DOM 객체, 이미지 객체, Date 객체를 넣지 않는다.

## 4. 명령 → 판정 → 저장 → 표시

```text
클릭 / 드래그 / 키보드
  → 동일한 명령 생성
  → ID·phase·대상·자원·조건 검증
  → 순수 엔진에서 다음 상태 + 사건 계산
  → 스냅샷·명령 영수증·RNG를 같은 저장 거래로 기록
  → 새 스냅샷을 공개
  → UI 갱신 및 사건 기반 애니메이션
```

주요 명령은 `PlayCard`, `ChooseTargets`, `ResolveChoice`, `UseConsumable`, `EndTurn`, `ChooseNextRoom`, `ChooseReward`, `ChooseEventOption`, `BuyItem`, `UpgradeCard`, `ChangePreparedParty`다. 화면에서만 취소 가능한 대상 선택은 게임 명령 이전의 UI 상태다.

명령에 `commandId`와 `expectedRevision`을 붙여 더블클릭과 오래된 입력을 거절한다. 실패는 `NOT_YOUR_TURN`, `INSUFFICIENT_ENERGY`, `OWNER_DOWN`, `INVALID_TARGET`, `CHOICE_PENDING`, `SAVE_UNAVAILABLE` 등 코드로 반환하고 UI에서 이유를 설명한다.

돈·아이템·보상·강화는 별도 클릭 콜백에서 바로 변경하지 않는다. 방의 한 번뿐인 결과는 `runId/nodeId/resolutionId`, 강화 시도는 `attemptId`, 전투 종료는 `battleId/outcomeId`로 거래를 식별한다.

저장 실패 시 상태를 성공한 것처럼 공개하지 않는다. 재시도·백업·저장 없이 플레이 선택은 명시적인 사용자 흐름으로 설계한다. 특히 하드코어/일일은 저장 불가 안내와 진행 정책이 필요하다. 앱 종료 이벤트에만 자동 저장을 의존하지 않는다.

애니메이션은 이미 확정된 사건을 재생한다. 애니메이션 완료 콜백이 피해나 보상을 발생시키지 않는다. 새로고침 복구 시 연출을 생략해도 상태와 다음 행동은 동일하다.

## 5. 효과와 트리거

`Effect`는 판별 가능한 union으로 설계한다. 최소 범주는 피해/다단히트/보호막/회복/상태/자원/드로우/카드 이동/생성/비용 변경/지속 등록/선택/미리 보기/무작위/적 소환·변이/보상/원정 임시 효과/이야기·친밀도다.

조건은 소유자 생존·편성·체력·표식·원소 잔향·필요 카드 구역·이야기 해금·재화 등으로 구조화한다. `if (card.name === ...)` 방식으로 규칙을 연결하지 않는다.

트리거 후보: `BattleStarted`, `PlayerTurnStarted`, `CardPlayed`, `DamageTaken`, `Healed`, `UnitKilled`, `CardExhausted`, `PlayerTurnEnded`, `RoundEnded`, `BattleEnded`, `RewardGenerated`.

트리거 실행 순서·중첩·타격 단위는 규칙 문서에서 확정한다. 구현은 명시적 phase와 안정된 priority/등록 순번을 사용한다. 같은 사건에서 일회성 유물을 여러 번 소비하지 않는다. 구독 등록/해제도 상태에 포함한다.

무한 연계 감지 시 임의로 효과를 조용히 생략하지 않는다. 진단과 안전 복구 상태를 남기고, 재현 가능한 seed·명령 목록으로 콘텐츠 결함을 수정한다. 유효한 연계에 대한 상한을 추가하려면 별도 규칙 검토가 필요하다.

## 6. 피해 계산과 예고

공통 `DamageService`가 결과뿐 아니라 계산 내역을 반환한다. 기본식에서 어떤 단계가 추가됐는지 UI와 로그로 확인할 수 있어야 한다. 미리보기는 읽기 전용 가상 계산이며 실제 RNG·트리거 횟수·상태를 소비하지 않는다.

다단히트 전체 피해는 첫 타격 피해×횟수로 단순 계산하지 않는다. 방어막·사망·원소·반격이 도중에 달라지는 경우 같은 엔진의 복제 상태에서 순서대로 예측한다. 숨겨진 확률 분기는 가능한 결과와 불확실성을 표시한다.

적은 `EnemyBrainState`로 패턴을 선택하고 `EnemyIntent`에 행동·현재 대상·타격·추가 효과를 담는다. 예고와 실제 실행은 같은 대상·효과 해석기를 사용한다. 대상 사망·도발·차지 취소·체력 패턴 전환 후 수정 예고를 공개하며, 매번 새 무작위 패턴을 뽑지 않는다.

## 7. 종료 판정

사망·반격·소환의 해결 순서를 먼저 고정한다. 엔진은 사망을 기록하고 관련 트리거를 해결한 뒤, 종료 검사 가능한 경계에서 살아 있는 적/동료와 예정된 유효 소환을 확인한다.

종료가 확정되면 새로운 정상 행동 입력을 차단하고 결과 ID를 한 번 만든다. 전투 후 복귀, 하드코어 영구 사망, 경험/통계, 보상, 다음 방 상태를 일관된 거래로 처리한다. 보상 획득 선택은 별도 거래다. `outcome` 설정 전·후 새로고침을 각각 검증한다.

## 8. RNG와 저장

고정 seed와 버전 있는 정수 기반 PRNG를 사용한다. 전투·지도·이벤트·보상·상점·강화 스트림을 분리한다. 규칙 처리에서 `Math.random()`이나 현재 시간에 의존하지 않는다. 날짜 기반 일일 seed는 실행 시 생성 후 저장하고 시간 기준을 별도 명세한다.

저장 봉투:

```text
schemaVersion, contentVersion, rulesVersion, rngVersion
namespace: campaign | daily | debug | profile | settings
slotId, revision, createdAt, updatedAt
payload, transactionReceipts, checksum
```

시간은 메타데이터에만 사용한다. checksum은 손상 검출용이며 로컬 조작 방지나 서버 검증을 보장하지 않는다.

- 캠페인 3슬롯, 일일, 디버그, 프로필, 설정은 저장 키 공간을 분리한다.
- 슬롯 ID·스키마·참조 ID·수치 범위·더미 중복·현재 방의 연결 관계를 검증한다.
- JSON 파싱 실패, 지원하지 않는 미래 버전, 마이그레이션 실패는 원본 보존 후 오류를 표시한다.
- 마이그레이션은 복사본을 검증한 뒤 적용하고 이전 정상본을 보존한다. 콘텐츠 패치로 저장 중 카드가 사라지면 명시적 이전 규칙을 적용한다.
- 선택 대기·전투 중 상태도 안정된 체크포인트에서 저장한다. 임의 JS 함수 호출 중간을 직렬화하지 않는다.
- IndexedDB 오류·용량 부족·브라우저 저장 차단을 구분한다. 조용히 localStorage로 바꿔 원자성을 잃지 않는다.
- 저장 내보내기/가져오기와 이전 정상 체크포인트 복구를 제공한다. 브라우저 데이터 삭제나 다른 origin 이동 때 로컬 저장이 유지된다고 약속하지 않는다.
- 두 탭에서 같은 슬롯을 쓰면 revision 검사와 탭 간 알림으로 충돌을 막는다. 일일/디버그는 본편 통계를 오염시키지 않는다.

## 9. 지도와 콘텐츠 검증

지도는 순환 없는 층별 분기 그래프를 기본안으로 한다. 입구→보스 경로 존재, 연결되지 않은 노드 없음, 방 종류 제약, 보스 직전 야영지를 생성 검증한다. 방 종류 공개 여부와 완료 여부는 별도 상태다.

보물은 안전/매복 결과를 미리 생성·저장한다. 이벤트 특수 전투는 종료 후 복귀할 원래 이벤트와 결과 분기를 함께 저장한다. 거울의 방은 카드 복제 대상을 정의 ID만으로 저장하지 않고 필요한 강화·사본·수명 정보를 보존한다.

콘텐츠 레지스트리는 종류 수, ID 중복, 없는 참조, 잘못된 소유자·등급·확률, 미구현 effect/trigger, 이야기 해금 순환을 빌드에서 실패시킨다. 100카드·30유물·15소모품·40이벤트·35업적·6선물·15스테이지는 단순 개수 충족과 효과 검수 완료를 별도로 기록한다.

## 10. 기술적 판단

이 게임의 우선 위험은 그래픽보다 규칙 연결과 저장이다. 헤드리스 엔진을 먼저 작은 전투로 검수하고, 같은 명령을 픽셀 화면에서 사용한다. 반대로 최종 아트를 기다리느라 플레이 가능한 흐름을 미루지 않는다. 콘텐츠를 한 파일에 모두 쓰거나 UI 코드에 전투 계산을 섞는 구조는 피한다.
