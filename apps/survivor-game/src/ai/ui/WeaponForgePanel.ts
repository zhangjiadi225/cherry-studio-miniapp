import type { ContentPackV1, WeaponGenerationProposalV1 } from '../../content/schema/ContentPack';
import {
  WeaponForgeError,
  type WeaponForgePreview,
  type WeaponForgeService,
} from '../generation/WeaponForgeService';

export interface WeaponForgePanelOptions {
  readonly service: WeaponForgeService;
  readonly canGenerate: () => boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onAccepted: (pack: ContentPackV1) => void;
}

function createButton(label: string, className = ''): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}

function errorMessage(error: unknown): string {
  if (error instanceof WeaponForgeError && error.issues.length > 0) {
    const details = error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join('\n');
    return `${error.message}\n${details}`;
  }
  return error instanceof Error ? error.message : String(error);
}

function formatNumber(value: unknown): string {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(number % 1 === 0 ? 0 : 2) : '—';
}

function createPreviewContent(proposal: WeaponGenerationProposalV1): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const recipe = proposal.recipe;
  const levelSteps = proposal.progression.maxLevel - 1;
  const growth = proposal.progression.perLevel;
  const maxDamage = recipe.projectile.damage + (growth.damage ?? 0) * levelSteps;
  const maxCooldown = Number(recipe.trigger.params.cooldown) + (growth.cooldown ?? 0) * levelSteps;
  const maxCount = recipe.emission.count + (growth.count ?? 0) * levelSteps;
  const visual = document.createElement('div');
  visual.className = 'weapon-forge-visual';
  const orb = document.createElement('span');
  orb.style.backgroundColor = recipe.projectile.visual.palette.primary;
  orb.style.borderColor = recipe.projectile.visual.palette.secondary ?? recipe.projectile.visual.palette.primary;
  orb.style.boxShadow = `0 0 22px ${recipe.projectile.visual.glow?.color ?? recipe.projectile.visual.palette.primary}`;
  const visualLabel = document.createElement('span');
  visualLabel.textContent = '受限参数视觉预览';
  visual.append(orb, visualLabel);
  const title = document.createElement('h3');
  title.textContent = proposal.name;
  const description = document.createElement('p');
  description.textContent = proposal.description;
  const stats = document.createElement('dl');
  stats.className = 'weapon-forge-stats';

  const values: readonly [string, string][] = [
    ['定位', proposal.balance.intendedRole],
    ['预算阶级', String(proposal.balance.budgetTier)],
    ['最高等级', String(proposal.progression.maxLevel)],
    ['基础伤害', formatNumber(proposal.recipe.projectile.damage)],
    ['满级伤害', formatNumber(maxDamage)],
    ['基础 / 满级冷却', `${formatNumber(proposal.recipe.trigger.params.cooldown)} / ${formatNumber(maxCooldown)} 秒`],
    ['基础 / 满级弹体', `${proposal.recipe.emission.count} / ${formatNumber(maxCount)}`],
    ['速度', formatNumber(proposal.recipe.projectile.speed)],
    ['半径', formatNumber(proposal.recipe.projectile.radius)],
    ['穿透', String(proposal.recipe.projectile.pierce)],
  ];
  for (const [label, value] of values) {
    const term = document.createElement('dt');
    term.textContent = label;
    const definition = document.createElement('dd');
    definition.textContent = value;
    stats.append(term, definition);
  }

  const progression = document.createElement('p');
  const growthText = Object.entries(proposal.progression.perLevel)
    .map(([key, value]) => `${key} ${Number(value) >= 0 ? '+' : ''}${formatNumber(value)}`)
    .join(' · ');
  progression.className = 'weapon-forge-progression';
  progression.textContent = growthText ? `每级成长：${growthText}` : '无每级数值成长';

  const references = document.createElement('p');
  references.className = 'weapon-forge-references';
  references.textContent = [
    recipe.trigger.primitiveId,
    recipe.targeting.primitiveId,
    recipe.emission.origin.primitiveId,
    recipe.emission.pattern.primitiveId,
    recipe.projectile.motion.primitiveId,
    recipe.projectile.collision.primitiveId,
    ...recipe.projectile.hitEffects.map((effect) => effect.primitiveId),
    recipe.projectile.visual.body.primitiveId,
  ].join(' · ');
  const checks = document.createElement('p');
  checks.className = 'weapon-forge-checks';
  checks.textContent = '✓ 封闭结构  ✓ 原语引用  ✓ 一级/满级平衡  ✓ Modifier 最坏预算  ✓ 弹幕性能上限';
  fragment.append(visual, title, description, stats, progression, references, checks);
  return fragment;
}

export class WeaponForgePanel {
  private readonly launch = createButton('✦ AI 武器锻造', 'weapon-forge-launch');
  private readonly shell = document.createElement('div');
  private readonly intent = document.createElement('textarea');
  private readonly status = document.createElement('p');
  private readonly stream = document.createElement('pre');
  private readonly preview = document.createElement('section');
  private readonly generate = createButton('生成武器', 'weapon-forge-primary');
  private readonly cancel = createButton('取消生成');
  private readonly accept = createButton('接受并启用', 'weapon-forge-primary');
  private readonly reject = createButton('拒绝');
  private readonly close = createButton('关闭', 'weapon-forge-close');
  private currentPreview?: WeaponForgePreview;
  private available = true;
  private busy = false;

