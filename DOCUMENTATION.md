### Codepush

#### Install code-push CLI

```
npm i -g code-push-cli
# or
yarn global add code-push-cli
```

#### First time? Register & Setup!

* `code-push login`
* Create an account
* Log in with the newly created account
* Paste the token into your terminal
* Create the apps:
    * `code-push app add MY_APP-Android android react-native`
    * `code-push app add MY_APP-iOS ios react-native`
* `react-native link react-native-code-push` and paste the API key when it asks you

#### Logging in

```
code-push login
# enter your credentials
```

#### Verify you have access to the apps

```
code-push app list
```

You should see:

```
┌───────────────────────────────────┬─────────────────────┐
│ Name                              │ Deployments         │
├───────────────────────────────────┼─────────────────────┤
│ MY_APP-Android                    │ Production, Staging │
├───────────────────────────────────┼─────────────────────┤
│ MY_APP-iOS                        │ Production, Staging │
└───────────────────────────────────┴─────────────────────┘
```

#### How to release for everyone

```
code-push release-react MY_APP-iOS ios
code-push release-react MY_APP-Android android
```

#### How to release for only one specific version

```
code-push release-react MY_APP-iOS ios --targetBinaryVersion "~1.1.0"
code-push release-react MY_APP-Android android --targetBinaryVersion "~1.1.0"
```

#### How to release for Staging/Production

```
code-push release-react MY_APP-iOS ios --targetBinaryVersion "~1.1.0"
code-push release-react MY_APP-Android android --targetBinaryVersion "~1.1.0"

# Release the latest Staging bundle to Production
code-push promote MY_APP-iOS Staging Production
code-push promote MY_APP-Android Staging Production
```

More possibilities on the [react-native-code-push repo](https://github.com/microsoft/react-native-code-push#releasing-updates)

#### Code sign for better security

Code Signing: https://github.com/Microsoft/react-native-code-push/blob/master/docs/setup-ios.md

