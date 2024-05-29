import React from 'react';
import ReactPlayer from 'react-player';
// import videoFile from '../../assets/videos/ComputerScience.mp4';

class VideoComponent extends React.Component {
  render() {
    return (
      <div style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%'
      }}>
        <ReactPlayer url={require('../../assets/videos/fossbot-presentation.mp4')} controls={true} width='100%' height='100%' />
      </div>
    );
  }
}

export default VideoComponent;