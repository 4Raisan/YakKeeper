import {test} from 'node:test';
import assert from 'node:assert/strict';
import {latestRequestGate} from '../lib/hub-sync.ts';
test('older fetches cannot overwrite a newer project refresh',()=>{
 const gate=latestRequestGate(),old=gate.next(),recent=gate.next();
 assert.equal(gate.current(old),false);assert.equal(gate.current(recent),true);
});
test('sign-out invalidates pending requests with private account data',()=>{
 const gate=latestRequestGate(),request=gate.next();gate.invalidate();assert.equal(gate.current(request),false);
});
