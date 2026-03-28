[CmdletBinding()]
param(
    [switch]$BuildApk
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$androidDir = Join-Path $projectRoot "android"
$gradleWrapper = Join-Path $androidDir "gradlew.bat"
$gradleUserHome = if ($env:GRADLE_USER_HOME) {
    $env:GRADLE_USER_HOME
} else {
    Join-Path $env:USERPROFILE ".gradle"
}
$kotlinDaemonHome = Join-Path $env:USERPROFILE ".kotlin"

function Remove-PathIfExists {
    param([string]$LiteralPath)

    if (Test-Path -LiteralPath $LiteralPath) {
        Write-Host "Removing $LiteralPath"
        Remove-Item -LiteralPath $LiteralPath -Recurse -Force
    }
}

function Stop-ProcessIfRunning {
    param(
        [string]$NamePattern,
        [string]$CommandLinePattern
    )

    $matchingProcesses = Get-CimInstance Win32_Process |
        Where-Object {
            $_.Name -like $NamePattern -and
            $_.CommandLine -and
            $_.CommandLine -match $CommandLinePattern
        }

    foreach ($process in $matchingProcesses) {
        Write-Host "Stopping PID $($process.ProcessId): $($process.Name)"
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

Push-Location $projectRoot
try {
    if (Test-Path -LiteralPath $gradleWrapper) {
        Write-Host "Stopping Gradle daemons"
        & $gradleWrapper --stop | Out-Host
    }

    Stop-ProcessIfRunning -NamePattern "java*" -CommandLinePattern "GradleDaemon|KotlinCompileDaemon|org\.jetbrains\.kotlin\.daemon"

    $projectPathsToDelete = @(
        (Join-Path $projectRoot ".gradle"),
        (Join-Path $projectRoot ".dart_tool"),
        (Join-Path $projectRoot "build"),
        (Join-Path $androidDir ".gradle"),
        (Join-Path $androidDir "build"),
        (Join-Path $androidDir "app\build"),
        (Join-Path $androidDir "app\.cxx")
    )

    $systemPathsToDelete = @(
        (Join-Path $gradleUserHome "caches"),
        (Join-Path $gradleUserHome "daemon"),
        (Join-Path $gradleUserHome "kotlin"),
        (Join-Path $gradleUserHome "native"),
        (Join-Path $gradleUserHome "notifications"),
        (Join-Path $gradleUserHome "workers"),
        (Join-Path $kotlinDaemonHome "daemon")
    )

    foreach ($path in $projectPathsToDelete + $systemPathsToDelete) {
        Remove-PathIfExists -LiteralPath $path
    }

    Write-Host "Running flutter clean"
    & flutter clean | Out-Host

    Write-Host "Refreshing Dart/Flutter packages"
    & flutter pub get | Out-Host

    Write-Host "Running Gradle clean without daemon/build cache"
    & $gradleWrapper clean `
        --no-daemon `
        --no-build-cache `
        --refresh-dependencies `
        -Dkotlin.incremental=false `
        -Dkotlin.compiler.execution.strategy=in-process | Out-Host

    if ($BuildApk) {
        Write-Host "Building APK"
        & flutter build apk --release | Out-Host
    } else {
        Write-Host "Next step:"
        Write-Host "  flutter build apk --release"
    }
}
finally {
    Pop-Location
}
