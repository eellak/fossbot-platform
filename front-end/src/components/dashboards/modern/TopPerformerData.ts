import img1 from 'src/assets/images/profile/user-1.jpg';
import img2 from 'src/assets/images/profile/user-2.jpg';
import img3 from 'src/assets/images/profile/user-3.jpg';
import img4 from 'src/assets/images/profile/user-4.jpg';

interface PerformerType {
  id: string;
  imgsrc: string;
  name: string;
  post: string;
  pname: string;
  status: string;
  budget: string;
}

const TopPerformerData: PerformerType[] = [
  {
    id: '1',
    imgsrc: img1,
    name: 'Sunil Joshi',
    post: 'Web Designer',
    pname: 'Elite Admin',
    status: 'Low',
    budget: '3.9',
  },
  {
    id: '2',
    imgsrc: img2,
    name: 'John Deo',
    post: 'Web Developer',
    pname: 'Flexy Admin',
    status: 'Medium',
    budget: '24.5',
  },
  {
    id: '3',
    imgsrc: img3,
    name: 'Mathew Anderson',
    post: 'Web Manager',
    pname: 'Material Pro',
    status: 'High',
    budget: '12.8',
  },
  {
    id: '4',
    imgsrc: img4,
    name: 'Yuvraj Sheth',
    post: 'Project Manager',
    pname: 'Xtreme Admin',
    status: 'Very High',
    budget: '2.4',
  },
];

export default TopPerformerData;
