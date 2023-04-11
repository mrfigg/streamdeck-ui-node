'use strict'

const EventEmitter = require('eventemitter3')
const sharp = require('sharp')

const {
  checkValid,
  definePrivateProperties,
  definePublicProperties,
  listenToEvents,
  emitCaughtAsyncError,
  parseColor,
} = require('./utils')

/**
 * An instance of {@link Image} represents an image to be displayed on a {@link Page} or {@link Key}.
 *
 * @class Image
 * @extends external:eventemitter3
 * @hideconstructor
 *
 * @example
 * const { openStreamDeck } = require('streamdeck-ui-node');
 *
 * (async () => {
 *   const streamDeck = await openStreamDeck();
 *   const page = streamDeck.createPage();
 *   const key = streamDeck.createKey();
 *
 *   let pageBackgroundImage = streamDeck.createPageBackgroundImage('path/to/image.png');
 *   pageBackgroundImage = page.createBackgroundImage('path/to/image.png');
 *
 *   let keyBackgroundImage = streamDeck.createKeyBackgroundImage('path/to/image.png');
 *   keyBackgroundImage = key.createBackgroundImage('path/to/image.png');
 *
 *   let keyImage = streamDeck.createKeyImage('path/to/image.png');
 *   keyImage = key.createImage('path/to/image.png');
 * })();
 */

/**
 * An image {@link Image.Source} can be any of the following;
 *
 * - An image file path string to be loaded by
 * {@link https://sharp.pixelplumbing.com/api-constructor#sharp|sharp - constructor}.
 * - An image Buffer to be loaded by
 * {@link https://sharp.pixelplumbing.com/api-constructor#sharp|sharp - constructor}.
 * - An existing {@link Image} instance.
 * - An Array of {@link Image.Source|Image.Sources}.
 * - An Object with the following properties, requiring at least one of the first three properties;
 *
 * @typedef {string|Buffer|Image|Object} Source
 * @memberof Image
 *
 * @property {string|Buffer|Image} [source]
 * One of the first three {@link Image.Source} types listed above.
 *
 * @property {boolean} [empty]
 * A `true` value will create a completely transparent image source. The `source` property takes
 * priority.
 *
 * @property {Image.Color} [color]
 * A {@link Image.Color} value will create a solid {@link Image.Color} image source. The `source` and
 * `empty` properties take priority.
 *
 * @property {Object} [sharpOptions]
 * Options to be passed to
 * {@link https://sharp.pixelplumbing.com/api-constructor#sharp|sharp - constructor} when loading the
 * source. Does not apply if the source is an {@link Image}.
 *
 * @property {boolean} [resize=true]
 * Whether or not the {@link Image.Source} should be resized before the compositing step of the
 * image load process.
 *
 * @property {Object} [resizeOptions]
 * Options to be passed to
 * {@link https://sharp.pixelplumbing.com/api-resize#resize|sharp - resize} during the first resizing
 * step of the image load process.
 *
 * @property {Object} [compositeOptions]
 * Options to be passed to
 * {@link https://sharp.pixelplumbing.com/api-composite#composite|sharp - composite} during the
 * compositing step of the image load process.
 */

/**
 * A {@link Image.Color} can be any of the following;
 *
 * - A color name string recognized by the {@link external:colornames} library.
 * - An rgb(a) hexadecimal color string, with or without a leading `#`.
 * (e.g. `0f0`, `0f0f`, `#00ff00`, `#00ff00ff`)
 * - An Array of numbers with a length of either `3` or `4`, each value being between `0` and `255`
 * inclusive.
 * - An Object with the following color channel properties;
 *
 * @typedef {string|Array<number>|Object} Color
 * @memberof Image
 *
 * @property {number} red
 * Red channel value between `0` and `255` inclusive.
 *
 * @property {number} green
 * Green channel value between `0` and `255` inclusive.
 *
 * @property {number} blue
 * Blue channel value between `0` and `255` inclusive.
 *
 * @property {number} [alpha]
 * Alpha channel value between `0` and `255` inclusive.
 */

