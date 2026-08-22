import { LANGS, RTL_LANGS, SHARE_META, type Lang } from './i18n';

/** Canonical origin, used for absolute og:/canonical URLs. */
export const SITE_URL = 'https://dungeon-drawer.vercel.app';

/** One share card per locale; English keeps the original filename. */
export function ogImageName(lang: Lang): string {
  return lang === 'en' ? 'og.png' : `og-${lang}.png`;
}

const ogImage = (lang: Lang) => `${SITE_URL}/${ogImageName(lang)}`;

/** English lives at `/`, every other locale at `/<lang>/`. */
export function pathForLang(lang: Lang): string {
  return lang === 'en' ? '/' : `/${lang}/`;
}

export function urlForLang(lang: Lang): string {
  return SITE_URL + pathForLang(lang);
}

function isLang(value: string | null | undefined): value is Lang {
  return !!value && LANGS.some((l) => l.id === value);
}

/** `/he/`, `/he`, `/he/index.html` → 'he'. Anything else → null. */
export function langFromPath(pathname: string): Lang | null {
  const first = pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  return isLang(first) ? first : null;
}

/** `?lang=he` — an explicit override that beats the path. */
export function langFromQuery(search: string): Lang | null {
  const value = new URLSearchParams(search).get('lang')?.slice(0, 2).toLowerCase();
  return isLang(value) ? value : null;
}

/** Whatever the current URL asks for, query first. */
export function langFromLocation(loc: { pathname: string; search: string }): Lang | null {
  return langFromQuery(loc.search) ?? langFromPath(loc.pathname);
}

type Tag =
  | { el: 'title'; text: string }
  | { el: 'meta'; attr: 'name' | 'property'; key: string; content: string }
  | { el: 'link'; rel: string; href: string; hreflang?: string };

/** The full set of localizable head tags for one locale. */
export function shareTags(lang: Lang): Tag[] {
  const m = SHARE_META[lang];
  const tags: Tag[] = [
    { el: 'title', text: m.htmlTitle },
    { el: 'meta', attr: 'name', key: 'description', content: m.description },

    { el: 'meta', attr: 'property', key: 'og:type', content: 'website' },
    { el: 'meta', attr: 'property', key: 'og:site_name', content: 'Dungeon Drawer' },
    { el: 'meta', attr: 'property', key: 'og:locale', content: m.ogLocale },
    { el: 'meta', attr: 'property', key: 'og:url', content: urlForLang(lang) },
    { el: 'meta', attr: 'property', key: 'og:title', content: m.htmlTitle },
    { el: 'meta', attr: 'property', key: 'og:description', content: m.ogDescription },
    { el: 'meta', attr: 'property', key: 'og:image', content: ogImage(lang) },
    { el: 'meta', attr: 'property', key: 'og:image:width', content: '1200' },
    { el: 'meta', attr: 'property', key: 'og:image:height', content: '630' },
    { el: 'meta', attr: 'property', key: 'og:image:alt', content: m.ogImageAlt },

    { el: 'meta', attr: 'name', key: 'twitter:card', content: 'summary_large_image' },
    { el: 'meta', attr: 'name', key: 'twitter:title', content: m.htmlTitle },
    { el: 'meta', attr: 'name', key: 'twitter:description', content: m.ogDescription },
    { el: 'meta', attr: 'name', key: 'twitter:image', content: ogImage(lang) },
    { el: 'meta', attr: 'name', key: 'twitter:image:alt', content: m.ogImageAlt },

    { el: 'link', rel: 'canonical', href: urlForLang(lang) },
  ];
  for (const l of LANGS) {
    tags.push({ el: 'link', rel: 'alternate', hreflang: l.id, href: urlForLang(l.id) });
  }
  tags.push({ el: 'link', rel: 'alternate', hreflang: 'x-default', href: urlForLang('en') });
  return tags;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ESCAPES[c]);

/** Static HTML for the head block — used by the build-time locale page emitter. */
export function renderShareHead(lang: Lang, indent = '    '): string {
  return shareTags(lang)
    .map((tag) => {
      if (tag.el === 'title') return `${indent}<title>${escapeHtml(tag.text)}</title>`;
      if (tag.el === 'meta') {
        return `${indent}<meta ${tag.attr}="${tag.key}" content="${escapeHtml(tag.content)}" />`;
      }
      const hreflang = tag.hreflang ? ` hreflang="${tag.hreflang}"` : '';
      return `${indent}<link rel="${tag.rel}"${hreflang} href="${tag.href}" />`;
    })
    .join('\n');
}

/** `<html>` attributes for a locale — RTL flips here too. */
export function htmlAttrs(lang: Lang): { lang: Lang; dir: 'rtl' | 'ltr' } {
  return { lang, dir: RTL_LANGS.has(lang) ? 'rtl' : 'ltr' };
}

/**
 * Re-point the live document at another locale: <html lang/dir>, title, and
 * every share tag. Crawlers won't see this (they read the static page), but
 * browsers, bookmarks and in-app share sheets will.
 */
export function applyShareHead(lang: Lang): void {
  const { dir } = htmlAttrs(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;

  const head = document.head;
  head.querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang]').forEach((el) => el.remove());

  for (const tag of shareTags(lang)) {
    if (tag.el === 'title') {
      document.title = tag.text;
    } else if (tag.el === 'meta') {
      const selector = `meta[${tag.attr}="${tag.key}"]`;
      let el = head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(tag.attr, tag.key);
        head.appendChild(el);
      }
      el.content = tag.content;
    } else {
      const el = document.createElement('link');
      el.rel = tag.rel;
      if (tag.hreflang) el.hreflang = tag.hreflang;
      el.href = tag.href;
      head.appendChild(el);
    }
  }
}
