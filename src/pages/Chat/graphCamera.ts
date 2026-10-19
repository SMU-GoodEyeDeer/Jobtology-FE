export interface GraphCamera { readonly x: number; readonly y: number; readonly zoom: number }
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2.5;

// Keep the same graph point under the cursor while the scale changes.
export function zoomCamera(camera: GraphCamera, factor: number, anchor: { x: number; y: number }): GraphCamera {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * factor));
  return { zoom, x: anchor.x - (anchor.x - camera.x) * zoom / camera.zoom,
    y: anchor.y - (anchor.y - camera.y) * zoom / camera.zoom };
}
