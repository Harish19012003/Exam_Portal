import { useEffect } from 'react';
import { useCustomizationTourOptional } from './CustomizationTourContext';

/** Wire Feature Builder + Record Designer open/close into the guided tour. */
export function useDesignPanelTourHandlers(
  handlers: {
    setFeatureBuilderOpen: (open: boolean) => void;
    setDesignOpen: (open: boolean) => void;
  },
  enabled = true,
) {
  const ctx = useCustomizationTourOptional();

  useEffect(() => {
    if (!ctx || !enabled) return;
    const stable = {
      openFeatureBuilder: () => {
        handlers.setDesignOpen(false);
        handlers.setFeatureBuilderOpen(true);
      },
      closeFeatureBuilder: () => handlers.setFeatureBuilderOpen(false),
      openRecordDesign: () => {
        handlers.setFeatureBuilderOpen(false);
        handlers.setDesignOpen(true);
      },
      closeRecordDesign: () => handlers.setDesignOpen(false),
    };
    ctx.register(stable);
    return () => ctx.unregister();
  }, [ctx, enabled, handlers.setDesignOpen, handlers.setFeatureBuilderOpen]);
}
