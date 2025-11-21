#!/bin/bash
export TMPDIR="/media/joe/New Volume1/eas-build-temp"
export GRADLE_USER_HOME="/media/joe/New Volume1/gradle-cache"
export JAVA_OPTS='-Djava.io.tmpdir="/media/joe/New Volume1/eas-build-temp"'
mkdir -p "$TMPDIR"
mkdir -p "$GRADLE_USER_HOME"
eas build --profile development --platform android --local
