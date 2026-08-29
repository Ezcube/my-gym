param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9]{4}$')]
  [string]$ExerciseId,

  [Parameter(Mandatory = $true)]
  [ValidateSet('technique', 'muscles')]
  [string]$Kind,

  [Parameter(Mandatory = $true)]
  [string]$Source
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$magick = (Get-Command magick -ErrorAction Stop).Source
$size = if ($Kind -eq 'technique') { '1200x800' } else { '1200x675' }
$destinationDir = Join-Path $repo "frontend\public\exercise-visuals\$ExerciseId"
$destination = Join-Path $destinationDir "$Kind.webp"
$temporary = Join-Path $destinationDir "$Kind.import-$PID.webp"

if (Test-Path -LiteralPath $destination) {
  throw "Refusing to overwrite accepted asset: $destination"
}

New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null
try {
  $quality = $null
  foreach ($candidate in 78, 72, 66) {
    & $magick $sourcePath -auto-orient -resize "${size}>" -gravity center `
      -background '#0b0e0c' -extent $size -alpha remove -alpha off `
      -strip -quality $candidate $temporary
    if ($LASTEXITCODE -ne 0) { throw "ImageMagick failed with exit code $LASTEXITCODE" }
    $temporaryFile = Get-Item -LiteralPath $temporary
    if ($temporaryFile.Length -le 307200) { $quality = $candidate; break }
  }

  if ($null -eq $quality) {
    throw 'Asset remains larger than 307200 bytes at WebP quality 66'
  }

  $geometry = (& $magick identify -format '%wx%h' $temporary).Trim()
  if ($geometry -ne $size) { throw "Unexpected geometry: $geometry; expected $size" }

  $file = Get-Item -LiteralPath $temporary
  if ($file.Length -le 0) { throw 'Asset is empty' }

  $header = [IO.File]::ReadAllBytes($temporary)
  if ($header.Length -lt 12 -or
      [Text.Encoding]::ASCII.GetString($header, 0, 4) -ne 'RIFF' -or
      [Text.Encoding]::ASCII.GetString($header, 8, 4) -ne 'WEBP') {
    throw 'Output is not a WebP RIFF file'
  }

  Move-Item -LiteralPath $temporary -Destination $destination
  Write-Output "accepted=$destination bytes=$($file.Length) geometry=$geometry quality=$quality"
} finally {
  if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
}
