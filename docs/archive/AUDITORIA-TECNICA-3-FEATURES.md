# 🔍 AUDITORIA TÉCNICA - Share Card, FTMS, Auto-Update

**Data:** 30 de Julho de 2026  
**Status:** 3 features implementadas, 1 com problemas críticos (Auto-Update)

---

## 1️⃣ SHARE CARD - Análise

### ✅ O Que Está Bom

```
✓ 4 variantes com UX clara
✓ Captura 2x DPI (1080→2160) padrão
✓ Preview escalado para UX
✓ Elemento hidden em -9999px para captura (correto)
✓ Instagram Stories via native share sheet (workaround correto)
✓ RouteSVG sem dependência Leaflet (criativo)
✓ Fallback fonts (Geologica → sans-serif)
✓ Web share API Level 2 + <a download> fallback
```

### ⚠️ Problemas Identificados

#### Problema 1: Stats Checkboxes × Hidden Element
**Severidade:** MÉDIA

```typescript
// Fluxo atual
<SessionSummary>
  { showDistance && <Text>...</Text> }   ← Estado visível
  <div ref={cardCaptureRef} style="left:-9999px">
    <ShareCard showDistance={showDistance} />  ← Mesmo prop, mas renderiza off-screen
  </div>
</SessionSummary>

// Risco:
// 1. User clica "hide distance"
// 2. Clica "compartilhar" ANTES de 400ms render
// 3. Captura versão ANTIGA (com distance)
```

**Fix Recomendado:**
```typescript
const [captureReady, setCaptureReady] = useState(false);

useEffect(() => {
  // Reset capture ready quando stats mudam
  setCaptureReady(false);
  const timeout = setTimeout(() => setCaptureReady(true), 450);
  return () => clearTimeout(timeout);
}, [showDistance, showEnergy, showHR, selectedVariant]);

// Desabilita botão compartilhar se não está ready
<button disabled={!captureReady || isCapturing}>
  Compartilhar
</button>
```

#### Problema 2: Font Loading Race Condition
**Severidade:** MÉDIA

```typescript
// Geological font pode não estar pronto na captura
// Solução: aguardar document.fonts.ready

async function captureCard(element: HTMLElement): Promise<Blob> {
  // Aguardar fonts antes de capturar
  if (document.fonts && typeof document.fonts.ready !== 'undefined') {
    await document.fonts.ready;
  }
  
  return domtoimage.toBlob(element, {
    // ... resto ...
  });
}
```

#### Problema 3: RouteSVG Z-Index (Já Mencionado)
**Severidade:** BAIXA (já foi bugfix)

```
Layer order correto:
1. Grid SVG (opacity 4%)
2. RouteSVG (z-0)
3. Gradient overlay (z-1) ← CRÍTICO estar acima
4. Stats (z-10)
```

✅ Está correto conforme doc

#### Problema 4: dom-to-image Limitations
**Severidade:** ALTA (potencial)

```
dom-to-image-more NÃO renderiza:
✗ iframes
✗ web fonts se CORS
✗ canvas drawing
✗ video/audio
✗ mixed content (http em https)

✓ Seu caso: SVG nativo + CSS gradientes = OK
```

**Teste Recomendado:**
```bash
# Testar em diferentes networks
- 4G
- WiFi
- Offline mode (progressive ✗ fonts)
```

#### Problema 5: Instagram Stories Sem Deep Link
**Severidade:** BAIXA (aceitável)

```
Atual:
- Share.share() abre native sheet
- User escolhe Instagram manualmente
- Copia para Stories

Melhor seria:
- Deep link direto "instagram://..."
- MAS: Instagram bloqueou deep links em 2024

Recomendação: Manter atual (é workaround correto)
```

### 📋 Checklist Share Card

