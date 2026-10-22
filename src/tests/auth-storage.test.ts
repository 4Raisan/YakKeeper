import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeAuthStorage} from '../lib/supabase-browser.ts';
test('browser storage discards GitHub provider tokens while retaining the app session and PKCE verifier',()=>{
 const session=JSON.parse(sanitizeAuthStorage(JSON.stringify({access_token:'app-session',refresh_token:'app-refresh',provider_token:'github-secret',provider_refresh_token:'github-refresh',user:{id:'123'}})));
 assert.equal(session.provider_token,undefined);assert.equal(session.provider_refresh_token,undefined);assert.equal(session.access_token,'app-session');assert.equal(session.refresh_token,'app-refresh');assert.equal(session.user.id,'123');
 assert.equal(sanitizeAuthStorage('pkce-verifier'),'pkce-verifier');assert.equal(sanitizeAuthStorage(JSON.stringify('pkce-verifier')),JSON.stringify('pkce-verifier'));
});
