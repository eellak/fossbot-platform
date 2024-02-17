import React from 'react';

import { ListSubheader, styled } from '@mui/material';
import { IconDots } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

type NavGroup = {
  navlabel?: boolean;
  subheader?: string;
};

interface ItemType {
  item: NavGroup;
  hideMenu: string | boolean;
}

const NavGroup = ({ item, hideMenu }: ItemType) => {
  const { t } = useTranslation();

  const subheader = item?.subheader ? t(item.subheader) : '';
  const ListSubheaderStyle = styled((props: any) => <ListSubheader disableSticky {...props} />)(
    ({ theme }) => ({
      ...theme.typography.overline,
      fontWeight: '700',
      marginTop: theme.spacing(3),
      marginBottom: theme.spacing(0),
      color: 'text.Primary',
      lineHeight: '26px',
      padding: '3px 12px',
    }),
  );

  return (
    <ListSubheaderStyle>{hideMenu ? <IconDots size="14" /> : subheader}</ListSubheaderStyle>
  );
};

export default NavGroup;
