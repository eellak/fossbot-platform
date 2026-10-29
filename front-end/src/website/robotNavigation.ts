import type { Section } from './api';

const marker = 'robotMenuInstalled';
/** Upgrade older menus once; saved removals, labels, icons and order stay authoritative. */
export function withRobotNavigation(section: Section, title: string): Section {
  if (section.type !== 'landing' || section.group !== 'navigation' || section.values?.[marker] === '1') return section;
  const menu = section.menu || [];
  const exists = menu.some(item => item.href === '/robot');
  if (!exists && menu.length >= 12) return section;
  return {
    ...section,
    values: { ...section.values, [marker]: '1' },
    menu: exists ? menu : [{ id: 'robot-navigation', title, href: '/robot', icon: 'robot', linkType: 'url' }, ...menu],
  };
}
export const isNavigationMetadata = (key: string) => key === marker;
