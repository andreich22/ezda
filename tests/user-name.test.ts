import { describe, expect, it } from "vitest";
import { getUsernameFromEmail } from "../lib/user-name";

describe("getUsernameFromEmail", () => {
  it("returns the part before @", () => {
    expect(getUsernameFromEmail("dlyapochti9@gmail.com")).toBe("dlyapochti9");
  });

  it("uses the part before the first @", () => {
    expect(getUsernameFromEmail("rider@example.com@test")).toBe("rider");
  });

  it("returns null for an unavailable email", () => {
    expect(getUsernameFromEmail(null)).toBeNull();
    expect(getUsernameFromEmail("")).toBeNull();
  });
});
