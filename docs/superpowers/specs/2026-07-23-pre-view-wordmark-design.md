# Pre:View Wordmark Design

## Goal

Replace the current PassMate checkmark lockup with the approved `Pre:View` wordmark throughout the product.

## Approved Mark

- The mark has no standalone symbol.
- It renders as `Pre:View`, with `Pre` and `View` in white and only the colon in `#38BDF8`.
- The wordmark uses a moderately tight, not compressed, tracking value (`-0.045em`) and a small amount of colon-side spacing (`0.045em`).
- The source image is exported as a transparent 2048 × 512 PNG and retained with an SVG source in `client/public`.

## Scope

- Update the shared React `Logo` component so every existing in-product header and footer logo receives the wordmark automatically.
- Preserve existing caller typography classes for responsive sizing.
- Do not rename storage keys, API identifiers, legal copy, report labels, or admin terminology in this change.

## Verification

- A component-source test asserts the text composition, colon-only brand color, approved spacing, and removal of the legacy SVG checkmark.
- The TypeScript check and production build must succeed.
- The exported PNG must be verified to be 2048 × 512 pixels with transparency.
