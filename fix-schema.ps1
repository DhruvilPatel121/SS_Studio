# Fix schema mismatches
Get-ChildItem -Path "src" -Recurse -Filter "*.tsx","*.ts" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $newContent = $content -replace 'photographer_id', 'user_id'
    $newContent = $newContent -replace 'studios', 'profiles'
    $newContent = $newContent -replace 'get_studio_media_stats', 'get_profile_stats'
    if ($content -ne $newContent) {
        Set-Content -Path $_.FullName -Value $newContent -NoNewline
        Write-Host "Fixed: $($_.FullName)"
    }
}
Write-Host "Done! Restart the app."
