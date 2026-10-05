import { heroes, heroIds } from '../content/cards';
import { stageNames } from '../content/story';
import { Sprite } from './components';

export function TitleScreen({
  ready,
  busy,
  hasSave,
  onStart,
  onContinue,
  onSettings,
  onHelp,
}: {
  ready: boolean;
  busy: boolean;
  hasSave: boolean;
  onStart: () => void;
  onContinue: () => void;
  onSettings: () => void;
  onHelp: () => void;
}) {
  return (
    <>
      <div className="title-meta">
        <span>墨 · 劍 · 境</span>
        <span>먹으로 잇는 두 세계</span>
      </div>
      <div className="title-character">
        <Sprite art={0} />
      </div>
      <div className="title-content">
        <p className="eyebrow">A JOURNEY BETWEEN TWO WORLDS</p>
        <h1>
          천외검결<span>天外劍訣</span>
        </h1>
        <p className="tagline">
          붓끝이 가른 운명,
          <br />
          낯선 하늘 아래 다시 쓰다.
        </p>
        <div className="title-menu">
          <button className="primary" disabled={!ready || busy} onClick={onStart}>
            여정 시작 <span>→</span>
          </button>
          <button disabled={!hasSave || busy} onClick={onContinue}>
            이어하기 <span>↗</span>
          </button>
          <button onClick={onSettings}>
            설정 <span>⚙</span>
          </button>
        </div>
        <p className="title-version">개발 중 · 첫 번째 장</p>
      </div>
      <footer className="title-footer">
        <span>청연문의 밤에서 시작되는 한 획의 여정</span>
        <button onClick={onHelp}>게임 안내</button>
      </footer>
    </>
  );
}

export function LobbyScreen({
  cleared,
  busy,
  onStart,
  onPractice,
  onDeck,
  onJournal,
}: {
  cleared: boolean;
  busy: boolean;
  onStart: () => void;
  onPractice: () => void;
  onDeck: () => void;
  onJournal: () => void;
}) {
  const portraitPanel = (
    <div className="party-strip">
      {heroIds.map((id) => (
        <div className={`party-member ${id !== 'brush' ? 'locked' : ''}`} key={id}>
          <Sprite art={heroes[id].art} />
          <div>
            <strong>{id === 'brush' ? heroes[id].name : '???'}</strong>
            <small>{id === 'brush' ? '붓 검객' : '이야기 속에서 합류'}</small>
          </div>
          {id !== 'brush' && <span className="lock-symbol">◇</span>}
        </div>
      ))}
    </div>
  );
  return (
    <main className="lobby">
      <section className="lobby-copy">
        <p className="eyebrow">CHAPTER 01 · BEFORE THE JOURNEY</p>
        <h2>
          아직 쓰이지 않은
          <br />
          <em>당신의 이야기.</em>
        </h2>
        <p>
          {cleared
            ? '첫 번째 경계를 넘었습니다. 다음 세계의 여정은 이어서 준비됩니다.'
            : '문파의 말단 제자, 연묵. 그날 밤의 밀약은 평범했던 삶을 뒤집었습니다. 계문필을 들고, 길을 선택하세요.'}
        </p>
        <div className="lobby-progress">
          <span>{cleared ? '완료' : '다음 목적지'}</span>
          <strong>
            01 <i>/</i> 청연문의 밤
          </strong>
          <div className="stage-track">
            {stageNames.map((name, i) => (
              <span title={name} key={name} className={i === 0 ? 'active' : ''}>
                {i + 1}
              </span>
            ))}
          </div>
          <small>무림 1 · 판타지 7 · 귀환 무림 4 · 균열 3</small>
        </div>
        <button className="primary embark" disabled={busy} onClick={onStart}>
          {cleared ? '첫 번째 장 다시 도전' : '원정 떠나기'} <span>→</span>
        </button>
        <button className="practice-link" disabled={busy} onClick={onPractice}>
          세 캐릭터 전투 연습 <span>↗</span>
        </button>
      </section>
      <div className="lobby-character">
        <Sprite art={0} />
        <div className="character-caption">
          <span>붓 검객</span>
          <strong>연묵</strong>
          <p>“{heroes.brush.quote}”</p>
        </div>
      </div>
      <div className="lobby-bottom">
        {portraitPanel}
        <nav>
          <button onClick={onDeck}>
            <span>▤</span>
            <strong>덱 편성</strong>
            <small>당신만의 한 획</small>
          </button>
          <button onClick={onJournal}>
            <span>書</span>
            <strong>이야기</strong>
            <small>남겨진 발자취</small>
          </button>
        </nav>
      </div>
    </main>
  );
}
