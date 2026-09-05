# Genera los iconos PNG de FichaMe con System.Drawing.
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\generate-icons.ps1
# Salida: public/icon-512.png, public/icon-192.png, public/apple-touch-icon.png, public/favicon.png

param(
  [int[]]$Sizes = @(512, 192, 180, 64),
  [string]$OutDir = "public"
)

Add-Type -AssemblyName System.Drawing

$brand = [System.Drawing.Color]::FromArgb(31, 122, 80)
$white = [System.Drawing.Color]::White

function New-RoundedRectPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return ,$path
}

if (-not (Test-Path $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir | Out-Null
}

foreach ($size in $Sizes) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $s = $size / 512.0
  $inset = 8 * $s
  $radius = 96 * $s
  $side = 512 * $s

  $path = New-RoundedRectPath $inset $inset ($side - 2 * $inset) ($side - 2 * $inset) $radius
  $sb = New-Object System.Drawing.SolidBrush $brand
  $g.FillPath($sb, $path)

  $pen = New-Object System.Drawing.Pen($white, (26 * $s))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($pen, 165 * $s, 262 * $s, 230 * $s, 326 * $s)
  $g.DrawLine($pen, 230 * $s, 326 * $s, 356 * $s, 190 * $s)

  $file = switch ($size) {
    180 { Join-Path $OutDir "apple-touch-icon.png" }
    64  { Join-Path $OutDir "favicon.png" }
    default { Join-Path $OutDir "icon-$size.png" }
  }
  $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $sb.Dispose()
  $pen.Dispose()
  $g.Dispose()
  Write-Output "Generado: $file"
}