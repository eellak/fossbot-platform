import img1 from 'src/assets/images/profile/user-1.jpg';
import img2 from 'src/assets/images/profile/user-2.jpg';
import img3 from 'src/assets/images/profile/user-3.jpg';
import img4 from 'src/assets/images/profile/user-4.jpg';

interface PerformerType {
  id: string;
  imgsrc: string;
  name: string;
  specialty: string;
  pname: string;
  pdescription: string;
  editor: string;
}

const PlatformUsersData: PerformerType[] = [
  {
    id: '1',
    imgsrc: img1,
    name: 'Sunil Joshi',
    specialty: 'Web Designer',
    pname: 'Move Forward',
    pdescription: 'Moves Robot Forward',
    editor: 'Monaco',
  },
  {
    id: '2',
    imgsrc: img2,
    name: 'John Deo',
    specialty: 'Web Developer',
    pname: 'Move Backward',
    pdescription: 'Moves Robot Backward',
    editor: 'Blockly',
  },
  {
    id: '3',
    imgsrc: img3,
    name: 'Mathew Anderson',
    specialty: 'Web Manager',
    pname: 'Play Sound',
    pdescription: 'Play R2D2 Sound',
    editor: 'Monaco',
  },
  {
    id: '4',
    imgsrc: img4,
    name: 'Yuvraj Sheth',
    specialty: 'Project Manager',
    pname: 'Avoid Obstacle',
    pdescription: 'Avoids Obstacles',
    editor: 'Blockly',
  },
];

export default PlatformUsersData;
