import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import { CUSTOMIZATION_TOUR_STEPS, type CustomizationTourStep } from './steps';
import { getCustomizationTourStatus, setCustomizationTourStatus } from './storage';

export interface CustomizationTourHandlers {
  openFeatureBuilder: () => void;
  closeFeatureBuilder: () => void;
  openRecordDesign: () => void;
  closeRecordDesign: () => void;
}

interface CustomizationTourContextValue {
  isActive: boolean;
  startTour: () => void;
  register: (handlers: CustomizationTourHandlers) => void;
  unregister: () => void;
}

const CustomizationTourContext = createContext<CustomizationTourContextValue | null>(null);

export function useCustomizationTour() {
  const ctx = useContext(CustomizationTourContext);
  if (!ctx) {
    throw new Error('useCustomizationTour must be used within CustomizationTourProvider');
  }
  return ctx;
}

export function useCustomizationTourOptional() {
  return useContext(CustomizationTourContext);
}

export function useRegisterCustomizationTour(handlers: CustomizationTourHandlers) {
  const ctx = useCustomizationTourOptional();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!ctx) return;
    const stable: CustomizationTourHandlers = {
      openFeatureBuilder: () => handlersRef.current.openFeatureBuilder(),
      closeFeatureBuilder: () => handlersRef.current.closeFeatureBuilder(),
      openRecordDesign: () => handlersRef.current.openRecordDesign(),
      closeRecordDesign: () => handlersRef.current.closeRecordDesign(),
    };
    ctx.register(stable);
    return () => ctx.unregister();
  }, [ctx]);
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOUR_ROOT_SELECTOR = '[data-tour-active-root]';
const PADDING = 8;

function measureTarget(step: CustomizationTourStep): TargetRect | null {
  if (!step.target) return null;
  const root = document.querySelector(TOUR_ROOT_SELECTOR);
  if (!root) return null;
  const el = root.querySelector(step.target);
  if (!el || !(el instanceof HTMLElement)) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return {
    top: rect.top - PADDING,
    left: rect.left - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };
}

