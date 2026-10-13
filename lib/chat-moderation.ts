// Local, deterministic moderation: raw message text never goes to another service.
// Keep ordinary words (including Spanish color words) intact. Extend this list
// when a new spelling is reported; a dictionary cannot infer every euphemism.
const terms = new Set([
  "ass", "asses", "asshole", "assholes", "arse", "arsehole", "bastard", "bastards",
  "bitch", "bitches", "bitching", "bullshit", "crap", "crappy", "cunt", "cunts",
  "damn", "damned", "dammit", "goddamn", "goddamned", "goddammit", "hell",
  "dick", "dicks", "dickhead", "dickheads", "cock", "cocks", "cocksucker", "cocksuckers",
  "fuck", "fucks", "fucked", "fucking", "fucker", "fuckers", "fuckin", "fuk", "fck", "fuc",
  "motherfucker", "motherfuckers", "motherfucking", "mf", "wtf", "stfu", "sob",
  "shit", "shits", "shitty", "shitting", "shite", "shithead", "shitheads", "shithole",
  "piss", "pissed", "pissing", "pussy", "pussies", "slut", "sluts", "whore", "whores",
  "wanker", "wankers", "twat", "prick", "pricks", "bollocks", "bugger", "douchebag",
  "mierda", "mierdas", "mierdero", "mierderos", "puta", "putas", "puto", "putos",
  "putazo", "putazos", "putamadre", "hijoputa", "hijodeputa", "hijosdeputa", "hijadelaputa",
  "cabron", "cabrones", "cabrona", "cabronas", "chingar", "chinga", "chingas", "chingan",
  "chingado", "chingada", "chingados", "chingadas", "chingue", "chingo", "chingon", "chingona",
  "chingones", "chingando", "chingate", "chingadera", "chinga tu madre", "chingas tu madre",
  "pinche", "pinches", "pendejo", "pendeja", "pendejos", "pendejas", "pendejada", "pendejadas",
  "joder", "jodido", "jodida", "jodidos", "jodidas", "jodete", "jodiendo", "jodase",
  "carajo", "carajos", "coño", "coños", "cojones", "cojon", "culero", "culera", "culeros",
  "culo", "culos", "verga", "vergas", "vergazo", "vergazos", "a la verga", "me cago",
  "maldito", "maldita", "malditos", "malditas", "maldito dios", "dios maldito",
  "dios condene", "dios te maldiga", "maldita sea", "hijo de perra", "hijos de perra",
  "gilipollas", "hostia", "hostias", "la concha de tu madre", "pelotudo", "pelotuda",
  "boludo", "boluda", "culiao", "culiado", "conchetumadre", "mamon", "mamona", "mamones",
  "nigger", "niggers", "nigga", "niggas", "niggah", "niggahs", "negrata", "negratas",
  "wetback", "wetbacks", "beaner", "beaners", "spic", "spics", "chink", "chinks",
  "gook", "gooks", "kike", "kikes", "raghead", "ragheads", "towelhead", "towelheads",
  "redskin", "redskins", "coon", "coons", "darkie", "darkies", "paki", "pakis",
  "faggot", "faggots", "fag", "fags", "dyke", "dykes", "tranny", "trannies",
  "maricon", "maricones", "marica", "maricas", "joto", "jotos", "retard", "retarded",
  "mojado", "mojados", "sudaca", "sudacas", "panchito", "panchitos",
]);
const substitutions: Record<string,string> = {"0":"o","1":"i","3":"e","4":"a","5":"s","7":"t","@":"a","$":"s"};
function normalized(text:string){
  let value=""; const positions:{start:number;end:number}[]=[];let index=0;
  for(const character of text){
    const end=index+character.length;
    const clean=character.normalize("NFKD").replace(/[\p{M}\u200b-\u200d\ufeff]/gu,"").toLowerCase();
    for(const letter of clean){const mapped=letter==="!"&&/[\p{L}\p{N}]/u.test(text[index-1]||"")&&/[\p{L}\p{N}]/u.test(text[end]||"")?"i":substitutions[letter]||letter;value+=mapped;for(let unit=0;unit<mapped.length;unit++)positions.push({start:index,end});}
    // Combining marks belong to the preceding character's masked span.
    if(!clean&&positions.length)positions[positions.length-1].end=end;
    index=end;
  }
  return {value,positions};
}
const separator="[\\s._*'’\\-]*";
const patterns=[...terms].map(term=>normalized(term).value.replace(/\s/g,"")).sort((a,b)=>b.length-a.length).map(term=>[...term].map(letter=>`${letter}+`).join(separator));
const matcher=new RegExp(`(?<![\\p{L}\\p{N}])(?:${patterns.join("|")})(?![\\p{L}\\p{N}])`,"gu");
export function maskChatText(text:string):string{
  const {value,positions}=normalized(text);const ranges:{start:number;end:number}[]=[];
  for(const match of value.matchAll(matcher)){
    ranges.push({start:positions[match.index].start,end:positions[match.index+match[0].length-1].end});
  }
  let result="",cursor=0;
  for(const range of ranges){result+=text.slice(cursor,range.start)+"*".repeat([...text.slice(range.start,range.end)].length);cursor=range.end;}
  return result+text.slice(cursor);
}
// Wait for a delimiter while typing so "hello" and "assistance" are not
// destroyed when the user has only typed their first few letters.
export function maskCompletedChatWords(text:string):string{
  const lastWord=text.match(/[\p{L}\p{N}@$!*._'’\-\u200b-\u200d]+$/u);
  if(!lastWord)return maskChatText(text);
  const index=lastWord.index!;return maskChatText(text.slice(0,index))+text.slice(index);
}
