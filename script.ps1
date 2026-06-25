Add-Type -AssemblyName System.Drawing
$original = [System.Drawing.Image]::FromFile('C:\Users\Raunak Dey\all_programs\TheMathemaniacApp\TheMathmaniac\Mathemaniac_Logo.png')
$bmp = New-Object System.Drawing.Bitmap 1024, 1024
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
# We want the logo to fit nicely in the 680x680 safe zone.
# The original image is maybe not square, so let's scale it while preserving aspect ratio.
$scale = [math]::Min(680.0 / $original.Width, 680.0 / $original.Height)
$newWidth = [int]($original.Width * $scale)
$newHeight = [int]($original.Height * $scale)
$x = (1024 - $newWidth) / 2
$y = (1024 - $newHeight) / 2
$g.DrawImage($original, $x, $y, $newWidth, $newHeight)
$g.Dispose()
$original.Dispose()
$bmp.Save('C:\Users\Raunak Dey\all_programs\TheMathemaniacApp\TheMathmaniac\mobile\assets\Mathemaniac_Logo_Padded.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
