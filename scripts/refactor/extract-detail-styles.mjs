import {readFile,writeFile} from 'node:fs/promises';
import postcss from '../../frontend-astro/node_modules/postcss/lib/postcss.mjs';
const input=await readFile(new URL('../../frontend-astro/src/components/MangaDetailRefactor.astro',import.meta.url),'utf8');
const css=postcss.parse(input.match(/<style>([\s\S]*?)<\/style>/)[1]);
css.walkRules(rule=>{rule.selectors=rule.selectors.map(selector=>selector.startsWith('.manga-detail-page')?selector:':where(.manga-detail-page) '+selector);});
const shell=await readFile(new URL('../../frontend-astro/src/pages/manga/[slug].astro',import.meta.url),'utf8');
const shellCss=shell.match(/<style>([\s\S]*?)<\/style>/)[1].replaceAll(':global(.manga-detail-page)', '.manga-detail-page');
await writeFile(new URL('../../apps/web/src/features/manga/styles/MangaDetail.css',import.meta.url),'/* Scoped legacy visual contract. */\n'+css.toString()+'\n'+shellCss);
