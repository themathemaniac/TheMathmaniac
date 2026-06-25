Add-Type -AssemblyName System.Drawing
$original = [System.Drawing.Image]::FromFile('C:\Users\Raunak Dey\all_programs\TheMathemaniacApp\TheMathmaniac\Mathemaniac_Logo.png')
$bmp = New-Object System.Drawing.Bitmap 1024, 1024
$g = [System.Drawing.Graphics]::FromImage($bmp)
# Use high quality interpolation
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::White)
# We want the logo to fit nicely with plenty of padding, so let's scale it to fit within a 550x550 box.
$scale = [math]::Min(550.0 / $original.Width, 550.0 / $original.Height)
$newWidth = [int]($original.Width * $scale)
$newHeight = [int]($original.Height * $scale)
$x = (1024 - $newWidth) / 2
$y = (1024 - $newHeight) / 2
$g.DrawImage($original, $x, $y, $newWidth, $newHeight)
$g.Dispose()
$original.Dispose()
$bmp.Save('C:\Users\Raunak Dey\all_programs\TheMathemaniacApp\TheMathmaniac\mobile\assets\Mathemaniac_Logo_Padded.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
