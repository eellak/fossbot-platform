import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Extend the Window interface to include _mtm
declare global {
  interface Window {
    _mtm: any[];
  }
}

const MatomoTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // Function to inject Matomo script
    const injectMatomo = () => {
      var _mtm = window._mtm = window._mtm || [];
      _mtm.push({'mtm.startTime': (new Date().getTime()), 'event': 'mtm.Start'});
      (function() {
        var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
        g.async=true; g.src='https://fossbot.gr/analytics/js/containerc_NY6wzURV.js'; s.parentNode.insertBefore(g,s);
      })();
    };

    // Initialize _mtm array if it doesn't exist
    if (!window._mtm) {
      window._mtm = [];
      injectMatomo();
    }

    // Track page view on route change
    window._mtm.push({'mtm.startTime': (new Date().getTime()), 'event': 'mtm.PageView', 'url': window.location.href});
  }, [location]);

  return null;
};

export default MatomoTracker;
