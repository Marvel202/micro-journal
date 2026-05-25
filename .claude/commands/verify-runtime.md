# verify-runtime

Runtime observation for micro-journal. Run the app, drive it to where the
changed code executes, capture what you see. That is the evidence.

**Don't run tests. Don't typecheck.** Those are CI. Time goes to the running
app instead.

---

## 1. Scope the change

```bash
git log --oneline @{u}..          # commits ahead of upstream
git diff @{u}.. --stat            # full range
git diff HEAD~1 HEAD --stat       # if no upstream set
git diff HEAD --stat              # uncommitted working tree
```

State the commit count. Read the diff — the diff is ground truth. Any PR
description is a claim about it. If they disagree, that's a finding.

---

## 2. Identify the surface

| Change reaches | Surface | How to drive |
|---|---|---|
| Browser UI / state | pixels + console | start dev server, Playwright or manual |
| IndexedDB storage | browser DevTools | Application → IndexedDB → micro-journal |
| Google Drive API | Drive console + `[gdrive]` logs | needs real OAuth token |
| compress.ts | photo save flow | pick a photo, save, check size + console |
| gdrive.ts | Drive sync button | check `[gdrive]` log lines in console |

**No runtime surface** (docs, types, .gitignore) → **SKIP — no runtime surface.**

---

## 3. Launch

```bash
# Start dev server
npm run dev
# Opens at http://localhost:3000
```

For Drive-dependent paths (pull, push, token), you need a real Google account
with an active OAuth token. Use the running Vercel deployment for those:
`https://micro-journal-ebon.vercel.app`

For UI-only paths, Playwright works headlessly:

```bash
npx playwright open http://localhost:3000
```

---

## 4. Drive the changed code

Match the change to the path that exercises it:

| Changed file | Path to drive |
|---|---|
| `gdrive.ts` — `downloadMissingEntries` | Load page with token → watch console for `[gdrive] Pulling...` |
| `gdrive.ts` — `uploadEntry` | Save a new entry → watch console for `[gdrive] Successfully uploaded` |
| `DriveSyncButton.tsx` — `syncAll` | Click "☁︎ synced" → watch for pull + push logs |
| `compress.ts` | Pick a photo on iPhone Safari → confirm it saves (not stuck at "saving…") |
| `Composer.tsx` — error handling | Interrupt a save mid-flow → confirm button un-sticks |
| `page.tsx` — background pull | Fresh device/incognito with token in localStorage → entries appear without tapping sync |
| `layout.tsx` — `suppressHydrationWarning` | Load on iPhone Safari → no hydration error overlay |

---

## 5. Probe edges

After the happy path confirms, push on it:

- **Drive pull with empty Drive** → app loads fine, no crash, 0 entries pulled
- **Drive pull with expired token** → silent fail, local data still shown
- **Photo on iOS Safari** → pick from camera roll, confirm not stuck at "saving…"
- **Tap "☁︎ synced" twice quickly** → no duplicate uploads / race condition
- **No network** → save still writes to IndexedDB; Drive logs a warning, doesn't block

---

## 6. Capture evidence

Watch the browser console for `[gdrive]` log lines — they are the evidence trail
for all Drive operations:

```
[gdrive] Pulling from Drive, skipping N local entries
[gdrive] Need to fetch N entries from Drive
[gdrive] Pull complete: N new entries
[gdrive] Sync complete — pulled: N pushed: N
[gdrive] Starting upload for YYYY-MM-DD
[gdrive] Successfully uploaded YYYY-MM-DD.json
```

Screenshot the console + UI together when reporting.

---

## 7. Report

```
## Verification: <one-line what changed>

**Verdict:** PASS | FAIL | BLOCKED | SKIP

**Claim:** <what the diff says — note any mismatch with the description>

**Method:** <localhost dev server / Vercel URL / manual iPhone>

### Steps
1. ✅/❌/⚠️/🔍 <what you did> → <what the app showed>
   <[gdrive] log lines or screenshot>

🔍 = probe (off happy path). At least one required.

### Findings
⚠️ things worth interrupting a reviewer for
• friction, surprises, anything a first-time user would trip on
🔍 probe results even when they passed
```

**Verdicts:**
- **PASS** — app did what the change claimed at its real surface
- **FAIL** — didn't, or breaks something adjacent, or claim ≠ diff
- **BLOCKED** — couldn't reach surface (build broke, no token, env missing)
- **SKIP** — no runtime surface (docs, types only)
