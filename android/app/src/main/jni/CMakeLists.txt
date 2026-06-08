# App-level CMake for the React Native New Architecture build.
#
# This overrides react-native's default-app-setup/CMakeLists.txt so we can link
# Oboe and compile our own C++ audio engine (kept under ../cpp per the roadmap
# folder structure). The presence of a custom OnLoad.cpp in this directory makes
# ReactNative-application.cmake pick up *our* OnLoad (which registers the C++
# TurboModule via cxxModuleProvider).

cmake_minimum_required(VERSION 3.13)

# Library name must stay "appmodules" — RN's build expects this target.
project(appmodules)

# Everything needed to build an RN app with the New Architecture. This creates
# the `appmodules` shared lib from the *.cpp files in THIS directory (our
# OnLoad.cpp) plus the autolinked sources, and wires up app-level codegen
# (generates AppSpecsJSI.h with NativeAudioEngineCxxSpec<T>).
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# --- Oboe (low-latency audio) via prefab ------------------------------------
find_package(oboe REQUIRED CONFIG)

# --- Our native audio engine (C++17) lives in ../cpp ------------------------
# (tsf.h is header-only; TSF_IMPLEMENTATION is compiled inside SynthEngine.cpp.)
target_sources(${CMAKE_PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/../cpp/AudioEngine.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/../cpp/SynthEngine.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/../cpp/PcmRecorder.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/../cpp/NativeAudioEngine.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/../cpp/AudioEngineJni.cpp
)
target_include_directories(${CMAKE_PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/../cpp
)

# Oboe (low-latency audio) + android (AAssetManager) + log (diagnostics).
find_library(android-lib android)
find_library(log-lib log)
target_link_libraries(${CMAKE_PROJECT_NAME} oboe::oboe ${android-lib} ${log-lib})
