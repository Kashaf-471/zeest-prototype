# Generate a labelled synthetic voice fixture using the local Windows speech engine.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$output = Join-Path $PSScriptRoot 'fixtures/synthetic-speech.wav'
New-Item -ItemType Directory -Force (Split-Path $output) | Out-Null
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
 $speaker.Rate = -1
 $speaker.SetOutputToWaveFile($output)
 $speaker.Speak('This is a synthetic consultation recording for the Zeest local prototype. The patient reports a cough for three days. The physician will review the notes before saving.')
} finally { $speaker.Dispose() }
Write-Output "Synthetic speech fixture written to $output"
