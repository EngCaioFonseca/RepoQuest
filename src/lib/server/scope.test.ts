import { vi } from "vitest";
import { describe, expect, it } from "vitest";
import { parseScopeFromRequest, resolveTrackedScope, ScopeError } from "./scope";

vi.mock("server-only", () => ({}));

describe("scope parsing", () => {
  it("parses global and repository scopes", () => {
    const global = parseScopeFromRequest(new Request("http://localhost:3111/api/dashboard"));
    const local = parseScopeFromRequest(new Request("http://localhost:3111/api/dashboard?repository=chaoss%2F8Knot"));
    expect(global).toEqual({ kind: "global" });
    expect(local).toEqual({ kind: "repository", repositoryId: "chaoss/8knot" });
  });

  it("rejects duplicate and unknown query keys", () => {
    expect(() => parseScopeFromRequest(new Request("http://localhost:3111/api/dashboard?repository=a%2Fb&repository=c%2Fd"))).toThrow(ScopeError);
    expect(() => parseScopeFromRequest(new Request("http://localhost:3111/api/dashboard?foo=bar"))).toThrow(ScopeError);
  });

  it("resolves canonical tracked casing and rejects untracked repositories", () => {
    const resolved = resolveTrackedScope({ kind: "repository", repositoryId: "chaoss/8knot" }, ["chaoss/8Knot", "chaoss/CollectOSS"]);
    expect(resolved).toEqual({ kind: "repository", repositoryId: "chaoss/8Knot" });
    expect(() => resolveTrackedScope({ kind: "repository", repositoryId: "chaoss/other" }, ["chaoss/8Knot"])).toThrow(ScopeError);
  });
});
