import icon1 from 'src/assets/images/svgs/icon-account.svg'
import icon3 from 'src/assets/images/svgs/icon-tasks.svg'

//
// Profile dropdown
//
interface ProfileType {
  href: string;
  title: string;
  subtitle: string;
  icon: any;
}
const profileMenuPages: ProfileType[] = [
  {
    href: '/accountSettings',
    title: 'My Profile',
    subtitle: 'Account Settings',
    icon: icon1,
  },
];

// Admin dropdown

interface AdminType {
  href: string;
  title: string;
  subtitle: string;
  icon: any;
}

const adminPages: AdminType[] = [
  {
    href: '/admin-panel',
    title: 'Admin Panel',
    subtitle: 'Manage users',
    icon: icon3,
  },
];


export { profileMenuPages, adminPages };
