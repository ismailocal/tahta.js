import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("package consumer is keyboard accessible and has no axe violations", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });

  await page.goto("/");
  await expect(
    page.getByRole("application", { name: "Interactive whiteboard" }),
  ).toBeVisible();
  await expect(page.getByRole("toolbar", { name: "Canvas tools" })).toBeVisible();

  await page.getByRole("button", { name: "Hand" }).focus();
  await expect(page.getByRole("button", { name: "Hand" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Select" })).toBeFocused();

  await page
    .getByRole("group", { name: "Canvas view controls" })
    .getByRole("button", { name: "Layers" })
    .click();
  const minimap = page.getByRole("application", { name: /Board minimap/ });
  await minimap.focus();
  await page.keyboard.press("ArrowRight");
  await expect(minimap).toBeFocused();

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("ELK and DSL previews run through the built package", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Library" }).click();
  await page.getByRole("menuitem", { name: "Auto layout" }).click();
  await page.getByRole("button", { name: "Build preview" }).click();
  await expect(page.getByLabel("Auto layout preview")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Library" }).click();
  await page.getByRole("menuitem", { name: "Import" }).click();
  await page.getByRole("button", { name: "Build preview" }).click();
  await expect(page.getByText("Validated import plan")).toBeVisible();
  await expect(page.getByText("4 atomic commands")).toBeVisible();

  await page.getByRole("button", { name: "Mermaid" }).click();
  await page.getByLabel("Diagram source").fill("flowchart LR\nA[Start] --> B{Ready?}\nB -->|yes| C(Done)");
  await page.getByRole("button", { name: "Build preview" }).click();
  await expect(page.getByText("Validated import plan")).toBeVisible();
  await expect(page.getByText("5 shapes")).toBeVisible();
  await expect(page.getByText("2 bindings")).toBeVisible();
});

test("standalone SVG, PNG, JPEG, and multi-frame PDF exports are valid", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const fixture = (window as unknown as { __TAHTA_FIXTURE__: { engine: unknown; exportCanvas(engine: unknown, options: { format: string; scale?: number }): Promise<Blob> } }).__TAHTA_FIXTURE__;
    const values: Record<string, { type: string; bytes: number[]; size: number; pageCount?: number; hasEmbeddedFont?: boolean }> = {};
    for (const format of ["svg", "png", "jpeg", "pdf"]) {
      const blob = await fixture.exportCanvas(fixture.engine, { format, scale: 1 });
      const buffer = new Uint8Array(await blob.arrayBuffer());
      const entry = { type: blob.type, bytes: [...buffer.slice(0, 8)], size: buffer.byteLength } as { type: string; bytes: number[]; size: number; pageCount?: number; hasEmbeddedFont?: boolean };
      if (format === "svg") entry.hasEmbeddedFont = new TextDecoder().decode(buffer).includes("@font-face") && new TextDecoder().decode(buffer).includes("data:font/woff2;base64,");
      if (format === "pdf") entry.pageCount = (new TextDecoder("latin1").decode(buffer).match(/\/Type \/Page\b/gu) ?? []).length;
      values[format] = entry;
    }
    return values;
  });

  expect(result.svg?.type).toBe("image/svg+xml"); expect(result.svg?.bytes.slice(0, 4)).toEqual([60, 115, 118, 103]); expect(result.svg?.hasEmbeddedFont).toBe(true);
  expect(result.png?.type).toBe("image/png"); expect(result.png?.bytes).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(result.jpeg?.type).toBe("image/jpeg"); expect(result.jpeg?.bytes.slice(0, 3)).toEqual([255, 216, 255]);
  expect(result.pdf?.type).toBe("application/pdf"); expect(result.pdf?.bytes.slice(0, 5)).toEqual([37, 80, 68, 70, 45]); expect(result.pdf?.pageCount).toBe(2);
  Object.values(result).forEach(({ size }) => expect(size).toBeGreaterThan(100));
});

