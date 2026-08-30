/** 圆形与 AABB 矩形碰撞检测 */
export function circleRectOverlap(
  cx: number, cy: number, cr: number,
  rx: number, ry: number, rw: number, rh: number
): boolean {
  const halfW = rw / 2;
  const halfH = rh / 2;
  const nearestX = Math.max(rx - halfW, Math.min(cx, rx + halfW));
  const nearestY = Math.max(ry - halfH, Math.min(cy, ry + halfH));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < cr * cr;
}

/**
 * 返回移动圆首次接触静止圆的归一化时间；0 表示起点已重叠，1 表示终点接触。
 */
export function sweptCircleCircleHitFraction(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  movingRadius: number,
  targetX: number,
  targetY: number,
  targetRadius: number
): number | undefined {
  const radius = Math.max(0, movingRadius) + Math.max(0, targetRadius);
  const offsetX = startX - targetX;
  const offsetY = startY - targetY;
  const c = offsetX * offsetX + offsetY * offsetY - radius * radius;
  if (c <= 0) return 0;

  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const a = deltaX * deltaX + deltaY * deltaY;
  if (a <= Number.EPSILON) return undefined;

  const b = 2 * (offsetX * deltaX + offsetY * deltaY);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return undefined;

  const hitFraction = (-b - Math.sqrt(discriminant)) / (2 * a);
  return hitFraction >= 0 && hitFraction <= 1 ? hitFraction : undefined;
}

/** 对静止 AABB 的圆角 Minkowski 外扩区域做线段判定，返回首次接触时间。 */
export function sweptCircleRectHitFraction(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  radius: number,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): number | undefined {
  const safeRadius = Math.max(0, radius);
  const halfWidth = rectWidth * 0.5;
  const halfHeight = rectHeight * 0.5;
  let firstHit = segmentAabbHitFraction(
    startX,
    startY,
    endX,
    endY,
    rectX - halfWidth - safeRadius,
    rectY - halfHeight,
    rectX + halfWidth + safeRadius,
    rectY + halfHeight
  );
  firstHit = earlierHit(
    firstHit,
    segmentAabbHitFraction(
      startX,
      startY,
      endX,
      endY,
      rectX - halfWidth,
      rectY - halfHeight - safeRadius,
      rectX + halfWidth,
      rectY + halfHeight + safeRadius
    )
  );

  firstHit = earlierHit(firstHit, sweptCircleCircleHitFraction(
    startX, startY, endX, endY, safeRadius,
    rectX - halfWidth, rectY - halfHeight, 0
  ));
  firstHit = earlierHit(firstHit, sweptCircleCircleHitFraction(
    startX, startY, endX, endY, safeRadius,
    rectX + halfWidth, rectY - halfHeight, 0
  ));
  firstHit = earlierHit(firstHit, sweptCircleCircleHitFraction(
    startX, startY, endX, endY, safeRadius,
    rectX - halfWidth, rectY + halfHeight, 0
  ));
  return earlierHit(firstHit, sweptCircleCircleHitFraction(
    startX, startY, endX, endY, safeRadius,
    rectX + halfWidth, rectY + halfHeight, 0
  ));
}

function earlierHit(current: number | undefined, candidate: number | undefined): number | undefined {
  if (candidate === undefined) return current;
  return current === undefined ? candidate : Math.min(current, candidate);
}

function segmentAabbHitFraction(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): number | undefined {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  let entry = 0;
  let exit = 1;

  if (Math.abs(deltaX) <= Number.EPSILON) {
    if (startX < minX || startX > maxX) return undefined;
  } else {
    let near = (minX - startX) / deltaX;
    let far = (maxX - startX) / deltaX;
    if (near > far) [near, far] = [far, near];
    entry = Math.max(entry, near);
    exit = Math.min(exit, far);
    if (entry > exit) return undefined;
  }

  if (Math.abs(deltaY) <= Number.EPSILON) {
    if (startY < minY || startY > maxY) return undefined;
  } else {
    let near = (minY - startY) / deltaY;
    let far = (maxY - startY) / deltaY;
    if (near > far) [near, far] = [far, near];
    entry = Math.max(entry, near);
    exit = Math.min(exit, far);
    if (entry > exit) return undefined;
  }

  return entry >= 0 && entry <= 1 ? entry : undefined;
}

/** 从圆形与 AABB 碰撞中推出圆形（返回推出向量） */
export function pushCircleFromRect(
  cx: number, cy: number, cr: number,
  rx: number, ry: number, rw: number, rh: number
): { x: number; y: number } | null {
  const result = { x: 0, y: 0 };
  return pushCircleFromRectInto(cx, cy, cr, rx, ry, rw, rh, result) ? result : null;
}

export function pushCircleFromRectInto(
  cx: number, cy: number, cr: number,
  rx: number, ry: number, rw: number, rh: number,
  out: { x: number; y: number }
): boolean {
  const halfW = rw / 2;
  const halfH = rh / 2;
  const nearestX = Math.max(rx - halfW, Math.min(cx, rx + halfW));
  const nearestY = Math.max(ry - halfH, Math.min(cy, ry + halfH));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= cr * cr) return false;
  // 圆心在矩形内部：沿最小穿透轴推出
  if (distSq === 0) {
    const distLeft   = cx - (rx - halfW);
    const distRight  = (rx + halfW) - cx;
    const distTop    = cy - (ry - halfH);
    const distBottom = (ry + halfH) - cy;
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);
    if (minDist === distLeft) {
      out.x = -(cr + distLeft);
      out.y = 0;
    } else if (minDist === distRight) {
      out.x = cr + distRight;
      out.y = 0;
    } else if (minDist === distTop) {
      out.x = 0;
      out.y = -(cr + distTop);
    } else {
      out.x = 0;
      out.y = cr + distBottom;
    }
    return true;
  }
  const distVal = Math.sqrt(distSq);
  const overlap = cr - distVal;
  out.x = (dx / distVal) * overlap;
  out.y = (dy / distVal) * overlap;
  return true;
}
