// Mechanical controller extraction: preserve behavior while owning event/timer lifetimes.
import {readFile,writeFile} from 'node:fs/promises';
import ts from '../../apps/web/node_modules/typescript/lib/typescript.js';
for(const [widget,entry] of [['Navbar','initPublicNavigation'],['MusicPlayer','initMusicPlayers']]){
  const source=await readFile(new URL(`../../frontend-astro/src/components/${widget}.astro`,import.meta.url),'utf8');
  let script=source.match(/<script(?: is:inline)?>([\s\S]*?)<\/script>/)[1];
  script=script.replace(/\s*document\.addEventListener\('(?:DOMContentLoaded|astro:page-load)',[^;]+;/g,'');
  const transformer=context=>root=>{
    const visit=node=>{
      if(ts.isCallExpression(node)){
        const expression=node.expression;
        if(ts.isPropertyAccessExpression(expression)&&expression.name.text==='addEventListener'){
          return ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('scope'),'listen'),undefined,[ts.visitNode(expression.expression,visit),...node.arguments.map(arg=>ts.visitNode(arg,visit))]);
        }
        const name=ts.isIdentifier(expression)?expression.text:ts.isPropertyAccessExpression(expression)&&ts.isIdentifier(expression.expression)&&expression.expression.text==='window'?expression.name.text:'';
        if(name==='setTimeout'||name==='requestAnimationFrame')return ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('scope'),name==='setTimeout'?'timeout':'frame'),undefined,node.arguments.map(arg=>ts.visitNode(arg,visit)));
      }
      return ts.visitEachChild(node,visit,context);
    };
    return ts.visitNode(root,visit);
  };
  if(widget==='Navbar')script=script.replace("const close = () => {", "const close = () => {\n window.clearTimeout(timer);").replace('let controller;', 'let controller;\n scope.defer(()=>{window.clearTimeout(timer);controller?.abort();});');
  if(widget==='MusicPlayer')script=script.replace('const updateProgress = () => {','scope.defer(save);\n const updateProgress = () => {');
  const output=ts.transpileModule(script,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},transformers:{before:[transformer]}}).outputText;
  const cleanup=widget==='Navbar'?`document.querySelectorAll('[data-adaptive-nav],img[data-fallback-src],[data-theme-option],#command-backdrop,#install-app').forEach(node=>{for(const key of ['boundAdaptiveNav','boundFallback','boundThemeOption','ready','boundInstall'])delete node.dataset[key];});document.body.classList.remove('command-open');`:`document.querySelectorAll('[data-music-player]').forEach(node=>{delete node.dataset.ready;node.querySelector('audio')?.pause();});if('mediaSession' in navigator)for(const action of ['play','pause','previoustrack','nexttrack']){try{navigator.mediaSession.setActionHandler(action,null);}catch{}}`;
  await writeFile(new URL(`../../apps/web/src/shared/site/${widget==='Navbar'?'navigation':'music'}-controller.js`,import.meta.url),`import { createEffectScope } from '../browser/effect-scope';\nexport function mountController(){\nconst scope=createEffectScope();\n${output}\n${entry}();\nreturn()=>{scope.dispose();${cleanup}};\n}\n`);
}
