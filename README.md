# Tabpire

Your tabs are draining you. Stake them.

## Build the extension

```
npm install
npm run build
```

The built extension is written to `.output/chrome-mv3`.

## Web demo

The web demo runs the new tab page and Blood Bank in a regular browser page, using a fake browser API instead of the extension APIs.

- `npm run demo:dev` starts the demo dev server.
- `npm run demo:build` builds the demo into `demo/dist`.

`.github/workflows/pages.yml` deploys the demo to GitHub Pages. The repository's Pages setting must use the "GitHub Actions" source.
