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

const ArrayKeyedMap = require('./wild-array-keyed-map')
const ArrayValuedSet = require('./wild-array-valued-set')

/**
 * An instance of {@link Key} represents a virtual key on a {@link Page} created via
 * {@link StreamDeck#createKey}.
 *
 * @class Key
 * @extends external:eventemitter3
 * @hideconstructor
 *
 * @example
 * const { openStreamDeck } = require('streamdeck-ui-node');
 *
 * (async () => {
 *   const streamDeck = await openStreamDeck();
 *
 *   const key = streamDeck.createKey();
 * })();
 */
class Key extends EventEmitter {
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
      { name: 'boundDraw', value: this.draw.bind(this) },
      { name: 'holdTimeoutIds', value: new ArrayKeyedMap() },
      { name: 'pressTimeoutIds', value: new ArrayKeyedMap() },
      { name: 'idleTimeoutId' },
      { name: 'downStates', value: new ArrayValuedSet() },
      { name: 'holdStates', value: new ArrayValuedSet() },
      { name: 'pressStates', value: new ArrayValuedSet() },
      { name: 'backgroundFrame' },
      { name: 'frame' },
    ])

    definePublicProperties(this, options, [
      /**
       * The {@link StreamDeck} that created the {@link Key}.
       *
       * @member {StreamDeck} STREAMDECK
       * @memberof Key
       * @instance
       * @constant
       */
      { name: 'STREAMDECK', value: streamDeck },
      /**
       * The {@link external:@elgato-stream-deck/node} instance managed by the {@link StreamDeck} that created
       * the {@link Key}.
       *
       * @member {external:@elgato-stream-deck/node} STREAMDECK_NODE
       * @memberof Key
       * @instance
       * @constant
       */
      { name: 'STREAMDECK_NODE', value: streamDeck.STREAMDECK_NODE },
      /**
       * The number of keys on the Stream Deck.
       *
       * @member {number} KEY_COUNT
       * @memberof Key
       * @instance
       * @constant
       */
      { name: 'KEY_COUNT', value: streamDeck.KEY_COUNT },
      /**
       * The width of each key on the Stream Deck in pixels.
       *
       * @member {number} KEY_WIDTH
       * @memberof Key
       * @instance
       * @constant
       */
      { name: 'KEY_WIDTH', value: streamDeck.KEY_WIDTH },
      /**
       * The height of each key on the Stream Deck in pixels.
       *
       * @member {number} KEY_HEIGHT
       * @memberof Key
       * @instance
       * @constant
       */
      { name: 'KEY_HEIGHT', value: streamDeck.KEY_HEIGHT },
      /**
       * The number of milliseconds after the {@link Key#event:down} is triggered that the
       * {@link Key#event:hold} will be triggered. A value of `0` means the {@link Key#event:hold}
       * is disabled. If undefined {@link Page#event:hold|Page#hold events} will be allowed to
       * propagate from {@link Page|Pages} that the {@link Key} is attached to.
       *
       * @member {number|undefined} HOLD_TIME
       * @memberof Key
       * @instance
       * @readonly
       */
      {
        name: 'HOLD_TIME',
        type: 'integer',
        min: 0,
        allowUndefined: true,
      },
      /**
       * The number of milliseconds after the {@link Key#event:down} is triggered that the press
       * scaling effect will apply. A value of `0` means the press scaling effect lasts until
       * the {@link Key#event:up} is triggered.
       *
       * @member {number} PRESS_TIME
       * @memberof Key
       * @instance
       * @readonly
       */
      {
        name: 'PRESS_TIME',
        value: streamDeck.PRESS_TIME,
        type: 'integer',
        min: 0,
        allowUndefined: true,
      },
      /**
       * The default scale the {@link Key} will use for the press scaling effect. A value of `1`
       * means the press scaling effect is disabled.
       *
       * @member {number} PRESS_SCALE
       * @memberof Key
       * @instance
       * @readonly
       */
      {
        name: 'PRESS_SCALE',
        value: streamDeck.PRESS_SCALE,
        type: 'number',
        min: 0,
        max: 2,
        allowUndefined: true,
      },
      /**
       * The number of milliseconds of inactivity before the {@link Key#event:idle} is triggered.
       * A value of `0` means the {@link Key#event:idle} is disabled.
       *
       * @member {number} IDLE_TIME
       * @memberof Key
       * @instance
       * @readonly
       */
      {
        name: 'IDLE_TIME',
        value: streamDeck.IDLE_TIME,
        type: 'integer',
        min: 0,
        allowUndefined: true,
      },
      /**
       * The background image of the {@link Key}.
       *
       * @member {Image|undefined} backgroundImage
       * @memberof Key
       * @instance
       * @readonly
       */
      { name: 'backgroundImage', type: 'source', allowUndefined: true },
      /**
       * The image of the {@link Key}.
       *
       * @member {Image|undefined} image
       * @memberof Key
       * @instance
       * @readonly
       */
      { name: 'image', type: 'source', allowUndefined: true },
      /**
       * Whether or not the {@link Key} has been destroyed.
       *
       * @member {boolean} destroyed
       * @memberof Key
       * @instance
       * @readonly
       */
      { name: 'destroyed', value: false },
    ])

    this.on('detach', (index, page) => {
      if (this._destroyed) {
        return
      }

      if (this._holdTimeoutIds.has([index, page])) {
        clearTimeout(this._holdTimeoutIds.get([index, page]))
        this._holdTimeoutIds.delete([index, page])
      }

      if (this._pressTimeoutIds.has([index, page])) {
        clearTimeout(this._pressTimeoutIds.get([index, page]))
        this._pressTimeoutIds.delete([index, page])
      }

      this._downStates.delete([index, page])
      this._holdStates.delete([index, page])
      this._pressStates.delete([index, page])
    })

    this.on('down', (index, page) => {
      if (this._destroyed) {
        return
      }

      if (this._holdTimeoutIds.has([index, page])) {
        clearTimeout(this._holdTimeoutIds.get([index, page]))
        this._holdTimeoutIds.delete([index, page])
      }

      if (this._pressTimeoutIds.has([index, page])) {
        clearTimeout(this._pressTimeoutIds.get([index, page]))
        this._pressTimeoutIds.delete([index, page])
      }

      this._downStates.add([index, page])
      this._holdStates.delete([index, page])
      this._pressStates.add([index, page])

      if (typeof this.HOLD_TIME === 'number' && this.HOLD_TIME > 0) {
        this._holdTimeoutIds.set(
          [index, page],
          setTimeout(() => {
            this._holdTimeoutIds.delete([index, page])

            this._holdStates.add([index, page])

            this.emit('hold', index, page, this)
          }, this.HOLD_TIME)
        )
      }

      if (this.PRESS_TIME > 0) {
        this._pressTimeoutIds.set(
          [index, page],
          setTimeout(() => {
            this._pressTimeoutIds.delete([index, page])

            this._pressStates.delete([index, page])

            this.draw()
          }, this.PRESS_TIME)
        )
      }

      this.draw()
    })

    this.on('hold', (index, page) => {
      if (this._destroyed) {
        return
      }

      if (typeof this.HOLD_TIME === 'number') {
        return
      }

      this._holdStates.add([index, page])
    })

    this.on('up', (index, page) => {
      if (this._destroyed) {
        return
      }

      if (this._holdTimeoutIds.has([index, page])) {
        clearTimeout(this._holdTimeoutIds.get([index, page]))
        this._holdTimeoutIds.delete([index, page])
      }

      if (this._pressTimeoutIds.has([index, page])) {
        clearTimeout(this._pressTimeoutIds.get([index, page]))
        this._pressTimeoutIds.delete([index, page])
      }

      const held = this._holdStates.has([index, page])
      const pressed = this._pressStates.has([index, page])

      this._downStates.delete([index, page])
      this._holdStates.delete([index, page])
      this._pressStates.delete([index, page])

      if (typeof this.HOLD_TIME === 'number') {
        this.emit(held ? 'held' : 'click', index, page, this)
      }

      if (pressed) {
        this.draw()
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

      if (this.IDLE_TIME <= 0 || this._downStates.size) {
        return
      }

      this._idleTimeoutId = setTimeout(() => {
        this._idleTimeoutId = undefined

        this.emit('idle')
      }, this.IDLE_TIME)
    })

    listenToEvents(this, options, [
      /**
       * Focus event fired when any {@link Page} that the {@link Key} is attached to gains focus.
       *
       * @event Key#event:focus
       * @memberof Key
       *
       * @param {Page} focusPage
       * The {@link Page} that gained focus.
       *
       * @param {Page} [blurPage]
       * The {@link Page} that lost focus.
       */
      'focus',
      /**
       * Blur event fired when any {@link Page} that the {@link Key} is attached to loses focus.
       *
       * @event Key#event:blur
       * @memberof Key
       *
       * @param {Page} [focusPage]
       * The {@link Page} that gained focus.
       *
       * @param {Page} blurPage
       * The {@link Page} that lost focus.
       */
      'blur',
      /**
       * Attach event fired when the {@link Key} is attached to a {@link Page}.
       *
       * @event Key#event:attach
       * @memberof Key
       *
       * @param {number} index
       * The key slot index.
       *
       * @param {Page} page
       * The {@link Page} that the {@link Key} was attached to.
       *
       * @param {Key} key
       * The {@link Key}.
       */
      'attach',
      /**
       * Detach event fired when the {@link Key} is detached from a {@link Page}.
       *
       * @event Key#event:detach
       * @memberof Key
       *
       * @param {number} index
       * The key slot index.
       *
       * @param {Page} page
       * The {@link Page} that the {@link Key} was detached from.
       *
       * @param {Key} key
       * The {@link Key}.
       */
      'detach',
      /**
       * Down event fired when a key is pressed and a {@link Page} that the {@link Key}
       * is attached to has focus.
       *
       * @event Key#event:down
       * @memberof Key
       *
       * @param {number} index
       * The key slot index that was pressed.
       *
       * @param {Page} page
       * The {@link Page} that currently has focus.
       *
       * @param {Key} key
       * The {@link Key}.
       */
      'down',
      /**
       * Hold event fired when a key is pressed down for `{@link Key#HOLD_TIME}`
       * milliseconds. If `{@link Key#HOLD_TIME}` is `0` this event is disabled. If
       * `{@link Key#HOLD_TIME}` is undefined {@link Page#event:hold|Page#hold events} will be
       * allowed to propagate from the {@link Page} that the {@link Key} is attached to.
       *
       * @event Key#event:hold
       * @memberof Key
       *
       * @param {number} index
       * The key slot index that is being pressed.
       *
       * @param {Page} page
       * The {@link Page} that had focus when the key was initially pressed.
       *
       * @param {Key} key
       * The {@link Key}.
       */
      'hold',
      /**
       * Up event fired when a key is released and a {@link Page} that the {@link Key}
       * is attached to had focus when it was initially pressed.
       *
       * @event Key#event:up
       * @memberof Key
       *
       * @param {number} index
       * The key slot index that was released.
       *
       * @param {Page} page
       * The {@link Page} that had focus when the key was initially pressed.
       *
       * @param {Key} key
       * The {@link Key}.
       */
      'up',
      /**
       * Click event fired after the {@link Key#event:up} if the {@link Key#event:hold} had not
       * been fired.
       *
       * @event Key#event:click
       * @memberof Key
       *
       * @param {number} index
       * The key slot index that was clicked.
       *
       * @param {Page} page
       * The {@link Page} that had focus when the key was initially pressed.
       *
       * @param {Key} key
       * The {@link Key}.
       */
      'click',
      /**
       * Held event fired after the {@link Key#event:up} if the {@link Key#event:hold} had been
       * fired.
       *
       * @event Key#event:held
       * @memberof Key
       *
       * @param {number} index
       * The key slot index that was held.
       *
       * @param {Page} page
       * The {@link Page} that had focus when the key was initially pressed.
       *
       * @param {Key} key
       * The {@link Key}.
       */
      'held',
      /**
       * Activity event fired after a user interacts with the Stream Deck device's keys
       * while a {@link Page} that the {@link Key} is attached to has or gains focus.
       *
       * @event Key#event:activity
       * @memberof Key
       *
       * @param {string} event
       * The name of the event that was recognized as uer interaction.
       *
       * @param {number} [index]
       * The relevant key slot index if the event was a key related event.
       *
       * @param {Page} page
       * The relevant {@link Page} if the event was a key related event.
       *
       * @param {Key} key
       * The relevant {@link Key} if the event was a key related event.
       */
      'activity',
      /**
       * Idle event fired after `{@link Key#IDLE_TIME}` milliseconds of inactivity. If
       * `{@link Key#IDLE_TIME}` is `0` this event is disabled.
       *
       * @event Key#event:idle
       * @memberof Key
       */
      'idle',
      /**
       * Error event fired when an error occurs.
       *
       * @event Key#event:error
       * @memberof Key
       *
       * @param {*} err
       * The error that occurred.
       */
      'error',
      /**
       * Create event fired when the {@link Key} is created.
       *
       * @event Key#event:create
       * @memberof Key
       */
      'create',
      /**
       * Destroy event fired when the {@link Key} is destroyed.
       *
       * @event Key#event:destroy
       * @memberof Key
       */
      'destroy',
    ])

    this.setBackgroundImage(this._backgroundImage)
    this.setImage(this._image)
  }

  /**
   * Returns whether or not the {@link Key} is pressed down.
   *
   * @param {number} [index]
   * A key slot index. If set the {@link Key} must be pressed down at the key slot index in order to
   * return `true`.
   *
   * (Integer between `0` and `{@link Key#KEY_COUNT} - 1` inclusive.)
   *
   * @param {Page} [page]
   * A {@link Page}. If set the {@link Key} must be pressed down on the {@link Page} in order to
   * return `true`.
   *
   * @returns {boolean}
   */
  isPressed(index, page) {
    checkKeyDestroyed(this)

    checkValid(index, {
      name: 'index',
      type: 'integer',
      min: 0,
      max: this.KEY_COUNT - 1,
      allowUndefined: true,
    })

    checkValid(page, {
      name: 'page',
      type: 'class',
      class: 'Page',
      streamDeck: this.STREAMDECK,
      allowUndefined: true,
    })

    return this._pressStates.wildHas([index, page])
  }

  /**
   * Create a new {@link Image} with a width of `{@link Key#KEY_WIDTH}` and a height of
   * `{@link Key#KEY_HEIGHT}`.
   *
   * @function createBackgroundImage
   * @memberof Key
   * @instance
   *
   * @param {Image.Source} [source]
   * The sources used to create the new {@link Image}.
   *
   * @returns {Image}
   */
  createBackgroundImage(source) {
    checkKeyDestroyed(this)

    return new Image({
      source,
      width: this.KEY_WIDTH,
      height: this.KEY_HEIGHT,
    })
  }

  /**
   * Set the background image of the {@link Key}. If no image argument is passed this is the
   * same as calling {@link Key#clearBackgroundImage}.
   *
   * @function setBackgroundImage
   * @memberof Key
   * @instance
   *
   * @param {Image|Image.Source} [image]
   * The new background {@link Image}.
   */
  setBackgroundImage(image) {
    checkKeyDestroyed(this)

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
        width: this.KEY_WIDTH,
        height: this.KEY_HEIGHT,
        checkConstantKeys: true,
      })
    } catch (err) {
      image = this.createBackgroundImage(image)
    }

    if (this._image === image) {
      this._image.off('frameUpdated', this._boundDraw)
    }

    if (this._backgroundImage instanceof Image) {
      this._backgroundImage.off('frameUpdated', this._boundDraw)
    }

    this._backgroundImage = image

    this._backgroundImage.on('frameUpdated', this._boundDraw)

    this.draw()
  }

  /**
   * Clear the background image of the {@link Key}.
   *
   * @function clearBackgroundImage
   * @memberof Key
   * @instance
   */
  clearBackgroundImage() {
    checkKeyDestroyed(this)

    if (!this._backgroundImage) {
      this._backgroundImage = undefined

      return
    }

    if (this._backgroundImage !== this._image) {
      this._backgroundImage.off('frameUpdated', this._boundDraw)
    }

    this._backgroundImage = undefined
    this._backgroundFrame = undefined

    this.draw()
  }

  /**
   * Get the current frame of the background image for the {@link Key}. If no background image
   * is set or if the background image frame has not yet loaded returns `null`.
   *
   * @function getBackgroundFrame
   * @memberof Key
   * @instance
   *
   * @returns {Image.FrameData|null}
   */
  getBackgroundFrame() {
    checkKeyDestroyed(this)

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
   * Create a new {@link Image} with a width of `{@link Key#KEY_WIDTH}` and a height of
   * `{@link Key#KEY_HEIGHT}`. The newly created {@link Image} will have scaled frames if applicable.
   *
   * @function createImage
   * @memberof Key
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
   * {Default: `{@link Key#PRESS_SCALE}`}
   *
   * @return {Image}
   */
  createImage(source, options = {}) {
    checkKeyDestroyed(this)

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
   * Set the image of the {@link Key}. If no image argument is passed this is the same as calling
   * {@link Key#clearImage}.
   *
   * @function setImage
   * @memberof Key
   * @instance
   *
   * @param {Image|Image.Source} [image]
   * The new {@link Image}.
   */
  setImage(image) {
    checkKeyDestroyed(this)

    if (!image) {
      this.clearImage()

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
        width: this.KEY_WIDTH,
        height: this.KEY_HEIGHT,
        checkConstantKeys: true,
      })
    } catch (err) {
      image = this.createImage(image)
    }

    if (this._backgroundImage === image) {
      this._backgroundImage.off('frameUpdated', this._boundDraw)
    }

    if (this._image instanceof Image) {
      this._image.off('frameUpdated', this._boundDraw)
    }

    this._image = image

    this._image.on('frameUpdated', this._boundDraw)

    this.draw()
  }

  /**
   * Clear the image of the {@link Key}.
   *
   * @function clearImage
   * @memberof Key
   * @instance
   */
  clearImage() {
    checkKeyDestroyed(this)

    if (!this._image) {
      this._image = undefined

      return
    }

    if (this._image !== this._backgroundImage) {
      this._image.off('frameUpdated', this._boundDraw)
    }

    this._image = undefined
    this._frame = undefined

    this.draw()
  }

  /**
   * Get the current frame of the image for the {@link Page}. If no image is set or if the image
   * frame has not yet loaded returns `null`.
   *
   * @function getFrame
   * @memberof Key
   * @instance
   *
   * @returns {Image.FrameData|null}
   */
  getFrame() {
    checkKeyDestroyed(this)

    if (!this._image) {
      return null
    }

    let frame = this._image.getFrame()

    if (frame) {
      this._frame = frame
    }

    return this._frame ?? null
  }

  /**
   * Draw the {@link Key} to the Stream Deck's panel.
   *
   * @function draw
   * @memberof Key
   * @instance
   */
  draw() {
    if (this._destroyed) {
      return
    }

    this._graphicsQueue.push(() =>
      emitCaughtAsyncError(this, async () => {
        const page = this.STREAMDECK.focusedPage

        if (!page) {
          return
        }

        let indexes = Array.from(page.keys.entries())
          .filter(([index, key]) => key === this)
          .map(([index]) => index)

        if (!indexes.length) {
          return
        }

        let pageBackgroundFrame = page.getBackgroundFrame()
        let keyBackgroundFrame = this.getBackgroundFrame()
        let keyFrame = this.getFrame()

        await Promise.all(
          indexes.map(async (index) => {
            let keySize

            if (this.isPressed(index, page)) {
              keySize = 'scaled'
            } else {
              keySize = 'base'
            }

            if (keyFrame && !keyFrame[keySize]) {
              keySize = 'base'
            }

            if (!pageBackgroundFrame) {
              if (!keyFrame && !keyBackgroundFrame) {
                emitCaughtAsyncError(this, this.STREAMDECK_NODE.clearKey(index))

                return
              }

              if (!keyBackgroundFrame) {
                emitCaughtAsyncError(
                  this,
                  this.STREAMDECK_NODE.fillKeyBuffer(
                    index,
                    keyFrame[keySize].withoutAlpha
                  )
                )

                return
              }

              if (!keyFrame) {
                emitCaughtAsyncError(
                  this,
                  this.STREAMDECK_NODE.fillKeyBuffer(
                    index,
                    keyBackgroundFrame.base.withoutAlpha
                  )
                )

                return
              }

              emitCaughtAsyncError(
                this,
                this.STREAMDECK_NODE.fillKeyBuffer(
                  index,
                  await sharp(
                    await sharp(keyBackgroundFrame.base.withAlpha, {
                      raw: {
                        width: this.KEY_WIDTH,
                        height: this.KEY_HEIGHT,
                        channels: 4,
                      },
                    })
                      .composite([
                        {
                          input: keyFrame[keySize].withAlpha,
                          left: 0,
                          top: 0,
                          raw: {
                            width: this.KEY_WIDTH,
                            height: this.KEY_HEIGHT,
                            channels: 4,
                          },
                        },
                      ])
                      .toBuffer(),
                    {
                      raw: {
                        width: this.KEY_WIDTH,
                        height: this.KEY_HEIGHT,
                        channels: 4,
                      },
                    }
                  )
                    .flatten()
                    .toBuffer()
                )
              )

              return
            }

            if (!keyBackgroundFrame && !keyFrame) {
              emitCaughtAsyncError(
                this,
                this.STREAMDECK_NODE.fillKeyBuffer(
                  index,
                  pageBackgroundFrame.split[index].withoutAlpha
                )
              )

              return
            }

            let inputs = []

            if (keyBackgroundFrame) {
              inputs.push({
                input: keyBackgroundFrame.base.withAlpha,
                left: 0,
                top: 0,
                raw: {
                  width: this.KEY_WIDTH,
                  height: this.KEY_HEIGHT,
                  channels: 4,
                },
              })
            }

            if (keyFrame) {
              inputs.push({
                input: keyFrame[keySize].withAlpha,
                left: 0,
                top: 0,
                raw: {
                  width: this.KEY_WIDTH,
                  height: this.KEY_HEIGHT,
                  channels: 4,
                },
              })
            }

            emitCaughtAsyncError(
              this,
              this.STREAMDECK_NODE.fillKeyBuffer(
                index,
                await sharp(
                  await sharp(pageBackgroundFrame.split[index].withAlpha, {
                    raw: {
                      width: this.KEY_WIDTH,
                      height: this.KEY_HEIGHT,
                      channels: 4,
                    },
                  })
                    .composite(inputs)
                    .toBuffer(),
                  {
                    raw: {
                      width: this.KEY_WIDTH,
                      height: this.KEY_HEIGHT,
                      channels: 4,
                    },
                  }
                )
                  .flatten()
                  .toBuffer()
              )
            )
          })
        )
      })
    )
  }

  /**
   * Clean up all internal state data used by the {@link Key} in preparation for garbage
   * collection and detach from all {@link Page|Pages}.
   *
   * @function destroy
   * @memberof Key
   * @instance
   */
  destroy() {
    checkKeyDestroyed(this)

    if (this._pressTimeoutIds.size) {
      for (const pressTimeoutId of this._pressTimeoutIds.values()) {
        clearTimeout(pressTimeoutId)
      }

      this._pressTimeoutIds.clear()
    }

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

    if (this._downStates.size) {
      this._downStates.clear()
    }

    if (this._holdStates.size) {
      this._holdStates.clear()
    }

    if (this._pressStates.size) {
      this._pressStates.clear()
    }

    for (const page of this.STREAMDECK.pages.values()) {
      for (const [index, key] of page.keys.entries()) {
        if (key !== this) {
          continue
        }

        page.detachKey(index, this)
      }
    }

    this.clearImage()
    this.clearBackgroundImage()

    this._destroyed = true

    this.emit('destroy')
  }
}

function checkKeyDestroyed(_this) {
  if (_this._destroyed) {
    throw new Error(`Key has been destroyed!`)
  }
}

module.exports = Key