```
[ ] Font Geologica carrega?
    → Testar em 4G lento
    → Fallback sem-serif renderiza OK?

[ ] Captura 1080×1920?
    → Validar tamanho arquivo PNG
    → Testar em baixa memória

[ ] Stats checkboxes sincronizadas?
    → Mudar checkbox → preview atualiza?
    → Captura mostra versão correta?

[ ] 4 Variantes testadas?
    [ ] A - Gradiente
    [ ] B - Vidro (blur renderiza?)
    [ ] C - Mapa (z-index OK?)
    [ ] D - Foto (vignete renderiza?)

[ ] Web vs Mobile vs Instagram?
    [ ] Web: <a download> funciona?
    [ ] Android: share sheet mostra apps?
    [ ] iOS: share sheet mostra apps?
```

---

## 2️⃣ BLUETOOTH FTMS - Análise

### ✅ O Que Está Bom

```
✓ State machine 5 estados (correto)
✓ UUIDs corretos (00002acd = treadmill data)
✓ Keep-alive 3s (necessário Matrix T600x)
✓ MockTransport para dev web
✓ Permissões API 31+ (BLUETOOTH_SCAN/CONNECT)
✓ Bugfix UUID critical (00002a63 → 00002acd)
✓ OpCodes corretos (0x00-0x08)
✓ CCCD descriptor handling
```

### ⚠️ Problemas Identificados

#### Problema 1: Keep-Alive Coroutine Lifecycle
**Severidade:** MÉDIA

```kotlin
// TreadmillBleService.kt
private val keepAliveJob = Job()

fun enableKeepalive() {
  serviceScope.launch(keepAliveJob) {
    while (isActive) {
      delay(KEEP_ALIVE_INTERVAL_MS)
      sendCommand(lastCommand)
    }
  }
}

// ⚠️ Risco: se serviceScope é destroyed enquanto job roda
// → app crash ou silent fail
```

**Fix Recomendado:**
```kotlin
fun enableKeepalive() {
  keepAliveJob?.cancel()  // Cancelar job anterior
  keepAliveJob = serviceScope.launch {
    while (isActive) {
      try {
        delay(KEEP_ALIVE_INTERVAL_MS)
        if (state == TreadmillState.CONTROLLED) {
          sendCommand(lastCommand)
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

// Cleanup
override fun onDestroy() {
  keepAliveJob?.cancel()
  super.onDestroy()
}
```

#### Problema 2: Request Control (0x00) Sem Retry
**Severidade:** MÉDIA

```kotlin
// onServicesDiscovered
gatt.discoverServices()  // OK
// ...
enableNotifications()  // OK
sendCommand(byteArrayOf(0x00))  // Request Control

// ⚠️ E se falhar? Sem retry, estado fica DISCOVERING
```

**Fix Recomendado:**
```kotlin
private fun requestControl() {
  var attempts = 0
  val maxAttempts = 3
  
  fun retry() {
    if (attempts < maxAttempts) {
      attempts++
      Log.d("FTMS", "Request Control attempt $attempts/$maxAttempts")
      sendCommand(byteArrayOf(0x00))
      
      // Retry após 500ms
      handler.postDelayed({ retry() }, 500)
    } else {
      Log.e("FTMS", "Failed to request control after $maxAttempts attempts")
      disconnect()
    }
  }
  
  retry()
}

// Callback
override fun onCharacteristicChanged(...) {
  val opcode = data[0]
  val result = data[1]
  
  when (opcode) {
    0x80 -> {
      if (result == 0x00) {  // Success
        state = TreadmillState.CONTROLLED
        clearRetries()  // ← Cancel pending retries
      } else {
        Log.e("FTMS", "Request Control failed: $result")
        // Retry ou disconnect
      }
    }
  }
}
```

#### Problema 3: MockTransport Flags 0x47
**Severidade:** BAIXA

```typescript
// flags = 0x47 = 0b01000111
// bit 0 (0x01) = Speed present
// bit 1 (0x02) = Incline present
// bit 2 (0x04) = Ramp angle present
// bit 6 (0x40) = Total Energy present

// ✓ Correto, esses são os flags que esteira envia

// Mas: está testando parse correto?
const teleFlags = data[0] | (data[1] << 8);  // Little endian
if (teleFlags & 0x0001) {
  speedPresent = true;
  offset += 2;
}
// ...
```

