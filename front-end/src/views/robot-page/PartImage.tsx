import { Box } from '@mui/material';
import type { PartDetail } from './partDetails';

/** Original embedded photograph from the supplied parts spreadsheet. */
export default function PartImage({detail,label,large=false}:{detail:PartDetail;id:number;label:string;large?:boolean}) {
  return <Box component="img" src={detail.photo} alt={label} loading="lazy" sx={{width:'100%',height:large?240:84,objectFit:'contain',bgcolor:'background.paper'}} />;
}
