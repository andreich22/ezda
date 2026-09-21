import { describe, expect, it } from "vitest";
import {
  MOBILE_SIDEBAR_SWIPE_DISTANCE,
  shouldDismissMobileSidebarSwipe,
} from "../lib/sidebar-swipe";

describe("shouldDismissMobileSidebarSwipe", () => {
  it("dismisses after a sufficiently long downward swipe at the top", () => {
    expect(
      shouldDismissMobileSidebarSwipe({
        startX: 100,
        startY: 100,
        endX: 104,
        endY: 180,
        scrollTop: 0,
      }),
    ).toBe(true);
  });

  it("ignores short drags", () => {
    expect(
      shouldDismissMobileSidebarSwipe({
        startX: 100,
        startY: 100,
        endX: 100,
        endY: 100 + MOBILE_SIDEBAR_SWIPE_DISTANCE - 1,
        scrollTop: 0,
      }),
    ).toBe(false);
  });

  it("ignores upward and mostly horizontal gestures", () => {
    expect(
      shouldDismissMobileSidebarSwipe({
        startX: 100,
        startY: 200,
        endX: 180,
        endY: 120,
        scrollTop: 0,
      }),
    ).toBe(false);
  });

  it("does not dismiss while sidebar content is scrolled", () => {
    expect(
      shouldDismissMobileSidebarSwipe({
        startX: 100,
        startY: 100,
        endX: 100,
        endY: 220,
        scrollTop: 48,
      }),
    ).toBe(false);
  });
});