**Validação Necessária:**
```typescript
// Test caso: todos os flags
const testData = Buffer.from([
  0x47, 0x00,  // flags
  0x50, 0x00,  // speed = 0x0050 = 80 × 0.01 = 0.8 km/h
  0x64, 0x00, 0x00, 0x00,  // distance = 100m
  0x0A, 0x00,  // incline = 10 × 0.1 = 1.0%
  0x01, 0x00,  // ramp angle = 1 × 0.1 = 0.1°
  0x00, 0x00, 0x00, 0x00,  // energy = 0
]);

const parsed = parseTreadmillData(testData);
expect(parsed.speed).toBe(0.8);
expect(parsed.distance).toBe(100);
expect(parsed.incline).toBe(1.0);
```

#### Problema 4: Timeout de Descoberta Sem Limite
**Severidade:** MÉDIA

```kotlin
fun connect(address: String) {
  state = TreadmillState.CONNECTING
  gatt = bluetoothDevice.connectGatt(...)
  
  // ⚠️ Se onServicesDiscovered nunca chegar?
  // App fica em CONNECTING para sempre
}
```

**Fix Recomendado:**
```kotlin
private fun connect(address: String) {
  state = TreadmillState.CONNECTING
  gatt = bluetoothDevice.connectGatt(...)
  
  // Timeout: se não conectar em 10s, desiste
  handler.postDelayed({
    if (state == TreadmillState.CONNECTING) {
      Log.e("FTMS", "Connection timeout")
      disconnect()
      emitError("Conexão esgotada")
    }
  }, 10000)
}

override fun onConnectionStateChange(...) {
  handler.removeCallbacks { ... }  // Cancel timeout
  when (newState) {
    STATE_CONNECTED -> {
      // Set novo timeout para discovery (5s)
      handler.postDelayed({
        if (state == TreadmillState.DISCOVERING) {
          Log.e("FTMS", "Discovery timeout")
          disconnect()
        }
      }, 5000)
    }
  }
}
```

#### Problema 5: UUID Typo Risk
**Severidade:** BAIXA (documentado como bugfix)

```
Bugfix mencionado: 00002a63 → 00002acd ✓
Mas como isso foi testado? 

Recomendação: UUID validation
```

```kotlin
companion object {
  private fun validateUUID(uuid: UUID, expected: String) {
    val actual = uuid.toString()
    if (actual != expected.lowercase()) {
      throw IllegalArgumentException(
        "UUID mismatch: expected $expected, got $actual"
      )
    }
  }
  
  init {
    validateUUID(FTMS_SERVICE, "00001826-0000-1000-8000-00805f9b34fb")
    validateUUID(TREADMILL_DATA, "00002acd-0000-1000-8000-00805f9b34fb")
    validateUUID(CONTROL_POINT, "00002ad9-0000-1000-8000-00805f9b34fb")
  }
}
```

### 📋 Checklist FTMS Bluetooth

```
[ ] Keep-alive não trava app?
    → Conectar → deixar 10s → desconectar → OK?

[ ] Request Control falha gracefully?
    → Testar sem esteira pareada
    → Error message clara?

[ ] MockTransport flags corretos?
    → Rodar testes unitários
    → Coverage > 80%?

[ ] Timeout discovery?
    → Conectar a dispositivo inválido
    → App não trava?

[ ] UUID hardcoding?
    → Validação em init()
    → Constants bem documentadas?

[ ] Permissões Android?
    [ ] BLUETOOTH_SCAN
    [ ] BLUETOOTH_CONNECT
    [ ] REQUEST_CODE handling
```

---

## 3️⃣ AUTO-UPDATE - Análise CRÍTICA

### 🚨 PROBLEMAS CRÍTICOS ENCONTRADOS

#### Problema CRÍTICO 1: update-manifest.json Não É Gerado
**Severidade:** CRÍTICA 🔴

```yaml
# firebase-deploy.yml
- name: Upload APK to GitHub Release
  run: |
    git tag -f latest HEAD
    git push origin latest --force
    gh release upload latest app-release.apk update-manifest.json
```

**⚠️ PERGUNTA:** Onde `update-manifest.json` é gerado?

```
Procurando no CI:
✗ Não vejo "Create update manifest" step
✗ Não vejo "Generate manifest" step
✗ Assume que arquivo já existe?
```

