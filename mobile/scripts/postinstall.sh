#!/bin/bash
# Patch RN 0.73 gradle plugin to disable -Werror

GRADLE_PLUGIN="node_modules/@react-native/gradle-plugin"

# Disable -Werror in gradle plugin (prevents build failures from deprecation warnings)
sed -i 's/allWarningsAsErrors = true/allWarningsAsErrors = false/' "$GRADLE_PLUGIN/build.gradle.kts"

echo "Patched @react-native/gradle-plugin: disabled allWarningsAsErrors"
