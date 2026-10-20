# Zeest interface designs

Current simplified design sources. Open any code.html locally; shared styles.css and preview.js must stay beside the screen folders. Screens use a white/teal prototype style inspired by the supplied SynapSure and ImageSense GUI examples.

These are static design previews, not a built application. Navigation links and tabs demonstrate layout only. Account creation, login, recording, saving, analysis, approval and evaluation are not performed. Clinical content, results and audit events are not fabricated. The single patient/encounter references are design placeholders.

| Screen folder | Use cases |
|---|---|
| zeest_sign_up | UC01 |
| zeest_log_in | UC02, UC21 |
| zeest_my_patients | UC03, UC21 |
| zeest_patient_details | UC04, UC05, UC06 |
| zeest_consultation | UC07, UC08 |
| zeest_clinical_inputs_and_findings | UC09, UC10, UC11, UC12 |
| zeest_clinical_review | UC13, UC14, UC15 |
| zeest_clinical_review_edit_mode | UC16 |
| zeest_clinical_review_approve_dialog | UC17 |
| zeest_clinical_review_reject_dialog | UC18 |
| zeest_patient_records | UC19, UC20 |

Login was missing from the imported export and has been supplied. Clinical Inputs, Clinical Review and Patient Records use simple tabs. The exported screens include tab variants for all use cases. Prior DESIGN.md describes the original generated theme and is superseded by this file.

Visual refinement: authentication pages use a small schematic medical-record illustration. Other pages use task icons, pictograms on tabs, an upload symbol and symbolic empty-state visuals. These are local SVG drawings, with no invented clinical images, charts or findings.

Authentication background: assets/medical-background.png is a generated decorative healthcare illustration, created with the built-in image-generation tool. Prompt: a calm teal/off-white physician-at-a-consultation-desk illustration, right-weighted composition, blank screen, no text, logos, clinical findings or futuristic motifs. Sign Up/Login place readable white forms on the left over this background. It is decorative artwork, not a clinical screenshot.
