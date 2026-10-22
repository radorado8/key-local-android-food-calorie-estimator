// react-native-svg 15.x can pass an invalid transformed frame to UIKit while
// a foldable window is resizing. Skip that frame; the next layout redraws it.
const fs = require('node:fs');
const path = require('node:path');
const target = path.join(path.dirname(require.resolve('react-native-svg/package.json')), 'apple/RNSVGRenderable.mm');
const source = fs.readFileSync(target, 'utf8');
const marker = '// Calories AI: skip transient invalid SVG geometry during window resizing.';
if (!source.includes(marker)) {
  const anchor = '  CGRect clientRect = CGRectApplyAffineTransform(pathBounds, svgToClientTransform);';
  if (!source.includes(anchor)) throw new Error('SVG geometry patch needs review for this react-native-svg version.');
  const guard = `

  ${marker}
  if (!isfinite(clientRect.origin.x) || !isfinite(clientRect.origin.y) ||
      !isfinite(clientRect.size.width) || !isfinite(clientRect.size.height)) {
    return;
  }`;
  fs.writeFileSync(target, source.replace(anchor, anchor + guard));
}
