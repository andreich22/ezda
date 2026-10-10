import {afterEach, describe, expect, it, vi} from "vitest";
import {buildRouteSharePath, buildRouteShareUrl, copyTextToClipboard} from "../lib/route-share";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("route share links", () => {
  it("builds a stable route path from an id", () => {
    expect(buildRouteSharePath("9f2b0a1e-2c3d-4e5f-8a6b-7c8d9e0f1a2b")).toBe(
      "/routes/9f2b0a1e-2c3d-4e5f-8a6b-7c8d9e0f1a2b",
    );
  });

  it("resolves an absolute share URL from a path and origin", () => {
    expect(buildRouteShareUrl("/routes/abc", "https://ezda-eta.vercel.app")).toBe(
      "https://ezda-eta.vercel.app/routes/abc",
    );
  });

  it("accepts a bare route id and resolves it against the origin", () => {
    expect(buildRouteShareUrl("abc", "https://ezda-eta.vercel.app")).toBe(
      "https://ezda-eta.vercel.app/routes/abc",
    );
  });

  it("returns the relative path when no origin is available", () => {
    expect(buildRouteShareUrl("/routes/abc")).toBe("/routes/abc");
  });
});

describe("copyTextToClipboard", () => {
  it("uses the Clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {clipboard: {writeText}});

    const result = await copyTextToClipboard("https://example.test/routes/abc");

    expect(writeText).toHaveBeenCalledWith("https://example.test/routes/abc");
    expect(result).toEqual({ok: true, method: "clipboard"});
  });

  it("falls back to execCommand when the Clipboard API is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    const textarea = {value: "", select: vi.fn(), setAttribute: vi.fn(), style: {}} as unknown as HTMLTextAreaElement;
    const createElement = vi.fn().mockReturnValue(textarea);
    const appendChild = vi.fn();
    const removeChild = vi.fn();
    const execCommand = vi.fn().mockReturnValue(true);
    vi.stubGlobal("document", {createElement, body: {appendChild, removeChild}, execCommand});

    const result = await copyTextToClipboard("https://example.test/routes/abc");

    expect(createElement).toHaveBeenCalledWith("textarea");
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(removeChild).toHaveBeenCalled();
    expect(result).toEqual({ok: true, method: "fallback"});
  });

  it("reports failure without breaking when no clipboard mechanism exists", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("document", undefined);

    const result = await copyTextToClipboard("https://example.test/routes/abc");

    expect(result.ok).toBe(false);
  });

  it("falls back when Clipboard API write is rejected (denied permission)", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", {clipboard: {writeText}});
    const textarea = {value: "", select: vi.fn(), setAttribute: vi.fn(), style: {}} as unknown as HTMLTextAreaElement;
    vi.stubGlobal("document", {
      createElement: vi.fn().mockReturnValue(textarea),
      body: {appendChild: vi.fn(), removeChild: vi.fn()},
      execCommand: vi.fn().mockReturnValue(true),
    });

    const result = await copyTextToClipboard("https://example.test/routes/abc");

    expect(writeText).toHaveBeenCalled();
    expect(result).toEqual({ok: true, method: "fallback"});
  });
});
