export type EngineHomeAiStatus = 'checking' | 'connected' | 'denied' | 'unavailable';

export interface EngineHomeWeaponSummary {
  readonly name: string;
  readonly icon: string;
  readonly description: string;
}

export interface EngineHomeBattleSetupSummary {
  readonly difficultyName: string;
  readonly difficultyDetail: string;
  readonly weaponName: string;
  readonly weaponIcon: string;
}

export interface EngineHomeScreenOptions {
  readonly appVersion: string;
  readonly primitiveCount: number;
  readonly modifierCount: number;
  readonly enabledPackCount: number;
  readonly battleSetup: EngineHomeBattleSetupSummary;
  readonly recentWeapon?: EngineHomeWeaponSummary;
  readonly onGenerate: (intent: string) => void;
  readonly onStartBattle: () => void;
  readonly onOpenBattleSetup: () => void;
  readonly onOpenContentLibrary: () => void;
  readonly onOpenSkins: () => void;
  readonly onOpenGrowth: () => void;
}

function createButton(label: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}

function createActionCard(
  icon: string,
  title: string,
  description: string,
  onClick: () => void
): HTMLButtonElement {
  const card = createButton('', 'engine-home-action');
  const visual = document.createElement('span');
  visual.className = 'engine-home-action-icon';
  visual.textContent = icon;
  const copy = document.createElement('span');
  copy.className = 'engine-home-action-copy';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const body = document.createElement('span');
  body.textContent = description;
  copy.append(heading, body);
  const arrow = document.createElement('span');
  arrow.className = 'engine-home-action-arrow';
  arrow.textContent = '→';
  card.append(visual, copy, arrow);
  card.addEventListener('click', onClick);
  return card;
}

function createStatusCard(icon: string, title: string): {
  readonly root: HTMLDivElement;
  readonly detail: HTMLSpanElement;
} {
  const root = document.createElement('div');
  root.className = 'engine-home-status-card';
  const visual = document.createElement('span');
  visual.className = 'engine-home-status-icon';
  visual.textContent = icon;
  const copy = document.createElement('span');
  copy.className = 'engine-home-status-copy';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const detail = document.createElement('span');
  copy.append(heading, detail);
  const dot = document.createElement('span');
  dot.className = 'engine-home-status-dot';
  root.append(visual, copy, dot);
  return { root, detail };
}

export class EngineHomeScreen {
  private readonly root = document.createElement('section');
  private readonly intent = document.createElement('textarea');
  private readonly characterCount = document.createElement('span');
  private readonly feedback = document.createElement('p');
  private readonly aiStatus = createStatusCard('✦', 'Cherry AI');
  private readonly battleDifficulty = document.createElement('span');
  private readonly battleWeapon = document.createElement('span');

  constructor(private readonly options: EngineHomeScreenOptions) {
    this.root.className = 'engine-home';
    this.root.setAttribute('aria-label', 'Night Survivor Engine 首页');
    this.root.dataset.aiStatus = 'checking';

    const shell = document.createElement('div');
    shell.className = 'engine-home-shell';
    const header = this.createHeader();
    const workspace = this.createWorkspace();
    const statusRail = this.createStatusRail();
    shell.append(header, workspace, statusRail);
    this.root.append(shell);
    document.body.append(this.root);

    this.root.addEventListener('keydown', (event) => event.stopPropagation());
    this.intent.addEventListener('input', () => this.updateCharacterCount());
    this.setBattleSetup(this.options.battleSetup);
    this.updateCharacterCount();
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
    this.root.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  setAiStatus(status: EngineHomeAiStatus): void {
    this.root.dataset.aiStatus = status;
    const details: Record<EngineHomeAiStatus, string> = {
      checking: '正在检查宿主能力…',
      connected: '已连接 · 默认模型可用',
      denied: '未授权 · 仍可使用已有内容',
      unavailable: '暂不可用 · 仍可离线战斗',
    };
    this.aiStatus.detail.textContent = details[status];
  }

  setBattleSetup(setup: EngineHomeBattleSetupSummary): void {
    this.battleDifficulty.textContent = `◆ ${setup.difficultyName} · ${setup.difficultyDetail}`;
    this.battleWeapon.textContent = `${setup.weaponIcon} ${setup.weaponName}`;
  }

  destroy(): void {
    this.root.remove();
  }

  private createHeader(): HTMLElement {
    const header = document.createElement('header');
    header.className = 'engine-home-header';
    const brand = document.createElement('div');
    brand.className = 'engine-home-brand';
    const mark = document.createElement('span');
    mark.className = 'engine-home-brand-mark';
    mark.textContent = '✦';
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = 'Night Survivor Engine';
    const caption = document.createElement('span');
    caption.textContent = 'AI GAME ENGINE';
    copy.append(title, caption);
    brand.append(mark, copy);

    const navigation = document.createElement('nav');
    navigation.className = 'engine-home-utility-nav';
    navigation.setAttribute('aria-label', '角色与成长');
    const skins = createButton('角色', 'engine-home-utility-button');
    const growth = createButton('星图', 'engine-home-utility-button');
    skins.addEventListener('click', this.options.onOpenSkins);
    growth.addEventListener('click', this.options.onOpenGrowth);
    navigation.append(skins, growth);
    header.append(brand, navigation);
    return header;
  }

  private createWorkspace(): HTMLElement {
    const workspace = document.createElement('main');
    workspace.className = 'engine-home-workspace';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'engine-home-eyebrow';
    eyebrow.textContent = 'CHERRY AI · ATOMIC WEAPON ENGINE';
    const heading = document.createElement('h1');
    heading.textContent = '今晚，创造一件什么武器？';
    const description = document.createElement('p');
    description.className = 'engine-home-description';
    description.textContent = '说出战斗体验，AI 会把创意组合成经过本地验证、能够真正投入战斗的武器。';

    const form = document.createElement('form');
    form.className = 'engine-home-composer';
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submitIntent();
    });
    const label = document.createElement('label');
    label.htmlFor = 'engine-home-intent';
    label.textContent = '描述你想要的武器';
    this.intent.id = 'engine-home-intent';
    this.intent.maxLength = 500;
    this.intent.rows = 3;
    this.intent.placeholder = '例如：会穿透敌群、命中感厚重，并在远处留下月光轨迹的武器…';
    const formFooter = document.createElement('div');
    formFooter.className = 'engine-home-composer-footer';
    this.characterCount.className = 'engine-home-character-count';
    const generate = createButton('✦ 生成武器', 'engine-home-generate');
    generate.addEventListener('click', () => this.submitIntent());
    formFooter.append(this.characterCount, generate);
    form.append(label, this.intent, formFooter);

