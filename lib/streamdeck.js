'use strict'

const EventEmitter = require('eventemitter3')
const queue = require('queue')

const { StreamDeckNode } = require('@elgato-stream-deck/node/dist/wrapper')

const Page = require('./page')
const Key = require('./key')
const Image = require('./image')

const {
  checkValid,
  definePrivateProperties,
  definePublicProperties,
  listenToEvents,
  emitCaughtAsyncError,
} = require('./utils')

/**
 * An instance of {@link StreamDeck} represents a Stream Deck device accessed via
 * {@link module:streamdeck-ui-node.openStreamDeck} or {@link module:streamdeck-ui-node.manageStreamDeck}.
 *
 * @class StreamDeck
 * @extends external:eventemitter3
 * @hideconstructor
 *
 * @example
 * const { openStreamDeck } = require('streamdeck-ui-node');
 *
 * (async () => {
 *   const streamDeck = await openStreamDeck();
 * })();
 */
class StreamDeck extends EventEmitter {
  constructor(streamDeckNode, streamDeckData, options = {}) {
    super()

    checkValid(streamDeckNode, {
      name: 'streamDeckNode',
      type: 'class',
      class: StreamDeckNode,
    })

    checkValid(streamDeckData, {
      name: 'streamDeckData',
      type: 'object',
      checkProps: [
        {
          name: 'firmwareVersion',
          type: 'string',
        },
      ],
    })

    checkValid(options, {
      name: 'options',
      type: 'object',
      allowUndefined: true,
    })

    definePrivateProperties(this, options, [
      { name: 'holdTimeoutIds', value: new Map() },
      { name: 'idleTimeoutId' },
      { name: 'downPages', value: new Map() },
      { name: 'downKeys', value: new Map() },
      { name: 'holdIndexes', value: new Set() },
      {
        name: 'graphicsQueue',
        value: queue({ autostart: true, concurrency: 1 }),
      },
    ])

    definePublicProperties(this, options, [
      /**
       * The {@link external:@elgato-stream-deck/node} instance managed by the {@link StreamDeck}.
       *
       * @member {external:@elgato-stream-deck/node} STREAMDECK_NODE
       * @memberof StreamDeck
       * @instance
       * @constant
       */
      { name: 'STREAMDECK_NODE', value: streamDeckNode },
      /**
       * The HID path of the Stream Deck device.
       *
       * @member {string} HID_PATH
       * @memberof StreamDeck
       * @instance
       * @constant
       */
      { name: 'HID_PATH', value: streamDeckNode.device.path },
      /**
       * The {@link module:streamdeck-ui-node.StreamDeckModel} of the Stream Deck device.
       *
       * @member {string} MODEL
       * @memberof StreamDeck
       * @instance
       * @constant
       */
      { name: 'MODEL', value: streamDeckNode.MODEL },
      /**
       * The product name of the Stream Deck device.
       *
       * @member {string} PRODUCT_NAME
       * @memberof StreamDeck
       * @instance
       * @constant
       */
      { name: 'PRODUCT_NAME', value: streamDeckNode.PRODUCT_NAME },
      /**
       * The serial number found on the Stream Deck device.
       *
       * @member {string} SERIAL_NUMBER
       * @memberof StreamDeck
       * @instance
       * @constant
       */
      { name: 'SERIAL_NUMBER', value: streamDeckNode.device.serialNumber },
      /**
       * The firmware version on the Stream Deck device.
       *
       * @member {string} FIRMWARE_VERSION
       * @memberof StreamDeck
       * @instance
       * @constant
       */
      { name: 'FIRMWARE_VERSION', value: streamDeckData.firmwareVersion },
      /**
       * The number of keys on the Stream Deck.
       *
       * @member {number} KEY_COUNT
       * @memberof StreamDeck
       * @instance
       * @constant
       */
      { name: 'KEY_COUNT', value: streamDeckNode.NUM_KEYS },
      /**
       * The width of each key on the Stream Deck in pixels.
       *
       * @member {number} KEY_WIDTH
       * @memberof StreamDeck
       * @instance
       * @constant
       */
      { name: 'KEY_WIDTH', value: streamDeckNode.ICON_SIZE },
      /**
       * The height of each key on the Stream Deck in pixels.
       *
       * @member {number} KEY_HEIGHT
       * @memberof StreamDeck
       * @instance
       * @constant
       */
      { name: 'KEY_HEIGHT', value: streamDeckNode.ICON_SIZE },
      /**
       * The number of rows on the Stream Deck's panel.
       *
       * @member {number} PANEL_ROW_COUNT
       * @memberof StreamDeck
       * @instance
       * @constant
       */
      { name: 'PANEL_ROW_COUNT', value: streamDeckNode.KEY_ROWS },
      /**
       * The number of columns on the Stream Deck's panel.
       *
       * @member {number} PANEL_COLUMN_COUNT
       * @memberof StreamDeck
       * @instance
       * @constant
       */
      { name: 'PANEL_COLUMN_COUNT', value: streamDeckNode.KEY_COLUMNS },
      /**
       * The width of all panel columns on the Stream Deck combined in pixels.
       *
       * @member {number} PANEL_WIDTH
       * @memberof StreamDeck
       * @instance
       * @constant
       */
      {
        name: 'PANEL_WIDTH',
        value: streamDeckNode.ICON_SIZE * streamDeckNode.KEY_COLUMNS,
      },
      /**
       * The height of all panel rows on the Stream Deck combined in pixels.
       *
       * @member {number} PANEL_HEIGHT
       * @memberof StreamDeck
       * @instance
       * @constant
       */
      {
        name: 'PANEL_HEIGHT',
        value: streamDeckNode.ICON_SIZE * streamDeckNode.KEY_ROWS,
      },
      /**
       * The number of milliseconds after the {@link StreamDeck#event:down} is triggered that
       * the {@link StreamDeck#event:hold} will be triggered. A value of `0` means the
       * {@link StreamDeck#event:hold} is disabled.
       *
       * @member {number} HOLD_TIME
       * @memberof StreamDeck
       * @instance
       * @constant
       */
      {
        name: 'HOLD_TIME',
        value: 500,
        type: 'integer',
        min: 0,
        allowUndefined: true,
      },
      /**
       * The default number of milliseconds after the {@link Key#event:down} is triggered that
       * the press scaling effect will apply on {@link Key|Keys} created by the {@link StreamDeck}.
       * A value of `0` means the press scaling effect last until the {@link Key#event:up} is
       * triggered.
       *
       * @member {number} PRESS_TIME
       * @memberof StreamDeck
       * @instance
       * @constant
       */
      {
        name: 'PRESS_TIME',
        value: 0,
        type: 'integer',
        min: 0,
        allowUndefined: true,
      },
      /**
       * The default scale any {@link Key|Keys} created by the {@link StreamDeck} will use for the
       * press scaling effect. A value of `1` means the press scaling effect is disabled.
       *
       * @member {number} PRESS_SCALE
       * @memberof StreamDeck
       * @instance
       * @constant
       */
      {
        name: 'PRESS_SCALE',
        value: 0.85,
        type: 'number',
        min: 0,
        max: 2,
        allowUndefined: true,
      },
      /**
       * The number of milliseconds of inactivity before the {@link StreamDeck#event:idle} is
       * triggered. A value of `0` means the {@link StreamDeck#event:idle} is disabled.
       *
       * @member {number} IDLE_TIME
       * @memberof StreamDeck
       * @instance
       * @constant
       */
      {
        name: 'IDLE_TIME',
        value: 10000,
        type: 'integer',
        min: 0,
        allowUndefined: true,
      },
      /**
       * The brightness of Stream Deck's panel. Value is a float between `0` and `1` inclusive.
       * Can be overridden by the `{@link StreamDeck#focusedPage}` if the
       * `{@link StreamDeck#focusedPage}` has `{@link Page#brightness}` set.
       *
       * @member {number} brightness
       * @memberof StreamDeck
       * @instance
       * @readonly
       */
      {
        name: 'brightness',
        value: 1,
        type: 'number',
        min: 0,
        max: 1,
        allowUndefined: true,
      },
      /**
       * The default {@link Page} that will gain focus when the `{@link StreamDeck#focusedPage}`
       * loses focus.
       *
       * @member {Page|undefined} defaultPage
       * @memberof StreamDeck
       * @instance
       * @readonly
       */
      { name: 'defaultPage' },
      /**
       * The {@link Page} that currently has focus on the {@link StreamDeck}.
       *
       * @member {Page|undefined} focusedPage
       * @memberof StreamDeck
       * @instance
       * @readonly
       */
      { name: 'focusedPage' },
      /**
       * All {@link Page|Pages} created by the {@link StreamDeck} that have not been destroyed.
       *
       * @member {Set<Page>} pages
       * @memberof StreamDeck
       * @instance
       * @readonly
       */
      { name: 'pages', value: new Set(), get: () => new Set(this._pages) },
      /**
       * All {@link Key|Keys} created by the {@link StreamDeck} that have not been destroyed.
       *
       * @member {Set<Key>} keys
       * @memberof StreamDeck
       * @instance
       * @readonly
       */
      { name: 'keys', value: new Set(), get: () => new Set(this._keys) },
      /**
       * Whether or not the {@link StreamDeck} has been destroyed.
       *
       * @member {boolean} destroyed
       * @memberof StreamDeck
       * @instance
       * @readonly
       */
      { name: 'destroyed', value: false },
    ])

    this.STREAMDECK_NODE.on('error', this.emit.bind(this, 'error'))

    this.STREAMDECK_NODE.on('down', (index) => {
      if (this._destroyed) {
        return
      }

      if (this._holdTimeoutIds.has(index)) {
        clearTimeout(this._holdTimeoutIds.get(index))
        this._holdTimeoutIds.delete(index)
      }

      const page = this._focusedPage
      const key = page?.keys.get(index)

      this._downPages.set(index, page)
      this._downKeys.set(index, key)

      this._holdIndexes.delete(index)

      this.emit('down', index, page, key)
      page?.emit('down', index, page, key)
      key?.emit('down', index, page, key)

      if (this.HOLD_TIME > 0) {
        this._holdTimeoutIds.set(
          index,
          setTimeout(() => {
            this._holdTimeoutIds.delete(index)

            this._holdIndexes.add(index)

            this.emit('hold', index, page, key)

            if (page && typeof page.HOLD_TIME !== 'number') {
              page.emit('hold', index, page, key)

              if (key && typeof key.HOLD_TIME !== 'number') {
                key.emit('hold', index, page, key)
              }
            }
          }, this.HOLD_TIME)
        )
      }

      this.emit('activity', 'down', index, page, key)
      page?.emit('activity', 'down', index, page, key)
      key?.emit('activity', 'down', index, page, key)
    })

    this.STREAMDECK_NODE.on('up', (index) => {
      if (this._destroyed) {
        return
      }

      if (this._holdTimeoutIds.has(index)) {
        clearTimeout(this._holdTimeoutIds.get(index))
        this._holdTimeoutIds.delete(index)
      }

      const page = this._downPages.get(index)
      const key = this._downKeys.get(index)

      const held = this._holdIndexes.has(index)

      this._downPages.delete(index)
      this._downKeys.delete(index)

      this._holdIndexes.delete(index)

      this.emit('up', index, page, key)
      page?.emit('up', index, page, key)
      key?.emit('up', index, page, key)

      this.emit(held ? 'held' : 'click', index, page, key)

      if (page && typeof page.HOLD_TIME !== 'number') {
        page.emit(held ? 'held' : 'click', index, page, key)

        if (key && typeof key.HOLD_TIME !== 'number') {
          key.emit(held ? 'held' : 'click', index, page, key)
        }
      }

      this.emit('activity', 'up', index, page, key)
      page?.emit('activity', 'up', index, page, key)
      key?.emit('activity', 'up', index, page, key)
    })

    this._graphicsQueue.on('error', this.emit.bind(this, 'error'))

    this.on('activity', () => {
      if (this._destroyed) {
        return
      }

      if (this._idleTimeoutId) {
        clearTimeout(this._idleTimeoutId)
        this._idleTimeoutId = undefined
      }

      if (this.IDLE_TIME <= 0 || this._downKeys.size) {
        return
      }

      this._idleTimeoutId = setTimeout(() => {
        this._idleTimeoutId = undefined

        this.emit('idle')
      }, this.IDLE_TIME)
    })

    listenToEvents(this, options, [
      /**
       * Brightness event fired when setting the {@link StreamDeck|StreamDeck's}
       * `{@link StreamDeck#brightness}`.
       *
       * @event StreamDeck#event:brightness
       * @memberof StreamDeck
       *
       * @param {number} brightness
       * The new brightness for the {@link StreamDeck}.
       */
      'brightness',
      /**
       * Focus event fired when a {@link Page} gains focus.
       *
       * @event StreamDeck#event:focus
       * @memberof StreamDeck
       *
       * @param {Page} focusPage
       * The {@link Page} that gained focus.
       *
       * @param {Page} [blurPage]
       * The {@link Page} that lost focus.
       */
      'focus',
      /**
       * Blur event fired when a {@link Page} loses focus.
       *
       * @event StreamDeck#event:blur
       * @memberof StreamDeck
       *
       * @param {Page} [focusPage]
       * The {@link Page} that gained focus.
       *
       * @param {Page} blurPage
       * The {@link Page} that lost focus.
       */
      'blur',
      /**
       * Page event fired when a new {@link Page} is created.
       *
       * @event StreamDeck#event:page
       * @memberof StreamDeck
       *
       * @param {Page} page
       * The created {@link Page}.
       */
      'page',
      /**
       * Key event fired when a new {@link Key} is created.
       *
       * @event StreamDeck#event:key
       * @memberof StreamDeck
       *
       * @param {Key} key
       * The created {@link Key}.
       */
      'key',
      /**
       * Attach event fired when a {@link Key} is attached to a {@link Page}.
       *
       * @event StreamDeck#event:attach
       * @memberof StreamDeck
       *
       * @param {number} index
       * The key slot index.
       *
       * @param {Page} page
       * The {@link Page} that the {@link Key} was attached to.
       *
       * @param {Key} key
       * The {@link Key} that was attached.
       */
      'attach',
      /**
       * Detach event fired when a {@link Key} is detached from a {@link Page}.
       *
       * @event StreamDeck#event:detach
       * @memberof StreamDeck
       *
       * @param {number} index
       * The key slot index.
       *
       * @param {Page} page
       * The {@link Page} that the {@link Key} was detached from.
       *
       * @param {Key} key
       * The {@link Key} that was detached.
       */
      'detach',
      /**
       * Down event fired when a key is pressed.
       *
       * @event StreamDeck#event:down
       * @memberof StreamDeck
       *
       * @param {number} index
       * The key slot index that was pressed.
       *
       * @param {Page} [page]
       * The {@link Page} that currently has focus.
       *
       * @param {Key} [key]
       * The {@link Key} that is attached to the key slot index on the {@link Page}.
       */
      'down',
      /**
       * Hold event fired when a key is pressed down for `{@link StreamDeck#HOLD_TIME}`
       * milliseconds. If `{@link StreamDeck#HOLD_TIME}` is `0` this event is disabled.
       *
       * @event StreamDeck#event:hold
       * @memberof StreamDeck
       *
       * @param {number} index
       * The key slot index that is being pressed.
       *
       * @param {Page} [page]
       * The {@link Page} that had focus when the key was initially pressed.
       *
       * @param {Key} [key]
       * The {@link Key} that was attached to the key slot index on the {@link Page}.
       */
      'hold',
      /**
       * Up event fired when a key is released.
       *
       * @event StreamDeck#event:up
       * @memberof StreamDeck
       *
       * @param {number} index
       * The key slot index that was released.
       *
       * @param {Page} [page]
       * The {@link Page} that had focus when the key was initially pressed.
       *
       * @param {Key} [key]
       * The {@link Key} that was attached to the key slot index on the {@link Page}.
       */
      'up',
      /**
       * Click event fired after the {@link StreamDeck#event:up} if the
       * {@link StreamDeck#event:hold} had not been fired.
       *
       * @event StreamDeck#event:click
       * @memberof StreamDeck
       *
       * @param {number} index
       * The key slot index that was clicked.
       *
       * @param {Page} [page]
       * The {@link Page} that had focus when the key was initially pressed.
       *
       * @param {Key} [key]
       * The {@link Key} that was attached to the key slot index on the {@link Page}.
       */
      'click',
      /**
       * Held event fired after the {@link StreamDeck#event:up} if the
       * {@link StreamDeck#event:hold} had been fired.
       *
       * @event StreamDeck#event:held
       * @memberof StreamDeck
       *
       * @param {number} index
       * The key slot index that was held.
       *
       * @param {Page} [page]
       * The {@link Page} that had focus when the key was initially pressed.
       *
       * @param {Key} [key]
       * The {@link Key} that was attached to the key slot index on the {@link Page}.
       */
      'held',
      /**
       * Activity event fired after a user interacts with the Stream Deck device or the focused
       * {@link Page} has been changed.
       *
       * @event StreamDeck#event:activity
       * @memberof StreamDeck
       *
       * @param {string} event
       * The name of the event that was recognized as user interaction.
       *
       * @param {number} [index]
       * The relevant key slot index if the event was a key related event.
       *
       * @param {Page} [page]
       * The relevant {@link Page} if the event was a key related event.
       *
       * @param {Key} [key]
       * The relevant {@link Key} if the event was a key related event.
       */
      'activity',
      /**
       * Idle event fired after `{@link StreamDeck#IDLE_TIME}` milliseconds inactivity. If
       * `{@link StreamDeck#IDLE_TIME}` is `0` this event is disabled.
       *
       * @event StreamDeck#event:idle
       * @memberof StreamDeck
       */
      'idle',
      /**
       * Error event fired when an error occurs.
       *
       * @event StreamDeck#event:error
       * @memberof StreamDeck
       *
       * @param {*} err
       * The error that occurred.
       */
      'error',
      /**
       * Destroy event fired when the {@link StreamDeck} is destroyed.
       *
       * @event StreamDeck#event:destroy
       * @memberof StreamDeck
       */
      'destroy',
    ])

    clearStreamDeckNodePanel(this)
    setStreamDeckNodeBrightness(this)
  }