/**
 * An Object containing frame data for an {@link Image}.
 *
 * @typedef {Object} FrameData
 * @memberof Image
 *
 * @property {Object} base
 * The full, unscaled frame.
 *
 * @property {Buffer} base.withAlpha
 * Image Buffer in raw rgba format.
 *
 * @property {Buffer} base.withoutAlpha
 * Image Buffer in raw rgb format.
 *
 * @property {Object} [scaled]
 * The scaled frame, only populated by {@link StreamDeck#createKeyImage} and {@link Key#createImage}
 * when `options.scaleFrames` does not equal `1`.
 *
 * @property {Buffer} scaled.withAlpha
 * Image Buffer in raw rgba format.
 *
 * @property {Buffer} scaled.withoutAlpha
 * Image Buffer in raw rgb format.
 *
 * @property {Array<Object>} [split]
 * The full frame split into smaller frames, only populated by
 * {@link StreamDeck#createPageBackgroundImage} and {@link Page#createBackgroundImage}.
 *
 * @property {Buffer} split[].withAlpha
 * Image Buffer in raw rgba format.
 *
 * @property {Buffer} split[].withoutAlpha
 * Image Buffer in raw rgb format.
 */

class Image extends EventEmitter {
  constructor(options = {}) {
    super()

    checkValid(options, {
      name: 'options',
      type: 'object',
      allowUndefined: true,
    })

    definePrivateProperties(this, options, [
      { name: 'sharp' },
      { name: 'animate' },
      { name: 'nextFrameTimeoutId' },
      { name: 'frames', value: [] },
      { name: 'frameDelays', value: [] },
    ])

    definePublicProperties(this, options, [
      /**
       * The width of the {@link Image} in pixels.
       *
       * @member {number} WIDTH
       * @memberof Image
       * @instance
       * @constant
       */
      { name: 'WIDTH', type: 'integer', min: 1 },
      /**
       * The height of the {@link Image} in pixels.
       *
       * @member {number} HEIGHT
       * @memberof Image
       * @instance
       * @constant
       */
      { name: 'HEIGHT', type: 'integer', min: 1 },
      /**
       * An object describing the dimensions used to generate split frames.
       *
       * @member {Object|undefined} SPLIT_FRAMES
       * @memberof Image
       * @instance
       * @constant
       *
       * @property {number} width
       * The width in pixels.
       *
       * @property {number} height
       * The height in pixels.
       */
      {
        name: 'SPLIT_FRAMES',
        type: 'dimensions',
        allowUndefined: true,
        get: () => {
          if (this._SPLIT_FRAMES === undefined) {
            return
          }

          return { ...this._SPLIT_FRAMES }
        },
      },
      /**
       * The scale used to generate scaled frames.
       *
       * @member {number|undefined} SCALE_FRAMES
       * @memberof Image
       * @instance
       * @constant
       */
      {
        name: 'SCALE_FRAMES',
        type: 'number',
        min: 0,
        max: 2,
        allowUndefined: true,
      },
      /**
       * The {@link Image.Source} used to create the {@link Image}.
       *
       * @member {Image.Source|undefined} SOURCE
       * @memberof Image
       * @instance
       * @constant
       */
      {
        name: 'SOURCE',
        type: 'source',
        allowUndefined: true,
      },
      /**
       * An object populated with metadata generated by {@link external:sharp}.
       *
       * See {@link https://sharp.pixelplumbing.com/api-input#metadata|sharp - metadata}.
       *
       * @member {Object} metadata
       * @memberof Image
       * @instance
       * @readonly
       */
      { name: 'metadata', value: {}, get: () => ({ ...this._metadata }) },
      /**
       * The number of frames in the {@link Image}.
       *
       * @member {number} frameCount
       * @memberof Image
       * @instance
       * @readonly
       */
      { name: 'frameCount', value: 1 },
      /**
       * The index of the current frame in the {@link Image}.
       *
       * @member {number} currentFrame
       * @memberof Image
       * @instance
       * @readonly
       */
      { name: 'currentFrame', value: 0 },
      /**
       * The number of times the {@link Image} loops.
       *
       * @member {number} loopCount
       * @memberof Image
       * @instance
       * @readonly
       */
      { name: 'loopCount', value: 0 },
      /**
       * The current loop number of the {@link Image}.
       *
       * @member {number} currentLoop
       * @memberof Image
       * @instance
       * @readonly
       */
      { name: 'currentLoop', value: 0 },
      /**
       * The number of milliseconds the {@link Image} took to load.
       *
       * @member {number|undefined} loadTime
       * @memberof Image
       * @instance
       * @readonly
       */
      { name: 'loadTime' },
      /**
       * Whether or not the {@link Image} has been destroyed.
       *
       * @member {boolean} destroyed
       * @memberof Image
       * @instance
       * @readonly
       */
      { name: 'destroyed', value: false },
    ])

    listenToEvents(this, options, [
      /**
       * Sharp loaded event fired after sources have been loaded and composited
       * into the {@link external:sharp} instance.
       *
       * @event Image#event:sharpLoaded
       * @memberof Image
       */
      'sharpLoaded',
      /**
       * Frame loaded event fired after each frame is loaded.
       *
       * @event Image#event:frameLoaded
       * @memberof Image
       *
       * @param {number} index
       * The index of the loaded frame.
       */
      'frameLoaded',
      /**
       * Image loaded event fired after the final frame is loaded.
       *
       * @event Image#event:imageLoaded
       * @memberof Image
       *
       * @param {number} loadTime
       * The number of milliseconds the {@link Image} took to load.
       */
      'imageLoaded',
      /**
       * Frame updated event fired when `{@link Image#currentFrame}` has changed.
       *
       * @event Image#event:frameUpdated
       * @memberof Image
       */
      'frameUpdated',
      /**
       * Error event fired when an error occurs.
       *
       * @event Image#event:error
       * @memberof Image
       *
       * @param {*} err
       * The error that occurred.
       */
      'error',
      /**
       * Destroy event fired when the {@link Image} is destroyed.
       *
       * @event Image#event:destroy
       * @memberof Image
       */
      'destroy',
    ])

    process.nextTick(() => emitCaughtAsyncError(this, loadImage(this)))
  }

