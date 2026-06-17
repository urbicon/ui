import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocsGeneratorCLI } from '../src/cli/CLI';

describe('DocsGeneratorCLI', () => {
  let cli: DocsGeneratorCLI;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    cli = new DocsGeneratorCLI();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('shows help for help command', async () => {
    const logSpy = vi.spyOn(console, 'log');
    await cli.run(['help']);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Docs Generator'));
  });

  it('exits with error for unknown command', async () => {
    await cli.run(['unknown-command']);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('parses --target option', async () => {
    const generateSpy = vi
      .spyOn(cli as unknown as Record<string, unknown>, 'generateTarget')
      .mockResolvedValue(undefined);

    await cli.run(['generate', '--target', 'blocks']);

    expect(generateSpy).toHaveBeenCalledWith('blocks');
  });

  it('generates all targets by default', async () => {
    const generateSpy = vi
      .spyOn(cli as unknown as Record<string, unknown>, 'generateTarget')
      .mockResolvedValue(undefined);

    await cli.run(['generate']);

    expect(generateSpy).toHaveBeenCalledTimes(4);
    expect(generateSpy).toHaveBeenCalledWith('blocks');
    expect(generateSpy).toHaveBeenCalledWith('docs');
    expect(generateSpy).toHaveBeenCalledWith('table');
    expect(generateSpy).toHaveBeenCalledWith('auth');
  });

  it('exits with error for unknown target', async () => {
    await cli.run(['generate', '--target', 'nonexistent']);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('parseOptions handles boolean flags', () => {
    const options = (cli as unknown as Record<string, unknown>).parseOptions([
      '--verbose',
      '--debug'
    ]);

    expect(options.verbose).toBe(true);
    expect(options.debug).toBe(true);
  });

  it('parseOptions handles key-value pairs', () => {
    const options = (cli as unknown as Record<string, unknown>).parseOptions([
      '--target',
      'blocks',
      '--format',
      'json'
    ]);

    expect(options.target).toBe('blocks');
    expect(options.format).toBe('json');
  });
});
