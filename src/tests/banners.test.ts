import {test} from "node:test";
import assert from "node:assert/strict";
import {decodeBanner,MAX_BANNER_BYTES} from "../lib/hub-banners.ts";

test("banners accept bounded WebP bytes and reject executable or disguised data",()=>{
  const image = "data:image/webp;base64,UklGRjAAAABXRUJQVlA4ICQAAABwAQCdASoDAAEAAUAmJZgCsAGIQAD+6tR/7g/ph/phnw8AAAA=";
  assert.equal(decodeBanner(image).length,56);
  for (const value of ["data:image/svg+xml;base64,PHN2Zz4=", "https://example.com/image.webp", "data:image/webp;base64,PHNjcmlwdD4=", image.replace("UklG","YWJj")])
    assert.throws(()=>decodeBanner(value));
  assert.throws(()=>decodeBanner("data:image/webp;base64," + Buffer.alloc(MAX_BANNER_BYTES+1).toString("base64")),/too large/);
});
