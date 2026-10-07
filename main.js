// Archon AK74 (0c45:800a) driver for macOS.
// Protocol reverse-engineered from the Windows DeviceDriver.exe 1.0.0.5:
//   ff13 interface: 64-byte feature reports (commands)
//   ff68 interface: 4096-byte output reports (screen data)
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const HID = require('node-hid');

const VID = 0x0c45, PID = 0x800a;
const CMD_PAGE = 0xff13, SCREEN_PAGE = 0xff68;
const CMD_DELAY = 35; // <cmd_delaytime> from the driver's layout xml
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findPath(usagePage) {
  const d = HID.devices(VID, PID).find((d) => d.usagePage === usagePage);
  if (!d) throw new Error('키보드를 찾을 수 없습니다. USB 케이블로 연결했는지 확인해 주세요.');
  return d.path;
}

async function cmd(dev, bytes, read = true) {
  const buf = Buffer.alloc(65); // report id 0 + 64 bytes
  Buffer.from(bytes).copy(buf, 1);
  await dev.sendFeatureReport(buf);
  await sleep(CMD_DELAY);
  if (read) await dev.getFeatureReport(0, 65);
}

async function setLight({ mode, r, g, b, brightness, speed, direction, colorful }) {
  const c = await HID.HIDAsync.open(findPath(CMD_PAGE));
  try {
    await cmd(c, [0x04, 0x18]); // begin
    await cmd(c, [0x04, 0x13, 0, 0, 0, 0, 0, 0, 1]); // light mode, 1 data packet
    const d = new Array(16).fill(0);
    d[0] = mode;
    d[1] = r; d[2] = g; d[3] = b;
    d[8] = colorful ? 1 : 0;
    d[9] = brightness;
    d[10] = speed;
    d[11] = direction;
    d[14] = 0xaa; d[15] = 0x55;
    await cmd(c, d, false);
    await cmd(c, [0x04, 0x02]); // save
    await cmd(c, [0x04, 0xf0], false);
  } finally {
    await c.close();
  }
}

// data: header(256) + RGB565 frames, padded to a multiple of 4096 by the renderer
async function uploadScreen(data, onProgress) {
  const chunks = data.length / 4096;
  const c = await HID.HIDAsync.open(findPath(CMD_PAGE));
  const s = await HID.HIDAsync.open(findPath(SCREEN_PAGE));
  try {
    await cmd(c, [0x04, 0x18]);
    await cmd(c, [0x04, 0x72, 1, 0, 0, 0, 0, 0, chunks & 0xff, chunks >> 8]); // slot 1
    for (let i = 0; i < chunks; i++) {
      await s.write(Buffer.concat([Buffer.from([0]), data.subarray(i * 4096, (i + 1) * 4096)]));
      await s.read(300); // device acks every chunk
      onProgress((i + 1) / chunks);
    }
    await cmd(c, [0x04, 0x02]);
  } finally {
    await c.close();
    await s.close();
  }
}

// Also switches the screen to the clock. There is no "show GIF" command;
// the GIF comes back by uploading it again.
async function syncTime() {
  const c = await HID.HIDAsync.open(findPath(CMD_PAGE));
  try {
    const n = new Date();
    await cmd(c, [0x04, 0x18]);
    await cmd(c, [0x04, 0x28, 0, 0, 0, 0, 0, 0, 1]);
    const d = new Array(64).fill(0);
    d[1] = 1;
    d[2] = 0x5a;
    d[3] = n.getFullYear() % 2000;
    d[4] = n.getMonth() + 1;
    d[5] = n.getDate();
    d[6] = n.getHours();
    d[7] = n.getMinutes();
    d[8] = n.getSeconds();
    d[10] = n.getDay();
    d[62] = 0xaa; d[63] = 0x55;
    await cmd(c, d);
    await cmd(c, [0x04, 0x02]);
  } finally {
    await c.close();
  }
}

const lastScreenFile = () => path.join(app.getPath('userData'), 'last-screen.bin');

// one device operation at a time
let queue = Promise.resolve();
const serial = (fn) => (queue = queue.catch(() => {}).then(fn));

ipcMain.handle('set-light', (_e, opts) => serial(() => setLight(opts)));
ipcMain.handle('sync-time', () => serial(syncTime));
ipcMain.handle('upload-screen', (e, data) =>
  serial(async () => {
    const buf = Buffer.from(data);
    await uploadScreen(buf, (p) => e.sender.send('upload-progress', p));
    fs.writeFileSync(lastScreenFile(), buf);
  }));
ipcMain.handle('show-gif', (e) =>
  serial(() => {
    if (!fs.existsSync(lastScreenFile())) throw new Error('먼저 GIF를 한 번 업로드해 주세요.');
    return uploadScreen(fs.readFileSync(lastScreenFile()), (p) => e.sender.send('upload-progress', p));
  }));
ipcMain.handle('is-connected', () => HID.devices(VID, PID).some((d) => d.usagePage === CMD_PAGE));

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 560,
    height: 760,
    title: 'Archon AK74',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
});

app.on('window-all-closed', () => app.quit());
