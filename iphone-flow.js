// Prueba en iPhone REAL (simulador oficial de Apple + Safari de iOS) del pedido de Menú Pro.
// Hace: abrir el menú → registrar un cliente de prueba (solo en el teléfono simulado) → agregar la torta → Continuar con mi pedido
// → Retiro en tienda → Continuar → ¿salen los métodos de pago? NO envía ningún pedido.
const fs = require('fs'), cp = require('child_process');
const URL_MENU = process.env.URL_MENU || 'https://menusazonpro.pages.dev/m/amikumo/';
const UDID = process.env.UDID;
const A = 'http://127.0.0.1:4723';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const http = require('http');
// petición sin límite corto de espera (la primera sesión compila WebDriverAgent y puede tardar 5-10 min)
const j = (m, p, b) => new Promise((ok, mal) => {
  const body = b ? JSON.stringify(b) : null;
  const rq = http.request({ host: '127.0.0.1', port: 4723, path: p, method: m, headers: Object.assign({ 'content-type': 'application/json' }, body ? { 'content-length': Buffer.byteLength(body) } : {}) }, rs => {
    let d = ''; rs.on('data', c => d += c); rs.on('end', () => { try { ok(JSON.parse(d)); } catch (e) { ok({ value: { error: 'respuesta no JSON', raw: d.slice(0, 200) } }); } });
  });
  rq.setTimeout(0); rq.on('error', mal); if (body) rq.write(body); rq.end();
});
fs.mkdirSync('capturas', { recursive: true });
const log = (...a) => console.log(...a);
let id;
const ev = async (script, args = []) => { const r = await j('POST', `/session/${id}/execute/sync`, { script, args }); if (r.value && r.value.error) throw new Error(JSON.stringify(r.value).slice(0, 300)); return r.value; };
const shotDev = n => { try { cp.execSync(`xcrun simctl io ${UDID} screenshot capturas/${n}-iphone.png`); } catch (e) { log('shot err', e.message.slice(0, 100)); } };
const toque = async (css) => { // toque REAL sobre el elemento (como un dedo)
  const f = await j('POST', `/session/${id}/element`, { using: 'css selector', value: css });
  const el = f.value && (f.value['element-6066-11e4-a52e-4f735466cecf'] || f.value.ELEMENT);
  if (!el) throw new Error('no encontré ' + css);
  await ev('arguments[0].scrollIntoView({block:"center"})', [{ 'element-6066-11e4-a52e-4f735466cecf': el }]).catch(() => {});
  const r = await j('POST', `/session/${id}/element/${el}/click`, {});
  if (r.value && r.value.error) throw new Error('toque falló ' + css + ' ' + JSON.stringify(r.value).slice(0, 200));
};
const estado = () => ev(`const pm=document.getElementById('pagoModal'),ov=document.querySelector('.sxs-ov'),mp=document.querySelector('.mph-ov'); const w=document.getElementById('waBtn');
  return JSON.stringify({version:window.MENUPRO_VERSION||'?',boton:w&&w.textContent.trim(),botonOff:w&&w.disabled,hojaEntrega:!!ov,hojaSinStock:mp?mp.innerText.slice(0,60).replace(/\\n/g,'/'):null,pagoVisible:pm?!pm.hidden:null,metodos:pm?Array.from(pm.querySelectorAll('.pm-btn')).filter(b=>!b.hidden).map(b=>b.textContent.trim()):null,ancho:innerWidth,alto:innerHeight,ua:navigator.userAgent})`);
(async () => {
  const caps = { platformName: 'iOS', browserName: 'Safari', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:safariIgnoreFraudWarning': true,
    'appium:wdaLaunchTimeout': 720000, 'appium:wdaConnectionTimeout': 720000, 'appium:showXcodeLog': true, 'appium:webviewConnectTimeout': 120000, 'appium:safariInitialUrl': 'about:blank', 'appium:includeSafariInWebviews': true, 'appium:safariAllowPopups': true, 'appium:newCommandTimeout': 600, 'appium:autoAcceptAlerts': true };
  const s = await j('POST', '/session', { capabilities: { alwaysMatch: caps } });
  if (!s.value || !s.value.sessionId) { log('NO SESIÓN', JSON.stringify(s).slice(0, 600)); process.exit(1); }
  id = s.value.sessionId; log('sesión ok');
  await j('POST', `/session/${id}/url`, { url: URL_MENU }); await sleep(12000);
  await ev('localStorage.setItem("cliente_menu", JSON.stringify({nombre:"Prueba Claude",telefono:"04140000000",cedula:"V1"})); try{sessionStorage.clear()}catch(e){} location.reload(); return 1'); await sleep(12000);
  log('SW del sitio:', (await (await fetch(URL_MENU.replace(/\/m\/.*/, '/') + 'sw.js?x=' + Date.now())).text()).match(/sazonpro-menu-v[0-9a-z-]*/)[0]);
  log('0 inicio', await estado()); shotDev('0-inicio');
  await ev('state.qty={}; saveCartLocal(); updateCartUI(); return 1');
  await toque('.ma-addBtn:nth-of-type(1)').catch(async () => { await ev('document.querySelectorAll(".ma-addBtn")[2].click(); return 1'); }); // respaldo
  // la torta es el 3er producto: llevamos el carrito a la torta
  await ev('state.qty={}; saveCartLocal(); const t=state.products.find(p=>/torta/i.test(p.name)); state.qty[t.id]=1; saveCartLocal(); updateCartUI(); return 1'); await sleep(1000);
  await toque('#cartFab'); await sleep(2000); log('1 carrito', await estado()); shotDev('1-carrito');
  await toque('#waBtn'); log('toque en Continuar con mi pedido');
  for (let i = 1; i <= 4; i++) { await sleep(3000); log('2 t+' + 3 * i + 's', await estado()); }
  shotDev('2-despues-de-continuar');
  try { await toque('[data-pick="retiro"]'); await sleep(1000); shotDev('3-retiro'); log('3 retiro elegido', await estado());
        await toque('[data-fin]'); } catch (e) { log('paso entrega:', e.message); }
  for (let i = 1; i <= 4; i++) { await sleep(3000); log('4 t+' + 3 * i + 's', await estado()); }
  shotDev('4-final');
  await j('DELETE', `/session/${id}`);
})().catch(e => { log('ERROR', e.message); shotDev('error'); process.exit(1); });
