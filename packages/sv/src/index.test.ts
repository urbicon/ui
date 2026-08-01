import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import addon from './index.js';

const version = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as {
    version: string;
  }
).version;

type SetupApi = Parameters<NonNullable<typeof addon.setup>>[0];
type RunApi = Parameters<typeof addon.run>[0];

const mockSv = () => ({ dependency: vi.fn(), devDependency: vi.fn(), file: vi.fn() });

describe('the urbicon-ui add-on', () => {
  it('requires SvelteKit and depends on the tailwindcss add-on', async () => {
    const dependsOn = vi.fn();
    const unsupported = vi.fn();
    await addon.setup?.({ isKit: true, dependsOn, unsupported } as unknown as SetupApi);
    expect(dependsOn).toHaveBeenCalledWith('tailwindcss');
    expect(unsupported).not.toHaveBeenCalled();

    await addon.setup?.({ isKit: false, dependsOn: vi.fn(), unsupported } as unknown as SetupApi);
    expect(unsupported).toHaveBeenCalled();
  });

  it('adds blocks (runtime) + design (dev), pinned to its own lockstep version', async () => {
    const sv = mockSv();
    await addon.run({ sv, file: { stylesheet: 'src/app.css' } } as unknown as RunApi);
    expect(sv.dependency).toHaveBeenCalledWith('@urbicon-ui/blocks', `^${version}`);
    expect(sv.devDependency).toHaveBeenCalledWith('@urbicon-ui/design', `^${version}`);
  });

  it("edits sv's canonical stylesheet, wherever the template puts it", async () => {
    const sv = mockSv();
    await addon.run({ sv, file: { stylesheet: 'src/routes/layout.css' } } as unknown as RunApi);
    const call = sv.file.mock.calls[0] as [string, (content: string) => string];
    expect(call[0]).toBe('src/routes/layout.css');
    expect(call[1]("@import 'tailwindcss';\n")).toContain('@urbicon-ui/blocks/style/index.css');
  });

  it('hands the design-loop onboarding over to urbicon init --hook', () => {
    const bun = addon.nextSteps?.({ packageManager: 'bun' } as unknown as RunApi) ?? [];
    expect(bun.join('\n')).toContain('bunx urbicon init --hook');
    const npm = addon.nextSteps?.({ packageManager: 'npm' } as unknown as RunApi) ?? [];
    expect(npm.join('\n')).toContain('npx urbicon init --hook');
  });
});
