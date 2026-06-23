# micro-journal

One sentence or one photo. That's the day.

A minimal daily journaling PWA — no account required, no cloud dependency. Entries live in your browser's IndexedDB. Google Drive sync/restore is optional and scope-limited to files the app creates.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS |
| Fonts | Caveat (handwritten), Lora (serif) |
| Storage | IndexedDB (via native API) |
| Sync/restore | Google Identity Services + Drive API v3 |
| Validation | Zod |

No backend. No database. No auth server.

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Features

- **One entry per day** — text (one sentence) or photo
- **Streak tracking** — consecutive days with an entry
- **Entry stack** — browse every past card
- **Image compression** — phone photos compressed before storage (~5 MB → ~200 KB)
- **PWA** — installable on iPhone/Android via "Add to Home Screen"
- **Google Drive sync/restore** — optional, restores missing entries on load/resume and backs up saves in the background

---

## Project Structure

```
src/
  app/
    page.tsx          # Home — composer + history stack
    layout.tsx        # Root layout, fonts, PWA meta
    globals.css       # Design tokens, component classes
    streak/           # /streak page
  components/
    Composer.tsx      # Entry creation (text or photo)
    EntryCard.tsx     # Card display
    DriveSyncButton.tsx  # Google Drive OAuth + sync
  lib/
    storage.ts        # IndexedDB read/write
    gdrive.ts         # Drive API calls, token management
    compress.ts       # Image compression (OffscreenCanvas)
    prompts.ts        # Daily prompt generation
    streak.ts         # Streak computation
    validate.ts       # Sentence validation
```

---

## Google Drive Sync / Restore (optional)

Syncs entries through `My Drive/micro-journal/` as:
- `YYYY-MM-DD.json` — text, prompt, metadata
- `YYYY-MM-DD.jpg` — compressed photo (photo entries only)

Uses `drive.file` scope — the app can only access files it creates.

### One-time setup

**1. Enable the Drive API**

Go to [Google Cloud Console](https://console.cloud.google.com/apis/api/drive.googleapis.com/) → select your project → click **Enable**.

**2. Create an OAuth client**

Go to [Credentials](https://console.cloud.google.com/apis/credentials) → **Create credentials** → **OAuth client ID** → Web application.

Under **Authorized JavaScript origins** add every origin you'll run from:

| Where | Origin to add |
|---|---|
| Local dev | `http://localhost:3000` |
| LAN (iPhone testing) | `http://192.168.x.x:3000` |
| Production | `https://your-app.vercel.app` |

> **Tip:** Deploy to Vercel to get a permanent HTTPS origin — no more IP changes when your router reassigns your Mac's address. This matters because IndexedDB is origin-scoped; changing from one LAN IP/origin to another creates a separate local journal cache.

**3. Add the client ID to `.env`**

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

**4. Connect in the app**

Click **☁︎ backup** in the header → sign in with Google → all existing entries upload immediately. Future saves back up automatically.

### Sync behaviour

| Action | What happens |
|---|---|
| Open/resume the app with a valid token | Loads local IndexedDB, pulls missing Drive entries, then pushes merged local entries |
| Open `/streak` directly | Uses the same load/sync flow before computing streak state |
| Click **☁︎ backup** (not connected) | OAuth → token saved → missing entries restored → merged entries uploaded |
| Click **☁︎ synced** (connected) | Runs the same bidirectional sync again |
| Save a new entry | Local IndexedDB save completes first; Drive upload continues in the background |
| Token expires (~1 hour) | A visible disconnected/reconnect state is shown; tap **☁︎ backup** to reconnect |

### Notes

- Sync is best-effort and never blocks saving locally — your entry is always written to IndexedDB first.
- No refresh tokens are stored. Short-lived access tokens only.
- To disconnect: DevTools → Application → Local Storage → delete `gdrive-access-token` and `gdrive-token-expiry`.

---

## Deploy to Vercel

```bash
npm i -g vercel
vercel deploy --prod
```

After deploying, add your Vercel URL to the **Authorized JavaScript origins** in Google Cloud Console (see setup step 2 above).
