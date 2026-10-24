const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function nodes(n){return !n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];}
function gate(){
 const state=[],refs=[],effects=[];let index=0,refIndex=0,listener,restoreResolve,restoreReject,loginResolve,calls=0;
 const restore=new Promise((resolve,reject)=>{restoreResolve=resolve;restoreReject=reject;});
 const session={user:{id:'synthetic'},access_token:'synthetic-token'};
 const react={createContext:()=>({Provider:()=>null}),useContext:()=>null,useRef:value=>refs[refIndex++]??(refs[refIndex-1]={current:value}),useEffect:fn=>effects.push(fn),useState:initial=>{const i=index++;if(!(i in state))state[i]=i===0?false:i===2?'fixture@example.test':i===3?'synthetic-password':initial;return[state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];}};
 const auth={onAuthStateChange:fn=>{listener=fn;return{data:{subscription:{unsubscribe(){}}}};},signInWithPassword:()=>{calls++;return new Promise(resolve=>{loginResolve=resolve;});}};
 const exports={};const deps={react,'react/jsx-runtime':require('react/jsx-runtime'),'next/image':{default:()=>null},'@/components/branding/software-logo':{SoftwareLogo:()=>null},'./required-password-change':{PasswordRequirement:()=>null},'@/lib/supabase-browser':{isSupabaseConfigured:()=>true,getSupabaseBrowserClient:()=>({auth}),restoreBrowserSession:()=>restore,getSessionLabel:()=>'',getSupabaseConfigError:()=>''}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/auth/supabase-session-gate.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>deps[n],process:{env:{NODE_ENV:'test'}},window:{setTimeout:()=>1,clearTimeout(){}},console});
 const tree=exports.SupabaseSessionGate({children:null});
 return{state,session,effect:()=>effects[0](),submit:()=>nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}}),calls:()=>calls,login:result=>loginResolve(result),event:()=>listener('SIGNED_IN',session),resolve:()=>restoreResolve({data:{session:null},error:null}),reject:()=>restoreReject(Error('old check failed'))};
}
test('rapid repeated submits send only one password request and permit retry after failure',async()=>{
 const h=gate();const first=h.submit();await h.submit();assert.equal(h.calls(),0);h.resolve();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.calls(),1);h.login({data:{session:null},error:{message:'temporarily unavailable'}});await first;assert.equal(h.state[7],false);
 const retry=h.submit();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.calls(),2);h.login({data:{session:h.session},error:null});await retry;assert.equal(h.state[4],h.session);assert.equal(h.state[3],'');
});
for(const fail of [false,true])test(`late session restoration ${fail?'failure':'empty result'} cannot overwrite a new sign-in`,async()=>{
 const h=gate();const cleanup=h.effect();h.event();if(fail)h.reject();else h.resolve();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.state[4],h.session);assert.equal(h.state[6],'');cleanup();
});
