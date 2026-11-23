import { describe, it, expect } from "vitest";
import { authorize, extractBearer, type AuthzDeps } from "../lib/auth";

// Injected dependencies: a fake token verifier + allow-list.
// "good"  -> a coordinator email; "user" -> an ordinary authenticated user;
// anything else -> invalid token.
function deps(over: Partial<AuthzDeps> = {}): AuthzDeps {
  return {
    verifyToken: async (t) =>
      t === "good"
        ? { email: "coord@demo.test" }
        : t === "user"
          ? { email: "random@demo.test" }
          : null,
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

  it("AUTHORIZED for a coordinator on the allow-list", async () => {
    expect(await authorize("good", deps())).toBe("AUTHORIZED");
  });

  it("cannot be bypassed: only the server allow-list decides, not token claims", async () => {
    // Even a valid, 'privileged-looking' token is FORBIDDEN unless the verified
    // email is actually on the server-side allow-list.
    const d = deps({ isCoordinator: async () => false });
    expect(await authorize("good", d)).toBe("FORBIDDEN");
  });
});
