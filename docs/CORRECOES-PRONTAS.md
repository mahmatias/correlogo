# 🔧 CORREÇÕES PRONTAS - Copy & Paste

**Para cada problema encontrado na auditoria**

---

## AUTO-UPDATE (CRÍTICO)

### Fix 1: Gerar update-manifest.json no CI

**Arquivo:** `.github/workflows/firebase-deploy.yml`

**ANTES:**
```yaml
- name: Upload APK to GitHub Release
  run: |
    gh release upload latest app-release.apk update-manifest.json
```

**DEPOIS:**
```yaml
- name: Extract versionName from gradle
  id: version
  run: |
    VERSION=$(grep "versionName" app/build.gradle | head -1 | sed 's/.*"\(.*\)".*/\1/')
    echo "version=$VERSION" >> $GITHUB_OUTPUT

- name: Generate update manifest
  run: |
    cat > update-manifest.json << EOF
    {
      "versionCode": ${{ github.run_number }},
      "versionName": "${{ steps.version.outputs.version }}",
      "downloadUrl": "https://github.com/${{ github.repository }}/releases/download/latest/app-release.apk"
    }
    EOF
    cat update-manifest.json
    # Validate JSON
    python3 -m json.tool update-manifest.json > /dev/null

- name: Upload APK to GitHub Release
  run: |
    git tag -f latest HEAD
    git push origin latest --force
    
    if gh release view latest > /dev/null 2>&1; then
      gh release upload latest --clobber app-release.apk update-manifest.json
    else
      gh release create latest \
        --title "Latest Release" \
        --notes "Automatic build from CI" \
        app-release.apk \
        update-manifest.json
    fi
```

---

### Fix 2: Sincronizar versionCode CI ↔ App

**Arquivo:** `app/build.gradle`

**ANTES:**
```gradle
defaultConfig {
  applicationId "com.correlogo.app"
  minSdk 21
  targetSdk 34
  versionCode 1
  versionName "1.0"
}
```

**DEPOIS:**
```gradle
defaultConfig {
  applicationId "com.correlogo.app"
  minSdk 21
  targetSdk 34
  
  // Pega versionCode da CI se disponível, senão usa default
  versionCode System.getenv("CI_VERSION_CODE")?.toInteger() ?: 100
  versionName "2.2"
}
```

**Arquivo:** `.github/workflows/firebase-deploy.yml`

Adicione env no job:
```yaml
jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    env:
      CI_VERSION_CODE: ${{ github.run_number }}
```

---

### Fix 3: Adicionar FileProvider no AndroidManifest.xml

**Arquivo:** `android/app/src/main/AndroidManifest.xml`

**DEPOIS:** (adicione dentro de `<application>`)
```xml
<provider
  android:name="androidx.core.content.FileProvider"
  android:authorities="${applicationId}.fileprovider"
  android:exported="false"
  android:grantUriPermissions="true">
  <meta-data
    android:name="android.support.FILE_PROVIDER_PATHS"
    android:resource="@xml/file_paths" />
</provider>
```

**Arquivo:** `android/app/src/main/res/xml/file_paths.xml` (CRIAR)

```xml
<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
  <cache-path
    name="cache"
    path="." />
  <external-cache-path
    name="external_cache"
    path="." />
</paths>
```

---

### Fix 4: Adicionar Permissão para Instalar APK

**Arquivo:** `android/app/src/main/AndroidManifest.xml`

Adicione (depois de `<uses-permission...>`):
```xml
<!-- Auto-update APK install -->
<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
```

---

### Fix 5: Fetch com Timeout + Retry

**Arquivo:** `src/lib/update-checker.ts`

**NOVO CÓDIGO:**
```typescript
const MANIFEST_URL =
  'https://api.github.com/repos/mahmatias/correlogo/releases/latest';

interface UpdateInfo {
  versionCode: number;
  versionName: string;
  downloadUrl: string;
  releaseNotes?: string;
}

async function fetchLatestReleaseFromAPI(): Promise<UpdateInfo | null> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(MANIFEST_URL, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Cache-Control': 'no-cache',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const release = await response.json();

      // Validar schema
      if (!release.tag_name || !release.assets) {
        throw new Error('Invalid release format');
      }

      const apkAsset = release.assets.find(
        (a: any) => a.name === 'app-release.apk'
      );
      if (!apkAsset) {
        throw new Error('APK asset not found in release');
      }

      // Parse versionCode from tag (v123 → 123)
      const tagMatch = release.tag_name.match(/v?(\d+)/);
      const versionCode = tagMatch ? parseInt(tagMatch[1]) : 0;

      if (versionCode === 0) {
        throw new Error('Invalid version code in tag');
      }

      return {
        versionCode,
        versionName: release.tag_name,
        downloadUrl: apkAsset.browser_download_url,
        releaseNotes: release.body,
      };
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `Update check attempt ${attempt + 1}/${maxRetries} failed:`,
        lastError.message
      );

      // Exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries - 1) {
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  console.error('Update check failed after retries:', lastError?.message);
  return null;
}

export async function checkForUpdate(
  currentVersionCode: number
): Promise<{ available: boolean; info?: UpdateInfo }> {
  const manifest = await fetchLatestReleaseFromAPI();

  if (!manifest) {
    return { available: false };
  }

  if (manifest.versionCode > currentVersionCode) {
    return { available: true, info: manifest };
  }

  return { available: false };
}
```