  on(...args) {
    checkImageDestroyed(this)

    super.on.apply(this, args)

    manageNextFrameTimeout(this)

    return this
  }

  once(...args) {
    checkImageDestroyed(this)

    super.once.apply(this, args)

    manageNextFrameTimeout(this)

    return this
  }

  addListener(...args) {
    checkImageDestroyed(this)

    super.addListener.apply(this, args)

    manageNextFrameTimeout(this)

    return this
  }

  off(...args) {
    super.off.apply(this, args)

    manageNextFrameTimeout(this)

    return this
  }

  removeListener(...args) {
    super.removeListener.apply(this, args)

    manageNextFrameTimeout(this)

    return this
  }

  removeAllListeners(...args) {
    super.removeAllListeners.apply(this, args)

    manageNextFrameTimeout(this)

    return this
  }

  /**
   * Get a clone of the {@link external:sharp} instance of the {@link Image}.
   *
   * @function sharp
   * @memberof Image
   * @instance
   *
   * @returns {Promise<external:sharp>}
   */
  sharp() {
    checkImageDestroyed(this)

    if (this._sharp) {
      return this._sharp.clone()
    }

    return new Promise((resolve, reject) => {
      let done = false

      let resolveListener
      let rejectListener

      resolveListener = () => {
        if (!this._sharp || done) {
          return
        }

        done = true

        this.off('sharpLoaded', resolveListener)
        this.off('destroy', rejectListener)

        try {
          resolve(this._sharp.clone())
        } catch (err) {
          reject(err)
        }
      }

      rejectListener = () => {
        done = true

        this.off('sharpLoaded', resolveListener)
        this.off('destroy', rejectListener)

        reject(new Error(`Image was destroyed!`))
      }

      this.on('sharpLoaded', resolveListener)
      this.on('destroy', rejectListener)
    })
  }

  /**
   * Get the {@link Image.FrameData} of the current image frame. If the current frame has not
   * yet loaded returns `null`.
   *
   * @function getFrame
   * @memberof Image
   * @instance
   *
   * @returns {Image.FrameData|null}
   */
  getFrame() {
    checkImageDestroyed(this)

    if (!this._frames[this._currentFrame] && this._frames.length) {
      return this._frames[this._frames.length - 1] ?? null
    }

    return this._frames[this._currentFrame] ?? null
  }

