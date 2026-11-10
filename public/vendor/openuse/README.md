# OpenUse floating toolbar

Vendored script SDK version: **1.0.0**.

- Source: https://sdk.whogogo.com/1.0.0/openuse.js
- Integration documentation: https://sdk.whogogo.com/README.md
- Application adapter: `/public/openuse-toolbar.js`

The original bundle includes upstream license notices. Keep them when updating.
Self-hosting lets the toolbar load under COEP `require-corp` and from the app's
service worker cache without contacting the SDK host.

To upgrade, add a new version directory, update the script URLs in the three
HTML entries and both `bin/pages/render-*.mjs` templates, then update
`public/sw.js` and `public/_headers`. Keep published version files immutable.

The adapter reuses ranui's theme-switch `value` property and the site's language
links. Editor/history locale changes preserve query parameters and use normal
navigation so unsaved-document guards apply. Embedded editors omit the toolbar.
