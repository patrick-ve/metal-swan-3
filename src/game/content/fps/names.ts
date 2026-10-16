/**
 * Names of the first-person mode (docs/design/fps.md §0). Pure data with no imports, so eager
 * scenes (the bridge, the intro card) may import it without loading the lazy fps content.
 *
 * The user gives the in-game name later: until then the code shows this placeholder.
 */
export const MODE_TITLE = 'OPERATION ???';
