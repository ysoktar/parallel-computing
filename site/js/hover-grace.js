// Pointer grace period shared by linked diagrams; keyboard focus remains immediate.
// No selection is changed by scheduling a leave, and a new enter cancels it.
export const HOVER_GRACE_MS = 350;

export function createHoverGrace({
  delay = HOVER_GRACE_MS,
  schedule = setTimeout,
  cancel = clearTimeout
} = {}) {
  let timer = null;
  let revision = 0;

  const cancelPending = () => {
    revision++;
    if (timer !== null) cancel(timer);
    timer = null;
  };

  return {
    enter(callback) {
      cancelPending();
      callback?.();
    },
    leave(callback) {
      cancelPending();
      const scheduledRevision = revision;
      timer = schedule(() => {
        if (revision !== scheduledRevision) return;
        timer = null;
        callback?.();
      }, delay);
    },
    cancel: cancelPending
  };
}
