import {describe, expect, it} from "vitest";
import {parseProfileInput} from "../lib/profile-validation";

describe("profile input", () => {
  it("rejects missing or non-object bodies", () => {
    expect(parseProfileInput(null)).toEqual({error: "invalid JSON body"});
    expect(parseProfileInput("profile")).toEqual({error: "invalid JSON body"});
  });

  it("normalizes valid profile fields", () => {
    expect(parseProfileInput({
      username: "Alice_42",
      displayName: "Alice",
      avatarUrl: "https://example.com/avatar.png",
    })).toEqual({
      value: {
        username: "alice_42",
        displayName: "Alice",
        avatarUrl: "https://example.com/avatar.png",
      },
    });
  });

  it("rejects unsafe or invalid usernames", () => {
    expect(parseProfileInput({username: "ab", displayName: null, avatarUrl: null})).toEqual({
      error: "username must be 3-32 characters using lowercase letters, numbers, or underscores",
    });
    expect(parseProfileInput({username: "a/b", displayName: null, avatarUrl: null})).toEqual({
      error: "username must be 3-32 characters using lowercase letters, numbers, or underscores",
    });
  });

  it("rejects oversized display names", () => {
    expect(parseProfileInput({
      username: "alice",
      displayName: "a".repeat(81),
      avatarUrl: null,
    })).toEqual({error: "display name is too long"});
  });

  it("rejects oversized avatar URLs", () => {
    expect(parseProfileInput({
      username: "alice",
      displayName: null,
      avatarUrl: `https://example.com/${"a".repeat(501)}`,
    })).toEqual({error: "avatar URL is too long"});
  });

  it("rejects non-http avatar URLs", () => {
    expect(parseProfileInput({username: "alice", displayName: null, avatarUrl: "javascript:alert(1)"})).toEqual({
      error: "avatar URL must use http or https",
    });
  });
});
