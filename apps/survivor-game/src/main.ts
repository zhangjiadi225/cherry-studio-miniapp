import { WeaponForgePanel } from './ai/ui/WeaponForgePanel';
import { cherryKitAiGateway } from './ai/CherryKitAiGateway';
import { WeaponForgeService } from './ai/generation/WeaponForgeService';
import { Game } from './game/Game';
import { eventBus, GameEvent } from './game/events';
import { createBuiltinGameContentSnapshot } from './content/runtime/GameContentSnapshot';
import { createAppHost } from './platform/AppHost';
import { AppStateStore } from './platform/AppStateStore';
import { installDevelopmentCherryMock } from './platform/DevelopmentCherryMock';

installDevelopmentCherryMock();

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
  const forgeService = new WeaponForgeService(cherryKitAiGateway, stateStore);
  const forgePanel = new WeaponForgePanel({
    service: forgeService,
    canGenerate: () => game.canOpenWeaponForge(),
    onOpenChange: (open) => game.setExternalUiOpen(open),
    onAccepted: () => window.location.reload(),
  });
  forgePanel.setAvailable(game.canOpenWeaponForge());
  eventBus.on(GameEvent.STATE_CHANGE, () => {
    forgePanel.setAvailable(game.canOpenWeaponForge());
  });
  host.onVisibilityChange((visible) => {
    game.setHostVisible(visible);
    forgeService.setHostVisible(visible);
  });

  if (loading) loading.style.display = 'none';
}

void bootstrap().catch((error) => {
  console.error('Failed to start game', error);
  if (!loading) return;
  loading.classList.add('loading-error');
  loading.textContent = `启动失败：${getErrorMessage(error)}。点击重试`;
  loading.addEventListener('click', () => window.location.reload(), { once: true });
});
