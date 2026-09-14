const { extractWithReadability } = require('../dist/services/readability-extractor');
const html = '<html><head><title>Web import health check</title></head><body><article><h1>Web import health check</h1>' +
  Array.from({length: 6}, (_, index) => '<p>Paragraph ' + index + '. This is a local article used to verify the bundled extraction engine. It should preserve the main content and work without a Python installation or any network connection.</p>').join('') +
  '</article></body></html>';
try {
  const result = extractWithReadability(html, 'https://example.com/health-check');
  if (!result.html.includes('local article')) throw new Error('Extracted content is empty');
  console.log('[web-import] Bundled engine ready; Python is optional.');
} catch (error) {
  console.error('[web-import] Engine check failed:', error.message);
  process.exitCode = 1;
}
