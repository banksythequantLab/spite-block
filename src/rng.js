export function mulberry32(seed){ let a=seed>>>0; return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}; }
export function dailySeed(d=new Date()){ const s=`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; let h=2166136261; for(const ch of s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);} return h>>>0; }
