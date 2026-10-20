# Agent Rules & Guidelines

## 1. Universal Responsive Design (Mandatory for All Devices)

Whenever building, modifying, or styling any component, page, layout, modal, table, or form:
- **All Devices Supported**: Every UI element must adapt seamlessly across:
  - **Mobile**: 320px – 640px (smartphones)
  - **Tablet**: 641px – 1024px (iPads, tablets in portrait & landscape)
  - **Laptop & Desktop**: 1025px – 1440px
  - **Large Screens**: 1440px and above
- **No Overflow / Clipping**: Zero unwanted horizontal scrolling on the page body. Viewport boundaries must be strictly respected (`box-sizing: border-box`, `max-width: 100%`).
- **Flexible Layouts**:
  - Use modern CSS Grid with `repeat(auto-fit, minmax(...))` and Flexbox with `flex-wrap: wrap`.
  - Use fluid values (`clamp()`, `rem`, `%`) for fonts, padding, and spacing.
- **Mobile Touch Targets**: All interactive elements (buttons, toggles, icons, links, inputs) must maintain a minimum touch target of 44×44px on mobile devices.
- **Responsive Modals & Dialogs**:
  - Modals must be capped at `max-width: 92vw` and `max-height: 90vh`.
  - Content must scroll cleanly with `overflow-y: auto`.
- **Tables & Grids**:
  - Data tables must have responsive containers (`overflow-x: auto`) or adaptive card layouts so columns never clip or break layouts on small screens.
- **Media Queries Standards**:
  - Desktop-first or mobile-first with standard breakpoints:
    - `@media (max-width: 1024px)`: Tablet optimizations, collapsible sidebars.
    - `@media (max-width: 768px)`: Stacked forms, full-width buttons, compact padding.
    - `@media (max-width: 480px)`: Mobile single-column layouts, wrapped headers, touch-friendly UI.

---

## 2. Core Repository Constraints

- **Zero-Migration Database Policy**: **NEVER** run migration scripts (`migrate.js`, `pnpm run db:migrate`) autonomously. Always use existing database schema and non-destructive operations.
- **Design Excellence**: Adhere to clean typography, dark/light theme support, smooth micro-interactions, and accessible contrast ratios.
