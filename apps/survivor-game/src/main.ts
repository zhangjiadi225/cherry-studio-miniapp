import { WeaponForgePanel } from './ai/ui/WeaponForgePanel';
import { cherryKitAiGateway } from './ai/CherryKitAiGateway';
import { WeaponForgeService } from './ai/generation/WeaponForgeService';
import { Game } from './game/Game';
import { eventBus, GameEvent } from './game/events';
import { createBuiltinGameContentSnapshot } from './content/runtime/GameContentSnapshot';
import { createAppHost } from './platform/AppHost';
import { AppStateStore } from './platform/AppStateStore';
import { installDevelopmentCherryMock } from './platform/DevelopmentCherryMock';
import { APP_VERSION } from './application/AppVersion';
import { EngineHomeScreen } from './ui/EngineHomeScreen';

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
  const recentGeneratedWeapon = [...content.startingWeapons]
    .reverse()
    .find((weapon) => weapon.generated);
  const homeScreen = new EngineHomeScreen({
    appVersion: APP_VERSION,
    primitiveCount: content.weaponCapabilityCatalog.primitives.length,
    modifierCount: content.weaponCapabilityCatalog.modifiers.length,
    enabledPackCount: Math.max(0, content.packIds.length - 1),
    recentWeapon: recentGeneratedWeapon
      ? {
          name: recentGeneratedWeapon.name,
          icon: recentGeneratedWeapon.icon,
          description: recentGeneratedWeapon.desc,
        }
      : undefined,
    onGenerate: (intent) => forgePanel.openWithIntent(intent, true),
    onOpenForge: (intent) => forgePanel.openWithIntent(intent),
    onOpenBattleSetup: () => game.openDesktopTab('start'),
    onOpenContentLibrary: () => game.openContentLibrary(),
    onOpenSkins: () => game.openDesktopTab('skins'),
    onOpenGrowth: () => game.openDesktopTab('growth'),
    onOpenCodex: () => game.openDesktopTab('codex'),
  });
  const syncProductUi = () => {
    const homeActive = game.isEngineHomeActive();
    homeScreen.setVisible(homeActive);
    forgePanel.setAvailable(game.canOpenWeaponForge());
    forgePanel.setLaunchVisible(!homeActive);
  };
  syncProductUi();
  eventBus.on(GameEvent.STATE_CHANGE, syncProductUi);
  eventBus.on(GameEvent.DESKTOP_TAB_CHANGE, syncProductUi);
  void cherryKitAiGateway.getRuntimeSnapshot('default').then((runtime) => {
    homeScreen.setAiStatus(runtime.permissions['ai.chat'] === false ? 'denied' : 'connected');
  }).catch((error) => {
    console.warn('Cherry AI capability check failed', error);
    homeScreen.setAiStatus('unavailable');
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
