'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {inspect}=require('./inspect-native-widget-pair.cjs');
if(require.main===module){
 inspect().then(result=>{
  const out=path.join(__dirname,'native-widget-pair-readonly-evidence.json');
  fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  process.stdout.write(JSON.stringify({out,pair_assessment:result.pair_assessment},null,2)+'\n');
 }).catch(e=>{process.stderr.write(String(e.stack||e)+'\n');process.exitCode=1});
}
module.exports={inspect};
