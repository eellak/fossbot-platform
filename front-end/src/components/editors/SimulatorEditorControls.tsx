import React from 'react';
import { Button } from '@mui/material';
import { IconMap, IconRefresh } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { SimulatorControlHandle } from 'src/simulator-adapter/Simulator';

type SimulatorEditorControlsProps = {
  simulator: React.RefObject<SimulatorControlHandle>;
};

const SimulatorEditorControls: React.FC<SimulatorEditorControlsProps> = ({ simulator }) => {
  const { t } = useTranslation();

  return (
    <>
      <Button variant="outlined" startIcon={<IconRefresh size={20} />} onClick={() => void simulator.current?.resetStage()}>
        {t('education.workspace.resetSimulation')}
      </Button>
      <Button variant="outlined" startIcon={<IconMap size={20} />} onClick={() => simulator.current?.openStageSelection()}>
        {t('changeStage')}
      </Button>
    </>
  );
};

export default SimulatorEditorControls;
