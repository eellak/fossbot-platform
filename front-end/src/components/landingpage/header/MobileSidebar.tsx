import { Box, Button, Stack } from '@mui/material';
import Logo from 'src/layouts/full/shared/logo/Logo';
import Navigations from './Navigations';
import { useLanding } from 'src/website/LandingContext';
export default function MobileSidebar() {
 const {t,value}=useLanding('navigation');
 return <><Box px={3}><Logo/></Box><Box p={3}><Stack spacing={2} alignItems="flex-start"><Navigations/><Button variant="contained" href={value('href:login')}>{t('login')}</Button></Stack></Box></>;
}
