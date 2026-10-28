import { useTranslation } from 'react-i18next';
import { Button } from '@mui/material';
import { menuIconId, WebsiteMenuIcon } from 'src/website/menuIcons';
import { useLanding } from 'src/website/LandingContext';
export default function Navigations() {
 const {menu}=useLanding('navigation');
 const {i18n}=useTranslation();
 return <><Button color="inherit" href="/robot" sx={{fontSize:'16px',color:'text.secondary'}}>{/^(el|gr)(-|$)/.test(i18n.language)?'Το ρομπότ':'The robot'}</Button>{menu.filter(item=>item.href!=='/robot').map((item,index)=><Button key={index} color="inherit" variant="text" href={item.href} startIcon={menuIconId(item)?<WebsiteMenuIcon id={menuIconId(item)}/>:undefined} sx={{fontSize:'16px',color:'text.secondary'}}>{item.title}</Button>)}</>;
}
