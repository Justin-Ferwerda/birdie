import Avatar from './Avatar';
import type { TournamentPlayerWithPerson } from '../hooks/useTournamentPlayers';

interface PartnerPickerProps {
  /** Candidates (typically the card minus the primary). */
  candidates: TournamentPlayerWithPerson[];
  selectedPlayerNumber: number | null;
  onChange: (player_number: number | null) => void;
  label?: string;
}

export default function PartnerPicker({
  candidates,
  selectedPlayerNumber,
  onChange,
  label = 'Pick a partner',
}: PartnerPickerProps) {
  if (candidates.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        No partners available — needs another player on the card.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {candidates.map((p) => {
          const isSelected = p.player_number === selectedPlayerNumber;
          return (
            <button
              key={p.player_number}
              type="button"
              onClick={() => onChange(isSelected ? null : p.player_number)}
              className={[
                'flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-left transition-colors',
                isSelected
                  ? 'border-gold-500 bg-gold-500/10'
                  : 'border-slate-800 bg-slate-900 active:bg-slate-800',
              ].join(' ')}
            >
              <Avatar
                avatarId={p.person?.avatar_id}
                displayName={p.display_name}
                size={24}
              />
              <span className="min-w-0 truncate text-xs">{p.display_name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
