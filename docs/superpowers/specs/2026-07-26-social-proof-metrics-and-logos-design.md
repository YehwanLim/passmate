# Social Proof metrics and company logos design

## Goal

Strengthen the trust moment between the report preview and the analysis pipeline.
Replace text-only company names with real company marks, make the proof metrics feel balanced rather than oversized, and remove the visible loop reset in the logo marquee.

## Scope

- Keep the existing Social Proof section location and testimonial carousel.
- Add real, locally served logo assets for all 18 companies in the data list. Use local SVG files; when a company publishes only a PNG, embed it in a local SVG wrapper. Render them in grayscale and restore their native color on hover.
- Expand the company list with LG Display, SK Chemicals, SK Telecom, NHN Commerce, Samyang Group, and CJ OliveNetworks. Rename the existing SK Chemistry entry to SK Chemicals.
- Replace the single oversized `127+` presentation with A-style paired metrics:
  - `127+` — 합격 기업
  - `2,000+` — 분석 완료 자소서
- Start each counter at zero when the section first enters the viewport, then finish at its configured target. Respect `prefers-reduced-motion` by showing its final value immediately.
- Keep the marquee moving left-to-right. It must repeat an identical, self-contained logo group so its animation loops at the exact group boundary with no visible reset or vertical page shift.

## Visual design

The existing headline remains the lead. The paired metrics sit beneath it in a restrained two-column block, separated by a subtle vertical rule on desktop and a horizontal rule on small screens. Both values use the current display typography at a reduced size, with the label below each value. This keeps the numbers prominent without allowing `127+` alone to dominate the section.

The company marks are a calm proof rail below the metrics. Every logo has a fixed visual-height container and `object-fit: contain` so marks with different aspect ratios align without distortion. Default appearance is grayscale and muted; hover/focus restores native color. Alt text is available once per company in the accessible list, while duplicate marquee groups remain hidden from assistive technology.

## Components and data

- `socialProof.ts` remains the single source of truth for metric values, labels, companies, and testimonials. Each company adds a `logo` asset path and explicit alt text.
- `SocialProofSection.tsx` uses small focused components:
  - `SocialProofMetric` animates one configured value.
  - `CompanyLogo` renders one asset with accessible fallback text.
  - The existing testimonial card remains unchanged.
- `socialProof.css` rules stay in `index.css` to preserve the current project convention.

## Animation and accessibility

- Metric counters use a request-animation-frame based numeric interpolation only after the section is visible; suffixes and thousands separators are present throughout.
- Reduced-motion users receive final metric values and a static first logo group.
- The marquee track contains exactly two equal-width logo groups. Each group includes its own trailing spacing, while the track has no inter-group gap. The animation moves by exactly one group width, eliminating the reset jump.
- The accessible company list announces every company exactly once; duplicated decorative marquee groups remain hidden from assistive technology.

## Validation

- Extend the Social Proof unit tests for configured paired metrics, every company asset path, final reduced-motion counter output, and the two-group marquee structure.
- Verify the section order remains report preview → Social Proof → pipeline.
- Run the Social Proof test, full root test suite with `.worktrees` excluded, type check, production build, and a desktop/mobile browser check of metric animation and marquee continuity.

## Out of scope

- Changing testimonial wording, company/role metadata, or the broader landing page layout.
- Adding live analytics or dynamically fetched acceptance statistics.
