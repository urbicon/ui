import { describe, expect, it } from 'vitest';
import { buildCsp } from './csp.ts';
import { takeLines } from './open.ts';

const directives = (csp: string) =>
  Object.fromEntries(
    csp.split('; ').map((d) => {
      const [name, ...values] = d.split(' ');
      return [name, values.join(' ')];
    })
  );

describe('buildCsp', () => {
  it('without csp is the spec’s restrictive default — no font, no connect, no frame', () => {
    const d = directives(buildCsp(null, 'http://h/r'));
    expect(d).toEqual({
      'default-src': "'none'",
      'script-src': "'self' 'unsafe-inline'",
      'style-src': "'self' 'unsafe-inline'",
      'img-src': "'self' data:",
      'media-src': "'self' data:",
      'connect-src': "'none'",
      'report-uri': 'http://h/r'
    });
  });

  it('puts resourceDomains into script, style, img, font and media — and font-src gets no data:', () => {
    const d = directives(
      buildCsp({ resourceDomains: ['https://cdn.example', 'https://app.example'] }, 'http://h/r')
    );
    const both = 'https://cdn.example https://app.example';
    expect(d['script-src']).toBe(`'self' 'unsafe-inline' ${both}`);
    expect(d['style-src']).toBe(`'self' 'unsafe-inline' ${both}`);
    expect(d['img-src']).toBe(`'self' data: ${both}`);
    expect(d['font-src']).toBe(`'self' ${both}`);
    expect(d['media-src']).toBe(`'self' data: ${both}`);
    expect(d['connect-src']).toBe("'self'");
    expect(d['frame-src']).toBe("'none'");
    expect(d['object-src']).toBe("'none'");
    expect(d['base-uri']).toBe("'self'");
  });

  it('takes connect, frame and base-uri domains where the spec puts them', () => {
    const d = directives(
      buildCsp(
        {
          connectDomains: ['https://api.example'],
          frameDomains: ['https://embed.example'],
          baseUriDomains: ['https://base.example']
        },
        'http://h/r'
      )
    );
    expect(d['connect-src']).toBe("'self' https://api.example");
    expect(d['frame-src']).toBe('https://embed.example');
    expect(d['base-uri']).toBe('https://base.example');
  });

  it('drops an entry that would end a directive or smuggle in a keyword', () => {
    const csp = buildCsp(
      {
        resourceDomains: [
          'https://ok.example',
          'x; script-src *',
          "'unsafe-eval'",
          'a b',
          '"q"',
          '',
          42
        ]
      },
      'http://h/r'
    );
    expect(directives(csp)['script-src']).toBe("'self' 'unsafe-inline' https://ok.example");
    expect(csp).not.toContain('*');
    expect(csp).not.toContain('unsafe-eval');
  });

  it('reads a list that is no array as none', () => {
    const d = directives(buildCsp({ resourceDomains: 'https://a.example' }, 'http://h/r'));
    expect(d['font-src']).toBe("'self'");
  });
});

describe('takeLines', () => {
  it('takes only what carries a signature and keeps everything else in order', () => {
    const log = ['[error] real one', '[error] probe-x failed', 'kept', '[warning] probe-y'];
    const taken = takeLines(log, 'probe-x', 'probe-y');
    expect(taken).toEqual(['[error] probe-x failed', '[warning] probe-y']);
    expect(log).toEqual(['[error] real one', 'kept']);
  });

  it('matches objects by their JSON', () => {
    const log: unknown[] = [{ 'csp-report': { 'blocked-uri': 'https://e/probe-x.png' } }, { a: 1 }];
    expect(takeLines(log, 'probe-x')).toHaveLength(1);
    expect(log).toEqual([{ a: 1 }]);
  });
});
