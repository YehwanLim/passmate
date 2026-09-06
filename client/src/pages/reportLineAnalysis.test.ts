import { describe, expect, it } from "vitest";
import {
  getNeighborCardIndex,
  getHorizontalCenterOffset,
  getScrollPositionAt,
  resolveCoachPlacement,
} from "./reportLineAnalysis";

describe("getNeighborCardIndex", () => {
  const order = [2, 0, 3, 1];

  it("moves to the next card in source order", () => {
    expect(getNeighborCardIndex(order, 0, 1)).toBe(3);
  });

  it("moves to the previous card in source order", () => {
    expect(getNeighborCardIndex(order, 0, -1)).toBe(2);
  });

  it("returns null at the last card when stepping forward", () => {
    expect(getNeighborCardIndex(order, 1, 1)).toBeNull();
  });

  it("returns null at the first card when stepping backward", () => {
    expect(getNeighborCardIndex(order, 2, -1)).toBeNull();
  });

  it("returns null when the current card is not in the order", () => {
    expect(getNeighborCardIndex(order, 9, 1)).toBeNull();
  });
});

describe("getHorizontalCenterOffset", () => {
  it("centers the child inside the container", () => {
    expect(getHorizontalCenterOffset({ containerWidth: 300, childOffsetLeft: 400, childWidth: 100 })).toBe(300);
  });

  it("never returns a negative scroll offset", () => {
    expect(getHorizontalCenterOffset({ containerWidth: 300, childOffsetLeft: 20, childWidth: 100 })).toBe(0);
  });
});

describe("getScrollPositionAt", () => {
  it("starts at the origin and ends exactly at the target", () => {
    expect(getScrollPositionAt({ start: 100, target: 500, elapsed: 0, duration: 260 })).toBe(100);
    expect(getScrollPositionAt({ start: 100, target: 500, elapsed: 260, duration: 260 })).toBe(500);
  });

  it("decelerates: covers more than half the distance before half the time", () => {
    const mid = getScrollPositionAt({ start: 0, target: 400, elapsed: 130, duration: 260 });
    expect(mid).toBeGreaterThan(200);
    expect(mid).toBeLessThan(400);
  });

  it("clamps past the duration instead of overshooting", () => {
    expect(getScrollPositionAt({ start: 0, target: 400, elapsed: 999, duration: 260 })).toBe(400);
  });
});

describe("resolveCoachPlacement", () => {
  it("sits just left of the badge when there is room", () => {
    const placement = resolveCoachPlacement({ badgeCenter: 60, containerWidth: 350, bubbleWidth: 150 });
    expect(placement.left).toBe(40);
    expect(placement.tailX).toBe(15);
  });

  it("clamps the bubble inside the container when the badge is near the right edge", () => {
    const placement = resolveCoachPlacement({ badgeCenter: 330, containerWidth: 350, bubbleWidth: 150 });
    expect(placement.left).toBe(200);
    expect(placement.left + 150).toBeLessThanOrEqual(350);
    expect(placement.tailX).toBe(125);
  });

  it("keeps the tail within the bubble body", () => {
    const placement = resolveCoachPlacement({ badgeCenter: 5, containerWidth: 350, bubbleWidth: 150 });
    expect(placement.left).toBe(0);
    expect(placement.tailX).toBe(12);
  });
});
