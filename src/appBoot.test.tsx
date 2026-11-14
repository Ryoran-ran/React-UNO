// @vitest-environment happy-dom
import { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { useGameStore } from './stores/gameStore';
import { createGame } from './engine/gameEngine';

it('boots the whole app and renders both the menu and an eight-player table', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const captured = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    useGameStore.setState({ game: null });
    await act(async () => root.render(<StrictMode><AppErrorBoundary><App/></AppErrorBoundary></StrictMode>));
    expect(host.textContent).toContain('テーブルにつく');
    await act(async () => useGameStore.setState({ game: createGame({ playerCount: 8 }, 42) }));
    expect(host.querySelector('[aria-label="対戦テーブル"]')).not.toBeNull();
    expect(host.querySelectorAll('[data-player-id]')).toHaveLength(8);
    expect(captured).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount()); host.remove();
    useGameStore.setState({ game: null }); captured.mockRestore(); vi.unstubAllGlobals();
  }
});

it('shows a recovery action when a screen throws during rendering', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const captured = vi.spyOn(console, 'error').mockImplementation(() => {});
  function BrokenScreen(): never { throw new Error('Screen render failed'); }
  try {
    await act(async () => root.render(<AppErrorBoundary><BrokenScreen/></AppErrorBoundary>));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('画面を読み込み直してください');
    expect(host.querySelector('button')?.textContent).toContain('再読み込み');
  } finally {
    await act(async () => root.unmount()); host.remove();
    captured.mockRestore(); vi.unstubAllGlobals();
  }
});
