import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { cards, cardById } from '../content/cards';
import { introduction, ending } from '../content/story';
import { combatCommand, previewCard, type CombatCommand } from '../domain/combat';
import { reachable } from '../domain/expedition';
import type { BattleEvent, Combat, GameSave, Zone } from '../domain/model';
import { gameCommand, newGame, practiceGame, type GameCommand } from '../application/game';
import {
  commitSave,
  loadSave,
  parseSave,
  readSettings,
  replaceSave,
  writeSettings,
} from '../persistence/save';
import { playCue } from './audio';
import { choreography, showImpact, type Cue } from './choreography';
import { BattleEffects } from './BattleEffects';
import { Sprite, Card, ModalFrame, UnitButton } from './components';
import { TitleScreen, LobbyScreen } from './HomeScreens';

type Modal =
  | 'slots'
  | 'settings'
  | 'help'
  | 'deck'
  | 'journal'
  | 'draw'
  | 'discard'
  | 'exhaust'
  | 'activePowers'
  | 'log'
  | null;
const zoneNames: Record<Zone, string> = {
  draw: '뽑기 더미',
  hand: '손패',
  discard: '버린 더미',
  exhaust: '소멸 더미',
  activePowers: '지속 카드',
  resolving: '해결 중',
};
const freshSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] || 1;
export function App() {
  const [save, setSave] = useState<GameSave | null>(null),
    [practice, setPractice] = useState(false),
    [modal, setModal] = useState<Modal>(null);
  const [slots, setSlots] = useState<(GameSave | null)[]>([null, null, null]),
    [slotErrors, setSlotErrors] = useState<string[]>(['', '', '']);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [settings, setSettings] = useState({ volume: 0.35, motion: true });
  const [selected, setSelected] = useState<string | null>(null),
    [actor, setActor] = useState<string>('brush'),
    [hoverTarget, setHoverTarget] = useState<string | null>(null);
  const [events, setEvents] = useState<BattleEvent[]>([]),
    [choiceIds, setChoiceIds] = useState<string[]>([]),
    [deckTab, setDeckTab] = useState<'brush' | 'common'>('brush'),
    [deckEntry, setDeckEntry] = useState<string | null>(null);
  const [visualBattle, setVisualBattle] = useState<Combat | null>(null);
  const [cue, setCue] = useState<Cue | null>(null);
  const cueCounter = useRef(0);
  const current = useRef(save);
  current.current = save;
  const lock = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const refreshSlots = useCallback(async () => {
    const results = await Promise.allSettled([1, 2, 3].map((slot) => loadSave(slot)));
    setSlots(results.map((r) => (r.status === 'fulfilled' ? r.value : null)));
    setSlotErrors(
      results.map((r) =>
        r.status === 'rejected' ? '저장을 읽을 수 없습니다. 원본은 유지됩니다.' : '',
      ),
    );
  }, []);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      refreshSlots(),
      readSettings().then((value) => {
        if (!cancelled) setSettings(value);
      }),
    ])
      .catch(() => {
        if (!cancelled)
          setMessage('브라우저 저장소를 열지 못했습니다. 저장을 허용한 뒤 다시 시도해 주세요.');
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshSlots]);
  useEffect(() => {
    if (modal === 'slots') void refreshSlots();
  }, [modal, refreshSlots]);
  const announce = (text: string) => {
    setMessage(text);
  };
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  const persist = useCallback(async (next: GameSave, expected: number | null, debug: boolean) => {
    await commitSave(next, expected, debug);
    setSave(next);
  }, []);
  const send = useCallback(
    async (command: GameCommand) => {
      const previous = current.current;
      if (!previous || lock.current) return;
      lock.current = true;
      setBusy(true);
      try {
        const next = gameCommand(previous, command);
        await persist(next, previous.revision, practice);
        setSelected(null);
      } catch (error) {
        announce(
          error instanceof Error
            ? error.message
            : '진행을 저장하지 못했습니다. 다시 시도해 주세요.',
        );
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [persist, practice],
  );
  const combatSend = useCallback(
    async (command: CombatCommand) => {
      const previous = current.current;
      if (!previous?.battle || lock.current) return;
      lock.current = true;
      setBusy(true);
      try {
        const result = combatCommand(previous.battle, command);
        if (!result.ok) {
          announce(result.reason);
          return;
        }
        const next = structuredClone(previous);
        next.battle = result.state;
        next.revision++;
        next.updatedAt = new Date().toISOString();
        if (command.type === 'play') {
          const definition = previous.battle.cards[command.cardId].definitionId;
          next.stats.cards[definition] = (next.stats.cards[definition] ?? 0) + 1;
        }
        const definition =
          command.type === 'play'
            ? cardById[previous.battle.cards[command.cardId].definitionId]
            : undefined;
        const steps = choreography(result.events, previous.battle, definition);
        // Commit exactly once before presentation. Refresh resumes the committed outcome.
        const openingView = structuredClone(previous.battle);
        if (command.type === 'play') {
          openingView.energy = result.state.energy;
          openingView.zones.hand = openingView.zones.hand.filter((id) => id !== command.cardId);
          openingView.zones.resolving.push(command.cardId);
        }
        setVisualBattle(openingView);
        await persist(next, previous.revision, practice);
        setChoiceIds([]);
        setSelected(null);
        setHoverTarget(null);
        const motion =
          settingsRef.current.motion && !matchMedia('(prefers-reduced-motion: reduce)').matches;
        for (const step of steps) {
          const active = { ...step, id: ++cueCounter.current };
          setCue(active);
          setEvents(step.event ? [step.event] : []);
          if (step.beat === 'impact') {
            setVisualBattle((view) => showImpact(view ?? previous.battle!, step.event));
            playCue(
              step.event?.kind === 'damage'
                ? 'damage'
                : step.event?.kind === 'heal'
                  ? 'heal'
                  : 'guard',
              settingsRef.current.volume,
              step.technique === 'dragon' || (step.event?.amount ?? 0) >= 15,
            );
          } else if (step.beat === 'release') playCue('swing', settingsRef.current.volume);
          await new Promise((resolve) => setTimeout(resolve, motion ? step.duration : 20));
        }
      } catch (error) {
        announce(error instanceof Error ? error.message : '전투를 저장하지 못했습니다.');
      } finally {
        setVisualBattle(null);
        setCue(null);
        setEvents([]);
        lock.current = false;
        setBusy(false);
      }
    },
    [persist, practice],
  );
  const battle = visualBattle ?? save?.battle;
  useEffect(() => {
    if (
      save?.screen !== 'battle' ||
      !battle ||
      busy ||
      modal ||
      battle.choice ||
      ['player', 'victory', 'defeat'].includes(battle.phase)
    )
      return;
    const timer = setTimeout(
      () => void combatSend({ type: 'advance', revision: battle.revision }),
      settings.motion ? 450 : 20,
    );
    return () => clearTimeout(timer);
  }, [save?.screen, battle, busy, modal, combatSend, settings.motion]);
  const leaveToTitle = useCallback(() => {
    setSave(null);
    setPractice(false);
    setSelected(null);
    setModal(null);
    void refreshSlots();
  }, [refreshSlots]);
  const startPractice = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const existing = await loadSave(1, true),
        next = practiceGame(freshSeed());
      next.revision = (existing?.revision ?? -1) + 1;
      await persist(next, existing?.revision ?? null, true);
      setPractice(true);
      setModal(null);
      setActor('brush');
    } catch (error) {
      announce(error instanceof Error ? error.message : '연습을 시작할 수 없습니다.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const selectCard = useCallback(
    (id: string) => {
      if (!battle || busy || battle.choice) return;
      if (battle.phase !== 'player') {
        announce('플레이어 턴에 카드를 사용할 수 있습니다.');
        return;
      }
      const d = cardById[battle.cards[id].definitionId];
      if (selected === id) {
        setSelected(null);
        return;
      }
      const caster = d.owner === 'common' ? actor : d.owner;
      if (!battle.party.some((u) => u.id === caster && u.hp > 0)) {
        announce('카드 소유자가 쓰러져 사용할 수 없습니다.');
        return;
      }
      if (battle.energy < (battle.cards[id].costOverride ?? d.cost)) {
        announce('에너지가 부족합니다.');
        return;
      }
      setSelected(id);
      setActor(caster);
    },
    [battle, busy, selected, actor],
  );
  const useSelected = useCallback(
    (targetId?: string, cardId = selected) => {
      if (!battle || !cardId || busy) return;
      const d = cardById[battle.cards[cardId].definitionId],
        caster =
          d.owner === 'common'
            ? d.target === 'self' && battle.party.some((unit) => unit.id === targetId)
              ? targetId!
              : actor
            : d.owner;
      void combatSend({
        type: 'play',
        cardId,
        actorId: caster,
        targetId: targetId ?? caster,
        revision: battle.revision,
      });
    },
    [battle, selected, actor, busy, combatSend],
  );
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).matches('input,select,textarea') ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (e.key === 'Escape') {
        if (modal) setModal(null);
        else setSelected(null);
        return;
      }
      if (modal || save?.screen !== 'battle' || !battle || battle.choice || busy) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const id = battle.zones.hand[e.key === '0' ? 9 : Number(e.key) - 1];
        if (id) selectCard(id);
      }
      if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        void combatSend({ type: 'end', revision: battle.revision });
      }
      if (e.key.toLowerCase() === 'd') setModal('draw');
      if (e.key.toLowerCase() === 'f') setModal('discard');
      if (e.key.toLowerCase() === 'x') setModal('exhaust');
      if (e.key.toLowerCase() === 'p') setModal('activePowers');
      if (e.key.toLowerCase() === 'l') setModal('log');
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [battle, save?.screen, modal, busy, selectCard, combatSend]);
  const openSlot = async (index: number) => {
    if (slotErrors[index] || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const existing = await loadSave(index + 1);
      if (existing) {
        setSave(existing);
      } else {
        const next = newGame(index + 1);
        await persist(next, null, false);
      }
      setPractice(false);
      setSelected(null);
      setActor('brush');
      setModal(null);
    } catch (error) {
      announce(error instanceof Error ? error.message : '저장을 불러올 수 없습니다.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const exportSave = () => {
    if (!save) return;
    const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = `천외검결-${practice ? '연습' : save.slot}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importFile = async (file: File) => {
    if (!save || practice || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const incoming = parseSave(await file.text());
      incoming.slot = save.slot;
      incoming.revision = save.revision + 1;
      incoming.updatedAt = new Date().toISOString();
      await replaceSave(incoming, save.revision);
      setSave(incoming);
      setModal(null);
      announce('선택한 슬롯으로 저장을 가져왔습니다.');
    } catch (error) {
      announce(
        error instanceof Error ? `가져오기 실패: ${error.message}` : '잘못된 저장 파일입니다.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const updateSettings = async (value: typeof settings) => {
    setSettings(value);
    try {
      await writeSettings(value);
    } catch {
      announce('설정을 저장하지 못했습니다. 현재 화면에만 적용됩니다.');
    }
  };
  const title = !save;
  const screen = save?.screen;
  const selectedDefinition =
    selected && battle ? cardById[battle.cards[selected].definitionId] : null;
  const currentNode = save?.expedition?.nodes.find((n) => n.id === save.expedition?.current);

  return (
    <div
      className={`game ${settings.motion ? '' : 'reduce-motion'} ${title ? 'title-screen' : screen === 'battle' ? 'battle-screen' : ''}`}
    >
      <div className="scene-backdrop" />
      <div className="scene-vignette" />
      <div className="grain" />
      {title ? (
        <TitleScreen
          ready={ready}
          busy={busy}
          hasSave={slots.some(Boolean)}
          onStart={() => setModal('slots')}
          onContinue={() => {
            const i = slots.findIndex(Boolean);
            if (i >= 0) void openSlot(i);
          }}
          onSettings={() => setModal('settings')}
          onHelp={() => setModal('help')}
        />
      ) : (
        <>
          <header className="topbar">
            <button className="wordmark" onClick={leaveToTitle}>
              천외검결<span>天外劍訣</span>
            </button>
            <div className="chapter-label">
              <span className="chapter-symbol">壹</span>
              <div>
                <small>{practice ? '전투 연습' : '제1장 · 초기 무림'}</small>
                <strong>
                  {practice
                    ? '세 갈래의 흐름'
                    : screen === 'lobby'
                      ? '여정의 준비'
                      : (currentNode?.name ?? '청연문의 밤')}
                </strong>
              </div>
            </div>
            {screen === 'battle' && battle && (
              <div className="turn-label">
                <span>라운드 {battle.round}</span>
                <b>
                  {battle.phase === 'player'
                    ? '당신의 턴'
                    : battle.phase === 'victory'
                      ? '승리'
                      : battle.phase === 'defeat'
                        ? '패배'
                        : '적의 행동'}
                </b>
              </div>
            )}
            <div className="top-actions">
              <span className="save-indicator">
                {cue ? '기술 시전 중' : busy ? '기록 중…' : '◈ 자동 저장'}
              </span>
              <button onClick={() => setModal('help')} aria-label="게임 안내">
                ?
              </button>
              <button onClick={() => setModal('settings')} aria-label="설정">
                ⚙
              </button>
            </div>
          </header>
          {screen === 'lobby' && (
            <LobbyScreen
              cleared={save.cleared}
              busy={busy}
              onStart={() => void send({ type: 'start', seed: freshSeed() })}
              onPractice={() => void startPractice()}
              onDeck={() => setModal('deck')}
              onJournal={() => setModal('journal')}
            />
          )}
          {(screen === 'story' || screen === 'ending') && (
            <main className="story-screen">
              <div className="story-figure">
                <Sprite art={0} />
              </div>
              <div className="story-panel">
                <span className="eyebrow">
                  {screen === 'story' ? 'PROLOGUE · 비밀의 밤' : 'CHAPTER END · 경계를 넘어'}
                </span>
                <h2>{(screen === 'story' ? introduction : ending)[save.storyIndex].title}</h2>
                <span className="speaker">
                  {(screen === 'story' ? introduction : ending)[save.storyIndex].speaker}
                </span>
                <p>{(screen === 'story' ? introduction : ending)[save.storyIndex].text}</p>
                <div className="story-bottom">
                  <span>{save.storyIndex + 1} / 3</span>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => void send({ type: 'storyNext' })}
                  >
                    {save.storyIndex < 2 ? '다음' : '여정으로'} →
                  </button>
                </div>
              </div>
            </main>
          )}
          {screen === 'map' && save.expedition && (
            <main className="map-screen">
              <div className="section-intro">
                <p className="eyebrow">CHOOSE YOUR PATH</p>
                <h2>청연문의 밤</h2>
                <p>연결된 길을 따라, 추격을 벗어나세요.</p>
                <span className="map-hp">♥ 연묵 {save.expedition.hp} / 80</span>
              </div>
              <div className="route-map">
                <svg viewBox="0 0 1000 450" preserveAspectRatio="none" aria-hidden="true">
                  {save.expedition.nodes.flatMap((n) =>
                    n.next.map((id) => {
                      const t = save.expedition!.nodes.find((x) => x.id === id)!;
                      return (
                        <line
                          key={`${n.id}-${id}`}
                          x1={70 + n.column * 215}
                          y1={60 + n.lane * 145}
                          x2={70 + t.column * 215}
                          y2={60 + t.lane * 145}
                          className={n.completed ? 'open' : ''}
                        />
                      );
                    }),
                  )}
                </svg>
                {save.expedition.nodes.map((n) => {
                  const available = reachable(save.expedition!).includes(n.id);
                  return (
                    <button
                      key={n.id}
                      className={`map-node ${available ? 'available' : ''} ${n.completed ? 'completed' : ''} ${save.expedition!.current === n.id ? 'current' : ''}`}
                      style={{
                        left: `${7 + n.column * 21.5}%`,
                        top: `${(60 + n.lane * 145) / 4.5}%`,
                      }}
                      disabled={!available || busy}
                      onClick={() => void send({ type: 'room', id: n.id })}
                    >
                      <span className="node-icon">
                        {{ battle: '⚔', event: '書', rest: '♨', boss: '魁' }[n.kind]}
                      </span>
                      <strong>{n.name}</strong>
                      <small>
                        {n.completed
                          ? '완료'
                          : available
                            ? '진입 가능'
                            : save.expedition!.current === n.id
                              ? '현재'
                              : '잠김'}
                      </small>
                    </button>
                  );
                })}
              </div>
              <footer className="map-footer">
                <span>▤ 원정 덱 {save.expedition.deck.length}장</span>
                <span>
                  완료 {save.expedition.nodes.filter((n) => n.completed).length} /{' '}
                  {save.expedition.nodes.length}개 방
                </span>
                <button onClick={() => setModal('journal')}>이야기 기록 ↗</button>
              </footer>
            </main>
          )}
          {screen === 'room' && currentNode && (
            <main className="room-screen">
              <div className="room-emblem">{currentNode.kind === 'rest' ? '♨' : '書'}</div>
              <section className="room-panel">
                <p className="eyebrow">
                  {currentNode.kind === 'rest' ? 'A MOMENT TO BREATHE' : 'A THREAD OF THE STORY'}
                </p>
                <h2>{currentNode.name}</h2>
                <p>{currentNode.description}</p>
                {currentNode.kind === 'rest' ? (
                  <>
                    <p className="room-prose">
                      추격의 소리가 잠시 멀어졌다. 젖은 손을 비석 위에 얹자, 붓에 새겨진 오래된
                      문장이 어렴풋이 떠오른다.
                    </p>
                    <div className="room-choices">
                      <button
                        disabled={busy}
                        onClick={() => void send({ type: 'rest', choice: 'heal' })}
                      >
                        <strong>숨을 고른다</strong>
                        <small>체력 24 회복 · 현재 {save.expedition!.hp} / 80</small>
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void send({ type: 'rest', choice: 'listen' })}
                      >
                        <strong>붓의 울림을 듣는다</strong>
                        <small>먹룡의 궤적 1장을 원정 덱에 추가 · 문장 기록</small>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="room-prose">
                      “문파의 장부에 마을 사람들의 이름이 있어요.” 떨리는 손에 작은 꾸러미가 들려
                      있다. 이름 옆에는 붉은 선이 그어져 있었다. 누군가의 목숨을 장부처럼 지우려는
                      것이다.
                    </p>
                    <div className="room-choices">
                      <button
                        disabled={busy}
                        onClick={() => void send({ type: 'resolveEvent', choice: 'rescue' })}
                      >
                        <strong>시종을 안전한 길로 안내한다</strong>
                        <small>체력 8 회복 · 구조 기록을 남김</small>
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void send({ type: 'resolveEvent', choice: 'leave' })}
                      >
                        <strong>꾸러미를 챙기고 먼저 나아간다</strong>
                        <small>파묵 1장을 원정 덱에 추가 · 증거 기록을 남김</small>
                      </button>
                    </div>
                  </>
                )}
              </section>
            </main>
          )}
          {screen === 'reward' && save.expedition?.reward && (
            <main className="reward-screen">
              <div className="section-intro">
                <span className="eyebrow">A NEW STROKE</span>
                <h2>다음 획을 고르세요</h2>
                <p>선택한 한 장을 이번 원정 덱에 추가합니다.</p>
              </div>
              <div className="reward-cards">
                {save.expedition.reward.map((id) => (
                  <Card
                    key={id}
                    card={cardById[id]}
                    onClick={() => void send({ type: 'reward', id })}
                  />
                ))}
              </div>
              <button
                disabled={busy}
                className="text-button"
                onClick={() => void send({ type: 'reward', id: null })}
              >
                보상을 받지 않고 계속 →
              </button>
            </main>
          )}
          {screen === 'defeat' && (
            <main className="result-screen">
              <p className="eyebrow">THE INK HAS NOT DRIED</p>
              <h2>여정은 아직 끝나지 않았습니다.</h2>
              <p>이번 원정의 카드는 남겨 두고, 준비 덱으로 다시 시작합니다.</p>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void send({ type: 'returnLobby' })}
              >
                로비로 돌아가기 →
              </button>
            </main>
          )}
          {screen === 'battle' && battle && (
            <>
              <div className="battle-hint">
                {selectedDefinition ? (
                  <>
                    <strong>{selectedDefinition.name}</strong>
                    <span>
                      {selectedDefinition.target === 'enemy'
                        ? '적을 선택하세요'
                        : selectedDefinition.target === 'ally'
                          ? '아군을 선택하세요'
                          : '아래 사용 버튼으로 확정하세요'}{' '}
                      · Esc 취소
                    </span>
                  </>
                ) : (
                  <>
                    <strong>{practice ? '전투 연습' : '청연문의 밤'}</strong>
                    <span>카드를 선택하고 대상을 클릭하세요.</span>
                  </>
                )}
              </div>
              <main
                className={`battlefield ${cue?.beat === 'impact' && cue.event?.kind === 'damage' ? 'impact-shake' : ''}`}
                data-animation={cue?.beat ?? 'idle'}
              >
                <BattleEffects
                  cue={cue}
                  motion={
                    settings.motion && !matchMedia('(prefers-reduced-motion: reduce)').matches
                  }
                />
                {cue && (
                  <div className={`technique-banner technique-${cue.technique}`}>
                    <span>{cue.sourceId === 'brush' ? '筆' : '技'}</span>
                    {cue.label}
                  </div>
                )}
                <div className="ambient-motes" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <i key={i} style={{ '--i': i } as CSSProperties} />
                  ))}
                </div>
                <div className="formation allies">
                  {battle.party.map((u) => (
                    <UnitButton
                      key={u.id}
                      unit={u}
                      battle={battle}
                      selectedActor={actor === u.id}
                      events={events}
                      cue={cue}
                      targetable={selectedDefinition?.target === 'ally'}
                      onClick={() => {
                        if (selectedDefinition?.target === 'ally') useSelected(u.id);
                        else if (!selectedDefinition || selectedDefinition.owner === 'common')
                          setActor(u.id);
                      }}
                      onHover={setHoverTarget}
                      onDrop={(id) => useSelected(u.id, id)}
                    />
                  ))}
                </div>
                <div className="battle-divider">VS</div>
                <div className="formation enemies">
                  {battle.enemies.map((u) => (
                    <UnitButton
                      key={u.id}
                      unit={u}
                      battle={battle}
                      enemy
                      selectedActor={false}
                      events={events}
                      cue={cue}
                      targetable={selectedDefinition?.target === 'enemy'}
                      preview={
                        selected && hoverTarget === u.id
                          ? previewCard(battle, selected, actor, u.id)?.damage
                          : undefined
                      }
                      onClick={() => useSelected(u.id)}
                      onHover={setHoverTarget}
                      onDrop={(id) => useSelected(u.id, id)}
                    />
                  ))}
                </div>
              </main>
              <div className="battle-dock">
                <div className="energy-panel">
                  <div className="energy-orb">
                    <strong>{battle.energy}</strong>
                    <span>에너지</span>
                  </div>
                  <div className="energy-pips">
                    {[0, 1, 2].map((i) => (
                      <i key={i} className={i < battle.energy ? 'lit' : ''} />
                    ))}
                  </div>
                  <small>시전자</small>
                  <div className="caster-switch">
                    {battle.party.map((u) => (
                      <button
                        key={u.id}
                        className={actor === u.id ? 'active' : ''}
                        disabled={
                          u.hp <= 0 ||
                          (!!selectedDefinition && selectedDefinition.owner !== 'common')
                        }
                        onClick={() => setActor(u.id)}
                      >
                        {u.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="hand-area">
                  <div
                    className="hand"
                    style={{ '--hand-count': battle.zones.hand.length } as CSSProperties}
                  >
                    {battle.zones.hand.map((id, i) => {
                      const instance = battle.cards[id],
                        d = cardById[instance.definitionId];
                      return (
                        <div className="hand-card" key={id}>
                          <span className="key-hint">{i === 9 ? '0' : i + 1}</span>
                          <Card
                            card={d}
                            instanceId={id}
                            cost={instance.costOverride}
                            selected={id === selected}
                            disabled={
                              busy ||
                              battle.phase !== 'player' ||
                              battle.energy < (instance.costOverride ?? d.cost) ||
                              !battle.party.some(
                                (u) => u.hp > 0 && (d.owner === 'common' || d.owner === u.id),
                              )
                            }
                            onClick={() => selectCard(id)}
                            onDragStart={(cardId) => {
                              setSelected(cardId);
                              if (d.owner !== 'common') setActor(d.owner);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {selectedDefinition &&
                    (selectedDefinition.target === 'self' ||
                      selectedDefinition.target === 'none') && (
                      <button
                        className="confirm-card primary"
                        disabled={busy}
                        onClick={() => useSelected()}
                      >
                        「{selectedDefinition.name}」 사용
                      </button>
                    )}
                </div>
                <div className="turn-panel">
                  <button
                    className="end-turn primary"
                    disabled={busy || battle.phase !== 'player' || !!battle.choice}
                    onClick={() => void combatSend({ type: 'end', revision: battle.revision })}
                  >
                    턴 종료 <small>E</small>
                  </button>
                  <button className="log-button" onClick={() => setModal('log')}>
                    전투 기록 ↗
                  </button>
                  <div className="pile-buttons">
                    {(['draw', 'discard', 'exhaust', 'activePowers'] as Zone[]).map((zone) => (
                      <button key={zone} onClick={() => setModal(zone as Modal)}>
                        <span>
                          {
                            {
                              draw: '▤',
                              discard: '▱',
                              exhaust: '◌',
                              activePowers: '✦',
                              hand: '',
                              resolving: '',
                            }[zone]
                          }
                        </span>
                        <small>
                          {zone === 'draw'
                            ? '뽑기'
                            : zone === 'discard'
                              ? '버림'
                              : zone === 'exhaust'
                                ? '소멸'
                                : '지속'}
                        </small>
                        <b>{battle.zones[zone].length}</b>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {battle.choice && (
                <ModalFrame
                  title={
                    battle.choice.mode === 'scry'
                      ? '버릴 카드를 고르세요 (0장도 가능)'
                      : `${battle.choice.count}장을 ${battle.choice.mode === 'discard' ? '버리기' : '소멸'}`
                  }
                  onClose={() => announce('효과 선택을 마쳐야 다음 행동을 할 수 있습니다.')}
                >
                  <p className="modal-description">
                    {battle.choice.mode === 'scry'
                      ? '선택하지 않은 카드는 현재 순서로 뽑기 더미에 남습니다.'
                      : '효과가 해결된 뒤 전투를 계속합니다.'}
                  </p>
                  <div className="card-grid">
                    {battle.choice.candidates.map((id) => (
                      <Card
                        key={id}
                        card={cardById[battle.cards[id].definitionId]}
                        selected={choiceIds.includes(id)}
                        onClick={() =>
                          setChoiceIds((previous) =>
                            previous.includes(id)
                              ? previous.filter((x) => x !== id)
                              : [...previous, id],
                          )
                        }
                      />
                    ))}
                  </div>
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      (battle.choice.mode !== 'scry' && choiceIds.length !== battle.choice.count)
                    }
                    onClick={() =>
                      void combatSend({ type: 'choose', ids: choiceIds, revision: battle.revision })
                    }
                  >
                    선택 확정 ({choiceIds.length}장)
                  </button>
                </ModalFrame>
              )}
              {['victory', 'defeat'].includes(battle.phase) && (
                <div className="battle-result">
                  <p className="eyebrow">{battle.phase === 'victory' ? 'VICTORY' : 'DEFEAT'}</p>
                  <h2>{battle.phase === 'victory' ? '길이 열렸습니다.' : '붓끝이 멈췄습니다.'}</h2>
                  <p>
                    {battle.round}라운드 ·{' '}
                    {battle.phase === 'victory'
                      ? '다음 여정을 준비하세요.'
                      : '다시 한 획을 그릴 시간입니다.'}
                  </p>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      practice ? leaveToTitle() : void send({ type: 'battleFinish' })
                    }
                  >
                    {practice ? '연습 종료' : battle.phase === 'victory' ? '다음으로' : '결과 확인'}{' '}
                    →
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
      {modal && (
        <ModalFrame
          title={
            modal === 'slots'
              ? '여정을 선택하세요'
              : modal === 'settings'
                ? '설정'
                : modal === 'help'
                  ? '게임 안내'
                  : modal === 'deck'
                    ? '준비 덱 편성'
                    : modal === 'journal'
                      ? '이야기 기록'
                      : modal === 'log'
                        ? '전투 기록'
                        : zoneNames[modal as Zone]
          }
          onClose={() => setModal(null)}
        >
          {modal === 'slots' && (
            <>
              <p className="modal-description">각 여정은 별도의 노말 저장입니다.</p>
              <div className="slot-list">
                {slots.map((slot, i) => (
                  <button
                    key={i}
                    disabled={busy || !!slotErrors[i]}
                    onClick={() => void openSlot(i)}
                  >
                    <span className="slot-number">0{i + 1}</span>
                    <div>
                      <strong>
                        {slotErrors[i]
                          ? '읽기 오류'
                          : slot
                            ? slot.cleared
                              ? '경계를 넘은 여정'
                              : '청연문의 밤'
                            : '새로운 여정'}
                      </strong>
                      <small>
                        {slotErrors[i] ||
                          (slot
                            ? `노말 · ${new Date(slot.updatedAt).toLocaleString('ko-KR')}`
                            : '빈 슬롯 · 노말')}
                      </small>
                    </div>
                    <span>→</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {modal === 'settings' && (
            <div className="settings-content">
              <label>
                효과음{' '}
                <input
                  aria-label="효과음"
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  value={settings.volume}
                  onChange={(e) =>
                    void updateSettings({ ...settings, volume: Number(e.target.value) })
                  }
                />
                <span>{Math.round(settings.volume * 100)}%</span>
              </label>
              <label>
                전투 애니메이션{' '}
                <input
                  type="checkbox"
                  checked={settings.motion}
                  onChange={(e) => void updateSettings({ ...settings, motion: e.target.checked })}
                />
              </label>
              {save && (
                <div className="save-tools">
                  <button onClick={exportSave}>저장 내보내기</button>
                  {!practice && (
                    <label className="file-button">
                      현재 슬롯으로 가져오기
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void importFile(file);
                        }}
                      />
                    </label>
                  )}
                  <button disabled={busy} onClick={leaveToTitle}>
                    타이틀로 돌아가기
                  </button>
                </div>
              )}
              <p className="modal-description">
                진행은 이 브라우저에 저장됩니다. 가져오기는 현재 슬롯을 교체하며, 브라우저 데이터를
                지우기 전에는 저장을 내보내세요.
              </p>
            </div>
          )}
          {modal === 'help' && (
            <div className="help-content">
              <p>
                카드를 골라 대상을 클릭하거나, 카드에서 대상으로 드래그하세요. 공용 카드는 선택한
                아군이 사용합니다.
              </p>
              <dl>
                <dt>1–9 / 0</dt>
                <dd>손패 선택</dd>
                <dt>Esc</dt>
                <dd>선택 취소 / 창 닫기</dd>
                <dt>E</dt>
                <dd>턴 종료</dd>
                <dt>D / F / X / P</dt>
                <dd>뽑기 / 버림 / 소멸 / 지속 더미</dd>
                <dt>L</dt>
                <dd>전투 기록</dd>
                <dt>Tab / Enter</dt>
                <dd>버튼·대상 선택</dd>
              </dl>
              <p>
                보호막은 해당 진영의 다음 턴 시작에 사라집니다. 약화는 공격 피해 ×0.75, 취약은 받는
                공격 피해 ×1.5입니다. 화상은 턴 종료에 피해를 주고 1 줄어듭니다. 도발은 적의 공격
                대상을 바꾸고, 반격은 공격한 적에게 피해를 돌려줍니다.
              </p>
              <p className="modal-description">
                현재 플레이 범위: 첫 번째 장과 3인 전투 연습. 나머지 14스테이지, 강화·소모품·유물,
                하드·하드코어는 개발 예정입니다.
              </p>
            </div>
          )}
          {modal === 'journal' && (
            <div className="journal">
              <p className="modal-description">
                {save?.journal.length
                  ? '당신이 남긴 선택과 발견입니다.'
                  : '아직 기록된 이야기가 없습니다. 원정에서 새로운 흔적을 만나세요.'}
              </p>
              {save?.journal.map((text, i) => (
                <article key={i}>
                  <span>0{i + 1}</span>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          )}
          {modal === 'deck' && save && (
            <div className="deck-editor">
              <div className="tab-row">
                <button
                  className={deckTab === 'brush' ? 'active' : ''}
                  onClick={() => {
                    setDeckTab('brush');
                    setDeckEntry(null);
                  }}
                >
                  연묵 · 10장
                </button>
                <button
                  className={deckTab === 'common' ? 'active' : ''}
                  onClick={() => {
                    setDeckTab('common');
                    setDeckEntry(null);
                  }}
                >
                  공용 · 20장
                </button>
              </div>
              <p className="modal-description">
                교체할 카드를 고른 뒤, 아래 보유 카드에서 새 카드를 선택하세요. 장수는 유지됩니다.
              </p>
              <div className="deck-entries">
                {save.prepared[deckTab].map((entry) => (
                  <button
                    key={entry.id}
                    className={deckEntry === entry.id ? 'active' : ''}
                    onClick={() => setDeckEntry(entry.id)}
                  >
                    <span>{cardById[entry.definitionId].cost}</span>
                    {cardById[entry.definitionId].name}
                  </button>
                ))}
              </div>
              <div className="card-grid">
                {cards
                  .filter((c) => c.owner === deckTab && save.collection.includes(c.id))
                  .map((card) => (
                    <Card
                      key={card.id}
                      card={card}
                      compact
                      onClick={() => {
                        if (!deckEntry) announce('위에서 교체할 카드부터 선택해 주세요.');
                        else
                          void send({
                            type: 'replaceCard',
                            entryId: deckEntry,
                            definitionId: card.id,
                          });
                      }}
                    />
                  ))}
              </div>
            </div>
          )}
          {modal === 'log' && battle && (
            <ol className="battle-log">
              {battle.log.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ol>
          )}
          {battle &&
            (['draw', 'discard', 'exhaust', 'activePowers'] as string[]).includes(modal) && (
              <>
                <p className="modal-description">
                  {modal === 'draw' ? '카드 구성입니다. 실제 뽑기 순서는 공개하지 않습니다.' : ''}{' '}
                  총 {battle.zones[modal as Zone].length}장
                </p>
                <div className="card-grid">
                  {[...battle.zones[modal as Zone]]
                    .sort((a, b) =>
                      battle.cards[a].definitionId.localeCompare(battle.cards[b].definitionId),
                    )
                    .map((id) => (
                      <Card key={id} card={cardById[battle.cards[id].definitionId]} compact />
                    ))}
                </div>
              </>
            )}
        </ModalFrame>
      )}
    </div>
  );
}
