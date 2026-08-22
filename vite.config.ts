import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { LANGS, type Lang } from './src/i18n';
import { htmlAttrs, pathForLang, renderShareHead } from './src/share';

const HEAD_SLOT = '<!--locale-head-->';
const HEAD_START = '<!--locale-head:start-->';
const HEAD_END = '<!--locale-head:end-->';

/** The generated block keeps its own markers so it can be re-localized after
 *  Vite has already filled the slot once for English. */
function headBlock(lang: Lang): string {
  return `${HEAD_START}\n${renderShareHead(lang)}\n    ${HEAD_END}`;
}

function localize(html: string, lang: Lang): string {
  const { dir } = htmlAttrs(lang);
  const start = html.indexOf(HEAD_START);
  const withHead =
    start === -1
      ? html.replace(HEAD_SLOT, headBlock(lang))
      : html.slice(0, start) + headBlock(lang) + html.slice(html.indexOf(HEAD_END) + HEAD_END.length);
  return withHead.replace(/<html\s[^>]*>/, `<html lang="${lang}" dir="${dir}">`);
}

/**
 * Link-preview crawlers (WhatsApp, Slack, Facebook, X) never run our JS, so a
 * single-page app can only be shared in one language. This emits one real HTML
 * page per locale — `/`, `/he/`, `/es/`, … — each with its own title, meta
 * description, og:*, canonical and hreflang alternates, all pointing at the
 * same JS bundle. The app itself reads the locale back off the URL.
 */
function localePages(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'dungeon-drawer:locale-pages',
    configResolved(resolved) {
      config = resolved;
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => localize(html, 'en'),
    },
    closeBundle() {
      const outDir = resolve(config.root, config.build.outDir);
      const indexPath = resolve(outDir, 'index.html');
      let english: string;
      try {
        english = readFileSync(indexPath, 'utf8');
      } catch {
        return; // not an html build (e.g. library mode)
      }
      for (const { id } of LANGS) {
        if (id === 'en') continue;
        const target = resolve(outDir, `.${pathForLang(id)}index.html`);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, localize(english, id));
      }
      this.info(`emitted ${LANGS.length - 1} localized entry pages`);
    },
  };
}

export default defineConfig({
  plugins: [react(), localePages()],
});