  /**
   * Starts the {@link Image|Image's} animation if `{@link Image#frameCount}` is greater than
   * `1`, otherwise this is a no-op.
   *
   * @function startAnimation
   * @memberof Image
   * @instance
   */
  startAnimation() {
    checkImageDestroyed(this)

    if (this._frameCount <= 1) {
      return
    }

    this._animate = true

    if (!this.listenerCount('frameUpdated')) {
      return
    }

    if (this._nextFrameTimeoutId === undefined) {
      this._nextFrameTimeoutId = setTimeout(
        () => this.nextFrame(),
        this._frameDelays[this._currentFrame]
      )
    }
  }

  /**
   * Stops the {@link Image|Image's} animation if `{@link Image#frameCount}` is greater than
   * `1`, otherwise this is a no-op.
   *
   * @function stopAnimation
   * @memberof Image
   * @instance
   */
  stopAnimation() {
    if (this._destroyed) {
      return
    }

    if (this._nextFrameTimeoutId !== undefined) {
      clearTimeout(this._nextFrameTimeoutId)
      this._nextFrameTimeoutId = undefined
    }

    this._animate = false
  }

  /**
   * Progresses the {@link Image|Image's} animation `1` frame, skipping the delay, if
   * `{@link Image#frameCount}` is greater than `1`, otherwise this is a no-op.
   *
   * @function nextFrame
   * @memberof Image
   * @instance
   */
  nextFrame() {
    if (this._destroyed) {
      return
    }

    if (this._frameCount <= 1) {
      return
    }

    if (this._nextFrameTimeoutId !== undefined) {
      clearTimeout(this._nextFrameTimeoutId)
      this._nextFrameTimeoutId = undefined
    }

    let nextFrame = this._currentFrame + 1
    let nextLoop = this._currentLoop

    if (nextFrame >= this._frameCount) {
      if (this._loopCount > 0 && nextLoop >= this._loopCount) {
        this._animate = false

        return
      }

      nextFrame = 0
      nextLoop = nextLoop + 1
    }

    if (this._frames.length > nextFrame) {
      this._currentFrame = nextFrame
      this._currentLoop = nextLoop

      this.emit('frameUpdated')

      if (!this._animate) {
        return
      }

      if (!this.listenerCount('frameUpdated')) {
        return
      }

      this._nextFrameTimeoutId = setTimeout(
        () => this.nextFrame(),
        this._frameDelays[this._currentFrame]
      )

      return
    }

    let loadListener = (frameLoaded) => {
      if (frameLoaded < nextFrame) {
        return
      }

      this.off('frameLoaded', loadListener)

      this._currentFrame = nextFrame
      this._currentLoop = nextLoop

      this.emit('frameUpdated')

      if (!this._animate) {
        return
      }

      if (!this.listenerCount('frameUpdated')) {
        return
      }

      if (this._nextFrameTimeoutId !== undefined) {
        clearTimeout(this._nextFrameTimeoutId)
        this._nextFrameTimeoutId = undefined
      }

      this._nextFrameTimeoutId = setTimeout(
        () => this.nextFrame(),
        this._frameDelays[this._currentFrame]
      )
    }

    this.on('frameLoaded', loadListener)
  }

  /**
   * Set the `{@link Image#currentFrame}` of the {@link Image}.
   *
   * @function setCurrentFrame
   * @memberof Image
   * @instance
   *
   * @param {number} currentFrame
   * The index of the target frame.
   *
   * (Integer between `0` and `{@link Image#frameCount} - 1` inclusive.)
   */
  setCurrentFrame(currentFrame) {
    checkImageDestroyed(this)

    if (this._frameCount <= 1) {
      throw new Error(`Image does not have multiple frames`)
    }

    checkValid(currentFrame, {
      name: 'currentFrame',
      type: 'integer',
      min: 0,
      max: this._frameCount - 1,
    })

    if (this._nextFrameTimeoutId !== undefined) {
      clearTimeout(this._nextFrameTimeoutId)
      this._nextFrameTimeoutId = undefined
    }

    this._currentFrame = currentFrame

    this.emit('frameUpdated')

    if (!this._animate) {
      return
    }

    if (!this.listenerCount('frameUpdated')) {
      return
    }

    this._nextFrameTimeoutId = setTimeout(
      () => this.nextFrame(),
      this._frameDelays[this._currentFrame]
    )
  }

