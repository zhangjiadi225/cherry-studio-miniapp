import { Game } from './game/Game';
import { MUTE_STORAGE_KEY } from './game/systems/audio/Audio';
import {
  loadMetaState,
  META_STORAGE_KEY,
  serializeMetaState,
} from './game/systems/meta/MetaProgression';
import { createAppHost } from './platform/AppHost';

const PERF_STORAGE_KEY = 'survivor_perf';

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
  const [rawMeta, rawMuted, rawPerf] = await Promise.all([
    host.storage.get(META_STORAGE_KEY),
    host.storage.get(MUTE_STORAGE_KEY),
    host.storage.get(PERF_STORAGE_KEY),
  ]);

  const game = new Game(canvas, {
    meta: loadMetaState(rawMeta),
    muted: rawMuted === '1',
    perfEnabled: new URLSearchParams(window.location.search).has('perf') || rawPerf === '1',
    persistMeta: (meta) => host.storage.set(META_STORAGE_KEY, serializeMetaState(meta)),
    persistMuted: (muted) => host.storage.set(MUTE_STORAGE_KEY, muted ? '1' : '0'),
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