  /**
   * Set the brightness of the Stream Deck's panel.
   *
   * @function setBrightness
   * @memberof StreamDeck
   * @instance
   *
   * @param {number} brightness
   * The new brightness for the {@link StreamDeck|StreamDeck's} panel.
   *
   * (Float between `0` and `1` inclusive.)
   */
  setBrightness(brightness) {
    checkStreamDeckDestroyed(this)

    checkValid(brightness, {
      name: 'brightness',
      type: 'number',
      min: 0,
      max: 1,
    })

    this._brightness = brightness

    this.emit('brightness', brightness)

    if (this._focusedPage?.brightness !== undefined) {
      return
    }

    setStreamDeckNodeBrightness(this)
  }

  /**
   * Set the default {@link Page} for the {@link StreamDeck}.
   *
   * @function setDefaultPage
   * @memberof StreamDeck
   * @instance
   *
   * @param {Page} [page]
   * The new default {@link Page}.
   */
  setDefaultPage(page) {
    checkStreamDeckDestroyed(this)

    if (this._defaultPage === page) {
      return
    }

    checkValid(page, {
      name: 'page',
      type: 'class',
      class: 'Page',
      streamDeck: this,
      allowUndefined: true,
    })

    this._defaultPage = page

    if (this._focusedPage === undefined) {
      this.setFocusedPage(page)
    }
  }

