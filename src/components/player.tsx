"use client";

import Link from "next/link";
import { useState } from "react";
import { formatHref, type Item } from "@/lib/data";
import { PauseIcon, PlayIcon } from "./icons";

/**
 * The session player. The frame carries its own depth and lets the
 * thumbnail keep its colour: a tinted wash over the artwork hid the
 * faculty and made every session look identical.
 *
 * `queue` is the rest of the series or track. It replaces the old
 * chapter timestamps, which were the least useful thing that could
 * occupy the most valuable strip on the page.
 */
export function Player({ item, queue = [] }: { item: Item; queue?: Item[] }) {
  const [playing, setPlaying] = useState(false);
  const isAudio = item.format === "podcast";
  const progress = playing ? 6 : 0;

  return (
    <div className="overflow-hidden rounded-[8px] bg-surface shadow-[var(--shadow-card)]">
      <div className="relative aspect-video w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.thumb} alt="" className="absolute inset-0 size-full object-cover" />
        {/* Just enough scrim at the foot to carry the overlaid meta. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/10"
        />

        <button
          type="button"
          onClick={() => setPlaying((v) => !v)}
          aria-label={playing ? `Pause ${item.title}` : `Play ${item.title}`}
          className="group absolute inset-0 grid place-items-center"
        >
          <span className="press grid size-[4.5rem] place-items-center rounded-full bg-text text-ground shadow-[var(--shadow-pop)] transition-[scale] duration-150 ease-[var(--ease-standard)] group-hover:scale-105">
            {/* Both glyphs stay mounted and cross-fade, so the swap
                animates in and out without a motion dependency. */}
            <span className="relative grid size-7 place-items-center">
              <PauseIcon
                className={`absolute size-7 transition-[opacity,scale,filter] duration-300 ease-[var(--ease-cross)] ${
                  playing ? "scale-100 opacity-100 blur-0" : "scale-[0.25] opacity-0 blur-[4px]"
                }`}
              />
              <PlayIcon
                className={`size-7 transition-[opacity,scale,filter] duration-300 ease-[var(--ease-cross)] ${
                  playing ? "scale-[0.25] opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-0"
                }`}
              />
            </span>
          </span>
        </button>

        <span className="meta absolute end-4 bottom-4 text-white/85">
          {isAudio ? "Audio" : "Video"} · {item.duration}
        </span>
      </div>

      <div className="px-4 py-3.5">
        <div
          role="progressbar"
          aria-label="Playback position"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${progress}% through ${item.title}`}
          className="h-1 w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--color-text)_14%,transparent)]"
        >
          <div
            className="h-full rounded-full bg-anchor transition-[width] duration-500 ease-[var(--ease-out-strong)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          {/* State is carried by the label, not only by the icon swap. */}
          <p className="meta text-muted">{playing ? "Playing" : "Paused"}</p>
          <p className="meta tabular-nums text-muted">{item.duration}</p>
        </div>
      </div>

      {queue.length > 0 ? (
        <>
          <h2 id="queue-heading" className="eyebrow px-4 pt-1 pb-2 text-faint">
            Up next in this track
          </h2>
          <ol aria-labelledby="queue-heading" className="px-2 pb-2">
            {queue.map((q, i) => (
              <li key={q.slug}>
                <Link
                  href={formatHref(q)}
                  className="press group flex items-center gap-3 rounded-[6px] p-2 hover:bg-[color-mix(in_oklab,var(--color-text)_6%,transparent)]"
                >
                  <span className="meta w-5 shrink-0 tabular-nums text-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="relative block h-12 w-[5.25rem] shrink-0 overflow-hidden rounded-[6px] bg-ground">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={q.thumb} alt="" className="size-full object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-s text-dim group-hover:text-text">
                      {q.title}
                    </span>
                    <span className="meta mt-0.5 block tabular-nums text-faint">{q.duration}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
}
