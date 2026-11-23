import { describe, it, expect } from "vitest";
import { authorize, extractBearer, type AuthzDeps } from "../lib/auth";

// Injected dependencies (no network). Tokens:
//   "coord"    -> coordinator, email verified
//   "coord-nv" -> coordinator email but NOT verified
//   "user"     -> ordinary authenticated user, verified
//   anything else -> invalid token
function deps(over: Partial<AuthzDeps> = {}): AuthzDeps {
  return {
    verifyToken: async (t) => {
      if (t === "coord") return { email: "coord@demo.test", emailVerified: true };
      if (t === "coord-nv")
        return { email: "coord@demo.test", emailVerified: false };
      if (t === "user")
        return { email: "random@demo.test", emailVerified: true };
      return null;
    },
    isCoordinator: async (email) => email === "coord@demo.test",
    ...over,
  };
}

describe("extractBearer", () => {
  it("returns the token from a Bearer header", () => {
    expect(extractBearer({ get: () => "Bearer abc.def" })).toBe("abc.def");
  });
  it("is null when the header is missing or malformed", () => {
    expect(extractBearer({ get: () => null })).toBeNull();
    expect(extractBearer({ get: () => "Basic xyz" })).toBeNull();
    expect(extractBearer({ get: () => "Bearer " })).toBeNull();
  });
});

describe("authorize", () => {
  it("UNAUTHENTICATED when no token is supplied", async () => {
    expect(await authorize(null, deps())).toBe("UNAUTHENTICATED");
  });

  it("UNAUTHENTICATED when the token is invalid", async () => {
    expect(await authorize("bogus", deps())).toBe("UNAUTHENTICATED");
  });

  it("FORBIDDEN for an ordinary authenticated user (not a coordinator)", async () => {
    expect(await authorize("user", deps())).toBe("FORBIDDEN");
  });

  it("FORBIDDEN for a coordinator email that is NOT verified", async () => {
    expect(await authorize("coord-nv", deps())).toBe("FORBIDDEN");
  });

  it("AUTHORIZED for a verified coordinator on the allow-list", async () => {
    expect(await authorize("coord", deps())).toBe("AUTHORIZED");
  });

  it("cannot be bypassed: only the server allow-list decides, not token claims", async () => {
    const d = deps({ isCoordinator: async () => false });
    expect(await authorize("coord", d)).toBe("FORBIDDEN");
  });
});
