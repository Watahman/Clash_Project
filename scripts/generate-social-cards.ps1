Add-Type -AssemblyName System.Drawing

$outputDirectory = Join-Path $PSScriptRoot '..\src\assets\social'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

$cards = @(
    @{
        File = 'clashpanel-home.png'
        Kicker = 'CLASH OF CLANS TOOLKIT'
        Title = 'Plan, track and manage your clan'
        Subtitle = 'CWL planning, live tracking and multi-clan management'
        Accent = '#D4A72C'
    },
    @{
        File = 'cwl-planner.png'
        Kicker = 'CWL PLANNER'
        Title = 'Build stronger seven-day rosters'
        Subtitle = 'Multi-clan lineups, rotations and roster optimization'
        Accent = '#E0B84B'
    },
    @{
        File = 'cwl-tracker.png'
        Kicker = 'CWL TRACKER'
        Title = 'Follow every war day live'
        Subtitle = 'Attacks, standings, performance and season history'
        Accent = '#63C69B'
    },
    @{
        File = 'clan-management.png'
        Kicker = 'CLAN MANAGEMENT'
        Title = 'Keep every clan and member connected'
        Subtitle = 'Linked accounts, availability and Clan Family coordination'
        Accent = '#79A7E8'
    },
    @{
        File = 'bracket-generator.png'
        Kicker = 'BRACKET GENERATOR'
        Title = 'Run a clear knockout tournament'
        Subtitle = 'Seeded or shuffled brackets with automatic progression'
        Accent = '#C792EA'
    }
)

$logoPath = Join-Path $PSScriptRoot '..\src\assets\css\pictures\clashtools-logo.png'
$logo = [System.Drawing.Image]::FromFile($logoPath)
$titleFont = New-Object System.Drawing.Font('Segoe UI', 44, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$subtitleFont = New-Object System.Drawing.Font('Segoe UI', 24, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$kickerFont = New-Object System.Drawing.Font('Segoe UI', 17, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$brandFont = New-Object System.Drawing.Font('Segoe UI', 22, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#F3F5F7'))
$mutedBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#A8B0BC'))
$surfaceBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#151A21'))
$linePen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#303844'), 2)

foreach ($card in $cards) {
    $bitmap = New-Object System.Drawing.Bitmap(1200, 630)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#0C1016'))

    $accentColor = [System.Drawing.ColorTranslator]::FromHtml($card.Accent)
    $accentBrush = New-Object System.Drawing.SolidBrush($accentColor)
    $accentPen = New-Object System.Drawing.Pen($accentColor, 3)

    $graphics.FillRectangle($surfaceBrush, 70, 65, 1060, 500)
    $graphics.DrawRectangle($linePen, 70, 65, 1060, 500)
    $graphics.FillRectangle($accentBrush, 70, 65, 10, 500)

    $graphics.DrawImage($logo, 118, 108, 54, 54)
    $graphics.DrawString('ClashPanel', $brandFont, $whiteBrush, 190, 120)
    $graphics.DrawString($card.Kicker, $kickerFont, $accentBrush, 118, 220)

    $titleArea = New-Object System.Drawing.RectangleF(118, 270, 850, 120)
    $graphics.DrawString($card.Title, $titleFont, $whiteBrush, $titleArea)
    $subtitleArea = New-Object System.Drawing.RectangleF(120, 420, 870, 72)
    $graphics.DrawString($card.Subtitle, $subtitleFont, $mutedBrush, $subtitleArea)

    $graphics.DrawLine($accentPen, 1010, 180, 1010, 455)
    $graphics.FillEllipse($accentBrush, 990, 168, 40, 40)
    $graphics.FillEllipse($accentBrush, 990, 300, 40, 40)
    $graphics.FillEllipse($accentBrush, 990, 435, 40, 40)

    $target = Join-Path $outputDirectory $card.File
    $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)

    $accentPen.Dispose()
    $accentBrush.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

$logo.Dispose()
$titleFont.Dispose()
$subtitleFont.Dispose()
$kickerFont.Dispose()
$brandFont.Dispose()
$whiteBrush.Dispose()
$mutedBrush.Dispose()
$surfaceBrush.Dispose()
$linePen.Dispose()

Write-Output "Generated $($cards.Count) ClashPanel social preview images."
