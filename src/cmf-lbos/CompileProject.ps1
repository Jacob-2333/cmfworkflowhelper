# print the environment variables for debugging

# If proxy is available, use it on npm

$proxyArgument = "";

if (Test-Path env:PRODUCT_PROXY) {
	$proxyArgument = "--proxy $($env:PRODUCT_PROXY)"
}
iex "npm install $proxyArgument"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Npm install failed: Fallback to unzipping node_modules"
    If (Test-Path "./node_modules") { Remove-Item -Path "./node_modules" -Recurse }
    If (Test-Path "./package-lock.json") { Remove-Item "./package-lock.json" }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory("./node_modules_cache.zip", ".")
}

iex ".\node.exe node_modules/typescript/bin/tsc"

Move-Item cmf.lbos.js cmf.lbos-debug.js -force

Move-Item APIReference.js APIReference-debug.js -force

iex ".\node.exe node_modules/uglify-es/bin/uglifyjs --output cmf.lbos.js cmf.lbos-debug.js"
iex ".\node.exe node_modules/uglify-es/bin/uglifyjs --output APIReference.js APIReference-debug.js"
