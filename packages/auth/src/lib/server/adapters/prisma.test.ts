import { describe, expect, it, vi } from 'vitest';
import type { AuthLogger } from '../../types.js';
import {
  createPrismaBackupCodeRepository,
  createPrismaNotificationPreferenceRepository,
  createPrismaNotificationRepository,
  createPrismaPasskeyRepository,
  createPrismaPushSubscriptionRepository,
  createPrismaRefreshTokenRepository,
  createPrismaRepos,
  type PrismaLike
} from './prisma.js';

/**
 * A Prisma client that carries only the two required models — the shape a
 * consumer ends up with after copying a trimmed schema, or after forgetting one
 * model in `auth-schema.prisma`. Every optional factory then answers
 * `undefined`, which used to be the whole answer: measured zero console output,
 * no throw.
 */
function bareClient(): PrismaLike {
  const delegate = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn()
  });
  return { user: delegate(), invitation: delegate() } as unknown as PrismaLike;
}

function sink() {
  return {
    warn: vi.fn<(message: string, ...context: unknown[]) => void>(),
    error: vi.fn<(message: string, ...context: unknown[]) => void>()
  } satisfies AuthLogger;
}

describe('Prisma factories report a missing model', () => {
  it.each([
    ['notification', createPrismaNotificationRepository],
    ['pushSubscription', createPrismaPushSubscriptionRepository],
    ['notificationPreference', createPrismaNotificationPreferenceRepository],
    ['passkey', createPrismaPasskeyRepository],
    ['refreshToken', createPrismaRefreshTokenRepository],
    ['twoFactorBackupCode', createPrismaBackupCodeRepository]
  ])('%s: returns undefined AND says so', (model, factory) => {
    const logger = sink();
    expect(factory(bareClient(), { logger })).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`no \`${model}\` model`));
  });

  // The two absences nothing else in the package reports: the notification
  // service takes both repos optionally and simply skips their branch.
  it('names the consequence for the two silently-degrading models', () => {
    const push = sink();
    createPrismaPushSubscriptionRepository(bareClient(), { logger: push });
    expect(push.warn).toHaveBeenCalledWith(expect.stringContaining('web-push delivery is skipped'));

    const prefs = sink();
    createPrismaNotificationPreferenceRepository(bareClient(), { logger: prefs });
    expect(prefs.warn).toHaveBeenCalledWith(
      expect.stringContaining('per-user channel preferences are ignored')
    );
  });

  it('reports once per client, not once per call', () => {
    const logger = sink();
    const client = bareClient();
    createPrismaRefreshTokenRepository(client, { logger });
    createPrismaRefreshTokenRepository(client, { logger });
    createPrismaRefreshTokenRepository(client, { logger });
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('defaults the sink to console', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createPrismaPasskeyRepository(bareClient());
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('no `passkey` model'));
    consoleWarn.mockRestore();
  });

  it('a throwing sink does not break wiring', () => {
    const logger: AuthLogger = {
      warn: () => {
        throw new Error('transport down');
      },
      error: vi.fn()
    };
    expect(() => createPrismaRefreshTokenRepository(bareClient(), { logger })).not.toThrow();
  });

  it('says nothing when the model is present', () => {
    const logger = sink();
    const client = bareClient() as unknown as Record<string, unknown>;
    client.refreshToken = { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() };
    expect(
      createPrismaRefreshTokenRepository(client as unknown as PrismaLike, { logger })
    ).toBeDefined();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('createPrismaRepos', () => {
  it('reports every absent model once, including the federated link table', () => {
    const logger = sink();
    const repos = createPrismaRepos(bareClient(), { logger });
    expect(repos.notification).toBeUndefined();
    expect(repos.refreshToken).toBeUndefined();
    expect(repos.federatedAccount).toBeUndefined();
    const models = logger.warn.mock.calls.map(
      ([message]) => /no `(\w+)` model/.exec(String(message))?.[1]
    );
    expect(models.sort()).toEqual(
      [
        'federatedAccount',
        'notification',
        'notificationPreference',
        'passkey',
        'pushSubscription',
        'refreshToken',
        'twoFactorBackupCode'
      ].sort()
    );
  });
});
