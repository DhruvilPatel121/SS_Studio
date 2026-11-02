Get-ChildItem -Path "src" -Recurse -Filter "*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $newContent = $content -replace 'from "@/components/layout/', 'from "@/components/layouts/'
    if ($content -ne $newContent) {
        Set-Content -Path $_.FullName -Value $newContent -NoNewline
        Write-Host "Fixed: $($_.FullName)"
    }
}
Write-Host "Done!"
