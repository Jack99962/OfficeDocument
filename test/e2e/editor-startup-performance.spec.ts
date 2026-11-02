import { expect, test } from './lib/l0';

for (const kind of ['docx', 'xlsx', 'pptx'] as const) {
  test(`${kind} exposes a complete startup timeline and starts its full SDK eagerly`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`/editor?new=${kind}&locale=en`);
    await page.waitForFunction(
      () => performance.getEntriesByName('document.editor.startup.content-ready', 'mark').length,
    );
    const result = await page.evaluate((selectedKind) => {
      const prefix = 'document.editor.startup.';
      const marks = Object.fromEntries(
        performance
          .getEntriesByType('mark')
          .filter((entry) => entry.name.startsWith(prefix))
          .map((entry) => [entry.name.slice(prefix.length), entry.startTime]),
      );
      const sdk = selectedKind === 'docx' ? 'word' : selectedKind === 'xlsx' ? 'cell' : 'slide';
      const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
      return { marks, fullSdkRequested: resources.some((url) => url.includes(`/sdkjs/${sdk}/sdk-all.js`)) };
    }, kind);
    for (const milestone of ['host-start', 'api-request', 'api-ready', 'frame-ready', 'content-ready'])
      expect(result.marks[milestone], `${kind}: ${milestone}`).toBeGreaterThanOrEqual(0);
    expect(result.marks['api-ready']).toBeGreaterThanOrEqual(result.marks['api-request']);
    expect(result.marks['content-ready']).toBeGreaterThanOrEqual(result.marks['frame-ready']);
    expect(result.fullSdkRequested).toBe(true);
  });
}