test("presentation filmstrip thumbnails, fractional reorder, navigation, and deep links work", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await page.getByRole("menuitem", { name: "Presentation" }).click();
  await expect(page.getByRole("img", { name: "Frame 1 preview" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Frame 2 preview" })).toBeVisible();

  await page.getByRole("button", { name: "Move frame earlier" }).nth(1).click();
  const reordered = await page.evaluate(() => (window as unknown as { __TAHTA_FIXTURE__: { engine: { getSnapshot(): { document: { presentation: { frameIds: string[] } } } } } }).__TAHTA_FIXTURE__.engine.getSnapshot().document.presentation.frameIds);
  expect(reordered).toEqual(["frame-two", "frame-one"]);

  await page.getByRole("button", { name: "Start presentation" }).click();
  await expect(page).toHaveURL(/\?frame=frame-two$/u);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/\?frame=frame-one$/u);
  await page.reload();
  await expect(page.getByRole("toolbar", { name: "Presentation controls" })).toBeVisible();
  await expect(page.getByText("1 / 2")).toBeVisible();
  await page.getByRole("button", { name: "Exit" }).click();
  await expect(page).not.toHaveURL(/frame=/u);
});

test("legacy port arrows, template placement, and settings toggle work through the current engine", async ({ page }) => {
  await page.goto("/");
  const canvas = page.getByRole("application", { name: "Interactive whiteboard" });

  await page.getByRole("button", { name: "Arrow" }).click();
  await canvas.hover({ position: { x: 300, y: 170 } });
  await page.mouse.down(); await page.mouse.move(430, 170); await page.mouse.up();
  const connected = await page.evaluate(() => {
    const snapshot = (window as unknown as { __TAHTA_FIXTURE__: { engine: { getSnapshot(): { records: { type: string }[]; bindings: { start: { shapeId: string; portId?: string } | null; end: { shapeId: string; portId?: string } | null }[] } } } }).__TAHTA_FIXTURE__.engine.getSnapshot();
    return { arrows: snapshot.records.filter(({ type }) => type === "arrow").length, binding: snapshot.bindings.at(-1) };
  });
  expect(connected).toMatchObject({ arrows: 1, binding: { start: { shapeId: "start", portId: "right" }, end: { shapeId: "decision", portId: "left" } } });

  await page.getByRole("button", { name: "Library" }).click();
  await page.getByRole("menuitem", { name: "Flowchart" }).click();
  await canvas.click({ position: { x: 650, y: 300 } });
  const template = await page.evaluate(() => {
    const snapshot = (window as unknown as { __TAHTA_FIXTURE__: { engine: { getSnapshot(): { records: { id: string }[]; bindings: unknown[] } } } }).__TAHTA_FIXTURE__.engine.getSnapshot();
    return { records: snapshot.records.filter(({ id }) => id.startsWith("template-flowchart-")).length, bindings: snapshot.bindings.length };
  });
  expect(template.records).toBe(11); expect(template.bindings).toBe(6);

  await canvas.click({ position: { x: 180, y: 160 } });
  const toggle = page.getByRole("button", { name: "Close settings" }); await expect(toggle).toBeVisible(); await toggle.click();
  await expect(page.getByRole("button", { name: "Open settings" })).toBeVisible();
  await expect(page.getByLabel("Shape properties")).not.toBeVisible();
});

test("10k pan/zoom and 50k visible-subset rendering meet the reference budgets", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  const run = (count: number) => page.evaluate(async (value) => (window as unknown as { __TAHTA_FIXTURE__: { runPerformanceFixture(count: number): Promise<{ p95: number; rendered: number; total: number }> } }).__TAHTA_FIXTURE__.runPerformanceFixture(value), count);
  const tenThousand = await run(10_000); const fiftyThousand = await run(50_000);
  expect(tenThousand.total).toBe(10_000); expect(tenThousand.rendered).toBeLessThan(1_000); expect(tenThousand.p95).toBeLessThan(16.7);
  expect(fiftyThousand.total).toBe(50_000); expect(fiftyThousand.rendered).toBeLessThan(1_000); expect(fiftyThousand.p95).toBeLessThan(33);
});

