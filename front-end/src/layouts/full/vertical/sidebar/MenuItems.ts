import FOSSBotIcon from '/src/assets/images/fossbot/fossbot-icon.png';

import { uniqueId } from 'lodash';
import {
  IconCode,
  IconPuzzle,
  IconMoodKid,
  IconMoodHappy,
  IconLayoutDashboard,
  IconAlbum,
} from '@tabler/icons-react';

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
    navlabel: true,
    subheader: 'menu.editors',
  },
  {
    id: uniqueId(),
    title: 'menu.monacoEditor',
    subtitle: 'menu.pythonBased',
    chip: 'new',
    chipColor: 'primary',
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
    title: 'menu.kindergarten',
    subtitle: 'menu.simplyBlocks',
    icon: IconMoodKid,
    chip: 'soon',
    // chipColor: 'primary',
    href: '/blockly-simply-page',
    disabled: true,
  },

  {
    navlabel: true,
    subheader: 'menu.educationalMaterial',
  },
  {
    id: uniqueId(),
    title: 'menu.tutorials',
    icon: IconAlbum,
    chip: 'soon',
    // chipColor: 'primary',
    href: '/material-page',
    disabled: false,
  },
  {
    id: uniqueId(),
    title: 'menu.kindergarten',
    icon: IconMoodKid,
    chip: 'soon',
    // chipColor: 'primary',
    href: '/material-page',
    disabled: true,
  },
  {
    id: uniqueId(),
    title: 'menu.elementary',
    icon: IconMoodHappy,
    chip: 'soon',
    href: '/material-page',
    disabled: true,
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
