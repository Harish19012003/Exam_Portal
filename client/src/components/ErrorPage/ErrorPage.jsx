import React, { useEffect, useId, useMemo, useState } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { RefreshCw, Home, Copy, Check, ChevronDown } from 'lucide-react';
import { ErrorIllustration } from './ErrorIllustration';
import { NotFoundScreen } from './NotFoundScreen';
import { AppFooter } from '../AppFooter/AppFooter';
import './ErrorPage.css';

/** Messages a browser gives when a lazily-loaded file no longer exists (a new version was deployed). */
const STALE_BUILD_RE =
  /(Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed|ChunkLoadError)/i;

/** Turn any thrown value into friendly copy plus raw details for the "technical details" panel. */
export const describeError = (error) => {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return {
        kind: 'notfound',
        title: 'We can’t find that page',
        message: 'It may have moved or the address may be wrong. Let’s get you back on track.',
        details: `${error.status} ${error.statusText || ''}`.trim(),
      };
    }
    if (error.status === 401 || error.status === 403) {
      return {
        kind: 'forbidden',
        title: 'This area is off limits',
        message: 'You don’t have permission to view this page. If you think you should, ask an administrator.',
        details: `${error.status} ${error.statusText || ''}`.trim(),
      };
    }
    return {
      kind: 'generic',
      title: 'We’re sorry…',
      message: 'Something went wrong while loading this page. Please try again.',
      details: `${error.status} ${error.statusText || ''} ${typeof error.data === 'string' ? error.data : ''}`.trim(),
    };
  }

  const text = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  if (STALE_BUILD_RE.test(text)) {
    return {
      kind: 'stale',
      title: 'A new version is ready',
      message: 'The portal was updated while this page was open. Reload to get the latest version — your saved work is safe.',
      details: text,
    };
  }
  return {
    kind: 'generic',
    title: 'We’re sorry…',
    message: 'This page ran into a problem. Reloading usually fixes it — and if it keeps happening, send us the reference below.',
    details: import.meta.env.DEV && error instanceof Error && error.stack ? `${text}\n\n${error.stack}` : text,
  };
};

/**
 * Friendly replacement for the default router error screen.
 * variant="page"   → full screen (route-level errors)
 * variant="inline" → fills the content area so the sidebar / top bar keep working
 */
export const ErrorView = ({ error, variant = 'page', onRetry }) => {
  const info = useMemo(() => describeError(error), [error]);
  const reference = useMemo(() => Date.now().toString(36).slice(-6).toUpperCase(), []);
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refCopied, setRefCopied] = useState(false);
  const detailsId = useId();
  const when = useMemo(() => new Date(), []);
  const pagePath = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '';

  useEffect(() => {
    // Keep the real error in the console for developers.
    // eslint-disable-next-line no-console
    console.error('[app error]', reference, error);
  }, [error, reference]);

  const copyText = async (text, flag) => {
    try {
      await navigator.clipboard.writeText(text);
      flag(true);
      setTimeout(() => flag(false), 2000);
    } catch {
      // clipboard blocked — the text is still visible on screen
    }
  };
  const copyDetails = () =>
    copyText(`Reference: ${reference}\nPage: ${window.location.href}\nWhen: ${when.toISOString()}\n\n${info.details}`, setCopied);
  const copyReference = () => copyText(reference, setRefCopied);

  const retry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  // A missing page gets its own full-screen design (the in-app variant keeps the compact card).
  if (info.kind === 'notfound' && variant === 'page') {
    return <NotFoundScreen />;
  }

  const primaryIsDashboard = info.kind === 'notfound' || info.kind === 'forbidden';

  return (
    <div className={`app-error app-error--${variant}`} role="alert">
      <div className={`app-error-card app-error-card--${info.kind}`}>
        <div className="app-error-body">
          <ErrorIllustration kind={info.kind} />
          <h1 className="app-error-title">{info.title}</h1>
          <p className="app-error-message">{info.message}</p>

          <div className="app-error-actions">
            {!primaryIsDashboard && (
              <button type="button" className="app-error-btn app-error-btn--primary" onClick={retry}>
                <RefreshCw size={16} aria-hidden="true" />
                <span>{info.kind === 'stale' ? 'Reload now' : onRetry ? 'Try again' : 'Reload page'}</span>
              </button>
            )}
            <a
              className={`app-error-btn ${primaryIsDashboard ? 'app-error-btn--primary' : 'app-error-btn--ghost'}`}
              href="/dashboard"
            >
              <Home size={16} aria-hidden="true" />
              <span>Back to dashboard</span>
            </a>
          </div>

          <div className="app-error-meta">
            <button type="button" className="app-error-ref" onClick={copyReference} title="Copy reference">
              <span className="app-error-ref-label">Reference</span><strong>{reference}</strong>
              {refCopied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
              <span className="app-error-sr">{refCopied ? 'Copied' : 'Copy reference'}</span>
            </button>
            <button
              type="button"
              className="app-error-link"
              onClick={() => setShowDetails((v) => !v)}
              aria-expanded={showDetails}
              aria-controls={detailsId}
            >
              <ChevronDown size={14} className={showDetails ? 'open' : ''} aria-hidden="true" />
              Technical details
            </button>
          </div>

          <div id={detailsId} className={`app-error-details ${showDetails ? 'open' : ''}`} aria-hidden={!showDetails}>
            <div className="app-error-details-inner">
              <div className="app-error-panel">
                <div className="app-error-panel-head">
                  <span>For support</span>
                  <button type="button" className="app-error-copy" onClick={copyDetails} tabIndex={showDetails ? 0 : -1}>
                    {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                    {copied ? 'Copied' : 'Copy all'}
                  </button>
                </div>
                <dl className="app-error-kv">
                  <div><dt>Page</dt><dd>{pagePath || '/'}</dd></div>
                  <div><dt>Time</dt><dd>{when.toLocaleString()}</dd></div>
                </dl>
                <pre>{info.details}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
      {variant === 'page' && <AppFooter variant="floating" />}
    </div>
  );
};

/** Route-level error element (used by the router for crashes, failed loaders and unmatched URLs). */
export const RouteErrorPage = () => <ErrorView error={useRouteError()} variant="page" />;

/**
 * Catches a crash inside one page so the sidebar and top bar stay usable.
 * Resets automatically when `resetKey` changes (e.g. the user navigates elsewhere).
 */
export class SectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return <ErrorView error={this.state.error} variant="inline" onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
