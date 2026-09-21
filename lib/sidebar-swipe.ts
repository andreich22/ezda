export const MOBILE_SIDEBAR_SWIPE_DISTANCE = 72;
export const MOBILE_SIDEBAR_SWIPE_HORIZONTAL_TOLERANCE = 1.25;

type Swipe = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  scrollTop: number;
};

export function shouldDismissMobileSidebarSwipe({
  startX,
  startY,
  endX,
  endY,
  scrollTop,
}: Swipe): boolean {
  if (scrollTop > 0) return false;

  const deltaX = endX - startX;
  const deltaY = endY - startY;

  return (
    deltaY >= MOBILE_SIDEBAR_SWIPE_DISTANCE &&
    deltaY > Math.abs(deltaX) * MOBILE_SIDEBAR_SWIPE_HORIZONTAL_TOLERANCE
  );
}
