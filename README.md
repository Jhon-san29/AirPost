# EPOSTCARD

React / Express / tRPC / Drizzle starter, adapted from the Sandbox web-db-user template.

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm db:migrate`: apply checked-in migrations. `pnpm db:push`: generate and apply new schema changes.
- `pnpm check` / `pnpm test`: types and application tests.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`server/_core/publicConfig.ts` exposes only named public runtime values. Private keys stay server-side. The platform serves managed `/manus-storage/` assets; the application does not register a second proxy.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.

## Postcard storage (no database)

The current object store returns HTTP 403 `AccessDenied` when a signed read targets a missing key. The runtime storage API cannot list objects, and a generic 403 can also indicate a read-permission problem. If an existing saved-card list unexpectedly appears empty, restore storage read access before saving; otherwise a save may replace the fixed-key manifest based on that empty result.

Postcard content and uploaded media are written to managed object storage under `postcards/<owner-token>/<postcard-uuid>/`; uploaded photos and GIFs are stored as separate objects and the postcard JSON references their stable `/manus-storage/...` paths. The saved-card manifest is also kept in object storage at `postcards/<owner-token>/index.json`, overwritten at that fixed key; share links carry only the generated card-object key, not postcard JSON or base64 media. The server needs the managed `MANUS_API_URL` and `MANUS_API_KEY` environment variables; this feature does not use `DATABASE_URL` or `localStorage`.

The owner token is an opaque, random, HTTP-only cookie (not postcard content) that scopes each browser's cloud manifest. Clearing that cookie loses access to that browser's saved-card list; the cloud objects remain. The platform runtime storage API does not support listing or deleting objects: removing an item from the manager removes it from the manifest but does not physically erase its cloud objects. A cloud manifest avoids database use but is last-write-wins across separate server instances if simultaneous edits occur.
