import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Changing this clears an earlier failure, so the layer can try again. */
  resetKey?: unknown;
  /** Called when the layer fails. The user sees nothing. */
  onFail?: (error: unknown) => void;
}

/**
 * Catches any failure in a 3D layer and shows nothing in its place, so the page keeps
 * the gradient and the 2D emblems. It never shows an error to the user.
 */
export class LayerBoundary extends Component<Props, { failed: boolean; key: unknown }> {
  override state = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, s: { failed: boolean; key: unknown }) {
    return props.resetKey !== s.key ? { failed: false, key: props.resetKey } : null;
  }

  override componentDidCatch(error: unknown, _info: ErrorInfo) {
    this.props.onFail?.(error);
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
