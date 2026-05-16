// Avatars are bundled from src/assets/avatars/. Vite discovers them at
// build time via import.meta.glob. Drop a new file in, rebuild, it shows
// up in the picker — no list to maintain.
//
// We store the filename stem as `avatar_id` on people. URLs are hashed
// at build time, so they aren't safe to put in the DB.

const avatarModules = import.meta.glob(
  '../assets/avatars/*.{png,jpg,jpeg,webp,svg,gif}',
  { eager: true, query: '?url', import: 'default' },
);

export interface Avatar {
  id: string;
  url: string;
}

export const AVATARS: Avatar[] = Object.entries(avatarModules)
  .map(([path, url]) => {
    const filename = path.split('/').pop() ?? '';
    const id = filename.replace(/\.[^.]+$/, '');
    return { id, url: url as string };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

const URL_BY_ID = new Map(AVATARS.map((a) => [a.id, a.url]));

export function getAvatarUrl(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  return URL_BY_ID.get(id);
}
