import { describe, expect, it } from "vitest";
import { APP_MENU_ITEMS, AUTHENTICATED_APP_MENU_ITEMS } from "../lib/app-menu";

describe("app menu", () => {
  it("contains a Routes link to the public route catalog", () => {
    expect(APP_MENU_ITEMS).toContainEqual({ label: "Routes", href: "/routes" });
  });

  it("contains authenticated links for own and private routes", () => {
    expect(AUTHENTICATED_APP_MENU_ITEMS).toEqual([
      { label: "My Routes", href: "/routes?visibility=my" },
      { label: "Private Routes", href: "/routes?visibility=private" },
    ]);
  });
});
