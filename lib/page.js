'use strict'

const EventEmitter = require('eventemitter3')
const sharp = require('sharp')
const queue = require('queue')

const Image = require('./image')

const {
  checkValid,
  definePrivateProperties,
  definePublicProperties,
  listenToEvents,
  emitCaughtAsyncError,
} = require('./utils')

/**
 * An instance of {@link Page} represents a virtual page on a {@link StreamDeck|StreamDeck's} panel created via
 * {@link StreamDeck#createPage}.
 *
 * @class Page
 * @extends external:eventemitter3
 * @hideconstructor
 *
 * @example
 * const { openStreamDeck } = require('streamdeck-ui-node');
 *
 * (async () => {
 *   const streamDeck = await openStreamDeck();
 *
 *   const page = streamDeck.createPage();
 * })();
 */
class Page extends EventEmitter {
  constructor(streamDeck, graphicsQueue, options = {}) {
    super()

    checkValid(streamDeck, {
      name: 'streamDeck',
      type: 'class',
      class: 'StreamDeck',
    })

    checkValid(graphicsQueue, {
      name: 'graphicsQueue',
      type: 'class',
      class: queue,
    })

    checkValid(options, {
      name: 'options',
      type: 'object',
      allowUndefined: true,
    })

    definePrivateProperties(this, options, [
      { name: 'graphicsQueue', value: graphicsQueue },
      { name: 'holdTimeoutIds', value: new Map() },
      { name: 'idleTimeoutId' },
      { name: 'downIndexes', value: new Set() },
      { name: 'holdIndexes', value: new Set() },
      { name: 'boundDraw', value: this.draw.bind(this) },
      { name: 'backgroundFrame' },
    ])

    definePublicProperties(this, options, [
      /**
       * The {@link StreamDeck} that created the {@link Page}.
       *
       * @member {StreamDeck} STREAMDECK
       * @memberof Page
       * @instance
       * @constant
       */
      { name: 'STREAMDECK', value: streamDeck },
      /**
       * The {@link external:@elgato-stream-deck/node} instance managed by the {@link StreamDeck} that created
       * the {@link Page}.
       *
       * @member {external:@elgato-stream-deck/node} STREAMDECK_NODE
       * @memberof Page
       * @instance
       * @constant
       */
      { name: 'STREAMDECK_NODE', value: streamDeck.STREAMDECK_NODE },
      /**
       * The number of keys on the Stream Deck.
       *
       * @member {number} KEY_COUNT
       * @memberof Page
       * @instance
       * @constant
       */
      { name: 'KEY_COUNT', value: streamDeck.KEY_COUNT },
      /**
       * The width of each key on the Stream Deck in pixels.
       *
       * @member {number} KEY_WIDTH
       * @memberof Page
       * @instance
       * @constant
       */
      { name: 'KEY_WIDTH', value: streamDeck.KEY_WIDTH },
      /**
       * The height of each key on the Stream Deck in pixels.
       *
       * @member {number} KEY_HEIGHT
       * @memberof Page
       * @instance
       * @constant
       */
      { name: 'KEY_HEIGHT', value: streamDeck.KEY_HEIGHT },
      /**
       * The number of rows on the Stream Deck's panel.
       *
       * @member {number} PANEL_ROW_COUNT
       * @memberof Page
       * @instance
       * @constant
       */
      { name: 'PANEL_ROW_COUNT', value: streamDeck.PANEL_ROW_COUNT },
      /**
       * The number of columns on the Stream Deck's panel.
       *
       * @member {number} PANEL_COLUMN_COUNT
       * @memberof Page
       * @instance
       * @constant
       */
      { name: 'PANEL_COLUMN_COUNT', value: streamDeck.PANEL_COLUMN_COUNT },
      /**
       * The width of all panel columns on the Stream Deck combined in pixels.
       *
       * @member {number} PANEL_WIDTH
       * @memberof Page
       * @instance
       * @constant
       */
      { name: 'PANEL_WIDTH', value: streamDeck.PANEL_WIDTH },
      /**
       * The height of all panel rows on the Stream Deck combined in pixels.
       *
       * @member {number} PANEL_HEIGHT
       * @memberof Page
       * @instance
       * @constant
       */
      { name: 'PANEL_HEIGHT', value: streamDeck.PANEL_HEIGHT },
      /**
       * The number of milliseconds after the {@link Page#event:down} is triggered that the
       * {@link Page#event:hold} will be triggered. A value of `0` means the {@link Page#event:hold}
       * is disabled. If undefined {@link StreamDeck#event:hold|StreamDeck#hold events} will be
       * allowed to propagate from the {@link StreamDeck} that created the {@link Page}.
       *
       * @member {number|undefined} HOLD_TIME
       * @memberof Page
       * @instance
       * @constant
       */
      {
        name: 'HOLD_TIME',
        type: 'integer',
        min: 0,
        allowUndefined: true,
      },
      /**
       * The number of milliseconds of inactivity before the {@link Page#event:idle} is triggered.
       * A value of `0` means the {@link Page#event:idle} is disabled.
       *
       * @member {number} IDLE_TIME
       * @memberof Page
       * @instance
       * @constant
       */
      {
        name: 'IDLE_TIME',
        value: streamDeck.IDLE_TIME,
        type: 'integer',
        min: 0,
        allowUndefined: true,
      },
      /**
       * The brightness of Stream Deck's panel when the {@link Page} has focus. Value is a float
       * between `0` and `1` inclusive.
       *
       * @member {number|undefined} brightness
       * @memberof Page
       * @instance
       * @readonly
       */
      {
        name: 'brightness',
        type: 'number',
        min: 0,
        max: 1,
        allowUndefined: true,
      },
      /**
       * The background image of the {@link Page}.
       *
       * @member {Image|undefined} backgroundImage
       * @memberof Page
       * @instance
       * @readonly
       */
      { name: 'backgroundImage', type: 'source', allowUndefined: true },
      /**
       * A Map of {@link Key|Keys} currently attached to the {@link Page}, stored by key slot index.
       *
       * @member {Map<number, Key>} keys
       * @memberof Page
       * @instance
       * @readonly
       */
      { name: 'keys', value: new Map(), get: () => new Map(this._keys) },
      /**
       * Whether or not the {@link Page} has been destroyed.
       *
       * @member {boolean} destroyed
       * @memberof Page
       * @instance
       * @readonly
       */
      { name: 'destroyed', value: false },
    ])

    this.on('down', (index) => {
      if (this._destroyed) {
        return
      }

      if (this._holdTimeoutIds.has(index)) {
        clearTimeout(this._holdTimeoutIds.get(index))
        this._holdTimeoutIds.delete(index)
      }

      const key = this._keys.get(index)

      this._downIndexes.add(index)
      this._holdIndexes.delete(index)

      if (typeof this.HOLD_TIME !== 'number' || this.HOLD_TIME <= 0) {
        return
      }

      this._holdTimeoutIds.set(
        index,
        setTimeout(() => {
          this._holdTimeoutIds.delete(index)

          this._holdIndexes.add(index)

          this.emit('hold', index, this, key)

          if (key && typeof key.HOLD_TIME !== 'number') {
            key.emit('hold', index, this, key)
          }
        }, this.HOLD_TIME)
      )
    })

    this.on('hold', (index) => {
      if (this._destroyed) {
        return
      }

      if (typeof this.HOLD_TIME === 'number') {
        return
      }

      this._holdIndexes.add(index)
    })

    this.on('up', (index) => {
      if (this._destroyed) {
        return
      }

      if (this._holdTimeoutIds.has(index)) {
        clearTimeout(this._holdTimeoutIds.get(index))
        this._holdTimeoutIds.delete(index)
      }

      const key = this._keys.get(index)
      const held = this._holdIndexes.has(index)

      this._downIndexes.delete(index)
      this._holdIndexes.delete(index)

      if (typeof this.HOLD_TIME !== 'number') {
        return
      }

      this.emit(held ? 'held' : 'click', index, this, key)

      if (key && typeof key.HOLD_TIME !== 'number') {
        key.emit(held ? 'held' : 'click', index, this, key)
      }
    })

    this.on('activity', () => {
      if (this._destroyed) {
        return
      }

      if (this._idleTimeoutId) {
        clearTimeout(this._idleTimeoutId)
        this._idleTimeoutId = undefined
      }

      if (this.IDLE_TIME <= 0 || this._downIndexes.size) {
        return
      }

      this._idleTimeoutId = setTimeout(() => {
        this._idleTimeoutId = undefined

        this.emit('idle')
      }, this.IDLE_TIME)
    })

    listenToEvents(this, options, [
      /**
       * Brightness event fired when setting the {@link Page|Page's} `{@link Page#brightness}`.
       *
       * @event Page#event:brightness
       * @memberof Page
       *
       * @param {number} [brightness]
       * The new brightness for the {@link Page}.
       */
      'brightness',
      /**
       * Focus event fired when the {@link Page} gains focus.
       *
       * @event Page#event:focus
       * @memberof Page
       *
       * @param {Page} focusPage
       * The {@link Page}.
       *
       * @param {Page} [blurPage]
       * The {@link Page} that lost focus.
       */
      'focus',
      /**
       * Blur event fired when the {@link Page} loses focus.
       *
       * @event Page#event:blur
       * @memberof Page
       *
       * @param {Page} [focusPage]
       * The {@link Page} that gained focus.
       *
       * @param {Page} blurPage
       * The {@link Page}.
       */
      'blur',
      /**
       * Attach event fired when a {@link Key} is attached to the {@link Page}.
       *
       * @event Page#event:attach
       * @memberof Page
       *
       * @param {number} index
       * The key slot index.
       *
       * @param {Page} page
       * The {@link Page}.
       *
       * @param {Key} key
       * The {@link Key} that was attached.
       */
      'attach',
      /**
       * Detach event fired when a {@link Key} is detached from the {@link Page}.
       *
       * @event Page#event:detach
       * @memberof Page
       *
       * @param {number} index
       * The key slot index.
       *
       * @param {Page} page
       * The {@link Page}.
       *
       * @param {Key} key
       * The {@link Key} that was detached.
       */
      'detach',
      /**
       * Down event fired when a key is pressed and the {@link Page} has focus.
       *
       * @event Page#event:down
       * @memberof Page
       *
       * @param {number} index
       * The key slot index that was pressed.
       *
       * @param {Page} page
       * The {@link Page}.
       *
       * @param {Key} [key]
       * The {@link Key} that is attached to the key slot index on the {@link Page}.
       */
      'down',
      /**
       * Hold event fired when a key is pressed down for `{@link Page#HOLD_TIME}`
       * milliseconds. If `{@link Page#HOLD_TIME}` is `0` this event is disabled. If
       * `{@link Page#HOLD_TIME}` is undefined {@link StreamDeck#event:hold|StreamDeck#hold events}
       * will be allowed to propagate from the {@link StreamDeck} that created the {@link Page}.
       *
       * @event Page#event:hold
       * @memberof Page
       *
       * @param {number} index
       * The key slot index that is being pressed.
       *
       * @param {Page} page
       * The {@link Page}.
       *
       * @param {Key} [key]
       * The {@link Key} that was attached to the key slot index on the {@link Page} when it
       * was initially pressed.
       */
      'hold',
      /**
       * Up event fired when a key is released and the {@link Page} had focus when it
       * was initially pressed.
       *
       * @event Page#event:up
       * @memberof Page
       *
       * @param {number} index
       * The key slot index that was released.
       *
       * @param {Page} page
       * The {@link Page}.
       *
       * @param {Key} [key]
       * The {@link Key} that was attached to the key slot index on the {@link Page} when it
       * was initially pressed.
       */
      'up',
      /**
       * Click event fired after the {@link Page#event:up} if the {@link Page#event:hold} had not
       * been fired.
       *
       * @event Page#event:click
       * @memberof Page
       *
       * @param {number} index
       * The key slot index that was clicked.
       *
       * @param {Page} page
       * The {@link Page}.
       *
       * @param {Key} [key]
       * The {@link Key} that was attached to the key slot index on the {@link Page} when it
       * was initially pressed.
       */
      'click',
      /**
       * Held event fired after the {@link Page#event:up} if the {@link Page#event:hold} had been
       * fired.
       *
       * @event Page#event:held
       * @memberof Page
       *
       * @param {number} index
       * The key slot index that was held.
       *
       * @param {Page} page
       * The {@link Page}.
       *
       * @param {Key} [key]
       * The {@link Key} that is attached to the key slot index on the {@link Page} when it
       * was initially pressed.
       */
      'held',
      /**
       * Activity event fired after a user interacts with the Stream Deck device's keys
       * while the {@link Page} has focus or when the {@link Page} gains focus.
       *
       * @event Page#event:activity
       * @memberof Page
       *
       * @param {string} event
       * The name of the event that was recognized as user interaction.
       *
       * @param {number} [index]
       * The relevant key slot index if the event was a key related event.
       *
       * @param {Page} page
       * The {@link Page}.
       *
       * @param {Key} [key]
       * The relevant {@link Key} if the event was a key related event.
       */
      'activity',
      /**
       * Idle event fired after {@link Page#IDLE_TIME} milliseconds of inactivity. If
       * {@link Page#IDLE_TIME} is `0` this event is disabled.
       *
       * @event Page#event:idle
       * @memberof Page
       */
      'idle',
      /**
       * Error event fired when an error occurs.
       *
       * @event Page#event:error
       * @memberof Page
       *
       * @param {*} err
       * The error that occurred.
       */
      'error',
      /**
       * Create event fired when the {@link Page} is created.
       *
       * @event Page#event:create
       * @memberof Page
       */
      'create',
      /**
       * Destroy event fired when the {@link Page} is destroyed.
       *
       * @event Page#event:destroy
       * @memberof Page
       */
      'destroy',
    ])

    this.setBackgroundImage(this._backgroundImage)
  }

