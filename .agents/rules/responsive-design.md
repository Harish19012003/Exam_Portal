# Rule: Universal Responsive Design for All Devices

All UI features, pages, modals, tables, and components created or modified must be responsive across all screen sizes and devices (mobile, tablet, laptop, desktop):

1. **Breakpoints to Support**:
   - Mobile: 320px – 640px
   - Tablet: 641px – 1024px
   - Desktop / Laptop: 1025px+

2. **Layout Rules**:
   - Never allow horizontal overflow on the body.
   - Use CSS Grid and Flexbox with `flex-wrap: wrap`.
   - Modals must be responsive (`max-width: 92vw`, `max-height: 90vh`, `overflow-y: auto`).
   - Tables must have horizontal scroll wrappers (`overflow-x: auto`) or adapt gracefully.
   - Form controls and buttons must expand to full-width or stack cleanly on mobile (`@media (max-width: 768px)` and `@media (max-width: 480px)`).
   - Ensure touch-friendly tap targets of at least 44px on mobile devices.