---

### Fix 6: Progress UI no Download

**Arquivo:** `src/components/UpdatePrompt.tsx`

**NOVO CÓDIGO (Adicionar):**
```typescript
import { Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export function UpdatePrompt({
  updateInfo,
  onDismiss,
}: {
  updateInfo: UpdateInfo;
  onDismiss: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  async function handleDownload() {
    try {
      setDownloading(true);
      setDownloadProgress(0);

      // Download com progress
      const response = await fetch(updateInfo.downloadUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const total = parseInt(
        response.headers.get('content-length') || '0'
      );
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const chunks: Uint8Array[] = [];
      let downloaded = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        downloaded += value.length;

        if (total > 0) {
          const percent = Math.round((downloaded / total) * 100);
          setDownloadProgress(percent);
        }
      }

      const blob = new Blob(chunks, {
        type: 'application/vnd.android.package-archive',
      });

      // Escrever arquivo
      const fileName = `correlogo-${updateInfo.versionName}.apk`;
      const result = await Filesystem.writeFile({
        path: fileName,
        data: blob,
        directory: FilesystemDirectory.Cache,
      });

      // Instalar APK
      const Apk = registerPlugin('ApkInstaller');
      await Apk.installApk({
        filePath: result.uri,
      });

      setDownloading(false);
    } catch (error) {
      console.error('Download/install failed:', error);
      setDownloading(false);
    }
  }

  return (
    <div className="modal">
      <h2>Atualização Disponível</h2>
      <p>Versão {updateInfo.versionName}</p>

      {updateInfo.releaseNotes && (
        <div className="release-notes">
          <h3>Novidades:</h3>
          <p>{updateInfo.releaseNotes}</p>
        </div>
      )}

      {downloading && (
        <div className="progress">
          <div className="progress-bar" style={{ width: `${downloadProgress}%` }} />
          <p>{downloadProgress}% baixado...</p>
        </div>
      )}

      <div className="buttons">
        <button onClick={onDismiss} disabled={downloading}>
          Agora não
        </button>
        <button onClick={handleDownload} disabled={downloading}>
          {downloading ? 'Baixando...' : 'Atualizar Agora'}
        </button>
      </div>
    </div>
  );
}
```

---

## FTMS BLUETOOTH

### Fix 1: Keep-Alive Error Handling

**Arquivo:** `android/app/src/main/.../TreadmillBleService.kt`

**ANTES:**
```kotlin
private fun enableKeepalive() {
  serviceScope.launch(keepAliveJob) {
    while (isActive) {
      delay(KEEP_ALIVE_INTERVAL_MS)
      sendCommand(lastCommand)
    }
  }
}
```

**DEPOIS:**
```kotlin
private fun enableKeepalive() {
  keepAliveJob?.cancel()
  keepAliveJob = serviceScope.launch {
    while (isActive) {
      try {
        delay(KEEP_ALIVE_INTERVAL_MS)
        if (currentState == State.CONTROLLED && lastCommand != null) {
          sendCommand(lastCommand!!)
        }
      } catch (e: CancellationException) {
        Log.d("FTMS", "Keep-alive cancelled")
        throw e
      } catch (e: Exception) {
        Log.e("FTMS", "Keep-alive error: ${e.message}")
        // Não crash, apenas log
      }
    }
  }
}

override fun onDestroy() {
  keepAliveJob?.cancel()
  super.onDestroy()
}
```

---

### Fix 2: Request Control com Retry

**Arquivo:** `android/app/src/main/.../TreadmillBleService.kt`

