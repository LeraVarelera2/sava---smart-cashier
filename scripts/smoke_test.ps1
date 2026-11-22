param(
    [string]$BaseUrl = 'http://127.0.0.1:8000',
    [string]$Email = 'admin@sava.test'
)

$ErrorActionPreference = 'Stop'
$script:FailureCount = 0
$BaseUrl = $BaseUrl.TrimEnd('/')

function Invoke-SmokeStep {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    try {
        $value = & $Action
        Write-Host "[LULUS] $Name"
        return [pscustomobject]@{ Passed = $true; Value = $value }
    }
    catch {
        $script:FailureCount++
        Write-Host "[GAGAL] $Name - $($_.Exception.Message)"
        return [pscustomobject]@{ Passed = $false; Value = $null }
    }
}

$password = $env:ADMIN_PASSWORD
if ([string]::IsNullOrWhiteSpace($password)) {
    $securePassword = Read-Host "Password untuk $Email" -AsSecureString
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try {
        $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
}

$login = Invoke-SmokeStep -Name 'Login admin' -Action {
    $response = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/login" `
        -ContentType 'application/json' `
        -Body (@{ email = $Email; password = $password } | ConvertTo-Json)
    if ([string]::IsNullOrWhiteSpace($response.token)) {
        throw 'Respons login tidak berisi token.'
    }
    $response
}

if (-not $login.Passed) {
    Write-Host "Smoke test gagal: $script:FailureCount langkah."
    exit 1
}

$headers = @{ Authorization = "Bearer $($login.Value.token)"; Accept = 'application/json' }

$transaction = Invoke-SmokeStep -Name 'Buat satu transaksi kasir' -Action {
    $catalog = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/products" -Headers $headers
    $variant = $null
    foreach ($product in $catalog.data) {
        $variant = $product.variants | Select-Object -First 1
        if ($null -ne $variant) {
            break
        }
    }
    if ($null -eq $variant) {
        throw 'Katalog tidak memiliki varian aktif; seed katalog terlebih dahulu.'
    }
    $body = @{ items = @(@{ variant_id = $variant.id; qty = 1 }) } | ConvertTo-Json -Depth 5
    $response = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/transactions" `
        -Headers $headers -ContentType 'application/json' -Body $body
    if ($null -eq $response.data.id) {
        throw 'Respons transaksi tidak berisi ID transaksi.'
    }
    Write-Host "        Transaksi: $($response.data.code)"
    $response
}

$dashboardEndpoints = @(
    'summary',
    'trend',
    'top-products',
    'busy-days',
    'busy-hours'
)
foreach ($endpoint in $dashboardEndpoints) {
    $null = Invoke-SmokeStep -Name "Dashboard /$endpoint" -Action {
        $response = Invoke-RestMethod -Method Get `
            -Uri "$BaseUrl/api/dashboard/$endpoint" -Headers $headers
        if ($null -eq $response.data) {
            throw 'Respons tidak berisi properti data.'
        }
        $response
    }
}

$mlEndpoints = @(
    @{ Path = 'forecast?days=7'; Name = 'forecast'; Property = 'forecast' },
    @{ Path = 'classification'; Name = 'classification'; Property = 'products' },
    @{ Path = 'bundling?basis=day'; Name = 'bundling'; Property = 'rule_count' },
    @{ Path = 'evaluation'; Name = 'evaluation'; Property = 'forecast' }
)
foreach ($endpoint in $mlEndpoints) {
    $null = Invoke-SmokeStep -Name "ML /$($endpoint.Name)" -Action {
        $response = Invoke-RestMethod -Method Get `
            -Uri "$BaseUrl/api/ml/$($endpoint.Path)" -Headers $headers
        if ($null -eq $response.($endpoint.Property)) {
            throw "Respons tidak berisi properti $($endpoint.Property)."
        }
        $response
    }
}

if ($script:FailureCount -gt 0) {
    Write-Host "Smoke test GAGAL: $script:FailureCount langkah gagal."
    exit 1
}

Write-Host 'Smoke test LULUS: semua langkah berhasil.'
exit 0
