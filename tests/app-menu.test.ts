import { describe, expect, it } from "vitest";
import { APP_MENU_ITEMS } from "../lib/app-menu";

describe("app menu", () => {
  it("contains a Routes link to the public route catalog", () => {
    expect(APP_MENU_ITEMS).toContainEqual({ label: "Routes", href: "/routes" });
  });
});