**NOVO MÉTODO:**
```kotlin
private fun requestControlWithRetry(
  maxAttempts: Int = 3,
  delayMs: Long = 500,
) {
  var attempts = 0

  fun attempt() {
    if (attempts >= maxAttempts) {
      Log.e("FTMS", "Failed to request control after $maxAttempts attempts")
      disconnect()
      return
    }

    attempts++
    Log.d("FTMS", "Request Control attempt $attempts/$maxAttempts")
    sendCommand(byteArrayOf(0x00))

    // Agendar retry se não receber response
    handler.postDelayed({
      if (currentState != State.CONTROLLED) {
        attempt()
      }
    }, delayMs)
  }

  attempt()
}

// Chamar após enableNotifications():
private fun onServicesDiscovered() {
  enableNotifications()
  requestControlWithRetry()  // ← Em vez de sendCommand(0x00)
}

// Callback para receber response
override fun onCharacteristicChanged(gatt: BluetoothGatt?, characteristic: BluetoothGattCharacteristic?) {
  when (characteristic?.uuid) {
    UUID.fromString(CONTROL_POINT_UUID) -> {
      val data = characteristic.value
      val opcode = data[0]
      val result = data.getOrNull(1)?.toInt() ?: -1

      if (opcode == 0x80.toByte()) {  // Response opcode
        when (result) {
          0x00 -> {
            Log.d("FTMS", "Request Control successful")
            currentState = State.CONTROLLED
            handler.removeCallbacksAndMessages(null)  // Cancel retries
          }
          else -> {
            Log.e("FTMS", "Request Control failed: $result")
            // Retry vai tentar novamente
          }
        }
      }
    }
  }
}
```

---

### Fix 3: Connection + Discovery Timeout

**Arquivo:** `android/app/src/main/.../TreadmillBleService.kt`

**NOVO CÓDIGO:**
```kotlin
private var connectionTimeoutRunnable: Runnable? = null
private var discoveryTimeoutRunnable: Runnable? = null

fun connect(address: String) {
  currentState = State.CONNECTING
  val device = bluetoothAdapter.getRemoteDevice(address)
  gatt = device.connectGatt(this, false, gattCallback, BluetoothDevice.TRANSPORT_LE)

  // Timeout: 10s para conectar
  connectionTimeoutRunnable = Runnable {
    if (currentState == State.CONNECTING) {
      Log.e("FTMS", "Connection timeout")
      disconnect()
      emitError("Conexão expirada após 10s")
    }
  }
  handler.postDelayed(connectionTimeoutRunnable!!, 10000)
}

override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
  when (newState) {
    BluetoothProfile.STATE_CONNECTED -> {
      Log.d("FTMS", "Connected")
      handler.removeCallbacks(connectionTimeoutRunnable!!)  // Cancel connect timeout

      currentState = State.DISCOVERING
      gatt?.discoverServices()

      // Timeout: 5s para descobrir serviços
      discoveryTimeoutRunnable = Runnable {
        if (currentState == State.DISCOVERING) {
          Log.e("FTMS", "Discovery timeout")
          disconnect()
          emitError("Falha ao descobrir serviços após 5s")
        }
      }
      handler.postDelayed(discoveryTimeoutRunnable!!, 5000)
    }

    BluetoothProfile.STATE_DISCONNECTED -> {
      Log.d("FTMS", "Disconnected")
      handler.removeCallbacks(connectionTimeoutRunnable!!)
      handler.removeCallbacks(discoveryTimeoutRunnable!!)
      currentState = State.DISCONNECTED
    }
  }
}

override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
  handler.removeCallbacks(discoveryTimeoutRunnable!!)  // Cancel discovery timeout

  if (status != BluetoothGatt.GATT_SUCCESS) {
    Log.e("FTMS", "Service discovery failed: $status")
    disconnect()
    return
  }

  Log.d("FTMS", "Services discovered successfully")
  // ... resto do código
}

override fun onDestroy() {
  handler.removeCallbacks(connectionTimeoutRunnable!!)
  handler.removeCallbacks(discoveryTimeoutRunnable!!)
  super.onDestroy()
}
```

---

### Fix 4: UUID Validation

**Arquivo:** `android/app/src/main/.../TreadmillFtmsManager.kt`

