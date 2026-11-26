import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Additive integration. The existing installed Browser Bridge is not touched:
// input must match an inspected exact SHA, and output is always a NEW staging dir.
const EXACT_SOURCE_SHA='4486892bbeab0623f82c69516d3570ce1f02c6b53e9913501945461e4712f345';
const [source,targetDir,componentDir] = process.argv.slice(2);
if(!source||!targetDir||!componentDir)throw Error('Usage: node integrate.mjs <inspected-server.mjs> <new-output-dir> <candidate-root>');
const sourceBytes=fs.readFileSync(source);
const sourceSHA=crypto.createHash('sha256').update(sourceBytes).digest('hex');
if(sourceSHA!==EXACT_SOURCE_SHA)throw Error('INPUT_BRIDGE_SHA_MISMATCH');
const input=sourceBytes.toString('utf8');
let output=input;
const ensureReplace=(a,b)=>{
 if(!output.includes(a)||output.indexOf(a)!==output.lastIndexOf(a))throw Error('BRIDGE_PATCH_ANCHOR_MISMATCH:'+a.slice(0,65));
 output=output.replace(a,b);
};
ensureReplace(
 "import { createBrowserCompanionAdapter } from './browser-companion-adapter.mjs';",
 "import { createBrowserCompanionAdapter } from './browser-companion-adapter.mjs';\n"+
 "import { routeCompanionRequest, companionRouteEligible } from './browser-companion-routes.mjs';\n"+
 "import { createBroker as createBrowserCompanionBroker } from './browser-companion-broker.mjs';"
);
ensureReplace(
 "const browserCompanionEnabled = process.env.LUCH_BROWSER_COMPANION_ENABLED === '1';",
 "const browserCompanionEnabled = process.env.LUCH_BROWSER_COMPANION_ENABLED === '1';\n"+
 "const embeddedCompanion = browserCompanionEnabled && process.env.LUCH_BROWSER_COMPANION_EMBEDDED === '1' ? createBrowserCompanionBroker({bridgeToken:TOKEN}) : null;"
);
const gate="if (req.method === 'POST' && url.pathname.startsWith('/v1/') && url.pathname !== '/v1/browser/start') {";
const target="const data = await readJson(req);";
const where=output.indexOf(gate);if(where<0)throw Error('BRIDGE_ROUTE_GATE_MISSING');
const after=output.indexOf(target,where);if(after<0||after>where+240)throw Error('BRIDGE_ROUTE_PARSE_MISMATCH');
const needle=gate+'\n      '+target;
ensureReplace(needle,needle+"\n      if(browserCompanionEnabled&&companionRouteEligible(url.pathname,data)&&url.pathname!=='/v1/text'){\n"+
 "        const companionResult=await routeCompanionRequest(url.pathname,data,browserCompanion);\n"+
 "        return sendJson(res,companionResult.status,companionResult.body);\n      }"
);
const listen="server.listen(PORT, HOST, () => {";
ensureReplace(listen,"if(embeddedCompanion){embeddedCompanion.listen().then(()=>console.log('LUCH_BROKER_READY_LOCAL_ONLY')).catch(e=>{console.error('LUCH_BROKER_START_ERROR',e.code||e.message);process.exitCode=1;});}\n"+listen);
if(path.resolve(targetDir)===path.resolve(path.dirname(source)))throw Error('REFUSE_OVERWRITE_SOURCE');
fs.mkdirSync(targetDir,{recursive:true,mode:0o700});
fs.writeFileSync(path.join(targetDir,'server.mjs'),output,{flag:'wx',mode:0o600});
for(const [from,to] of [
 ['bridge-integration/browser-companion-routes.mjs','browser-companion-routes.mjs'],
 ['bridge-integration/browser-companion-adapter.mjs','browser-companion-adapter.mjs'],
 ['bridge-adapter/consented-tab-adapter.mjs','browser-companion-consented-adapter.mjs'],
 ['broker/server.mjs','browser-companion-broker.mjs']
]){
 const sourceFile=path.join(componentDir,from);
 fs.copyFileSync(sourceFile,path.join(targetDir,to),fs.constants.COPYFILE_EXCL);
}
console.log(JSON.stringify({staged:true,source_sha:sourceSHA,files:fs.readdirSync(targetDir)}));
