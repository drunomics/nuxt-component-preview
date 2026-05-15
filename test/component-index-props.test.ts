import * as path from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import type { Component } from '@nuxt/schema'
import type { ComponentIndexData } from '../src/runtime/server/utils/generateComponentIndex'

// Mock component type for tests
type MockComponent = Pick<Component, 'pascalName' | 'kebabName' | 'filePath' | 'shortPath' | 'global'>

function createMockComp(pascalName: string, file: string): MockComponent {
  return {
    pascalName,
    kebabName: pascalName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
    filePath: path.resolve(process.cwd(), 'playground/components/global/' + file),
    shortPath: 'components/global/' + file,
    global: true,
  }
}

async function generateIndex(components: MockComponent[]): Promise<ComponentIndexData> {
  const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
  return generateComponentIndex(
    components as Component[],
    path.resolve(process.cwd(), 'playground/tsconfig.json'),
    { category: 'Test', status: 'stable' },
  )
}

describe('Component Index - Prop Metadata Extraction', () => {
  // ── TestButton group ──────────────────────────────────────────────
  describe('TestButton props', () => {
    let result: ComponentIndexData

    beforeAll(async () => {
      result = await generateIndex([createMockComp('TestButton', 'TestButton.vue')])
    })

    it('extracts @example tags to examples field', () => {
      const labelProp = result.components[0].props.properties.label
      expect(labelProp.examples).toEqual(['Submit', 'Cancel', 'Learn More'])

      const variantProp = result.components[0].props.properties.variant
      expect(variantProp.examples).toEqual(['primary', 'success'])
    })

    it('extracts enum values from TypeScript union types', () => {
      const variantProp = result.components[0].props.properties.variant
      expect(variantProp.enum).toBeDefined()
      expect(variantProp.enum).toContain('primary')
      expect(variantProp.enum).toContain('secondary')
      expect(variantProp.enum).toContain('success')
      expect(variantProp.enum).toContain('danger')
      expect(variantProp.type).toBe('string')
    })

    it('generates meta:enum for enum values', () => {
      const variantProp = result.components[0].props.properties.variant
      expect(variantProp['meta:enum']).toBeDefined()
      expect(variantProp['meta:enum'].primary).toBe('Primary')
      expect(variantProp['meta:enum'].secondary).toBe('Secondary')
    })

    it('supports partial @enumLabels (only some values labeled)', () => {
      const sizeProp = result.components[0].props.properties.size
      expect(sizeProp['meta:enum']).toBeDefined()
      expect(sizeProp['meta:enum'].large).toBe('Extra Large (XL)')
      // Partial labels: other values not specified in @enumLabels
      expect(sizeProp['meta:enum'].small).toBeUndefined()
      expect(sizeProp['meta:enum'].medium).toBeUndefined()
    })

    it('filters out onVue: lifecycle hook props', () => {
      const propNames = Object.keys(result.components[0].props.properties)
      const vueLifecycleProps = propNames.filter(name => name.startsWith('onVue:'))
      expect(vueLifecycleProps).toEqual([])
    })
  })

  // ── TwoColumnLayout group ─────────────────────────────────────────
  describe('TwoColumnLayout props', () => {
    let result: ComponentIndexData

    beforeAll(async () => {
      result = await generateIndex([createMockComp('TwoColumnLayout', 'TwoColumnLayout.vue')])
    })

    it('uses custom @enumLabels from JSDoc', () => {
      const widthProp = result.components[0].props.properties.width
      expect(widthProp['meta:enum']).toBeDefined()
      expect(widthProp['meta:enum']['25']).toBe('25% / 75%')
      expect(widthProp['meta:enum']['50']).toBe('50% / 50%')
      expect(widthProp['meta:enum']['75']).toBe('75% / 25%')
    })

    it('extracts named slots from template', () => {
      const component = result.components[0]
      expect(component.slots).toBeDefined()
      expect(Object.keys(component.slots)).toHaveLength(2)
      expect(component.slots['column-one']).toBeDefined()
      expect(component.slots['column-one'].title).toBeDefined()
      expect(component.slots['column-two']).toBeDefined()
      expect(component.slots.default).toBeUndefined()
    })
  })

  // ── TestPopover group ─────────────────────────────────────────────
  describe('TestPopover props', () => {
    let result: ComponentIndexData

    beforeAll(async () => {
      result = await generateIndex([createMockComp('TestPopover', 'TestPopover.vue')])
    })

    it('extracts default slot from component', () => {
      const component = result.components[0]
      expect(component.slots).toBeDefined()
      expect(component.slots.default).toBeDefined()
      expect(component.slots.default.title).toBe('Default')
      expect(component.slots.trigger).toBeDefined()
      expect(component.slots.trigger.title).toBe('Trigger')
    })
  })

  // ── TestHero group ────────────────────────────────────────────────
  describe('TestHero props (Canvas types)', () => {
    let result: ComponentIndexData

    beforeAll(async () => {
      result = await generateIndex([createMockComp('TestHero', 'TestHero.vue')])
    })

    it('generates Canvas-compatible schema for CanvasImage props', () => {
      const imageProp = result.components[0].props.properties.image

      // Validate Canvas schema format
      expect(imageProp.type).toBe('object')
      expect(imageProp['$ref']).toBe('json-schema-definitions://canvas.module/image')
      // Title is extracted from JSDoc first line
      expect(imageProp.title).toBe('Hero image')
    })

    it('extracts @example JSON for CanvasImage props', () => {
      const imageProp = result.components[0].props.properties.image

      expect(imageProp.examples).toBeDefined()
      expect(imageProp.examples).toHaveLength(1)
      expect(imageProp.examples![0]).toMatchObject({
        src: 'https://placehold.co/800x600',
        alt: 'Example image',
        width: 800,
        height: 600,
      })
    })

    it('validates CanvasImage examples match Canvas schema structure', async () => {
      const canvasSchema = await import('../schema/canvas.schema.json')
      const imageProp = result.components[0].props.properties.image
      const canvasImageDef = canvasSchema.$defs.image

      // Verify the prop has correct Canvas $ref
      expect(imageProp['$ref']).toBe('json-schema-definitions://canvas.module/image')

      // Verify examples match Canvas image structure (has required 'src' and optional alt, width, height)
      imageProp.examples.forEach((example: Record<string, unknown>) => {
        // 'src' is required per Canvas schema
        expect(example).toHaveProperty('src')
        expect(typeof example.src).toBe('string')

        // Verify structure matches Canvas image $defs
        const canvasImageProps = Object.keys(canvasImageDef.properties)
        Object.keys(example).forEach((key) => {
          expect(canvasImageProps).toContain(key)
        })
      })
    })
  })

  // ── TestBanner group ──────────────────────────────────────────────
  describe('TestBanner props (key-value @example)', () => {
    let result: ComponentIndexData

    beforeAll(async () => {
      result = await generateIndex([createMockComp('TestBanner', 'TestBanner.vue')])
    })

    it('parses @example with key-value syntax', () => {
      const imageProp = result.components[0].props.properties.image

      // Should have $ref for Canvas type
      expect(imageProp['$ref']).toBe('json-schema-definitions://canvas.module/image')

      // Should parse key-value @example into object
      expect(imageProp.examples).toBeDefined()
      expect(imageProp.examples).toHaveLength(1)
      expect(imageProp.examples![0]).toMatchObject({
        src: 'https://placehold.co/600x400',
        alt: 'Banner image',
        width: 600,
        height: 400,
      })
    })

    it('parses numbers and booleans in key-value syntax', () => {
      const imageProp = result.components[0].props.properties.image

      // Numbers should be parsed as numbers, not strings
      expect(typeof imageProp.examples![0].width).toBe('number')
      expect(typeof imageProp.examples![0].height).toBe('number')
      expect(imageProp.examples![0].width).toBe(600)
      expect(imageProp.examples![0].height).toBe(400)
    })
  })

  // ── Required vs optional props ───────────────────────────────────
  describe('required vs optional props', () => {
    let result: ComponentIndexData

    beforeAll(async () => {
      result = await generateIndex([createMockComp('TestBanner', 'TestBanner.vue')])
    })

    it('includes required array for non-optional props', () => {
      const component = result.components[0]
      // heading is required (no ? in TypeScript, no default)
      expect(component.props.required).toBeDefined()
      expect(component.props.required).toContain('heading')
    })

    it('does not include optional props in required array', () => {
      const component = result.components[0]
      // image is optional (has ? in TypeScript)
      expect(component.props.required).not.toContain('image')
    })

    it('omits required array when all props are optional', async () => {
      const allOptional = await generateIndex([createMockComp('TestCard', 'TestCard.vue')])
      const component = allOptional.components[0]
      // TestCard has only optional props with defaults
      expect(component.props.required).toBeUndefined()
    })
  })

  // ── TestCard group ────────────────────────────────────────────────
  describe('TestCard props', () => {
    let result: ComponentIndexData

    beforeAll(async () => {
      result = await generateIndex([createMockComp('TestCard', 'TestCard.vue')])
    })

    it('does not add $ref for regular object props', () => {
      // Regular string props should not have $ref
      const titleProp = result.components[0].props.properties.title
      expect(titleProp['$ref']).toBeUndefined()
      expect(titleProp.type).toBe('string')
    })
  })

  // ── TestArticle group ─────────────────────────────────────────────
  describe('TestArticle props (Formatted Text)', () => {
    let result: ComponentIndexData

    beforeAll(async () => {
      result = await generateIndex([createMockComp('TestArticle', 'TestArticle.vue')])
    })

    it('detects @contentMediaType text/html and defaults to block context', () => {
      // content prop has @contentMediaType but no @formattingContext, should default to block
      const contentProp = result.components[0].props.properties.content

      expect(contentProp.type).toBe('string')
      expect(contentProp.contentMediaType).toBe('text/html')
      expect(contentProp['x-formatting-context']).toBe('block')
    })

    it('respects @formattingContext inline when specified', () => {
      // summary prop has @formattingContext inline
      const summaryProp = result.components[0].props.properties.summary

      expect(summaryProp.type).toBe('string')
      expect(summaryProp.contentMediaType).toBe('text/html')
      expect(summaryProp['x-formatting-context']).toBe('inline')
    })

    it('extracts @example tags for formatted text props', () => {
      const summaryProp = result.components[0].props.properties.summary
      const contentProp = result.components[0].props.properties.content

      expect(summaryProp.examples).toBeDefined()
      expect(summaryProp.examples).toHaveLength(1)
      expect(summaryProp.examples![0]).toBe('This is <strong>important</strong> news')

      expect(contentProp.examples).toBeDefined()
      expect(contentProp.examples).toHaveLength(1)
      expect(contentProp.examples![0]).toContain('<p>First paragraph')
    })

    it('does not add contentMediaType for regular string props', () => {
      // title prop is a regular string, no @contentMediaType
      const titleProp = result.components[0].props.properties.title

      expect(titleProp.type).toBe('string')
      expect(titleProp.contentMediaType).toBeUndefined()
      expect(titleProp['x-formatting-context']).toBeUndefined()
    })
  })

  // ── TestPropTitles group ──────────────────────────────────────────
  describe('TestPropTitles (Prop Title Extraction from JSDoc)', () => {
    let result: ComponentIndexData

    beforeAll(async () => {
      result = await generateIndex([createMockComp('TestPropTitles', 'TestPropTitles.vue')])
    })

    it('uses @title tag when present', () => {
      const explicitTitleProp = result.components[0].props.properties.explicitTitle

      expect(explicitTitleProp.title).toBe('Custom Title Override')
      // @title doesn't affect description - it stays as-is
      expect(explicitTitleProp.description).toBe('Description for this prop')
    })

    it('extracts title from first line of description', () => {
      const inferredTitleProp = result.components[0].props.properties.inferredTitle

      expect(inferredTitleProp.title).toBe('Short JSDoc summary')
    })

    it('removes first line and empty separator from description', () => {
      const inferredTitleProp = result.components[0].props.properties.inferredTitle

      // Description should be remaining text after title and empty line
      expect(inferredTitleProp.description).toContain('This is the longer description')
      expect(inferredTitleProp.description).toContain('spans multiple lines')
      // Should not start with empty line or contain the title
      expect(inferredTitleProp.description).not.toContain('Short JSDoc summary')
    })

    it('falls back to name-based title for long descriptions', () => {
      const fallbackTitleProp = result.components[0].props.properties.fallbackTitle

      // First line is > 50 chars, should fall back to name-based title
      expect(fallbackTitleProp.title).toBe('Fallback Title')
      // Description should remain intact
      expect(fallbackTitleProp.description).toContain('way too long')
    })

    it('handles single-line JSDoc without separator', () => {
      const singleLineProp = result.components[0].props.properties.singleLine

      // Single line becomes title, no description remains
      expect(singleLineProp.title).toBe('Single line title')
      expect(singleLineProp.description).toBeUndefined()
    })

    it('handles props without JSDoc', () => {
      const noJsDocProp = result.components[0].props.properties.noJsDoc

      // Falls back to name-based title
      expect(noJsDocProp.title).toBe('No Js Doc')
      expect(noJsDocProp.description).toBeUndefined()
    })
  })

  // ── TestSchemaRefFile group ───────────────────────────────────────
  describe('TestSchemaRefFile (@schemaRef)', () => {
    let result: ComponentIndexData

    beforeAll(async () => {
      result = await generateIndex([createMockComp('TestSchemaRefAll', 'TestSchemaRefFile.vue')])
    })

    it('generates $ref for @schemaRef canvas/stream-wrapper-uri', () => {
      const fileUriProp = result.components[0].props.properties.fileUri

      expect(fileUriProp.type).toBe('string')
      expect(fileUriProp['$ref']).toBe('json-schema-definitions://canvas.module/stream-wrapper-uri')
      expect(fileUriProp.title).toBe('File URI')
      expect(fileUriProp.description).toBe('A file stored in Drupal\'s public files directory.')
      // Verify additional schema properties are included for Canvas field type determination
      expect(fileUriProp.format).toBe('uri')
      expect(fileUriProp['x-allowed-schemes']).toEqual(['public'])
    })

    it('extracts @example for @schemaRef props', () => {
      const fileUriProp = result.components[0].props.properties.fileUri
      const imageUriProp = result.components[0].props.properties.imageUri

      expect(fileUriProp.examples).toContain('public://documents/report.pdf')
      expect(imageUriProp.examples).toContain('public://images/hero.jpg')
    })
  })

  // ── TestStreamWrapper group ───────────────────────────────────────
  describe('TestStreamWrapper (@schemaRef stream-wrapper)', () => {
    let result: ComponentIndexData

    beforeAll(async () => {
      result = await generateIndex([createMockComp('TestStreamWrapper', 'TestStreamWrapper.vue')])
    })

    it('generates $ref for @schemaRef canvas/stream-wrapper-image-uri', () => {
      const imageUriProp = result.components[0].props.properties.imageUri

      expect(imageUriProp.type).toBe('string')
      expect(imageUriProp['$ref']).toBe('json-schema-definitions://canvas.module/stream-wrapper-image-uri')
      expect(imageUriProp.title).toBe('Image URI')
      // Verify additional schema properties are included for Canvas field type determination
      expect(imageUriProp.format).toBe('uri')
      expect(imageUriProp.contentMediaType).toBe('image/*')
      expect(imageUriProp['x-allowed-schemes']).toEqual(['public'])
    })

    it('generates $ref for @schemaRef canvas/image-uri', () => {
      const webImageUrlProp = result.components[0].props.properties.webImageUrl

      expect(webImageUrlProp.type).toBe('string')
      expect(webImageUrlProp['$ref']).toBe('json-schema-definitions://canvas.module/image-uri')
      expect(webImageUrlProp.title).toBe('Web image URL')
      // Verify additional schema properties are included for Canvas field type determination
      expect(webImageUrlProp.format).toBe('uri-reference')
      expect(webImageUrlProp.contentMediaType).toBe('image/*')
      expect(webImageUrlProp['x-allowed-schemes']).toEqual(['http', 'https'])
    })

    it('does not add $ref for props without @schemaRef', () => {
      // caption is a regular string prop without @schemaRef
      const captionProp = result.components[0].props.properties.caption

      expect(captionProp.type).toBe('string')
      expect(captionProp['$ref']).toBeUndefined()
      expect(captionProp.title).toBe('Regular text')
    })
  })

  // ── TestFormatPattern group ───────────────────────────────────────
  describe('TestFormatPattern (@format and @pattern)', () => {
    let result: ComponentIndexData

    beforeAll(async () => {
      result = await generateIndex([createMockComp('TestFormatPattern', 'TestFormatPattern.vue')])
    })

    it('generates format for @format tag', () => {
      const eventDateProp = result.components[0].props.properties.eventDate
      const titleProp = result.components[0].props.properties.title

      // @format date generates format property
      expect(eventDateProp.type).toBe('string')
      expect(eventDateProp.format).toBe('date')
      expect(eventDateProp.title).toBe('Event date')

      // Props without @format have no format property
      expect(titleProp.format).toBeUndefined()
    })

    it('generates pattern for @pattern tag', () => {
      const descriptionProp = result.components[0].props.properties.description
      const titleProp = result.components[0].props.properties.title

      // @pattern generates pattern property (textarea pattern for multiline)
      expect(descriptionProp.type).toBe('string')
      // Note: backslashes must be escaped in JS strings
      expect(descriptionProp.pattern).toBe('(.|\\r?\\n)*')
      expect(descriptionProp.title).toBe('Description')

      // Props without @pattern have no pattern property
      expect(titleProp.pattern).toBeUndefined()
    })

    it('generates x-allowed-schemes for @allowed-schemes tag', () => {
      const fileUrlProp = result.components[0].props.properties.fileUrl
      const titleProp = result.components[0].props.properties.title

      // @allowed-schemes generates x-allowed-schemes property
      expect(fileUrlProp.type).toBe('string')
      expect(fileUrlProp.format).toBe('uri')
      expect(fileUrlProp['x-allowed-schemes']).toEqual(['http', 'https'])
      expect(fileUrlProp.title).toBe('File URL')

      // Props without @allowed-schemes have no x-allowed-schemes property
      expect(titleProp['x-allowed-schemes']).toBeUndefined()
    })
  })

  // ── TestArrayTypes group ──────────────────────────────────────────
  describe('TestArrayTypes (Array Type Support)', () => {
    let result: ComponentIndexData

    beforeAll(async () => {
      result = await generateIndex([createMockComp('TestArrayTypes', 'TestArrayTypes.vue')])
    })

    it('extracts string array type with items schema', () => {
      const tagsProp = result.components[0].props.properties.tags

      expect(tagsProp.type).toBe('array')
      expect(tagsProp.items).toEqual({ type: 'string' })
      expect(tagsProp.title).toBe('List of tags')
    })

    it('extracts number array type', () => {
      const numbersProp = result.components[0].props.properties.numbers

      expect(numbersProp.type).toBe('array')
      expect(numbersProp.items).toEqual({ type: 'number' })
    })

    it('extracts @maxItems constraint', () => {
      const tagsProp = result.components[0].props.properties.tags
      const numbersProp = result.components[0].props.properties.numbers

      // tags has @maxItems 10
      expect(tagsProp.maxItems).toBe(10)

      // numbers has no @maxItems
      expect(numbersProp.maxItems).toBeUndefined()
    })

    it('extracts array examples', () => {
      const tagsProp = result.components[0].props.properties.tags

      expect(tagsProp.examples).toBeDefined()
      expect(tagsProp.examples).toHaveLength(1)
      expect(tagsProp.examples![0]).toEqual(['foo', 'bar', 'baz'])
    })

    it('extracts array default value', () => {
      const tagsProp = result.components[0].props.properties.tags

      expect(tagsProp.default).toEqual(['default-tag'])
    })

    it('extracts CanvasImage array with $ref in items', () => {
      const imagesProp = result.components[0].props.properties.images

      expect(imagesProp.type).toBe('array')
      expect(imagesProp.items).toEqual({
        type: 'object',
        $ref: 'json-schema-definitions://canvas.module/image',
      })
      expect(imagesProp.maxItems).toBe(20)
    })
  })

  // ── TestMultiValueProps group ─────────────────────────────────────
  // Canvas 1.4 multi-value props: each variant matches the shape canvas
  // expects for arrays of strings/numbers/integers, with optional format,
  // enum + meta:enum, $ref-on-items, and minItems/maxItems cardinality.
  // @see web/modules/contrib/canvas/tests/modules/canvas_test_sdc/components/multivalue-props/multivalue-props.component.yml
  describe('TestMultiValueProps (Canvas 1.4 multi-value props)', () => {
    let result: ComponentIndexData

    beforeAll(async () => {
      result = await generateIndex([createMockComp('TestMultiValueProps', 'TestMultiValueProps.vue')])
    })

    function prop(name: string) {
      return result.components[0].props.properties[name]
    }

    it('plain text array → type:array items:{type:string}', () => {
      expect(prop('textValues')).toMatchObject({
        type: 'array',
        items: { type: 'string' },
      })
    })

    it('@maxItems lifts cardinality cap to maxItems', () => {
      expect(prop('textLimited').maxItems).toBe(3)
    })

    it('@minItems lifts required-ness to minItems on the array', () => {
      expect(prop('requiredText').minItems).toBe(1)
      // Non-optional prop still appears in component-level required[] too —
      // canvas accepts either signal.
      expect(result.components[0].props.required).toContain('requiredText')
    })

    it('@itemsFormat lifts string format to items.format', () => {
      expect(prop('links').items).toEqual({ type: 'string', format: 'uri' })
      expect(prop('relativeLinks').items).toEqual({ type: 'string', format: 'uri-reference' })
      expect(prop('dateTimes').items).toEqual({ type: 'string', format: 'date-time' })
      expect(prop('dates').items).toEqual({ type: 'string', format: 'date' })
    })

    it('string-literal union element → items.enum + auto meta:enum', () => {
      expect(prop('listText').items).toEqual({
        'type': 'string',
        'enum': ['option_one', 'option_two', 'option_three', 'option_four'],
        'meta:enum': {
          option_one: 'Option One',
          option_two: 'Option Two',
          option_three: 'Option Three',
          option_four: 'Option Four',
        },
      })
    })

    it('@enumLabels overrides auto-generated item labels', () => {
      expect(prop('listTextLimited').items['meta:enum']).toEqual({
        draft: 'Draft',
        review: 'In Review',
        live: 'Live',
      })
    })

    it('numeric-literal union element → items.type:integer + enum', () => {
      expect(prop('listInt').items).toMatchObject({
        type: 'integer',
        enum: [10, 20, 30, 40],
      })
    })

    it('CanvasImage[] → items:{type:object, $ref:image}', () => {
      expect(prop('images').items).toEqual({
        type: 'object',
        $ref: 'json-schema-definitions://canvas.module/image',
      })
      expect(prop('images').maxItems).toBe(5)
    })

    it('@itemsSchemaRef lifts known-shape $ref + properties to items', () => {
      expect(prop('attachments').items).toEqual({
        'type': 'string',
        '$ref': 'json-schema-definitions://canvas.module/stream-wrapper-uri',
        'format': 'uri',
        'x-allowed-schemes': ['public'],
      })
    })

    it('overall output matches the canvas_extjs fixture snapshot', () => {
      const expected = JSON.parse(readFileSync(
        path.resolve(__dirname, 'fixtures/multivalue-props.component-index.json'),
        'utf-8',
      ))
      expect(result).toEqual(expected)
    })
  })
})
