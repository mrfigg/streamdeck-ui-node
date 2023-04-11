'use strict'

const colorNames = require('colornames')

const registeredClasses = {}

function registerClass(name, clazz) {
  if (registeredClasses[name] !== undefined) {
    throw new Error(`Duplicate class definition ${name}`)
  }

  registeredClasses[name] = clazz
}

function checkValid(value, options = {}) {
  if (options.allowUndefined && value === undefined) {
    return
  }

  const typeMap = {
    any: checkValidAny,
    boolean: checkValidBoolean,
    number: checkValidNumber,
    integer: checkValidInteger,
    string: checkValidString,
    object: checkValidObject,
    array: checkValidArray,
    buffer: checkValidBuffer,
    class: checkValidClass,
    dimensions: checkValidDimensions,
    color: checkValidColor,
    source: checkValidSource,
  }

  const validateFunc = typeMap[options.type]

  if (!validateFunc) {
    throw new Error(`Invalid type definition: ${options.type}`)
  }

  validateFunc(value, options)

  return value
}

function checkValidAny(value, options = {}) {
  const { name = 'value' } = options

  if (value === undefined) {
    throw new TypeError(`Expected ${name} to be defined`)
  }
}

function checkValidBoolean(value, options = {}) {
  const { allowUndefined = false, name = 'value' } = options

  if (typeof value !== 'boolean') {
    throw new TypeError(
      `Expected ${name} to be a boolean${
        !allowUndefined ? `` : ` or undefined`
      }`
    )
  }
}

function checkValidNumber(value, options = {}) {
  const {
    allowUndefined = false,
    name = 'value',
    validValues,
    min,
    max,
  } = options

  if (typeof value !== 'number') {
    throw new TypeError(
      `Expected ${name} to be a number${!allowUndefined ? `` : ` or undefined`}`
    )
  }

  if (Array.isArray(validValues) && !validValues.includes(value)) {
    throw new TypeError(
      `Expected ${name} to be one of: ${validValues.join(', ')}`
    )
  }

  if (
    typeof min === 'number' &&
    typeof max === 'number' &&
    (value < min || value > max)
  ) {
    throw new RangeError(
      `Expected ${name} to be between ${min} and ${max} inclusive`
    )
  }

  if (typeof min === 'number' && value < min) {
    throw new RangeError(
      `Expected ${name} to be equal to or greater than ${min}`
    )
  }

  if (typeof max === 'number' && value > max) {
    throw new RangeError(`Expected ${name} to be equal to or less than ${max}`)
  }
}

function checkValidInteger(value, options = {}) {
  const {
    allowUndefined = false,
    name = 'value',
    validValues,
    min,
    max,
  } = options

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new TypeError(
      `Expected ${name} to be an integer${
        !allowUndefined ? `` : ` or undefined`
      }`
    )
  }

  if (Array.isArray(validValues) && !validValues.includes(value)) {
    throw new TypeError(
      `Expected ${name} to be one of: ${validValues.join(', ')}`
    )
  }

  if (
    typeof min === 'number' &&
    typeof max === 'number' &&
    (value < min || value > max)
  ) {
    throw new RangeError(
      `Expected ${name} to be between ${min} and ${max} inclusive`
    )
  }

  if (typeof min === 'number' && value < min) {
    throw new RangeError(
      `Expected ${name} to be equal to or greater than ${min}`
    )
  }

  if (typeof max === 'number' && value > max) {
    throw new RangeError(`Expected ${name} to be equal to or less than ${max}`)
  }
}

function checkValidString(value, options = {}) {
  const {
    allowUndefined = false,
    name = 'value',
    validValues,
    length,
    minLength,
    maxLength,
  } = options

  if (typeof value !== 'string') {
    throw new TypeError(
      `Expected ${name} to be a string${!allowUndefined ? `` : ` or undefined`}`
    )
  }

  if (Array.isArray(validValues) && !validValues.includes(value)) {
    throw new TypeError(
      `Expected ${name} to be one of: ${validValues.join(', ')}`
    )
  }

  if (typeof length === 'number' && value.length !== length) {
    throw new RangeError(`Expected ${name} length to be ${length}`)
  }

  if (
    typeof minLength === 'number' &&
    typeof maxLength === 'number' &&
    (value.length < minLength || value.length > maxLength)
  ) {
    throw new RangeError(
      `Expected ${name} length to be between ${minLength} and ${maxLength} inclusive`
    )
  }

  if (typeof minLength === 'number' && value.length < minLength) {
    throw new RangeError(
      `Expected ${name} length to be equal to or greater than ${minLength}`
    )
  }

  if (typeof maxLength === 'number' && value.length > maxLength) {
    throw new RangeError(
      `Expected ${name} length to be equal to or less than ${maxLength}`
    )
  }
}