  /**
   * Set the {@link Page} that currently has focus on the {@link StreamDeck}.
   *
   * @function setFocusedPage
   * @memberof StreamDeck
   * @instance
   *
   * @param {Page} [page]
   * The new focused {@link Page}.
   */
  setFocusedPage(page = this._defaultPage) {
    checkStreamDeckDestroyed(this)

    if (this._focusedPage === page) {
      return
    }

    checkValid(page, {
      name: 'page',
      type: 'class',
      class: 'Page',
      streamDeck: this,
      allowUndefined: true,
    })

    const blurPage = this._focusedPage

    this._focusedPage = page

    if (blurPage) {
      this.emit('blur', page, blurPage)
      blurPage.emit('blur', page, blurPage)

      for (const key of blurPage.keys.values()) {
        key.emit('blur', page, blurPage)
      }
    }

    if (!page) {
      clearStreamDeckNodePanel(this)
    } else {
      page.draw()
    }

    setStreamDeckNodeBrightness(this, page?.brightness)

    if (page) {
      this.emit('focus', page, blurPage)
      page.emit('focus', page, blurPage)

      for (const key of page.keys.values()) {
        key.emit('focus', page, blurPage)
      }

      this.emit('activity', 'focus', undefined, page, undefined)
      page.emit('activity', 'focus', undefined, page, undefined)

      for (const key of page.keys.values()) {
        key.emit('activity', 'focus', undefined, page, undefined)
      }
    }
  }

