module.exports = class WildArrayValuedSet extends Set {
  add(element) {
    if (!Array.isArray(element)) {
      element = [element]
    }

    element = [...element]

    checkLoop: for (const arr of this) {
      if (arr.length !== element.length) {
        continue checkLoop
      }

      for (const [index, value] of arr.entries()) {
        if (value !== element[index]) {
          continue checkLoop
        }
      }

      return this
    }

    return super.add(element)
  }

  delete(element) {
    if (!Array.isArray(element)) {
      element = [element]
    }

    element = [...element]

    checkLoop: for (const arr of this) {
      if (arr.length !== element.length) {
        continue checkLoop
      }

      for (const [index, value] of arr.entries()) {
        if (value !== element[index]) {
          continue checkLoop
        }
      }

      return super.delete(arr)
    }

    return false
  }

  has(element) {
    if (!Array.isArray(element)) {
      element = [element]
    }

    element = [...element]

    checkLoop: for (const arr of this) {
      if (arr.length !== element.length) {
        continue checkLoop
      }

      for (const [index, value] of arr.entries()) {
        if (value !== element[index]) {
          continue checkLoop
        }
      }

      return true
    }

    return false
  }

  wildHas(element) {
    if (!Array.isArray(element)) {
      element = [element]
    }

    element = [...element]

    checkLoop: for (const arr of this) {
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
