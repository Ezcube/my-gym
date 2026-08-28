# Nutrition Photo Gallery Selection Design

## Goal

Allow a user to choose an existing meal photo from the device gallery without removing the current rear-camera capture flow.

## Chosen interface

The photo-analysis card shows two equal actions:

1. `Take photo` opens the device camera through a file input with `capture="environment"`.
2. `Choose from gallery` opens the system image picker through a separate file input without a `capture` attribute.

Both inputs accept JPEG, PNG, and WebP. The selected filename is shown in the card so the user can verify which image will be analysed. Both actions update the same in-memory `photo` state, so the existing hint, known-weight, and analysis controls remain unchanged.

## Data flow and privacy

The selected file continues through the existing `prepareFoodPhoto` path. It is validated, resized and re-encoded as JPEG without EXIF before being sent to the existing nutrition photo-analysis API. The original file and the prepared image are not persisted by the frontend.

After a successful analysis, the shared photo state and both native file-input values are cleared. Clearing both inputs allows the user to select the same camera or gallery file again later and prevents stale filenames from remaining in the browser control.

## Accessibility and localization

The two visible buttons use normal localized button text and remain keyboard accessible. Their native file inputs are visually hidden and are activated only by their corresponding button. The selected filename is rendered as ordinary text below the actions.

English and Russian translations are added for `Take photo`, `Choose from gallery`, and `Selected photo: {0}`.

## Error handling

Existing validation and error behavior remain authoritative: unsupported types, oversized images, browser encoding failures, and API failures use the current photo-analysis error path. Choosing a new image replaces the previous selection and clears any local photo error before the next analysis attempt.

## Verification

A focused frontend test verifies that:

- both actions are rendered;
- only the camera input has `capture="environment"`;
- both inputs have the supported image accept list;
- choosing a gallery image selects it and enables analysis;
- successful analysis clears both native inputs.

The existing nutrition view test and a production frontend build are run before deployment. Production verification checks the public page and confirms the deployed markup exposes separate camera and gallery inputs; the nutrition API and Samsung Health companion are out of scope and remain unchanged.