function checkValidObject(value, options = {}) {
  const { allowUndefined = false, name = 'value', checkProps } = options

  if (typeof value !== 'object') {
    throw new TypeError(
      `Expected ${name} to be an Object${
        !allowUndefined ? `` : ` or undefined`
      }`
    )
  }

  if (Array.isArray(checkProps)) {
    for (const propOptions of checkProps) {
      checkValid(value[propOptions.name], {
        ...propOptions,
        name: `${name}.${propOptions.name}`,
      })
    }
  }
}

function checkValidArray(value, options = {}) {
  const {
    allowUndefined = false,
    name = 'value',
    length,
    minLength,
    maxLength,
    checkValues,
    checkAllValues,
  } = options

  if (!Array.isArray(value)) {
    throw new TypeError(
      `Expected ${name} to be an Array${!allowUndefined ? `` : ` or undefined`}`
    )
  }

  if (typeof length === 'number' && value.length !== length) {
    throw new RangeError(`Expected ${name} length to be ${length}`)
  }

  if (
    typeof minLength === 'number' &&
    typeof maxLength === 'number' &&
    (value.length < minLength || value.length > maxLength)
  ) {
    throw new RangeError(
      `Expected ${name} length to be between ${minLength} and ${maxLength} inclusive`
    )
  }

  if (typeof minLength === 'number' && value.length < minLength) {
    throw new RangeError(
      `Expected ${name} length to be equal to or greater than ${minLength}`
    )
  }

  if (typeof maxLength === 'number' && value.length > maxLength) {
    throw new RangeError(
      `Expected ${name} length to be equal to or less than ${maxLength}`
    )
  }

  if (Array.isArray(checkValues)) {
    for (const [i, valueOptions] of checkValues.entries()) {
      checkValid(value[i], { ...valueOptions, name: `${name}[${i}]` })
    }
  }

  if (typeof checkAllValues === 'object') {
    let valueOptions = checkAllValues

    for (const [i, arrValue] of value.entries()) {
      checkValid(arrValue, { ...valueOptions, name: `${name}[${i}]` })
    }
  }
}

function checkValidBuffer(value, options = {}) {
  const { allowUndefined = false, name = 'value', length } = options

  if (!Buffer.isBuffer(value)) {
    throw new TypeError(
      `Expected ${name} to be a Buffer${!allowUndefined ? `` : ` or undefined`}`
    )
  }

  if (typeof length === 'number' && value.length !== length) {
    throw new RangeError(
      `Expected ${name} of length ${length}, got length ${value.length}`
    )
  }
}

function checkValidClass(value, options = {}) {
  const {
    allowUndefined = false,
    name = 'value',
    streamDeck,
    allowDestroyed,
  } = options

  let { class: clazz } = options

  if (typeof clazz === 'string') {
    clazz = registeredClasses[clazz]
  }

  if (typeof clazz !== 'function') {
    throw new Error(`Invalid class definition: ${clazz}`)
  }

  if (!(value instanceof clazz)) {
    throw new TypeError(
      `Expected ${name} to be an instance of ${clazz.name}${
        !allowUndefined ? `` : ` or undefined`
      }`
    )
  }

  if (streamDeck !== undefined && value.STREAMDECK !== streamDeck) {
    throw new TypeError(`Expected ${name}.STREAMDECK to match StreamDeck`)
  }

  if (!allowDestroyed && value.destroyed) {
    throw new TypeError(`${clazz.name} ${name} has been destroyed`)
  }
}

function checkValidDimensions(value, options = {}) {
  const {
    allowUndefined = false,
    name = 'value',
    width,
    height,
    checkConstantKeys = false,
  } = options

  let widthKey = checkConstantKeys ? 'WIDTH' : 'width'
  let heightKey = checkConstantKeys ? 'HEIGHT' : 'height'

  if (typeof value !== 'object') {
    throw new TypeError(
      `Expected ${name} to be an Object${
        !allowUndefined ? `` : ` or undefined`
      }`
    )
  }

  if (
    typeof value[widthKey] !== 'number' ||
    !Number.isInteger(value[widthKey])
  ) {
    throw new TypeError(`Expected ${name}.${widthKey} to be an integer`)
  }

  if (value[widthKey] < 1) {
    throw new RangeError(
      `Expected ${name}.${widthKey} to be equal to or greater than 1`
    )
  }

  if (typeof width === 'number' && value[widthKey] !== width) {
    throw new TypeError(`Expected ${name}.${widthKey} to be ${width}`)
  }

  if (
    typeof value[heightKey] !== 'number' ||
    !Number.isInteger(value[heightKey])
  ) {
    throw new TypeError(`Expected ${name}.${heightKey} to be an integer`)
  }

  if (value[heightKey] < 1) {
    throw new RangeError(
      `Expected ${name}.${heightKey} to be equal to or greater than 1`
    )
  }

  if (typeof height === 'number' && value[heightKey] !== height) {
    throw new TypeError(`Expected ${name}.${heightKey} to be ${height}`)
  }
}

