import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankProject,projectSchema,submissionSchema} from '../lib/hub-types.ts';
const valid={...blankProject,title:'YakKeeper',summary:'A compact project collaboration board.',description:'Share projects and send ideas or contribution requests.'};
test('rejects executable, malformed, and protocol-relative project links',()=>{
 for(const repo of ['javascript:alert(1)','data:text/html,test','//example.com','https://','file:///secret'])assert.equal(projectSchema.safeParse({...valid,repo}).success,false,repo);
 for(const repo of ['','https://github.com/example/project','http://localhost:3000'])assert.equal(projectSchema.safeParse({...valid,repo}).success,true,repo);
});
test('rejects excess input and unsupported visibility states',()=>{
 assert.equal(projectSchema.safeParse({...valid,title:'x'.repeat(121)}).success,false);
 assert.equal(projectSchema.safeParse({...valid,visibility:'admin'}).success,false);
 assert.equal(projectSchema.safeParse({...valid,status:'unknown'}).success,false);
});
test('submission requires a valid project, contact, meaningful message, and empty honeypot',()=>{
 const value={project_id:'1cb487fd-c7bf-491c-9412-bde2affc704a',kind:'idea',name:'Builder',email:'builder@example.com',message:'Improve project filtering with saved tags.',website:''};
 assert.equal(submissionSchema.safeParse(value).success,true);
 for(const change of [{email:'invalid'},{project_id:'preview'},{message:'short'},{website:'spam'},{kind:'admin'},{message:'x'.repeat(4001)}])assert.equal(submissionSchema.safeParse({...value,...change}).success,false);
});
