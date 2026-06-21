import { describe, expect, it } from "vitest";

import {
  PRODUCT_COLORS,
  productKeyFromName,
  resolveProductColor,
} from "./products.js";

describe("productKeyFromName", () => {
  it("slugifies a name", () => {
    expect(productKeyFromName("Mobile App", new Set())).toBe("mobile-app");
  });

  it("disambiguates against taken keys", () => {
    expect(productKeyFromName("Web", new Set(["web"]))).toBe("web-2");
    expect(productKeyFromName("Web", new Set(["web", "web-2"]))).toBe("web-3");
  });

  it("falls back to 'product' for empty slugs", () => {
    expect(productKeyFromName("!!!", new Set())).toBe("product");
  });
});

describe("resolveProductColor", () => {
  it("returns an explicit color when it is a known token", () => {
    expect(resolveProductColor({ color: "blue", key: "web" })).toBe("blue");
  });

  it("derives a palette color from the key when color is null/unset", () => {
    const c = resolveProductColor({ color: null, key: "web" });
    expect(PRODUCT_COLORS).toContain(c);
  });

  it("is deterministic for a given key", () => {
    expect(resolveProductColor({ key: "mobile" })).toBe(
      resolveProductColor({ key: "mobile" }),
    );
  });

  it("ignores an unknown color token and derives from the key", () => {
    expect(resolveProductColor({ color: "fuchsia", key: "web" })).toBe(
      resolveProductColor({ color: null, key: "web" }),
    );
  });
});
