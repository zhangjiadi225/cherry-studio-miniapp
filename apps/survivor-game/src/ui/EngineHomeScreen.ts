import type { RunDifficultyId } from '../game/data/runDifficulties';

export type EngineHomeAiStatus = 'checking' | 'connected' | 'denied' | 'unavailable';

export interface EngineHomeDifficultyOption {
  readonly id: RunDifficultyId;
  readonly name: string;
  readonly detail: string;
  readonly icon: string;
}

export interface EngineHomeWeaponOption {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly generated: boolean;
}

export interface EngineHomeBattleSetupSummary {
  readonly difficultyId: RunDifficultyId;
  readonly difficultyName: string;
  readonly difficultyDetail: string;
  readonly weaponId: string;
  readonly weaponName: string;
  readonly weaponIcon: string;
}

export interface EngineHomeScreenOptions {
  readonly difficulties: readonly EngineHomeDifficultyOption[];
  readonly weapons: readonly EngineHomeWeaponOption[];
  readonly battleSetup: EngineHomeBattleSetupSummary;
  readonly onGenerate: (intent: string) => void;
  readonly onSelectDifficulty: (id: RunDifficultyId) => void;
  readonly onSelectWeapon: (id: string) => void;
  readonly onStartBattle: () => void;
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

export class EngineHomeScreen {
  private readonly root = document.createElement('section');
  private readonly intent = document.createElement('textarea');
  private readonly characterCount = document.createElement('span');
  private readonly feedback = document.createElement('p');
  private readonly aiConnection = document.createElement('div');
  private readonly aiConnectionDetail = document.createElement('strong');
  private readonly selectionSummary = document.createElement('span');
  private readonly difficultyButtons = new Map<RunDifficultyId, HTMLButtonElement>();
  private readonly weaponButtons = new Map<string, HTMLButtonElement>();
  private selectedDifficultyId: RunDifficultyId;
  private selectedWeaponId: string;

