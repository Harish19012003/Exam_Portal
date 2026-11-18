import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import { fetchPublicBranding, PLATFORM_DEFAULTS } from '../api/platformSettingsApi';
import { optimizedFaviconUrl } from '../utils/brandingImage';
import { applyHeadingFont } from '../constants/headingFonts';

/**
 * Applies portal name, favicon + heading font on every route (including /login).
 * Uses the public branding endpoint so it works before sign-in.
 */
export const DocumentBranding = () => {
  const { data } = useQuery({
    queryKey: queryKeys.platformBranding,
    queryFn: fetchPublicBranding,
  });
  const portalName = data?.portal_name || PLATFORM_DEFAULTS.portal_name;
  const faviconUrl = data?.favicon_url || '';
  const headingFont = data?.heading_font || '';

  useEffect(() => {
    applyHeadingFont(headingFont);
    return () => applyHeadingFont('');
  }, [headingFont]);

  useEffect(() => {
    document.title = portalName;
  }, [portalName]);

  useEffect(() => {
    const link = document.querySelector("link[rel='icon']");
    if (!link) return undefined;
    const original = { href: link.getAttribute('href'), type: link.getAttribute('type') };
    if (faviconUrl) {
      link.setAttribute('href', optimizedFaviconUrl(faviconUrl));
      link.setAttribute('type', 'image/png');
    }
    return () => {
      link.setAttribute('href', original.href || '/favicon.svg');
      if (original.type) link.setAttribute('type', original.type);
      else link.removeAttribute('type');
    };
  }, [faviconUrl]);

  return null;
};
