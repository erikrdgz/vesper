import assert from "node:assert/strict";
import { test } from "node:test";
import { profileForName, restoreProfile } from "../src/lib/profile";

const profile = { name: "John Doe", handle: "@johndoe", plan: "Standard" };

test("blank or skipped names use John Doe", () => {
  assert.deepEqual(profileForName(" \n ", profile), profile);
});

test("submitted names are normalized and keep Unicode letters in handles", () => {
  assert.deepEqual(profileForName("  José   李  ", profile), {
    name: "José 李", handle: "@josé李", plan: "Standard",
  });
  assert.equal(profileForName("✨", profile).handle, "@johndoe");
});

test("old sample identity migrates without resetting the plan", () => {
  assert.deepEqual(restoreProfile({ name: "Leonard Lopez", handle: "@leonardlopez", plan: "Pro" }), {
    ...profile, plan: "Pro",
  });
});

test("custom saved names and handles survive loading", () => {
  const saved = { name: "Erik Rodriguez", handle: "@erik", plan: "Standard" };
  assert.deepEqual(restoreProfile(saved), saved);
  assert.equal(restoreProfile({ ...saved, name: "Leonard Lopez" }).name, "Leonard Lopez");
});

test("missing or malformed profile fields get usable defaults", () => {
  for (const value of [null, {}, { name: 42 }, { name: "" }]) {
    assert.deepEqual(restoreProfile(value), profile);
  }
  assert.deepEqual(restoreProfile({ name: "Ada Lovelace" }), {
    ...profile, name: "Ada Lovelace", handle: "@adalovelace",
  });
});
