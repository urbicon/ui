/**
 * The upper bound on a user-chosen display name, in UTF-16 code units — what
 * both `String.length` and an `<input maxlength>` count, so the server rule and
 * the field agree on what "256" means without either converting.
 *
 * Shared rather than restated: `validateDisplayName` refuses anything longer,
 * and `<PasskeyManager>`'s rename field stops accepting at the same number, so
 * the field cannot compose a name the server will refuse for length. Its own
 * module because the field is client code and the validator is server code —
 * neither may import the other.
 */
export const MAX_DISPLAY_NAME_LENGTH = 256;