test("collaborative rich text preserves formatting, alignment, links, and toolbar keyboard navigation", async ({ page }) => {
  await page.goto("/");
  const canvas = page.getByRole("application", { name: "Interactive whiteboard" });
  await canvas.dblclick({ position: { x: 180, y: 160 } });
  await expect(page.getByRole("dialog", { name: "Edit rich text" })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).include('[aria-label="Edit rich text"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  const editor = page.locator(".tahta-rich-content .ProseMirror"); await editor.click(); await page.keyboard.press("Control+A"); await page.keyboard.type("Updated canvas text"); await page.keyboard.press("Control+A");
  const bold = page.getByRole("button", { name: "Bold" }); await bold.focus(); await page.keyboard.press("ArrowRight"); await expect(page.getByRole("button", { name: "Italic" })).toBeFocused();
  await bold.click(); await page.getByRole("button", { name: "Align center" }).click();
  await page.getByRole("textbox", { name: "Link URL" }).fill("https://tahta.io/docs"); await page.getByRole("button", { name: "Apply link" }).click();
  await page.getByRole("button", { name: "Close editor" }).click();
  const text = await page.evaluate(() => {
    const record = (window as unknown as { __TAHTA_FIXTURE__: { engine: { getSnapshot(): { records: { id: string; props: unknown }[] } } } }).__TAHTA_FIXTURE__.engine.getSnapshot().records.find(({ id }) => id === "start")!;
    return (record.props as { text: { content: { align: string; content: { text: string; marks: unknown[] }[] }[] } }).text;
  });
  expect(text.content[0]?.align).toBe("center"); expect(text.content[0]?.content[0]?.text).toBe("Updated canvas text"); expect(text.content[0]?.content[0]?.marks).toEqual(expect.arrayContaining([{ type: "bold" }, { type: "link", href: "https://tahta.io/docs" }]));
});

test("command palette Quick Create adds a bound node and connector as one undo step", async ({ page }) => {
  await page.goto("/");
  const before = await page.evaluate(() => {
    const snapshot = (window as unknown as { __TAHTA_FIXTURE__: { engine: { getSnapshot(): { records: unknown[]; bindings: unknown[] } } } }).__TAHTA_FIXTURE__.engine.getSnapshot(); return { records: snapshot.records.length, bindings: snapshot.bindings.length };
  });
  await page.keyboard.press("Control+K"); await page.getByRole("textbox", { name: "Command search" }).fill("Quick Create right"); await page.getByRole("button", { name: /Quick Create right/u }).click();
  await expect(page.getByRole("dialog", { name: "Edit rich text" })).toBeVisible(); await expect(page.locator(".tahta-rich-content .ProseMirror")).toBeFocused(); await page.getByRole("button", { name: "Close editor" }).click();
  const after = await page.evaluate(() => {
    const fixture = (window as unknown as { __TAHTA_FIXTURE__: { engine: { getSnapshot(): { records: unknown[]; bindings: unknown[] }; undo(): void } } }).__TAHTA_FIXTURE__; const snapshot = fixture.engine.getSnapshot(); fixture.engine.undo(); const undone = fixture.engine.getSnapshot(); return { records: snapshot.records.length, bindings: snapshot.bindings.length, undoneRecords: undone.records.length, undoneBindings: undone.bindings.length };
  });
  expect(after).toMatchObject({ records: before.records + 2, bindings: before.bindings + 1, undoneRecords: before.records, undoneBindings: before.bindings });
});

test("keyboard nudge is an atomic equivalent for dragging selected shapes", async ({ page }) => {
  await page.goto("/");
  const canvas = page.getByRole("application", { name: "Interactive whiteboard" });
  await canvas.focus();
  const before = await page.evaluate(() => Object.fromEntries(
    (window as unknown as { __TAHTA_FIXTURE__: { engine: { getSnapshot(): { records: { id: string; x: number; y: number }[] } } } }).__TAHTA_FIXTURE__.engine
      .getSnapshot().records.filter(({ id }) => id === "start" || id === "decision").map(({ id, x, y }) => [id, { x, y }]),
  ));
  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.getByRole("status")).toContainText("Moved 2 shapes 10 pixels");
  const result = await page.evaluate(() => {
    const engine = (window as unknown as { __TAHTA_FIXTURE__: { engine: { getSnapshot(): { records: { id: string; x: number; y: number }[] }; undo(): void } } }).__TAHTA_FIXTURE__.engine;
    const moved = Object.fromEntries(engine.getSnapshot().records.filter(({ id }) => id === "start" || id === "decision").map(({ id, x, y }) => [id, { x, y }]));
    engine.undo();
    const undone = Object.fromEntries(engine.getSnapshot().records.filter(({ id }) => id === "start" || id === "decision").map(({ id, x, y }) => [id, { x, y }]));
    return { moved, undone };
  });
  expect(result.moved).toEqual({ start: { x: before.start!.x + 10, y: before.start!.y }, decision: { x: before.decision!.x + 10, y: before.decision!.y } });
  expect(result.undone).toEqual(before);
});
