export const tabs = [
  { id: 'about', n: '01', label: 'About', icon: 'user' },
  { id: 'missions', n: '02', label: 'Missions', icon: 'orbit' },
  { id: 'skills', n: '03', label: 'Skills', icon: 'constellation' },
  { id: 'contact', n: '04', label: 'Contact', icon: 'antenna' },
] as const;

export type TabId = (typeof tabs)[number]['id'];