  /**
   * Reset the {@link Image|Image's} `{@link Image#currentFrame}` and `{@link Image#currentLoop}`
   * if `{@link Image#frameCount}` is greater than `1`, otherwise this is a no-op.
   *
   * @function resetAnimation
   * @memberof Image
   * @instance
   */
  resetAnimation() {
    checkImageDestroyed(this)

    if (this._frameCount <= 1) {
      return
    }

    if (this._nextFrameTimeoutId !== undefined) {
      clearTimeout(this._nextFrameTimeoutId)
      this._nextFrameTimeoutId = undefined
    }

    this._currentFrame = 0
    this._currentLoop = 0

    this.emit('frameUpdated')

    if (!this._animate) {
      return
    }

    if (!this.listenerCount('frameUpdated')) {
      return
    }

    this._nextFrameTimeoutId = setTimeout(
      () => this.nextFrame(),
      this._frameDelays[this._currentFrame]
    )
  }

  /**
   * Clean up all internal state data used by the {@link Image} in preparation for garbage
   * collection.
   *
   * @function destroy
   * @memberof Image
   * @instance
   */
  destroy() {
    checkImageDestroyed(this)

    this.stopAnimation()

    this.removeAllListeners('frameUpdated')

    this._destroyed = true

    this.emit('destroy')
  }
}

function checkImageDestroyed(_this) {
  if (_this._destroyed) {
    throw new Error(`Image has been destroyed!`)
  }
}

function manageNextFrameTimeout(_this) {
  if (!_this.listenerCount('frameUpdated')) {
    if (_this._nextFrameTimeoutId !== undefined) {
      clearTimeout(_this._nextFrameTimeoutId)
      _this._nextFrameTimeoutId = undefined
    }

    return
  }

  if (!_this._animate) {
    return
  }

  if (_this._nextFrameTimeoutId === undefined) {
    _this._nextFrameTimeoutId = setTimeout(
      () => _this.nextFrame(),
      _this._frameDelays[_this._currentFrame]
    )
  }
}