**NO COMPANION OBJECT:**
```kotlin
companion object {
  private const val FTMS_SERVICE = "00001826-0000-1000-8000-00805f9b34fb"
  private const val TREADMILL_DATA = "00002acd-0000-1000-8000-00805f9b34fb"
  private const val CONTROL_POINT = "00002ad9-0000-1000-8000-00805f9b34fb"
  private const val CCCD = "00002902-0000-1000-8000-00805f9b34fb"

  init {
    validateUUIDs()
  }

  private fun validateUUIDs() {
    val expectedUUIDs = mapOf(
      "FTMS_SERVICE" to FTMS_SERVICE,
      "TREADMILL_DATA" to TREADMILL_DATA,
      "CONTROL_POINT" to CONTROL_POINT,
      "CCCD" to CCCD,
    )

    expectedUUIDs.forEach { (name, uuid) ->
      // Apenas check syntax, não falha se inválido
      try {
        UUID.fromString(uuid)
        Log.d("FTMS", "✓ UUID válido: $name = $uuid")
      } catch (e: IllegalArgumentException) {
        Log.e("FTMS", "✗ UUID INVÁLIDO: $name = $uuid")
        throw IllegalStateException("Invalid UUID constant: $name")
      }
    }
  }
}
```

---

## SHARE CARD

### Fix 1: Font Loading

**Arquivo:** `src/lib/shareCard.ts`

**ANTES:**
```typescript
export async function captureCard(element: HTMLElement): Promise<Blob> {
  return domtoimage.toBlob(element, {
    width: 1080 * 2,
    height: 1920 * 2,
  });
}
```

**DEPOIS:**
```typescript
export async function captureCard(element: HTMLElement): Promise<Blob> {
  // Aguardar todas as fonts carregarem
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch (e) {
      console.warn('Font loading failed:', e);
      // Continua mesmo se falhar
    }
  }

  return domtoimage.toBlob(element, {
    width: 1080 * 2,
    height: 1920 * 2,
    style: {
      width: '1080px',
      height: '1920px',
      transform: 'scale(2)',
      transformOrigin: '0 0',
    },
    cacheBust: true,
    quality: 1.0,
  });
}
```

---

### Fix 2: Checkbox Sync

**Arquivo:** `src/components/SessionSummary.tsx`

**NOVO ESTADO:**
```typescript
const [captureReady, setCaptureReady] = useState(false);

useEffect(() => {
  // Quando qualquer opção de stats muda, reset capture ready
  setCaptureReady(false);
  
  // Aguardar 450ms para garantir render off-screen
  const timer = setTimeout(() => {
    setCaptureReady(true);
  }, 450);

  return () => clearTimeout(timer);
}, [showDistance, showEnergy, showHR, selectedVariant]);

return (
  <modal>
    {/* Checkboxes */}
    <label>
      <input
        type="checkbox"
        checked={showDistance}
        onChange={(e) => setShowDistance(e.target.checked)}
      />
      Mostrar Distância
    </label>

    {/* Preview */}
    <div style={{ transform: 'scale(0.2)' }}>
      <ShareCard
        variant={selectedVariant}
        showDistance={showDistance}
        // ... outros props
      />
    </div>

    {/* Hidden capture */}
    <div style={{ position: 'fixed', left: '-9999px' }} ref={cardCaptureRef}>
      <ShareCard
        variant={selectedVariant}
        showDistance={showDistance}
        // ... outros props (MESMO que preview)
      />
    </div>

    {/* Botão */}
    <button
      onClick={handleShare}
      disabled={!captureReady || isCapturing}
    >
      {!captureReady ? 'Preparando...' : 'Compartilhar'}
    </button>
  </modal>
);
```

---

## 📋 ORDEM DE IMPLEMENTAÇÃO

**Prioridade 1 - AUTO-UPDATE (CRÍTICO):**
```
1. Fix 1: Gerar update-manifest.json (.github/workflows/firebase-deploy.yml)
2. Fix 2: Sincronizar versionCode (app/build.gradle + firebase-deploy.yml)
3. Fix 3: FileProvider (AndroidManifest.xml + file_paths.xml)
4. Fix 4: Permissão REQUEST_INSTALL_PACKAGES (AndroidManifest.xml)
5. Fix 5: Fetch com timeout/retry (src/lib/update-checker.ts)
6. Fix 6: Progress UI (src/components/UpdatePrompt.tsx)
7. TESTE: Fazer push → Release gerado → App atualiza?
```

**Prioridade 2 - FTMS (2 horas):**
```
1. Fix 1: Keep-alive error handling
2. Fix 2: Request Control retry
3. Fix 3: Connection timeout
4. Fix 4: UUID validation
5. TESTE: Conectar → timeout se offline
6. TESTE: MockTransport deve passar
```

**Prioridade 3 - SHARE CARD (30 min):**
```
1. Fix 1: Font loading
2. Fix 2: Checkbox sync
3. TESTE: Mudar checkbox → compartilhar → image OK?
```

---

**Tudo pronto para copiar e colar! 🚀**