  constructor(private readonly options: EngineHomeScreenOptions) {
    this.selectedDifficultyId = options.battleSetup.difficultyId;
    this.selectedWeaponId = options.battleSetup.weaponId;
    this.root.className = 'engine-home';
    this.root.setAttribute('aria-label', 'Night Survivor Engine 首页');

    const shell = document.createElement('div');
    shell.className = 'engine-home-shell';
    shell.append(this.createHeader(), this.createWorkspace());
    this.root.append(shell);
    document.body.append(this.root);

    this.root.addEventListener('keydown', (event) => event.stopPropagation());
    this.intent.addEventListener('input', () => this.updateCharacterCount());
    this.setAiStatus('checking');
    this.setBattleSetup(options.battleSetup);
    this.updateCharacterCount();
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
    this.root.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  setAiStatus(status: EngineHomeAiStatus): void {
    this.aiConnection.dataset.status = status;
    const details: Record<EngineHomeAiStatus, string> = {
      checking: '正在检查 Cherry AI…',
      connected: 'Cherry AI 已连接',
      denied: 'Cherry AI 未授权',
      unavailable: 'Cherry AI 暂不可用',
    };
    this.aiConnectionDetail.textContent = details[status];
  }

  setBattleSetup(setup: EngineHomeBattleSetupSummary): void {
    this.selectedDifficultyId = setup.difficultyId;
    this.selectedWeaponId = setup.weaponId;
    this.syncBattleSetup();
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
    navigation.setAttribute('aria-label', '产品模块');
    const skins = createButton('角色', 'engine-home-utility-button');
    const growth = createButton('星图', 'engine-home-utility-button');
    const library = createButton('内容库', 'engine-home-utility-button');
    skins.addEventListener('click', this.options.onOpenSkins);
    growth.addEventListener('click', this.options.onOpenGrowth);
    library.addEventListener('click', this.options.onOpenContentLibrary);
    navigation.append(skins, growth, library);
    header.append(brand, navigation);
    return header;
  }

  private createWorkspace(): HTMLElement {
    const workspace = document.createElement('main');
    workspace.className = 'engine-home-workspace';

    const intro = document.createElement('div');
    intro.className = 'engine-home-intro';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'engine-home-eyebrow';
    eyebrow.textContent = 'CHERRY AI · ATOMIC WEAPON ENGINE';
    const heading = document.createElement('h1');
    heading.textContent = '今晚，创造一件什么武器？';
    const description = document.createElement('p');
    description.className = 'engine-home-description';
    description.textContent = '描述战斗体验，AI 会把创意组合成经过本地验证、能够真正投入战斗的武器。';
    intro.append(eyebrow, heading, description);

    this.aiConnection.className = 'engine-home-ai-connection';
    const aiMark = document.createElement('span');
    aiMark.className = 'engine-home-ai-mark';
    aiMark.textContent = '✦';
    const dot = document.createElement('span');
    dot.className = 'engine-home-ai-dot';
    this.aiConnection.append(aiMark, this.aiConnectionDetail, dot);

    workspace.append(intro, this.aiConnection, this.createComposer(), this.createBattleConfigurator());
    return workspace;
  }

  private createComposer(): HTMLElement {
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
    this.intent.rows = 2;
    this.intent.placeholder = '例如：会穿透敌群、命中感厚重，并在远处留下月光轨迹的武器…';
    const formFooter = document.createElement('div');
    formFooter.className = 'engine-home-composer-footer';
    this.characterCount.className = 'engine-home-character-count';
    const generate = createButton('✦ 生成武器', 'engine-home-generate');
    generate.addEventListener('click', () => this.submitIntent());
    formFooter.append(this.characterCount, generate);
    form.append(label, this.intent, formFooter);

    this.feedback.className = 'engine-home-feedback';
    this.feedback.textContent = '生成结果通过结构、平衡与性能校验并由你接受后，才会进入 AI 生成武器列表。';

    const wrapper = document.createElement('div');
    wrapper.className = 'engine-home-composer-block';
    wrapper.append(form, this.feedback);
    return wrapper;
  }

  private createBattleConfigurator(): HTMLElement {
    const configurator = document.createElement('section');
    configurator.className = 'engine-home-configurator';
    configurator.setAttribute('aria-label', '出征配置');

    const difficultyOptions = document.createElement('div');
    difficultyOptions.className = 'engine-home-difficulty-options';
    for (const option of this.options.difficulties) {
      const button = createButton('', 'engine-home-difficulty-option');
      const icon = document.createElement('span');
      icon.textContent = option.icon;
      const name = document.createElement('strong');
      name.textContent = option.name;
      const detail = document.createElement('span');
      detail.textContent = option.detail;
      button.append(icon, name, detail);
      button.addEventListener('click', () => {
        this.options.onSelectDifficulty(option.id);
        this.selectedDifficultyId = option.id;
        this.syncBattleSetup();
      });
      this.difficultyButtons.set(option.id, button);
      difficultyOptions.append(button);
    }
    configurator.append(this.createConfigRow('选择难度', difficultyOptions));

    const systemWeapons = this.options.weapons.filter((weapon) => !weapon.generated);
    const generatedWeapons = this.options.weapons.filter((weapon) => weapon.generated);
    configurator.append(
      this.createConfigRow('系统武器', this.createWeaponOptions(systemWeapons, false)),
      this.createConfigRow('AI 生成武器', this.createWeaponOptions(generatedWeapons, true), true)
    );

    const footer = document.createElement('footer');
    footer.className = 'engine-home-configurator-footer';
    this.selectionSummary.className = 'engine-home-selection-summary';
    const start = createButton('开始游戏 →', 'engine-home-start');
    start.addEventListener('click', this.options.onStartBattle);
    footer.append(this.selectionSummary, start);
    configurator.append(footer);
    return configurator;
  }

  private createConfigRow(labelText: string, content: HTMLElement, generated = false): HTMLElement {
    const row = document.createElement('div');
    row.className = 'engine-home-config-row';
    if (generated) row.dataset.kind = 'generated';
    const label = document.createElement('h2');
    label.textContent = labelText;
    row.append(label, content);
    return row;
  }

  private createWeaponOptions(
    weapons: readonly EngineHomeWeaponOption[],
    generated: boolean
  ): HTMLElement {
    const container = document.createElement('div');
    container.className = 'engine-home-weapon-options';
    if (weapons.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'engine-home-weapon-empty';
      empty.textContent = '尚无 AI 生成武器，可从上方描述并生成。';
      container.append(empty);
      return container;
    }

    for (const weapon of weapons) {
      const button = createButton('', 'engine-home-weapon-option');
      if (generated) button.dataset.generated = 'true';
      button.title = weapon.name;
      const icon = document.createElement('span');
      icon.className = 'engine-home-weapon-icon';
      icon.textContent = weapon.icon;
      const name = document.createElement('strong');
      name.textContent = weapon.name;
      button.append(icon, name);
      button.addEventListener('click', () => {
        this.options.onSelectWeapon(weapon.id);
        this.selectedWeaponId = weapon.id;
        this.syncBattleSetup();
      });
      this.weaponButtons.set(weapon.id, button);
      container.append(button);
    }
    return container;
  }

  private syncBattleSetup(): void {
    for (const [id, button] of this.difficultyButtons) {
      const selected = id === this.selectedDifficultyId;
      button.dataset.selected = selected ? 'true' : 'false';
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    }
    for (const [id, button] of this.weaponButtons) {
      const selected = id === this.selectedWeaponId;
      button.dataset.selected = selected ? 'true' : 'false';
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    }

    const difficulty = this.options.difficulties.find((option) => option.id === this.selectedDifficultyId);
    const weapon = this.options.weapons.find((option) => option.id === this.selectedWeaponId);
    this.selectionSummary.textContent = `${difficulty?.name ?? '困难'} · ${weapon?.name ?? '魔法法器'}`;
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
