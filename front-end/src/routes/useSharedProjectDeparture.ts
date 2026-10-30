import { useContext, useEffect, useRef } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';
import type { BrowserHistory, Transition } from 'history';
import { useTranslation } from 'react-i18next';
import { useConfirmDialog } from 'src/components/shared/ConfirmDialog';

export function useSharedProjectDeparture(dirty: boolean): () => void {
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const history = navigator as BrowserHistory;
  const { confirm } = useConfirmDialog();
  const { t } = useTranslation();
  const release = useRef<() => void>(() => {});

  useEffect(() => {
    if (!dirty) return undefined;
    let active = true;
    let pending = false;
    let unblock = () => {};
    let unlisten = () => {};
    const stop = () => {
      active = false;
      unblock();
      unlisten();
    };
    const block = (transition: Transition) => {
      if (pending || !active) return;
      pending = true;
      void confirm({
        title: t('projectSharing.leaveTitle'), message: t('projectSharing.leaveWarning'),
        confirmLabel: t('projectSharing.leave'), cancelLabel: t('cancel'), danger: true,
      }).then((accepted) => {
        if (!active) return;
        if (!accepted) { pending = false; return; }
        unblock();
        unlisten = history.listen(() => {
          unlisten();
          pending = false;
          if (active) unblock = history.block(block);
        });
        transition.retry();
      });
    };
    unblock = history.block(block);
    release.current = stop;
    return stop;
  }, [dirty, history, confirm, t]);

  return () => release.current();
}
