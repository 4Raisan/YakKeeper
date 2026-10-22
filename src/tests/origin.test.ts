import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sameOrigin,requestOrigin} from '../lib/hub-security.ts';
test('uses the incoming host when Next.js normalizes its internal request URL',()=>{
 const request=new Request('http://localhost:3000/api/hub',{headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000'}});
 assert.equal(sameOrigin(request),true);
 assert.equal(requestOrigin(request),'http://127.0.0.1:3000');
});
test('honors the trusted Vercel forwarded protocol without accepting another origin',()=>{
 const headers={host:'yakkeeper.example','x-forwarded-proto':'https',origin:'https://yakkeeper.example'};
 assert.equal(sameOrigin(new Request('http://localhost/api/hub',{headers})),true);
 assert.equal(sameOrigin(new Request('http://localhost/api/hub',{headers:{...headers,origin:'https://untrusted.example'}})),false);
 assert.equal(sameOrigin(new Request('http://localhost/api/hub',{headers:{host:'yakkeeper.example'}})),false);
});
