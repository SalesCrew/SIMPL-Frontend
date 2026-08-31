export function activeDocsSection<SectionId extends string>(
  sections: { id: SectionId; top: number }[],
  marker: number,
): SectionId | "" {
  let active: SectionId | "" = sections[0]?.id || "";
  for (const section of sections) {
    if (section.top > marker) break;
    active = section.id;
  }
  return active;
}
