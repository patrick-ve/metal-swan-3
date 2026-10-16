/**
 * Hand-over from fps-shell to art (docs/design/fps.md §11): this module held simple placeholder
 * textures and item / prop billboards. The real art now defines the same ids, so it only pulls
 * in the real modules: whatever loads the `fps` entry alone (the fps tests, the headless runner)
 * still gets every §8.1 texture and every §4.5 item and §5.1 prop billboard.
 */
import './textures';
import './props';
import './pickups-art';
