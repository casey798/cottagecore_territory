export interface PixelPosition {
  x: number
  y: number
}

// Check if a pixel position is within map bounds (with a small margin)
export function isWithinMapBounds(
  pos: PixelPosition,
  mapWidth: number,
  mapHeight: number,
  margin = 16
): boolean {
  return (
    pos.x >= margin &&
    pos.x <= mapWidth - margin &&
    pos.y >= margin &&
    pos.y <= mapHeight - margin
  )
}

// Given an out-of-bounds pixel position, find the closest point
// on the map edge and the angle pointing FROM edge TO player
export function getEdgeIndicator(
  playerPixel: PixelPosition,
  mapWidth: number,
  mapHeight: number,
  edgeMargin = 20
): {
  edgeX: number
  edgeY: number
  angleDeg: number
} {
  // Clamp the position to the edge
  const clampedX = Math.max(edgeMargin, Math.min(mapWidth - edgeMargin, playerPixel.x))
  const clampedY = Math.max(edgeMargin, Math.min(mapHeight - edgeMargin, playerPixel.y))

  // Find which edge is closest (for corners, picks the dominant axis)
  const distLeft = playerPixel.x
  const distRight = mapWidth - playerPixel.x
  const distTop = playerPixel.y
  const distBottom = mapHeight - playerPixel.y
  const minDist = Math.min(distLeft, distRight, distTop, distBottom)

  let edgeX = clampedX
  let edgeY = clampedY

  if (minDist === distLeft) edgeX = edgeMargin
  else if (minDist === distRight) edgeX = mapWidth - edgeMargin
  else if (minDist === distTop) edgeY = edgeMargin
  else edgeY = mapHeight - edgeMargin

  // Angle from edge point toward player (for arrow rotation)
  const dx = playerPixel.x - edgeX
  const dy = playerPixel.y - edgeY
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI

  return { edgeX, edgeY, angleDeg }
}
