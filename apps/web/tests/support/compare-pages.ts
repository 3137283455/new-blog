import { expect, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export async function compare(oldPage: Page, newPage: Page, info: TestInfo, name = 'grid') {
  const baseline = await oldPage.screenshot({ fullPage: true, animations: 'disabled' });
  const candidate = await newPage.screenshot({ fullPage: true, animations: 'disabled' });
  await writeFile(info.outputPath(name + '-legacy.png'), baseline);
  await writeFile(info.outputPath(name + '-next.png'), candidate);
  await info.attach(name + '-legacy', { body: baseline, contentType: 'image/png' });
  await info.attach(name + '-next', { body: candidate, contentType: 'image/png' });
  const oldImage = PNG.sync.read(baseline);
  const newImage = PNG.sync.read(candidate);
  expect(
    { width: newImage.width, height: newImage.height },
    'page dimensions must be unchanged',
  ).toEqual({ width: oldImage.width, height: oldImage.height });
  const diff = new PNG({ width: oldImage.width, height: oldImage.height });
  const changed = pixelmatch(
    oldImage.data,
    newImage.data,
    diff.data,
    oldImage.width,
    oldImage.height,
    { threshold: 0.1 },
  );
  const ratio = changed / (oldImage.width * oldImage.height);
  await writeFile(info.outputPath(name + '-diff.png'), PNG.sync.write(diff));
  await info.attach(name + '-diff', { body: PNG.sync.write(diff), contentType: 'image/png' });
  await writeFile(
    info.outputPath(name + '-comparison.json'),
    JSON.stringify(
      { changedPixels: changed, totalPixels: oldImage.width * oldImage.height, ratio },
      null,
      2,
    ),
  );
  expect(
    ratio,
    `${changed} visually changed pixels; inspect legacy/next/diff attachments`,
  ).toBeLessThanOrEqual(0.001);
}