  /**
   * Create a new {@link Page}.
   *
   * @function createPage
   * @memberof StreamDeck
   * @instance
   *
   * @param {Object} [options]
   * Options used while creating a {@link Page}.
   *
   * @param {number} [options.holdTime]
   * The number of milliseconds after the {@link Page#event:down} is triggered that the
   * {@link Page#event:hold} will be triggered. A value of `0` means the {@link Page#event:hold}
   * is disabled. If undefined {@link StreamDeck#event:hold|StreamDeck#hold events} will be
   * allowed to propagate from the {@link StreamDeck}.
   *
   * (Integer greater than or equal to `0`.)
   *
   * @param {number} [options.idleTime]
   * The number of milliseconds of inactivity before the {@link Page#event:idle} is triggered.
   * A value of `0` means the {@link Page#event:idle} is disabled.
   *
   * (Integer greater than or equal to `0`.)
   * {Default: `{@link StreamDeck#IDLE_TIME}`}
   *
   * @param {Image|Image.Source} [options.backgroundImage]
   * The image to be set as the background image on the created {@link Page}.
   *
   * @param {number} [options.brightness]
   * The brightness of the created {@link Page}. If set the created {@link Page} will
   * override {@link StreamDeck#brightness} when it has focus.
   *
   * (Float between `0` and `1` inclusive.)
   *
   * @param {boolean} [options.setDefault=false]
   * Set the created {@link Page} as the {@link StreamDeck.defaultPage}.
   *
   * Same as calling {@link StreamDeck#setDefaultPage}.
   *
   * @param {boolean} [options.setFocused=false]
   * Set the created {@link Page} as the {@link StreamDeck.focusedPage}.
   *
   * Same as calling {@link StreamDeck#setFocusedPage}.
   *
   * @param {Array<Object>} [options.attachKeys]
   * An Array of Objects listing {@link Key|Keys} to attach to the created {@link Page}.
   *
   * @param {Key} options.attachKeys[].key
   * The {@link Key} to attach to the created {@link Page}.
   *
   * @param {number} [options.attachKeys[].index]
   * The key index that the {@link Key} will be attached to. If `options.attachKeys[].row` and
   * `options.attachKeys[].column` are defined they will be used calculate
   * `options.attachKeys[].index`. If undefined the {@link Key} will be attached to the first
   * free key slot.
   *
   * (Integer between `0` and `{@link StreamDeck#KEY_COUNT} - 1` inclusive.)
   *
   * @param {number} [options.attachKeys[].row]
   * The row that the {@link Key} will be attached to.
   *
   * (Integer between `1` and `{@link StreamDeck#PANEL_ROW_COUNT}` inclusive.)
   *
   * @param {number} [options.attachKeys[].column]
   * The column that the {@link Key} will be attached to.
   *
   * (Integer between `1` and `{@link StreamDeck#PANEL_COLUMN_COUNT}` inclusive.)
   *
   * @param {function} [options.on[Event]]
   * An event listener that will be attached to the created {@link Page} on `[event]`.
   *
   * See {@link Page} for a list of available events.
   *
   * @param {*} [options.[customProperty]]
   * Any custom properties not already reserved by the {@link Page} class will be added to the
   * created {@link Page}.
   *
   * @returns {Page}
   */
  createPage(options = {}) {
    checkStreamDeckDestroyed(this)

    if (this.PANEL_WIDTH <= 0 || this.PANEL_HEIGHT <= 0) {
      throw new Error(`This Stream Deck does not support Pages`)
    }

    checkValid(options, {
      name: 'options',
      type: 'object',
      allowUndefined: true,
      checkProps: [
        {
          name: 'setDefault',
          type: 'boolean',
          allowUndefined: true,
        },
        {
          name: 'setFocused',
          type: 'boolean',
          allowUndefined: true,
        },
        {
          name: 'attachKeys',
          type: 'array',
          allowUndefined: true,
          checkAllValues: {
            type: 'object',
            checkProps: [
              {
                name: 'key',
                type: 'class',
                class: 'Key',
                streamDeck: this,
              },
              {
                name: 'index',
                type: 'integer',
                min: 0,
                max: this.KEY_COUNT - 1,
                allowUndefined: true,
              },
              {
                name: 'row',
                type: 'integer',
                min: 1,
                max: this.PANEL_ROW_COUNT,
                allowUndefined: true,
              },
              {
                name: 'column',
                type: 'integer',
                min: 1,
                max: this.PANEL_COLUMN_COUNT,
                allowUndefined: true,
              },
            ],
          },
        },
      ],
    })

    const { attachKeys, setDefault, setFocused } = options

    const page = new Page(this, this._graphicsQueue, options)

    this._pages.add(page)

    page.on('destroy', () => this._pages.delete(page))

    try {
      if (Array.isArray(attachKeys)) {
        for (const { key, index, row, column } of attachKeys) {
          if (typeof row === 'number' && typeof column === 'number') {
            page.attachKey(row, column, key)
          } else if (typeof index === 'number') {
            page.attachKey(index, key)
          } else {
            page.attachKey(key)
          }
        }
      }

      if (setDefault) {
        this.setDefaultPage(page)
      }

      if (setFocused) {
        this.setFocusedPage(page)
      }
    } catch (err) {
      page.destroy()

      throw err
    }

    this.emit('page', page)
    page.emit('create')

    return page
  }

