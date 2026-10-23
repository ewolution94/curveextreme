// Page-wide things any component may open: how to play (from the start page, the lobby and Settings;
// once on a device's first visit).

export const ui = $state<{ guide: boolean }>({ guide: false });
