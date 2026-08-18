import { Link } from 'react-router-dom';
import { PLAYLIST_KOLS } from '../../data/kol-playlists.generated';
import { findKolByDoctorSlug } from '../../utils/kol-lookup';

type Props = {
  playlistId: string;
};

function avatarUrl(name: string): string {
  const q = name.replace(/^Dr\.\s*/i, '').trim() || name;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(q)}&size=128&background=c2410c&color=fff&bold=true`;
}

/**
 * SCRUM-148: Show the KOLs featured in a playlist. Reverse of KolPlaylistSection —
 * closes the loop between playlist detail and KOL profile pages.
 */
export function PlaylistFeaturedPhysicians({ playlistId }: Props) {
  const slugs = PLAYLIST_KOLS[playlistId];
  if (!slugs || slugs.length === 0) return null;

  const kols = slugs
    .map((slug) => findKolByDoctorSlug(slug))
    .filter((k): k is NonNullable<typeof k> => k != null);

  if (kols.length === 0) return null;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 sm:p-5">
      <h3 className="text-sm font-bold text-zinc-900">Featured physicians</h3>
      <ul className="mt-3 flex flex-wrap gap-3">
        {kols.map((kol) => (
          <li key={kol.id}>
            <Link
              to={`/kol-network/profile/${encodeURIComponent(kol.id)}`}
              className="flex items-center gap-2.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 pr-4 transition hover:border-brand-300 hover:shadow-sm"
            >
              <img
                src={kol.photoUrl || avatarUrl(kol.name)}
                alt=""
                loading="lazy"
                className="h-8 w-8 rounded-full object-cover"
              />
              <span className="text-sm font-semibold text-zinc-900">{kol.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