  /**
   * Create a new {@link Key}.
   *
   * @function createKey
   * @memberof StreamDeck
   * @instance
   *
   * @param {Object} [options]
   * Options used while creating a {@link Key}.
   *
   * @param {number} [options.holdTime]
   * The number of milliseconds after the {@link Key#event:down} is triggered that the
   * {@link Key#event:hold} will be triggered. A value of `0` means the {@link Key#event:hold}
   * is disabled. If undefined {@link Page#event:hold|Page#hold events} will be allowed to
   * propagate from {@link Page|Pages} that the created {@link Key} is attached to.
   *
   * (Integer greater than or equal to `0`.)
   *
   * @param {number} [options.pressTime]
   * The number of milliseconds after the {@link Key#event:down} is triggered that the press
   * scaling effect will apply. A value of `0` means the press scaling effect lasts until the
   * {@link Key#event:up} is triggered.
   *
   * (Integer greater than or equal to `0`.)
   * {Default: `{@link StreamDeck#PRESS_TIME}`}
   *
   * @param {number} [options.pressScale]
   * The default scale the created {@link Key} will use for the press scaling effect. Setting
   * to `1` disables the press scaling effect.
   *
   * (Float between `0` and `2` inclusive.)
   * {Default: `{@link StreamDeck#PRESS_SCALE}`}
   *
   * @param {number} [options.idleTime]
   * The number of milliseconds of inactivity before the {@link Key#event:idle} is triggered.
   * A value of `0` means the {@link Key#event:idle} is disabled.
   *
   * (Integer greater than or equal to `0`.)
   * {Default: `{@link StreamDeck#IDLE_TIME}`}
   *
   * @param {Image|Image.Source} [options.backgroundImage]
   * The image to be set as the background image on the created {@link Key}.
   *
   * @param {Image|Image.Source} [options.image]
   * The image to be set as the image on the created {@link Key}.
   *
   * @param {Array<Object>} [options.attachToPages]
   * An Array of Objects listing {@link Page|Pages} to attach the created {@link Key} to.
   *
   * @param {Page} options.attachToPages[].page
   * The {@link Page} to attach the created {@link Key} to.
   *
   * @param {number} [options.attachToPages[].index]
   * The key index that the created {@link Key} will be attached to. If
   * `options.attachToPages[].row` and `options.attachToPages[].column` are defined they will
   * used calculate the `options.attachToPages[].index`. If undefined the created {@link Key}
   * will be attached to the first free key slot.
   *
   * (Integer between `0` and `{@link StreamDeck#KEY_COUNT} - 1` inclusive.)
   *
   * @param {number} [options.attachToPages[].row]
   * The row that the created {@link Key} will be attached to.
   *
   * (Integer between `1` and `{@link StreamDeck#PANEL_ROW_COUNT}` inclusive.)
   *
   * @param {number} [options.attachToPages[].column]
   * The column that the created {@link Key} will be attached to.
   *
   * (Integer between `1` and `{@link StreamDeck#PANEL_COLUMN_COUNT}` inclusive.)
   *
   * @param {function} [options.on[Event]]
   * An event listener that will be attached to the created {@link Key} on `[event]`.
   *
   * See {@link Key} for a list of available events.
   *
   * @param {*} [options.[customProperty]]
   * Any custom properties not already reserved by the {@link Key} class will be added to the
   * created {@link Key}.
   *
   * @returns {Key}
   */
  createKey(options = {}) {
    checkStreamDeckDestroyed(this)

    if (this.KEY_WIDTH <= 0 || this.KEY_HEIGHT <= 0) {
      throw new Error(`This Stream Deck does not support Keys`)
    }

    checkValid(options, {
      name: 'options',
      type: 'object',
      allowUndefined: true,
      checkProps: [
        {
          name: 'attachToPages',
          type: 'array',
          allowUndefined: true,
          checkAllValues: {
            type: 'object',
            checkProps: [
              {
                name: 'page',
                type: 'class',
                class: 'Page',
                streamDeck: this,
              },
              {
                name: 'index',
                type: 'integer',
                min: 0,
                max: this.KEY_COUNT - 1,
                allowUndefined: true,
              },
              {
                name: 'row',
                type: 'integer',
                min: 1,
                max: this.PANEL_ROW_COUNT,
                allowUndefined: true,
              },
              {
                name: 'column',
                type: 'integer',
                min: 1,
                max: this.PANEL_COLUMN_COUNT,
                allowUndefined: true,
              },
            ],
          },
        },
      ],
    })

    const { attachToPages } = options

    const key = new Key(this, this._graphicsQueue, options)

    this._keys.add(key)

    key.on('destroy', () => this._keys.delete(key))

    try {
      if (Array.isArray(attachToPages)) {
        for (const { page, index, row, column } of attachToPages) {
          if (typeof row === 'number' && typeof column === 'number') {
            page.attachKey(row, column, key)
          } else if (typeof index === 'number') {
            page.attachKey(index, key)
          } else {
            page.attachKey(key)
          }
        }
      }
    } catch (err) {
      key.destroy()

      throw err
    }

    this.emit('key', key)
    key.emit('create')

    return key
  }