  constructor(private readonly options: WeaponForgePanelOptions) {
    this.shell.className = 'weapon-forge-shell';
    this.shell.hidden = true;
    this.shell.setAttribute('role', 'dialog');
    this.shell.setAttribute('aria-modal', 'true');
    this.shell.setAttribute('aria-labelledby', 'weapon-forge-title');

    const panel = document.createElement('div');
    panel.className = 'weapon-forge-panel';
    const header = document.createElement('header');
    const heading = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.textContent = 'CHERRY AI · DECLARATIVE FORGE';
    const title = document.createElement('h2');
    title.id = 'weapon-forge-title';
    title.textContent = '原子武器锻造台';
    heading.append(eyebrow, title);
    header.append(heading, this.close);

    const guidance = document.createElement('p');
    guidance.className = 'weapon-forge-guidance';
    guidance.textContent = '描述战斗体验即可。AI 只组合引擎已注册的原子能力，本地验证通过并由你接受后，武器才会进入游戏。';
    const label = document.createElement('label');
    label.htmlFor = 'weapon-forge-intent';
    label.textContent = '你想要怎样的武器？';
    this.intent.id = 'weapon-forge-intent';
    this.intent.maxLength = 500;
    this.intent.rows = 4;
    this.intent.placeholder = '例如：设计一把节奏较慢、能穿透敌群、命中感厚重的直线弹体武器。';

    this.status.className = 'weapon-forge-status';
    this.status.setAttribute('aria-live', 'polite');
    this.status.textContent = '等待描述';
    this.stream.className = 'weapon-forge-stream';
    this.stream.hidden = true;
    this.preview.className = 'weapon-forge-preview';
    this.preview.hidden = true;

    const actions = document.createElement('footer');
    actions.className = 'weapon-forge-actions';
    this.cancel.hidden = true;
    this.accept.hidden = true;
    this.reject.hidden = true;
    actions.append(this.generate, this.cancel, this.reject, this.accept);

    panel.append(header, guidance, label, this.intent, this.status, this.stream, this.preview, actions);
    this.shell.append(panel);
    document.body.append(this.launch, this.shell);

    this.launch.addEventListener('click', () => this.open());
    this.close.addEventListener('click', () => this.hide());
    this.generate.addEventListener('click', () => void this.generateWeapon());
    this.cancel.addEventListener('click', () => this.cancelGeneration());
    this.accept.addEventListener('click', () => void this.acceptWeapon());
    this.reject.addEventListener('click', () => void this.rejectWeapon());
  }

  setAvailable(available: boolean): void {
    this.available = available;
    this.launch.hidden = !available;
    if (!available && !this.shell.hidden) this.hide();
  }

  destroy(): void {
    this.options.service.cancelCurrent();
    this.options.onOpenChange(false);
    this.launch.remove();
    this.shell.remove();
  }

  private open(): void {
    if (!this.available || !this.options.canGenerate()) return;
    this.shell.hidden = false;
    this.options.onOpenChange(true);
    this.intent.focus();
  }

  private hide(): void {
    if (this.busy) this.options.service.cancelCurrent();
    this.shell.hidden = true;
    this.options.onOpenChange(false);
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.intent.disabled = busy;
    this.generate.disabled = busy;
    this.close.disabled = false;
    this.cancel.hidden = !busy;
    this.accept.disabled = busy;
    this.reject.disabled = busy;
  }

  private async generateWeapon(): Promise<void> {
    if (this.busy) return;
    if (!this.available || !this.options.canGenerate()) {
      this.status.textContent = '只能在主菜单或本局结算阶段锻造武器。';
      return;
    }

    this.currentPreview = undefined;
    this.preview.hidden = true;
    this.preview.replaceChildren();
    this.accept.hidden = true;
    this.reject.hidden = true;
    this.stream.hidden = false;
    this.stream.textContent = '';
    this.status.textContent = 'Cherry AI 正在组合原子能力…';
    this.setBusy(true);
    try {
      const result = await this.options.service.generate(this.intent.value, {
        onChunk: (_chunk, accumulated) => {
          this.stream.textContent = accumulated.slice(-4_000);
          this.stream.scrollTop = this.stream.scrollHeight;
        },
      });
      this.currentPreview = result;
      this.preview.replaceChildren(createPreviewContent(result.proposal));
      this.preview.hidden = false;
      this.stream.hidden = true;
      this.status.textContent = '本地结构、引用、平衡与性能校验均已通过。请预览后决定是否启用。';
      this.accept.hidden = false;
      this.reject.hidden = false;
    } catch (error) {
      this.status.textContent = errorMessage(error);
      this.reject.hidden = this.currentPreview === undefined;
    } finally {
      this.setBusy(false);
    }
  }

  private cancelGeneration(): void {
    if (!this.busy) return;
    this.status.textContent = '正在取消 Cherry AI 请求…';
    this.options.service.cancelCurrent();
  }

  private async acceptWeapon(): Promise<void> {
    if (this.busy || !this.currentPreview) return;
    if (!this.available || !this.options.canGenerate()) {
      this.status.textContent = '当前不在安全的内容安装阶段。';
      return;
    }
    this.status.textContent = '正在安装并启用武器内容包…';
    this.setBusy(true);
    try {
      const pack = await this.options.service.accept(this.currentPreview.requestId);
      this.status.textContent = '武器已启用，正在重载游戏内容…';
      this.options.onAccepted(pack);
    } catch (error) {
      this.status.textContent = errorMessage(error);
    } finally {
      this.setBusy(false);
    }
  }

  private async rejectWeapon(): Promise<void> {
    if (this.busy || !this.currentPreview) return;
    this.setBusy(true);
    try {
      await this.options.service.reject(this.currentPreview.requestId);
      this.currentPreview = undefined;
      this.preview.replaceChildren();
      this.preview.hidden = true;
      this.accept.hidden = true;
      this.reject.hidden = true;
      this.stream.textContent = '';
      this.status.textContent = '已拒绝这次结果，可以修改描述后重新生成。';
    } catch (error) {
      this.status.textContent = errorMessage(error);
    } finally {
      this.setBusy(false);
    }
  }
}
