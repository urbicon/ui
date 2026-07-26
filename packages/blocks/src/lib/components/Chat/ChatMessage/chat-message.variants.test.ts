import { describe, expect, it } from 'vitest';
import { chatMessageVariants } from './chat-message.variants';

const SLOTS = [
  'root',
  'container',
  'header',
  'roleName',
  'avatar',
  'column',
  'bubble',
  'partsFlow',
  'attachment',
  'attachmentIcon',
  'attachmentName',
  'attachmentSize',
  'sourcesFooter',
  'placeholder',
  'statusAlert',
  'footer',
  'actions',
  'actionButton',
  'metadata'
] as const;

describe('chatMessageVariants', () => {
  it('provides all slot functions', () => {
    const styles = chatMessageVariants();
    for (const slot of SLOTS) {
      expect(typeof styles[slot]).toBe('function');
    }
  });

  it('tints and aligns bubbles per role', () => {
    const user = chatMessageVariants({ layout: 'bubble', role: 'user' });
    expect(user.bubble()).toContain('bg-primary-subtle');
    // User bubble packs to the right edge via row-reverse.
    expect(user.container()).toContain('flex-row-reverse');

    const assistant = chatMessageVariants({ layout: 'bubble', role: 'assistant' });
    expect(assistant.bubble()).toContain('bg-surface-elevated');
    expect(assistant.container()).not.toContain('flex-row-reverse');

    const system = chatMessageVariants({ layout: 'bubble', role: 'system' });
    expect(system.bubble()).toContain('bg-surface-base');
    expect(system.container()).toContain('justify-center');
  });

  /**
   * A bubble is content, not architecture. `rounded-contain` (2 px) is the
   * panel radius: correct on a 600 px Card, a plain rectangle on a ~200 px
   * bubble — optical radius scales with the area it turns. The bubble takes the
   * middle `bridge` tier instead, and it must stay a TIER (not a raw
   * `rounded-md`) so a consumer can retune it via `--radius-bridge`.
   */
  it('gives every bubble role the bridge tier, never the panel radius', () => {
    for (const role of ['user', 'assistant', 'system'] as const) {
      const bubble = chatMessageVariants({ layout: 'bubble', role }).bubble();
      expect(bubble, `${role} bubble must ride the bridge tier`).toContain('rounded-bridge');
      expect(bubble, `${role} bubble must not fall back to the panel radius`).not.toContain(
        'rounded-contain'
      );
      // A raw radius would silently opt out of brand theming.
      expect(bubble, `${role} bubble must not hard-code a physical radius`).not.toMatch(
        /\brounded-(?:none|xs|sm|md|lg|xl|2xl|3xl|full|\[)/
      );
    }
  });

  it('drops the bubble tint and goes full width in plain layout', () => {
    const plain = chatMessageVariants({ layout: 'plain', role: 'assistant' });
    expect(plain.bubble()).toContain('w-full');
    expect(plain.bubble()).not.toContain('bg-surface-elevated');
    expect(plain.bubble()).not.toContain('rounded-bridge');
  });

  it('scales bubble padding with density', () => {
    expect(chatMessageVariants({ layout: 'bubble', density: 'comfortable' }).bubble()).toContain(
      'py-2.5'
    );
    expect(chatMessageVariants({ layout: 'bubble', density: 'compact' }).bubble()).toContain(
      'py-2'
    );
    expect(chatMessageVariants({ density: 'comfortable' }).partsFlow()).toContain('gap-2');
    expect(chatMessageVariants({ density: 'compact' }).partsFlow()).toContain('gap-1.5');
  });

  /**
   * The width cap belongs on the column, not the bubble: a bubble hugs its text,
   * while the error alert underneath must span the full column. If the cap sat on
   * `bubble`, the alert would be free to run wider than the message it belongs to.
   */
  it('caps the column width per role and lets the bubble hug its content', () => {
    for (const [role, cap] of [
      ['user', 'max-w-[85%]'],
      ['assistant', 'max-w-[85%]'],
      ['system', 'max-w-[90%]']
    ] as const) {
      const styles = chatMessageVariants({ layout: 'bubble', role });
      expect(styles.column(), `${role} column carries the cap`).toContain(cap);
      expect(styles.bubble(), `${role} bubble must not cap itself`).not.toMatch(/max-w-\[\d+%\]/);
    }
  });

  /**
   * A user bubble sits on the right, so its timestamp and citations have to as
   * well — they hang off the column, and the column is what carries the side.
   */
  it('aligns the column to the bubble side per role', () => {
    expect(chatMessageVariants({ layout: 'bubble', role: 'user' }).column()).toContain('items-end');
    expect(chatMessageVariants({ layout: 'bubble', role: 'assistant' }).column()).toContain(
      'items-start'
    );
    expect(chatMessageVariants({ layout: 'bubble', role: 'system' }).column()).toContain(
      'items-center'
    );
    // Plain layout is a document flow — every row spans the full width.
    expect(chatMessageVariants({ layout: 'plain' }).column()).toContain('items-stretch');
  });

  /**
   * The action buttons are `opacity-0` until hover/focus. Letting them size the
   * footer reserved a ~28px blank strip under EVERY message — visible as dead
   * space between a bubble and its timestamp. The row is sized by the metadata
   * line instead, and the buttons overhang it via a negative margin.
   */
  it('sizes the footer by its metadata line, not by the hidden action buttons', () => {
    const styles = chatMessageVariants();
    expect(styles.footer()).toContain('min-h-5');
    expect(styles.actions()).toContain('-my-1');
  });

  it('reveals the action bar on hover / focus-within and keeps buttons focus-visible', () => {
    const styles = chatMessageVariants();
    const actions = styles.actions();
    expect(actions).toContain('opacity-0');
    expect(actions).toContain('group-hover/message:opacity-100');
    expect(actions).toContain('group-focus-within/message:opacity-100');
    // A keyboard-focused button reveals itself even without hover.
    expect(styles.actionButton()).toContain('focus-visible:opacity-100');
  });

  it('uses focus-visible (never bare focus:) for the action buttons', () => {
    expect(chatMessageVariants().actionButton()).not.toMatch(/(^|[^-])\bfocus:/);
  });

  it('never emits dark: overrides', () => {
    const styles = chatMessageVariants();
    for (const slot of SLOTS) {
      expect(styles[slot]()).not.toMatch(/\bdark:/);
    }
  });
});
