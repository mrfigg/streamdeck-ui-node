# streamdeck-ui-node

[![npm license](https://img.shields.io/npm/l/streamdeck-ui-node)](https://www.npmjs.com/package/streamdeck-ui-node) [![npm downloads](https://img.shields.io/npm/dw/streamdeck-ui-node)](https://www.npmjs.com/package/streamdeck-ui-node) [![npm version](https://img.shields.io/npm/v/streamdeck-ui-node)](https://www.npmjs.com/package/streamdeck-ui-node) [![github issues](https://img.shields.io/github/issues/mrfigg/streamdeck-ui-node)](https://github.com/mrfigg/streamdeck-ui-node/issues) [![snyk vulnerabilities](https://img.shields.io/snyk/vulnerabilities/npm/streamdeck-ui-node)](https://security.snyk.io/vuln/?search=streamdeck-ui-node) [![github last commit](https://img.shields.io/github/last-commit/mrfigg/streamdeck-ui-node)](https://github.com/mrfigg/streamdeck-ui-node)

Easily create and manage user interface elements on an [Elgato Stream Deck](https://www.elgato.com/gaming/stream-deck) with NodeJS.

Special thanks to the [@elgato-stream-deck/node](https://www.npmjs.com/package/@elgato-stream-deck/node) library for all the low level controls needed to make this module possible!

## Features

* Supports Windows, MacOS, and Linux.
* Blazing fast image handling thanks to the [sharp](https://www.npmjs.com/package/sharp) library.
* Supports animated image formats (GIF, WEBP, and AVIF), as well as static image formats (JPEG, PNG, SVG, and TIFF).
* Images are automatically resized to correctly fit onto your Stream Deck.

#### Planed Features

* Proper support for [Elgato Stream Deck Plus](https://www.elgato.com/stream-deck-plus) touch screen and encoders.

## Install

`npm install streamdeck-ui-node`

### Linux

On linux, the udev subsystem blocks access to Stream Decks without some special configuration.
Save the following to `/etc/udev/rules.d/50-elgato.rules` and reload the rules with `sudo udevadm control --reload-rules`.

```
SUBSYSTEM=="input", GROUP="input", MODE="0666"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="666", GROUP="plugdev"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0063", MODE:="666", GROUP="plugdev"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="006c", MODE:="666", GROUP="plugdev"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="006d", MODE:="666", GROUP="plugdev"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0080", MODE:="666", GROUP="plugdev"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0084", MODE:="666", GROUP="plugdev"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0086", MODE:="666", GROUP="plugdev"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0090", MODE:="666", GROUP="plugdev"
KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="666", GROUP="plugdev"
KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0063", MODE:="666", GROUP="plugdev"
KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="006c", MODE:="666", GROUP="plugdev"
KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="006d", MODE:="666", GROUP="plugdev"
KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0080", MODE:="666", GROUP="plugdev"
KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0084", MODE:="666", GROUP="plugdev"
KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0086", MODE:="666", GROUP="plugdev"
KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0090", MODE:="666", GROUP="plugdev"
```

Unplug and replug the device and it should be usable. Check the [@elgato-stream-deck/node](https://www.npmjs.com/package/@elgato-stream-deck/node) readme for updated rules if you have issues.

### Native Dependencies

For the most common operating systems prebuilt binaries are included with the [@elgato-stream-deck/node](https://www.npmjs.com/package/@elgato-stream-deck/node) and [sharp](https://www.npmjs.com/package/sharp) libraries and no further steps will be necessary.

If you need to build binaries yourself please refer to [@elgato-stream-deck/node - Native dependencies](https://www.npmjs.com/package/@elgato-stream-deck/node#native-dependencies) and [sharp - Prebuilt binaries](https://sharp.pixelplumbing.com/install#prebuilt-binaries).

## Examples

```javascript
const { openStreamDeck } = require('streamdeck-ui-node');

(async () => {
    // Open a Stream Deck
    const streamDeck = await openStreamDeck();

    // Create a mainPage and set it as the default
    const mainPage = streamDeck.createPage({
        setDefault: true
    });

    // Create a basicKey
    const basicKey = streamDeck.createKey({
        image: 'path/to/image.png',
        attachToPages: [{ page: mainPage, row: 1, column: 1 }],
        onDown() {
            // Do something here
        },
        onUp() {
            // Do something else here
        }
    });

    // Create an animatedKey
    const animatedKey = streamDeck.createKey({
        image: 'path/to/animatedImage.gif',
        attachToPages: [{ page: mainPage, row: 1, column: 2 }]
    });
    
    // Use EventEmitter methods to add listeners to animatedKey
    animatedKey.on('hold', () => {
        // Do something here
    });

    animatedKey.on('click', () => {
        // Do something else here
    });
    
    animatedKey.on('held', () => {
        // Do something here as well
    });

    // Create a backgroundImageKey
    const backgroundImageKey = streamDeck.createKey({
        backgroundImage: 'path/to/backgroundImage.png',
        image: 'path/to/transparentImage.png',
        attachToPages: [{ page: mainPage, row: 1, column: 3 }],
        onDown() {
            // Toggle the Stream Deck's default brightness
            streamDeck.setBrightness(streamDeck.brightness === 1 ? 0.5 : 1);
        }
    });

    // Keys can be attached to multiple key slots at the same time
    mainPage.attachKey(1, 4, backgroundImageKey);

    // Detach a key from a specific key slot
    mainPage.detachKey(1, 3, backgroundImageKey);

    // Create a secondPage that has an animated background image and overrides
    // the default brightness
    const secondPage = streamDeck.createPage({
        backgroundImage: 'path/to/firstBackgroundImage.webp',
        brightness: 0.75,
        onFocus() {
            // Do something
        },
        onBlur() {
            // Do something else
        }
    });

    // Focus on secondPage whenever basicKey is pressed down
    basicKey.on('down', () => {
        secondPage.focus();
    });

    // Attach a key to multiple pages at the same time
    secondPage.attachKey(1, 1, backgroundImageKey);

    // Return focus to mainPage whenever any key slot on secondPage is
    // pressed down for a time
    secondPage.on('hold', () => {
        secondPage.blur();
    });

    // Store firstBackgroundImage for secondPage
    const firstBackgroundImage = secondPage.backgroundImage;

    // Preload a secondBackgroundImage for secondPage
    const secondBackgroundImage = secondPage.createBackgroundImage('path/to/secondBackgroundImage.webp');

    // Swap background images whenever any key slot on secondPage is
    // pressed down
    secondPage.on('down', () => {
        if (secondPage.backgroundImage === firstBackgroundImage) {
            secondPage.setBackgroundImage(secondBackgroundImage);
        } else {
            secondPage.setBackgroundImage(firstBackgroundImage);
        }
    });

    // A simple clockKey
    const clockKey = streamDeck.createKey({
        attachToPages: [
            { page: mainPage, row: 2, column: 1 },
            { page: secondPage, row: 2, column: 1 },
        ],
        // Custom properties are stored right on pages/keys
        refreshImage() {
            // Set clockKey's image to a dynamically created svg
            const svg = Buffer.from(`<svg width="${this.KEY_WIDTH}" height="${this.KEY_HEIGHT}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><text font-family="Verdana, sans-serif" font-size="14" fill="#EFEFEF" stroke="#EFEFEF" text-anchor="middle" x="${this.KEY_WIDTH / 2}" y="${this.KEY_HEIGHT / 2 + 7}">${new Date().toLocaleTimeString()}</text></svg>`)

            this.setImage(svg);
        },
        onCreate() {
            this.refreshImage();

            this.intervalId = setInterval(() => this.refreshImage(), 1000);
        },
        onDestroy() {
            clearInterval(this.intervalId);
        }
    });
})();
```

## API

For full API documentation check [https://mrfigg.github.io/streamdeck-ui-node-docs](https://mrfigg.github.io/streamdeck-ui-node-docs).