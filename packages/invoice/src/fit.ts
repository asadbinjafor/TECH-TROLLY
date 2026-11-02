// Keep the approved fixed A4 geometry. Only oversized supplied text is fitted;
// no value is truncated, hidden or replaced. Self-contained for page.evaluate.
export async function fitInvoiceLayout(scope?: ParentNode): Promise<boolean> {
  await document.fonts.ready;
  const root = scope || document;
  const body = root.querySelector<HTMLElement>(".tt-memo__items-body");
  const front = root.querySelector<HTMLElement>(".tt-memo__front");
  const back = root.querySelector<HTMLElement>(".tt-memo__back");
  if (!body || !front || !back) return false;
  const rect = (selector: string) =>
    root.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
  const fit = (nodes: HTMLElement[], fits: () => boolean, minimum: number) => {
    for (const node of nodes) node.style.fontSize = "";
    const sizes = nodes.map((node) =>
      parseFloat(getComputedStyle(node).fontSize),
    );
    for (let step = 0; !fits() && step < 16; step++) {
      const factor = Math.max(minimum, 1 - (step + 1) * 0.04);
      nodes.forEach((node, i) => {
        node.style.fontSize = `${sizes[i] * factor}px`;
      });
    }
    return fits();
  };
  const itemsFit = () =>
    body.scrollHeight <= body.clientHeight + 1 &&
    Array.from(
      body.querySelectorAll<HTMLElement>(".tt-memo__product-row"),
    ).every(
      (row) =>
        row.getBoundingClientRect().bottom <=
        body.getBoundingClientRect().bottom + 1,
    );
  const items = fit(
    Array.from(
      body.querySelectorAll<HTMLElement>(".tt-memo__model,.tt-memo__details"),
    ),
    itemsFit,
    0.6,
  );
  const customer = Array.from(
    root.querySelectorAll<HTMLElement>(".tt-memo__field>strong"),
  ).every((node) =>
    fit(
      [node],
      () =>
        node.scrollHeight <= node.clientHeight + 1 &&
        node.scrollWidth <= node.clientWidth + 1,
      0.4,
    ),
  );
  const seller = fit(
    Array.from(root.querySelectorAll<HTMLElement>(".tt-memo__seller strong")),
    () =>
      rect(".tt-memo__accounting").bottom < rect(".tt-memo__authorised").top,
    0.4,
  );
  return (
    items &&
    customer &&
    seller &&
    rect(".tt-memo__warranty ul").bottom <=
      rect(".tt-memo__warranty").bottom + 1 &&
    rect(".tt-memo__terms").bottom < rect(".tt-memo__delivery").top &&
    rect(".tt-memo__thanks").bottom <=
      front.getBoundingClientRect().bottom + 1 &&
    rect(".tt-memo__back-footer").bottom <=
      back.getBoundingClientRect().bottom + 1
  );
}
