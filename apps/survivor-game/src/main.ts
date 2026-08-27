import { Game } from './game/Game';
import { createBuiltinGameContentSnapshot } from './content/runtime/GameContentSnapshot';
import { createAppHost } from './platform/AppHost';
import { AppStateStore } from './platform/AppStateStore';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('Canvas element not found');
}

// Prevent context menu
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const loading = document.getElementById('loading');

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return String(error);
}

async function bootstrap() {
  const host = createAppHost();
  const stateStore = await AppStateStore.open(host.storage);
  const state = stateStore.getSnapshot();
  const content = createBuiltinGameContentSnapshot(state.contentLibrary);

  const game = new Game(canvas, {
    content,
    meta: state.meta,
    muted: state.settings.muted,
    perfEnabled:
      new URLSearchParams(window.location.search).has('perf') ||
      state.settings.perfEnabled,
    persistMeta: (meta) => stateStore.setMeta(meta),
    persistMuted: (muted) => stateStore.setMuted(muted),
  });
  host.onVisibilityChange((visible) => game.setHostVisible(visible));

  if (loading) loading.style.display = 'none';
}

void bootstrap().catch((error) => {
  console.error('Failed to start game', error);
  if (!loading) return;
  loading.classList.add('loading-error');
  loading.textContent = `启动失败：${getErrorMessage(error)}。点击重试`;
  loading.addEventListener('click', () => window.location.reload(), { once: true });
});
