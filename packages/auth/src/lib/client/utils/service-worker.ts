export async function registerServiceWorker(
  path: string = '/service-worker.js'
): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    return await navigator.serviceWorker.register(path);
  } catch (err) {
    // A missing/404ing worker file is a wiring error the developer must see —
    // silently returning null makes every dependent feature look "declined".
    console.error('[auth] service worker registration failed:', err);
    return null;
  }
}

/**
 * Outcome of {@link subscribeToPush}. Deliberately discriminated instead of
 * `PushSubscription | null`: a broken VAPID key, a dead push service, or a
 * missing service worker must never be indistinguishable from the user
 * declining the permission prompt — a consumer reading `null` as "user said
 * no" would show a permanently dead Enable button with no trace of the real
 * problem.
 */
export type PushSubscribeResult =
  | { status: 'subscribed'; subscription: PushSubscription }
  /** The browser has no service-worker/Push API support. */
  | { status: 'unsupported' }
  /** The user declined (or has previously blocked) the permission prompt. */
  | { status: 'denied' }
  /** An operational failure: malformed VAPID key, push service down, no service worker registered (ready timed out), … */
  | { status: 'error'; error: unknown };

/** Race a promise against a timeout — `serviceWorker.ready` never settles when no worker is registered. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/** Only a permission denial is the user's decision — everything else in the catch is operational. */
function isPermissionDenied(error: unknown): boolean {
  if (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    error.name === 'NotAllowedError'
  ) {
    return true;
  }
  // Some browsers surface "already blocked" through other error shapes; the
  // permission state is then the authoritative signal.
  return typeof Notification !== 'undefined' && Notification.permission === 'denied';
}

export async function subscribeToPush(
  vapidPublicKey: string,
  options?: {
    /**
     * How long to wait for `serviceWorker.ready` before reporting an error.
     * `ready` never settles when no service worker is registered (worker file
     * 404s, `registerServiceWorker` never ran), which would otherwise hang the
     * caller forever. Default 10s.
     */
    readyTimeoutMs?: number;
  }
): Promise<PushSubscribeResult> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { status: 'unsupported' };
  }

  try {
    const registration = await withTimeout(
      navigator.serviceWorker.ready,
      options?.readyTimeoutMs ?? 10_000,
      '[auth] service worker never became ready — is one registered? (registerServiceWorker)'
    );

    const existing = await registration.pushManager.getSubscription();
    if (existing) return { status: 'subscribed', subscription: existing };

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer
    });
    return { status: 'subscribed', subscription };
  } catch (error) {
    return isPermissionDenied(error) ? { status: 'denied' } : { status: 'error', error };
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
  } catch {
    // Ignore
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
