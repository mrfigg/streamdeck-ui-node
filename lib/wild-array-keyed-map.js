const ArrayKeyedMap = require('array-keyed-map')

module.exports = class WildArrayKeyedMap extends ArrayKeyedMap {
  wildHas(element) {
    if (!Array.isArray(element)) {
      element = [element]
    }

    checkLoop: for (const arr of this.keys()) {
      if (arr.length !== element.length) {
        continue checkLoop
      }

      for (const [index, value] of arr.entries()) {
        if (value !== element[index] && element[index] !== undefined) {
          continue checkLoop
        }
      }

      return true
    }

    return false
  }
}
