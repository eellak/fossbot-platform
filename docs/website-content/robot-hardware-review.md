# Robot page preview and hardware review

Local branch: `codex/robot-hardware-page`. Preview: http://localhost:3000/robot.
The page uses one shared layout/data structure for English and Greek. It is a
local React prototype, not a saved CMS entry. Nothing has been pushed or deployed.

## Sources inspected on 2026-10-28

- Parts spreadsheet, tab Φύλλο2, A1:AA100: https://docs.google.com/spreadsheets/d/17augG_ocdJ3oCD5DHhEigZHE9VfZIl3xvNlTa7Q-LeQ/edit?gid=1968737650#gid=1968737650
  Only names and quantities were copied; inventory and supplier-order columns
  were excluded. The original spreadsheet was not modified.
- Images/STL filenames/production ZIP links: chronis10/fossbot-hardware,
  branch fossbot-v2, commit 15bbd43413e2175997b116ff1632fdd07e0480fa.
  Local PNG copies are in public/landing-media/robot-v2.
- Current local KiCad schematic AND PCB files in /home/chronis10/fossbot-pcb,
  branch dev_compact, commit 0cdc9e9. Both main and battery files were read.
  KiCad 9.0.9 netlist export and pcbnew footprint inspection confirmed the
  resistor values, references, DNP flags, ADCs and transistor footprint agree.
  No files in that repository were changed.
- The existing main-board CSV is stale; it lists Q1 AO3400A and older resistor
  values, while the current schematic/PCB contain Q2 NPN in TO-92.

## Confirmed corrections to the preview

| Component | Spreadsheet | Current schematic AND PCB |
| --- | --- | --- |
| MCP3008 | 2 | U7/U8, 2 × DIP-16, 10-bit, 8-channel SPI ADC |
| 1 kΩ | 4 | 3: R4, R9, R12 |
| 3 kΩ | 2 | 1: R2 |
| 3.3 kΩ | absent | 1: R13 |
| 10 kΩ | 5 | 5: R3, R8, R14, R15, R17 |
| 270 Ω | 3 + 2 | 3 fitted: R5–R7; R10/R11 are DNP, 2 not fitted |
| 100 Ω | 1 | absent; R9 is 1 kΩ |
| 330 Ω | 1 | 1: R1 |
| 100 kΩ | absent | 1: R16 |
| NPN transistor | 2N2222A, 1 | Q2, generic NPN, TO-92; exact model unconfirmed |
| Diodes | FR207, 3 | D5–D7, generic D, DO-35, 7.62 mm pitch; owner confirms FR207 |
| 2-pin JST XH | 5 | 6 total: main J5/J27/J28/J29/J30 plus battery J1 |
| Motor driver | 474-ROB-14450 | U1, SparkFun ROB-14450, TB6612FNG module |

The current standard fitted resistor set totals 15 resistors. DNP R10/R11 add
2 only if deliberately populated for a reviewed alternative configuration.

## Exact descriptions and unresolved selections

- MCP3008 is **10-bit**, not 12-bit. The symbol's stale `ki_keywords` says
  "12bit", but its value/description and Microchip agree on 10-bit.
  https://www.microchip.com/en-us/product/MCP3008
- Q2 drives the buzzer as a low-side NPN, with pad 1 collector, pad 2 base,
  pad 3 emitter. Do not approve every "2N2222A" variant from that name alone.
  onsemi P2N2222A has that pin numbering, but this is a candidate, not a
  verified fitted part or a completed electrical substitution review.
  https://www.onsemi.com/pdf/datasheet/p2n2222a-d.pdf
- AO3400A in the old CSV is a SOT-23 N-channel MOSFET and belongs to a
  different design iteration; it is not the current Q2 footprint/type.
  https://www.aosmd.com/products/mosfets/low-voltage-mosfets-12v-30v/ao3400a
- D5/D6 are in the input power paths; D7 is across the buzzer. The project owner explicitly confirmed FR207 on 2026-10-28; the preview
  therefore lists FR207 ×3. This confirmation establishes the intended part,
  not a completed package/footprint or electrical validation. KiCad still
  uses generic D values and DO-35 footprints; check the actual selected
  manufacturer package against these footprints before assembly.
- Resistor supplier fields repeat C58595 and, across different values,
  MFR0W4F2201A50. Treat these fields as copied/stale metadata, not an approved
  purchase list. This review uses the resistor Value fields and board matches.
- The battery board contains 3 cell-holder footprints, one BMS module footprint
  and one 2-pin connector. It does not establish the cell capacity/brand or
  BMS current rating. Those page entries remain sourced from the spreadsheet.
- Main PCB has three rail-indicator LEDs D2/D3/D4 (3.3/5/12 V), not four
  individually identified colour LEDs. Spreadsheet's four colour rows need
  clarification before turning the complete list into a manufacturing BOM.
- Connector footprint differences also remain: J2 is a straight 1×3 socket,
  SCR1 is 1×4, J22 is 1×8, P2 is 1×12. The spreadsheet's 1×8 ×3, 1×6 ×2 and
  right-angle 1×3 entries are not a fully reconciled board socket list.
- This is a parts-description review, not a complete electrical/DRC/assembly
  validation. Other modules, fasteners and cable quantities remain the user's
  spreadsheet references.
