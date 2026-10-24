import { KARSTS } from '../sceneConfig';

/** The karst tower with the cave behind its waterfall. */
export const CAVE_TOWER = KARSTS.find((k) => k.waterfallAngle !== undefined) || KARSTS[0];

/*
 * The hidden cave behind the main waterfall (<Cave /> fills this in once the
 * karst model has loaded), for <CameraRig />: world-space points the camera
 * flies through on the way in (through the falling water, ending inside in
 * front of the screens) and points it looks at along the way. `inside` is set
 * while the camera is behind the waterfall: the tower's scanned rock is hidden
 * then (<Karsts />), since its folds would show from within.
 */
export const caveSite = { ready: false, path: [], look: [], inside: false };
