'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StaticVillaHero } from '@/components/fallback/StaticVillaHero';

/**
 * The last line before a blank rectangle.
 *
 * `SceneErrorBoundary` sits *inside* the dynamically imported chunk and
 * catches what the scene graph throws once it is running. It cannot catch
 * the two failures that matter most here, because both happen outside it:
 *
 *  - **The chunk never arrives.** A deploy rotates the build id while
 *    someone is mid-visit, or a flaky connection drops the request, and
 *    `next/dynamic` rejects. The boundary that would have caught it was in
 *    the chunk that failed to load.
 *  - **The GPU takes the context away.** A `webglcontextlost` event is not
 *    an exception — nothing is thrown, no render pass fails, React is never
 *    told. The canvas simply stops updating and keeps whatever pixels it had.
 *    On mobile this is routine: backgrounding a tab for long enough is often
 *    enough to do it.
 *
 * Neither is recoverable in place, and both leave the visitor looking at the
 * subject of the page rendered as nothing. So both land on the same
 * fallback — the Phase 1 elevation, which is at least the building.
 */

type Props = {
  children: ReactNode;
  /** Overrides the default static plate. */
  fallback?: ReactNode;
  onError?: (error: Error) => void;
};

type State = { failure: 'render' | 'chunk' | 'context-loss' | null };

/**
 * Bundler chunk failures do not share a class, only a shape. Matching on the
 * message is unlovely, but it is what distinguishes "the code never arrived"
 * — which a reload usually fixes — from "the code ran and threw".
 */
function isChunkError(error: Error): boolean {
  return /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    `${error.name} ${error.message}`,
  );
}

export class ViewportErrorBoundary extends Component<Props, State> {
  state: State = { failure: null };

  private container: HTMLDivElement | null = null;

  static getDerivedStateFromError(error: Error): State {
    return { failure: isChunkError(error) ? 'chunk' : 'render' };
  }

  componentDidMount() {
    // Capture phase: the event fires on the `<canvas>`, which is several
    // levels below this wrapper and does not bubble it.
    this.container?.addEventListener('webglcontextlost', this.handleContextLost, true);
  }

  componentWillUnmount() {
    this.container?.removeEventListener('webglcontextlost', this.handleContextLost, true);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AURELIA] Viewport failed', error, info.componentStack);
    this.props.onError?.(error);
  }

  private handleContextLost = (event: Event) => {
    // Not calling `preventDefault()` is deliberate: preventing it asks the
    // browser to restore the context, and a restored context on a scene
    // whose GPU resources are gone renders black. Losing it cleanly and
    // showing the plate is the honest outcome.
    event.stopPropagation();
    this.props.onError?.(new Error('WebGL context lost'));
    this.setState({ failure: 'context-loss' });
  };

  private setContainer = (node: HTMLDivElement | null) => {
    this.container?.removeEventListener('webglcontextlost', this.handleContextLost, true);
    this.container = node;
    node?.addEventListener('webglcontextlost', this.handleContextLost, true);
  };

  render() {
    const { failure } = this.state;
    return (
      <div ref={this.setContainer} className="absolute inset-0">
        {failure === null
          ? this.props.children
          : (this.props.fallback ?? (
              <div role="status" className="bg-ink absolute inset-0">
                <StaticVillaHero />
              </div>
            ))}
      </div>
    );
  }
}
