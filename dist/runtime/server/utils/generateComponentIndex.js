import { existsSync, statSync, readFileSync } from "node:fs";
import { createChecker } from "vue-component-meta";
import { minimatch } from "minimatch";
export function extractPackageName(filePath) {
  const match = filePath.match(/[/\\]node_modules[/\\](@[^/\\]+[/\\][^/\\]+|[^/\\]+)/);
  return match ? match[1].replace(/\\/g, "/") : null;
}
export function resolveCategory(category, shortPath) {
  if (typeof category === "string") {
    return category;
  }
  const parts = shortPath.split("/");
  if (parts.length >= 4) {
    return parts[parts.length - 2];
  }
  if (category.fallback) {
    return category.fallback;
  }
  if (parts.length >= 3) {
    return parts[parts.length - 2];
  }
  return "Components";
}
export function extractComponentMeta(filePath, vcmDescription) {
  const result = {};
  if (vcmDescription) {
    const lines = vcmDescription.split("\n");
    const firstLine = lines[0].trim();
    if (firstLine && firstLine.length <= 50) {
      result.name = firstLine;
    }
    if (lines.length > 1) {
      result.description = lines.slice(1).join("\n").trim() || void 0;
    } else {
      result.description = firstLine;
    }
    return result;
  }
  try {
    const source = readFileSync(filePath, "utf-8");
    const scriptMatch = source.match(/<script\s[^>]*setup[^>]*>([\s\S]*?)<\/script>/);
    if (!scriptMatch) return result;
    const script = scriptMatch[1];
    const jsdocMatch = script.match(/^\s*\/\*\*([\s\S]*?)\*\//);
    if (!jsdocMatch) return result;
    const comment = jsdocMatch[1];
    const lines = comment.split("\n").map((line) => line.replace(/^\s*\*\s?/, "").trim()).filter((line) => line.length > 0);
    const descTag = lines.find((l) => l.startsWith("@description "));
    if (descTag) {
      result.description = descTag.replace("@description ", "").trim();
    }
    const catTag = lines.find((l) => l.startsWith("@category "));
    if (catTag) {
      result.category = catTag.replace("@category ", "").trim();
    }
    const statusTag = lines.find((l) => l.startsWith("@status "));
    if (statusTag) {
      const statusValue = statusTag.replace("@status ", "").trim();
      if (["experimental", "stable", "deprecated", "obsolete"].includes(statusValue)) {
        result.status = statusValue;
      }
    }
    const firstNonTag = lines.find((l) => !l.startsWith("@"));
    if (firstNonTag && firstNonTag.length <= 50) {
      result.name = firstNonTag;
    }
    if (!result.description) {
      const nonTagLines = lines.filter((l) => !l.startsWith("@"));
      if (nonTagLines.length > 1) {
        result.description = nonTagLines.slice(1).join(" ").trim() || void 0;
      }
    }
  } catch {
  }
  return result;
}
const CANVAS_TYPE_REFS = {
  CanvasImage: "json-schema-definitions://canvas.module/image",
  CanvasVideo: "json-schema-definitions://canvas.module/video"
};
const CANVAS_SCHEMA_DEFINITIONS = {
  "canvas/stream-wrapper-uri": {
    "format": "uri",
    "x-allowed-schemes": ["public"]
  },
  "canvas/stream-wrapper-image-uri": {
    "format": "uri",
    "contentMediaType": "image/*",
    "x-allowed-schemes": ["public"]
  },
  "canvas/image-uri": {
    "format": "uri-reference",
    "contentMediaType": "image/*",
    "x-allowed-schemes": ["http", "https"]
  }
};
function getSchemaRefProperties(shorthandRef) {
  return CANVAS_SCHEMA_DEFINITIONS[shorthandRef] ?? {};
}
function detectSchemaRefTag(tags) {
  if (!tags) return null;
  const schemaRefTag = tags.find((t) => t.name === "schemaRef");
  if (!schemaRefTag?.text?.trim()) return null;
  const refValue = schemaRefTag.text.trim();
  if (refValue.startsWith("json-schema-definitions://")) {
    const uriMatch = refValue.match(/^json-schema-definitions:\/\/([a-z_-]+)\.module\/([a-z_-]+)$/i);
    const shorthand = uriMatch ? `${uriMatch[1]}/${uriMatch[2]}` : refValue;
    return { $ref: refValue, shorthand };
  }
  const match = refValue.match(/^([a-z_-]+)\/([a-z_-]+)$/i);
  if (match) {
    const [, prefix, name] = match;
    return {
      $ref: `json-schema-definitions://${prefix}.module/${name}`,
      shorthand: refValue
    };
  }
  console.warn(`[nuxt-component-preview] Invalid @schemaRef value: ${refValue}`);
  return null;
}
function detectFormatTag(tags) {
  if (!tags) return null;
  const formatTag = tags.find((t) => t.name === "format");
  if (!formatTag?.text?.trim()) return null;
  return formatTag.text.trim();
}
function detectPatternTag(tags) {
  if (!tags) return null;
  const patternTag = tags.find((t) => t.name === "pattern");
  if (!patternTag?.text?.trim()) return null;
  return patternTag.text.trim();
}
function detectAllowedSchemesTag(tags) {
  if (!tags) return null;
  const schemesTag = tags.find((t) => t.name === "allowed-schemes");
  if (!schemesTag?.text?.trim()) return null;
  return schemesTag.text.trim().split(/[,\s]+/).filter(Boolean);
}
function detectMaxItemsTag(tags) {
  if (!tags) return null;
  const maxItemsTag = tags.find((t) => t.name === "maxItems");
  if (!maxItemsTag?.text?.trim()) return null;
  const num = Number.parseInt(maxItemsTag.text.trim(), 10);
  return Number.isNaN(num) ? null : num;
}
function detectMinItemsTag(tags) {
  if (!tags) return null;
  const minItemsTag = tags.find((t) => t.name === "minItems");
  if (!minItemsTag?.text?.trim()) return null;
  const num = Number.parseInt(minItemsTag.text.trim(), 10);
  return Number.isNaN(num) ? null : num;
}
function detectItemsFormatTag(tags) {
  if (!tags) return null;
  const itemsFormatTag = tags.find((t) => t.name === "itemsFormat");
  if (!itemsFormatTag?.text?.trim()) return null;
  return itemsFormatTag.text.trim();
}
function detectItemsSchemaRefTag(tags) {
  if (!tags) return null;
  const tag = tags.find((t) => t.name === "itemsSchemaRef");
  if (!tag?.text?.trim()) return null;
  return detectSchemaRefTag([{ name: "schemaRef", text: tag.text }]);
}
function detectArrayFromTypeString(typeStr) {
  const cleanType = typeStr.replace(/\s*\|\s*undefined/g, "").trim();
  const bracketMatch = cleanType.match(/^(.+)\[\]$/);
  if (bracketMatch) {
    return stripOuterParens(bracketMatch[1]);
  }
  const genericMatch = cleanType.match(/^Array<(.+)>$/i);
  if (genericMatch) {
    return stripOuterParens(genericMatch[1]);
  }
  return null;
}
function stripOuterParens(type) {
  const trimmed = type.trim();
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}
function detectArrayFromSchema(schema, typeString) {
  if (typeof schema === "string" || !schema) {
    if (typeString) {
      const elementType = detectArrayFromTypeString(typeString);
      if (elementType) {
        return { elementType };
      }
    }
    return null;
  }
  if (schema.kind === "array" && Array.isArray(schema.schema) && schema.schema.length > 0) {
    const firstElement = schema.schema[0];
    if (typeof firstElement === "string") {
      return { elementType: firstElement };
    }
    if (typeof firstElement === "object" && firstElement !== null) {
      return { elementType: firstElement.type || "unknown", elementSchema: firstElement };
    }
  }
  if (schema.kind === "enum" && Array.isArray(schema.schema)) {
    for (const member of schema.schema) {
      if (typeof member === "object" && member !== null && member.kind === "array") {
        return detectArrayFromSchema(member, typeString);
      }
    }
  }
  if (typeString) {
    const elementType = detectArrayFromTypeString(typeString);
    if (elementType) {
      return { elementType };
    }
  }
  return null;
}
function extractExamples(prop, exampleType = "string") {
  const examples = [];
  if (prop.tags) {
    const exampleTags = prop.tags.filter((t) => t.name === "example");
    for (const tag of exampleTags) {
      const text = tag.text?.trim() || "";
      if (!text) continue;
      if (exampleType === "object") {
        try {
          examples.push(JSON.parse(text));
          continue;
        } catch {
        }
        const jsObj = parseCanvasDefault(text);
        if (jsObj) {
          examples.push(jsObj);
          continue;
        }
        const kvObj = parseKeyValueExample(text);
        if (kvObj) {
          examples.push(kvObj);
        }
      } else {
        examples.push(text);
      }
    }
  }
  if (examples.length === 0 && prop.default) {
    if (exampleType === "object") {
      const defaultObj = parseCanvasDefault(prop.default);
      if (defaultObj) {
        examples.push(defaultObj);
      }
    } else {
      const defaultVal = parseDefaultValue(prop.default);
      if (defaultVal !== "") {
        examples.push(defaultVal);
      }
    }
  }
  return examples.length > 0 ? examples : void 0;
}
function buildPropDefinition(prop, options) {
  const { title, description } = extractTitleFromJSDoc(prop);
  const propDef = {
    type: options.type,
    title
  };
  if (description) propDef.description = description;
  if (options.$ref) propDef.$ref = options.$ref;
  if (options.format) propDef.format = options.format;
  if (options.pattern) propDef.pattern = options.pattern;
  if (options.contentMediaType) propDef.contentMediaType = options.contentMediaType;
  if (options.formattingContext) propDef["x-formatting-context"] = options.formattingContext;
  if (options["x-allowed-schemes"]) propDef["x-allowed-schemes"] = options["x-allowed-schemes"];
  const examples = extractExamples(prop, options.exampleType || "string");
  if (examples) {
    propDef.examples = examples;
  }
  return propDef;
}
function generateTitle(name) {
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, " $1");
}
const TITLE_MAX_LENGTH = 24;
function extractTitleFromJSDoc(prop) {
  const titleTag = prop.tags?.find((t) => t.name === "title");
  if (titleTag?.text?.trim()) {
    const titleText = titleTag.text.split("\n")[0].trim();
    if (titleText) {
      return {
        title: titleText,
        description: prop.description
      };
    }
  }
  if (prop.description) {
    const lines = prop.description.split("\n");
    const firstLine = lines[0].trim();
    if (firstLine.length > 0 && firstLine.length <= TITLE_MAX_LENGTH) {
      let remainingLines = lines.slice(1);
      if (remainingLines.length > 0 && remainingLines[0].trim() === "") {
        remainingLines = remainingLines.slice(1);
      }
      const remainingDescription = remainingLines.join("\n").trim() || void 0;
      return {
        title: firstLine,
        description: remainingDescription
      };
    }
  }
  return {
    title: generateTitle(prop.name),
    description: prop.description
  };
}
function detectCanvasType(vueType) {
  let cleanType = vueType.replace(/\s*\|\s*undefined/g, "").trim();
  cleanType = cleanType.replace(/^globalThis\./, "");
  return CANVAS_TYPE_REFS[cleanType] || null;
}
function detectFormattedText(tags) {
  if (!tags) return null;
  const contentMediaTypeTag = tags.find((t) => t.name === "contentMediaType");
  if (!contentMediaTypeTag?.text?.trim()) return null;
  const mediaType = contentMediaTypeTag.text.trim();
  if (mediaType !== "text/html") return null;
  const formattingContextTag = tags.find((t) => t.name === "formattingContext");
  const formattingContext = formattingContextTag?.text?.trim();
  return {
    contentMediaType: mediaType,
    formattingContext: formattingContext === "inline" ? "inline" : "block"
  };
}
function extractEnumLabels(prop, enumValues) {
  if (prop.tags) {
    const enumLabelsTag = prop.tags.find((t) => t.name === "enumLabels");
    if (enumLabelsTag?.text) {
      try {
        return JSON.parse(enumLabelsTag.text);
      } catch {
        console.warn(`Invalid @enumLabels JSON for ${prop.name}:`, enumLabelsTag.text);
      }
    }
  }
  const isNumericEnum = enumValues.every((v) => typeof v === "number");
  if (isNumericEnum) return void 0;
  const metaEnum = enumValues.reduce((acc, val) => {
    const strVal = String(val);
    const label = strVal.replace(/[-_]/g, " ").replace(/([A-Z])/g, " $1").trim().split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    acc[val] = label;
    return acc;
  }, {});
  const addsValue = Object.entries(metaEnum).some(([key, val]) => key !== val);
  return addsValue ? metaEnum : void 0;
}
function parseKeyValueExample(str) {
  const trimmed = str.trim();
  if (!trimmed.includes("=")) return null;
  if (trimmed.startsWith("{")) return null;
  const result = {};
  const pattern = /(\w+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let match;
  while ((match = pattern.exec(trimmed)) !== null) {
    const key = match[1];
    const value = match[2] ?? match[3] ?? match[4];
    if (/^-?\d+(?:\.\d+)?$/.test(value)) {
      result[key] = Number(value);
    } else if (value === "true") {
      result[key] = true;
    } else if (value === "false") {
      result[key] = false;
    } else {
      result[key] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}
function parseCanvasDefault(defaultStr) {
  let objectStr = defaultStr.trim();
  const factoryMatch = objectStr.match(/\(\)\s*=>\s*\(?(\{[\s\S]+\})\)?/);
  if (factoryMatch) {
    objectStr = factoryMatch[1];
  }
  if (!objectStr.startsWith("{") || !objectStr.endsWith("}")) {
    return null;
  }
  try {
    const jsonStr = objectStr.replace(/(\w+)\s*:/g, '"$1":').replace(/'/g, '"').replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}
export function generateComponentIndex(components, tsconfigPath, options) {
  const filtered = components.filter((c) => {
    if (!existsSync(c.filePath)) {
      console.warn(`[nuxt-component-preview] Component file not found: ${c.filePath}`);
      return false;
    }
    try {
      const stats = statSync(c.filePath);
      if (stats.isDirectory()) {
        console.log(`[nuxt-component-preview] Skipping directory: ${c.filePath}`);
        return false;
      }
    } catch (error) {
      console.warn(`[nuxt-component-preview] Error checking file stats for ${c.filePath}:`, error);
      return false;
    }
    const isInNodeModules = c.filePath.includes("/node_modules/") || c.filePath.includes("\\node_modules\\");
    if (isInNodeModules) {
      if (options.includePackages === false || options.includePackages === void 0) {
        return false;
      }
      if (Array.isArray(options.includePackages)) {
        const packageName = extractPackageName(c.filePath);
        if (!packageName || !options.includePackages.includes(packageName)) {
          return false;
        }
      }
    }
    if (options.includeDirectories && options.includeDirectories.length > 0) {
      const included = options.includeDirectories.some(
        (pattern) => minimatch(c.shortPath, `**/${pattern}/**`)
      );
      if (!included) return false;
    }
    if (options.excludeDirectories) {
      const excluded = options.excludeDirectories.some(
        (pattern) => minimatch(c.shortPath, `**/${pattern}/**`)
      );
      if (excluded) return false;
    }
    if (options.excludeComponents) {
      const excluded = options.excludeComponents.some(
        (pattern) => minimatch(c.kebabName, pattern)
      );
      if (excluded) return false;
    }
    return true;
  });
  const checker = createChecker(tsconfigPath, { printer: { newLine: 1 } });
  const componentData = filtered.map((component) => {
    try {
      const meta = checker.getComponentMeta(component.filePath);
      const vueInternalProps = ["key", "ref", "ref_for", "ref_key", "class", "style"];
      const props = meta.props.filter((p) => !vueInternalProps.includes(p.name)).filter((p) => !p.name.startsWith("onVue:")).reduce((acc, prop) => {
        const arrayInfo = detectArrayFromSchema(prop.schema, prop.type);
        if (arrayInfo) {
          const { title, description: description2 } = extractTitleFromJSDoc(prop);
          const propDef2 = {
            type: "array",
            title
          };
          if (description2) propDef2.description = description2;
          const elementType = arrayInfo.elementType;
          const canvasRef2 = detectCanvasType(elementType);
          if (canvasRef2) {
            propDef2.items = { type: "object", $ref: canvasRef2 };
          } else {
            const itemsSchema = {
              type: mapVueTypeToJsonSchema(elementType)
            };
            const itemEnumValues = extractEnumFromType(elementType);
            if (itemEnumValues.length > 0) {
              itemsSchema.enum = itemEnumValues;
              const metaEnum = extractEnumLabels(prop, itemEnumValues);
              if (metaEnum) itemsSchema["meta:enum"] = metaEnum;
            }
            const itemsFormat = detectItemsFormatTag(prop.tags);
            if (itemsFormat) itemsSchema.format = itemsFormat;
            const itemsRef = detectItemsSchemaRefTag(prop.tags);
            if (itemsRef) {
              itemsSchema.$ref = itemsRef.$ref;
              Object.assign(itemsSchema, getSchemaRefProperties(itemsRef.shorthand));
            }
            propDef2.items = itemsSchema;
          }
          const maxItems = detectMaxItemsTag(prop.tags);
          if (maxItems) propDef2.maxItems = maxItems;
          const minItems = detectMinItemsTag(prop.tags);
          if (minItems) propDef2.minItems = minItems;
          const examples = extractExamples(prop, "object");
          if (examples) propDef2.examples = examples;
          if (prop.default !== void 0) {
            propDef2.default = parseArrayDefaultValue(prop.default);
          }
          acc[prop.name] = propDef2;
          return acc;
        }
        const canvasRef = detectCanvasType(prop.type);
        if (canvasRef) {
          acc[prop.name] = buildPropDefinition(prop, {
            type: "object",
            $ref: canvasRef,
            exampleType: "object"
          });
          return acc;
        }
        const formattedTextInfo = detectFormattedText(prop.tags);
        if (formattedTextInfo) {
          acc[prop.name] = buildPropDefinition(prop, {
            type: "string",
            contentMediaType: formattedTextInfo.contentMediaType,
            formattingContext: formattedTextInfo.formattingContext
          });
          return acc;
        }
        const schemaRefResult = detectSchemaRefTag(prop.tags);
        if (schemaRefResult) {
          const additionalProps = getSchemaRefProperties(schemaRefResult.shorthand);
          acc[prop.name] = buildPropDefinition(prop, {
            type: "string",
            $ref: schemaRefResult.$ref,
            ...additionalProps
          });
          return acc;
        }
        const format = detectFormatTag(prop.tags);
        const pattern = detectPatternTag(prop.tags);
        const allowedSchemes = detectAllowedSchemesTag(prop.tags);
        const propDef = buildPropDefinition(prop, {
          "type": mapVueTypeToJsonSchema(prop.type),
          "format": format,
          "pattern": pattern,
          "x-allowed-schemes": allowedSchemes ?? void 0
        });
        if (prop.default !== void 0) propDef.default = parseDefaultValue(prop.default);
        const enumValues = extractEnumFromDeclaration(prop, component.filePath) ?? extractEnumFromType(prop.type);
        if (enumValues.length > 0) {
          propDef.enum = enumValues;
          const metaEnum = extractEnumLabels(prop, enumValues);
          if (metaEnum) {
            propDef["meta:enum"] = metaEnum;
          }
        }
        acc[prop.name] = propDef;
        return acc;
      }, {});
      const requiredProps = meta.props.filter((p) => !vueInternalProps.includes(p.name)).filter((p) => !p.name.startsWith("onVue:")).filter((p) => p.required).map((p) => p.name);
      const slots = meta.slots.reduce((acc, slot) => {
        acc[slot.name] = {
          title: generateTitle(slot.name),
          description: slot.description || void 0
        };
        return acc;
      }, {});
      const componentMeta = extractComponentMeta(component.filePath, meta.description);
      const override = options.overrides?.[component.pascalName];
      for (const requiredProp of requiredProps) {
        if (!props[requiredProp]?.examples?.length) {
          console.warn(`[nuxt-component-preview] Required prop "${component.pascalName}.${requiredProp}" has no @example. Canvas assumes required props always have one and silently falls back to a null value otherwise \u2014 add an @example to the prop.`);
        }
      }
      const description = override?.description || componentMeta.description;
      return {
        id: component.pascalName,
        name: override?.name || componentMeta.name || generateTitle(component.pascalName),
        ...description && { description },
        category: override?.category || componentMeta.category || resolveCategory(options.category, component.shortPath),
        status: override?.status || componentMeta.status || options.status,
        props: {
          type: "object",
          ...requiredProps.length > 0 && { required: requiredProps },
          properties: props
        },
        ...Object.keys(slots).length > 0 && { slots }
      };
    } catch (error) {
      const fileExt = component.filePath.split(".").pop();
      if (fileExt !== "vue") {
        console.warn(`[nuxt-component-preview] Could not extract metadata from ${fileExt} file: ${component.filePath}`);
      } else {
        console.error(`[nuxt-component-preview] Error processing component ${component.filePath}:`, error);
      }
      return null;
    }
  }).filter(Boolean);
  return {
    version: "1.0",
    components: componentData
  };
}
function extractEnumFromType(type) {
  const match = type.match(/"([^"]+)"/g);
  if (match) {
    return match.map((m) => m.replace(/"/g, ""));
  }
  const numMatch = type.match(/(?:^|\s)(\d+)(?=\s*\||$)/g);
  if (numMatch) {
    return numMatch.map((m) => Number.parseInt(m.trim()));
  }
  return [];
}
function extractEnumFromDeclaration(prop, filePath) {
  try {
    const decls = prop.getDeclarations?.();
    if (!decls?.[0]?.range) return null;
    const source = readFileSync(decls[0].file || filePath, "utf-8");
    const text = source.substring(decls[0].range[0], decls[0].range[1]);
    const values = text.match(/['"]([^'"]+)['"]/g);
    if (values && values.length > 1) {
      return values.map((v) => v.replace(/['"]/g, ""));
    }
    return null;
  } catch {
    return null;
  }
}
function mapVueTypeToJsonSchema(vueType) {
  const cleanType = vueType.replace(/\s*\|\s*undefined/g, "");
  if (cleanType.match(/"[^"]+"/)) return "string";
  if (/^\d+(?:\s*\|\s*\d+)*/.test(cleanType)) return "integer";
  if (cleanType.includes("string")) return "string";
  if (cleanType.includes("number")) return "number";
  if (cleanType.includes("boolean")) return "boolean";
  if (cleanType.includes("object")) return "object";
  if (cleanType.includes("array")) return "array";
  return "string";
}
function parseDefaultValue(defaultStr) {
  const cleaned = defaultStr.replace(/^["']|["']$/g, "");
  if (cleaned === "true") return true;
  if (cleaned === "false") return false;
  if (!Number.isNaN(Number(cleaned)) && cleaned !== "") return Number(cleaned);
  return cleaned;
}
function parseArrayDefaultValue(defaultStr) {
  let arrayStr = defaultStr.trim();
  const factoryMatch = arrayStr.match(/\(\)\s*=>\s*(\[[\s\S]*\])/);
  if (factoryMatch) {
    arrayStr = factoryMatch[1];
  }
  if (!arrayStr.startsWith("[") || !arrayStr.endsWith("]")) {
    return void 0;
  }
  try {
    const jsonStr = arrayStr.replace(/'/g, '"').replace(/,(\s*\])/g, "$1");
    return JSON.parse(jsonStr);
  } catch {
    return void 0;
  }
}
