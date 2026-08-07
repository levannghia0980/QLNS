$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = [System.IO.Path]::Combine($desktop, "QLNV - Viettel Software.lnk")
$targetPath = "d:\TTS\QLNV\start.bat"
$workDir = "d:\TTS\QLNV"

$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($shortcutPath)
$sc.TargetPath = $targetPath
$sc.WorkingDirectory = $workDir
$sc.Description = "Khởi chạy hệ thống Quản lý Nhân sự Viettel Software (BE + FE React)"
$sc.IconLocation = "shell32.dll,220"
$sc.Save()
Write-Host "Created shortcut successfully at: $shortcutPath"
