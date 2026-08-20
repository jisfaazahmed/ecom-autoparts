import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Per-route document metadata for the SPA.
 *
 * index.html carries the site-wide defaults (they are what crawlers and link
 * unfurlers see before JS runs). This hook rewrites those same tags in place
 * when a route renders, and restores the defaults when it unmounts, so a page
 * that does not call it never inherits the previous page's title.
 */

export const SITE_NAME = 'AutoMatrix';
export const SITE_URL = (
  (import.meta.env.VITE_SITE_URL as string | undefined) || 'https://automobiles.live'
).replace(/\/+$/, '');

export const absoluteUrl = (pathOrUrl: string): string =>
  /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${SITE_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;

const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;

type JsonLd = Record<string, unknown>;

export interface SeoOptions {
  /** Page-specific title. " | AutoMatrix" is appended unless the title already contains it. */
  title: string;
  description?: string;
  /** Canonical path, e.g. "/shop". Defaults to the current route (query string dropped). */
  path?: string;
  /** Absolute URL or site-relative path to the social preview image. */
  image?: string;
  type?: 'website' | 'product' | 'article';
  /** Keep account, checkout and dashboard routes out of search results. */
  noindex?: boolean;
  jsonLd?: JsonLd | JsonLd[] | null;
}

interface HeadState {
  title: string;
  description: string;
  canonical: string;
  image: string;
  type: string;
  robots: string;
}

const JSONLD_ATTR = 'data-seo-jsonld';

const metaSelector = (key: string) =>
  key.startsWith('og:') ? `meta[property="${key}"]` : `meta[name="${key}"]`;

const setMeta = (key: string, content: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(metaSelector(key));
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(key.startsWith('og:') ? 'property' : 'name', key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const setCanonical = (href: string) => {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
};

const readDefaults = (): HeadState => {
  const meta = (key: string) =>
    document.head.querySelector<HTMLMetaElement>(metaSelector(key))?.content ?? '';
  return {
    title: document.title,
    description: meta('description'),
    canonical:
      document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || `${SITE_URL}/`,
    image: meta('og:image') || DEFAULT_IMAGE,
    type: meta('og:type') || 'website',
    robots: meta('robots') || 'index, follow, max-image-preview:large, max-snippet:-1',
  };
};

let defaults: HeadState | null = null;

const applyHead = (state: HeadState) => {
  document.title = state.title;
  setMeta('description', state.description);
  setMeta('robots', state.robots);
  setCanonical(state.canonical);

  setMeta('og:title', state.title);
  setMeta('og:description', state.description);
  setMeta('og:url', state.canonical);
  setMeta('og:image', state.image);
  setMeta('og:type', state.type);

  setMeta('twitter:title', state.title);
  setMeta('twitter:description', state.description);
  setMeta('twitter:image', state.image);
};

export function useSeo(options: SeoOptions): void {
  const location = useLocation();
  const { title, description, path, image, type = 'website', noindex = false, jsonLd = null } = options;

  // Serialised so callers can build the graph inline without memoising it.
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    if (!defaults) defaults = readDefaults();

    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const next: HeadState = {
      title: fullTitle,
      description: description || defaults.description,
      canonical: absoluteUrl(path || location.pathname),
      image: image ? absoluteUrl(image) : defaults.image,
      type,
      robots: noindex ? 'noindex, nofollow' : defaults.robots,
    };

    applyHead(next);

    let script: HTMLScriptElement | null = null;
    if (jsonLdKey) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute(JSONLD_ATTR, '');
      script.textContent = jsonLdKey;
      document.head.appendChild(script);
    }

    return () => {
      script?.remove();
      if (defaults) applyHead(defaults);
    };
  }, [title, description, path, image, type, noindex, jsonLdKey, location.pathname]);
}

export default useSeo;
