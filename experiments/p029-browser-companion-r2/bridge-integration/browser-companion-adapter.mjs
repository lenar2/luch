import {makeConsentedTabAdapter} from './browser-companion-consented-adapter.mjs';
export function createBrowserCompanionAdapter({brokerUrl='http://127.0.0.1:9248',tokenProvider,tokenFile,fetchImpl=fetch}={}){
 const out=makeConsentedTabAdapter({brokerUrl,bridgeTokenProvider:tokenProvider,bridgeTokenFile:tokenFile,fetchImpl,timeoutMs:14500});
 return out;
}