    this.feedback.className = 'engine-home-feedback';
    this.feedback.textContent = 'AI 只组合引擎已注册的原子能力；通过校验并由你接受后，武器才会进入游戏。';

    const actions = document.createElement('div');
    actions.className = 'engine-home-actions';
    actions.append(
      this.createBattleAction(),
      createActionCard('▣', '内容库', '查看武器、怪物、被动与已启用模块。', this.options.onOpenContentLibrary)
    );
    workspace.append(eyebrow, heading, description, form, this.feedback, actions);
    return workspace;
  }

  private createStatusRail(): HTMLElement {
    const aside = document.createElement('aside');
    aside.className = 'engine-home-status-rail';
    this.aiStatus.detail.textContent = '正在检查宿主能力…';
    const engineStatus = createStatusCard('◇', '原子引擎就绪');
    engineStatus.detail.textContent = `${this.options.primitiveCount} 个原语 · ${this.options.modifierCount} 个模块`;
    aside.append(this.aiStatus.root, engineStatus.root);

    const divider = document.createElement('div');
    divider.className = 'engine-home-rail-divider';
    aside.append(divider);

    const contentLabel = document.createElement('p');
    contentLabel.className = 'engine-home-rail-label';
    contentLabel.textContent = '最近生成的武器';
    const recent = document.createElement('div');
    recent.className = 'engine-home-recent';
    const visual = document.createElement('span');
    visual.className = 'engine-home-recent-visual';
    visual.textContent = this.options.recentWeapon?.icon ?? '✦';
    const name = document.createElement('strong');
    name.textContent = this.options.recentWeapon?.name ?? '等待第一件 AI 武器';
    const description = document.createElement('span');
    description.textContent = this.options.recentWeapon?.description ?? '从左侧描述一个创意，开始建立你的内容库。';
    const metadata = document.createElement('span');
    metadata.className = 'engine-home-recent-meta';
    metadata.textContent = this.options.recentWeapon
      ? '已安装 · 可作为开局武器'
      : '尚无生成内容';
    recent.append(visual, name, description, metadata);

    const librarySummary = document.createElement('p');
    librarySummary.className = 'engine-home-library-summary';
    librarySummary.textContent = `${this.options.enabledPackCount} 个 AI 内容包已启用 · v${this.options.appVersion}`;
    aside.append(contentLabel, recent, librarySummary);
    return aside;
  }

  private createBattleAction(): HTMLElement {
    const card = document.createElement('section');
    card.className = 'engine-home-battle-action';

    const visual = document.createElement('span');
    visual.className = 'engine-home-action-icon';
    visual.textContent = '◎';

    const copy = document.createElement('span');
    copy.className = 'engine-home-battle-copy';
    const heading = document.createElement('strong');
    heading.textContent = '开始战斗';
    const label = document.createElement('span');
    label.textContent = '当前出征配置';
    const metadata = document.createElement('span');
    metadata.className = 'engine-home-battle-meta';
    metadata.append(this.battleDifficulty, this.battleWeapon);
    copy.append(heading, label, metadata);

    const actions = document.createElement('span');
    actions.className = 'engine-home-battle-buttons';
    const start = createButton('立即开战', 'engine-home-battle-primary');
    const configure = createButton('调整配置', 'engine-home-battle-secondary');
    start.addEventListener('click', this.options.onStartBattle);
    configure.addEventListener('click', this.options.onOpenBattleSetup);
    actions.append(start, configure);

    card.append(visual, copy, actions);
    return card;
  }

  private submitIntent(): void {
    const intent = this.intent.value.trim();
    if (!intent) {
      this.feedback.dataset.state = 'error';
      this.feedback.textContent = '先用一句话描述武器的攻击方式、节奏或战斗感受。';
      this.intent.focus();
      return;
    }
    delete this.feedback.dataset.state;
    this.feedback.textContent = '正在进入受控锻造流程…';
    this.options.onGenerate(intent);
  }

  private updateCharacterCount(): void {
    this.characterCount.textContent = `${this.intent.value.length} / ${this.intent.maxLength}`;
  }
}
