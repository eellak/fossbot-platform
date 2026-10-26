import { Button } from '@mui/material';
import { menuIconId, WebsiteMenuIcon } from 'src/website/menuIcons';
import { useLanding } from 'src/website/LandingContext';
export default function Navigations() {
 const {menu}=useLanding('navigation');
 return <>{menu.map((item,index)=><Button key={index} color="inherit" variant="text" href={item.href} startIcon={menuIconId(item)?<WebsiteMenuIcon id={menuIconId(item)}/>:undefined} sx={{fontSize:'16px',color:'text.secondary'}}>{item.title}</Button>)}</>;
}
