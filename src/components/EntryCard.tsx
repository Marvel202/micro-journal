"use client";

import { useEffect, useState } from "react";
import type { Entry } from "../lib/storage";
import { verifyAttrs } from "../verify/core/contract";

type Props = {
  entry: Entry;
  big?: boolean;
  stamped?: boolean;
  tilt?: "left" | "right" | "none";
};

export default function EntryCard({ entry, big = false, stamped = false, tilt = "left" }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (entry.kind !== "photo" || !entry.photo) return;
    const u = URL.createObjectURL(entry.photo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [entry]);

  const rootAttrs = verifyAttrs("EntryCard", {
    kind: entry.kind,
    day: entry.day,
    textLength: entry.text?.length ?? 0,
    hasImageUrl: url !== null,
    big,
    stamped,
  });

  const tiltClass = tilt === "right" ? "pol-tilt-r" : tilt === "none" ? "" : "pol-tilt-l";
  const datePretty = formatDay(entry.day);

  return (
    <div
      {...rootAttrs}
      className={`pol-card pol-tape ${tiltClass} relative ${entry.kind === "photo" ? "p-3 pb-10" : "p-5 pb-6"}`}
    >
      {stamped && (
        <span className="pol-stamp absolute -top-2 right-5 z-10">today</span>
      )}

      {entry.kind === "text" ? (
        <>
          <p
            className={`pol-hand text-ink ${big ? "text-3xl leading-snug" : "text-xl leading-snug"}`}
          >
            {entry.text}
          </p>
          <div className="flex justify-between items-baseline mt-4">
            <span className="pol-meta">{"● "}{datePretty}</span>
            {big && entry.prompt && (
              <span className="pol-serif italic text-[color:var(--sage)] text-xs max-w-[60%] text-right">
                {entry.prompt}
              </span>
            )}
          </div>
        </>
      ) : (
        <>
          {url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={url}
              alt={entry.day}
              className="w-full aspect-square object-cover rounded-[2px]"
            />
          ) : (
            <div className="w-full aspect-square rounded-[2px] pol-photo-placeholder" />
          )}
          {/* Handwritten caption — the polaroid note below the photo */}
          <div className="pol-hand text-center text-ink text-xl mt-3 leading-snug">
            {entry.caption
              ? entry.caption
              : <span className="text-[color:var(--clay)] italic text-base">{entry.prompt}</span>}
          </div>
          <span className="pol-meta block text-center mt-1">{datePretty}</span>
        </>
      )}
    </div>
  );
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