function TourTooltip({
  step,
  stepIndex,
  totalSteps,
  isDarkMode,
  targetRect,
  onBack,
  onNext,
  onSkip,
}: {
  step: CustomizationTourStep;
  stepIndex: number;
  totalSteps: number;
  isDarkMode: boolean;
  targetRect: TargetRect | null;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const isCenter = step.placement === 'center' || !targetRect;
  const isLast = stepIndex === totalSteps - 1;

  const tooltipStyle = useMemo(() => {
    if (isCenter) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: 'min(92vw, 420px)',
      } as const;
    }
    if (!targetRect) return {};

    const gap = 14;
    const maxW = 320;
    const vw = window.innerWidth;

    let top = targetRect.top;
    let left = targetRect.left;

    switch (step.placement) {
      case 'left':
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.left - gap;
        return {
          top,
          left,
          transform: 'translate(-100%, -50%)',
          maxWidth: Math.min(maxW, left - 16),
        };
      case 'right':
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.left + targetRect.width + gap;
        return {
          top,
          left,
          transform: 'translateY(-50%)',
          maxWidth: Math.min(maxW, vw - left - 16),
        };
      case 'bottom':
        top = targetRect.top + targetRect.height + gap;
        left = Math.min(
          Math.max(16, targetRect.left + targetRect.width / 2),
          vw - maxW / 2 - 16,
        );
        return {
          top,
          left,
          transform: 'translateX(-50%)',
          maxWidth: maxW,
        };
      case 'top':
      default:
        top = targetRect.top - gap;
        left = Math.min(
          Math.max(16, targetRect.left + targetRect.width / 2),
          vw - maxW / 2 - 16,
        );
        return {
          top,
          left,
          transform: 'translate(-50%, -100%)',
          maxWidth: maxW,
        };
    }
  }, [isCenter, step.placement, targetRect]);

  const panelClass = isDarkMode
    ? 'bg-[#0B1E19] border-gray-700 text-gray-100 shadow-black/50'
    : 'bg-white border-gray-200 text-gray-900 shadow-xl';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="customization-tour-title"
      className={`fixed z-[10001] w-full rounded-2xl border p-5 pointer-events-auto transition-all duration-200 ${panelClass}`}
      style={tooltipStyle}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#13C296]/15 text-[#13C296]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Step {stepIndex + 1} of {totalSteps}
            </p>
            <h3 id="customization-tour-title" className="text-[15px] font-bold tracking-tight">
              {step.title}
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className={`flex-shrink-0 rounded-lg p-1.5 transition-colors ${
            isDarkMode ? 'text-gray-500 hover:bg-white/10 hover:text-gray-200' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
          }`}
          aria-label="Skip tour"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className={`text-[13px] leading-relaxed mb-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
        {step.body}
      </p>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSkip}
          className={`text-[12px] font-medium transition-colors ${
            isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Skip tour
        </button>
        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={onBack}
              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-colors ${
                isDarkMode
                  ? 'border-gray-700 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-1 rounded-xl bg-[#13C296] px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-[#0f9f7a]"
          >
            {isLast ? 'Done' : 'Next'}
            {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function TourOverlay({
  step,
  stepIndex,
  isDarkMode,
  onBack,
  onNext,
  onSkip,
}: {
  step: CustomizationTourStep;
  stepIndex: number;
  isDarkMode: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  const updateRect = useCallback(() => {
    setTargetRect(measureTarget(step));
  }, [step]);

  useEffect(() => {
    updateRect();
    const id = requestAnimationFrame(updateRect);
    const t = window.setTimeout(updateRect, 280);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(t);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [updateRect]);

  const isCenter = step.placement === 'center' || !step.target;

  return createPortal(
    <div className="fixed inset-0 z-[10000] print:hidden" aria-hidden={false}>
      {isCenter ? (
        <div className="absolute inset-0 bg-black/60 pointer-events-auto" />
      ) : targetRect ? (
        <div
          className="absolute rounded-xl ring-2 ring-[#13C296] ring-offset-2 ring-offset-transparent pointer-events-none transition-all duration-200"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.62)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60 pointer-events-auto" />
      )}

      <TourTooltip
        step={step}
        stepIndex={stepIndex}
        totalSteps={CUSTOMIZATION_TOUR_STEPS.length}
        isDarkMode={isDarkMode}
        targetRect={targetRect}
        onBack={onBack}
        onNext={onNext}
        onSkip={onSkip}
      />
    </div>,
    document.body,
  );
}

export interface CustomizationTourProviderProps {
  isDarkMode: boolean;
  children: ReactNode;
  /** When true, auto-starts once for first-time visitors. */
  autoStart?: boolean;
  onRequestTourView?: () => void;
}

export function CustomizationTourProvider({
  isDarkMode,
  children,
  autoStart = false,
  onRequestTourView,
}: CustomizationTourProviderProps) {
  const handlersRef = useRef<CustomizationTourHandlers | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const autoStartedRef = useRef(false);

  const register = useCallback((handlers: CustomizationTourHandlers) => {
    handlersRef.current = handlers;
  }, []);

  const unregister = useCallback(() => {
    handlersRef.current = null;
  }, []);

  const getHandlers = useCallback((): CustomizationTourHandlers => {
    return (
      handlersRef.current ?? {
        openFeatureBuilder: () => {},
        closeFeatureBuilder: () => {},
        openRecordDesign: () => {},
        closeRecordDesign: () => {},
      }
    );
  }, []);

  const finishTour = useCallback((status: 'completed' | 'skipped') => {
    const handlers = getHandlers();
    handlers.closeFeatureBuilder();
    handlers.closeRecordDesign();
    setCustomizationTourStatus(status);
    setIsActive(false);
    setStepIndex(0);
  }, [getHandlers]);

  const runStepEnter = useCallback(
    (index: number) => {
      const step = CUSTOMIZATION_TOUR_STEPS[index];
      step?.onEnter?.(getHandlers());
      window.setTimeout(() => {
        // Re-measure after panels animate open.
      }, 300);
    },
    [getHandlers],
  );

  const startTour = useCallback(() => {
    onRequestTourView?.();
    window.setTimeout(() => {
      setStepIndex(0);
      setIsActive(true);
      window.setTimeout(() => runStepEnter(0), 120);
    }, 100);
  }, [onRequestTourView, runStepEnter]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    if (getCustomizationTourStatus() !== 'pending') return;
    autoStartedRef.current = true;
    const id = window.setTimeout(() => startTour(), 900);
    return () => window.clearTimeout(id);
  }, [autoStart, startTour]);

  const goToStep = useCallback(
    (nextIndex: number) => {
      const current = CUSTOMIZATION_TOUR_STEPS[stepIndex];
      current?.onLeave?.(getHandlers());
      setStepIndex(nextIndex);
      window.setTimeout(() => runStepEnter(nextIndex), 80);
    },
    [getHandlers, runStepEnter, stepIndex],
  );

  const handleNext = useCallback(() => {
    if (stepIndex >= CUSTOMIZATION_TOUR_STEPS.length - 1) {
      finishTour('completed');
      return;
    }
    goToStep(stepIndex + 1);
  }, [finishTour, goToStep, stepIndex]);

  const handleBack = useCallback(() => {
    if (stepIndex <= 0) return;
    goToStep(stepIndex - 1);
  }, [goToStep, stepIndex]);

  const handleSkip = useCallback(() => {
    finishTour('skipped');
  }, [finishTour]);

  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleSkip, isActive]);

  const value = useMemo(
    () => ({ isActive, startTour, register, unregister }),
    [isActive, register, startTour, unregister],
  );

  const activeStep = CUSTOMIZATION_TOUR_STEPS[stepIndex];

  return (
    <CustomizationTourContext.Provider value={value}>
      {children}
      {isActive && activeStep && (
        <TourOverlay
          step={activeStep}
          stepIndex={stepIndex}
          isDarkMode={isDarkMode}
          onBack={handleBack}
          onNext={handleNext}
          onSkip={handleSkip}
        />
      )}
    </CustomizationTourContext.Provider>
  );
}
