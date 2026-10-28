import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, Card, CardContent, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Link, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import { IconArrowDown, IconArrowUpRight, IconCpu, IconRadar, IconTool } from '@tabler/icons-react';
import PageContainer from 'src/components/container/PageContainer';
import Header from 'src/components/landingpage/header/Header';
import Footer from 'src/components/landingpage/footer/Footer';
import WebsiteSectionHeading from 'src/website/WebsiteSectionHeading';
import PartImage from './PartImage';
import { partDetails } from './partDetails';
import bomRows from 'src/website/robotBom.json';
const bom: {id:number;name:string;quantity:number;refs?:string;optional?:boolean;noteEn?:string;noteEl?:string}[] = bomRows;
import { categories, categoryRows, copy, greekPartNames, hardwareDownload, hardwareFile, hardwareRoot, partsSheet, printedParts, type Category } from './robotContent';

const image = (file: string) => `/landing-media/robot-v2/${file}`;
const sectionSx = { py: { xs: 6, md: 9 }, scrollMarginTop: '100px' };
const external = { target: '_blank', rel: 'noopener noreferrer' };

export default function RobotPage() {
  const { i18n } = useTranslation();
  const locale = /^(el|gr)(-|$)/.test(i18n.language) ? 'el' : 'en';
  const c = copy[locale];
  const textIndex = locale === 'el' ? 1 : 0;
  const [selectedPart, setSelectedPart] = useState<number | null>(null);
  const selected = bom.find(part => part.id === selectedPart);
  const selectedDetail = selected ? partDetails[selected.id] : null;
  const name = (part: typeof bom[number]) => locale === 'el' ? greekPartNames[part.id] || part.name : part.name;
  const detailLabel = locale === 'el' ? 'Στοιχεία παραγγελίας' : 'Ordering details';
  const imageLabel = (id:number) => partDetails[id].photoIsExample ? (locale === 'el' ? 'Φωτογραφία φύλλου · παράδειγμα' : 'Sheet photo · example') : (locale === 'el' ? 'Φωτογραφία από το φύλλο' : 'Photo from parts sheet');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(10);
  const filtered = bom.filter(part => (category === 'all' || categoryRows[category].includes(part.id)) && `${part.name} ${greekPartNames[part.id] || ''} ${part.refs || ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const visible = rows === -1 ? filtered : filtered.slice(page * rows, page * rows + rows);
  const navIds = ['overview', 'parts', 'print', 'pcb'];
  const featureIcons = [IconCpu, IconRadar, IconTool];

  return <PageContainer title={`FOSSBot v2 — ${c.title}`} description={c.description}>
    <Box sx={{ bgcolor: 'background.paper', color: 'text.primary', minHeight: '100vh' }}>
      <Header />
      <Box component="main" lang={locale}>
        <Container maxWidth="lg">
          <Stack component="nav" aria-label={locale === 'el' ? 'Ενότητες ρομπότ' : 'Robot sections'} direction="row" flexWrap="wrap" spacing={1} sx={{ pt: 3 }}>
            {navIds.map((id, index) => <Button key={id} href={`#${id}`} color="inherit">{c.nav[index]}</Button>)}
          </Stack>
          <Box id="overview" component="section" sx={sectionSx}>
            <Grid container spacing={4} alignItems="center">
              <Grid item xs={12} md={6}>
                <Stack spacing={3} alignItems="flex-start">
                  <Chip label={c.eyebrow} variant="outlined" />
                  <WebsiteSectionHeading component="h1">{c.title}</WebsiteSectionHeading>
                  <Typography component="p" variant="h5" sx={{ maxWidth: '32ch' }}>{c.intro}</Typography>
                  <Typography color="text.secondary" sx={{ maxWidth: '52ch' }}>{c.description}</Typography>
                  <Stack direction="row" flexWrap="wrap" spacing={1.5}>
                    <Button variant="contained" href="#parts" endIcon={<IconArrowDown size={18} />}>{c.browse}</Button>
                    <Button variant="outlined" href={hardwareRoot} {...external} endIcon={<IconArrowUpRight size={18} />}>{c.files}</Button>
                  </Stack>
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box component="img" src={image('full_bot.png')} alt={locale === 'el' ? 'Συναρμολογημένο FOSSBot v2 με μπλε σώμα, κίτρινους τροχούς και επάνω μέρος LEGO' : 'Assembled FOSSBot v2 with a blue body, yellow wheels and LEGO-compatible top'} sx={{ display: 'block', width: '100%', height: { xs: 300, sm: 400, md: 460 }, objectFit: 'contain' }} />
              </Grid>
            </Grid>
            <Grid container spacing={3} sx={{ mt: 4 }}>
              {[[bom.length, c.partCount], [10, c.printCount], [2, c.pcbCount]].map(([number, label]) => <Grid item xs={4} key={label}><Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2 }}><Typography component="p" variant="h3">{number}</Typography><Typography variant="body2" color="text.secondary">{label}</Typography></Box></Grid>)}
            </Grid>
          </Box>
          <Grid container spacing={4} sx={{ pb: { xs: 6, md: 9 } }}>
            {featureIcons.map((Icon, index) => <Grid item xs={12} md={4} key={index}><Stack spacing={2}><Box color="primary.main"><Icon size={28} stroke={1.5} /></Box><Typography component="h2" variant="h5">{c.featureTitles[index]}</Typography><Typography color="text.secondary">{c.featureText[index]}</Typography></Stack></Grid>)}
          </Grid>
        </Container>

        <Box sx={{ bgcolor: 'background.default' }}>
          <Container maxWidth="lg" component="section" id="parts" sx={sectionSx}>
            <Stack spacing={3}>
              <WebsiteSectionHeading>{c.bomTitle}</WebsiteSectionHeading>
              <Typography color="text.secondary" sx={{ maxWidth: '72ch' }}>{c.bomText}</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField fullWidth label={c.search} value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} />
                <TextField select label={c.category} value={category} onChange={event => { setCategory(event.target.value as Category); setPage(0); }} sx={{ minWidth: { sm: 240 } }}>
                  {categories.map((value, index) => <MenuItem key={value} value={value}>{c.categories[index]}</MenuItem>)}
                </TextField>
              </Stack>
              <Card variant="outlined">
                <TableContainer>
                  <Table aria-label={c.bomTitle}>
                    <TableHead><TableRow><TableCell>{c.component}</TableCell><TableCell align="right" sx={{ width: {xs:76,sm:130} }}>{c.quantity}</TableCell></TableRow></TableHead>
                    <TableBody>{visible.map(part => <TableRow key={part.id}>
                      <TableCell sx={{ overflowWrap: 'anywhere' }}>
                        <Stack direction="row" spacing={{xs:1,sm:2}} alignItems="flex-start">
                          <Box sx={{width:{xs:64,sm:100},flexShrink:0,textAlign:'center'}}>
                            <Button aria-label={`${detailLabel}: ${name(part)}`} onClick={()=>setSelectedPart(part.id)} sx={{p:0,width:'100%',minWidth:0}}><PartImage detail={partDetails[part.id]} id={part.id} label={name(part)} /></Button>
                            <Typography variant="caption" color="text.secondary" sx={{fontSize:'0.65rem'}}>{imageLabel(part.id)}</Typography>
                          </Box>
                          <Stack spacing={0.75} sx={{minWidth:0,flex:1}}>
                            <Typography variant="body2" sx={{fontWeight:600}}>{name(part)}</Typography>
                            {part.refs && <Typography variant="caption" color="text.secondary">{part.refs}</Typography>}
                            <Typography variant="body2" color="text.secondary" sx={{display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{partDetails[part.id].specs[textIndex]}</Typography>
                            <Box><Button size="small" onClick={()=>setSelectedPart(part.id)} sx={{px:0}}>{detailLabel}</Button></Box>
                          </Stack>
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={{verticalAlign:'top',pt:3}}>{part.quantity}{part.optional && <Typography variant="caption" component="p">{c.optional}</Typography>}</TableCell>
                    </TableRow>)}
                      {!visible.length && <TableRow><TableCell colSpan={2}><Typography role="status" color="text.secondary" sx={{ py: 3 }}>{c.noParts}</Typography></TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination component="div" count={filtered.length} page={page} rowsPerPage={rows} onPageChange={(_, value) => setPage(value)} onRowsPerPageChange={event => { setRows(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, { value: -1, label: c.all }]} labelRowsPerPage={c.rows} labelDisplayedRows={({ from, to, count }) => c.range(from, to, count)} getItemAriaLabel={type => type === 'next' ? c.next : c.previous} sx={{ '& .MuiTablePagination-toolbar': { flexWrap: 'wrap', px: 1 }, '& .MuiTablePagination-selectLabel': { display: { xs: 'none', sm: 'block' } }, '& .MuiTablePagination-spacer': { display: { xs: 'none', sm: 'block' } } }} />
              </Card>
              <Stack spacing={0.5}><Link href={partsSheet} {...external}>{c.source}</Link><Typography variant="caption" color="text.secondary">{c.sourceNote}</Typography></Stack>
            </Stack>
          </Container>
        </Box>

        <Container maxWidth="lg" component="section" id="print" sx={sectionSx}>
          <Stack spacing={3}>
            <WebsiteSectionHeading>{c.printTitle}</WebsiteSectionHeading>
            <Typography color="text.secondary" sx={{ maxWidth: '72ch' }}>{c.printText}</Typography>
            <Grid container spacing={3} sx={{ width: 'auto' }}>
              {printedParts.map(part => <Grid item xs={12} sm={6} md={3} key={part.image}><Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box component="img" loading="lazy" src={image(part.image)} alt={part[locale]} sx={{ width: '100%', height: 190, objectFit: 'contain', p: 2 }} />
                <CardContent sx={{ flex: 1 }}><Stack spacing={2}><Typography component="h3" variant="h5">{part[locale]}</Typography><Stack direction="row" flexWrap="wrap" spacing={1}>{part.files.map((file, index) => <Link key={file} href={hardwareFile(`stl/${file}`)} {...external}>{part.files.length === 1 ? c.stl : index === 0 ? c.left : c.right}</Link>)}</Stack></Stack></CardContent>
              </Card></Grid>)}
            </Grid>
          </Stack>
        </Container>

        <Box sx={{ bgcolor: 'background.default' }}>
          <Container maxWidth="lg" component="section" id="pcb" sx={sectionSx}>
            <Stack spacing={3}>
              <WebsiteSectionHeading>{c.pcbTitle}</WebsiteSectionHeading>
              <Typography color="text.secondary" sx={{ maxWidth: '72ch' }}>{c.pcbText}</Typography>
              <Grid container spacing={3} sx={{ width: 'auto' }}>
                {[
                  { title: c.mainPcb, text: c.mainText, image: 'f2_main.png', file: 'fossbot-v2-main-pcb.zip' },
                  { title: c.batteryPcb, text: c.batteryText, image: 'f2_power.png', file: 'battery_module.zip' },
                ].map(board => <Grid item xs={12} md={6} key={board.file}><Card variant="outlined" sx={{ height: '100%' }}><Box component="img" loading="lazy" src={image(board.image)} alt={board.title} sx={{ width: '100%', height: 260, p: 3, objectFit: 'contain' }} /><CardContent><Stack spacing={2} alignItems="flex-start"><Typography component="h3" variant="h5">{board.title}</Typography><Typography color="text.secondary">{board.text}</Typography><Button variant="outlined" href={hardwareDownload(`PCB/production/${board.file}`)} {...external} endIcon={<IconArrowDown size={18} />}>{c.pcbDownload}</Button></Stack></CardContent></Card></Grid>)}
              </Grid>
            </Stack>
          </Container>
        </Box>
        <Container maxWidth="lg" component="section" sx={sectionSx}>
          <Stack spacing={3} alignItems="flex-start"><WebsiteSectionHeading>{c.buildTitle}</WebsiteSectionHeading><Typography color="text.secondary" sx={{ maxWidth: '72ch' }}>{c.buildText}</Typography><Stack direction="row" flexWrap="wrap" spacing={2}><Button variant="contained" href="/dashboard">{c.platform}</Button><Button href={hardwareRoot} {...external} endIcon={<IconArrowUpRight size={18} />}>{c.repository}</Button></Stack></Stack>
        </Container>
      </Box>
      <Dialog open={!!selected} onClose={()=>setSelectedPart(null)} maxWidth="md" fullWidth aria-labelledby="part-details-title">
        {selected && selectedDetail && <>
          <DialogTitle id="part-details-title">{name(selected)}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <PartImage detail={selectedDetail} id={selected.id} label={name(selected)} large />
                <Typography variant="caption" component="p" textAlign="center" color="text.secondary">{imageLabel(selected.id)} · {locale==='el'?'όχι υπό κλίμακα':'not to scale'}</Typography>
                {selectedDetail.photoSource && <Box textAlign="center" mt={1}><Link variant="caption" href={selectedDetail.photoSource} {...external}>{locale==='el'?'Πηγή εικόνας':'Image source'}</Link></Box>}
              </Grid>
              <Grid item xs={12} sm={8}>
                <Stack spacing={2} alignItems="flex-start">
                  <Chip label={`${c.quantity}: ${selected.quantity}${selected.optional ? ' · '+c.optional : ''}`} variant="outlined" />
                  {selected.refs && <Typography variant="body2" color="text.secondary">{selected.refs}</Typography>}
                  <Typography variant="h5" component="h3">{locale==='el'?'Τεχνική περιγραφή':'Technical description'}</Typography>
                  <Typography>{selectedDetail.specs[textIndex]}</Typography>
                  <Typography variant="h5" component="h3">{locale==='el'?'Τι να ελέγξετε στην παραγγελία':'What to match when ordering'}</Typography>
                  {selectedDetail.review && <Chip size="small" color="warning" variant="outlined" label={locale==='el'?'Χρειάζεται έλεγχος επιλογής':'Selection needs review'} />}
                  <Typography>{selectedDetail.check[textIndex]}</Typography>
                  {selectedDetail.source && <Link href={selectedDetail.source} {...external}>{locale==='el'?'Φύλλο δεδομένων / αναφορά':'Datasheet / reference'}</Link>}
                </Stack>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions><Button onClick={()=>setSelectedPart(null)}>{locale==='el'?'Κλείσιμο':'Close'}</Button></DialogActions>
        </>}
      </Dialog>
      <Footer />
    </Box>
  </PageContainer>;
}
