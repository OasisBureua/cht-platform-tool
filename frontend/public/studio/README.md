# CHM Studio (embedded copy)

Static copy of the CHM Studio (thumbnails, social carousels, decks) served at
`/studio/*` and embedded in the admin panel under **Post-production**.
The source of truth is the standalone tool (chm-tool.ahdahzeh.com); when it
changes, copy `index.html`, `social.html`, `deck.html`, `shared.js`,
`studio.css` and `samples/` over this folder and keep the `?embed` snippet
in each page's `<head>` plus the `.embedded` rule at the foot of `studio.css`.
Everything runs in the browser; nothing here talks to the platform API.