function checkValidColor(value, options = {}) {
  const { allowUndefined = false, name = 'value' } = options

  if (
    (typeof value !== 'string' ||
      (!/^#?(?=(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$)(?<red>(?<=^#?)(?:[0-9a-f](?=[0-9a-f]{2,3}$)|[0-9a-f]{2}(?=[0-9a-f]{4}$)|[0-9a-f]{2}(?=[0-9a-f]{6}$)))(?<green>(?:(?<=^#?[0-9a-f])[0-9a-f](?=[0-9a-f]{1,2}$)|(?<=^#?[0-9a-f]{2})[0-9a-f]{2}(?=[0-9a-f]{2}$)|(?<=^#?[0-9a-f]{2})[0-9a-f]{2}(?=[0-9a-f]{4}$)))(?<blue>(?:(?<=^#?[0-9a-f]{2})[0-9a-f](?=[0-9a-f]$|$)|(?<=^#?[0-9a-f]{4})[0-9a-f]{2}(?=[0-9a-f]{2}$|$)))(?<alpha>(?:(?<=^#?[0-9a-f]{3})[0-9a-f]$|(?<=^#?[0-9a-f]{6})[0-9a-f]{2}$))?$/i.test(
        value
      ) &&
        !colorNames(value))) &&
    (!Array.isArray(value) ||
      value.length < 3 ||
      value.length > 4 ||
      !value.every(
        (arrVal) => typeof arrVal === 'number' && arrVal >= 0 && arrVal <= 255
      )) &&
    (typeof value !== 'object' ||
      !['red', 'green', 'blue', 'alpha'].every((key) => {
        if (key === 'alpha' && value[key] === undefined) {
          return true
        }

        return (
          typeof value[key] === 'number' && value[key] >= 0 && value[key] <= 255
        )
      }))
  ) {
    throw new TypeError(
      `Expected ${name} to be a hex color code string, an Array with color values,${
        allowUndefined ? `` : ` or`
      } an Object with color properties${
        !allowUndefined ? `` : `, or undefined`
      }`
    )
  }
}

function checkValidSource(value, options = {}) {
  const { allowUndefined = false, name = 'value' } = options

  if (Array.isArray(value)) {
    for (const [i, arrValue] of value.entries()) {
      checkValid(arrValue, { name: `${name}[${i}]`, type: 'source' })
    }

    return
  }

  if (typeof value === 'string') {
    return
  }

  if (Buffer.isBuffer(value)) {
    return
  }

  try {
    checkValid(value, {
      name,
      type: 'class',
      class: 'Image',
      allowDestroyed: true,
    })

    return
  } catch (err) {
    // do nothing,
  }

  if (typeof value !== 'object' || value === null) {
    throw new TypeError(
      `Expected ${name} to be a valid image source${
        !allowUndefined ? `` : ` or undefined`
      }`
    )
  }

  let sourceDefined = false

  if (typeof value.source === 'string') {
    sourceDefined = true
  }

  if (!sourceDefined && Buffer.isBuffer(value.source)) {
    sourceDefined = true
  }

  if (!sourceDefined) {
    try {
      checkValid(value.source, {
        name: `${name}.source`,
        type: 'class',
        class: 'Image',
        allowDestroyed: true,
      })

      sourceDefined = true
    } catch (err) {
      // do nothing
    }
  }

  if (!sourceDefined && value.empty === true) {
    sourceDefined = true
  }

  if (!sourceDefined) {
    try {
      checkValid(value.color, {
        name: `${name}.color`,
        type: 'color',
        allowUndefined: true,
      })

      sourceDefined = true
    } catch (err) {
      // do nothing
    }
  }

  if (!sourceDefined) {
    throw new TypeError(
      `Expected ${name}.source to be a valid image source, ${name}.empty to be 'true', or ${name}.color to be a valid color`
    )
  }

  checkValid(value, {
    name,
    type: 'object',
    checkProps: [
      {
        name: 'sharpOptions',
        type: 'object',
        allowUndefined: true,
      },
      {
        name: 'resize',
        type: 'boolean',
        allowUndefined: true,
      },
      {
        name: 'resizeOptions',
        type: 'object',
        allowUndefined: true,
      },
      {
        name: 'compositeOptions',
        type: 'object',
        allowUndefined: true,
      },
    ],
  })
}

