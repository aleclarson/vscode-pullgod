type Fn = (...args: any[]) => any;

export function prefer<T, U = T>(
  ...prefs: (
    | Exclude<T, Fn>
    | ((value: T) => boolean)
    | ((a: T, b: U) => number)
  )[]
) {
  return (a: T, b: T): number => {
    for (const pref of prefs as any[]) {
      if (typeof pref === "function") {
        if (pref.length === 2) {
          return pref(a, b);
        }
        if (pref(a)) return -1;
        if (pref(b)) return 1;
      } else {
        if (Object.is(a, pref)) return -1;
        if (Object.is(b, pref)) return 1;
      }
    }
    return 0;
  };
}
