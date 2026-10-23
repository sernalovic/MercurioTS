// Comprueba que el ejecutable tiene icono incrustado (shell32.ExtractIconEx).
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class Ico {
  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
  public static extern int ExtractIconEx(string lpszFile, int nIconIndex, IntPtr[] phiconLarge, IntPtr[] phiconSmall, int nIcons);
}
'@
$exe = "C:\Users\Jorge\Desktop\PROYECTOS\MercurioTS\apps\desktop\dist\win-unpacked\Mercurio.exe"
$icons = New-Object 'System.IntPtr[]' 2
$n = [Ico]::ExtractIconEx($exe, 0, $icons, $null, 1)
Write-Output "iconos grandes extraidos del exe: $n (0 = sin icono)"
