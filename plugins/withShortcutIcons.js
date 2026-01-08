const { withDangerousMod, withPlugins } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withShortcutIcons = (config) => {
    return withDangerousMod(config, [
        'android',
        async (config) => {
            const projectRoot = config.modRequest.projectRoot;
            const androidResDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
            const drawableDir = path.join(androidResDir, 'drawable');

            if (!fs.existsSync(drawableDir)) {
                fs.mkdirSync(drawableDir, { recursive: true });
            }

            const icons = ['shortcut_camera.png', 'shortcut_weight.png'];

            icons.forEach((icon) => {
                const sourcePath = path.join(projectRoot, 'assets', 'shortcuts', icon);
                const destPath = path.join(drawableDir, icon);

                if (fs.existsSync(sourcePath)) {
                    fs.copyFileSync(sourcePath, destPath);
                    console.log(`[withShortcutIcons] Copied ${icon} to ${destPath}`);
                } else {
                    console.warn(`[withShortcutIcons] Source icon not found: ${sourcePath}`);
                }
            });

            return config;
        },
    ]);
};

module.exports = withShortcutIcons;
