/**
 * Compiles a path pattern into a RegExp.
 *
 * Paths look like `Root/Parent/Child` for elements and `Root/Child/@attr` for attributes.
 * `*` matches within one segment, `**` matches any number of segments.
 */
export function compilePattern(pattern: string): RegExp {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        i++;
        if (pattern[i + 1] === "/") {
          i++;
          re += "(?:.*/)?";
        } else {
          re += ".*";
        }
      } else {
        re += "[^/]*";
      }
    } else {
      re += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

export const attrPath = (elementPath: string, attr: string) => `${elementPath}/@${attr}`;