  /**
   * Create a new {@link Image} with a width of `{@link StreamDeck#PANEL_WIDTH}` and a height
   * of `{@link StreamDeck#PANEL_HEIGHT}`. The created {@link Image} will have split frames.
   *
   * @function createPageBackgroundImage
   * @memberof StreamDeck
   * @instance
   *
   * @param {Image.Source} [source]
   * The sources used to create the new {@link Image}.
   *
   * @returns {Image}
   */
  createPageBackgroundImage(source) {
    checkStreamDeckDestroyed(this)

    if (this.PANEL_WIDTH <= 0 || this.PANEL_HEIGHT <= 0) {
      throw new Error(`This Stream Deck does not support Page Images`)
    }

    return new Image({
      source,
      width: this.PANEL_WIDTH,
      height: this.PANEL_HEIGHT,
      splitFrames: { width: this.KEY_WIDTH, height: this.KEY_HEIGHT },
    })
  }

  /**
   * Create a new {@link Image} with a width of `{@link StreamDeck#KEY_WIDTH}` and a height of
   * `{@link StreamDeck#KEY_HEIGHT}`.
   *
   * @function createKeyBackgroundImage
   * @memberof StreamDeck
   * @instance
   *
   * @param {Image.Source} [source]
   * The sources used to create the new {@link Image}.
   *
   * @returns {Image}
   */
  createKeyBackgroundImage(source) {
    checkStreamDeckDestroyed(this)

    if (this.KEY_WIDTH <= 0 || this.KEY_HEIGHT <= 0) {
      throw new Error(`This Stream Deck does not support Key Images`)
    }

    return new Image({
      source,
      width: this.KEY_WIDTH,
      height: this.KEY_HEIGHT,
    })
  }

