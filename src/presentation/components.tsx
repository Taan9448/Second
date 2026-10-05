import { useEffect, useRef, type CSSProperties } from 'react';
import { heroes } from '../content/cards';
import { attackDamage, statusNames } from '../domain/combat';
import type { BattleEvent, CardDefinition, Combat, Unit } from '../domain/model';

const styleArt = (index: number): CSSProperties => ({
  backgroundPosition: `${(index % 3) * 50}% ${index < 3 ? 0 : 100}%`,
});
export function Sprite({ art, className = '' }: { art: number; className?: string }) {
  return <div aria-hidden="true" className={`sprite ${className}`} style={styleArt(art)} />;
}
export function Card({
  card,
  instanceId,
  cost,
  selected,
  onClick,
  onDragStart,
  compact = false,
  disabled = false,
}: {
  card: CardDefinition;
  instanceId?: string;
  cost?: number;
  selected?: boolean;
  onClick?: () => void;
  onDragStart?: (id: string) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`card ${selected ? 'selected' : ''} ${compact ? 'compact' : ''} ${disabled ? 'unavailable' : ''}`}
      aria-label={`${card.name}, 에너지 ${cost ?? card.cost}, ${card.description}`}
      aria-pressed={selected}
      data-instance={instanceId}
      data-definition={card.id}
      data-target={card.target}
      data-owner={card.owner}
      data-cost={cost ?? card.cost}
      onClick={onClick}
      draggable={!!onDragStart && !disabled}
      onDragStart={(e) => {
        if (instanceId) {
          e.dataTransfer.setData('text/plain', instanceId);
          e.dataTransfer.effectAllowed = 'move';
          onDragStart?.(instanceId);
        }
      }}
    >
      <span className="cost">{cost ?? card.cost}</span>
      <span className={`owner owner-${card.owner}`}>
        {card.owner === 'common'
          ? '공용'
          : card.owner === 'combo'
            ? '합동'
            : heroes[card.owner].name}
      </span>
      <span className="card-art" style={styleArt(card.art)} />
      <span className="card-name">{card.name}</span>
      <span className="card-type">
        {card.school} · {card.type}
      </span>
      <span className="card-description">{card.description}</span>
      <span className="card-keywords">
        {card.keywords
          .map((k) => ({ retain: '보존', innate: '선천성', exhaust: '소멸' })[k])
          .join(' · ') || card.rarity}
      </span>
    </button>
  );
}
function Health({ unit }: { unit: Unit }) {
  return (
    <div className="health">
      <div className="health-fill" style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }} />
      <span>
        {unit.hp} / {unit.maxHp}
      </span>
      {unit.block > 0 && <b className="block">◇ {unit.block}</b>}
    </div>
  );
}
export function ModalFrame({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => before?.focus();
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return;
          const buttons = ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,select,[tabindex="0"]',
          );
          if (!buttons?.length) return;
          const first = buttons[0],
            last = buttons[buttons.length - 1];
          if (
            e.shiftKey &&
            (document.activeElement === first || document.activeElement === ref.current)
          ) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        <header>
          <div>
            <span className="eyebrow">천외검결</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function UnitButton({
  unit,
  battle,
  enemy = false,
  selectedActor,
  events,
  targetable,
  preview,
  onClick,
  onHover,
  onDrop,
}: {
  unit: Unit;
  battle: Combat;
  enemy?: boolean;
  selectedActor: boolean;
  events: BattleEvent[];
  targetable?: boolean;
  preview?: number;
  onClick: () => void;
  onHover: (id: string | null) => void;
  onDrop: (id: string) => void;
}) {
  const intent = enemy ? battle.intents.find((i) => i.enemyId === unit.id) : null;
  const target = intent ? battle.party.find((u) => u.id === intent.targetId) : null;
  const amount = intent && target ? attackDamage(intent.damage, unit, target).total : 0;
  const impacts = events.filter(
    (e) => e.targetId === unit.id && ['damage', 'block', 'heal'].includes(e.kind),
  );
  const acting = events.some(
    (e) => e.sourceId === unit.id && (e.kind === 'card' || e.kind === 'enemy'),
  );
  const art = events.find((e) => e.targetId === unit.id && e.kind === 'card')?.art;
  return (
    <button
      className={`unit ${enemy ? 'enemy' : 'ally'} ${unit.hp <= 0 ? 'down' : ''} ${targetable && unit.hp > 0 ? 'targetable' : ''} ${selectedActor ? 'active-caster' : ''} ${acting ? 'acting' : ''} ${impacts.some((e) => e.kind === 'damage') ? 'hit' : ''}`}
      data-unit={unit.id}
      aria-label={`${unit.name} 체력 ${unit.hp}, 보호막 ${unit.block}${intent ? `, ${intent.label}` : ''}`}
      disabled={unit.hp <= 0}
      onClick={onClick}
      onMouseEnter={() => onHover(unit.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(unit.id)}
      onBlur={() => onHover(null)}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onHover(unit.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        if (id) onDrop(id);
      }}
    >
      <div className="intent">
        {intent &&
          unit.hp > 0 &&
          (intent.kind === 'guard' ? (
            <>
              <span>◇ {intent.block}</span>
              <small>{intent.label}</small>
            </>
          ) : intent.kind === 'charge' ? (
            <>
              <span className="charge">
                蓄 {amount} × {intent.hits}
              </span>
              <small>다음 턴 강타 · 끊기 가능</small>
            </>
          ) : (
            <>
              <span>
                ⚔ {amount}
                {intent.hits > 1 ? ` × ${intent.hits}` : ''}
              </span>
              <small>
                → {target?.name ?? '대상 없음'}
                {intent.weak ? ' · 약화 1' : ''}
              </small>
            </>
          ))}
      </div>
      <Sprite art={unit.art} />
      <div className="unit-shadow" />
      {art !== undefined && <span className={`spell-effect spell-${art}`} />}
      <div className="unit-info">
        <strong>{unit.name}</strong>
        <Health unit={unit} />
        <div className="statuses">
          {unit.ink > 0 && <span title="묵흔: 일부 카드 피해에 추가됩니다.">墨 {unit.ink}</span>}
          {Object.entries(unit.statuses)
            .filter(([, n]) => n > 0)
            .map(([key, n]) => (
              <span key={key} title={statusNames[key as keyof typeof statusNames]}>
                {statusNames[key as keyof typeof statusNames]} {n}
              </span>
            ))}
        </div>
      </div>
      {preview !== undefined && (
        <div className="damage-preview">
          예상 피해 <b>{preview}</b>
        </div>
      )}
      {impacts.map((e, i) => (
        <span key={i} className={`floating-number ${e.kind}`} style={{ '--n': i } as CSSProperties}>
          {e.kind === 'damage' ? '-' : '+'}
          {e.amount}
        </span>
      ))}
    </button>
  );
}