  /**
   * Set the brightness of the Stream Deck's panel. If no brightness value is given the
   * {@link StreamDeck} that created the {@link Page} will be allowed to use
   * it's `{@link StreamDeck#brightness}` value instead.
   *
   * @function setBrightness
   * @memberof Page
   * @instance
   *
   * @param {number} [brightness]
   * The new brightness for the {@link Page}.
   *
   * (Float between `0` and `1` inclusive.)
   */
  setBrightness(brightness) {
    checkPageDestroyed(this)

    checkValid(brightness, {
      name: 'brightness',
      type: 'number',
      min: 0,
      max: 1,
      allowUndefined: true,
    })

    this._brightness = brightness

    this.emit('brightness', brightness)

    if (this.STREAMDECK.focusedPage !== this) {
      return
    }

    emitCaughtAsyncError(
      this,
      this.STREAMDECK_NODE.setBrightness(
        Math.max(
          0,
          Math.min(
            Math.round((brightness ?? this.STREAMDECK.brightness) * 100),
            100
          )
        )
      )
    )
  }

  /**
   * Set the `{@link StreamDeck#focusedPage}` of the {@link StreamDeck} that created the
   * {@link Page} to the {@link Page}.
   *
   * @function focus
   * @memberof Page
   * @instance
   */
  focus() {
    checkPageDestroyed(this)

    if (this.STREAMDECK.focusedPage !== this) {
      this.STREAMDECK.setFocusedPage(this)
    }
  }

