// Ignite CLI plugin for CodePush
// ----------------------------------------------------------------------------

const NPM_MODULE_NAME = 'react-native-code-push'
const NPM_MODULE_VERSION = '~5.7.0'

const IOS_KEY_MARKER = `ios-code-push-deployment-key`
const ANDROID_KEY_MARKER = `android-code-push-deployment-key`

const IOS_CODE_PUSH_IMPORT = `#import <CodePush/CodePush.h>`;
const IOS_CODE_PUSH_BUNDLE = `return [CodePush bundleURL];`;
const JS_CODE_LOCATION = `jsCodeLocation = [CodePush bundleURL];`;
const IOS_DEPLOYMENT_KEY = `       <key>CodePushDeploymentKey</key>\n       <string>${IOS_KEY_MARKER}</string>`;
const ANDROID_CODE_PUSH_IMPORT = `import com.microsoft.codepush.react.CodePush;`;
const ANDROID_CODE_PUSH_BUNDLE = `        protected String getJSBundleFile() {\n          return CodePush.getJSBundleFile();\n        }\n\n        @Override`;
const ANDROID_DEPLOYMENT_KEY = `    <string name="reactNativeCodePush_androidDeploymentKey">${ANDROID_KEY_MARKER}</string>`;

const add = async function (toolbox) {
    // Learn more about toolbox: https://infinitered.github.io/gluegun/#/toolbox-api.md
    const { ignite, prompt, system, print, filesystem } = toolbox
    const PLUGIN_PATH = __dirname
    const APP_PATH = process.cwd()
    const packageJSON = require(`${APP_PATH}/package.json`)
    const igniteJSON = require(`${APP_PATH}/ignite/ignite.json`)

    // install an NPM module and link it
    await ignite.addModule(NPM_MODULE_NAME, { link: packageJSON.dependencies['react-native'] < '0.60.0', version: NPM_MODULE_VERSION })
    await system.spawn('pod install', { cwd: `${APP_PATH}/ios` });

    print.info(print.colors.green('Adding global package (code-push-cli) to setup code-push'))
    await system.spawn('yarn global add code-push-cli', { stdio: 'inherit' });

    let addDocumentation = false;

    if (igniteJSON.boilerplate && igniteJSON.boilerplate === 'osedea-react-native-boilerplate') {
        addDocumentation = true;
    } else {
        const { documentation } = await prompt.ask([{
            name: 'documentation',
            message: 'Do you want us to add a section to your README?',
            type: 'select',
            choices: ['NO', 'YES'],
            default: 'NO',
        }]);

        addDocumentation = documentation === 'YES';
    }

    if (addDocumentation) {
        await system.run(`cat ${PLUGIN_PATH}/DOCUMENTATION.md >> ${APP_PATH}/README.md`);
    }

    // Patch iOS
    print.info(print.colors.green("Patching iOS files"))
    ignite.patchInFile(`${APP_PATH}/ios/${packageJSON.name}/AppDelegate.m`, {
        after: `#import "AppDelegate.h"`,
        insert: IOS_CODE_PUSH_IMPORT
    });
    if (packageJSON.dependencies['react-native'] >= '0.59.0') {
        ignite.patchInFile(`${APP_PATH}/ios/${packageJSON.name}/AppDelegate.m`, {
            replace: `return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];`,
            insert: IOS_CODE_PUSH_BUNDLE
        });
    } else {
        ignite.patchInFile(`${APP_PATH}/ios/${packageJSON.name}/AppDelegate.m`, {
            replace: `jsCodeLocation = [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index" fallbackResource:nil];`,
            insert: JS_CODE_LOCATION
        });
    }
    ignite.patchInFile(`${APP_PATH}/ios/${packageJSON.name}/Info.plist`, {
        before: `<key>LSRequiresIPhoneOS</key>`,
        insert: IOS_DEPLOYMENT_KEY
    });

    // Android setup
    print.info(print.colors.green("Patching Android files"))
    ignite.patchInFile(`${APP_PATH}/android/app/src/main/java/com/${packageJSON.name.toLowerCase()}/MainApplication.java`, {
        before: `public class MainApplication extends Application implements ReactApplication {`,
        insert: ANDROID_CODE_PUSH_IMPORT
    });
    ignite.patchInFile(`${APP_PATH}/android/app/src/main/java/com/${packageJSON.name.toLowerCase()}/MainApplication.java`, {
        before: `protected String getJSMainModuleName`,
        insert: ANDROID_CODE_PUSH_BUNDLE
    });
    ignite.patchInFile(`${APP_PATH}/android/app/src/main/res/values/strings.xml`, {
        before: `</resources>`,
        insert: ANDROID_DEPLOYMENT_KEY
    });

    const nodeVersion = await system.run('node --version', { trim: true })

    print.info(print.colors.yellow("Setting up code-push keys"))
    try {
        print.info(print.colors.yellow("Logging in"))
        await system.spawn('code-push login', { stdio: 'inherit' });
    } catch (e) {
        print.warning(e.message);
    }

    print.info(print.colors.yellow("Listing apps"))
    const apps = JSON.parse(await system.run('code-push app list --format json', { trim: true }))
    let iosApp;
    let androidApp;

    if (apps.length >= 2) {
        const iosApps = apps.filter((app) => app.name.toLowerCase().includes('ios'));
        const androidApps = apps.filter((app) => app.name.toLowerCase().includes('android'));

        if (iosApps.length === 1) {
            iosApp = iosApps[0].name;
            print.info(print.colors.yellow(`Got ${iosApp} from account for iOS`))
        } else if (iosApps.length) {
            // Prompt
            iosApp = await prompt.ask({
                name: 'chosenApp',
                message: 'Which iOS app do you want to work with?',
                choices: iosApps.map((app) => app.name),
                type: 'select',
            }).chosenApp;
        }

        if (androidApps.length === 1) {
            androidApp = androidApps[0].name;
            print.info(print.colors.yellow(`Got ${androidApp} from account for Android`))
        } else if (androidApps.length) {
            // Prompt
            androidApp = await prompt.ask({
                name: 'chosenApp',
                message: 'Which Android app do you want to work with?',
                choices: androidApps.map((app) => app.name),
                type: 'select',
            }).chosenApp;
        }
    }

    if (!iosApp) {
        iosApp = `${packageJSON.name.toUpperCase()}_IOS`;

        print.info(print.colors.yellow(`No iOS app found in account. Creating ${iosApp}`))
        await system.run(`code-push app add ${iosApp} ios react-native`);
    }

    if (!androidApp) {
        androidApp = `${packageJSON.name.toUpperCase()}_ANDROID`;
        print.info(print.colors.yellow(`No Android app found in account. Creating ${androidApp}`))
        await system.run(`code-push app add ${androidApp} android react-native`);
    }

    print.info(print.colors.yellow("Listing deployment keys"))
    const iosDeployments = JSON.parse(await system.run(`code-push deployment ls ${iosApp} --displayKeys --format json`));
    const iosKey = iosDeployments.find((deployment) => deployment.name === 'Staging').key;
    // Replace in file
    ignite.patchInFile(`${APP_PATH}/ios/${packageJSON.name}/Info.plist`, {
        replace: IOS_KEY_MARKER,
        insert: iosKey
    });
    print.info(print.colors.green(`Using Staging code-push key for ${iosApp} on iOS`))

    const androidDeployments = JSON.parse(await system.run(`code-push deployment ls ${androidApp} --displayKeys --format json`));
    const androidKey = androidDeployments.find((deployment) => deployment.name === 'Staging').key;
    // Replace in file
    ignite.patchInFile(`${APP_PATH}/android/app/src/main/res/values/strings.xml`, {
        replace: ANDROID_KEY_MARKER,
        insert: androidKey
    });
    print.info(print.colors.green(`Using Staging code-push key for ${androidApp} on Android`))

    let fileToPatch;

    if (filesystem.exists(`${APP_PATH}/App.js`)) {
        fileToPatch = `${APP_PATH}/App.js`;
    } else if (filesystem.exists(`${APP_PATH}/app/index.js`)) {
        fileToPatch = `${APP_PATH}/app/index.js`;
    } else if (filesystem.exists(`${APP_PATH}/app/index.tsx`)) {
        fileToPatch = `${APP_PATH}/app/index.tsx`;
    }

    ignite.patchInFile(fileToPatch, {
        after: "from 'react'",
        insert: "import codePush from 'react-native-code-push';"
    });

    switch (fileToPatch) {
        case `${APP_PATH}/App.js`:
            ignite.patchInFile(fileToPatch, {
                replace: "export default App;",
                insert: "export default codePush(App);"
            });
            break;
        case `${APP_PATH}/app/index.js`:
        case `${APP_PATH}/app/index.tsx`:
            const content = filesystem.read(fileToPatch);
            const match = content.match(/export default ([a-zA-Z]*)/);

            if (match.length > 1 && match[1]) {
                if (match[1].includes('class')) {
                    ignite.patchInFile(fileToPatch, {
                        replace: "export default ",
                        insert: ""
                    });
                    const classNameMatch = match[1].match(/class (.*) {/);

                    if (classNameMatch.length > 1 && classNameMatch[1]) {
                        ignite.patching.append(fileToPatch, `export default codePush(${classNameMatch[1]});`);
                    } else {
                        ignite.patching.append(fileToPatch, `export default codePush(App);`);
                    }
                } else {
                    ignite.patchInFile(fileToPatch, {
                        replace: `export default ${match[1]}`,
                        insert: `export default codePush(${match[1]})`
                    });
                }
            }
            break;
        default:
            print.warning('Not sure what file to patch. Giving up.')
            break;
    }
}

/**
 * Remove yourself from the project.
 */
const remove = async function (toolbox) {
    // Learn more about toolbox: https://infinitered.github.io/gluegun/#/toolbox-api.md
    const { ignite, system, prompt, print, filesystem } = toolbox
    const PLUGIN_PATH = __dirname
    const APP_PATH = process.cwd()
    const packageJSON = require(`${APP_PATH}/package.json`)
    const igniteJSON = require(`${APP_PATH}/ignite/ignite.json`)

    // install an NPM module and link it
    await ignite.removeModule(NPM_MODULE_NAME, { unlink: packageJSON.dependencies['react-native'] < '0.60.0' })
    await system.spawn('pod install', { cwd: `${APP_PATH}/ios` });

    print.warning('Patching iOS files')
    ignite.patchInFile(`${APP_PATH}/ios/${packageJSON.name}/AppDelegate.m`, {
        delete: IOS_CODE_PUSH_IMPORT
    });
    if (packageJSON.dependencies['react-native'] >= '0.59.0') {
        ignite.patchInFile(`${APP_PATH}/ios/${packageJSON.name}/AppDelegate.m`, {
            replace: IOS_CODE_PUSH_BUNDLE,
            insert: `return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];`
        });
    } else {
        ignite.patchInFile(`${APP_PATH}/ios/${packageJSON.name}/AppDelegate.m`, {
            replace: JS_CODE_LOCATION,
            insert: `jsCodeLocation = [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index" fallbackResource:nil];`
        });
    }

    print.warning('Patching Android files')
    ignite.patchInFile(`${APP_PATH}/android/app/src/main/java/com/${packageJSON.name.toLowerCase()}/MainApplication.java`, {
        delete: ANDROID_CODE_PUSH_IMPORT
    });
    ignite.patchInFile(`${APP_PATH}/android/app/src/main/java/com/${packageJSON.name.toLowerCase()}/MainApplication.java`, {
        delete: ANDROID_CODE_PUSH_BUNDLE
    });

    print.warning('Patching JS files')
    let fileToPatch;
    if (filesystem.exists(`${APP_PATH}/App.js`)) {
        fileToPatch = `${APP_PATH}/App.js`;
    } else if (filesystem.exists(`${APP_PATH}/app/index.js`)) {
        fileToPatch = `${APP_PATH}/app/index.js`;
    } else if (filesystem.exists(`${APP_PATH}/app/index.tsx`)) {
        fileToPatch = `${APP_PATH}/app/index.tsx`;
    }

    ignite.patchInFile(fileToPatch, {
        delete: "import codePush from 'react-native-code-push';"
    });

    switch (fileToPatch) {
        case `${APP_PATH}/App.js`:
            ignite.patchInFile(fileToPatch, {
                replace: "export default codePush(App);",
                insert: "export default App;"
            });
            break;
        case `${APP_PATH}/app/index.js`:
        case `${APP_PATH}/app/index.tsx`:
            const content = filesystem.read(fileToPatch);
            const match = content.match(/export default codePush\(([a-zA-Z]*)\)/);

            if (match.length > 1 && match[1]) {
                ignite.patchInFile(fileToPatch, {
                    replace: `export default codePush(${match[1]})`,
                    insert: `export default ${match[1]}`
                });
            }
            break;
        default:
            print.warning('Not sure what file to patch. Giving up.')
            break;
    }

    print.info(print.colors.green('All files patched'))
    print.info(print.colors.red('One thing we can\'t do right now is removing the <key>CodePushDeploymentKey</key><value>...</value> from your Info.plist and the packages.add(new CodePush("...", MainApplication.this, BuildConfig.DEBUG)); from your MainApplication.java. You will need to do that manually.'))
}

// Required in all Ignite CLI plugins
module.exports = { add, remove }

