'use strict';
/*
 * R115 site deployment store adapter. Resolves a pre-existing site-owned
 * PostgreSQL pool by absolute trusted server config, never by HTTP payload.
 * This adapter does not open or migrate a DB by itself.
 */
const path=require('node:path');
const {createPostgresEventInbox}=require('./provider-relay-webhook.cjs');
function createInboxStore(){
 const modulePath=process.env.BF2026_R115_DB_POOL_MODULE;
 if(!modulePath||!path.isAbsolute(modulePath))throw Error('R115_TRUSTED_POOL_MODULE_REQUIRED');
 const exported=require(modulePath);
 const pool=typeof exported.getPool==='function'?exported.getPool():exported.pool;
 if(!pool||typeof pool.query!=='function')throw Error('R115_POSTGRES_POOL_UNAVAILABLE');
 return createPostgresEventInbox(pool);
}
module.exports={createInboxStore};
