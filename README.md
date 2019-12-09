# Ignite Code Push Plugin

Adds [code-push](https://docs.microsoft.com/en-us/appcenter/distribution/codepush/) to your React Native project.

This plugin:
* Adds `react-native-code-push`
* Patches the native files of your project to enable it
* Gets or Creates the code-push applications using `code-push-cli`
* Tells you the last step you need to do

## Add

```sh
ignite add code-push
```

## Remove

```sh
ignite remove code-push
```

When removing, one thing we can't do right now is removing the `<key>CodePushDeploymentKey</key><value>...</value>` from your `Info.plist` and the `packages.add(new CodePush("...", MainApplication.this, BuildConfig.DEBUG));` from your `MainApplication.java`. 

You will need to do that manually.
