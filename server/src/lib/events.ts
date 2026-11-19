import type { Role, ServerEvents } from '@mirador/shared';

/** Emite un evento de tiempo real a los roles indicados. Se llama solo después del commit. */
export type Emit = <E extends keyof ServerEvents>(event: E, payload: ServerEvents[E], roles?: Role[]) => void;

export const noopEmit: Emit = () => {};
