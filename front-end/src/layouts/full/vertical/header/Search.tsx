import Menuitems from '../sidebar/MenuItems';
import { useState } from 'react';
import {
  IconButton,
  Dialog,
  DialogContent,
  Stack,
  Divider,
  Box,
  List,
  ListItemText,
  Typography,
  TextField,
  Tooltip,
  ListItemButton,
} from '@mui/material';

import { IconSearch, IconX } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';

interface menuType {
  title: string;
  id: string;
  subheader: string;
  children: menuType[];
  href: string;
}

const Search = () => {
  const { t } = useTranslation();
  const { user, isGuest, guestSettings } = useAuth();

  // drawer top
  const [showDrawer2, setShowDrawer2] = useState(false);
  const [search, setSerach] = useState('');

  const handleDrawerClose2 = () => {
    setShowDrawer2(false);
  };

  const filterRoutes = (rotr: any, cSearch: string) => {
    if (rotr.length > 1)
      return rotr.filter((t: any) =>
        t.title ? t.href.toLocaleLowerCase().includes(cSearch.toLocaleLowerCase()) : '',
      );

    return rotr;
  };
  const searchableItems = isGuest
    ? Menuitems.filter((item: any) => item.guestView && guestSettings.allowed_views.includes(item.guestView))
    : Menuitems.filter((item: any) => !item.guestOnly).filter((item: any) => !item.allowedRoles || (user && item.allowedRoles.includes(user.role)));
  const searchData = filterRoutes(searchableItems, search);

  return (
    <>
      <Tooltip title={t('appHeader.searchPages')}>
        <IconButton
          aria-label={t('appHeader.searchPages')}
          aria-controls={showDrawer2 ? 'page-search-dialog' : undefined}
          aria-haspopup="dialog"
          onClick={() => setShowDrawer2(true)}
          color="inherit"
          sx={{ width: 44, height: 44, borderRadius: 1 }}
        >
          <IconSearch size={20} aria-hidden="true" />
        </IconButton>
      </Tooltip>
      <Dialog
        open={showDrawer2}
        onClose={() => setShowDrawer2(false)}
        fullWidth
        maxWidth={'sm'}
        aria-labelledby="page-search-title"
        PaperProps={{ id: 'page-search-dialog', sx: { position: 'fixed', top: 30, m: 0 } }}
      >
        <DialogContent className="testdialog">
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              id="tb-search"
              autoFocus
              placeholder={t('appHeader.searchPages')}
              fullWidth
              onChange={(e) => setSerach(e.target.value)}
              inputProps={{ 'aria-label': t('appHeader.searchPages') }}
            />
            <IconButton size="small" aria-label={t('appHeader.closeSearch')} onClick={handleDrawerClose2}>
              <IconX size="18" />
            </IconButton>
          </Stack>
        </DialogContent>
        <Divider />
        <Box p={2} sx={{ maxHeight: '60vh', overflow: 'auto' }}>
          <Typography id="page-search-title" variant="h5" p={1}>
            {t('appHeader.searchPages')}
          </Typography>
          <Box>
            <List component="nav">
              {searchData.map((menu: menuType) => {
                return (
                  <Box key={menu.title ? menu.id : menu.subheader}>
                    {menu.title && !menu.children ? (
                      <ListItemButton sx={{ py: 0.5, px: 1 }} to={menu?.href} component={Link} onClick={handleDrawerClose2}>
                        <ListItemText
                          primary={menu.title}
                          secondary={menu?.href}
                          sx={{ my: 0, py: 0.5 }}
                        />
                      </ListItemButton>
                    ) : (
                      ''
                    )}
                    {menu.children ? (
                      <>
                        {menu.children.map((child: menuType) => {
                          return (
                            <ListItemButton
                              sx={{ py: 0.5, px: 1 }}
                              to={child.href}
                              component={Link} onClick={handleDrawerClose2}
                              key={child.title ? child.id : menu.subheader}
                            >
                              <ListItemText
                                primary={child.title}
                                secondary={child.href}
                                sx={{ my: 0, py: 0.5 }}
                              />
                            </ListItemButton>
                          );
                        })}
                      </>
                    ) : (
                      ''
                    )}
                  </Box>
                );
              })}
            </List>
          </Box>
        </Box>
      </Dialog>
    </>
  );
};

export default Search;
