import {describe, expect, it, vi} from "vitest";
import PublicProfilePage from "../app/profile/[username]/page";
import {getPublicProfile, getPublicProfileRoutes} from "../lib/db/profiles";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("../lib/db/profiles", () => ({
  getPublicProfile: vi.fn(),
  getPublicProfileRoutes: vi.fn(),
}));

describe("public profile page", () => {
  it("renders the public profile and its public routes", async () => {
    vi.mocked(getPublicProfile).mockResolvedValue({
      id: "user-1",
      username: "alice",
      displayName: "Alice",
      avatarUrl: null,
      createdAt: new Date("2026-10-01T00:00:00Z"),
      updatedAt: new Date("2026-10-01T00:00:00Z"),
    });
    vi.mocked(getPublicProfileRoutes).mockResolvedValue([{
      id: "route-1",
      title: "Prospect Park Loop",
      description: "A public ride",
      distanceMeters: 10000,
      durationSeconds: 3600,
      elevationGainMeters: 120,
      createdAt: new Date("2026-10-02T00:00:00Z"),
    }]);

    const page = await PublicProfilePage({params: Promise.resolve({username: "Alice"})});
    const children = page.props.children;
    const profileCard = children[1];
    const routeHeading = children[3];
    const routeGrid = children[5];

    expect(getPublicProfile).toHaveBeenCalledWith("Alice");
    expect(getPublicProfileRoutes).toHaveBeenCalledWith("user-1");
    expect(profileCard.props.children[1].props.children[2].props.children).toBe("@alice");
    expect(routeHeading.props.children[0].props.children[1].props.children).toContain("Alice");
    expect(routeGrid.props.children).toHaveLength(1);
    expect(routeGrid.props.children[0].props.href).toBe("/routes/route-1");
  });

  it("returns not found for an unknown profile", async () => {
    vi.mocked(getPublicProfile).mockResolvedValue(null);

    await expect(PublicProfilePage({params: Promise.resolve({username: "unknown"})})).rejects.toThrow("NOT_FOUND");
    expect(getPublicProfileRoutes).not.toHaveBeenCalled();
  });

  it("returns not found for an invalid username", async () => {
    await expect(PublicProfilePage({params: Promise.resolve({username: "bad/name"})})).rejects.toThrow("NOT_FOUND");
    expect(getPublicProfile).not.toHaveBeenCalled();
  });
});
