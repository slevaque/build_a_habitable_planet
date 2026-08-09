# Build a Habitable Planet — Final Release

## What This Tool Is

**Build a Habitable Planet** is an offline interactive planetary-science laboratory for high school students. Students construct a rocky planet, observe the model's physical and climate responses, investigate environmental compatibility for six forms of life, save experiments, compare snapshots, preserve discoveries, and write a Planetary Habitability Report using evidence they selected.

The model supports scientific reasoning rather than declaring a winning planet. It does not calculate a habitability score, probability of life, grade, rank, or automatic named planetary classification.

## How to Open It

1. Keep this entire `09_Final` folder together. The `js/` files and `styles.css` are required by the application.
2. Open `index.html` in a current version of Chrome, Edge, Firefox, or Safari. Double-clicking the file works; no installation, internet connection, server, account, or runtime dependency is required.
3. If a school device blocks local HTML files, place the unchanged folder on any ordinary static web host. No server-side code is needed.

## Student Learning Flow

1. **Build:** choose a star, orbit, planet mass, atmosphere, surface water, geology, and magnetic field. Every committed change produces model evidence and a cause-and-effect explanation.
2. **Dashboard:** examine Energy Balance, Water, Atmosphere, Protection, and Environmental Stability evidence.
3. **Life Lab:** ask how the same physical Planet State affects six life categories. Compatible means environmentally compatible, not inhabited.
4. **Snapshots and Discoveries:** save intentional experiments, compare two immutable snapshots, distinguish controlled from confounded comparisons, and explicitly save useful discoveries.
5. **Report:** select one saved snapshot as the final report subject, choose supporting evidence, add experiments/comparison/discoveries, write scientific reasoning and a final conclusion, preview the report, and print or save it as a PDF.

## Accessibility

- Native keyboard-operable buttons, links, checkboxes, selects, text fields, disclosure controls, and confirmation dialogs
- Skip links, visible keyboard focus, logical headings, fieldsets, legends, and explicit labels
- Keyboard directions within the laboratory and report editor
- Text labels for statuses, directions, preliminary evidence, and warnings; meaning never depends on color alone
- Screen-reader-readable evidence, causal chains, report structure, live status messages, and textual planet descriptions
- Responsive layouts for smaller screens
- Reduced-motion support through the operating-system/browser preference
- Forced-color support and a grayscale-readable print layout

Keyboard users can press `Tab` and `Shift+Tab` to move between controls, `Space` or `Enter` to activate buttons and checkboxes, and arrow keys to change native select/range controls. Slider values can also be adjusted with arrow keys.

## Model Limitations

- Climate values are global means; the model does not resolve local weather, seasons, or microclimates.
- Clouds, atmospheric heat transport, greenhouse behavior, and pressure-dependent water physics are simplified for education.
- Detailed atmospheric chemistry, ocean chemistry, and subsurface habitats are outside the model.
- Protection, radiation, atmospheric retention, and Environmental Stability are preliminary, non-scoring evidence.
- Life Lab interprets environmental compatibility; it does not detect life or calculate a probability that life exists.
- Ecosystems, evolution, intelligence, and terraforming are not simulated.

These limitations also appear in every populated final report.

## Saved Work and Persistence

Snapshots, Discovery Log entries, and report selections/writing are saved in the current browser's local storage on the current device and normally survive refresh or reopening. They do not synchronize between browsers or devices.

- **Reset Current Planet** resets only the active planet; it does not erase snapshots, discoveries, or report writing.
- Snapshot and Discovery Log deletion use separate confirmations.
- Deleting referenced evidence does not silently erase report writing. The report identifies the missing reference so the student can replace it deliberately.
- **Clear Report Draft** clears only report selections and student writing after confirmation.
- If browser storage is blocked, the interface reports that work is session-only and will be lost when the page closes.

For shared devices, students should use the relevant clear controls when their work is complete.

## Print or Save the Report as PDF

1. Open **Report**.
2. Select a saved snapshot as the final planet.
3. Select evidence and write the required Final Conclusion in the student's own words.
4. Choose **Preview Report**.
5. Choose **Print / Save as PDF**.
6. In the browser print dialog, select a printer or **Save as PDF** and confirm the destination.

The print layout automatically removes laboratory navigation and editing controls, uses a light background with dark text, and keeps model evidence distinct from student-authored reasoning.

## Included Files

- `index.html` — application entry point
- `styles.css` — screen, responsive, accessibility, and print styles
- `js/` — validated inputs, accepted science/model modules, Planet State, Life Lab, snapshots/comparison/discoveries, report model, persistence, and interface code
- `tests/` — offline deterministic Phase 1–4 regression harnesses
- `README.md` — this release guide

The release has no external fonts, images, scripts, stylesheets, packages, analytics, accounts, or network integrations.

## Copyright and Use

Copyright © 2026 Susan Frances Levaque. All rights reserved.

**Build a Habitable Planet** was designed and developed by Susan Frances Levaque with AI-assisted development.

This repository is publicly available for demonstration, educational evaluation, and portfolio purposes. Public availability does not place the project in the public domain or grant an open-source license. Reproduction, redistribution, republication, commercial use, or distribution of modified versions of this project or substantial portions of it requires prior written permission, except where otherwise permitted by law.

For complete copyright, attribution, AI-assistance, and permitted-use information, see [`RIGHTS.md`](RIGHTS.md).