**Se o arquivo não existe, CI FALHA com:**
```
Error: file not found: "update-manifest.json"
```

**E então o release NÃO é criado** → App verifica, faz 404 → sem atualização.

**Fix Recomendado - ANTES de upload:**

```yaml
- name: Generate update manifest
  run: |
    cat > update-manifest.json << EOF
    {
      "versionCode": ${{ github.run_number }},
      "versionName": "2.2",
      "downloadUrl": "https://github.com/mahmatias/correlogo/releases/download/latest/app-release.apk"
    }
    EOF
    cat update-manifest.json  # Validate JSON
```

---

#### Problema CRÍTICO 2: versionCode CI Não Está Sendo Passado pro App
**Severidade:** CRÍTICA 🔴

```yaml
# firebase-deploy.yml
"versionCode": ${{ github.run_number }}
```

**⚠️ PERGUNTA:** Como o app SABE qual é versionCode actual?

```kotlin
// Seu código espera algo como:
val currentVersionCode = 123  // De onde isso vem?

override fun onAuthStateChanged(user: FirebaseUser?) {
  checkForUpdate()  // Compara currentVersionCode vs manifest
}
```

**Se hardcoded em build.gradle:**
```gradle
defaultConfig {
  versionCode 123  // ← Hardcoded
}
```

**Então CI com `${{ github.run_number }}` não sincroniza!**

Exemplo:
- Build local: versionCode = 123
- CI: ${{ github.run_number }} = 456
- App baixa manifest com 456
- App vê 456 > 123 → update
- Mas APK tem versionCode 123 → Google Play recusa

**Fix Recomendado:**

```gradle
// build.gradle
defaultConfig {
  versionCode System.getenv("CI_VERSION_CODE")?.toInteger() ?: 100
  // Se em CI: $CI_VERSION_CODE
  // Se local: default 100
}
```

```yaml
# firebase-deploy.yml
env:
  CI_VERSION_CODE: ${{ github.run_number }}

- name: Build Release APK
  run: ./gradlew assembleRelease
```

---

#### Problema CRÍTICO 3: Fetch Manifest Sem Timeout/Retry
**Severidade:** ALTA 🟠

```typescript
// update-checker.ts
async function checkForUpdate() {
  const response = await fetch(
    'https://github.com/mahmatias/correlogo/releases/download/latest/update-manifest.json'
  );
  
  if (!response.ok) {
    // ⚠️ E se 404? (release não existe)
    // ⚠️ E se timeout? (network lento)
    // ⚠️ E se 500? (GitHub down)
    return;
  }
  
  const manifest = await response.json();
  // ...
}
```

**Fix Recomendado:**

```typescript
async function checkForUpdate(maxRetries = 3): Promise<UpdateInfo | null> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);  // 5s timeout
      
      const response = await fetch(
        'https://github.com/mahmatias/correlogo/releases/download/latest/update-manifest.json',
        {
          signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache' },
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const text = await response.text();
      const manifest = JSON.parse(text);  // Validar JSON
      
      // Validar schema
      if (!manifest.versionCode || !manifest.downloadUrl) {
        throw new Error('Invalid manifest schema');
      }
      
      return manifest;
      
    } catch (error) {
      lastError = error;
      console.warn(`Update check attempt ${attempt + 1}/${maxRetries} failed:`, error);
      
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  console.error('Update check failed after retries:', lastError);
  return null;
}
```

---

#### Problema CRÍTICO 4: FileProvider Não Configurado?
**Severidade:** ALTA 🟠

```kotlin
// ApkInstallerPlugin.kt
val apkUri = FileProvider.getUriForFile(
  activity,
  "${activity.packageName}.fileprovider",  // Authority
  file
)
```

**⚠️ PERGUNTA:** Existe `res/xml/file_paths.xml`?

```xml
<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
  <cache-path name="cache" path="." />
  <external-path name="external" path="." />
</paths>
```

**E AndroidManifest.xml?**

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

**Se não existir → Runtime crash:**
```
java.lang.IllegalArgumentException: Unknown authority:
com.correlogo.app.fileprovider
```

