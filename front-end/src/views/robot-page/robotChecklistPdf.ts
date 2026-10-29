import type { jsPDF } from 'jspdf';
import bom from 'src/website/robotBom.json';
import { greekPartNames } from './robotContent';
import { partDetails } from './partDetails';

type Locale = 'en' | 'el';
type LoadAsset = (path: string) => Promise<Uint8Array>;
const fetchAsset: LoadAsset = async path => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Unable to load checklist asset: ${path}`);
  return new Uint8Array(await response.arrayBuffer());
};
const clean = (text: string) => text.replace(/[–—−]/g, '-').replace(/[“”]/g, '"').replace(/[’]/g, "'");
const binary = (bytes: Uint8Array) => {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...Array.from(bytes.subarray(i, i + 8192)));
  return result;
};

/** Always export the complete catalog, regardless of on-screen search or pagination. */
export async function createRobotChecklistPdf(locale: Locale, loadAsset: LoadAsset = fetchAsset): Promise<jsPDF> {
  const [{ jsPDF }, font, pictures] = await Promise.all([
    import('jspdf'),
    loadAsset('/fonts/DejaVuSans.ttf'),
    Promise.all(bom.map(async part => ({ id: part.id, bytes: await loadAsset(partDetails[part.id].photo!) }))),
  ]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  pdf.addFileToVFS('DejaVuSans.ttf', btoa(binary(font)));
  pdf.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
  pdf.setFont('DejaVuSans');
  const el = locale === 'el';
  const c = el ? {
    title: 'FOSSBot - Λίστα εξαρτημάτων', subtitle: 'Για ένα ρομπότ · Έλεγχος παραγγελίας και παραλαβής',
    photo: 'Εικόνα', part: 'Εξάρτημα', qty: 'Ποσ.', check: 'Έλεγχος', notes: 'Σημειώσεις',
    dnp: 'DNP - δεν τοποθετείται', page: 'Σελίδα',
  } : {
    title: 'FOSSBot - Parts checklist', subtitle: 'For one robot · Track ordering and delivery',
    photo: 'Image', part: 'Component', qty: 'Qty', check: 'Check', notes: 'Notes',
    dnp: 'DNP - not fitted', page: 'Page',
  };
  pdf.setProperties({ title: c.title, subject: c.subtitle, creator: 'FOSSBot' });
  const perPage = 6, pageCount = Math.ceil(bom.length / perPage);
  const imageById = new Map(pictures.map(p => [p.id, p.bytes]));
  const lines = (text: string, width: number, limit: number): string[] => {
    const wrapped: string[] = pdf.splitTextToSize(clean(text), width);
    return wrapped.length > limit ? [...wrapped.slice(0, limit - 1), wrapped[limit - 1].replace(/\s+\S*$/, '') + '...'] : wrapped;
  };
  for (let page = 0; page < pageCount; page++) {
    if (page) pdf.addPage();
    pdf.setTextColor(34, 71, 163); pdf.setFontSize(16); pdf.text(c.title, 12, 18);
    pdf.setTextColor(65, 75, 90); pdf.setFontSize(9); pdf.text(c.subtitle, 12, 25);
    pdf.setDrawColor(200, 207, 216); pdf.setLineWidth(0.2);
    pdf.setFillColor(238, 242, 248); pdf.rect(12, 33, 186, 10, 'F');
    pdf.setFontSize(8);
    [[c.photo, 14], [c.part, 37], [c.qty, 131], [c.check, 144], [c.notes, 163]].forEach(([label, x]) => pdf.text(String(label), Number(x), 39));
    bom.slice(page * perPage, (page + 1) * perPage).forEach((part, index) => {
      const y = 43 + index * 38;
      const optional = 'optional' in part && part.optional;
      if (optional) { pdf.setFillColor(247, 247, 247); pdf.rect(12, y, 186, 38, 'F'); }
      pdf.setDrawColor(210, 215, 223); pdf.line(12, y + 38, 198, y + 38);
      const photo = imageById.get(part.id)!;
      const props = pdf.getImageProperties(photo);
      const scale = Math.min(20 / props.width, 27 / props.height);
      const width = props.width * scale, height = props.height * scale;
      pdf.addImage(photo, 'PNG', 13 + (20 - width) / 2, y + (38 - height) / 2, width, height);
      pdf.setTextColor(25, 35, 48); pdf.setFontSize(9);
      const name = el ? greekPartNames[part.id] || part.name : part.name;
      const titleLines = lines(name, 88, 3);
      pdf.text(titleLines, 37, y + 6, { lineHeightFactor: 1.15 });
      let textY = y + 7 + titleLines.length * 3.65;
      pdf.setFontSize(7.5); pdf.setTextColor(65, 75, 90);
      if ('refs' in part && part.refs) { pdf.text(part.refs, 37, textY); textY += 3.5; }
      const description = optional ? c.dnp : partDetails[part.id].specs[el ? 1 : 0];
      pdf.text(lines(description, 88, 5), 37, textY, { lineHeightFactor: 1.15 });
      pdf.setFontSize(9); pdf.setTextColor(25, 35, 48);
      pdf.text(optional ? '-' : String(part.quantity), 134, y + 8, { align: 'center' });
      if (!optional) pdf.rect(148, y + 4, 4.5, 4.5);
      [12, 23, 34].forEach(offset => pdf.line(162, y + offset, 196, y + offset));
    });
    pdf.setFontSize(8); pdf.setTextColor(65, 75, 90);
    pdf.text('fossbot.gr', 12, 287);
    pdf.text(`${c.page} ${page + 1} / ${pageCount}`, 198, 287, { align: 'right' });
  }
  return pdf;
}
