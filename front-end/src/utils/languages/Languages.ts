import FlagEn from 'src/assets/images/flag/icon-flag-en.svg';
import FlagGr from 'src/assets/images/flag/icon-flag-gr.svg';

export interface Language {
  flagname: string;
  icon: string;
  value: string;
}

export const Languages: Language[] = [
  {
    flagname: 'english',
    icon: FlagEn,
    value: 'en',
  },
  {
    flagname: 'greek',
    icon: FlagGr,
    value: 'gr',
  },
];
