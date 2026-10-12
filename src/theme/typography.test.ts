// Node test (jest.config.js): reads the Android font folder to check every variant resolves to a shipped file.
/// <reference types="node" />
import { existsSync } from "fs";
import { join } from "path";
import {
  createTypography,
  fontFamilies,
  fontFor,
  normalizeFontWeight,
  withBrandFont,
  type FontWeight,
} from "./typography";

const FONTS_DIR = join(__dirname, "../../android/app/src/main/assets/fonts");

/** The file React Native's ReactFontManager opens for an asset font: `<family>[_bold].ttf`, bold from 700. */
function androidFontFile(family: string, weight: FontWeight): string {
  return `${family}${Number(weight) >= 700 ? "_bold" : ""}.ttf`;
}

describe("typography (Android: Inter)", () => {
  const android = createTypography("android");

  it("gives every variant the Inter family that matches its weight", () => {
    for (const [name, style] of Object.entries(android)) {
      const weight = style.fontWeight as FontWeight;
      expect([name, style.fontFamily]).toEqual([name, fontFor(weight, "android").fontFamily]);
      expect(Object.values(fontFamilies)).toContain(style.fontFamily);
    }
  });

  it("ships the font file each variant resolves to", () => {
    for (const style of Object.values(android)) {
      const file = androidFontFile(style.fontFamily!, style.fontWeight as FontWeight);
      expect([file, existsSync(join(FONTS_DIR, file))]).toEqual([file, true]);
    }
    expect(existsSync(join(FONTS_DIR, "Inter-OFL.txt"))).toBe(true);
  });

  it("uses tabular figures for KPI and money", () => {
    expect(android.kpi.fontVariant).toEqual(["tabular-nums"]);
    expect(android.amount.fontVariant).toEqual(["tabular-nums"]);
  });

  it("keeps the system font where Inter is not bundled", () => {
    for (const style of Object.values(createTypography("ios"))) {
      expect(style).not.toHaveProperty("fontFamily");
    }
  });
});

describe("fontFor", () => {
  it("maps each weight to its own Inter file", () => {
    expect(fontFor("400", "android")).toEqual({ fontFamily: "Inter", fontWeight: "400" });
    expect(fontFor("500", "android")).toEqual({ fontFamily: "Inter-Medium", fontWeight: "500" });
    expect(fontFor("600", "android")).toEqual({ fontFamily: "Inter-SemiBold", fontWeight: "600" });
    expect(fontFor("700", "android")).toEqual({ fontFamily: "Inter", fontWeight: "700" });
    expect(fontFor("600", "ios")).toEqual({ fontWeight: "600" });
  });

  it("normalises any React Native weight to 400-700", () => {
    expect(normalizeFontWeight(undefined)).toBe("400");
    expect(normalizeFontWeight("normal")).toBe("400");
    expect(normalizeFontWeight("300")).toBe("400");
    expect(normalizeFontWeight(500)).toBe("500");
    expect(normalizeFontWeight("semibold")).toBe("600");
    expect(normalizeFontWeight("bold")).toBe("700");
    expect(normalizeFontWeight("800")).toBe("700");
    expect(normalizeFontWeight(900)).toBe("700");
  });
});

describe("withBrandFont", () => {
  it("re-picks the family for an overridden weight", () => {
    const body = createTypography("android").body;
    expect(withBrandFont({ ...body, fontWeight: "600" }, "android")).toMatchObject({
      fontFamily: "Inter-SemiBold",
      fontWeight: "600",
    });
    expect(withBrandFont({ ...fontFor("600", "android"), fontWeight: "700" }, "android")).toMatchObject({
      fontFamily: "Inter",
      fontWeight: "700",
    });
  });

  it("leaves other families and other platforms alone", () => {
    const cursive = { fontFamily: "cursive", fontWeight: "700" as const };
    expect(withBrandFont(cursive, "android")).toBe(cursive);
    const plain = { fontWeight: "600" as const };
    expect(withBrandFont(plain, "ios")).toBe(plain);
  });
});