  /**
   * Set the `{@link StreamDeck#focusedPage}` of the {@link StreamDeck} that created the
   * {@link Page} to the `{@link StreamDeck#defaultPage}` if the {@link Page} has focus.
   *
   * @function blur
   * @memberof Page
   * @instance
   */
  blur() {
    checkPageDestroyed(this)

    if (this.STREAMDECK.focusedPage === this) {
      this.STREAMDECK.setFocusedPage(this.STREAMDECK.defaultPage)
    }
  }

  /**
   * Attach a {@link Key} to the first free key slot on the {@link Page}.
   *
   * @function attachKey
   * @memberof Page
   * @instance
   *
   * @param {Key} key
   * The {@link Key} to attach to the {@link Page}.
   */

  /**
   * Attach a {@link Key} to a key slot index on the {@link Page}.
   *
   * @function attachKey
   * @memberof Page
   * @instance
   * @variation 2
   *
   * @param {number} index
   * The key slot index to attach the {@link Key} to.
   *
   * (Integer between `0` and `{@link Page#KEY_COUNT} - 1` inclusive.)
   *
   * @param {Key} key
   * The {@link Key} to attach to the {@link Page}.
   */

  /**
   * Attach a {@link Key} to key slot coordinates on the {@link Page}.
   *
   * @function attachKey
   * @memberof Page
   * @instance
   * @variation 3
   *
   * @param {number} row
   * The row to attach the {@link Key} to.
   *
   * (Integer between `1` and `{@link Page#PANEL_ROW_COUNT}` inclusive.)
   *
   * @param {number} column
   * The column to attach the {@link Key} to.
   *
   * (Integer between `1` and `{@link Page#PANEL_COLUMN_COUNT}` inclusive.)
   *
   * @param {Key} key
   * The {@link Key} to attach to the {@link Page}.
   */
  attachKey(row, column, key) {
    checkPageDestroyed(this)

    let index

    if (typeof row === 'number' && typeof column === 'number') {
      checkValid(row, {
        name: 'row',
        type: 'integer',
        min: 1,
        max: this.PANEL_ROW_COUNT,
      })

      checkValid(column, {
        name: 'column',
        type: 'integer',
        min: 1,
        max: this.PANEL_COLUMN_COUNT,
      })

      index = column - 1 + (row - 1) * this.PANEL_COLUMN_COUNT
    } else if (typeof row === 'number') {
      key = column

      index = row

      checkValid(index, {
        name: 'index',
        type: 'integer',
        min: 0,
        max: this.KEY_COUNT - 1,
      })
    } else {
      key = row

      index = -1

      for (let i = 0; i < this.KEY_COUNT; i++) {
        if (!this._keys.has(i)) {
          index = i

          break
        }
      }

      if (index === -1) {
        throw new Error(`There are no free key slots on this Page`)
      }
    }

    checkValid(key, {
      name: 'key',
      type: 'class',
      class: 'Key',
      streamDeck: this.STREAMDECK,
    })

    if (this._keys.has(index)) {
      this.detachKey(index)
    }

    this._keys.set(index, key)

    this.STREAMDECK.emit('attach', index, this, key)
    this.emit('attach', index, this, key)
    key.emit('attach', index, this, key)

    key.draw()
  }

