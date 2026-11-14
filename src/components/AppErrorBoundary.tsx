import { Component, type ReactNode } from 'react';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="recovery" role="alert"><div><span className="eyebrow">IROHA</span><h1>画面を読み込み直してください</h1><p>画面の表示中にエラーが起きました。<br/>再読み込みして、もう一度お試しください。</p><button className="button primary" onClick={() => window.location.reload()}>再読み込み ↻</button></div></main>;
    return this.props.children;
  }
}
