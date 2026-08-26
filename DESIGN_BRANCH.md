# design/chm-site

This branch IS the new CHM site design, verbatim — the Next.js app built
and reviewed at localhost:3003. It is the source of truth for the new UI.

It is not wired to this repo's Vite frontend or its deploy pipeline; it is
here so the design lives in the same repository it is being ported into.

Run it:

    npm install
    npx next dev -p 3003

Dark is the default appearance; the toggle in the nav switches. Both
appearances measure zero WCAG contrast failures on every page.
