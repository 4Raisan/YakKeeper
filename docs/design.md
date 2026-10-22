# YakKeeper appearance

The interface keeps the project gallery, compact editor and two-column layout. This pass changes the visual system, theme preference, small-size identity and background movement. The original detailed yak artwork remains available; the website uses the approved horned YK circle with fine green texture and a matching 32-pixel PNG favicon.

## Research and decisions

These are established product/design-system references, not a ranking or a claim that everyone prefers the same dark theme.

| Reference | Relevant finding | YakKeeper decision |
| --- | --- | --- |
| [Linear UI redesign](https://linear.app/now/how-we-redesigned-the-linear-ui) | Hierarchy, density and contrast are considered together; light and dark modes need deliberate treatment. | Keep compact navigation, clearer cards, and separate light-mode colors rather than inverting dark mode. |
| [Vercel Geist colors](https://vercel.com/geist/colors) | Separate scales for backgrounds, component states, borders and text. | Page, card, raised and field surfaces get distinct semantic tokens. |
| [GitHub Primer primitives](https://primer.style/product/primitives/) | Theme-specific CSS variables and system-based mode selection. | A small theme token file; system preference on first visit, an explicit switch and a saved choice. |
| [Radix scale usage](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale) | Background, hover, border and text colors serve different jobs. | Muted text stays readable; borders and selected states have their own contrast levels. |
| [Discord appearance options](https://support.discord.com/hc/en-us/articles/207260127-How-to-Change-Discord-Color-Themes-and-Customize-Appearance-Settings) | Users can select theme modes, including a system-synced option. | Offer light and dark without making appearance part of account onboarding. |

## Palette

| Role | Dark | Light |
| --- | --- | --- |
| Page | `#08090b` | `#eaf1fb` |
| Card/dialog | `#121416` | `#ffffff` |
| Primary text | `#f5f6f7` | `#22314a` |
| Secondary text | `#bfc4cc` | `#51617a` |
| Action | `#2863b8` | `#235fb5` |
| Action text | `#ffffff` | `#ffffff` |
| Accent text | `#a7c9ff` | `#225aab` |
| Skill/help detail | `#a0d6c0` | `#1a735b` |

The black-and-white badge anchors the identity. Blue is the action color; mint is reserved for collaboration details and small identity accents. Status badges use tinted surfaces. Covers stay colorful in both modes.

## Motion and behavior

Sparse signals travel along SVG tracks over 16–20 seconds, with small surrounding rings and a short moving trail. No animation library, WebGL, video, mouse tracking, timers or network polling is added. The background cannot receive pointer events. Reduced-motion preference hides the moving signal group and retains static tracks.

The initial theme is applied before rendering content to avoid a flash. An explicit choice is saved locally, synchronized across tabs, and overrides later operating-system changes. When browser storage is unavailable, switching still works for the current page. Theme colors are independent of authentication and private project data.

## Validation

The six measured primary-text, secondary-text and action-text pairs pass 4.5:1 contrast in the current neutral black and blue palette. This is a palette check, not a claim of a full WCAG audit. Browser checks cover both modes, editor rendering, reload persistence, moving signals, and 390-pixel layout without horizontal page overflow. Reduced-motion behavior is defined in CSS; device-level preference emulation was unavailable in the browser tool.


The final selected logo is concept 19: concept 15's horned YK inside a black circle, with fine green speckles. White is opaque inside the mark so it remains readable on dark pages. Decorative texture naturally recedes at favicon sizes. Existing filenames are retained for README and GitHub assets; favicon URLs are versioned to refresh cached artwork. Generic repository covers use project initials instead of a repeated mascot.
