'use strict'

const {
  listStreamDecks: listStreamDecksNode,
  openStreamDeck: openStreamDeckNode,
} = require('@elgato-stream-deck/node')

const { StreamDeckNode } = require('@elgato-stream-deck/node/dist/wrapper')

const StreamDeck = require('./streamdeck')
const Page = require('./page')
const Key = require('./key')
const Image = require('./image')

const { registerClass, checkValid } = require('./utils')

registerClass('StreamDeck', StreamDeck)
registerClass('Page', Page)
registerClass('Key', Key)
registerClass('Image', Image)

/**
 * The {@link module:streamdeck-ui-node|streamdeck-ui-node} module returned as an Object when importing the library.
 *
 * @module streamdeck-ui-node
 * @example
 * const { openStreamDeck } = require('streamdeck-ui-node');
 */

/**
 * An Object describing a connected Stream Deck device.
 *
 * @typedef {Object} StreamDeckInfo
 * @memberof module:streamdeck-ui-node
 *
 * @property {string} hidPath
 * The HID path to the Stream Deck device.
 *
 * @property {module:streamdeck-ui-node.StreamDeckModel} model
 * A short string describing the Stream Deck model.
 *
 * @property {string} serialNumber
 * The serial number found on the Stream Deck device.
 */

/**
 * A short string describing a Stream Deck model.
 *
 * Can be one of:
 * `'original'`, `'originalv2'`, `'original-mk2'`, `'mini'`,
 * `'miniv2'`, `'xl'`, `'xlv2'`, `'pedal'`, `'plus'`
 *
 * @typedef {string} StreamDeckModel
 * @memberof module:streamdeck-ui-node
 */

/**
 * A Object holding options for creating a {@link StreamDeck} instance.
 *
 * @typedef {Object} StreamDeckOptions
 * @memberof module:streamdeck-ui-node
 *
 * @property {number} [holdTime=500]
 * The number of milliseconds after the {@link StreamDeck#event:down} is triggered
 * that the {@link StreamDeck#event:hold} will be triggered. Setting to `0`
 * disables the {@link StreamDeck#event:hold}.
 *
 * (Integer greater than or equal to `0`.)
 *
 * @property {number} [pressTime=0]
 * The default number of milliseconds after the {@link Key#event:down} is triggered
 * that the press scaling effect will apply on {@link Key|Keys} created by the
 * {@link StreamDeck}. Setting to `0` makes the press scaling effect last until the
 * {@link Key#event:up} is triggered.
 *
 * (Integer greater than or equal to `0`.)
 *
 * @property {number} [pressScale=0.85]
 * The default scale any {@link Key|Keys} created by the {@link StreamDeck} will
 * use for the press scaling effect. Setting to `1` disables the press scaling
 * effect.
 *
 * (Float between `0` and `2` inclusive.)
 *
 * @property {number} [idleTime=10000]
 * The number of milliseconds of inactivity before the {@link StreamDeck#event:idle}
 * is triggered. Setting to `0` disabled the {@link StreamDeck#event:idle}.
 *
 * (Integer greater than or equal to `0`.)
 *
 * @property {number} [brightness=1]
 * The initial brightness of the {@link StreamDeck|StreamDeck's} panel.
 *
 * (Float between `0` and `1` inclusive.)
 *
 * @property {function} [on[Event]]
 * An event listener that will be attached to the {@link StreamDeck} on `[event]`.
 *
 * See {@link StreamDeck} for a list of available events.
 *
 * @property {*} [[customProperty]]
 * Any custom properties not already reserved by the {@link StreamDeck} class will
 * be added to the {@link StreamDeck}.
 */

/**
 * Get information on connected Stream Deck devices.
 *
 * @function listStreamDecks
 * @memberof module:streamdeck-ui-node
 * @static
 *
 * @returns {Array<module:streamdeck-ui-node.StreamDeckInfo>}
 */
function listStreamDecks() {
  return listStreamDecksNode().map(
    ({ path: hidPath, model, serialNumber }) => ({
      hidPath,
      model,
      serialNumber,
    })
  )
}

