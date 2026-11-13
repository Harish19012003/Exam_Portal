import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import './ImageCropDialog.css';

/**
 * Shared "adjust before upload" dialog: drag to move, zoom, rotate and pick a shape. It hands back a
 * cropped square image (Blob), so the app only ever uploads the part that is actually shown.
 * Pure canvas, no library. Export once, import wherever an image is uploaded.
 *
 * Props:
 *  - file            the File the user picked (required)
 *  - title           dialog heading
 *  - outputSize      px of the saved square (default 512)
 *  - defaultShape    'round' | 'rounded' | 'square' (default 'rounded')
 *  - shapes          which shapes to offer (default all three)
 *  - previewSizes    px sizes shown as "how it will look" (default [40, 24])
 *  - onCancel()      closed without saving
 *  - onConfirm(file) called with the cropped File (webp, transparent corners where the shape needs them)
 */
const SHAPES = [
  { id: 'round', label: 'Round' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'square', label: 'Square' },
];
/** 1 = cover the frame (fills width/height); below 1 shrinks so logos can keep padding. */
const MIN_ZOOM = 0.25;
const COVER_ZOOM = 1;
const MAX_ZOOM = 4;
/** Slider position of the cover tick (0–100%). */
const COVER_ZOOM_PCT = ((COVER_ZOOM - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100;
const ALL_SHAPES = SHAPES.map((s) => s.id);
const DEFAULT_PREVIEWS = [40, 24];

const radiusFor = (shape, size) => {
  if (shape === 'round') {return size / 2;}
  if (shape === 'rounded') {return size * 0.22;}
  return 0;
};

/** Draw the adjusted image into a size×size canvas context. `offset` and the frame are in stage px (stageSize). */
const paint = (ctx, img, { size, stageSize, zoom, rotation, offset, shape, clip }) => {
  const k = size / stageSize;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  if (clip) {
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, radiusFor(shape, size));
    ctx.clip();
  }
  const turned = rotation % 180 !== 0;
  const w = turned ? img.height : img.width;
  const h = turned ? img.width : img.height;
  const base = Math.max(stageSize / w, stageSize / h);
  ctx.translate(size / 2 + offset.x * k, size / 2 + offset.y * k);
  ctx.rotate((rotation * Math.PI) / 180);
  const s = base * zoom * k;
  ctx.drawImage(img, (-img.width * s) / 2, (-img.height * s) / 2, img.width * s, img.height * s);
  ctx.restore();
};

export const ImageCropDialog = ({
  file,
  title = 'Adjust image',
  outputSize = 512,
  defaultShape = 'rounded',
  shapes = ALL_SHAPES,
  previewSizes = DEFAULT_PREVIEWS,
  onCancel,
  onConfirm,
}) => {
  const headingId = useId();
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const previewRefs = useRef([]);
  const dragRef = useRef(null);
  const [img, setImg] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [stageSize, setStageSize] = useState(280);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [shape, setShape] = useState(defaultShape);
  const [saving, setSaving] = useState(false);

  const shapeOptions = useMemo(() => SHAPES.filter((s) => shapes.includes(s.id)), [shapes]);

  // Decode the picked file. `cancelled` ignores callbacks from a previous run (React dev mode mounts effects twice,
  // and the first run's revoked URL would otherwise report a false "could not be opened").
  useEffect(() => {
    let cancelled = false;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (cancelled) {return;}
      // SVGs without intrinsic size decode as 0×0 — give them a sane size.
      if (!image.width || !image.height) {
        image.width = 512;
        image.height = 512;
      }
      setLoadError('');
      setImg(image);
    };
    image.onerror = () => {
      if (!cancelled) {setLoadError('That image could not be opened. Try another file.');}
    };
    image.src = url;
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Keep the stage square and as wide as the dialog allows.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) {return undefined;}
    const measure = () => setStageSize(Math.round(el.clientWidth) || 280);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * Constrain drag: when zoomed in, keep the frame filled; when zoomed out, keep the
   * image inside the frame so it can sit with transparent padding around it.
   */
  const clamp = useCallback(
    (next, z = zoom, rot = rotation) => {
      if (!img) {return next;}
      const turned = rot % 180 !== 0;
      const w = turned ? img.height : img.width;
      const h = turned ? img.width : img.height;
      const base = Math.max(stageSize / w, stageSize / h);
      const maxX = Math.abs(w * base * z - stageSize) / 2;
      const maxY = Math.abs(h * base * z - stageSize) / 2;
      return { x: Math.min(maxX, Math.max(-maxX, next.x)), y: Math.min(maxY, Math.max(-maxY, next.y)) };
    },
    [img, stageSize, zoom, rotation],
  );

  // Repaint the stage and the small previews whenever anything changes.
  useEffect(() => {
    if (!img) {return;}
    const state = { stageSize, zoom, rotation, offset: clamp(offset), shape };
    const stage = canvasRef.current;
    if (stage) {
      stage.width = stageSize * 2;
      stage.height = stageSize * 2;
      paint(stage.getContext('2d'), img, { ...state, size: stageSize * 2, clip: false });
    }
    previewSizes.forEach((px, i) => {
      const c = previewRefs.current[i];
      if (!c) {return;}
      c.width = px * 2;
      c.height = px * 2;
      paint(c.getContext('2d'), img, { ...state, size: px * 2, clip: true });
    });
  }, [img, stageSize, zoom, rotation, offset, shape, previewSizes, clamp]);

  // Escape closes; the page behind must not scroll.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) {onCancel();}
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel, saving]);

  const onPointerDown = (e) => {
    if (!img) {return;}
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, origin: clamp(offset) };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) {return;}
    setOffset(clamp({ x: d.origin.x + e.clientX - d.x, y: d.origin.y + e.clientY - d.y }));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };
  const onWheel = (e) => {
    e.preventDefault();
    changeZoom(zoom + (e.deltaY < 0 ? 0.1 : -0.1));
  };
  // React attaches wheel passively; register natively so the page does not scroll while zooming.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) {return undefined;}
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const changeZoom = (value) => {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
    setZoom(z);
    setOffset((o) => clamp(o, z));
  };
  const rotate = () => {
    const rot = (rotation + 90) % 360;
    setRotation(rot);
    setOffset(clamp({ x: 0, y: 0 }, zoom, rot));
  };

  const save = async () => {
    if (!img || saving) {return;}
    setSaving(true);
    try {
      const out = document.createElement('canvas');
      out.width = outputSize;
      out.height = outputSize;
      paint(out.getContext('2d'), img, { size: outputSize, stageSize, zoom, rotation, offset: clamp(offset), shape, clip: true });
      const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/webp', 0.92));
      if (!blob) {throw new Error('Could not process that image');}
      const base = (file.name || 'image').replace(/\.[^.]+$/, '');
      await onConfirm(new File([blob], `${base}.webp`, { type: 'image/webp' }));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="icd-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !saving && onCancel()}>
      <div className="icd-dialog" role="dialog" aria-modal="true" aria-labelledby={headingId}>
        <header className="icd-head">
          <h2 id={headingId} className="icd-title">{title}</h2>
          <button type="button" className="icd-icon-btn" onClick={onCancel} disabled={saving} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="icd-body">
          <div
            ref={stageRef}
            className={`icd-stage ${img ? '' : 'is-loading'}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <canvas ref={canvasRef} className="icd-canvas" aria-label="Drag to reposition the image" />
            <span className={`icd-frame icd-frame--${shape}`} aria-hidden="true" />
            {loadError && <p className="icd-error" role="alert">{loadError}</p>}
          </div>

          <div className="icd-controls">
            <div className="icd-zoom">
              <button type="button" className="icd-icon-btn" onClick={() => changeZoom(zoom - 0.25)} aria-label="Zoom out">
                <ZoomOut size={18} aria-hidden="true" />
              </button>
              <div className="icd-zoom-track">
                <input
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step="0.01"
                  value={zoom}
                  onChange={(e) => changeZoom(Number(e.target.value))}
                  aria-label="Zoom"
                />
                <button
                  type="button"
                  className={`icd-zoom-mark${Math.abs(zoom - COVER_ZOOM) < 0.02 ? ' is-active' : ''}`}
                  style={{ left: `${COVER_ZOOM_PCT}%` }}
                  onClick={() => changeZoom(COVER_ZOOM)}
                  title="Fit to frame (fill width / height)"
                  aria-label="Snap zoom to fit frame"
                />
              </div>
              <button type="button" className="icd-icon-btn" onClick={() => changeZoom(zoom + 0.25)} aria-label="Zoom in">
                <ZoomIn size={18} aria-hidden="true" />
              </button>
              <button type="button" className="icd-icon-btn" onClick={rotate} aria-label="Rotate 90 degrees">
                <RotateCw size={18} aria-hidden="true" />
              </button>
            </div>

            {shapeOptions.length > 1 && (
              <div className="icd-shapes" role="radiogroup" aria-label="Shape">
                {shapeOptions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={shape === s.id}
                    className={`icd-shape ${shape === s.id ? 'is-active' : ''}`}
                    onClick={() => setShape(s.id)}
                  >
                    <span className={`icd-shape-icon icd-shape-icon--${s.id}`} aria-hidden="true" />
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            <div className="icd-previews" aria-label="Preview">
              <span className="icd-previews-label">Preview</span>
              {previewSizes.map((px, i) => (
                <canvas
                  key={px}
                  ref={(el) => {
                    previewRefs.current[i] = el;
                  }}
                  className="icd-preview"
                  style={{ width: px, height: px }}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        </div>

        <footer className="icd-foot">
          <button type="button" className="icd-btn" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="button" className="icd-btn icd-btn--primary" onClick={save} disabled={!img || saving}>
            {saving ? 'Saving…' : 'Use this image'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
