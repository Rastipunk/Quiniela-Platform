## Binary assets & i18n (inventory-only — not read line by line)

Per scope decision 2, binaries are inventoried with purpose, not read
byte by byte. i18n message JSON is described structurally.

### Brand assets — backend (`backend/src/assets/`)

Used by the PDF renderer (`backend/src/pdf/`) for quotes and cuentas de
cobro. Embedded into PDFs, so they live in the backend bundle.

| File | Bytes | Purpose |
|---|---|---|
| `brand/isotipo-degradado-32.png` | 2,298 | Small gradient isotype for PDF headers |
| `brand/isotipo-degradado-500.png` | 136,085 | Large gradient isotype (hi-res PDF) |
| `brand/logotipo-degradado-120.png` | 47,532 | Gradient wordmark 120px |
| `brand/logotipo-degradado-40.png` | 9,353 | Gradient wordmark 40px |
| `fonts/Inter-Bold.ttf` | 420,428 | Inter Bold embedded in PDFs |
| `fonts/Inter-Italic.ttf` | 417,388 | Inter Italic embedded in PDFs |
| `fonts/Inter-Regular.ttf` | 411,640 | Inter Regular embedded in PDFs |
| `fonts/Inter-SemiBold.ttf` | 419,744 | Inter SemiBold embedded in PDFs |

### Brand assets — frontend (`frontend-next/public/brand/` + `src/app/`)

Web-facing logos/icons. SVG variants for crisp rendering, PNG for PWA
icons and fallbacks. `src/app/icon.svg` + `apple-icon.png` are Next.js
metadata icon conventions.

- `isotipo-degradado-{32,180,320,500}.{png,svg}` — gradient isotype, all sizes
- `isotipo-transparente-blanca-{32,180}.svg` — white transparent isotype (dark backgrounds)
- `isotipo-transparente-degradado-{32,180}.svg` — gradient transparent isotype
- `logotipo-blanco-{40,80,120}.svg` — white wordmark
- `logotipo-degradado-{40,80,120}.{png,svg}` — gradient wordmark
- `pwa-icon-192.png`, `pwa-icon-512.png` — PWA manifest icons
- `world-cup-2026.webp`, `world-cup-2026-trophy.webp` — WC2026 landing imagery
- `src/app/apple-icon.png`, `src/app/icon.svg` — Next.js app-icon metadata files

**Note:** backend and frontend each keep their own copy of the gradient
brand PNGs (identical sizes). This is intentional — backend embeds them
in PDFs, frontend serves them over HTTP. Not duplication to remove.

### Playwright visual-regression baselines (legitimate)

`frontend-next/e2e/visual-regression.spec.ts-snapshots/*.png` (10 files)
are the committed golden screenshots for visual-regression tests. These
are SUPPOSED to be versioned — they are the comparison baseline.

### ⚠️ Junk candidates (generated test artifacts, should NOT be versioned)

| File | Why it's junk |
|---|---|
| `frontend-next/playwright-report/data/12e143f0122969ae09a1e7ecb7e77abf8136cee9.png` | Generated Playwright HTML-report artifact from a local run |
| `frontend-next/playwright-report/data/19e79dc42b3524339f8de52f52c17f2bb388c91a.md` | Same — generated report data |
| `frontend-next/test-results/.../test-failed-1.png` | Failure screenshot from a local test run |
| `frontend-next/test-results/.../error-context.md` | Failure context from a local test run |
| `docs/images/landing.png`, `docs/images/pool.png` | Verify if still referenced by README/docs before removing |

→ Recommend: delete the `playwright-report/` and `test-results/`
artifacts and add both directories to `frontend-next/.gitignore`.
Flagged for Phase 2 confirmation.

### i18n messages (`frontend-next/src/messages/{es,en,pt}/`)

25 namespace files per locale × 3 locales = 75 files. Each locale is a
complete mirror (per CLAUDE.md rule: never add a key to one locale
without the other two). Namespaces:

`auth`, `common`, `cookieConsent`, `dashboard`, `faq`, `footballPool`,
`howItWorks`, `howToPlay`, `legal`, `payment`, `penca`, `polla`, `pool`,
`poolWizard`, `porra`, `pricing`, `pricingPage`, `prode`, `profile`,
`seo`, `share`, `teams`, `tournaments`, `whatIsQuiniela`, `worldCup`.

The regional namespaces (`penca`, `polla`, `porra`, `prode`,
`footballPool`, `whatIsQuiniela`) back the SEO regional landing pages
(different Spanish-speaking markets' word for "pool"). `teams` and
`tournaments` back catalog display names.
