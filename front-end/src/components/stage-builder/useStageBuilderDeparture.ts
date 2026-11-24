import { useContext, useEffect, useRef } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';
import type { BrowserHistory, Transition } from 'history';

export function useStageBuilderDeparture(dirty: boolean, confirmDeparture: () => Promise<boolean>): () => void {
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const history = navigator as BrowserHistory;
  const confirm = useRef(confirmDeparture);
  confirm.current = confirmDeparture;
  const currentDirty = useRef(dirty);
  currentDirty.current = dirty;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const release = useRef(() => {});

  useEffect(() => {
    if (!dirty) return;
    let active = true;
    let pending = false;
    let unblock = () => {};
    let unlisten = () => {};
    const stop = () => { active = false; unblock(); unlisten(); };
    const block = (transition: Transition) => {
      if (!active || pending) return;
      pending = true;
      void confirm.current().then(accepted => {
        // Saving can remove the blocker before the pending confirmation resolves.
        if (!active && (currentDirty.current || !mounted.current)) return;
        if (!accepted) { pending = false; return; }
        unblock();
        unlisten = history.listen(() => {
          unlisten();
          pending = false;
          if (active) unblock = history.block(block);
        });
        transition.retry();
      }).catch(error => {
        pending = false;
        console.error('Could not confirm leaving the stage.', error);
      });
    };
    unblock = history.block(block);
    release.current = stop;
    return stop;
  }, [dirty, history]);

  return () => release.current();
}
