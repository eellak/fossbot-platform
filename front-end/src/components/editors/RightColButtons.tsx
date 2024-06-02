import React from 'react';
import { Stack, Fab } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faPlay, faStop } from '@fortawesome/free-solid-svg-icons';
import { useLocation } from 'react-router-dom';
interface ButtonsProps {
  handlePlayClick: () => void;
  handleSaveClick: () => void;
  handleStopClick: () => void;
}

const Buttons: React.FC<ButtonsProps> = ({ handlePlayClick, handleSaveClick, handleStopClick}) => {
  const location = useLocation();
  const isMonacoPage = location.pathname === '/monaco-tutorial-page';
  const isBlocklyPage = location.pathname === '/blockly-tutorial-page';

  return (
 <Stack direction="row" spacing={3}>
    {!isMonacoPage && !isBlocklyPage && (
      <Fab color="primary" aria-label="save" onClick={handleSaveClick}>
        <FontAwesomeIcon icon={faSave} size="1x" />
      </Fab>
    )}
    <Fab color="success" aria-label="play" onClick={handlePlayClick}>
      <FontAwesomeIcon icon={faPlay} size="1x" />
    </Fab>
    <Fab color="error" aria-label="stop" onClick={handleStopClick}>
      <FontAwesomeIcon icon={faStop} size="1x" />
    </Fab>
  </Stack>
  );
};

export default Buttons;