export type ShopRect = { x: number; y: number; w: number; h: number };

export interface ShopLayout {
  mobile: boolean;
  compact: boolean;
  cards: Array<ShopRect & { index: number }>;
  rerollButton: ShopRect;
  continueButton: ShopRect;
  titleY: number;
  shardsY: number;
  helperY: number;
  footerY: number;
}

export function isMobileViewport(w: number, h: number): boolean {
  return w <= 680 || h <= 520;
}

export function getShopLayout(w: number, h: number, optionCount: number): ShopLayout {
  const count = Math.max(optionCount, 1);
  const mobile = isMobileViewport(w, h);

  if (!mobile) {
    const cardGap = 12;
    const cardW = Math.min(180, (w - 90) / count - cardGap);
    const cardH = 230;
    const totalW = optionCount * (cardW + cardGap) - cardGap;
    const startX = (w - totalW) / 2;
    const cardY = h / 2 - cardH / 2 + 8;

    return {
      mobile: false,
      compact: false,
      cards: Array.from({ length: optionCount }, (_, index) => ({
        index,
        x: startX + index * (cardW + cardGap),
        y: cardY,
        w: cardW,
        h: cardH,
      })),
      rerollButton: { x: w / 2 - 165, y: h / 2 + 155, w: 150, h: 38 },
      continueButton: { x: w / 2 + 15, y: h / 2 + 155, w: 150, h: 38 },
      titleY: h / 2 - 190,
      shardsY: h / 2 - 154,
      helperY: h / 2 - 128,
      footerY: h / 2 + 215,
    };
  }

  const margin = Math.max(12, Math.min(18, w * 0.04));
  const gap = 10;
  const columns = w > h ? Math.min(3, count) : Math.min(2, count);
  const rows = Math.ceil(optionCount / columns);
  const titleY = Math.max(30, Math.min(42, h * 0.075));
  const shardsY = titleY + 28;
  const helperY = shardsY + 23;
  const buttonGap = 12;
  const buttonW = Math.min(164, (w - margin * 2 - buttonGap) / 2);
  const buttonH = 42;
  const buttonY = h - buttonH - Math.max(18, Math.min(28, h * 0.035));
  const cardTop = helperY + 28;
  const cardBottom = buttonY - 18;
  const availableH = Math.max(112, cardBottom - cardTop);
  const cardW = (w - margin * 2 - gap * (columns - 1)) / columns;
  const cardH = Math.max(104, Math.min(188, (availableH - gap * (rows - 1)) / rows));
  const totalH = rows * cardH + (rows - 1) * gap;
  const startY = Math.max(cardTop, cardTop + (availableH - totalH) / 2);
  const totalW = columns * cardW + (columns - 1) * gap;
  const startX = (w - totalW) / 2;

  return {
    mobile: true,
    compact: cardH < 188 || cardW < 150,
    cards: Array.from({ length: optionCount }, (_, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      return {
        index,
        x: startX + col * (cardW + gap),
        y: startY + row * (cardH + gap),
        w: cardW,
        h: cardH,
      };
    }),
    rerollButton: { x: w / 2 - buttonGap / 2 - buttonW, y: buttonY, w: buttonW, h: buttonH },
    continueButton: { x: w / 2 + buttonGap / 2, y: buttonY, w: buttonW, h: buttonH },
    titleY,
    shardsY,
    helperY,
    footerY: buttonY + buttonH + 16,
  };
}
