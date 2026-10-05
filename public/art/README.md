# 실제 사용 아트

2026-10-05 사용자가 승인한 `design/mockups/reference-style`의 SD 픽셀 디자인을 image_gen으로 직접 참조해 제작했다. 이전 수작업 임시 아트를 사용하지 않는다.

| 파일 | 규격 | 실제 사용 |
| --- | --- | --- |
| characters.png | 1536×1024, RGBA, 3열×2행 | 상단 연묵/리엔/세라, 하단 늑대/추격자/집행관; 각512×512 셀을 CSS로 표시 |
| cards.png | 1536×1024, RGB, 3열×2행 | 먹/화염/얼음/성광/번개/융합 카드 삽화 |
| courtyard.png | 1672×941, RGB | 인터페이스가 없는 달밤의 무림 폐사원 무대 |

텍스트·버튼·체력·카드는 HTML/React로 별도 렌더링한다. 목업 스크린샷을 클릭 가능한 게임처럼 덮어 쓰지 않았다. 피격/시전/먹·원소·성광 효과는 CSS와 Canvas로 재생하며 판정에 영향을 주지 않는다. 이후 연묵/먹룡 프레임과 적2자세를 추가했다. 모든 인물의 이동/후면/쓰러짐 모델 시트와 정밀한 픽셀 배율 정렬은 아직 완성하지 않았다.

생성 원본은 `/workspace/generated_images/exec-ea5ce155-a5b4-47ac-aaf3-89cf5ab623e4.png`, `exec-75468589-2958-4e28-8d58-f46fe1aeeabf.png`, `exec-47658220-138a-4068-96c9-b7f1ab52c11c.png`에 각각 유지했다. 이 디렉터리는 실행에 필요한 사본이다.

## 1스테이지 애니메이션 패스

- brush-animation.png: 1774×887 RGBA, 4열×2행, 연묵 대기4프레임과 공격4자세. 원본 exec-0a22c03b-8c02-4138-a294-216f296177a5.png.
- enemy-animation.png: 1536×1024 RGBA, 3열×2행, 늑대/추격자/집행관 대기·공격2자세. 원본 exec-0eba464c-fa2c-41bf-a029-950a18daa0cc.png.

둘 다 image_gen으로 기존 characters.png를 참조해 생성했고 원본을 유지한다. 적의 2자세를 완전한 다프레임 동작으로 보고하지 않는다. 카드에는 이제 생성 cards.png 대신 코드로 그린 작은 SVG 표식을 사용한다. 동료 연습/메인/로비의 기존 스프라이트는 characters.png를 유지한다. 전체 연출/검수/한계는 docs/COMBAT_FEEL.md를 따른다.

- ink-dragon-animation.png: 1280×1280 RGBA, 2열×2행, 먹룡 비행4프레임. 원본 exec-381d298f-a17b-4afa-9fe5-2ea6e313ca21.png. Canvas에서 프레임을 읽어 시전자→대상으로 발사한다.
