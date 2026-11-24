import { IconButton, Tooltip, useMediaQuery, type Theme } from '@mui/material';
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconMenu2 } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'src/store/Store';
import { toggleMobileSidebar, toggleSidebar } from 'src/store/customizer/CustomizerSlice';

export default function SidebarToggle() {
  const { t } = useTranslation();
  const desktop = useMediaQuery((theme: Theme) => theme.breakpoints.up('lg'));
  const expanded = useSelector(state => desktop ? !state.customizer.isCollapse : state.customizer.isMobileSidebar);
  const dispatch = useDispatch();
  const Icon = desktop ? (expanded ? IconLayoutSidebarLeftCollapse : IconLayoutSidebarLeftExpand) : IconMenu2;
  const label = t(expanded ? 'appHeader.collapseNavigation' : 'appHeader.expandNavigation');

  return (
    <Tooltip title={label}>
      <IconButton color="inherit" aria-label={label} aria-expanded={expanded}
        onClick={() => dispatch(desktop ? toggleSidebar() : toggleMobileSidebar())}
        sx={{ width: 44, height: 44, borderRadius: 1 }}>
        <Icon size={20} aria-hidden="true" />
      </IconButton>
    </Tooltip>
  );
}
