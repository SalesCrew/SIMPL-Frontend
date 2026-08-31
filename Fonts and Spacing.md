# Fonts and Spacing

Living typography reference for SIMPL. Last audited: **2026-08-31**.
Keep measured facts, corrections, mappings and verification evidence together. Do not infer a font from a screenshot.

## Scope and decisions

- Reference: the user's signed-in Trello board in Chrome. No business records were changed.
- Apply the actual font family, role weights and letter spacing throughout SIMPL.
- Preserve SIMPL's existing font sizes, line heights, padding, gaps, colors, borders, corners, icons, artwork, animations and layout. Trello's sizes below are reference measurements, **not** the sizes applied to SIMPL.
- This preserves the existing hierarchy: SIMPL's hero remains 34px, not Trello's 16px board title. Copying all of Trello's dimensions would be a redesign, outside the requested typography-only change.
- Remove “ALLES AN EINEM ORT” and its dot, retaining their occupied vertical space. Keep the team-page eyebrow.
- Font widths naturally change with the requested typeface and tracking. The hero's element positions were explicitly protected and measured.
- Do not save private Trello card text, member names, attachment contents or credentials in this public repository.

## Measurement method

Chrome desktop on Windows; viewport **1536 × 639 CSS px**, device pixel ratio **1.25**, visual viewport scale **1**, CSS zoom **1**. Values below are CSS pixels, not rounded screenshot pixels. Physical glyph rasterization depends on OS, display scale and browser.

For each relevant UI role, read computed family, size, weight, style, line-height, letter-spacing, font-feature-settings and variation settings from the **actual text-bearing node**. Read box dimensions and padding separately; a box's height is not its font size.

Opened the board, populated card, description editor, comment composer, attachment section, member picker, label picker, move popover and nested listbox, and list-actions menu. Description editing was cancelled without typing or saving. Menus were closed without selecting changes. Reopened the card and member picker for a second pass.

### Font identification and loading

Measured stack, identical across sampled UI:

```css
"Atlassian Sans", ui-sans-serif, -apple-system, BlinkMacSystemFont,
"Segoe UI", Ubuntu, "Helvetica Neue", sans-serif
```

