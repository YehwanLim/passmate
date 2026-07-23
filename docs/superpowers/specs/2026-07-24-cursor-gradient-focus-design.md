# Cursor Gradient Focus Design

## Goal

Keep the landing page's broad, quiet cursor-responsive atmosphere while making the area immediately around the pointer visibly denser and more defined. Fast pointer movement should briefly intensify only that center, without making the full background loud or changing its layout.

## Scope

This change is limited to `client/src/components/SubtleBackground.tsx`, which supplies the cursor-reactive background on the landing page. It does not change the page's content, navigation, static ambient gradients, animation timing, or mobile layout.

## Visual Behavior

The two existing cursor-following radial gradients remain broad and softly diffused. Their innermost color stops become more opaque, and their color-to-transparent transition occurs earlier. This raises contrast close to the pointer while preserving the current gradual, low-contrast outer field.

The existing smoothed pointer velocity becomes an intensity input for the same two gradients. At rest and during slow motion, the field uses the strengthened baseline center. As velocity rises, the center opacity increases to a capped maximum. The wide outer falloff and bloom band remain unchanged so that acceleration does not brighten the entire page.

## Implementation Design

`SubtleBackground` already produces `smoothVelocity` and maps it to motion values for the field and bloom opacity. Add a dedicated motion transform for cursor-center intensity, using the same velocity range as the other cursor-response transforms.

Use that transform in the responsive field's center color alpha values. Keep the two radial gradients and their positional motion values intact. Do not add DOM elements, pointer graphics, or timers; the existing requestAnimationFrame input batching and Framer Motion springs remain the complete interaction path.

## Accessibility and Performance

The background remains `aria-hidden` and `pointer-events-none`, so it cannot affect keyboard navigation or click targets. The update only changes values within the existing animated background path and preserves the current requestAnimationFrame throttling and cleanup behavior. No new continuous timers or listeners are introduced.

## Validation

Update `SubtleBackground.test.ts` to assert the stronger center colors and the velocity-derived center-intensity transform. Run the targeted Vitest test, then run TypeScript checking and the production build. Visually confirm that the center is more defined at rest, brightens moderately during fast movement, and that the rest of the background remains subdued.
