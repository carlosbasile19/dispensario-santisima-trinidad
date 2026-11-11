import assert from "node:assert/strict";
import test from "node:test";

import { canOptimizeAvatar } from "../src/lib/avatar-image.ts";

test("only recognized public avatars are sent through the restricted image optimizer", () => {
  const origin = "https://clinic.supabase.co";
  assert.equal(canOptimizeAvatar(`${origin}/storage/v1/object/public/avatars/member/123.jpg`, origin), true);
  for (const src of [
    "https://external.test/avatar.jpg",
    "blob:http://localhost:3000/photo",
    `${origin}/storage/v1/object/sign/lab-signatures/signature.png?token=private`,
    `${origin}/storage/v1/object/public/avatars/photo.jpg?version=2`,
    "http://clinic.supabase.co/storage/v1/object/public/avatars/photo.jpg",
    "invalid URL",
  ]) assert.equal(canOptimizeAvatar(src, origin), false, src);
});
