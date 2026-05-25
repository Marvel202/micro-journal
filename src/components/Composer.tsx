"use client";

import { useEffect, useRef, useState } from "react";
import { validateSentence } from "../lib/validate";
import { saveEntry, type Entry } from "../lib/storage";
import { compressPhoto } from "../lib/compress";
import { loadToken, uploadEntry as driveUpload } from "../lib/gdrive";
import { verifyAttrs } from "../verify/core/contract";

type Props = {
  day: string;
  prompt: string;
  onSaved: (entry: Entry) => void;
};

type Mode = "choose" | "text" | "photo";

export default function Composer({ day, prompt, onSaved }: Props) {
  const [mode, setMode] = useState<Mode>("choose");
  const [text, setText] = useState("");
  const [caption, setCaption] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function handleSubmit() {
    setError(null);

    if (mode === "text") {
      const check = validateSentence(text);
      if (!check.ok) {
        setError(check.reason);
        return;
      }
      setSaving(true);
      try {
        const entry: Entry = {
          day,
          prompt,
          kind: "text",
          text: text.trim(),
          createdAt: Date.now(),
        };
        await saveEntry(entry);
        await tryBackup(entry);
        onSaved(entry);
      } catch (err) {
        console.error("[composer] Failed to save text entry:", err);
        setError("Something went wrong saving. Please try again.");
        setSaving(false);
      }
      return;
    }

    if (mode === "photo") {
      if (!photo) {
        setError("Pick a photo.");
        return;
      }
      setSaving(true);
      try {
        // Compress before storing — phone photos go from ~5 MB → ~200 KB
        const blob = await compressPhoto(photo);
        const entry: Entry = {
          day,
          prompt,
          kind: "photo",
          photo: blob,
          caption: caption.trim() || undefined,
          createdAt: Date.now(),
        };
        await saveEntry(entry);
        await tryBackup(entry);
        onSaved(entry);
      } catch (err) {
        console.error("[composer] Failed to save photo entry:", err);
        setError("Couldn't process the photo. Please try again.");
        setSaving(false);
      }
    }
  }

  /** Best-effort backup to Google Drive (if user has connected). Never blocks saving. */
  async function tryBackup(entry: Entry): Promise<void> {
    try {
      const token = loadToken();
      if (token) {
        await driveUpload(token, entry);
      } else {
        console.log("[gdrive] No valid token, skipping backup");
      }
    } catch (err) {
      console.error("[gdrive] Backup failed for", entry.day, err);
    }
  }

  const textValid = mode === "text" ? validateSentence(text).ok : false;
  const rootAttrs = verifyAttrs("Composer", {
    mode,
    day,
    textLength: text.length,
    textValid,
    hasPhoto: photo !== null,
    saving,
    hasError: error !== null,
  });

  if (mode === "choose") {
    return (
      <div {...rootAttrs} className="flex flex-col gap-5">
        <div className="pol-card pol-tape pol-tilt-l p-6 pt-7 pb-12 relative">
          <div className="pol-eyebrow mb-2">today&rsquo;s prompt</div>
          <p className="pol-hand text-2xl leading-snug text-ink">{prompt}</p>
          <span className="pol-hand absolute right-4 bottom-3 text-[color:var(--clay)] text-sm -rotate-3">↘ pick one</span>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setMode("text")}
            className="pol-btn pol-btn-primary"
            data-testid="composer-pick-text"
          >
            ✍️ Write one sentence
          </button>
          <button
            onClick={() => {
              setMode("photo");
              requestAnimationFrame(() => fileRef.current?.click());
            }}
            className="pol-btn pol-btn-secondary"
            data-testid="composer-pick-photo"
          >
            📷 Capture one photo
          </button>
          <p className="pol-hand text-center text-[color:var(--sage)] text-sm mt-1">a new card joins the stack</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Choose photo"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setPhoto(f);
          }}
        />
      </div>
    );
  }

  return (
    <div {...rootAttrs} className="flex flex-col gap-4">
      <div className="pol-prompt-strip text-center text-ink text-base px-4 py-3">
        {`“ ${prompt} ”`}
      </div>

      {mode === "text" && (
        <div className="pol-card pol-tape pol-tilt-l p-5 pt-6">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[\r\n]/g, ""))}
            placeholder="One sentence. End it."
            maxLength={240}
            rows={4}
            aria-label="Your one sentence"
            data-testid="composer-text"
            className="pol-hand w-full bg-transparent text-2xl leading-snug text-ink placeholder:text-[color:var(--clay)] focus:outline-none resize-none"
          />
          <div className="flex justify-between pol-meta mt-2">
            <span>{text.length}/240</span>
            <span>one&nbsp;.&nbsp;!&nbsp;or&nbsp;? at the end</span>
          </div>
        </div>
      )}

      {mode === "photo" && (
        <div className="pol-card pol-tape pol-tilt-r p-3 pb-8">
          {photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photoUrl}
              alt="Today"
              className="w-full aspect-square object-cover rounded-[2px]"
            />
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="aspect-square w-full rounded-[2px] pol-photo-placeholder grid place-items-center text-bone pol-hand text-xl"
            >
              tap to choose
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Choose photo"
            className="hidden"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
          {/* Caption — the handwritten one-liner below the photo */}
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.replace(/[\r\n]/g, "").slice(0, 80))}
            placeholder="add a line… (optional)"
            rows={2}
            maxLength={80}
            aria-label="Photo caption"
            data-testid="composer-caption"
            className="pol-hand w-full bg-transparent text-xl leading-snug text-ink placeholder:text-[color:var(--clay)] focus:outline-none resize-none mt-3 text-center"
          />
          {photoUrl && (
            <button
              onClick={() => fileRef.current?.click()}
              className="pol-hand text-[color:var(--persimmon)] text-sm block mt-1 underline-offset-2 hover:underline"
            >
              replace photo
            </button>
          )}
        </div>
      )}

      {error && (
        <p
          className="pol-hand text-center text-[color:var(--persimmon)] text-lg -rotate-1"
          data-testid="composer-error"
        >
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => {
            setMode("choose");
            setText("");
            setCaption("");
            setPhoto(null);
            setError(null);
          }}
          className="pol-btn pol-btn-secondary flex-1"
          disabled={saving}
        >
          ← back
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          data-testid="composer-save"
          className="pol-btn pol-btn-primary flex-[2]"
        >
          {saving ? "saving…" : "save for today"}
        </button>
      </div>
    </div>
  );
}
