/**
 * GraphEvents: Pure effect component that must live inside SigmaContainer.
 *
 * This component accesses the Sigma context (provided by SigmaContainer) and
 * applies view-specific overlays via useOverlayEffects. It renders no DOM
 * output; its only purpose is to run side effects that require the Sigma
 * instance to be live.
 */

import { useOverlayEffects } from '../hooks/useOverlayEffects';

export function GraphEvents() {
  useOverlayEffects();
  return null;
}
