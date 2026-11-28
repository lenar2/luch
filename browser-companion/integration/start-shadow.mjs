import {readFileSync} from 'node:fs';
import {createLuchBrowserBridgeProxy} from './local-bridge-proxy.mjs';
const file=process.env.LUCH_BRIDGE_TOKEN_FILE;
if(!file)throw new Error('LUCH_BRIDGE_TOKEN_FILE_REQUIRED');
const token=readFileSync(file,'utf8').trim();
const proxy=createLuchBrowserBridgeProxy({
  bridgeToken:token,
  port:Number(process.env.LUCH_COMPANION_SHADOW_PORT||9251),
  upstream:process.env.LUCH_BRIDGE_UPSTREAM||'http://127.0.0.1:9240',
  companion:process.env.LUCH_COMPANION_BROKER||'http://127.0.0.1:9248'
});
await proxy.listen();
console.log('LUCH Browser Companion shadow router listening on 127.0.0.1');