  /**
   * Create a new {@link Image} with a width of `{@link StreamDeck#KEY_WIDTH}` and a height of
   * `{@link StreamDeck#KEY_HEIGHT}`. The newly created {@link Image} will have scaled frames if applicable.
   *
   * @function createKeyImage
   * @memberof StreamDeck
   * @instance
   *
   * @param {Image.Source} [source]
   * The sources used to create the new {@link Image}.
   *
   * @param {Object} [options]
   * Options used while creating a {@link Image}.
   *
   * @param {number} [options.scaleFrames]
   * The scale to use for the press scaling effect. A value of `1` means the press scaling effect
   * is disabled.
   *
   * (Float between `0` and `2` inclusive.)
   * {Default: `{@link StreamDeck#PRESS_SCALE}`}
   *
   * @return {Image}
   */
  createKeyImage(source, options = {}) {
    checkStreamDeckDestroyed(this)

    if (this.KEY_WIDTH <= 0 || this.KEY_HEIGHT <= 0) {
      throw new Error(`This Stream Deck does not support Key Images`)
    }

    checkValid(options, {
      name: 'options',
      type: 'object',
      allowUndefined: true,
      checkProps: [
        {
          name: 'scaleFrames',
          type: 'number',
          min: 0,
          max: 2,
          allowUndefined: true,
        },
      ],
    })

    return new Image({
      source,
      width: this.KEY_WIDTH,
      height: this.KEY_HEIGHT,
      scaleFrames: options.scaleFrames ?? this.PRESS_SCALE,
    })
  }

