// A single shared object instead of passing roomID/userID around
// via URL params (which is what forced the old multi-page flow).
export const state = {
    userID: null,
    roomID: null,
    username: null,
    avatar: null,
    language: null
};
