import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTournamentPlayers } from '../hooks/useTournamentPlayers';
import { useRuleActivations } from '../hooks/useRuleActivations';
import { useHoles } from '../hooks/useHoles';
import Avatar from '../components/Avatar';
import { RULES, type Rule } from '../config/rules';
import type { CourseId, RuleActivation } from '../types/database';

const COURSE_LABEL: Record<CourseId, string> = {
  seven_oaks: 'Seven Oaks',
  crockett: 'Crockett',
  cedar_hill: 'Cedar Hill',
};

// The Classic is conditional/required on Seven Oaks H6 (Phase 15), not a
// rule the player picks up like the others. Exclude from the wallet grid.
const WALLET_RULES: Rule[] = RULES.filter((r) => r.key !== 'the_classic');

export default function RuleWallet() {
  const { playerNumber: playerParam } = useParams<{ playerNumber: string }>();
  const navigate = useNavigate();
  const players = useTournamentPlayers();
  const activations = useRuleActivations();
  const holes = useHoles();

  const playerNumber = playerParam ? parseInt(playerParam, 10) : NaN;

  const player = useMemo(
    () => players.data?.find((p) => p.player_number === playerNumber) ?? null,
    [players.data, playerNumber],
  );

  // Per-rule_key, the most-recent activation owned by this player.
  const usedByKey = useMemo(() => {
    const m = new Map<string, RuleActivation>();
    (activations.data ?? [])
      .filter((a) => a.primary_player_number === playerNumber)
      .forEach((a) => {
        const existing = m.get(a.rule_key);
        if (!existing || (a.created_at ?? '') > (existing.created_at ?? '')) {
          m.set(a.rule_key, a);
        }
      });
    return m;
  }, [activations.data, playerNumber]);

  const [detail, setDetail] = useState<Rule | null>(null);

  const usedCount = usedByKey.size;

  if (!player) {
    return (
      <section className="mx-auto max-w-md px-4 py-6 text-sm text-slate-400">
        Player not found.{' '}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="underline"
        >
          Back
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
      <header className="flex items-center gap-3">
        <Avatar
          avatarId={player.person?.avatar_id}
          displayName={player.display_name}
          size={44}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">
            Rule wallet
          </div>
          <div className="truncate text-base font-semibold">
            {player.display_name}
          </div>
          <div className="text-xs text-slate-400">
            {usedCount} / {WALLET_RULES.length} used
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2">
        {WALLET_RULES.map((r) => {
          const used = usedByKey.get(r.key);
          const isUsed = !!used;
          const holeInfo = used?.hole_id
            ? holes.data?.find((h) => h.id === used.hole_id)
            : null;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setDetail(r)}
              className={[
                'flex flex-col items-start gap-1 rounded-lg border p-2 text-left transition-colors',
                isUsed
                  ? 'border-slate-800 bg-slate-900/40 opacity-60'
                  : 'border-slate-700 bg-slate-900/60 active:bg-slate-800',
              ].join(' ')}
            >
              <div className="flex w-full items-center gap-1.5">
                <span aria-hidden className="text-lg leading-none">
                  {r.emoji}
                </span>
                <span className="flex-1 truncate text-xs font-semibold text-slate-100">
                  {r.displayName}
                </span>
                {isUsed && (
                  <span
                    aria-label="Used"
                    className="text-[10px] font-bold text-emerald-400"
                  >
                    ✓
                  </span>
                )}
              </div>
              {isUsed ? (
                <div className="text-[10px] uppercase tracking-wider text-slate-500">
                  {holeInfo
                    ? `${COURSE_LABEL[holeInfo.course_id]} · H${holeInfo.hole_number}`
                    : 'used'}
                  {used.delta_applied != null && used.delta_applied !== 0 && (
                    <span className="ml-1 text-gold-400">
                      {used.delta_applied > 0
                        ? `+${used.delta_applied}`
                        : used.delta_applied}
                    </span>
                  )}
                </div>
              ) : (
                <p className="line-clamp-2 text-[10px] leading-snug text-slate-400">
                  {r.description}
                </p>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="self-center text-xs text-slate-500 underline-offset-2 hover:underline"
      >
        ← Back
      </button>

      {detail && (
        <RuleDetailsModal
          rule={detail}
          activation={usedByKey.get(detail.key) ?? null}
          allPlayers={players.data ?? []}
          holes={holes.data ?? []}
          onClose={() => setDetail(null)}
        />
      )}
    </section>
  );
}

interface RuleDetailsModalProps {
  rule: Rule;
  activation: RuleActivation | null;
  allPlayers: { player_number: number; display_name: string }[];
  holes: { id: string; course_id: CourseId; hole_number: number }[];
  onClose: () => void;
}

function RuleDetailsModal({
  rule,
  activation,
  allPlayers,
  holes,
  onClose,
}: RuleDetailsModalProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const holeInfo = activation?.hole_id
    ? holes.find((h) => h.id === activation.hole_id)
    : null;
  const outcomeSuccess = (activation?.outcome as { success?: boolean } | null)?.success;
  const photoUrl = (activation?.outcome as { photo_url?: string } | null)?.photo_url ?? null;
  const partnerNames = (activation?.partner_player_numbers ?? [])
    .map((n) => allPlayers.find((p) => p.player_number === n)?.display_name ?? `Player ${n}`)
    .join(', ');
  const targetName = activation?.target_player_number
    ? (allPlayers.find((p) => p.player_number === activation.target_player_number)?.display_name ?? null)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 -z-10 bg-slate-950/70 backdrop-blur"
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-t-2xl border-x border-t border-slate-800 bg-slate-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl leading-none">{rule.emoji}</span>
              <h3 className="text-lg font-semibold">{rule.displayName}</h3>
            </div>
            <p className="mt-1 text-sm leading-snug text-slate-300">
              {rule.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-slate-800 px-3 py-1 text-sm"
          >
            Close
          </button>
        </div>

        {activation ? (
          <>
            <div className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs">
              <Field
                label="Hole"
                value={
                  holeInfo
                    ? `${COURSE_LABEL[holeInfo.course_id]} · H${holeInfo.hole_number}`
                    : '—'
                }
              />
              {outcomeSuccess != null && (
                <Field
                  label="Outcome"
                  value={outcomeSuccess ? '✓ Made it' : '✗ Missed'}
                  valueClass={outcomeSuccess ? 'text-emerald-300' : 'text-rose-300'}
                />
              )}
              {partnerNames && <Field label="Partner" value={partnerNames} />}
              {targetName && <Field label="Target" value={targetName} />}
              {activation.delta_applied != null && (
                <Field
                  label="Delta"
                  value={
                    activation.delta_applied === 0
                      ? '—'
                      : activation.delta_applied > 0
                        ? `+${activation.delta_applied}`
                        : `${activation.delta_applied}`
                  }
                  valueClass={
                    activation.delta_applied < 0
                      ? 'text-gold-400'
                      : activation.delta_applied > 0
                        ? 'text-rose-300'
                        : 'text-slate-400'
                  }
                />
              )}
              {rule.requiresPhoto && !photoUrl && (
                <Field
                  label="Photo"
                  value="not yet uploaded"
                  valueClass="text-amber-300"
                />
              )}
            </div>
            {photoUrl && (
              <a
                href={photoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="overflow-hidden rounded-lg border border-slate-800"
              >
                <img
                  src={photoUrl}
                  alt={`${rule.displayName} proof`}
                  className="block max-h-72 w-full object-contain bg-black"
                />
              </a>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
            Not yet used.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`text-right text-xs ${valueClass ?? 'text-slate-200'}`}>
        {value}
      </div>
    </div>
  );
}
