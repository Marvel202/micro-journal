# verify-runtime (micro-journal patch)

Follow the global `/verify-runtime` protocol. Project-specific details below.

---

## Launch

```bash
npm run dev   # http://localhost:3000
```

For Drive-dependent paths, use the live deployment:
`https://micro-journal-ebon.vercel.app`

---

## Surface map

| Changed file | What to drive |
|---|---|
| `gdrive.ts` — pull | Load page with token → console: `[gdrive] Pulling...` |
| `gdrive.ts` — upload | Save entry → console: `[gdrive] Successfully uploaded` |
| `DriveSyncButton.tsx` | Click "☁︎ synced" → watch pull + push logs |
| `compress.ts` | Pick photo on iOS Safari → confirm not stuck at "saving…" |
| `Composer.tsx` | Trigger save error → confirm button un-sticks |
| `page.tsx` — background pull | Fresh incognito + token → entries appear without tapping sync |

## Evidence trail

All Drive operations log to console with `[gdrive]` prefix:

```
[gdrive] Pulling from Drive, skipping N local entries
[gdrive] Pull complete: N new entries
[gdrive] Sync complete — pulled: N pushed: N
[gdrive] Successfully uploaded YYYY-MM-DD.json
```

## Notes

- Drive paths require a real Google OAuth token — can't stub with Playwright
- UI-only paths (Composer, compress, layout) work headlessly
