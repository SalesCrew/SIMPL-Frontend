import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Select } from "./Select";

const options = [
  { value: "", label: "Niemand" },
  { value: "anna", label: "Anna" },
];

describe("Select presentation variants", () => {
  it("uses the shared form treatment by default", () => {
    const html = renderToStaticMarkup(
      <Select
        label="Zugewiesen an"
        value="anna"
        onValueChange={() => {}}
        options={options}
      />,
    );
    expect(html).toContain('class="select-trigger select-field"');
    expect(html).toContain('aria-label="Zugewiesen an"');
    expect(html).toContain('role="combobox"');
  });
  it.each(["toolbar", "filter"] as const)(
    "keeps %s controls outside the form redesign",
    (variant) => {
      const html = renderToStaticMarkup(
        <Select
          label="Filter"
          value="anna"
          onValueChange={() => {}}
          options={options}
          variant={variant}
        />,
      );
      expect(html).toContain(`class="select-trigger select-${variant}"`);
      expect(html).not.toContain("select-field");
    },
  );
  it("preserves disabled semantics", () => {
    const html = renderToStaticMarkup(
      <Select
        label="Spalte"
        value="anna"
        onValueChange={() => {}}
        options={options}
        disabled
      />,
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain('data-disabled=""');
  });
  it("keeps empty values selectable without confusing the placeholder", () => {
    const html = renderToStaticMarkup(
      <Select
        label="Zugewiesen an"
        value=""
        onValueChange={() => {}}
        options={options}
      />,
    );
    expect(html).not.toContain('data-placeholder=""');
    const missing = renderToStaticMarkup(
      <Select label="Zugewiesen an" value="" onValueChange={() => {}} options={[]} />,
    );
    expect(missing).toContain('data-placeholder=""');
  });
});