  /**
   * Clean up all internal state data used by the {@link StreamDeck} in preparation for garbage
   * collection. This also destroys all {@link Page|Pages} and {@link Key|Keys} created by the
   * {@link StreamDeck}.
   *
   * @function destroy
   * @memberof StreamDeck
   * @instance
   */
  destroy() {
    checkStreamDeckDestroyed(this)

    if (this._holdTimeoutIds.size) {
      for (const holdTimeoutId of this._holdTimeoutIds.values()) {
        clearTimeout(holdTimeoutId)
      }

      this._holdTimeoutIds.clear()
    }

    if (this._idleTimeoutId) {
      clearTimeout(this._idleTimeoutId)
      this._idleTimeoutId = undefined
    }

    if (this._downPages.size) {
      this._downPages.clear()
    }

    if (this._downKeys.size) {
      this._downKeys.clear()
    }

    if (this._holdIndexes.size) {
      this._holdIndexes.clear()
    }

    if (this._keys.size) {
      for (const key of this._keys.values()) {
        key.destroy()
      }
    }

    if (this._pages.size) {
      for (const page of this._pages.values()) {
        page.destroy()
      }
    }

    this._graphicsQueue.end()

    this._destroyed = true

    this.emit('destroy')
  }

  /**
   * Destroy the {@link StreamDeck} and all {@link Page|Pages} and {@link Key|Keys} created
   * by the {@link StreamDeck}, then close `{@link StreamDeck#STREAMDECK_NODE}`.
   *
   * Returns a Promise that resolves once `{@link StreamDeck#STREAMDECK_NODE}` has been closed.
   *
   * @function close
   * @memberof StreamDeck
   * @instance
   *
   * @returns {Promise}
   */
  async close() {
    this.destroy()

    await emitCaughtAsyncError(this, async () => {
      await clearStreamDeckNodePanel(this)
      await setStreamDeckNodeBrightness(this, 0)

      await this.STREAMDECK_NODE.close()
    })
  }
}

function checkStreamDeckDestroyed(_this) {
  if (_this._destroyed) {
    throw new Error(`StreamDeck has been destroyed!`)
  }
}

function setStreamDeckNodeBrightness(_this, brightness) {
  return emitCaughtAsyncError(
    _this,
    _this.STREAMDECK_NODE.setBrightness(
      Math.max(
        0,
        Math.min(Math.round((brightness ?? _this._brightness) * 100), 100)
      )
    )
  )
}

function clearStreamDeckNodePanel(_this) {
  return emitCaughtAsyncError(_this, _this.STREAMDECK_NODE.clearPanel())
}

module.exports = StreamDeck
