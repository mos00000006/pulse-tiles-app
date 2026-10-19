export const HARDWARE_GROUPS = [['tools','Tools'],['electrical','Electrical'],['paints','Paints'],['lighting','Lighting'],['consumables','Consumables'],['ladders','Ladders'],['trolleys','Trolleys'],['plumbing','Plumbing']];
export function hardwareFilterMatch(p,filter='hardware'){
 const groups=Array.isArray(p.hardware_groups)?p.hardware_groups:[];
 return filter==='hardware'?groups.length>0:filter.startsWith('hardware-')&&groups.includes(filter.slice(9));
}
export function mergeHardwareCatalogue(existing,rows,normalise){
 const all=[...existing],codes=new Map(),names=new Map();
 const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
 all.forEach((p,i)=>{if(p._code)codes.set(norm(p._code),i);const n=norm(p._name);if(n&&!names.has(n))names.set(n,i)});
 for(const row of rows){
  const name=norm(row.name),code=norm(row.code),match=(code&&codes.get(code))??names.get(name);
  if(match!==undefined){
   const old=all[match];
   all[match]={...old,hardware_groups:[...new Set([...(old.hardware_groups||[]),...(row.hardware_groups||[])])]};
  }else{
   const p=normalise(row,'hardware');const i=all.length;all.push(p);
   if(code)codes.set(code,i);if(name)names.set(name,i);
  }
 }
 return all;
}