  /**
   * Detach a {@link Key} from the first key slot index to which the {@link Key} is attached
   * on the {@link Page}.
   *
   * @function detachKey
   * @memberof Page
   * @instance
   *
   * @param {Key} key
   * The {@link Key} to detach from the {@link Page}.
   */

  /**
   * Detach a {@link Key} from a key slot index on the {@link Page}.
   *
   * @function detachKey
   * @memberof Page
   * @instance
   * @variation 2
   *
   * @param {number} index
   * The key slot index to detach the {@link Key} from.
   *
   * (Integer between `0` and `{@link Page#KEY_COUNT} - 1` inclusive.)
   *
   * @param {Key} [key]
   * The {@link Key} to detach from the {@link Page}. If undefined any {@link Key} at the given
   * key slot index will be detached.
   */

  /**
   * Detach a {@link Key} from key slot coordinates on the {@link Page}.
   *
   * @function detachKey
   * @memberof Page
   * @instance
   * @variation 3
   *
   * @param {number} row
   * The row to detach the {@link Key} from.
   *
   * (Integer between `1` and `{@link Page#PANEL_ROW_COUNT}` inclusive.)
   *
   * @param {number} column
   * The column to detach the {@link Key} from.
   *
   * (Integer between `1` and `{@link Page#PANEL_COLUMN_COUNT}` inclusive.)
   *
   * @param {Key} [key]
   * The {@link Key} to detach from the {@link Page}. If undefined any {@link Key} at the given
   * key coordinates will be detached.
   */
  detachKey(row, column, key) {
    checkPageDestroyed(this)

    let index

    if (typeof row === 'number' && typeof column === 'number') {
      checkValid(row, {
        name: 'row',
        type: 'integer',
        min: 1,
        max: this.PANEL_ROW_COUNT,
      })

      checkValid(column, {
        name: 'column',
        type: 'integer',
        min: 1,
        max: this.PANEL_COLUMN_COUNT,
      })

      index = column - 1 + (row - 1) * this.PANEL_COLUMN_COUNT
    } else if (typeof row === 'number') {
      key = column

      index = row

      checkValid(index, {
        name: 'index',
        type: 'integer',
        min: 0,
        max: this.KEY_COUNT - 1,
      })
    } else {
      key = row
    }

    checkValid(key, {
      name: 'key',
      type: 'class',
      class: 'Key',
      streamDeck: this.STREAMDECK,
      allowUndefined: index !== undefined,
      allowDestroyed: true,
    })

    for (const [attachedIndex, attachedKey] of this._keys.entries()) {
      if (index !== undefined && attachedIndex !== index) {
        continue
      }

      if (key !== undefined && attachedKey !== key) {
        continue
      }

      this._keys.delete(attachedIndex)

      this.STREAMDECK.emit('detach', attachedIndex, this, attachedKey)
      this.emit('detach', attachedIndex, this, attachedKey)
      key.emit('detach', attachedIndex, this, attachedKey)

      break
    }

    this.draw()
  }