function definePrivateProperties(_this, values = {}, propsArray = []) {
  for (const propOptions of propsArray) {
    let { name, value, valueName, type } = propOptions

    if (type !== undefined) {
      if (valueName === undefined) {
        valueName = name
      }

      if (/^[A-Z0-9_]$/.test(valueName)) {
        valueName = valueName
          .toLowerCase()
          .replace(/([^a-z]|^)([a-z])(?=[a-z]{2})/g, function (_, g1, g2) {
            return g1 + g2.toUpperCase()
          })
      }

      checkValid(values[valueName], {
        ...propOptions,
        name: `options.${valueName}`,
      })

      if (values[valueName] !== undefined) {
        value = values[valueName]
      }
    }

    _this[`_${name}`] = value
  }
}

function definePublicProperties(_this, values = {}, propsArray = []) {
  let consumedProps = []

  for (const propOptions of propsArray) {
    let { name, value, valueName, type, get } = propOptions

    let constant = /^[A-Z0-9_]+$/.test(name)

    if (type !== undefined) {
      if (valueName === undefined) {
        valueName = name
      }

      if (constant) {
        valueName = valueName
          .toLowerCase()
          .replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase())
      }

      checkValid(values[valueName], {
        ...propOptions,
        name: `options.${valueName}`,
      })

      if (values[valueName] !== undefined) {
        value = values[valueName]
      }

      consumedProps.push(valueName)
    }

    if (!constant || typeof get === 'function') {
      _this[`_${name}`] = value

      if (typeof get !== 'function') {
        get = () => _this[`_${name}`]
      }
    } else {
      if (typeof get !== 'function') {
        get = () => value
      }
    }

    Object.defineProperty(_this, name, { enumerable: true, get })
  }

  for (const prop in values) {
    if (!(prop in _this) && !consumedProps.includes(prop)) {
      _this[prop] = values[prop]
    }
  }
}

function listenToEvents(_this, values = {}, events = []) {
  for (const event of events) {
    let methodName = `on${event.charAt(0).toUpperCase()}${event.slice(1)}`

    if (typeof values[methodName] === 'function') {
      _this.on(event, values[methodName].bind(_this))
    }
  }
}

async function emitCaughtAsyncError(_this, asyncFunctionOrPromise) {
  try {
    if (typeof asyncFunctionOrPromise === 'function') {
      await asyncFunctionOrPromise()
    } else {
      await Promise.resolve(asyncFunctionOrPromise)
    }
  } catch (err) {
    _this.emit('error', err)
  }
}

function parseColor(color, options = {}) {
  const { shortNames, excludeAlpha } = options

  if (typeof color === 'string') {
    let colorFromName = colorNames(color)

    if (colorFromName) {
      color = colorFromName
    }

    let match = color.match(
      /^#?(?=(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$)(?<red>(?<=^#?)(?:[0-9a-f](?=[0-9a-f]{2,3}$)|[0-9a-f]{2}(?=[0-9a-f]{4}$)|[0-9a-f]{2}(?=[0-9a-f]{6}$)))(?<green>(?:(?<=^#?[0-9a-f])[0-9a-f](?=[0-9a-f]{1,2}$)|(?<=^#?[0-9a-f]{2})[0-9a-f]{2}(?=[0-9a-f]{2}$)|(?<=^#?[0-9a-f]{2})[0-9a-f]{2}(?=[0-9a-f]{4}$)))(?<blue>(?:(?<=^#?[0-9a-f]{2})[0-9a-f](?=[0-9a-f]$|$)|(?<=^#?[0-9a-f]{4})[0-9a-f]{2}(?=[0-9a-f]{2}$|$)))(?<alpha>(?:(?<=^#?[0-9a-f]{3})[0-9a-f]$|(?<=^#?[0-9a-f]{6})[0-9a-f]{2}$))?$/i
    )

    color = {
      red: match.groups.red,
      green: match.groups.green,
      blue: match.groups.blue,
      alpha: match.groups.alpha ?? 'FF',
    }

    Object.keys(color).forEach((key) => {
      if (color[key].length === 1) {
        color[key] = `${color[key]}${color[key]}`
      }

      color[key] = parseInt(color[key], 16)
    })
  } else if (Array.isArray(color)) {
    color = {
      red: color[0],
      green: color[1],
      blue: color[2],
      alpha: color[3],
    }
  } else {
    color = {
      red: color.red,
      green: color.green,
      blue: color.blue,
      alpha: color.alpha,
    }
  }

  if (shortNames) {
    color = {
      r: color.red,
      g: color.green,
      b: color.blue,
      alpha: color.alpha,
    }
  }

  if (excludeAlpha) {
    delete color.alpha
  }

  return color
}

module.exports = {
  registerClass,
  checkValid,
  definePrivateProperties,
  definePublicProperties,
  listenToEvents,
  emitCaughtAsyncError,
  parseColor,
}
