import fs from "node:fs/promises";
const shas = { Regular:'6fc7a2c8c28fe5e1db627fa0f85098465be477f5', Medium:'9b2ca819e9ca521a3a222d4c399f2b216a91bfd7', Bold:'80785f652abca38f078b5ff7a68c26ce5ce117cb', Black:'9fb02150c36f71638d2962b2966b1a1193b29fdc' };
for (const [n,sha] of Object.entries(shas)) {
  const r=await fetch('https://api.github.com/repos/IKKI2000/harmonyos-fonts/git/blobs/'+sha,{headers:{'User-Agent':'trisolaris'}});
  const j=await r.json();
  const buf=Buffer.from(j.content,'base64');
  await fs.writeFile('public/fonts/HarmonyOS_Sans_SC_'+n+'.woff2',buf);
  console.log(n,buf.length,j.encoding);
}
