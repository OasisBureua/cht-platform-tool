/** Mounts the WebGL gallery room onto a `[data-hero]` section. Returns a cleanup, or undefined if it could not start. */
export function mountGalleryRoom(hero: HTMLElement | null): (() => void) | undefined;
/** Mounts the drifting particle field behind the room. Returns a cleanup, or undefined if it could not start. */
export function mountHeroField(hero: HTMLElement | null): (() => void) | undefined;
