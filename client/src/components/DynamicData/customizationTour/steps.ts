import type { CustomizationTourHandlers } from './CustomizationTourContext';

export type TourStepPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface CustomizationTourStep {
  id: string;
  title: string;
  body: string;
  placement: TourStepPlacement;
  /** CSS selector scoped under `[data-tour-active-root]`. Omit for centered steps. */
  target?: string;
  onEnter?: (handlers: CustomizationTourHandlers) => void;
  onLeave?: (handlers: CustomizationTourHandlers) => void;
}

export const CUSTOMIZATION_TOUR_STEPS: CustomizationTourStep[] = [
  {
    id: 'welcome',
    placement: 'center',
    title: 'Customize your views',
    body: 'A quick tour of Feature Builder and Record Designer — turn capabilities on or off and control how each record looks, with no code.',
  },
  {
    id: 'feature-fab',
    placement: 'left',
    target: '[data-tour-id="feature-builder-fab"]',
    title: 'Feature Builder',
    body: 'Open this control to toggle search, export, filters, summary chips, and more. Shared features apply to every view that supports them.',
    onEnter: handlers => handlers.closeRecordDesign(),
  },
  {
    id: 'feature-panel',
    placement: 'left',
    target: '[data-tour-id="feature-builder-panel"]',
    title: 'Toggle features',
    body: 'Turn features ON or OFF with one click. Shared badges sync across views; use the gear icon to configure chips and quick filters.',
    onEnter: handlers => handlers.openFeatureBuilder(),
  },
  {
    id: 'design-button',
    placement: 'top',
    target: '[data-tour-id="record-design-button"]',
    title: 'Record Designer',
    body: 'Use the palette in the footer to design how each record appears in this view — layout, title, media, and visible fields.',
    onEnter: handlers => handlers.closeFeatureBuilder(),
  },
  {
    id: 'design-layout',
    placement: 'left',
    target: '[data-tour-id="record-design-layout"]',
    title: 'Pick a layout',
    body: 'Switch between comfortable, compact, gallery, or other layouts. Your choice is saved and restored on reload.',
    onEnter: handlers => handlers.openRecordDesign(),
  },
  {
    id: 'design-slots',
    placement: 'left',
    target: '[data-tour-id="record-design-slots"]',
    title: 'Assign fields',
    body: 'Map title, subtitle, badge, and status slots to columns. Drag extra fields to reorder what shows on each record.',
  },
  {
    id: 'done',
    placement: 'center',
    title: "You're all set!",
    body: 'Reopen this tour anytime from the help button next to the view switcher. Happy customizing!',
    onEnter: handlers => handlers.closeRecordDesign(),
  },
];
