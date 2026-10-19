export const HARDWARE_GROUPS = [['tools','Tools'],['electrical','Electrical'],['paints','Paints'],['lighting','Lighting'],['consumables','Consumables'],['ladders','Ladders'],['trolleys','Trolleys'],['plumbing','Plumbing']];
export function hardwareFilterMatch(p,filter='hardware'){
 const groups=Array.isArray(p?.hardware_groups)?p.hardware_groups:[];
 return filter==='hardware'?groups.length>0:filter.startsWith('hardware-')&&groups.includes(filter.slice(9));
}
export function mergeHardwareCatalogue(existing,rows,normalise){
 const all=[...existing],codes=new Map(),names=new Map();
 const norm=s=>String(s??'').trim().toLowerCase().replace(/\s+/g,' ');
 all.forEach((p,i)=>{
  if(!p)return;
  const code=norm(p._code),name=norm(p._name);
  if(code&&!codes.has(code))codes.set(code,i);
  if(name&&!names.has(name))names.set(name,i);
 });
 for(const row of (Array.isArray(rows)?rows:[])){
  if(!row||typeof row!=='object')continue;
  const name=norm(row.name),code=norm(row.code);
  // Empty codes must never be interpreted as array indices or valid matches.
  const codeMatch=code?codes.get(code):undefined;
  const nameMatch=name?names.get(name):undefined;
  const match=codeMatch??nameMatch;
  const groups=Array.isArray(row.hardware_groups)?row.hardware_groups:[];
  if(Number.isInteger(match)&&match>=0&&match<all.length&&all[match]){
   const old=all[match];
   const oldGroups=Array.isArray(old.hardware_groups)?old.hardware_groups:[];
   all[match]={...old,hardware_groups:[...new Set([...oldGroups,...groups]) ]};
  }else{
   const product=normalise(row,'hardware');
   product.hardware_groups=groups;
   const i=all.length;all.push(product);
   if(code&&!codes.has(code))codes.set(code,i);
   if(name&&!names.has(name))names.set(name,i);
  }
 }
 return all;
}