/**
 * Open the first Stream Deck device listed by {@link module:streamdeck-ui-node.listStreamDecks}.
 *
 * @function openStreamDeck
 * @memberof module:streamdeck-ui-node
 * @static
 *
 * @param {module:streamdeck-ui-node.StreamDeckOptions} [options]
 * Options used to configure the {@link StreamDeck}.
 *
 * @returns {Promise<StreamDeck>}
 */

/**
 * Open the first Stream Deck device listed by {@link module:streamdeck-ui-node.listStreamDecks}
 * that matches the given HID path or {@link module:streamdeck-ui-node.StreamDeckModel}.
 *
 * @function openStreamDeck
 * @memberof module:streamdeck-ui-node
 * @static
 * @variation 2
 *
 * @param {string|module:streamdeck-ui-node.StreamDeckModel} hidPathOrModel
 * The HID path of a connected Stream Deck device or a {@link module:streamdeck-ui-node.StreamDeckModel}
 * of a connected Stream Deck device.
 *
 * @param {module:streamdeck-ui-node.StreamDeckOptions} [options]
 * Options used to configure the {@link StreamDeck}.
 *
 * @returns {Promise<StreamDeck>}
 */
async function openStreamDeck(hidPathOrModel, options = {}) {
  if (typeof hidPathOrModel !== 'string') {
    options = hidPathOrModel
    hidPathOrModel = undefined
  }

  checkValid(options, {
    name: 'options',
    type: 'object',
    allowUndefined: true,
  })

  let streamDeckInfos = listStreamDecks()

  if (!streamDeckInfos.length) {
    throw new Error(`No Stream Decks are connected`)
  }

  let streamDeckInfo = streamDeckInfos[0]

  if (typeof hidPathOrModel === 'string') {
    let hidPathStreamDecks = streamDeckInfos.filter(
      (streamDeck) => streamDeck.hidPath === hidPathOrModel
    )

    if (hidPathStreamDecks.length) {
      streamDeckInfos = hidPathStreamDecks
    } else {
      streamDeckInfos = streamDeckInfos.filter(
        (streamDeck) => streamDeck.model === hidPathOrModel
      )
    }

    if (!streamDeckInfos.length) {
      throw new Error(
        `Unable to find Stream Deck with HID path or model: ${hidPathOrModel}`
      )
    }

    streamDeckInfo = streamDeckInfos[0]
  }

  return manageStreamDeck(
    await openStreamDeckNode(streamDeckInfo.hidPath, options),
    options
  )
}

/**
 * Manage user interface elements on a Stream Deck already opened by
 * {@link external:@elgato-stream-deck/node}.
 *
 * @function manageStreamDeck
 * @memberof module:streamdeck-ui-node
 * @static
 *
 * @param {external:@elgato-stream-deck/node} streamDeckNode
 * The {@link external:@elgato-stream-deck/node} instance.
 *
 * @param {module:streamdeck-ui-node.StreamDeckOptions} [options]
 * Options used to configure the {@link StreamDeck}.
 *
 * @returns {Promise<StreamDeck>}
 */
async function manageStreamDeck(streamDeckNode, options = {}) {
  checkValid(streamDeckNode, {
    name: 'streamDeckNode',
    type: 'class',
    class: StreamDeckNode,
  })

  checkValid(options, {
    name: 'options',
    type: 'object',
    allowUndefined: true,
  })

  const streamDeckData = {
    serialNumber: await streamDeckNode.getSerialNumber(),
    firmwareVersion: await streamDeckNode.getFirmwareVersion(),
  }

  // Path isn't exposed anywhere on @elgato-stream-deck/node instances so use serialNumber
  // as a workaround
  streamDeckData.hidPath = listStreamDecks().filter(
    (streamDeckInfo) =>
      streamDeckInfo.serialNumber === streamDeckData.serialNumber
  )[0]?.hidPath

  return new StreamDeck(streamDeckNode, streamDeckData, options)
}

module.exports = {
  listStreamDecks,
  manageStreamDeck,
  openStreamDeck,
}