**Validação:**
```bash
# Check if exists
grep -r "file_paths" res/

# Check manifest
grep "FileProvider" AndroidManifest.xml
```

---

#### Problema CRÍTICO 5: Blob Download Sem Progress UI
**Severidade:** MÉDIA 🟠

```typescript
// App não mostra progresso de download
async function downloadAPK(url: string): Promise<Blob> {
  const response = await fetch(url);
  // ⚠️ Se APK = 50MB, user vê tela preta 30s
  return response.blob();
}
```

**Fix Recomendado:**

```typescript
async function downloadAPK(
  url: string,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const response = await fetch(url);
  
  if (!response.body) throw new Error('No response body');
  
  const total = parseInt(response.headers.get('content-length') || '0');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let downloaded = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;
    
    chunks.push(value);
    downloaded += value.length;
    
    if (total && onProgress) {
      const percent = Math.round((downloaded / total) * 100);
      onProgress(percent);
    }
  }
  
  return new Blob(chunks, { type: 'application/vnd.android.package-archive' });
}

// UI Component
<UpdatePrompt>
  {isDownloading && (
    <ProgressBar value={downloadProgress} max={100} />
  )}
  <Text>{downloadProgress}% baixado...</Text>
</UpdatePrompt>
```

---

#### Problema CRÍTICO 6: Versão Check Logic Frágil
**Severidade:** MÉDIA 🟠

```typescript
// Comparação simples
if (manifest.versionCode > currentVersionCode) {
  setUpdateAvailable(true);
}

// ⚠️ E se versionCode do manifest é MENOR?
// Exemplo: rollback no CI
// → User já tem 456, manifest diz 100
// → App ignora (correto!)
// → Mas não há feedback
```

**Fix Recomendado:**

```typescript
function getVersionStatus(
  currentCode: number,
  manifestCode: number
): 'outdated' | 'current' | 'prerelease' {
  if (manifestCode > currentCode) return 'outdated';
  if (manifestCode === currentCode) return 'current';
  if (manifestCode < currentCode) return 'prerelease';
}

// UI based on status
switch (getVersionStatus(currentCode, manifest.versionCode)) {
  case 'outdated':
    return <UpdatePrompt version={manifest.versionName} />;
  case 'current':
    return <Text>Você está atualizado!</Text>;
  case 'prerelease':
    return <Text>Você está em pré-release {manifest.versionName}</Text>;
}
```

---

#### Problema CRÍTICO 7: GitHub Release URL Hardcoded
**Severidade:** ALTA 🟠

```typescript
const MANIFEST_URL = 'https://github.com/mahmatias/correlogo/releases/download/latest/update-manifest.json';
```

**⚠️ Problemas:**
1. **Release não existe ainda** → 404 permanente
2. **URL será diferente se mudar repo** (fork, migrate)
3. **GitHub pode rate-limit** `/releases/` endpoint
4. **Sem versionamento** de manifest

**Fix Recomendado:**

Usar GitHub API em vez de download direto:

```typescript
async function fetchLatestRelease(): Promise<UpdateInfo | null> {
  // GitHub API: retorna JSON, official, retries built-in
  const response = await fetch(
    'https://api.github.com/repos/mahmatias/correlogo/releases/latest',
    {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        // Se tiver token: 'Authorization': `Bearer ${GITHUB_TOKEN}`
      },
    }
  );
  
  if (!response.ok) return null;
  
  const release = await response.json();
  
  // Parse release tag/body para versionCode
  const versionCode = parseInt(release.tag_name.replace('v', ''));
  const apkAsset = release.assets.find(a => a.name === 'app-release.apk');
  
  if (!apkAsset) return null;
  
  return {
    versionCode,
    versionName: release.tag_name,
    downloadUrl: apkAsset.browser_download_url,
    releaseNotes: release.body,  // Bonus: release notes
  };
}
```

**Vantagens:**
- API OAuth (menos rate-limit)
- Versioning automático (tag = versionCode)
- Release notes no update prompt
- Sem parsing JSON manual

---

### ❌ Por Que Não Está Funcionando?

**Checklist:**

