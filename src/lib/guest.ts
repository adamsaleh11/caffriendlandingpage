/**
 * Who a guest is on this device, and how they stop being one.
 *
 * Someone invited from outside joins a call without an account, under an id belonging to
 * this browser rather than to a person. The backend honours that id when the client
 * sends one, so it is minted once and kept: the same guest returning to the same device
 * is recognised as the same participant.
 */

const key = 'caffriend_anonymous_install_id_v1';

/** The guest id already on this device, or null if there has never been one. */
export function storedInstallId(): string | null {
  try { return window.localStorage.getItem(key) || null; } catch { return null; }
}

/**
 * This device's guest id, minted on first use.
 *
 * A browser that refuses storage still gets a usable id — it simply will not be the same
 * one next time, which costs the guest their history and nothing more.
 */
export function anonymousInstallId(): string {
  const existing = storedInstallId();
  if (existing) return existing;
  const created = crypto.randomUUID();
  try { window.localStorage.setItem(key, created); } catch { /* a private window: this id lives for the session */ }
  return created;
}

/**
 * Hands everything this device did as a guest to the account that just signed up.
 *
 * Called immediately after an account is created here, exactly as mobile does: the calls
 * they attended become theirs, and every "I'd like to connect" intent held against the
 * guest id becomes a matched connection. Idempotent, and there is nothing to claim when
 * this device has no guest past — so it is not called at all then.
 *
 * A failure is deliberately swallowed. The account exists and the booking is made; the
 * backend also links a guest retroactively by address, so this is a shortcut rather than
 * the only route, and it must never be the thing that shows someone an error.
 */
export async function claimGuestHistory(): Promise<void> {
  const anonymousInstallId = storedInstallId();
  if (!anonymousInstallId) return;
  try {
    await fetch('/api/call/claim-guest', {method:'POST', cache:'no-store',
      headers:{'Content-Type':'application/json','X-Caffriend-Request':'1'},
      body: JSON.stringify({anonymousInstallId})});
  } catch { /* the retroactive link by address still applies */ }
}
