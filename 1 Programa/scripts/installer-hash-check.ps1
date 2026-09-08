$ErrorActionPreference = "Stop"
# Load only the hash function, never the installer/signing entry point.
$creatorPath = Join-Path (Split-Path -Parent $PSScriptRoot) "crear-instalador.ps1"
$parseTokens = $null
$parseErrors = $null
$creatorAst = [Management.Automation.Language.Parser]::ParseFile($creatorPath, [ref]$parseTokens, [ref]$parseErrors)
if ($parseErrors.Count -gt 0) { throw "Installer script has syntax errors: $parseErrors" }
$hashAst = $creatorAst.Find({
    param($node)
    $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq "Get-FortunaFileHash"
}, $true)
if (-not $hashAst) { throw "Missing installer SHA-256 function." }
. ([scriptblock]::Create($hashAst.Extent.Text))

$testRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
$testDirectory = [IO.Path]::GetFullPath((Join-Path $testRoot ("fortuna-hash-test-" + [Guid]::NewGuid().ToString("N"))))
if (-not $testDirectory.StartsWith("$testRoot\", [StringComparison]::OrdinalIgnoreCase)) {
    throw "Test directory escaped the temporary directory."
}
New-Item -ItemType Directory -Path $testDirectory | Out-Null
$previousAutoload = $PSModuleAutoLoadingPreference
try {
    # Exercise the actual notes assignment using the Windows PowerShell JSON
    # serializer. Get-Content -Raw used to leak provider metadata into notes.
    $notesAssignment = $creatorAst.Find({
        param($node)
        $node -is [Management.Automation.Language.AssignmentStatementAst] -and $node.Left.Extent.Text -eq '$versionNotes'
    }, $true)
    if (-not $notesAssignment) { throw "Missing release notes reader." }
    $versionNotesPath = Join-Path $testDirectory "release-notes.md"
    $expectedNotes = "# Version`n`nCanicas y voz " + [char]0xE9 + ".`n"
    [IO.File]::WriteAllText($versionNotesPath, $expectedNotes, (New-Object Text.UTF8Encoding($false)))
    . ([scriptblock]::Create($notesAssignment.Extent.Text))
    $notesJson = [ordered]@{ notes = $versionNotes } | ConvertTo-Json -Depth 5
    $parsedNotes = ($notesJson | ConvertFrom-Json).notes
    if ($parsedNotes -isnot [string] -or $parsedNotes -cne $expectedNotes -or $notesJson.Contains('PSPath')) {
        throw "Release notes must serialize as plain Unicode text without provider metadata."
    }
    "Release notes: Windows PowerShell JSON round-trip, plain Unicode string, no provider metadata OK."
    # Reproduce an environment where the Get-FileHash module is unavailable.
    $PSModuleAutoLoadingPreference = "None"
    function Get-FileHash { throw "Get-FileHash must not be required by the installer." }
    $filePath = [IO.Path]::Combine($testDirectory, ("voz [Daniela] " + [char]0xE9 + ".bin"))
    [IO.File]::WriteAllBytes($filePath, [Text.Encoding]::ASCII.GetBytes("abc"))
    $actual = Get-FortunaFileHash -LiteralPath $filePath
    if ($actual -cne "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD") {
        throw "Incorrect SHA-256 for literal Unicode path: $actual"
    }
    # Opening the same file exclusively also checks that hashing released it.
    $exclusive = [IO.File]::Open($filePath, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $exclusive.Dispose()
    [IO.File]::WriteAllBytes($filePath, [byte[]]@())
    if ((Get-FortunaFileHash -LiteralPath $filePath) -cne "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855") {
        throw "Incorrect SHA-256 for empty file."
    }
    $missingRejected = $false
    try { $null = Get-FortunaFileHash -LiteralPath ([IO.Path]::Combine($testDirectory, "missing.bin")) }
    catch { $missingRejected = $true }
    if (-not $missingRejected) { throw "Missing files must fail, not produce an empty hash." }
    "Installer SHA-256: Windows PowerShell, no module autoload, Unicode/literal path, empty and missing files, stream disposal OK."
}
finally {
    $PSModuleAutoLoadingPreference = $previousAutoload
    Remove-Item -LiteralPath $testDirectory -Recurse -Force
}
