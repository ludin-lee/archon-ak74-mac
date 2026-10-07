# Archon AK74 for Mac

**English** | [한국어](README.ko.md)

Unofficial macOS app for the Archon AK74 keyboard (SONiX, `0c45:800a`): lighting, screen GIF upload, and clock sync.
The official driver is Windows-only, so this app was rebuilt for Mac by analyzing how the Windows driver talks to the keyboard.

If you enjoy AK74 for Mac, a coffee keeps it going ☕

<a href="https://buymeacoffee.com/ludin"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="45"></a>

> **For the AK74 only, not the AK74 PRO.** The PRO model has a different USB ID.

## Features

- **Lighting**: mode, color, rainbow, brightness, speed, direction
- **Screen**: upload GIF, PNG, or JPG (240×135, up to 141 frames), playback speed 0.25x–4x
- **Clock**: sync the current time and switch to the clock screen
- **Languages**: English, 한국어, 日本語, 中文, Español (pick from the top right of the app)

## Install

1. Download `Archon.AK74.Mac.dmg` from [Releases](../../releases).
2. Open the DMG and drag the app into your Applications folder.
3. The first time, open it with **right-click → Open**. macOS shows a warning because the app has no developer signature.

Tested on Apple Silicon Macs. The keyboard must be connected with a USB cable. 2.4G wireless and Bluetooth are not supported.

## Known limitations

- Only lighting modes 0 (off) and 1 (static color) are confirmed. Modes 2–17 show as "Effect N".
- Which way directions 1–4 actually go hasn't been checked.
- The keyboard has no command to switch straight between the clock and the GIF, so **Show GIF** re-uploads the last GIF you sent.
- The keyboard draws at most about 20 frames per second (about 50 ms per frame). Faster speeds are matched by skipping frames. The longest frame time is 510 ms. Changing the speed requires re-uploading the GIF.

## Build from source

```sh
./build-dmg.sh   # → dist/Archon AK74 (Mac).dmg
```

To run during development: `npm install`, then run this folder with Electron 33.

## Protocol

Found by static analysis of the official Windows driver (`DeviceDriver.exe` 1.0.0.5).

| Interface | Usage page | Purpose |
|---|---|---|
| 3 | `0xff13` | Commands. 64-byte feature report (report ID 0) |
| 2 | `0xff68` | Screen data. 4096-byte output report (report ID 0) |

Each command sends a feature report, waits 35 ms, then reads the reply. The keyboard echoes the command back.
Every setting follows the order `04 18` (start) → `04 XX` (command, byte 8 = number of data packets) → data packets → `04 02` (save).

**Lighting** (`04 13`, then `04 F0`)

| Byte | Value |
|---|---|
| 0 | Mode (0 = off, 1 = static color) |
| 1–3 | R, G, B |
| 8 | Rainbow (0/1) |
| 9 | Brightness (0–5) |
| 10 | Speed (0–5) |
| 11 | Direction |
| 14–15 | `AA 55` |

**Time sync** (`04 28`): `[1]=1 [2]=0x5A [3]=year%2000 [4]=month [5]=day [6]=hour [7]=minute [8]=second [10]=weekday(Sun=0) [62..63]=AA 55`. Sending it switches the screen to the clock.

**Screen upload** (`04 72`): `[2]=slot(1)`, `[8..9]=number of 4096-byte chunks (little-endian)`. Then write the chunks one at a time to the `0xff68` interface, reading the keyboard's reply after each chunk. The data layout:

- 256-byte header: `[0]=frame count`, `[1+i]=duration of frame i (in 2 ms units)`, the rest `0xFF`
- Each frame is 240×135 RGB565 little-endian, top to bottom
- The whole thing is padded with `0xFF` to a multiple of 4096

## Disclaimer

Unofficial project, not affiliated with Archon/PREFLOW. There is no firmware update feature. Use at your own risk.