```
[ ] update-manifest.json é gerado no CI?
    → Se NÃO: CRÍTICO - CI step falta

[ ] versionCode sincronizado CI ↔ App?
    → Se NÃO: CRÍTICO - app nunca vê update

[ ] GitHub Release "latest" existe?
    → Se NÃO: 404 → fetch falha silenciosamente

[ ] FileProvider configurado em AndroidManifest?
    → Se NÃO: crash ao instalar

[ ] Arquivo cache accessível?
    → Filesystem.writeFile() completa?
    → ApkInstaller.installApk() recebe path correto?

[ ] Permissões?
    → WRITE_EXTERNAL_STORAGE?
    → REQUEST_INSTALL_PACKAGES (Android 8+)?
```

---

## 📋 CHECKLIST DE AÇÕES

### 🚨 URGENTE (Bloqueia funcionalidade)

```
[ ] AUTO-UPDATE
    [ ] Verificar: update-manifest.json é gerado no CI?
        → Se não: adicionar script ANTES de upload
    
    [ ] Verificar: versionCode sincronizado?
        → gradle: versionCode = $CI_VERSION_CODE
        → manifest: "versionCode": ${{ github.run_number }}
    
    [ ] Verificar: FileProvider configurado?
        → res/xml/file_paths.xml existe?
        → AndroidManifest.xml tem provider?
    
    [ ] Adicionar: Timeout + Retry no fetch
        → 5s timeout
        → 3 retries com exponential backoff
    
    [ ] Adicionar: Progress UI no download
        → Mostra % completado
```

### ⚠️ IMPORTANTE (Melhora UX)

```
[ ] SHARE CARD
    [ ] Font loading race condition
        → await document.fonts.ready antes de capturar
    
    [ ] Stats checkbox sync
        → Disable botão até 450ms render
    
    [ ] Test 4 variantes
        → A, B, C, D em diferentes devices

[ ] FTMS BLUETOOTH
    [ ] Keep-alive error handling
        → Try/catch + log, não crash
    
    [ ] Request Control retry
        → 3 tentativas antes de desistir
    
    [ ] Timeout discovery
        → 10s connect, 5s discovery
    
    [ ] UUID validation
        → init() com checks
```

### 🔧 NICE-TO-HAVE (Polish)

```
[ ] AUTO-UPDATE
    [ ] Usar GitHub API em vez de download direto
        → /repos/{owner}/{repo}/releases/latest
    
    [ ] Release notes no update prompt
        → Mostrar changelog ao atualizar
    
    [ ] Cancel download button
        → User pode abortar se mudar ideia
    
    [ ] Post-update feedback
        → "Atualização instalada" toast

[ ] FTMS
    [ ] Testes unitários MockTransport
        → 80% coverage
    
    [ ] Integração teste com app real
        → End-to-end workout com esteira
```

---

## 📊 RESUMO EXECUTIVO

| Feature | Status | Prioridade | Blocker | |
|---------|--------|-----------|---------|---|
| **Share Card** | 🟢 Bom | MÉDIA | Não | Font race fix + checkbox sync |
| **FTMS Bluetooth** | 🟢 Bom | ALTA | Não | Keep-alive error + timeout |
| **Auto-Update** | 🔴 Crítico | URGENTE | **SIM** | Manifest generation + versionCode sync |

---

## 🎯 RECOMENDAÇÃO

**1. Resolver Auto-Update HOJE** (30 min)
```
Passo-a-passo:
1. Confirmar: update-manifest.json é gerado no CI
2. Sincronizar: versionCode CI ↔ App
3. Verificar: FileProvider em AndroidManifest
4. Adicionar: Timeout/retry no fetch
5. Testar: Cria release → App faz update
```

**2. Polish FTMS** (1 hora)
```
1. Keep-alive: error handling
2. Request Control: retry logic
3. Timeout: connection + discovery
4. Test: MockTransport coverage
```

**3. Polish Share Card** (30 min)
```
1. Font loading: document.fonts.ready
2. Checkbox sync: disable button até render
3. Test: 4 variantes em 3 devices
```

**Total:** ~2 horas para tudo funcionando 100%

---

**Quer que eu detalhe qualquer uma dessas issues?** 🚀
