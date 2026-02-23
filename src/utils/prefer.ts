type Fn = (...args: any[]) => any;

export function prefer<T>(
  ...prefs: (Exclude<T, Fn> | ((value: T) => boolean) | ((a: T, b: T) => number))[]
) {
  return (a: T, b: T): number => {
    for (const pref of prefs as unknown[]) {
      if (typeof pref === "function") {
        if (pref.length === 2) {
          const result = pref(a, b);
          if (result !== 0) {
            return result;
          }
        } else if (pref(a)) {
          if (!pref(b)) {
            return -1;
          }
        } else if (pref(b)) {
          return 1;
        }
      } else if (Object.is(a, pref)) {
        return -1;
      } else if (Object.is(b, pref)) {
        return 1;
      }
    }
    return 0;
  };
}

export function preferGreaterNumber<T>(fn: (value: T) => number) {
  return (a: T, b: T): number => {
    const aValue = fn(a);
    const bValue = fn(b);
    return bValue - aValue;
  };
}

export function preferLaterDate<T>(fn: (value: T) => number | string | Date) {
  return preferGreaterNumber((value: T) => new Date(fn(value)).getTime());
}
