import { tick } from 'svelte';

/**
 * Swaps the `element.animate` stub of `vitest-setup.ts`, whose animations
 * never finish, for one whose animations finish when the test says so — the
 * way to observe an outro that runs, ends or is interrupted, which neither the
 * stub nor `transitionDuration: 0` (an outro that ends synchronously) can show.
 *
 * Svelte runs a transition as two animations, a delay-length one and then the
 * real one, each started a microtask after the last, so `finish()` keeps
 * finishing until nothing new starts. Call `restore()` in the test's teardown.
 */
export function manualAnimations() {
  const pending = new Set<FakeAnimation>();
  const original = Element.prototype.animate;
  Element.prototype.animate = function animate() {
    const animation = new FakeAnimation(pending);
    pending.add(animation);
    return animation as unknown as Animation;
  };
  return {
    async finish() {
      for (let round = 0; round < 10; round++) {
        await tick();
        if (pending.size === 0) return;
        for (const animation of [...pending]) {
          pending.delete(animation);
          animation.onfinish?.(new Event('finish'));
        }
      }
      throw new Error('manualAnimations: animations kept starting after ten rounds');
    },
    restore() {
      Element.prototype.animate = original;
    }
  };
}

class FakeAnimation {
  currentTime = 0;
  effect: unknown = null;
  onfinish: ((event: Event) => void) | null = null;

  constructor(private readonly pending: Set<FakeAnimation>) {}

  cancel() {
    this.pending.delete(this);
  }
}
