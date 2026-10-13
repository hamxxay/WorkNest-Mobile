# R8 rules for the release build (minifyEnabled true in android/app/build.gradle).
#
# Most libraries ship their own consumer rules inside their AARs, so nothing is needed here for:
#   React Native core (react-android, hermes-android, fbjni, Yoga, Fresco), react-native-reanimated,
#   react-native-worklets, react-native-svg, Firebase (app, auth, messaging), Google Play services
#   (Google Sign-In), AndroidX and OkHttp.
#
# The React Native libraries below ship no rules. JS reaches their native modules and views by name, and
# some of them load generated classes through reflection (for example
# "<Package>$$ReactModuleInfoProvider"), so their classes are kept whole. They are small; R8 still shrinks
# and obfuscates everything else.
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-keep class com.reactcommunity.rndatetimepicker.** { *; }
-keep class io.invertase.firebase.** { *; }
-keep class com.reactnativegooglesignin.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.mkuczera.haptic.** { *; }
-keep class com.imagepicker.** { *; }
-keep class com.oblador.keychain.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.swmansion.rnscreens.** { *; }
-keep class cl.json.** { *; }
-keep class fr.greweb.reactnativeviewshot.** { *; }
-keep class com.oblador.vectoricons.** { *; }

# Line numbers in crash stack traces. Class and method names are obfuscated: deobfuscate with
# android/app/build/outputs/mapping/release/mapping.txt from the same build (an AAB carries it to Play
# Console automatically; keep a copy for every APK you hand out).
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
