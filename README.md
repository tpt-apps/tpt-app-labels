# TPT Labels

Batch QR / Data Matrix / Code 128 / Code 39 / EAN-13 / UPC-A label generator. Runs
entirely client-side as an installable, offline-capable PWA. Built on the
[`tpt-barcode`](https://github.com/tpt-solutions/tpt-barcode) engine.

See [GUMROAD.md](GUMROAD.md) for the product listing copy and
[PRIVACY.md](PRIVACY.md) for the privacy statement shipped in-app.

## Repo layout

- `wasm/` — Rust crate exposing `encode_svg` / `encode_png` over `wasm-bindgen`,
  dispatching on a `format` string (`qr`, `datamatrix`, `code128`, `code39`,
  `ean13`, `upca`). Depends on `tpt-barcode` via a pinned git rev (see
  `wasm/Cargo.toml`) rather than a workspace path or crates.io release.
- `web/` — the app itself: plain HTML/ES modules (no bundler), `manifest.json`
  + `sw.js` for PWA installability and offline caching, `vendor/` for the
  built wasm output (generated, not checked in — see below).
- `build.sh` / `build.ps1` — runs `wasm-pack build --target web` and copies
  the output into `web/vendor/`.
- `deploy/` — static hosting config for deploying `web/` as-is.

## Build & run locally

Requires `wasm-pack` (`cargo install wasm-pack`).

```sh
./build.sh        # or build.ps1 on Windows
npx serve web      # any static file server works; PWA/camera features need a secure context (localhost is fine)
```

Then open the printed URL. To pick up changes, re-run the build script.

## Updating the `tpt-barcode` dependency

`wasm/Cargo.toml` pins an exact commit of `tpt-barcode` via `rev = "..."`.
Bump it deliberately:

```sh
cd wasm
# edit Cargo.toml's rev, then:
cargo update -p tpt-barcode --precise <new-rev>
```

## License

The app itself is proprietary — see [LICENSE](LICENSE). `tpt-barcode` (a
separate repository) is dual MIT/Apache-2.0 licensed.
