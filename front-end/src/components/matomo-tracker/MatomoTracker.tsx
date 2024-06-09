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
  const MATOMO_URL = 'fossbot.gr/analytics'; // Replace with your Matomo URL
  const CONTAINER_ID = 'NY6wzURV'; // Replace with your container ID

  useEffect(() => {
    // Function to inject Matomo script
    const injectMatomo = () => {
      const scriptContent = `
        window._mtm = window._mtm || [];
        window._mtm.push({'mtm.startTime': (new Date().getTime()), 'event': 'mtm.Start'});
        (function() {
          var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
          g.type='text/javascript'; g.async=true; g.src='https://${MATOMO_URL}/js/container_${CONTAINER_ID}.js'; s.parentNode.insertBefore(g,s);
        })();
      `;

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.innerHTML = scriptContent;
      document.head.appendChild(script);
    };

    // Inject the Matomo script if not already injected
    if (!window._mtm || window._mtm.length === 0) {
      injectMatomo();
    }

    // Ensure that Matomo script is loaded and _mtm is defined
    if (window._mtm) {
      // Track page view on route change
      window._mtm.push({
        'mtm.startTime': (new Date().getTime()), 
        'event': 'mtm.PageView', 
        'url': window.location.pathname + window.location.search + window.location.hash
      });
    } else {
      console.error('Matomo script not loaded properly.');
    }
  }, [location]);

  return null;
};

export default MatomoTracker;
