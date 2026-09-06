import {readFile,writeFile} from 'node:fs/promises';
import postcss from '../../frontend-astro/node_modules/postcss/lib/postcss.mjs';
for(const [input,output,scope] of [
  ['source/[kind]/[source]/chapter/[chapter].astro','SourceReader','.source-reader-page'],
  ['manga/[slug]/[volume]/[chapter]/index.astro','LocalReader','.comic'],
]){
  const source=await readFile(new URL('../../frontend-astro/src/pages/'+input,import.meta.url),'utf8');
  const root=postcss.parse([...source.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n'));
  root.walkRules(rule=>{rule.selectors=rule.selectors.map(selector=>{
    const global=selector.startsWith(':global(');
    const next=selector.replace(/:global\(([^)]+)\)/g,'$1');
    return global||next.startsWith(scope)||(scope==='.source-reader-page'&&next.startsWith('.source-reader-manga'))?next:`:where(${scope}) ${next}`;
  });});
  await writeFile(new URL(`../../apps/web/src/features/manga/styles/${output}.css`,import.meta.url),root.toString());
}
