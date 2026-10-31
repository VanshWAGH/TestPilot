import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("Web Utils", () => {
  it("should merge class names correctly", () => {
    const result = cn("p-4", "text-red-500", { "font-bold": true, "hidden": false });
    expect(result).toBe("p-4 text-red-500 font-bold");
  });
});
