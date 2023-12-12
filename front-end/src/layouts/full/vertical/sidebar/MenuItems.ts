import { uniqueId } from 'lodash';
import FOSSBotIcon from '/src/assets/images/fossbot/fossbot-icon.png';
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
import {
  IconAward,
  IconBoxMultiple,
  IconPoint,
  IconBan,
  IconStar,
  IconMoodSmile,
  IconAperture,
  IconBrandGithub,
  IconHome,
  IconCode,
  IconBlockquote,
  IconPuzzle2,
  IconPuzzle,
  IconMoodKid,
  IconArrowMerge,
  IconSchool,
  IconBrandGoogle,
  IconBrandOpenSource,
  IconMoodHappy
} from '@tabler/icons-react';
//https://tabler-icons-react.vercel.app/
//search above for icons names


const Menuitems: MenuitemsType[] = [
  {
    navlabel: true,
    subheader: 'Home',
  },

  {
    id: uniqueId(),
    title: 'FOSSBot Home',
    icon: IconHome,
    href: '/',
    // chip: 'New',
    chipColor: 'secondary',
  },

  // {
  //   id: uniqueId(),
  //   title: 'Menu Level',
  //   icon: IconBoxMultiple,
  //   href: '/menulevel/',
  //   children: [
  //     {
  //       id: uniqueId(),
  //       title: 'Level 1',
  //       icon: IconPoint,
  //       href: '/l1',
  //     },
  //     {
  //       id: uniqueId(),
  //       title: 'Level 1.1',
  //       icon: IconPoint,
  //       href: '/l1.1',
  //       children: [
  //         {
  //           id: uniqueId(),
  //           title: 'Level 2',
  //           icon: IconPoint,
  //           href: '/l2',
  //         },
  //         {
  //           id: uniqueId(),
  //           title: 'Level 2.1',
  //           icon: IconPoint,
  //           href: '/l2.1',
  //           children: [
  //             {
  //               id: uniqueId(),
  //               title: 'Level 3',
  //               icon: IconPoint,
  //               href: '/l3',
  //             },
  //             {
  //               id: uniqueId(),
  //               title: 'Level 3.1',
  //               icon: IconPoint,
  //               href: '/l3.1',
  //             },
  //           ],
  //         },
  //       ],
  //     },
  //   ],
  // },
  {
    navlabel: true,
    subheader: 'Editors',
  },
  {
    id: uniqueId(),
    title: 'Monaco Editor',
    subtitle: 'Python based',
    chip: 'New',
    chipColor: 'primary',
    icon: IconCode,
    href: '/monaco-page',
  },
  {
    id: uniqueId(),
    title: 'Blocly Editor',
    subtitle: 'Blocks based',
    icon: IconPuzzle,
    href: '/blockly-page',
  },

  {
    id: uniqueId(),
    title: 'Kindergarten',
    subtitle: 'Simply Blocks',
    icon: IconMoodKid,
    chip: 'Soon',
    // chipColor: 'primary',
    href: '/blockly-simply-page',
    disabled: true,
  },

  {
    navlabel: true,
    subheader: 'Educational Material',
  },
  {
    id: uniqueId(),
    title: 'Kindergarten',
    // subtitle: 'Simply Blocks',
    icon: IconMoodKid,
    chip: 'Soon',
    // chipColor: 'primary',
    href: '/material-page',
    disabled: true,
  },
  {
    id: uniqueId(),
    title: 'Elementary',
    // subtitle: 'Simply Blocks',
    icon: IconMoodHappy,
    chip: 'Soon',
    // chipColor: 'primary',
    href: '/material-page',
    disabled: true,
  },

  // {
  //   id: uniqueId(),
  //   title: 'Chip',
  //   icon: IconAward,
  //   href: '/',
  //   chip: '9',
  //   chipColor: 'primary',
  // },
  // {
  //   id: uniqueId(),
  //   title: 'Outlined',
  //   icon: IconMoodSmile,
  //   href: '/',
  //   chip: 'outline',
  //   variant: 'outlined',
  //   chipColor: 'primary',
  // },
  {
    navlabel: true,
    subheader: 'About us',
  },
  {
    id: uniqueId(),
    title: 'Our Team',
    icon: IconArrowMerge,
    href: '/team-page',
    disabled: false,
  },
  {
    id: uniqueId(),
    title: 'Google Summer of Code',
    icon: IconBrandGoogle,
    href: '/gsoc-page',
    disabled: false,
  },
  {
    id: uniqueId(),
    title: 'Harokopio University',
    icon: IconSchool,
    href: '/hua-page',
    disabled: false,
  },
  {
    id: uniqueId(),
    title: 'GFOSS',
    icon: IconBrandOpenSource,
    href: '/gfoss-page',
    disabled: false,
  },




  {
    navlabel: true,
    subheader: 'External Links',
  },

  {
    id: uniqueId(),
    title: 'FOSSBot Repository',
    external: true,
    icon: IconBrandGithub,
    href: 'https://github.com/eellak/fossbot',
    newWindow: true
  },
  {
    id: uniqueId(),
    title: 'Harokopio University',
    icon: IconSchool,
    external: true,
    href: 'https://www.hua.gr/index.php/en/',
    newWindow: true
  },
  {
    id: uniqueId(),
    title: 'GFOSS',
    icon: IconBrandOpenSource,
    external: true,
    href: 'https://gfoss.eu/',
    newWindow: true
  },
];

export default Menuitems;
