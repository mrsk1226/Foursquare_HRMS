buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        // ✅ Stable Kotlin version (DO NOT use 2.x now)
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.24")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// ✅ Build directory optimization (OK)
val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}

// ✅ Ensure app loads first
subprojects {
    project.evaluationDependsOn(":app")
}

// ❌ REMOVE force Kotlin 2.1.0 (THIS IS CAUSING ISSUE)
subprojects {
    configurations.all {
        resolutionStrategy {
            // ✅ Match Kotlin version with plugin
            force("org.jetbrains.kotlin:kotlin-stdlib:1.9.24")
        }
    }
}

// ✅ Clean task
tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}