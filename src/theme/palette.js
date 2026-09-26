// One source of truth for every screen, dialog and navigation surface.
export const COLOR_THEMES = ['mint', 'ocean', 'plum', 'original'];
const accents = {
  mint: ['#087F70', '#5EE0C2', '#F3F8F6', '#0E1917', '#182723'],
  ocean: ['#2263C5', '#8AB8FF', '#F3F6FC', '#111925', '#1B293C'],
  plum: ['#8550B0', '#D1A5F4', '#F8F4FA', '#1C1523', '#2B2035'],
};
export function getPalette(mode, selected = 'original') {
  if (selected === 'original' || !COLOR_THEMES.includes(selected)) {
    const dark = mode === 'dark';
    const accent = dark ? '#2DD4BF' : '#0D9488';
    const border = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
    const text = dark ? '#FFFFFF' : '#0F172A';
    const muted = dark ? 'rgba(255,255,255,0.7)' : '#64748B';
    return {
      bg: dark ? '#0B0F14' : '#F8FAFC',
      card: dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
      modalBg: dark ? '#161B22' : '#FFFFFF',
      text, muted, accent, border,
      elemBg: dark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
      elemBorder: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)',
      btn: dark ? '#CFFAFE' : '#0D94881A', btnText: dark ? '#000000' : accent,
      onAccent: dark ? '#000000' : '#FFFFFF', btnBorder: border,
      tabBg: dark ? '#0B0F14' : '#FFFFFF',
      tabBorder: dark ? 'rgba(255,255,255,0.12)' : border,
      active: accent, inactive: dark ? 'rgba(255,255,255,0.6)' : muted,
      link: dark ? '#58A6FF' : '#0969DA', calories: '#FB923C', danger: '#F87171',
      macros: { protein: '#8B5CF6', carbs: '#0EA5E9', fat: '#F59E0B' },
    };
  }
  const [lightAccent, darkAccent, lightBg, darkBg, darkCard] = accents[selected] || accents.mint;
  const dark = mode === 'dark';
  const accent = dark ? darkAccent : lightAccent;
  const card = dark ? darkCard : '#FFFFFF';
  const muted = dark ? '#B2BCCB' : '#5E6B7C';
  const border = dark ? '#3B4655' : '#DCE3EB';
  return {
    bg: dark ? darkBg : lightBg, card, modalBg: card,
    text: dark ? '#F3F6FA' : '#1B2838', muted, accent, border,
    elemBg: dark ? '#263344' : '#EDF1F6', elemBorder: border,
    btn: dark ? `${darkAccent}18` : `${lightAccent}14`, btnText: accent,
    onAccent: dark ? '#142131' : '#FFFFFF',
    btnBorder: border, tabBg: card, tabBorder: border, active: accent, inactive: muted,
    link: accent, calories: dark ? '#FFB36B' : '#A94D08',
    danger: dark ? '#FF929B' : '#BF3045',
    macros: dark
      ? { protein: '#BFA1FF', carbs: '#6DCFF6', fat: '#F7C66A' }
      : { protein: '#8055C4', carbs: '#087FA7', fat: '#A97008' },
  };
}
export const typography = {
  screenTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  itemTitle: { fontSize: 16, fontWeight: '600' },
};
