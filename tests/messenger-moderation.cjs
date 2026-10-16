const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/chat-moderation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out});
const {moderateChatText:m}=out;
test('F-bomb and common evasions become absurd replacements',()=>{for(const v of ['fuck','FUCK','f.u.c.k','f u c k','fuuuck','f\u200buck','fucking','fucker','fuk','wtf'])assert.notEqual(m(v),v,v)});
test('racial slurs remain stars, not jokes',()=>{for(const v of ['nigger','N1GG3R','n.i.g.g.a','wetback','kike','raghead','faggot'])assert.equal(m(v),'****',v)});
test('profanity replacement is stable and idempotent',()=>{for(const v of ['shit','bullshit','asshole','bitch','cabrón','pendejo']){assert.notEqual(m(v),v);assert.equal(m(m(v)),m(v));}});
test('ordinary words and Unicode content survive',()=>{for(const v of ['Hello, class!','Scunthorpe assistance','black / negro / blanco','Dios te bendiga','Cockburn and Dickinson','😀 Great appointment!'])assert.equal(m(v),v)});
test('mixed messages retain their surrounding text',()=>assert.match(m('That FUCK is a nigger.'),/^That .+ is a \*{4}\.$/));
test('replacements vary with context',()=>assert.notEqual(m('fuck today'),m('fuck tomorrow').replace('tomorrow','today')));

test('single-word profanity is replaced, not dependent on a sentence',()=>{for(const v of ['ass','bitch','shit','damn','hell','crap','piss','dick','fuck'])assert.notEqual(m(v),v)});
test('long input stays responsive',()=>{const start=performance.now();for(let i=0;i<20;i++){m('f'.repeat(4000));m('fuck '.repeat(800));}assert(performance.now()-start<2000)});

test('optimized replacements preserve existing deterministic text',()=>{for(const [input,expected]of [
 ['fuck','disco-flavored pickle tornado'],
 ['fuck today','sentient gravy trampoline today'],
 ['😀 shit tomorrow','😀 Lord Fluffernoodle of Tater Town tomorrow'],
 ['shit damn hell','spaghetti-powered thunder muffin Count Snickerdoodle Wobblebottom spaghetti-powered thunder muffin'],
 ['f.u.c.k','disco-flavored pickle tornado'],
 ['crap crap crap ','glitter-powered tater goblin sentient gravy trampoline intergalactic waffle walrus '],
])assert.equal(m(input),expected)});
