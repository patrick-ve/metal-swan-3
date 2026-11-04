# src/game/content/art40 — baked 40 px character sets

Generated files only: `<slug>.gen.ts`, one per set in `tools/art40/chars/<slug>/`, written by
`npm run art40 -- <slug>` (or `--all`). Never edit them by hand; change the set module and bake
again. `npm run art40 -- --all --check` fails when a file here differs from its set.

Each file exports `SET` (a `BakedSet`, `src/engine/baked.ts`) and one named constant per event
(`THROW_RELEASE`, `KICK_HIT`, ...). Content modules register a set with `defineBakedSet(SET)`;
heroes load with the core content, the cast with the ams content modules (docs/design/ams40.md
"Pipeline"). Format and loader: docs/api/media.md "Baked sets".

Nothing else belongs here: the joint tracks the smoothness gate reads are written to
`tools/art40/joints/<slug>.json` (not shipped). All baked data together: at most 400 KB gzip
(`tests/art/art40-gates.test.ts`).
