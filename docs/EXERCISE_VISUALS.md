# Exercise visuals

This fork ships original generated technique and target-muscle images for the 446 exercise IDs listed in `frontend/src/lib/exercise-visuals.js`. The remaining catalogue uses the built-in MuscleMap-derived body diagram.

The generated files are not copied from the upstream Gym visual filenames, a stock library, or a remote exercise API. Runtime code never requests those legacy files.

## Regeneration

1. Print the complete prompt with `node scripts/exercise-visual-prompts.mjs 0025 technique` or `node scripts/exercise-visual-prompts.mjs 0025 muscles`, substituting the required manifest ID for `0025`.
2. Use the built-in OpenAI image-generation tool.
3. Inspect the original output against the movement, equipment, anatomy, target muscles, and artifact checklist in the implementation specification.
4. Import an accepted output with `scripts/import-exercise-visual.ps1`.
5. Run `cd frontend && npm run test:exercise-visual-policy`.

The importer refuses to overwrite an accepted asset. Replace an asset only through a reviewed change that removes or renames the old file explicitly.

## Runtime policy

- exactly 446 manifest IDs and 892 WebP files;
- technique images: 1200×800;
- muscle images: 1200×675;
- maximum 300 KiB per file;
- no external image URL, embedded label, logo, or watermark;
- generated images are educational aids, not medical advice.
