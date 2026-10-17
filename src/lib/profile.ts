import type { Profile } from "../types";

export const DEFAULT_NAME = "John Doe";

/** Commit a name once the user submits it, rather than storing every keystroke. */
export function profileForName(input: string, profile: Profile): Profile {
  const name = input.trim().replace(/\s+/g, " ").slice(0, 80) || DEFAULT_NAME;
  const handle = name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") || "johndoe";
  return { ...profile, name, handle: `@${handle}` };
}

/** Replace the old demo identity without discarding a visitor's own profile. */
export function restoreProfile(value: unknown): Profile {
  const fallback: Profile = { name: DEFAULT_NAME, handle: "@johndoe", plan: "Standard" };
  if (!value || typeof value !== "object") return fallback;
  const profile = value as Partial<Profile>;
  if (typeof profile.name !== "string") return fallback;
  const legacy = profile.name === "Leonard Lopez" && profile.handle === "@leonardlopez";
  const restored = profileForName(legacy ? "" : profile.name, {
    ...fallback,
    plan: typeof profile.plan === "string" && profile.plan.trim() ? profile.plan : fallback.plan,
  });
  if (!legacy && profile.name.trim() && typeof profile.handle === "string" && profile.handle.trim().length > 1) {
    restored.handle = profile.handle;
  }
  return restored;
}
