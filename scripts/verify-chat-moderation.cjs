const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const moduleFile={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/chat-moderation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:moduleFile,exports:moduleFile.exports});
const {maskChatText,maskCompletedChatWords}=moduleFile.exports;
for(const input of ['fuck','FUCK','f.u.c.k','f u c k','fuuuuck','fúck','fu\u200bck','fücking','sh!t','sh1t','shit!','goddamn','God damn','Goddamn!','god-damned','cabrón','chingas tu madre','hijo de puta','pendejo','Mierda','coño','maldito Dios','nigger','n1gga','wetback','maricón']){
 const output=maskChatText(input);assert.ok(output.includes('*'),`Not masked: ${input}`);assert.equal(maskChatText(output),output,'Masking must be idempotent');
}
for(const input of ['Hello, class!','Scunthorpe assistance','black / negro / blanco','Dios te bendiga','ship this to the customer','Saturday appointment at 10:30','Cockburn and Dickinson','GMC Toyota Kia BMW'])assert.equal(maskChatText(input),input);
assert.equal(maskChatText('😀 fuck!'),'😀 ****!');assert.equal(maskChatText('A cabrón and shit.'),'A ****** and ****.');
assert.equal(maskCompletedChatWords('hello'),'hello');assert.equal(maskCompletedChatWords('hell'),'hell');assert.equal(maskCompletedChatWords('hell '),'**** ');
assert.equal(maskChatText(maskCompletedChatWords('fucking')),'*******');
const start=performance.now();for(let i=0;i<100;i++)maskChatText('Appointment confirmed. '.repeat(150));assert.ok(performance.now()-start<2000,'Moderation should stay responsive on long messages');
console.log('PASS: English/Spanish profanity and slurs, accents, casing, separators, repeated letters, leetspeak, Unicode, clean-word false positives, typing delimiters, and message-length performance.');
