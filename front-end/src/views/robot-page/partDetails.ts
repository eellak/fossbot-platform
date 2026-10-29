import sheetPhotos from './sheetPhotos.json';
export type PartVisual = 'regulator'|'driver'|'chip'|'ldr'|'buzzer'|'led'|'rgb'|'microphone'|'imu'|'level'|'socket'|'switch'|'jst'|'resistor'|'button'|'transistor'|'diode'|'display'|'motor'|'ir'|'encoder'|'interrupter'|'pi'|'sd'|'holder'|'bms'|'cell'|'caster'|'bolt'|'pcb'|'wheel'|'jack'|'cable';
export type PartDetail = {
  kind: PartVisual; photo?: string; photoSource?: string; photoFromSheet?: boolean; photoIsExample?: boolean;
  specs: [string, string];
};
const details: Record<number, PartDetail> = {
  6: { kind: 'regulator', specs: ["RECOM R-78K5.0-2.0 DC/DC regulator, 5 V output, up to 2 A; 6.5–36 V input. SIP3 through-hole package with straight pins, 11.5 × 8.5 × 17.5 mm.","Σταθεροποιητής DC/DC RECOM R-78K5.0-2.0, έξοδος 5 V έως 2 A, είσοδος 6,5–36 V. Διαμπερές SIP3 με ίσιους ακροδέκτες, 11,5 × 8,5 × 17,5 mm."] },
  7: { kind: 'regulator', specs: ["RECOM R-78K3.3-2.0 DC/DC regulator, 3.3 V output, up to 2 A; 4.5–36 V input. SIP3 through-hole package with straight pins.","Σταθεροποιητής DC/DC RECOM R-78K3.3-2.0, έξοδος 3,3 V έως 2 A, είσοδος 4,5–36 V. Διαμπερές SIP3 με ίσιους ακροδέκτες."] },
  8: { kind: 'driver', specs: ["SparkFun ROB-14450 TB6612FNG dual DC motor driver module with headers. Average current 1.2 A per channel; logic supply 2.7–5.5 V.","Μονάδα οδηγού δύο κινητήρων DC SparkFun ROB-14450 με TB6612FNG και ακίδες σύνδεσης. Μέσο ρεύμα 1,2 A ανά κανάλι· λογική τροφοδοσία 2,7–5,5 V."] },
  9: { kind: 'chip', specs: ["MCP3008-I/P, 10-bit, 8-channel SPI analogue-to-digital converter. Through-hole PDIP-16, 7.62 mm row spacing; plugs into a DIP-16 socket soldered to the PCB.","MCP3008-I/P, μετατροπέας αναλογικού σε ψηφιακό 10 bit, 8 καναλιών SPI. Διαμπερές PDIP-16, απόσταση σειρών 7,62 mm· τοποθετείται σε βάση DIP-16 κολλημένη στην πλακέτα."] },
  10: { kind: 'ldr', specs: ["GL5516 light-dependent resistor (LDR), 5 mm sensor head, two through-hole leads.","Φωτοαντίσταση GL5516 (LDR), κεφαλή 5 mm, δύο διαμπερείς ακροδέκτες."] },
  11: { kind: 'buzzer', specs: ["12085 passive electromagnetic buzzer, 16 Ω, approximately 12 × 8.5 mm. PCB lead spacing 7.6 mm.","Παθητικός ηλεκτρομαγνητικός βομβητής 12085, 16 Ω, περίπου 12 × 8,5 mm. Απόσταση ακροδεκτών PCB 7,6 mm."] },
  12: { kind: 'rgb', specs: ["5 mm diffused RGB LED, common cathode, four through-hole leads. PCB pin order: 1 blue, 2 green, 3 common cathode, 4 red.","Διάχυτο RGB LED 5 mm, κοινής καθόδου, τέσσερις διαμπερείς ακροδέκτες. Σειρά PCB: 1 μπλε, 2 πράσινο, 3 κοινή κάθοδος, 4 κόκκινο."] },
  13: { kind: 'microphone', specs: ["MAX4466 electret microphone amplifier module with adjustable gain and analogue output. Connections: VCC, GND, OUT; 3.3 V supply.","Μονάδα μικροφώνου με ενισχυτή MAX4466, ρυθμιζόμενη ενίσχυση και αναλογική έξοδο. Συνδέσεις VCC, GND, OUT· τροφοδοσία 3,3 V."] },
  14: { kind: 'imu', specs: ["MPU-6050 module, 3-axis gyroscope and 3-axis accelerometer, I2C interface, eight-pin connection.","Μονάδα MPU-6050, γυροσκόπιο 3 αξόνων και επιταχυνσιόμετρο 3 αξόνων, διεπαφή I2C, σύνδεση 8 ακίδων."] },
  15: { kind: 'level', specs: ["Bidirectional logic-level converter module with HV, LV, GND and signal connections. PCB connector: 1×12 contacts, 2.54 mm pitch.","Μονάδα αμφίδρομης μετατροπής λογικών επιπέδων με HV, LV, GND και σήματα. Σύνδεσμος PCB: 1×12 επαφές, βήμα 2,54 mm."] },
  16: { kind: 'socket', specs: ["DIP-16 IC socket, through-hole, 2.54 mm pin pitch and 7.62 mm row spacing, for MCP3008-I/P.","Διαμπερής βάση ολοκληρωμένου DIP-16, βήμα ακίδων 2,54 mm και απόσταση σειρών 7,62 mm, για MCP3008-I/P."] },
  17: { kind: 'socket', specs: ["Female 1×8 pin socket strip, 2.54 mm pitch.","Θηλυκή βάση ακίδων 1×8, βήμα 2,54 mm."] },
  18: { kind: 'socket', specs: ["Female 1×6 pin socket strip, 2.54 mm pitch.","Θηλυκή βάση ακίδων 1×6, βήμα 2,54 mm."] },
  19: { kind: 'socket', specs: ["Right-angle female 1×3 pin socket, 2.54 mm pitch.","Γωνιακή θηλυκή βάση ακίδων 1×3, βήμα 2,54 mm."] },
  20: { kind: 'switch', specs: ["MFP 106 D slide switch, SPDT.","Συρόμενος διακόπτης MFP 106 D, SPDT."] },
  21: { kind: 'jst', specs: ["JST XH 2-pin male PCB header, 2.50 mm pitch, vertical through-hole, B2B-XH-A footprint.","Αρσενικός σύνδεσμος PCB JST XH 2 ακίδων, βήμα 2,50 mm, κατακόρυφος διαμπερής, αποτύπωμα B2B-XH-A."] },
  22: { kind: 'jst', specs: ["JST XH 4-pin male PCB header, 2.50 mm pitch, vertical through-hole, B4B-XH-A footprint.","Αρσενικός σύνδεσμος PCB JST XH 4 ακίδων, βήμα 2,50 mm, κατακόρυφος διαμπερής, αποτύπωμα B4B-XH-A."] },
  23: { kind: 'jst', specs: ["JST XH 3-pin male PCB header, 2.50 mm pitch, vertical through-hole, B3B-XH-A footprint.","Αρσενικός σύνδεσμος PCB JST XH 3 ακίδων, βήμα 2,50 mm, κατακόρυφος διαμπερής, αποτύπωμα B3B-XH-A."] },
  24: { kind: 'resistor', specs: ["1 kΩ metal-film axial through-hole resistor, ±1% tolerance, at least 0.125 W (⅛ W). DIN0204 body approximately 3.6 × 1.6 mm; PCB hole spacing 5.08 mm.","Αξονική διαμπερής αντίσταση μεταλλικού υμενίου 1 kΩ, ανοχή ±1%, τουλάχιστον 0,125 W (⅛ W). Σώμα DIN0204 περίπου 3,6 × 1,6 mm· απόσταση οπών PCB 5,08 mm."] },
  25: { kind: 'resistor', specs: ["3 kΩ metal-film axial through-hole resistor, ±1% tolerance, at least 0.125 W (⅛ W). DIN0204 body approximately 3.6 × 1.6 mm; PCB hole spacing 5.08 mm.","Αξονική διαμπερής αντίσταση μεταλλικού υμενίου 3 kΩ, ανοχή ±1%, τουλάχιστον 0,125 W (⅛ W). Σώμα DIN0204 περίπου 3,6 × 1,6 mm· απόσταση οπών PCB 5,08 mm."] },
  26: { kind: 'resistor', specs: ["10 kΩ metal-film axial through-hole resistor, ±1% tolerance, at least 0.125 W (⅛ W). DIN0204 body approximately 3.6 × 1.6 mm; PCB hole spacing 5.08 mm.","Αξονική διαμπερής αντίσταση μεταλλικού υμενίου 10 kΩ, ανοχή ±1%, τουλάχιστον 0,125 W (⅛ W). Σώμα DIN0204 περίπου 3,6 × 1,6 mm· απόσταση οπών PCB 5,08 mm."] },
  27: { kind: 'resistor', specs: ["270 Ω metal-film axial through-hole resistor, ±1% tolerance, at least 0.125 W (⅛ W). DIN0204 body approximately 3.6 × 1.6 mm; PCB hole spacing 5.08 mm.","Αξονική διαμπερής αντίσταση μεταλλικού υμενίου 270 Ω, ανοχή ±1%, τουλάχιστον 0,125 W (⅛ W). Σώμα DIN0204 περίπου 3,6 × 1,6 mm· απόσταση οπών PCB 5,08 mm."] },
  28: { kind: 'resistor', specs: ["3.3 kΩ metal-film axial through-hole resistor, ±1% tolerance, at least 0.125 W (⅛ W). DIN0204 body approximately 3.6 × 1.6 mm; PCB hole spacing 5.08 mm.","Αξονική διαμπερής αντίσταση μεταλλικού υμενίου 3.3 kΩ, ανοχή ±1%, τουλάχιστον 0,125 W (⅛ W). Σώμα DIN0204 περίπου 3,6 × 1,6 mm· απόσταση οπών PCB 5,08 mm."] },
  29: { kind: 'resistor', specs: ["270 Ω metal-film axial through-hole resistor, ±1% tolerance, at least 0.125 W (⅛ W). DIN0204 body approximately 3.6 × 1.6 mm; PCB hole spacing 5.08 mm.","Αξονική διαμπερής αντίσταση μεταλλικού υμενίου 270 Ω, ανοχή ±1%, τουλάχιστον 0,125 W (⅛ W). Σώμα DIN0204 περίπου 3,6 × 1,6 mm· απόσταση οπών PCB 5,08 mm."] },
  30: { kind: 'resistor', specs: ["330 Ω metal-film axial through-hole resistor, ±1% tolerance, at least 0.125 W (⅛ W). DIN0204 body approximately 3.6 × 1.6 mm; PCB hole spacing 5.08 mm.","Αξονική διαμπερής αντίσταση μεταλλικού υμενίου 330 Ω, ανοχή ±1%, τουλάχιστον 0,125 W (⅛ W). Σώμα DIN0204 περίπου 3,6 × 1,6 mm· απόσταση οπών PCB 5,08 mm."] },
  31: { kind: 'button', specs: ["Momentary normally-open tactile pushbutton, 6 × 6 mm body, 13 mm actuator height, four through-hole legs.","Στιγμιαίο πλήκτρο κανονικά ανοικτής επαφής, σώμα 6 × 6 mm, ύψος ενεργοποιητή 13 mm, τέσσερις διαμπερείς ακροδέκτες."] },
  32: { kind: 'transistor', specs: ["2N2222 / 2N2222A NPN bipolar transistor, TO-92 package. Required PCB pin order: 1 collector, 2 base, 3 emitter.","Διπολικό τρανζίστορ NPN 2N2222 / 2N2222A, περίβλημα TO-92. Απαιτούμενη σειρά PCB: 1 συλλέκτης, 2 βάση, 3 εκπομπός."] },
  33: { kind: 'diode', specs: ["FR207 fast-recovery rectifier diode, 2 A, 1000 V, axial DO-15 package. Reference body: 5.5–7.62 mm long, 2.6–3.6 mm diameter; leads 0.7–0.9 mm diameter.","Δίοδος ανορθωτή ταχείας αποκατάστασης FR207, 2 A, 1000 V, αξονικό περίβλημα DO-15. Σώμα αναφοράς: μήκος 5,5–7,62 mm, διάμετρος 2,6–3,6 mm· διάμετρος ακροδεκτών 0,7–0,9 mm."] },
  34: { kind: 'led', specs: ["5 mm diffused blue LED, two through-hole leads.","Διάχυτο μπλε LED 5 mm, δύο διαμπερείς ακροδέκτες."] },
  35: { kind: 'led', specs: ["5 mm diffused green LED, two through-hole leads.","Διάχυτο πράσινο LED 5 mm, δύο διαμπερείς ακροδέκτες."] },
  36: { kind: 'led', specs: ["5 mm diffused yellow LED, two through-hole leads.","Διάχυτο κίτρινο LED 5 mm, δύο διαμπερείς ακροδέκτες."] },
  37: { kind: 'led', specs: ["5 mm diffused red LED, two through-hole leads.","Διάχυτο κόκκινο LED 5 mm, δύο διαμπερείς ακροδέκτες."] },
  38: { kind: 'socket', specs: ["Female 2×20 GPIO socket, 40 contacts, 2.54 mm pitch, for the Raspberry Pi GPIO header.","Θηλυκή βάση GPIO 2×20, 40 επαφές, βήμα 2,54 mm, για τις ακίδες GPIO του Raspberry Pi."] },
  39: { kind: 'display', specs: ["SH1106 OLED display module, 1.3 inch, 128 × 64 pixels, monochrome white, I2C interface. Supply voltage 3.3–5 V DC; four-pin connection.","Μονάδα οθόνης OLED SH1106, 1,3 ίντσες, 128 × 64 pixel, μονόχρωμη λευκή, διεπαφή I2C. Τροφοδοσία 3,3–5 V DC· σύνδεση τεσσάρων ακίδων."] },
  40: { kind: 'motor', specs: ["TT-style DC geared motor, 120 RPM, metal dual shaft.","Κινητήρας DC τύπου TT με μειωτήρα, 120 RPM, μεταλλικός διπλός άξονας."] },
  41: { kind: 'ir', specs: ["Infrared reflective obstacle-sensor module. An analogue-output modification is required for connection to the MCP3008 ADC.","Μονάδα υπέρυθρου αισθητήρα ανάκλασης/εμποδίων. Απαιτείται μετατροπή αναλογικής εξόδου για σύνδεση στον μετατροπέα MCP3008."] },
  42: { kind: 'encoder', specs: ["Plastic slotted encoder disc, 24 mm diameter, for a motor shaft and optical interrupter.","Πλαστικός δίσκος κωδικοποιητή με σχισμές, διάμετρος 24 mm, για άξονα κινητήρα και φωτοδιακόπτη."] },
  43: { kind: 'interrupter', specs: ["Optical interrupter sensor for a slotted wheel-encoder disc.","Αισθητήρας φωτοδιακόπτη για δίσκο κωδικοποιητή τροχού με σχισμές."] },
  44: { kind: 'pi', specs: ["Raspberry Pi Zero 2 W, quad-core 64-bit Cortex-A53 at 1 GHz, 512 MB RAM, 65 × 30 mm board, 40-pin GPIO connection.","Raspberry Pi Zero 2 W, τετραπύρηνος Cortex-A53 64 bit στο 1 GHz, RAM 512 MB, πλακέτα 65 × 30 mm, σύνδεση GPIO 40 ακίδων."] },
  45: { kind: 'sd', specs: ["SanDisk microSD memory card for the Raspberry Pi.","Κάρτα μνήμης microSD SanDisk για Raspberry Pi."] },
  46: { kind: 'holder', specs: ["Single-cell 18650 through-hole PCB battery holder, MPD BH-18650-PC2 footprint.","Διαμπερής βάση PCB για ένα στοιχείο 18650, αποτύπωμα MPD BH-18650-PC2."] },
  47: { kind: 'bms', specs: ["3S 10 A Li-ion battery protection module (BMS), for three cells in series.","Μονάδα προστασίας μπαταρίας Li-ion (BMS) 3S 10 A, για τρία στοιχεία σε σειρά."] },
  48: { kind: 'cell', specs: ["INR18650-MH1 rechargeable Li-ion cell, 18650 format, nominal voltage 3.6 V, capacity 3200 mAh.","Επαναφορτιζόμενο στοιχείο Li-ion INR18650-MH1, τύπος 18650, ονομαστική τάση 3,6 V, χωρητικότητα 3200 mAh."] },
  49: { kind: 'caster', specs: ["Metal ball caster, 12 mm nominal ball diameter.","Μεταλλικός σφαιρικός τροχός στήριξης, ονομαστική διάμετρος σφαίρας 12 mm."] },
  50: { kind: 'bolt', specs: ["M3 bolts, 8 mm nominal length.","Βίδες M3, ονομαστικό μήκος 8 mm."] },
  51: { kind: 'pcb', specs: ["Bare battery-module PCB for three 18650 holders, a BMS module and a 2-pin XH connector.","Γυμνή πλακέτα μπαταρίας για τρεις βάσεις 18650, μονάδα BMS και διπολικό σύνδεσμο XH."] },
  52: { kind: 'pcb', specs: ["Bare FOSSBot v2 main PCB for Raspberry Pi, two MCP3008 ADCs, motor-driver module, sensors and display.","Γυμνή κεντρική πλακέτα FOSSBot v2 για Raspberry Pi, δύο MCP3008, μονάδα οδηγού κινητήρων, αισθητήρες και οθόνη."] },
  53: { kind: 'wheel', specs: ["Yellow rubber wheel for a TT motor shaft, 66 mm diameter × 26 mm width.","Κίτρινος ελαστικός τροχός για άξονα κινητήρα TT, διάμετρος 66 mm × πλάτος 26 mm."] },
  54: { kind: 'jack', specs: ["DC barrel power jack, 5.5 mm outer diameter, 2.1 mm inner diameter, plastic body.","Υποδοχή τροφοδοσίας DC barrel jack, εξωτερική διάμετρος 5,5 mm, εσωτερική 2,1 mm, πλαστικό σώμα."] },
  55: { kind: 'cable', specs: ["Three-wire sensor cable with a 3-pin JST connector at one end and female Dupont connectors at the other.","Καλώδιο αισθητήρα τριών αγωγών, με σύνδεσμο JST 3 ακίδων στο ένα άκρο και θηλυκούς συνδέσμους Dupont στο άλλο."] },
  56: { kind: 'cable', specs: ["Four-wire sensor cable with a 4-pin JST connector at one end and female Dupont connectors at the other.","Καλώδιο αισθητήρα τεσσάρων αγωγών, με σύνδεσμο JST 4 ακίδων στο ένα άκρο και θηλυκούς συνδέσμους Dupont στο άλλο."] },
  57: { kind: 'cable', specs: ["Two-wire battery cable with a female 2-pin JST connector at each end.","Καλώδιο μπαταρίας δύο αγωγών, με θηλυκό σύνδεσμο JST 2 ακίδων σε κάθε άκρο."] },
  58: { kind: 'cable', specs: ["Cable with a JST connector at one end and bare wire ends for soldering at the other. Three per robot: two for the motors and one for the power input.","Καλώδιο με σύνδεσμο JST στο ένα άκρο και γυμνά άκρα αγωγών για κόλληση στο άλλο. Τρία ανά ρομπότ: δύο για τους κινητήρες και ένα για την είσοδο τροφοδοσίας."] },
  59: { kind: 'resistor', specs: ["100 kΩ metal-film axial through-hole resistor, ±1% tolerance, at least 0.125 W (⅛ W). DIN0204 body approximately 3.6 × 1.6 mm; PCB hole spacing 5.08 mm.","Αξονική διαμπερής αντίσταση μεταλλικού υμενίου 100 kΩ, ανοχή ±1%, τουλάχιστον 0,125 W (⅛ W). Σώμα DIN0204 περίπου 3,6 × 1,6 mm· απόσταση οπών PCB 5,08 mm."] },
};

// Original embedded photographs from the parts spreadsheet.
Object.entries(sheetPhotos).forEach(([id, filename]) => {
  const detail = details[Number(id)];
  detail.photo = `/landing-media/robot-v2/sheet-photos/${filename}`;
  detail.photoSource = 'https://docs.google.com/spreadsheets/d/17augG_ocdJ3oCD5DHhEigZHE9VfZIl3xvNlTa7Q-LeQ/edit?gid=1968737650#gid=1968737650';
  detail.photoFromSheet = true;
  detail.photoIsExample = detail.kind === 'resistor';
});
export const partDetails = details;