- The hardware repository production ZIPs have NOT been proven equivalent to
  the local dev_compact revision. The preview labels this version limitation.
  Do not order a board from those ZIPs assuming it matches this reviewed BOM.

## Later CMS integration

After design approval, model the parts/gallery/PCB sections as shared CMS
structure with per-language text. The prototype deliberately does not write
production content or migrate the database during a local visual review.

## Images and ordering descriptions

Every entry has bilingual technical text and an expandable ordering panel.
All catalog photographs now come from the embedded images in the supplied
spreadsheet, tab Φύλλο2. The earlier vendor photos and SVG illustrations were
removed at the user's request.

The read-only XLSX export preserved 46 original PNG images. Their bytes were
extracted without image editing. Drawing positions were mapped to part rows
using row heights and EMU offsets, then visually checked against the part names.
The two regulators share the same image in the sheet. One resistor photo spans
rows 24–30; this is explicitly labelled as an example for each resistor value,
including the KiCad-added 100 kΩ entry. The sheet's own photos remain reference
images, not proof that a pictured package or colour is the approved selection.
Photo-source links point back to the supplied sheet.

Assets: `front-end/public/landing-media/robot-v2/sheet-photos/`.
`source.json` records the spreadsheet, tab and row-to-image mapping.
The temporary XLSX export remains outside the repository; inventory/order
columns were not added to the page or committed.

Other technical references included in ordering panels:
- RECOM regulator input/output/package selection:
  https://recom-power.com/pdf/Innoline/R-78K-2.0.pdf
- JST XH pitch and series: https://www.jst-mfg.com/product/index.php?lang=2&series=277
- Raspberry Pi Zero 2 W: https://www.raspberrypi.com/products/raspberry-pi-zero-2-w/
- FR207 manufacturer example: https://www.smc-diodes.com/propdf/FR201-FR207%20N0445%20REV.A.pdf
  This identifies the reference FR207 as DO-15, while the current KiCad files
  use DO-35 footprints. The intended FR207 part is owner-confirmed, but the
  mechanical fit still needs checking for the selected manufacturer.

The page deliberately flags source gaps rather than inventing order codes,
resistor tolerances/power ratings, motor voltage/stall current, microSD capacity,
cable lengths, BMS identity or unspecified “power motor” details.

## Verification

- Production frontend build passed (pre-existing Blockly source-map and bundle
  size warnings).
- Data audit passed for all 54 entries: bilingual names, technical descriptions,
  ordering checks, visual definitions, image-file existence, and exactly one
  category per entry.
- Browser checked English/Greek switching, search, empty results, categories,
  pagination, and ordering details. Greek mobile at 390×844 had no horizontal
  overflow, including the FR207 details dialog; all loaded images were valid.
- Browser console had no errors during the final checks.

## Owner confirmation — 2026-10-29

The owner confirmed the transistor listing “100PCS 2N2222 2N2222A”. The bilingual preview now lists 2N2222 / 2N2222A, one per robot; 100PCS is the seller pack quantity. This supersedes the unresolved designation above, but does not identify a manufacturer or verify its physical pin order against Q2 (1=C, 2=B, 3=E). The owner also confirmed socket-mounted MCP chips: two through-hole MCP3008 DIP-16 chips, inserted into sockets soldered to the PCB.

## Resistor buying specification and FR207 fit — 2026-10-29

The bilingual catalog now recommends metal-film axial through-hole resistors,
±1% tolerance, rated at least 0.125 W, with a DIN0204 body approximately
3.6 × 1.6 mm and leads formed for 5.08 mm PCB hole spacing. These tolerance
and minimum-power requirements are recommendations, not validated original
CAD purchasing fields. Higher-rated parts may be used if the dimensions fit.
R10/R11 remain DNP. Reference: https://www.vishay.com/docs/28766/mbxsma.pdf

A fresh pcbnew inspection found D5/D6/D7 all use
D_DO-35_SOD27_P7.62mm_Horizontal, with 0.8 mm drills and 1.6 mm copper pads.
The SMC FR207 DO-15 datasheet gives body length 5.5–7.62 mm, body diameter
2.6–3.6 mm, and lead diameter 0.7–0.9 mm. Thus the current PCB does not
provide a guaranteed fit: maximum leads exceed the hole diameter, and a
maximum-length body leaves no room for ordinary horizontal lead bends.
The selected manufacturer's actual dimensions and surrounding clearance must
be reviewed and the footprint corrected before manufacturing a matching PCB.
No CAD or manufacturing files were changed. Reference:
https://www.smc-diodes.com/propdf/FR201-FR207%20N0445%20REV.A.pdf

## Catalog copy simplification — 2026-10-29

At the owner’s request, ordering dialogs now show concise bilingual part-identification specifications only. Removed the review badges, ordering-check section and datasheet/reference action, including their unused fields. Spreadsheet photos, quantities, PCB references and DNP indicators remain. The engineering findings above remain review notes; removing them from the public dialog does not establish electrical or mechanical compatibility.

## Display correction — 2026-10-29

Owner supplied https://grobotronics.com/oled-module-1.3-128x64-i2c-white.html as the correct display. Supplier technical data identifies 1.3-inch, 128×64 white OLED, I2C, SH1106 driver, 3.3–5 V DC, four pins (SKU 39-00013372). Both language entries now use those specs, superseding the earlier 0.96-inch/SSD1306 entry inferred from CAD. Original spreadsheet image retained. No robot firmware or CAD changes made.
