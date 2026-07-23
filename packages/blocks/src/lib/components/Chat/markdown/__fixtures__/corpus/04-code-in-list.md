# Wiring up a debounce

The trick is to keep the timer id outside the returned function so successive
calls can clear the pending one. Here is the shape I reach for:

1. Start from the plain version, then generalize:

   ```ts
   function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
     let timer: ReturnType<typeof setTimeout> | undefined;
     return (...args: A) => {
       clearTimeout(timer);
       timer = setTimeout(() => fn(...args), ms);
     };
   }
   ```

2. Call it once at module scope, not inside your event handler — otherwise every
   keystroke builds a fresh debouncer and nothing is ever actually debounced.

3. If you need a leading-edge variant, track a `lastCall` timestamp and compare
   against `ms` before scheduling.

That covers the ninety-percent case. Reach for a library only when you need
cancellation, flushing, and max-wait all at once.
