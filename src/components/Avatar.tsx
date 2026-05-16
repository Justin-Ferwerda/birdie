import { getAvatarUrl } from '../lib/avatars';

interface AvatarProps {
  avatarId?: string | null;
  displayName?: string | null;
  size?: number;
  className?: string;
}

/** Returns the first letter of the first two words of a name. Used as a
 * placeholder when a player has no avatar yet. */
function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase()).join('') || '?';
}

export default function Avatar({
  avatarId,
  displayName,
  size = 40,
  className = '',
}: AvatarProps) {
  const url = getAvatarUrl(avatarId);
  const style = { width: size, height: size };

  if (url) {
    return (
      <img
        src={url}
        alt={displayName ?? avatarId ?? 'Avatar'}
        style={style}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-full border border-dashed border-slate-700 bg-slate-900 text-xs font-medium text-slate-500 ${className}`}
    >
      {initials(displayName)}
    </span>
  );
}
