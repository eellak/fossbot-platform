import FOSSBotIcon from '/src/assets/images/fossbot/fossbot-icon.png';

import { uniqueId } from 'lodash';
import {
  IconCode,
  IconPuzzle,
  IconLayoutDashboard,
  IconHandGrab,
  IconDeviceGamepad2,
  IconWorld,
  IconBooks,
} from '@tabler/icons-react';
import type { BetaFeature } from 'src/config/betaFeatures';

interface MenuitemsType {
  [x: string]: any;
  id?: string;
  navlabel?: boolean;
  subheader?: string;
  title?: string;
  icon?: any;
  href?: string;
  children?: MenuitemsType[];
  chip?: string;
  chipColor?: string;
  variant?: string;
  external?: boolean;
  allowedRoles?: string[];
  betaOnly?: boolean;
  betaFeature?: BetaFeature;
}

const Menuitems: MenuitemsType[] = [
  // {
  //   navlabel: true,
  //   subheader: 'menu.home',
  // },

  // {
  //   id: uniqueId(),
  //   title: 'menu.fossbotHome',
  //   icon: IconHome,
  //   href: '/',
  //   chipColor: 'secondary',
  // },
  {
    id: uniqueId(),
    title: 'menu.dashboard',
    icon: IconLayoutDashboard,
    href: '/dashboard',
    chipColor: 'secondary',
  },
  {
    id: uniqueId(),
    title: 'Stages',
    icon: IconWorld,
    href: '/stages',
    betaOnly: true,
    betaFeature: 'stages',
  },
  {
    navlabel: true,
    subheader: 'menu.editors',
  },
  {
    id: uniqueId(),
    title: 'menu.monacoEditor',
    subtitle: 'menu.pythonBased',
    // chip: 'new',
    // chipColor: 'primary',
    icon: IconCode,
    href: '/monaco-page',
  },
  {
    id: uniqueId(),
    title: 'menu.blocklyEditor',
    subtitle: 'menu.blocksBased',
    icon: IconPuzzle,
    href: '/blockly-page',
  },

  {
    id: uniqueId(),
    title: 'menu.interactive',
    subtitle: 'menu.interactiveBased',
    icon: IconHandGrab,
    href: '/interactive-page',
    disabled: false,
    betaFeature: 'interactive',
  },
  {
    id: uniqueId(),
    title: 'menu.rcMode',
    subtitle: 'menu.rcBased',
    icon: IconDeviceGamepad2,
    href: '/rc-page',
    disabled: false,
  },

  {
    navlabel: true,
    subheader: 'menu.educationalMaterial',
  },
  {
    id: uniqueId(),
    title: 'menu.studentCourses',
    icon: IconBooks,
    href: '/courses',
    allowedRoles: ['user'],
    betaOnly: true,
    betaFeature: 'education',
  },
  {
    id: uniqueId(),
    title: 'menu.teacherCourses',
    icon: IconBooks,
    href: '/teach/courses',
    allowedRoles: ['tutor', 'admin'],
    betaOnly: true,
    betaFeature: 'education',
  },
  // {
  //   navlabel: true,
  //   subheader: 'menu.externalLinks',
  // },

  // {
  //   id: uniqueId(),
  //   title: 'menu.fossbotRepository',
  //   external: true,
  //   icon: IconBrandGithub,
  //   href: 'https://github.com/eellak/fossbot',
  //   newWindow: true,
  // },
  // {
  //   id: uniqueId(),
  //   title: 'harokopioUniversity',
  //   icon: IconSchool,
  //   external: true,
  //   href: 'https://www.hua.gr/index.php/en/',
  //   newWindow: true,
  // },
  // {
  //   id: uniqueId(),
  //   title: 'gfoss',
  //   icon: IconBrandOpenSource,
  //   external: true,
  //   href: 'https://gfoss.eu/',
  //   newWindow: true,
  // },
];

export default Menuitems;