  /**
   * Create a new {@link Image} with a width of `{@link Page#PANEL_WIDTH}` and a height
   * of `{@link Page#PANEL_HEIGHT}`. The created {@link Image} will have split frames.
   *
   * @function createBackgroundImage
   * @memberof Page
   * @instance
   *
   * @param {Image.Source} [source]
   * The sources used to create the new {@link Image}.
   *
   * @returns {Image}
   */
  createBackgroundImage(source) {
    checkPageDestroyed(this)

    return new Image({
      source,
      width: this.PANEL_WIDTH,
      height: this.PANEL_HEIGHT,
      splitFrames: { width: this.KEY_WIDTH, height: this.KEY_HEIGHT },
    })
  }

  /**
   * Set the background image of the {@link Page}. If no image argument is passed this is the
   * same as calling {@link Page#clearBackgroundImage}.
   *
   * @function setBackgroundImage
   * @memberof Page
   * @instance
   *
   * @param {Image|Image.Source} [image]
   * The new background {@link Image}.
   */
  setBackgroundImage(image) {
    checkPageDestroyed(this)

    if (!image) {
      this.clearBackgroundImage()

      return
    }

    try {
      checkValid(image, {
        name: 'image',
        type: 'class',
        class: 'Image',
      })

      checkValid(image, {
        name: 'image',
        type: 'dimensions',
        width: this.PANEL_WIDTH,
        height: this.PANEL_HEIGHT,
        checkConstantKeys: true,
      })

      checkValid(image.SPLIT_FRAMES, {
        name: 'image.SPLIT_FRAMES',
        type: 'dimensions',
        width: this.KEY_WIDTH,
        height: this.KEY_HEIGHT,
      })
    } catch (err) {
      image = this.createBackgroundImage(image)
    }

    if (this._backgroundImage instanceof Image) {
      this._backgroundImage.off('frameUpdated', this._boundDraw)
    }

    this._backgroundImage = image

    image.on('frameUpdated', this._boundDraw)

    this.draw()
  }

