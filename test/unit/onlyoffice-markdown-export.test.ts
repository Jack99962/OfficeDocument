import { expect, it, vi } from 'vitest';
import { installServerlessSaveSemantics } from '../../lib/onlyoffice/guards/serverless-save';

it('routes Markdown through the live Word model instead of x2t', () => {
  const nativeDownload = vi.fn();
  const postMessage = vi.fn();
  const convert = vi.fn(() => '# Title\n\n| A | B |\n| - | - |');
  const win = {
    location: { origin: 'https://editor.test' },
    parent: { postMessage },
    AscBuilder: { Api: { ConvertDocument: convert } },
    Asc: {
      editor: {
        asc_Save: vi.fn(),
        asc_DownloadAs: nativeDownload,
        documentFormatSave: 65,
      },
      asc_CDownloadOptions: class {
        constructor(public fileType: number) {}
      },
    },
  } as unknown as Window;

  installServerlessSaveSemantics(win);
  (win as any).Asc.editor.asc_DownloadAs({ fileType: 92 });

  expect(nativeDownload).not.toHaveBeenCalled();
  expect(convert).toHaveBeenCalledWith('markdown');
  const [message, origin] = postMessage.mock.calls[0];
  expect(origin).toBe('https://editor.test');
  expect(message).toMatchObject({ type: 'onlyoffice-file-stream', fileType: 'md' });
  expect(new TextDecoder().decode(message.buffer)).toContain('# Title');
});

it('leaves other Download As formats on the native export path', () => {
  const nativeDownload = vi.fn();
  const win = {
    Asc: {
      editor: { asc_Save: vi.fn(), asc_DownloadAs: nativeDownload, documentFormatSave: 65 },
      asc_CDownloadOptions: class {},
    },
  } as unknown as Window;
  installServerlessSaveSemantics(win);
  const options = { fileType: 513 };
  (win as any).Asc.editor.asc_DownloadAs(options);
  expect(nativeDownload).toHaveBeenCalledWith(options);
});
