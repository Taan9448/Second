# 한글 웹폰트

실행 화면이 OS별 기본 글꼴에 따라 달라지지 않도록 Noto CJK Korean의 현재 UI 문자만 WOFF2로 서브셋했다. SIL Open Font License와 배포 출처는 LICENSE.txt에 포함했다. 외부 폰트 서비스에 의존하지 않는다.

현재 게임 빌드는 이 디렉터리의 폰트 사본을 사용한다. 새 대사/카드로 문자가 늘어나면 `tools/subset_fonts.py`를 다시 실행한다. 재생성에는 로컬 Noto CJK, Python fonttools/brotli가 필요하며 일반 npm 빌드에는 필요하지 않다. 폰트에 없는 문자는 시스템 한글 글꼴로 표시된다.