  /**
   * Clear the background image of the {@link Page}.
   *
   * @function clearBackgroundImage
   * @memberof Page
   * @instance
   */
  clearBackgroundImage() {
    checkPageDestroyed(this)

    if (!this._backgroundImage) {
      this._backgroundImage = undefined

      return
    }

    this._backgroundImage.off('frameUpdated', this._boundDraw)

    this._backgroundImage = undefined
    this._backgroundFrame = undefined

    this.draw()
  }

  /**
   * Get the current frame of the background image for the {@link Page}. If no background image
   * is set or if the background image frame has not yet loaded returns `null`.
   *
   * @function getBackgroundFrame
   * @memberof Page
   * @instance
   *
   * @returns {Image.FrameData|null}
   */
  getBackgroundFrame() {
    checkPageDestroyed(this)

    if (!this._backgroundImage) {
      return null
    }

    let backgroundFrame = this._backgroundImage.getFrame()

    if (backgroundFrame) {
      this._backgroundFrame = backgroundFrame
    }

    return this._backgroundFrame ?? null
  }

  /**
   * Draw the {@link Page} to the Stream Deck's panel.
   *
   * @function draw
   * @memberof Page
   * @instance
   */
  draw() {
    if (this._destroyed) {
      return
    }

    this._graphicsQueue.push(() =>
      emitCaughtAsyncError(this, async () => {
        if (this.STREAMDECK.focusedPage !== this) {
          return
        }

        let pageBackgroundFrame = this.getBackgroundFrame()

        let keyFramesData = Array.from(this._keys.entries()).map(
          ([index, key]) => ({
            index,
            keyBackgroundFrame: key.getBackgroundFrame(),
            keyFrame: key.getFrame(),
            pressed: key.isPressed(index, this),
          })
        )

        if (
          !keyFramesData.some(
            (keyFrameData) =>
              keyFrameData.keyBackgroundFrame || keyFrameData.keyFrame
          )
        ) {
          if (!pageBackgroundFrame) {
            emitCaughtAsyncError(this, this.STREAMDECK_NODE.clearPanel())
          } else {
            emitCaughtAsyncError(
              this,
              this.STREAMDECK_NODE.fillPanelBuffer(
                pageBackgroundFrame.base.withoutAlpha
              )
            )
          }

          return
        }

        let pageImage

        if (pageBackgroundFrame) {
          pageImage = await sharp(pageBackgroundFrame.base.withAlpha, {
            raw: {
              width: this.PANEL_WIDTH,
              height: this.PANEL_HEIGHT,
              channels: 4,
            },
          })
        } else {
          pageImage = await sharp({
            create: {
              width: this.PANEL_WIDTH,
              height: this.PANEL_HEIGHT,
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 1 },
            },
          })
        }

        let inputs = []

        for (const {
          index,
          keyBackgroundFrame,
          keyFrame,
          pressed,
        } of keyFramesData) {
          if (keyBackgroundFrame) {
            inputs.push({
              input: keyBackgroundFrame.base.withAlpha,
              left: this.KEY_WIDTH * (index % this.PANEL_COLUMN_COUNT),
              top:
                this.KEY_HEIGHT * Math.floor(index / this.PANEL_COLUMN_COUNT),
              raw: {
                width: this.KEY_WIDTH,
                height: this.KEY_HEIGHT,
                channels: 4,
              },
            })
          }

          if (keyFrame) {
            let keyFrameSize

            if (pressed) {
              keyFrameSize = 'scaled'
            } else {
              keyFrameSize = 'base'
            }

            if (!keyFrame[keyFrameSize]) {
              keyFrameSize = 'base'
            }

            inputs.push({
              input: keyFrame[keyFrameSize].withAlpha,
              left: this.KEY_WIDTH * (index % this.PANEL_COLUMN_COUNT),
              top:
                this.KEY_HEIGHT * Math.floor(index / this.PANEL_COLUMN_COUNT),
              raw: {
                width: this.KEY_WIDTH,
                height: this.KEY_HEIGHT,
                channels: 4,
              },
            })
          }
        }

        emitCaughtAsyncError(
          this,
          this.STREAMDECK_NODE.fillPanelBuffer(
            await sharp(await pageImage.composite(inputs).toBuffer(), {
              raw: {
                width: this.PANEL_WIDTH,
                height: this.PANEL_HEIGHT,
                channels: 4,
              },
            })
              .flatten()
              .toBuffer()
          )
        )
      })
    )
  }

  /**
   * Clean up all internal state data used by the {@link Page} in preparation for garbage
   * collection and detach all attached {@link Key|Keys}.
   *
   * @function destroy
   * @memberof Page
   * @instance
   */
  destroy() {
    checkPageDestroyed(this)

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

    if (this._downIndexes.size) {
      this._downIndexes.clear()
    }

    if (this._holdIndexes.size) {
      this._holdIndexes.clear()
    }

    if (this.STREAMDECK.defaultPage === this) {
      this.STREAMDECK.setDefaultPage()
    }

    if (this.STREAMDECK.focusedPage === this) {
      this.STREAMDECK.setFocusedPage(this.STREAMDECK.defaultPage)
    }

    this.clearBackgroundImage()

    for (const [index, key] of this._keys.entries()) {
      this.detachKey(index, key)
    }

    this._destroyed = true

    this.emit('destroy')
  }
}

function checkPageDestroyed(_this) {
  if (_this._destroyed) {
    throw new Error(`Page has been destroyed!`)
  }
}

module.exports = Page
