$ErrorActionPreference = 'Stop'

$port = 8090
if ($env:PORT -and (-not [int]::TryParse($env:PORT, [ref]$port) -or $port -lt 1 -or $port -gt 65535)) {
    throw 'PORT must be an integer between 1 and 65535.'
}
$url = "http://127.0.0.1:$port"

function Get-ServerListener {
    Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $port -State Listen -ErrorAction SilentlyContinue
}

Push-Location -LiteralPath $PSScriptRoot
try {
    $node = (Get-Command node.exe).Source
    $pnpm = (Get-Command pnpm.cmd).Source
    $runtime = Join-Path $PSScriptRoot 'tmp/restart-server'
    New-Item -Type Directory -Path $runtime -Force | Out-Null
    $restartLock = [System.IO.File]::Open(
        (Join-Path $runtime 'restart.lock'), 'OpenOrCreate', 'ReadWrite', 'None'
    )
    try {
        & $pnpm build
        if ($LASTEXITCODE -ne 0) {
            throw "Build failed (exit code $LASTEXITCODE)."
        }

        $listener = Get-ServerListener
        if ($listener) {
            $previousServer = Get-Process -Id $listener.OwningProcess
            # Only replace a process that serves this checkout's dist directory.
            $token = [guid]::NewGuid().ToString('N')
            $probeName = "restart-$token.json"
            $probePath = Join-Path $PSScriptRoot "dist/$probeName"
            Set-Content -LiteralPath $probePath -Value $token -Encoding Ascii
            try {
                $probe = Invoke-WebRequest -Uri "$url/$probeName" -TimeoutSec 3 -UseBasicParsing
                if ($probe.Content.Trim() -ne $token -or
                    (Get-ServerListener).OwningProcess -ne $listener.OwningProcess) {
                    throw 'The listener could not be verified.'
                }
            } catch {
                throw "Port $port is occupied by a process that could not be verified as this project's server."
            } finally {
                Remove-Item -LiteralPath $probePath
            }
            Stop-Process -InputObject $previousServer
            if (-not $previousServer.WaitForExit(5000)) {
                throw 'The previous server did not exit within five seconds.'
            }
        }

        $env:PORT = "$port"
        $stdoutLog = Join-Path $runtime 'server.stdout.log'
        $stderrLog = Join-Path $runtime 'server.stderr.log'
        $serverFile = Join-Path $PSScriptRoot 'server.mjs'
        $server = Start-Process -FilePath $node -ArgumentList ('"{0}"' -f $serverFile) `
            -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog

        for ($attempt = 0; $attempt -lt 20; $attempt++) {
            $server.Refresh()
            if ($server.HasExited) {
                break
            }
            try {
                $response = Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing
                if ($response.StatusCode -eq 200 -and (Get-ServerListener).OwningProcess -eq $server.Id) {
                    Write-Host "Server ready at $url (PID $($server.Id))"
                    exit 0
                }
            } catch {
                # The process may still be starting.
            }
            Start-Sleep -Milliseconds 250
        }
        throw "The server did not start successfully. See $stderrLog."
    } finally {
        $restartLock.Dispose()
    }
} finally {
    Pop-Location
}
