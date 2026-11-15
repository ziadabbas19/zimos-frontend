# Template pictures

One pair per platform template, named by the template's id: `<id>-desk.webp`
(the top of its home page on a desktop, 640×400) and `<id>-phone.webp` (on a
phone, 360×480). The stores page shows them in its grid at once instead of
drawing each template live (src/pages/website/gallery/templateNames.ts lists
the ids that have one; a template without one is still drawn live).

Taken 2026-11-15 from the storefront app drawing each template as a store,
with each template's own demo products, at 1280×800 and 390×520.

A template added or changed in the console: take its two pictures the same
way, add them here, and add its id to `PICTURED` in templateNames.ts. Until
then it is drawn live, as before.
