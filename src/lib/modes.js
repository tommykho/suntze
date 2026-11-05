// Field Challenge exam modes, named after the top three places in the imperial examination.
export const MODES = [
  { id: 'tanhua', zh: '探花', en: 'Simple', n: 6, blurb: 'Six quick battles. A fast check of your instincts.' },
  { id: 'bangyan', zh: '榜眼', en: 'Medium', n: 12, blurb: 'Twelve battles across the book. The standard exam.' },
  { id: 'zhuangyuan', zh: '狀元', en: 'Full', n: 20, blurb: 'Twenty battles, every chapter. The top scholar’s exam.' },
];
export const modeById = (id) => MODES.find((m) => m.id === id) || MODES[1];
