import {readFile, writeFile} from 'node:fs/promises';
import postcss from '../../frontend-astro/node_modules/postcss/lib/postcss.mjs';
const input=await readFile(new URL('../../frontend-astro/src/components/MangaLibraryRefactor.astro',import.meta.url),'utf8');
const css=postcss.parse(input.match(/<style>([\s\S]*?)<\/style>/)[1]);
css.walkRules(rule=>{rule.selectors=rule.selectors.map(selector=>{
  const scoped=selector.startsWith('.manga-collection-page')?selector:':where(.manga-collection-page) '+selector;
  const pseudo=scoped.indexOf('::');
  const exclusion=':not(:where([data-library-remote],[data-library-remote] *,[data-library-unscoped]))';
  return pseudo<0?scoped+exclusion:scoped.slice(0,pseudo)+exclusion+scoped.slice(pseudo);
});});
const shell=await readFile(new URL('../../frontend-astro/src/pages/manga/library.astro',import.meta.url),'utf8');
const shellCss=shell.match(/<style>([\s\S]*?)<\/style>/)[1].replaceAll(':global(.manga-collection-page)', '.manga-collection-page');
await writeFile(new URL('../../apps/web/src/features/manga/styles/MangaLibrary.css',import.meta.url),'/* Preserve legacy static scopes; dynamically inserted remote cards had no scoped styles. */\n'+css.toString()+'\n'+shellCss);
