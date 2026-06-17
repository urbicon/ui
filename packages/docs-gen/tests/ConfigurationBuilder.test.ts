import { describe, expect, it } from 'vitest';
import { ConfigurationFactory, DocsConfigurationBuilder } from '../src/schema/ConfigurationBuilder';

describe('DocsConfigurationBuilder', () => {
  it('creates a valid config with defaults', () => {
    const builder = new DocsConfigurationBuilder();
    builder.addPackage({
      name: '@test/ui',
      path: './packages/test',
      glob: { components: 'src/**/*.ts' }
    });
    const config = builder.build();

    expect(config.input.packages).toHaveLength(1);
    expect(config.output.api.enabled).toBe(true);
    expect(config.output.llm.enabled).toBe(true);
  });

  it('fails validation when no packages are configured', () => {
    const builder = new DocsConfigurationBuilder();
    const result = builder.validate();

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('package'))).toBe(true);
  });

  it('throws on build when validation fails', () => {
    const builder = new DocsConfigurationBuilder();
    expect(() => builder.build()).toThrow('Configuration validation failed');
  });

  it('applies LLM output settings', () => {
    const builder = new DocsConfigurationBuilder();
    builder.addPackage({
      name: '@test/ui',
      path: './test',
      glob: { components: 'src/**/*.ts' }
    });
    builder.setLLMOutput({ outputPath: '/custom/path', format: 'text' });
    const config = builder.build();

    expect(config.output.llm.outputPath).toBe('/custom/path');
    expect(config.output.llm.format).toBe('text');
  });

  it('applies API output settings', () => {
    const builder = new DocsConfigurationBuilder();
    builder.addPackage({
      name: '@test/ui',
      path: './test',
      glob: { components: 'src/**/*.ts' }
    });
    builder.setAPIOutput({ outputPath: '/api/out.ts', format: 'typescript' });
    const config = builder.build();

    expect(config.output.api.outputPath).toBe('/api/out.ts');
  });

  it('enables parallel processing', () => {
    const builder = new DocsConfigurationBuilder();
    builder.addPackage({
      name: '@test/ui',
      path: './test',
      glob: { components: 'src/**/*.ts' }
    });
    builder.enableParallel({ maxConcurrency: 8 });
    const config = builder.build();

    expect(config.processing.parallel?.enabled).toBe(true);
    expect(config.processing.parallel?.maxConcurrency).toBe(8);
  });

  it('enables debug mode', () => {
    const builder = new DocsConfigurationBuilder();
    builder.addPackage({
      name: '@test/ui',
      path: './test',
      glob: { components: 'src/**/*.ts' }
    });
    builder.enableDebug({ level: 'debug' });
    const config = builder.build();

    expect(config.debug?.enabled).toBe(true);
    expect(config.debug?.level).toBe('debug');
  });

  it('resets to default configuration', () => {
    const builder = new DocsConfigurationBuilder();
    builder.addPackage({
      name: '@test/ui',
      path: './test',
      glob: { components: 'src/**/*.ts' }
    });
    builder.reset();
    const result = builder.validate();

    expect(result.valid).toBe(false);
  });
});

describe('ConfigurationFactory', () => {
  it('creates blocks config with correct paths', () => {
    const config = ConfigurationFactory.blocks();

    expect(config.input.packages).toHaveLength(1);
    expect(config.input.packages[0]?.name).toBe('@urbicon-ui/blocks');
    expect(config.output.api.outputPath).toContain('routes/blocks');
    expect(config.output.llm.outputPath).toContain('static/blocks');
  });

  it('creates docs config with correct paths', () => {
    const config = ConfigurationFactory.docs();

    expect(config.input.packages).toHaveLength(1);
    expect(config.input.packages[0]?.name).toBe('@urbicon-ui/docs');
    expect(config.output.api.outputPath).toContain('routes/docs');
    expect(config.output.llm.outputPath).toContain('static/docs');
  });

  it('creates table config with correct paths', () => {
    const config = ConfigurationFactory.table();

    expect(config.input.packages).toHaveLength(1);
    expect(config.input.packages[0]?.name).toBe('@urbicon-ui/table');
    expect(config.output.api.outputPath).toContain('routes/table');
    expect(config.output.llm.outputPath).toContain('static/table');
  });

  it('blocks and docs configs have distinct output paths', () => {
    const blocks = ConfigurationFactory.blocks();
    const docs = ConfigurationFactory.docs();

    expect(blocks.output.api.outputPath).not.toBe(docs.output.api.outputPath);
    expect(blocks.output.llm.outputPath).not.toBe(docs.output.llm.outputPath);
  });

  it('creates single package config', () => {
    const config = ConfigurationFactory.singlePackage('/my/path', '@my/lib');

    expect(config.input.packages).toHaveLength(1);
    expect(config.input.packages[0]?.name).toBe('@my/lib');
    expect(config.input.packages[0]?.path).toBe('/my/path');
  });

  it('all presets have both API and LLM outputs enabled', () => {
    for (const config of [
      ConfigurationFactory.blocks(),
      ConfigurationFactory.docs(),
      ConfigurationFactory.table()
    ]) {
      expect(config.output.api.enabled).toBe(true);
      expect(config.output.llm.enabled).toBe(true);
    }
  });
});
