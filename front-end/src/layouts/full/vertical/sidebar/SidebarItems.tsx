import React from 'react';
import Menuitems from './MenuItems';
import NavItem from './NavItem';
import NavCollapse from './NavCollapse';
import NavGroup from './NavGroup/NavGroup';
import { useLocation } from 'react-router';
import { Box, List, useMediaQuery } from '@mui/material';
import { useSelector, useDispatch } from 'src/store/Store';
import { toggleMobileSidebar } from 'src/store/customizer/CustomizerSlice';
import { AppState } from 'src/store/Store';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider'; // Ensure this import path is correct
import { UserRole } from 'src/authentication/AuthInterfaces';

const SidebarItems = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const pathDirect = pathname;
  const pathWithoutLastPart = pathname.slice(0, pathname.lastIndexOf('/'));
  const customizer = useSelector((state: AppState) => state.customizer);
  const lgUp = useMediaQuery((theme: any) => theme.breakpoints.up('lg'));
  const hideMenu: any = lgUp ? customizer.isCollapse && !customizer.isSidebarHover : '';
  const dispatch = useDispatch();
  const { user } = useAuth(); // Access user info

  const hasBetaAccess = user?.beta_tester || user?.role === UserRole.ADMIN;
  const visibleItems = Menuitems.filter((item) => !item.allowedRoles || (user && item.allowedRoles.includes(user.role))).filter((item) => !item.betaOnly || hasBetaAccess);
  const hasEducationItems = visibleItems.some((item) => item.href === '/courses' || item.href === '/teach/courses');
  const modifiedMenuItems = visibleItems.filter((item) => item.subheader !== 'menu.educationalMaterial' || hasEducationItems);

  return (
    <Box sx={{ px: 3 }}>
      <List sx={{ pt: 0 }} className="sidebarNav">
        {modifiedMenuItems.map((item) => {
          // {/********SubHeader**********/}
          if (item.subheader) {
            return <NavGroup item={item} hideMenu={hideMenu} key={t(item.subheader)} />;

            // {/********If Sub Menu**********/}
          } else if (item.children) {
            return (
              <NavCollapse
                menu={item}
                pathDirect={pathDirect}
                hideMenu={hideMenu}
                pathWithoutLastPart={pathWithoutLastPart}
                level={1}
                key={item.id}
                onClick={() => dispatch(toggleMobileSidebar())}
              />
            );

            // {/********If No Sub Menu**********/}
          } else {
            return (
              <NavItem
                item={item}
                key={item.id}
                pathDirect={pathDirect}
                hideMenu={hideMenu}
                onClick={() => dispatch(toggleMobileSidebar())}
              />
            );
          }
        })}
      </List>
    </Box>
  );
};

export default SidebarItems;