async function loadImage(_this) {
  let start = Date.now()

  // Parse sources
  let sourcesData = _this.SOURCE

  if (!Array.isArray(sourcesData)) {
    sourcesData = sourcesData ? [sourcesData] : []
  }

  sourcesData = sourcesData.flat(Infinity)

  sourcesData = await Promise.all(
    sourcesData.map(async (sourceData) => {
      if (
        typeof sourceData === 'string' ||
        Buffer.isBuffer(sourceData) ||
        sourceData instanceof Image
      ) {
        sourceData = { source: sourceData }
      }

      sourceData = { ...sourceData }

      // File string of Buffer
      if (
        typeof sourceData.source === 'string' ||
        Buffer.isBuffer(sourceData.source)
      ) {
        let sharpOptions = { pages: -1 }

        if (typeof sourceData.sharpOptions === 'object') {
          sharpOptions = { ...sharpOptions, ...sourceData.sharpOptions }
        }

        try {
          sourceData.source = await sharp(sourceData.source, sharpOptions)
          sourceData.metadata = await sourceData.source.metadata()

          return sourceData
        } catch (err) {
          _this.emit('error', err)

          return null
        }
      }

      // Image
      if (sourceData.source instanceof Image) {
        try {
          sourceData.source = await sourceData.source.sharp()
          sourceData.metadata = await sourceData.source.metadata()

          return sourceData
        } catch (err) {
          _this.emit('error', err)

          return null
        }
      }

      // Empty
      if (sourceData.empty !== undefined) {
        sourceData.color = {
          red: 0,
          green: 0,
          blue: 0,
          alpha: 0,
        }

        delete sourceData.empty
      }

      // Color
      if (sourceData.color) {
        try {
          sourceData.color = parseColor(sourceData.color, {
            shortNames: true,
          })

          sourceData.color.alpha = sourceData.color.alpha / 255

          let sharpCreate = {
            create: {
              width: _this.WIDTH,
              height: _this.HEIGHT,
              channels: 4,
              background: sourceData.color,
            },
          }

          if (typeof sourceData.sharpOptions === 'object') {
            sharpCreate = { ...sharpCreate, ...sourceData.sharpOptions }
          }

          sourceData.source = await sharp(sharpCreate).raw()

          sourceData.metadata = await sourceData.source.metadata()

          delete sourceData.color

          return sourceData
        } catch (err) {
          _this.emit('error', err)

          return null
        }
      }

      _this.emit('error', new Error('Unrecognized Image source!'))

      return null
    })
  )

  sourcesData = sourcesData.filter((sourceData) => sourceData)

  // Resize sources
  sourcesData = await Promise.all(
    sourcesData.map(async (sourceData) => {
      if (sourceData.resize === false) {
        return sourceData
      }

      if (
        typeof sourceData.resizeOptions !== 'object' &&
        sourceData.metadata.width === _this.WIDTH &&
        sourceData.metadata.height === _this.HEIGHT
      ) {
        return sourceData
      }

      try {
        let resizeOptions = { width: _this.WIDTH, height: _this.HEIGHT }

        if (typeof sourceData.resizeOptions === 'object') {
          resizeOptions = { ...resizeOptions, ...sourceData.resizeOptions }
        }

        let sharpOptions = { pages: -1 }

        if (sourceData.metadata.format === 'raw') {
          sharpOptions.raw = {
            width: resizeOptions.width,
            height: resizeOptions.height,
            channels: sourceData.metadata.channels,
          }
        }

        sourceData.source = await sharp(
          await sourceData.source.clone().resize(resizeOptions).toBuffer(),
          sharpOptions
        )
        sourceData.metadata = await sourceData.source.metadata()

        return sourceData
      } catch (err) {
        _this.emit('error', err)

        return null
      }
    })
  )

  sourcesData = sourcesData.filter((sourceData) => sourceData)

  // Make sure at least one source exists
  if (!sourcesData.length) {
    let sourceData = {}

    sourceData.source = await sharp({
      create: {
        width: _this.WIDTH,
        height: _this.HEIGHT,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).raw()
    sourceData.metadata = await sourceData.source.metadata()

    sourcesData.push(sourceData)
  }

  let { source: image, metadata } = sourcesData[0]

  // Composite
  if (sourcesData.length > 1) {
    let inputs = await Promise.all(
      sourcesData.slice(1).map(async (sourceData) => {
        let compositeOptions = {}

        if (sourceData.metadata.format === 'raw') {
          compositeOptions.raw = {
            width: sourceData.metadata.width,
            height: sourceData.metadata.height,
            channels: sourceData.metadata.channels,
          }
        }

        if (typeof sourceData.compositeOptions === 'object') {
          compositeOptions = {
            ...compositeOptions,
            ...sourceData.compositeOptions,
          }
        }

        compositeOptions.input = await sourceData.source.toBuffer()

        return compositeOptions
      })
    )

    let sharpOptions = { pages: -1 }

    if (metadata.format === 'raw') {
      sharpOptions.raw = {
        width: metadata.width,
        height: metadata.height,
        channels: metadata.channels,
      }
    }

    image = await sharp(
      await image.clone().composite(inputs).toBuffer(),
      sharpOptions
    )
    metadata = await image.metadata()
  }

  // Resize
  if (metadata.width !== _this.WIDTH || metadata.height !== _this.HEIGHT) {
    let sharpOptions = { pages: -1 }

    if (metadata.format === 'raw') {
      sharpOptions.raw = {
        width: _this.WIDTH,
        height: _this.HEIGHT,
        channels: metadata.channels,
      }
    }

    image = await sharp(
      await image.resize(_this.WIDTH, _this.HEIGHT).toBuffer(),
      sharpOptions
    )
    metadata = await image.metadata()
  }

  _this._sharp = image
  _this._metadata = metadata

  _this.emit('sharpLoaded')

  // Extract frames
  _this._frameCount = metadata.pages || 1
  _this._loopCount = metadata.loop || 0
  _this._frameDelays = (metadata.delay || []).slice()

  let frameWidth = metadata.width || _this.WIDTH
  let frameHeight = metadata.pageHeight || metadata.height || _this.HEIGHT

  let frameSheet = await sharp(
    await image.clone().png().ensureAlpha().toBuffer()
  )

  for (let i = 0; i < _this._frameCount; i++) {
    let frame = {}

    frame.base = {}

    frame.base.withAlpha = await sharp(
      await frameSheet
        .clone()
        .extract({
          left: 0,
          top: i * frameHeight,
          width: frameWidth,
          height: frameHeight,
        })
        .toBuffer()
    )

    frame.base.withoutAlpha = await sharp(
      await frame.base.withAlpha.clone().flatten().toBuffer()
    )

    // Scale frames
    if (typeof _this.SCALE_FRAMES === 'number' && _this.SCALE_FRAMES !== 1) {
      let scaledWidth = Math.max(1, Math.floor(frameWidth * _this.SCALE_FRAMES))
      let scaledHeight = Math.max(
        1,
        Math.floor(frameHeight * _this.SCALE_FRAMES)
      )

      frame.scaled = {}

      frame.scaled.withAlpha = await sharp(
        await frame.base.withAlpha
          .clone()
          .resize(scaledWidth, scaledHeight)
          .toBuffer()
      )

      if (_this.SCALE_FRAMES < 1) {
        frame.scaled.withAlpha = await sharp(
          await frame.scaled.withAlpha
            .resize(frameWidth, frameHeight, {
              fit: 'contain',
              withoutEnlargement: true,
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .toBuffer()
        )
      } else {
        frame.scaled.withAlpha = await sharp(
          await frame.scaled.withAlpha
            .extract({
              left: Math.floor(scaledWidth / 2 - frameWidth / 2),
              top: Math.floor(scaledHeight / 2 - frameHeight / 2),
              width: frameWidth,
              height: frameHeight,
            })
            .toBuffer()
        )
      }

      frame.scaled.withoutAlpha = await sharp(
        await frame.scaled.withAlpha.clone().flatten().toBuffer()
      )
    }

    // Split frames
    if (_this.SPLIT_FRAMES) {
      let splitWidth = Math.max(1, Math.floor(_this.SPLIT_FRAMES.width))
      let splitHeight = Math.max(1, Math.floor(_this.SPLIT_FRAMES.height))

      frame.split = []

      for (let y = 0; y < frameHeight; y += splitHeight) {
        for (let x = 0; x < frameWidth; x += splitWidth) {
          let split = {}

          split.withAlpha = await sharp(
            await frame.base.withAlpha
              .clone()
              .extract({
                left: x,
                top: y,
                width: splitWidth,
                height: splitHeight,
              })
              .toBuffer()
          )

          split.withoutAlpha = await sharp(
            await split.withAlpha.clone().flatten().toBuffer()
          )

          frame.split.push(split)
        }
      }
    }

    // Raw frame buffers
    frame.base.withAlpha = await frame.base.withAlpha.raw().toBuffer()
    frame.base.withoutAlpha = await frame.base.withoutAlpha.raw().toBuffer()

    if (frame.scaled) {
      frame.scaled.withAlpha = await frame.scaled.withAlpha.raw().toBuffer()
      frame.scaled.withoutAlpha = await frame.scaled.withoutAlpha
        .raw()
        .toBuffer()
    }

    if (frame.split) {
      await Promise.all(
        frame.split.map(async (split) => {
          split.withAlpha = await split.withAlpha.raw().toBuffer()
          split.withoutAlpha = await split.withoutAlpha.raw().toBuffer()
        })
      )
    }

    _this._frames.push(frame)

    _this.emit('frameLoaded', i)

    if (i === _this._currentFrame) {
      _this.emit('frameUpdated')
    }

    if (
      i === 0 &&
      _this._frameCount > 1 &&
      _this._animate === undefined &&
      !_this._destroyed
    ) {
      _this.startAnimation()
    }
  }

  _this._loadTime = Date.now() - start
  _this.emit('imageLoaded', _this._loadTime)
}

module.exports = Image
