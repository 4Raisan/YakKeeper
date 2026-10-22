import { test } from "node:test";
import assert from "node:assert/strict";
import {
  projectSchema,
  projectCategories,
  submissionSchema,
  blankProject,
} from "../lib/hub-types.ts";
const valid = {
  ...blankProject,
  repo_id: 123,
  title: "YakKeeper",
  summary: "A shared project collaboration board.",
  description: "Find teammates and build public projects together.",
  needs: "Frontend",
};
test("project links reject executable or malformed URLs", () => {
  for (const demo of [
    "javascript:alert(1)",
    "data:text/html,test",
    "//example.com",
    "https://",
    "file:///secret",
  ])
    assert.equal(projectSchema.safeParse({ ...valid, demo }).success, false);
  for (const demo of ["", "https://example.com", "http://localhost:3000"])
    assert.equal(projectSchema.safeParse({ ...valid, demo }).success, true);
});
test("publishing requires a repository and bounded valid project fields", () => {
  assert.equal(projectSchema.safeParse(valid).success, true);
  for (const change of [
    { repo_id: 0 },
    { repo_id: -1 },

    { visibility: "admin" },
    { status: "unknown" },
    { needs: "x".repeat(1001) },
    { contributions_open: "yes" },
  ])
    assert.equal(
      projectSchema.safeParse({ ...valid, ...change }).success,
      false,
    );
});
test("applications use server identity and validate message/honeypot", () => {
  const value = {
    project_id: "1cb487fd-c7bf-491c-9412-bde2affc704a",
    kind: "contribution",
    message: "I can help build the React frontend each weekend.",
    website: "",
  };
  assert.equal(submissionSchema.safeParse(value).success, true);
  for (const change of [
    { project_id: "preview" },
    { message: "short" },
    { website: "spam" },
    { kind: "admin" },
    { message: "x".repeat(4001) },
  ])
    assert.equal(
      submissionSchema.safeParse({ ...value, ...change }).success,
      false,
    );
});

test("repository display fields cannot be supplied through collaboration inputs", () => {
  const parsed = projectSchema.parse({...valid, title:"Forged title", tags:"Forged skills"});
  assert.equal("title" in parsed, false);
  assert.equal("tags" in parsed, false);
  assert.equal("summary" in parsed, false);
  assert.equal("description" in parsed, false);
});

 test("owners may omit needs but both request kinds need an explanation", () => {
  for(const needs of [undefined,"","  ","UI"]) assert.equal(projectSchema.safeParse({...valid,needs}).success,true);
  for(const kind of ["idea","contribution"]) {
   const base={project_id:"1cb487fd-c7bf-491c-9412-bde2affc704a",kind,website:""};
   for(const message of [undefined,"","   ","short"]) assert.equal(submissionSchema.safeParse({...base,message}).success,false);
   assert.equal(submissionSchema.safeParse({...base,message:"I can help improve the frontend accessibility."}).success,true);
  }
 });

test("practical project categories share the editor validation and keep legacy listings valid",()=>{
 for(const category of projectCategories) assert.equal(projectSchema.safeParse({...valid,category}).success,true);
 for(const category of ["Software","Websites","Web apps","Tools","Documentation","Machine learning"]) assert.ok(projectCategories.includes(category as typeof projectCategories[number]));
 assert.equal(projectSchema.safeParse({...valid,category:"arbitrary unlisted type"}).success,false);
});