- Actual font source: **Atlassian Sans v4**, variable weight **100–900**, optical-size axis **14–32**; normal and true italic faces.
- Trello preloads the Latin face. Live font stylesheet: [atlassian-fonts.css v6](https://ds-cdn.prod-east.frontend.public.atl-paas.net/assets/font-rules/v6/atlassian-fonts.css).
- [Measured Latin font asset](https://ds-cdn.prod-east.frontend.public.atl-paas.net/assets/fonts/atlassian-sans/v4/AtlassianSans-latin.woff2).
- Font loading recheck: `document.fonts.status === "loaded"`, set size **27**, `document.fonts.check('14px "Atlassian Sans"') === true`.
- All sampled normal text: style normal, word-spacing 0px, font-feature-settings normal, font-variation-settings normal, font-kerning auto, font-optical-sizing auto. No extra tracking except popover titles.
- “Charlie Display” and “Charlie Text” exist as brand tokens but were **not** the UI font on inspected elements.
- Atlassian Mono is a code token, not a measured body font. SIMPL has no code editor; no unrelated monospace font was added.
- Atlassian identifies Sans as an Inter derivative; it is **not identical to stock Inter**. See [app typefaces](https://atlassian.design/foundations/typography/product-typefaces-and-scale). The real face preserves its customized glyphs.

### License and packaged files

The actual binary name table, not just the general design-system website, declares **SIL Open Font License 1.1**. Every one of the 14 downloaded font subsets was checked for that declaration.

Copyright metadata: “Portions Copyright 2025 Atlassian Pty Ltd. Copyright 2016 The Inter Project Authors”. Font metadata version: **40**; manufacturer: modifications by Atlassian, original by rsms.

Fonts are bundled **unmodified** under `public/fonts/atlassian-sans-v4/`, with copyright and full license in `OFL.txt`. Normal and italic subsets: Latin, Latin extended, Greek, Greek extended, Cyrillic, Cyrillic extended, Vietnamese. Total packaged bytes: **696,480**; unicode ranges mean browsers load only needed subsets. Latin is preloaded; all assets are same-origin.

Latin SHA-256:
`bc3232bfe6fa003ed8537db7f1a0bc8d399a3e9767ecdd73030b73a3b0842b72`

The broader [Atlassian Design System license](https://atlassian.design/license/) has different terms and explicitly recognizes separate open-source licenses. No Trello artwork, icons, application code or branding assets were copied.

## Trello typography register

All rows use the measured Atlassian Sans stack. “normal” tracking is intentional, not a guessed 0.1px adjustment.

| Text role / selector or accessible surface | Size | Weight | Line-height | Letter spacing | Recheck |
| --- | ---: | ---: | ---: | --- | --- |
| Body | 14px | 400 | 20px | normal | Board pass 2 |
| Global search input / `cross-product-search-input-skeleton` | 14px | 400 | 20px | normal | Search pass 2 |
| Search placeholder | 14px | 400 | normal pseudo value | normal | Pass 2 |
| Board title / `board-name-display` | 16px | 653 | 32px | normal | Reopened board/card |
| List title actual button / `list-name > button` | 14px | 600 | 20px | normal | Passes 2 and 3 |
| Card title link / `card-name` | 14px | 400 | 20px | normal | Passes 2 and 3 |
| Compact card label / `compact-card-label` | 12px | 500 | 16px | normal | Pass 2; collapsed chip |
| Add card / create / share buttons | 14px | 500 | 20px | normal | Board pass 2 |
| Card location/list trigger | 14px | 500 | 20px | normal | Card pass 2 |
| Card title actual textarea / `card-back-title-input` | 28px | 653 | 32px | normal | Reopened card |
| Sticky card title / `card-back-sticky-header h4` | 16px | 653 | 20px | normal | Recorded separately |
| Card “Labels” caption | 12px | 600 | 20px | normal | Card pass 2 |
| Expanded card label / `card-label` | 14px | 500 | 32px | normal | Distinct from compact label |
| Description heading | 14px | 653 | 20px | normal | Card pass 2 |
| Description body / `description-content-area p` | 14px | 400 | **23.996px** | normal | Reopened card |
| Description editor wrapper / `.ProseMirror` | 16px | 400 | 24px | normal | Wrapper, not paragraph |
| Description editor actual paragraph | 14px | 400 | **23.996px** | normal | Matches rendered body |
| Editor toolbar controls | 14px | 500 | 20px / 32px | normal | Depends on toolbar button |
| Attachments section heading | 14px | 653 | 20px | normal | Reopened card |
| Files subsection caption | 12px | 600 | 20px | normal | Recorded |
| Attachment filename / `attachment-thumbnail-name` | 14px | 600 | 20px | normal | Reopened card |
| Attachment date and metadata | 12px | 400 | 20px | normal | Recorded |
| Comments/activity heading | 14px | 653 | 20px | normal | Reopened card |
| Comment author text | 14px | 653 | 20px | normal | Actual author spans |
| Comment timestamp link | 12px | 400 | 20px | normal | Reopened card |
| Comment body / `comment-container p` | 14px | 400 | **23.996px** | normal | Reopened card |
| Inactive comment composer prompt | 14px | 400 | 20px | normal | Before editor opened |
| Active comment editor wrapper | 16px | 400 | 24px | normal | Do not map wrapper as text |
| Active comment editor paragraph / prompt | 14px | 400 | **23.996px** | normal | Matches description editor |
| “Details anzeigen” button | 14px | 500 | 20px | normal | Recorded |
| Member / label / move / list-actions popover title | 14px | 600 | 40px | **−0.042px** | Member picker reopened |
| Member / label search input | 14px | 400 | 20px | normal | Member picker reopened |
| Member / label group caption | 12px | 600 | 16px | normal | Member picker reopened |
| Member option button | 14px | 400 | 20px | normal | Member picker reopened |
| Member avatar initial fallback | 12px | 653 | 30px | normal | Avatar, not option text |
| Move tabs | 14px | 500 | 20px | normal | Recorded |
| Move subsection headings | 12px | 600 | 16px | normal | Recorded |
| Move field labels | 14px | **700** | 20px | normal | Explicit legacy exception |
| Move combobox input | 14px | 400 | 20px | normal | Opened nested listbox |
| Move listbox option + current hint | 14px | 400 | 20px | normal | Actual custom options |
| Move suggested destination / confirm buttons | 14px | 500 | 20px | normal | Recorded, never selected |
| List-actions menu items, including archive actions | 14px | 400 | 20px | normal | Inspected, never executed |
| List-actions automation subsection button | 12px | 600 | 20px | normal | Text-bearing button |

Scope limits: not every Trello product page, paid feature, notification state, tooltip, breakpoint or possible rich-text style was opened. This is a role-based audit of the board/card/form/menu surfaces relevant to SIMPL, not a claim that every element in all of Trello has been measured. Unknown future surfaces must be measured before adding entries.

## Trello spacing and geometry — reference only

These are observed control dimensions, not new SIMPL layout requirements. Widths are content-dependent; record a stable control height or padding instead of treating a task title's width as a token.

| Surface | Measured spacing / height |
| --- | --- |
| Board title | padding 0 12px; margin 0 0 12px; line box 32px |
| Actual list-title button | padding 6px 8px 6px 12px; height 32px |
| Board card title | bottom margin 4px; line box 20px |
| Compact label in collapsed mode | 40 × 8px box, despite declared 12px type / 16px line |
| Add-card button | padding 6px 12px 6px 8px; height 32px; column gap 6px |
| Create button | padding 6px 12px; height 32px; column gap 6px |
| Share button | padding 1px 12px 1px 8px; margin 0 4px; height 32px |
| Card location trigger | padding 2px 4px; gap 4px; height 24px |
| Card title textarea | padding 4px 8px; margin −4px −8px; single-line box 40px |
| Card label pill | padding 0 12px; height / line-height 32px |
| Labels caption | bottom margin 4px |
| Attachment and comments section headings | vertical padding 6px; total height 32px |
| Files caption | bottom margin 8px |
| Comment prompt button | padding 6px 12px; height 36px |
| Popover heading | padding 0 36px; line box 40px |
| Member / label search | padding 8px 12px; box height 36px |
| Member group caption | bottom margin 8px |
| Label group caption | margin 12px 0 8px |
| Member row | padding 4px 8px 4px 4px; box height 40px; avatar 30px |
| Move tabs | padding 6px 8px |
| Move options and list menu items | padding 6px 12px |
| Current move option wrapper | padding 0; do not confuse with sibling option padding |

Observed spacing tokens, with 16px reference rem:
`025=2px, 050=4px, 075=6px, 100=8px, 150=12px, 200=16px, 250=20px, 300=24px, 400=32px, 500=40px, 600=48px, 800=64px, 1000=80px`.
Negative counterparts also exist. They were **not** applied to SIMPL's containers.

Observed typography tokens: body 14/20 regular, small 12/16 regular, large 16/24 regular. Heading sizes/lines: 12/16, 14/20, 16/20, 20/24, 24/28, 28/32, 32/36, weight 653. Component overrides in the register take precedence over tokens.

## Corrections log

1. List H2 wrapper initially measured 20px/653/24px. Its actual text is a nested button: **14px/600/20px**. The wrapper is not the text's typography.
2. Description and comment editor wrappers measure 16px/24px, while their actual paragraphs are **14px/23.996px**. Do not normalize 23.996 to 24 when documenting evidence.
3. Compact labels are not the same as full card labels: collapsed box 8px high versus full 32px pill. Do not infer type size from the chip rectangle.
4. General headings use 653, **not** a rounded 650 or 700. Move-form labels are a separately observed 700 exception.
5. Popover titles are not normal tracking: −0.042px at 14px, equivalent to **−0.003em**. The same em tracking is used at SIMPL's preserved caption sizes.
6. An early `Array.from(document.fonts)` result was empty because browser automation did not support FontFaceSet iteration. It was **not evidence of a fallback font**. Supported status/size/check properties plus the live font-face rules and binary metadata were used instead.
7. The general design-system license was not taken as the font license. All 14 actual binary metadata records explicitly declare OFL 1.1.
8. SIMPL's current title field uses `.card-text-field.is-title input`, not only the older `.card-title-field input`. Both selectors are covered; current DOM was rechecked.

## Applied SIMPL typography map

Shared definitions: `src/fonts.css`. Existing selectors: `src/styles.css` and `src/card-editing.css`. No new runtime dependency.

| SIMPL role | Applied font treatment | Preserved sizing |
| --- | --- | --- |
| All UI, including login, admin, notifications, attachments, empty states and native hidden form fallbacks | Actual Atlassian Sans stack; regular 400; normal tracking | Existing per-component sizes and line heights |
| Hero / dialog / general headings | 653; normal tracking | Hero 34px / 1.3, dialog 19px |
| Cluster headings | 600; normal tracking | Existing 11px (responsive overrides unchanged) |
| Board card titles and excerpts | 400; normal tracking | Title 12px / 1.6; excerpt 10px / 1.8 |
| Form labels / captions | 600; description section label 653 | Existing label sizes |
| Form values / description | 400; normal tracking | 13px; existing line heights |
| Current card-title input | 653; normal tracking | Existing input size 13px |
| Custom select values and options | 400; normal tracking | Field 13px, options 12px |
| Popover titles / select captions / filter heading | 600; −0.003em | Existing 9/10/12/16px role sizes |
| Comment heading and authors | 653 | Heading 12px; author 11px |
| Comment body, timestamp and composer | 400; normal tracking | Body 12px / 1.8; timestamp 9px; composer 12px / 20px |
| Labels and ordinary action buttons | 500; normal tracking | Existing sizes |
| Attachment names | 600; normal tracking | Existing sizes |
| Login emphasis | Actual italic Atlassian Sans, replacing Georgia | Existing responsive sizes and line heights |
| Brand text wordmark | Same actual typeface, bold 653 | Existing size; icon artwork unchanged |
| Save/undo feedback emphasis | Shared weight tokens instead of ad-hoc numeric weights | Existing sizes/layout |

Legacy numeric weight mapping: 450→400, 550→500, 650→600; old 700/750/800 heading emphasis→653. Role-specific overrides handle card titles, form values, section labels and custom menu text. Broad mappings do not imply every Trello component uses the same weight.

Four responsive `font-size: 0` rules remain intact for icon-only controls. Existing focus strokes, rounded corners, clipping, hero image layers, scrollbars, comment viewport behavior and animations are untouched.

## Hero geometry verification

Baseline frontend commit: `c4bc22553ea90b43ba1fcd43e1290516fad6228c`.
At 1536 × 639 / DPR 1.25, on the isolated demo board, before versus after:

| Element | Before x / y / height | After x / y / height |
| --- | --- | --- |
| Hero section | 216 / 78 / 159 | 216 / 78 / 159 |
| Removed eyebrow's occupied line | 254 / 116 / 10.4 | 254 / 116 / 10.4 empty spacer |
| Hero title | 254 / 137.4 / 44.2 | 254 / 137.4 / 44.2 |
| Subtitle | 254 / 190.6 / 14.4 | 254 / 190.6 / 14.4 |
| Contributor group | 1365 / 123.4 / 74.2 | 1365 / 123.4 / 74.2 |
| Avatar row | 1365 / 143.4 / 33 | 1365 / 143.4 / 33 |
| Filter toolbar | 216 / 237 / 56.6 | 216 / 237 / 56.6 |

Implementation: empty `aria-hidden` spacer 10.4px high + existing 11px bottom margin. Original subtitle line box fixed at 14.4px and contributor caption at 11.2px to prevent font metrics shifting the hero. Mobile subtitle's existing line-height override remains in place.

## Verification / release record

- Chrome: loaded Atlassian Sans confirmed in SIMPL; card dialog, description, comments, composer and custom member dropdown inspected.
- Hero title/subtitle/avatars/filter toolbar positions: unchanged, as above.
- Custom option text: no horizontal clipping in the sampled member menu.
- Responsive visual check: 390px and 820px same-origin preview frames in Chrome; board, hero and controls remain readable. Frame DOM metrics were not exposed by the automation API, so this is a visual check, not a claimed mobile pixel-coordinate comparison.
- Card comment composer stays in the visible modal viewport; no layout behavior changed.
- Tests: **156 passing**, including four typography/asset/geometry regression tests.
- Production build: **passed** (TypeScript and Vite).
- CSS AST comparison against the baseline: all non-typographic declarations unchanged, excluding the intentional empty eyebrow spacer.
- Live deployment: record completion below after publishing.
- No backend, database, authentication, access rules or business data changed for this typography update.

## Maintenance checklist

When typography changes:
1. Open the actual reference in Chrome at a recorded viewport/scale.
2. Measure text-bearing nodes and loaded font availability; inspect normal, active and menu states.
3. Repeat a sample after close/reopen. Record corrections, not just final guesses.
4. Keep reference dimensions distinct from the SIMPL values actually applied.
5. For font updates, verify binary license metadata, copyright, version, unicode ranges and SHA-256; retain the license.
6. Compare hero geometry and long German text wrapping. Never restore the removed eyebrow or collapse its spacer.
7. Run tests/build, verify the public deployment and append the date/commit/result here.
