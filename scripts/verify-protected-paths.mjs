import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const base=process.env.PROTECTED_BASE||'29eb3eda64155fc294d14f38cf94c7b797ecb265';
const protectedRoots=['components/documents','app/(print)','app/(app)/documents','app/(app)/deal-sheet','app/api/deals','app/api/me/settings','lib/walker-workflow.ts','lib/deals.ts','lib/dealer-consultant.ts','supabase/migrations'];
const changes=execFileSync('git',['diff','--name-only',base],{encoding:'utf8'}).trim().split('\n');
const violations=changes.filter(path=>protectedRoots.some(root=>path===root||path.startsWith(root+'/')));
if(violations.length)throw Error('Protected documents/data flow changed: '+violations.join(', '));
let path='components/workflow/unified-input-screen.tsx';
function semantic(source){
 const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const result=ts.transform(ast,[context=>root=>{
  const visit=node=>ts.isJsxAttribute(node)&&['className','src'].includes(node.name.getText(ast))?undefined:ts.visitEachChild(node,visit,context);
  return ts.visitNode(root,visit);
 }]);
 return ts.createPrinter({removeComments:true}).printFile(result.transformed[0]);
}
for(const file of ['components/workflow/unified-input-screen.tsx','components/workflow/workflow-screen.tsx']){path=file;const original=execFileSync('git',['show',`${base}:${path}`],{encoding:'utf8'});if(semantic(original)!==semantic(fs.readFileSync(path,'utf8')))throw Error('Workflow logic changed beyond appearance: '+path);}
console.log('PASS: printed documents, routes, parsers, dealer/contact auto-fill, and deal APIs unchanged. Workflow edits are appearance only (className and logo source).');
