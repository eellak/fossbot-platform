 
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from 'src/components/notifications/NotificationProvider';

const WelcomeHomePage = () => {
  const { t } = useTranslation();
  const { notify } = useNotifications();
  React.useEffect(() => {
    const timer = setTimeout(() => {
      notify(`${t('welcome-home-page.welcome')} ${t('welcome-home-page.manageProjects')}`, { severity: 'info' });
    }, 1500);

    return () => clearTimeout(timer);
  }, [notify, t]);

  return null;
};

export default WelcomeHomePage;
