/**
 @license
 Copyright (c) 2015-2026 Lablup Inc. All rights reserved.
 */
import { textFromHtmlErrorPage } from './useBackendAIAppLauncher';
import { describe, expect, it } from 'vitest';

describe('textFromHtmlErrorPage', () => {
  it('reads the message out of the local proxy error page', () => {
    const page =
      '<!DOCTYPE html>\n<html><head><style>body{margin:0}</style></head><body>' +
      '<div class="cover"><h1>Backend.AI</h1><h2>Server connection failed</h1>' +
      '<p>502 Error</p></div><footer></footer></body></html>';
    expect(textFromHtmlErrorPage(page)).toBe(
      'Server connection failed: 502 Error',
    );
  });

  it('falls back to the page text without headings or paragraphs', () => {
    expect(
      textFromHtmlErrorPage('<html><body>  Bad   gateway </body></html>'),
    ).toBe('Bad gateway');
  });

  it('leaves plain text alone', () => {
    expect(textFromHtmlErrorPage('Worker not available.')).toBeNull();
  });
});
