# src/pwa — owner: ChatGPT/Codex (Claude reviews)

Manifest and service worker. Rules agreed in issue #1:

- the service worker caches the app shell only; **user data is never stored in caches**;
- updates must not lose data. IndexedDB migrations are handled in `src/data`;
- icons come from `design/brand/png` (primary and bars-only). The icon choice applies only at install time on iOS.
