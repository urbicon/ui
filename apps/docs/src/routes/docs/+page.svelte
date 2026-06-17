<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { DocsLayout as DocsPageLayout, Section, InfoCard } from '@urbicon-ui/docs';
  import { Card } from '@urbicon-ui/blocks';

  const _stats = {
    totalComponents: 12,
    totalProps: 73,
    averageProps: 6,
    lastGenerated: '2025-08-29T20:14:35.119Z'
  };
  const _groupedComponents = {
    '@urbicon-ui/docs': [
      {
        name: 'ApiReference',
        packageName: '@urbicon-ui/docs',
        filePath: 'packages/docs/src/lib/components/ApiReference/index.ts',
        version: '0.2.9',
        description: 'ApiReference component',
        props: [
          {
            name: 'props',
            type: 'ApiProp[]',
            required: true,
            description: 'props property',
            source: {
              type: 'direct',
              name: 'ApiReferenceProps'
            }
          },
          {
            name: '...ApiReferenceVariantProps',
            type: 'VariantProps',
            required: false,
            description: 'Styling variants from ApiReferenceVariantProps',
            source: {
              type: 'variant',
              name: 'ApiReferenceVariantProps'
            }
          },
          {
            name: 'description',
            type: 'string',
            required: false,
            description: 'description property',
            source: {
              type: 'direct',
              name: 'ApiReferenceProps'
            }
          },
          {
            name: 'showHeader',
            type: 'boolean',
            required: false,
            description: 'showHeader property',
            source: {
              type: 'direct',
              name: 'ApiReferenceProps'
            }
          },
          {
            name: 'title',
            type: 'string',
            required: false,
            description: 'title property',
            source: {
              type: 'direct',
              name: 'ApiReferenceProps'
            }
          },
          {
            name: 'usageNotes',
            type: 'Snippet',
            required: false,
            description: 'usageNotes property',
            source: {
              type: 'direct',
              name: 'ApiReferenceProps'
            }
          }
        ],
        variants: [],
        inheritance: [
          {
            typeName: 'ApiReferenceVariantProps',
            source: 'external',
            props: [
              {
                name: '...ApiReferenceVariantProps',
                type: 'ApiReferenceVariantProps',
                required: false,
                description: 'Properties inherited from ApiReferenceVariantProps',
                source: {
                  type: 'inherited',
                  name: 'ApiReferenceVariantProps'
                }
              }
            ]
          }
        ],
        stats: {
          totalProps: 6,
          directProps: 5,
          variantProps: 1,
          inheritedProps: 0
        },
        localTypes: [
          {
            name: 'ApiProp',
            type: 'interface',
            definition:
              'name: string;\n  type: string;\n  required?: boolean;\n  defaultValue?: string;\n  description?: string;\n  seeAlso?: string;',
            package: '@urbicon-ui/docs',
            documentation: '',
            scope: 'local',
            usedByProps: [
              {
                component: 'ApiReference',
                propName: 'props',
                source: 'direct'
              }
            ],
            usedByCount: 1,
            category: 'helper'
          },
          {
            name: 'ApiReferenceProps',
            type: 'interface',
            definition:
              'title?: string;\n  description?: string;\n  props: ApiProp[];\n  usageNotes?: Snippet;\n  showHeader?: boolean;',
            package: '@urbicon-ui/docs',
            documentation: '',
            scope: 'local',
            usedByProps: [],
            usedByCount: 0,
            category: 'props'
          }
        ],
        crossReferences: [],
        examples: []
      },
      {
        name: 'CodeExample',
        packageName: '@urbicon-ui/docs',
        filePath: 'packages/docs/src/lib/components/CodeExample/index.ts',
        version: '0.2.9',
        description: 'CodeExample component',
        props: [
          {
            name: '...CodeExampleVariantProps',
            type: 'VariantProps',
            required: false,
            description: 'Styling variants from CodeExampleVariantProps',
            source: {
              type: 'variant',
              name: 'CodeExampleVariantProps'
            }
          },
          {
            name: 'children',
            type: 'Snippet',
            required: false,
            description: 'children property',
            source: {
              type: 'direct',
              name: 'CodeExampleProps'
            }
          },
          {
            name: 'code',
            type: 'string',
            required: false,
            description: 'code property',
            source: {
              type: 'direct',
              name: 'CodeExampleProps'
            }
          },
          {
            name: 'component',
            type: 'any',
            required: false,
            description: 'Optional isolated preview component generated by the Vite plugin',
            source: {
              type: 'direct',
              name: 'CodeExampleProps'
            }
          },
          {
            name: 'description',
            type: 'string',
            required: false,
            description: 'description property',
            source: {
              type: 'direct',
              name: 'CodeExampleProps'
            }
          },
          {
            name: 'isolate',
            type: 'boolean',
            required: false,
            description:
              'When present on <CodeExample>, plugin will isolate children into a virtual component',
            source: {
              type: 'direct',
              name: 'CodeExampleProps'
            }
          },
          {
            name: 'language',
            type: 'string',
            required: false,
            description: 'language property',
            source: {
              type: 'direct',
              name: 'CodeExampleProps'
            }
          },
          {
            name: 'preview',
            type: 'boolean',
            required: false,
            description: 'Deprecated alias for hasPreview, kept for backwards compatibility',
            source: {
              type: 'direct',
              name: 'CodeExampleProps'
            }
          },
          {
            name: 'title',
            type: 'string',
            required: false,
            description: 'title property',
            source: {
              type: 'direct',
              name: 'CodeExampleProps'
            }
          }
        ],
        variants: [],
        inheritance: [
          {
            typeName: 'CodeExampleVariantProps',
            source: 'external',
            props: [
              {
                name: '...CodeExampleVariantProps',
                type: 'CodeExampleVariantProps',
                required: false,
                description: 'Properties inherited from CodeExampleVariantProps',
                source: {
                  type: 'inherited',
                  name: 'CodeExampleVariantProps'
                }
              }
            ]
          }
        ],
        stats: {
          totalProps: 9,
          directProps: 8,
          variantProps: 1,
          inheritedProps: 0
        },
        localTypes: [
          {
            name: 'CodeExampleProps',
            type: 'interface',
            definition:
              'title?: string;\n  code?: string;\n  language?: string;\n  description?: string;\n  /** Optional isolated preview component generated by the Vite plugin */\n  component?: any;\n  /** When present on <CodeExample>, plugin will isolate children into a virtual component */\n  isolate?: boolean;\n  /** Deprecated alias for hasPreview, kept for backwards compatibility */\n  preview?: boolean;\n  children?: Snippet;',
            package: '@urbicon-ui/docs',
            documentation: '',
            scope: 'local',
            usedByProps: [],
            usedByCount: 0,
            category: 'props'
          }
        ],
        crossReferences: [],
        examples: []
      },
      {
        name: 'Components',
        packageName: '@urbicon-ui/docs',
        filePath: 'packages/docs/src/lib/components/index.ts',
        version: '0.2.9',
        description: 'Components component',
        props: [],
        variants: [],
        inheritance: [],
        stats: {
          totalProps: 0,
          directProps: 0,
          variantProps: 0,
          inheritedProps: 0
        },
        localTypes: [],
        crossReferences: [],
        examples: []
      },
      {
        name: 'DocsLayout',
        packageName: '@urbicon-ui/docs',
        filePath: 'packages/docs/src/lib/components/DocsLayout/index.ts',
        version: '0.2.9',
        description: 'DocsLayout component',
        props: [
          {
            name: '...DocsLayoutVariantProps',
            type: 'VariantProps',
            required: false,
            description: 'Styling variants from DocsLayoutVariantProps',
            source: {
              type: 'variant',
              name: 'DocsLayoutVariantProps'
            }
          },
          {
            name: 'children',
            type: 'Snippet',
            required: false,
            description: 'children property',
            source: {
              type: 'direct',
              name: 'DocsLayoutProps'
            }
          },
          {
            name: 'description',
            type: 'string',
            required: false,
            description: 'description property',
            source: {
              type: 'direct',
              name: 'DocsLayoutProps'
            }
          },
          {
            name: 'navigation',
            type: 'Array<{ id: string; title: string; order?: number }>',
            required: false,
            description: 'navigation property',
            source: {
              type: 'direct',
              name: 'DocsLayoutProps'
            }
          },
          {
            name: 'showToc',
            type: 'boolean',
            required: false,
            description: 'showToc property',
            source: {
              type: 'direct',
              name: 'DocsLayoutProps'
            }
          },
          {
            name: 'title',
            type: 'string',
            required: false,
            description: 'title property',
            source: {
              type: 'direct',
              name: 'DocsLayoutProps'
            }
          }
        ],
        variants: [],
        inheritance: [
          {
            typeName: 'DocsLayoutVariantProps',
            source: 'external',
            props: [
              {
                name: '...DocsLayoutVariantProps',
                type: 'DocsLayoutVariantProps',
                required: false,
                description: 'Properties inherited from DocsLayoutVariantProps',
                source: {
                  type: 'inherited',
                  name: 'DocsLayoutVariantProps'
                }
              }
            ]
          }
        ],
        stats: {
          totalProps: 6,
          directProps: 5,
          variantProps: 1,
          inheritedProps: 0
        },
        localTypes: [
          {
            name: 'DocsLayoutProps',
            type: 'interface',
            definition:
              'title?: string;\n  description?: string;\n  showToc?: boolean;\n  navigation?: Array<{ id: string; title: string; order?: number }>;\n  children?: Snippet;',
            package: '@urbicon-ui/docs',
            documentation: '',
            scope: 'local',
            usedByProps: [],
            usedByCount: 0,
            category: 'props'
          }
        ],
        crossReferences: [],
        examples: []
      },
      {
        name: 'InfoCard',
        packageName: '@urbicon-ui/docs',
        filePath: 'packages/docs/src/lib/components/InfoCard/index.ts',
        version: '0.2.9',
        description: 'InfoCard component',
        props: [
          {
            name: '...InfoCardVariantProps',
            type: 'VariantProps',
            required: false,
            description: 'Styling variants from InfoCardVariantProps',
            source: {
              type: 'variant',
              name: 'InfoCardVariantProps'
            }
          },
          {
            name: 'children',
            type: 'Snippet',
            required: false,
            description: 'children property',
            source: {
              type: 'direct',
              name: 'InfoCardProps'
            }
          },
          {
            name: 'class',
            type: 'string',
            required: false,
            description: 'class property',
            source: {
              type: 'direct',
              name: 'InfoCardProps'
            }
          },
          {
            name: 'icon',
            type: 'string',
            required: false,
            description: 'icon property',
            source: {
              type: 'direct',
              name: 'InfoCardProps'
            }
          },
          {
            name: 'title',
            type: 'string',
            required: false,
            description: 'title property',
            source: {
              type: 'direct',
              name: 'InfoCardProps'
            }
          }
        ],
        variants: [],
        inheritance: [
          {
            typeName: 'InfoCardVariantProps',
            source: 'external',
            props: [
              {
                name: '...InfoCardVariantProps',
                type: 'InfoCardVariantProps',
                required: false,
                description: 'Properties inherited from InfoCardVariantProps',
                source: {
                  type: 'inherited',
                  name: 'InfoCardVariantProps'
                }
              }
            ]
          }
        ],
        stats: {
          totalProps: 5,
          directProps: 4,
          variantProps: 1,
          inheritedProps: 0
        },
        localTypes: [
          {
            name: 'InfoCardProps',
            type: 'interface',
            definition:
              'title?: string;\n  icon?: string;\n  children?: Snippet;\n  class?: string;',
            package: '@urbicon-ui/docs',
            documentation: '',
            scope: 'local',
            usedByProps: [],
            usedByCount: 0,
            category: 'props'
          }
        ],
        crossReferences: [],
        examples: []
      },
      {
        name: 'PerformanceStats',
        packageName: '@urbicon-ui/docs',
        filePath: 'packages/docs/src/lib/components/PerformanceStats/index.ts',
        version: '0.2.9',
        description: 'PerformanceStats component',
        props: [
          {
            name: 'stats',
            type: 'StatItem[]',
            required: true,
            description: 'stats property',
            source: {
              type: 'direct',
              name: 'PerformanceStatsProps'
            }
          },
          {
            name: '...PerformanceStatsVariantProps',
            type: 'VariantProps',
            required: false,
            description: 'Styling variants from PerformanceStatsVariantProps',
            source: {
              type: 'variant',
              name: 'PerformanceStatsVariantProps'
            }
          },
          {
            name: 'children',
            type: 'Snippet',
            required: false,
            description: 'children property',
            source: {
              type: 'direct',
              name: 'PerformanceStatsProps'
            }
          }
        ],
        variants: [],
        inheritance: [
          {
            typeName: 'PerformanceStatsVariantProps',
            source: 'external',
            props: [
              {
                name: '...PerformanceStatsVariantProps',
                type: 'PerformanceStatsVariantProps',
                required: false,
                description: 'Properties inherited from PerformanceStatsVariantProps',
                source: {
                  type: 'inherited',
                  name: 'PerformanceStatsVariantProps'
                }
              }
            ]
          }
        ],
        stats: {
          totalProps: 3,
          directProps: 2,
          variantProps: 1,
          inheritedProps: 0
        },
        localTypes: [
          {
            name: 'StatItem',
            type: 'interface',
            definition:
              "value: string | number;\n  label: string;\n  unit?: string;\n  intent?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';",
            package: '@urbicon-ui/docs',
            documentation: '',
            scope: 'local',
            usedByProps: [
              {
                component: 'PerformanceStats',
                propName: 'stats',
                source: 'direct'
              }
            ],
            usedByCount: 1,
            category: 'helper'
          },
          {
            name: 'PerformanceStatsProps',
            type: 'interface',
            definition: 'stats: StatItem[];\n  children?: Snippet;',
            package: '@urbicon-ui/docs',
            documentation: '',
            scope: 'local',
            usedByProps: [],
            usedByCount: 0,
            category: 'props'
          }
        ],
        crossReferences: [],
        examples: []
      },
      {
        name: 'PlaygroundConfigurator',
        packageName: '@urbicon-ui/docs',
        filePath: 'packages/docs/src/lib/components/PlaygroundConfigurator/index.ts',
        version: '0.2.9',
        description: 'PlaygroundConfigurator component',
        props: [
          {
            name: 'children',
            type: 'Snippet<[Record<string, any>]>',
            required: true,
            description: 'children property',
            source: {
              type: 'direct',
              name: 'PlaygroundConfiguratorProps'
            }
          },
          {
            name: 'controls',
            type: 'ControlDefinition[]',
            required: true,
            description: 'controls property',
            source: {
              type: 'direct',
              name: 'PlaygroundConfiguratorProps'
            }
          },
          {
            name: 'values',
            type: 'Record<string, any>',
            required: true,
            description: 'values property',
            source: {
              type: 'direct',
              name: 'PlaygroundConfiguratorProps'
            }
          },
          {
            name: 'codeGenerator',
            type: '(values: Record<string, any>) => string',
            required: false,
            description: 'codeGenerator property',
            source: {
              type: 'direct',
              name: 'PlaygroundConfiguratorProps'
            }
          },
          {
            name: 'componentName',
            type: 'string',
            required: false,
            description: 'componentName property',
            source: {
              type: 'direct',
              name: 'PlaygroundConfiguratorProps'
            }
          },
          {
            name: 'onValuesChange',
            type: '(values: Record<string, any>) => void',
            required: false,
            description: 'onValuesChange property',
            source: {
              type: 'direct',
              name: 'PlaygroundConfiguratorProps'
            }
          },
          {
            name: 'showHeader',
            type: 'boolean',
            required: false,
            description: 'showHeader property',
            source: {
              type: 'direct',
              name: 'PlaygroundConfiguratorProps'
            }
          },
          {
            name: 'subtitle',
            type: 'string',
            required: false,
            description: 'subtitle property',
            source: {
              type: 'direct',
              name: 'PlaygroundConfiguratorProps'
            }
          },
          {
            name: 'title',
            type: 'string',
            required: false,
            description: 'title property',
            source: {
              type: 'direct',
              name: 'PlaygroundConfiguratorProps'
            }
          }
        ],
        variants: [],
        inheritance: [],
        stats: {
          totalProps: 9,
          directProps: 9,
          variantProps: 0,
          inheritedProps: 0
        },
        localTypes: [
          {
            name: 'PlaygroundConfiguratorProps',
            type: 'interface',
            definition:
              'title?: string;\n  subtitle?: string;\n  controls: ControlDefinition[];\n  values: Record<string, any>;\n  onValuesChange?: (values: Record<string, any>) => void;\n  codeGenerator?: (values: Record<string, any>) => string;\n  componentName?: string;\n  showHeader?: boolean;\n  children: Snippet<[Record<string, any>]>;',
            package: '@urbicon-ui/docs',
            documentation: '',
            scope: 'local',
            usedByProps: [],
            usedByCount: 0,
            category: 'props'
          }
        ],
        crossReferences: [],
        examples: []
      },
      {
        name: 'Section',
        packageName: '@urbicon-ui/docs',
        filePath: 'packages/docs/src/lib/components/Section/index.ts',
        version: '0.2.9',
        description: 'Section component',
        props: [
          {
            name: 'id',
            type: 'string',
            required: true,
            description: 'Section ID for navigation anchors',
            source: {
              type: 'direct',
              name: 'SectionProps'
            }
          },
          {
            name: '...SectionVariantProps',
            type: 'VariantProps',
            required: false,
            description: 'Styling variants from SectionVariantProps',
            source: {
              type: 'variant',
              name: 'SectionVariantProps'
            }
          },
          {
            name: 'badges',
            type: "Array<{\n    text: string;\n    variant?: 'soft' | 'filled';\n    intent?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';\n  }>",
            required: false,
            description: 'Badge configuration',
            source: {
              type: 'direct',
              name: 'SectionProps'
            }
          },
          {
            name: 'children',
            type: 'Snippet',
            required: false,
            description: 'Main content snippet',
            source: {
              type: 'direct',
              name: 'SectionProps'
            }
          },
          {
            name: 'class',
            type: 'string',
            required: false,
            description: 'Custom CSS class for the section element',
            source: {
              type: 'direct',
              name: 'SectionProps'
            }
          },
          {
            name: 'footerSnippet',
            type: 'Snippet',
            required: false,
            description: 'Optional footer snippet (renders a semantic <footer>)',
            source: {
              type: 'direct',
              name: 'SectionProps'
            }
          },
          {
            name: 'headingLevel',
            type: '1 | 2 | 3 | 4 | 5 | 6',
            required: false,
            description: 'Heading level for the section title, clamped to 1..6',
            source: {
              type: 'direct',
              name: 'SectionProps'
            },
            defaultValue: '2',
            values: ['1', '2', '3', '4', '5', '6']
          },
          {
            name: 'subtitle',
            type: 'string',
            required: false,
            description: 'Subtitle text (property)',
            source: {
              type: 'direct',
              name: 'SectionProps'
            }
          },
          {
            name: 'subtitleSnippet',
            type: 'Snippet',
            required: false,
            description: 'Custom subtitle snippet (overrides subtitle prop)',
            source: {
              type: 'direct',
              name: 'SectionProps'
            }
          },
          {
            name: 'title',
            type: 'string',
            required: false,
            description: 'Title text (property)',
            source: {
              type: 'direct',
              name: 'SectionProps'
            }
          },
          {
            name: 'titleSnippet',
            type: 'Snippet',
            required: false,
            description: 'Custom title snippet (overrides title prop)',
            source: {
              type: 'direct',
              name: 'SectionProps'
            }
          }
        ],
        variants: [
          {
            name: 'size',
            values: ['lg', 'md', 'sm', 'xl'],
            examples: [],
            defaultValue: 'lg'
          },
          {
            name: 'intent',
            values: ['default', 'hero', 'primary', 'secondary'],
            examples: [],
            defaultValue: 'default'
          },
          {
            name: 'centered',
            values: ['false', 'true'],
            examples: [],
            defaultValue: 'false'
          }
        ],
        inheritance: [
          {
            typeName: 'SectionVariantProps',
            source: 'external',
            props: [
              {
                name: '...SectionVariantProps',
                type: 'SectionVariantProps',
                required: false,
                description: 'Properties inherited from SectionVariantProps',
                source: {
                  type: 'inherited',
                  name: 'SectionVariantProps'
                }
              }
            ]
          }
        ],
        stats: {
          totalProps: 14,
          directProps: 10,
          variantProps: 7,
          inheritedProps: 0
        },
        localTypes: [
          {
            name: 'SectionProps',
            type: 'interface',
            definition:
              "/**\n   * Section ID for navigation anchors\n   */\n  id: string;\n\n  /**\n   * Title text (property)\n   */\n  title?: string;\n\n  /**\n   * Subtitle text (property)\n   */\n  subtitle?: string;\n\n  /**\n   * Badge configuration\n   */\n  badges?: Array<{\n    text: string;\n    variant?: 'soft' | 'filled';\n    intent?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';\n  }>;\n\n  /**\n   * Custom CSS class for the section element\n   */\n  class?: string;\n\n  /**\n   * Heading level for the section title, clamped to 1..6\n   * @default 2\n   */\n  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;\n\n  // === SNIPPETS ===\n  /**\n   * Custom title snippet (overrides title prop)\n   */\n  titleSnippet?: Snippet;\n\n  /**\n   * Custom subtitle snippet (overrides subtitle prop)\n   */\n  subtitleSnippet?: Snippet;\n\n  /**\n   * Main content snippet\n   */\n  children?: Snippet;\n\n  /**\n   * Optional footer snippet (renders a semantic <footer>)\n   */\n  footerSnippet?: Snippet;",
            package: '@urbicon-ui/docs',
            documentation: '',
            scope: 'local',
            usedByProps: [],
            usedByCount: 0,
            category: 'props'
          },
          {
            name: 'SectionVariantProps',
            type: 'type',
            definition: 'VariantProps<typeof sectionVariants>',
            package: '@urbicon-ui/docs',
            documentation: '',
            scope: 'local',
            usedByProps: [
              {
                component: 'Section',
                propName: '...SectionVariantProps',
                source: 'inherited'
              }
            ],
            usedByCount: 1,
            category: 'variant'
          }
        ],
        crossReferences: [],
        examples: []
      },
      {
        name: 'TableOfContents',
        packageName: '@urbicon-ui/docs',
        filePath: 'packages/docs/src/lib/components/TableOfContents/index.ts',
        version: '0.2.9',
        description: 'TableOfContents component',
        props: [
          {
            name: 'navigation',
            type: 'Array<{\n    id: string;\n    title: string;\n    order?: number;\n    href?: string;\n    children?: Array<{ id: string; title: string; order?: number; href?: string }>;\n  }>',
            required: true,
            description: 'navigation property',
            source: {
              type: 'direct',
              name: 'TableOfContentsProps'
            }
          },
          {
            name: 'children',
            type: 'Snippet',
            required: false,
            description: 'children property',
            source: {
              type: 'direct',
              name: 'TableOfContentsProps'
            }
          },
          {
            name: 'className',
            type: 'string',
            required: false,
            description: 'className property',
            source: {
              type: 'direct',
              name: 'TableOfContentsProps'
            }
          },
          {
            name: 'position',
            type: "'left' | 'right'",
            required: false,
            description: 'position property',
            source: {
              type: 'direct',
              name: 'TableOfContentsProps'
            },
            values: ['left', 'right']
          },
          {
            name: 'title',
            type: 'string',
            required: false,
            description: 'title property',
            source: {
              type: 'direct',
              name: 'TableOfContentsProps'
            }
          },
          {
            name: 'trackScroll',
            type: 'boolean',
            required: false,
            description: 'trackScroll property',
            source: {
              type: 'direct',
              name: 'TableOfContentsProps'
            }
          },
          {
            name: 'width',
            type: "'sm' | 'md' | 'lg'",
            required: false,
            description: 'width property',
            source: {
              type: 'direct',
              name: 'TableOfContentsProps'
            },
            values: ['sm', 'md', 'lg']
          }
        ],
        variants: [],
        inheritance: [],
        stats: {
          totalProps: 7,
          directProps: 7,
          variantProps: 0,
          inheritedProps: 0
        },
        localTypes: [
          {
            name: 'TableOfContentsProps',
            type: 'interface',
            definition:
              "title?: string;\n  navigation: Array<{\n    id: string;\n    title: string;\n    order?: number;\n    href?: string;\n    children?: Array<{ id: string; title: string; order?: number; href?: string }>;\n  }>;\n  position?: 'left' | 'right';\n  width?: 'sm' | 'md' | 'lg';\n  trackScroll?: boolean;\n  className?: string;\n  children?: Snippet;",
            package: '@urbicon-ui/docs',
            documentation: '',
            scope: 'local',
            usedByProps: [],
            usedByCount: 0,
            category: 'props'
          }
        ],
        crossReferences: [],
        examples: []
      },
      {
        name: 'TypesReference',
        packageName: '@urbicon-ui/docs',
        filePath: 'packages/docs/src/lib/components/TypesReference/index.ts',
        version: '0.2.9',
        description: 'TypesReference component',
        props: [],
        variants: [],
        inheritance: [],
        stats: {
          totalProps: 0,
          directProps: 0,
          variantProps: 0,
          inheritedProps: 0
        },
        localTypes: [],
        crossReferences: [],
        examples: []
      }
    ]
  };
</script>

<SeoMeta
  title="Component Documentation"
  description="Comprehensive documentation for 12 components"
/>

<DocsPageLayout
  title="Component Documentation"
  description="Comprehensive documentation for 12 components"
  maxWidth="7xl"
>
  <!-- Hero Section -->
  <Section
    id="overview"
    title="Component Documentation"
    subtitle="Comprehensive documentation for all 12 components"
    centered={true}
    size="xl"
  />

  <!-- Statistics Section -->
  <div class="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
    <InfoCard intent="primary" title="Components">
      <div class="text-3xl font-bold">12</div>
      <div class="text-sm opacity-80">Total components</div>
    </InfoCard>

    <InfoCard intent="secondary" title="Properties">
      <div class="text-3xl font-bold">73</div>
      <div class="text-sm opacity-80">Total properties</div>
    </InfoCard>

    <InfoCard intent="success" title="Average Props">
      <div class="text-3xl font-bold">6</div>
      <div class="text-sm opacity-80">Per component</div>
    </InfoCard>
  </div>

  <!-- Component Groups -->
  <div class="space-y-12">
    <div>
      <h2 class="mb-6 text-2xl font-bold">@urbicon-ui/docs</h2>
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card variant="elevated" padding="md" href={resolve('/docs/components/api-reference')}>
          <div class="mb-3 flex items-start justify-between">
            <h3 class="text-lg font-semibold">ApiReference</h3>
          </div>

          <p class="mb-4 line-clamp-2 text-sm text-text-secondary">
            ApiReference component with comprehensive functionality
          </p>

          <div class="flex items-center justify-between text-xs text-text-tertiary">
            <span>6 props</span>
          </div>
        </Card>

        <Card variant="elevated" padding="md" href={resolve('/docs/components/code-example')}>
          <div class="mb-3 flex items-start justify-between">
            <h3 class="text-lg font-semibold">CodeExample</h3>
          </div>

          <p class="mb-4 line-clamp-2 text-sm text-text-secondary">
            CodeExample component with comprehensive functionality
          </p>

          <div class="flex items-center justify-between text-xs text-text-tertiary">
            <span>9 props</span>
          </div>
        </Card>

        <Card variant="elevated" padding="md" href={resolve('/docs')}>
          <div class="mb-3 flex items-start justify-between">
            <h3 class="text-lg font-semibold">Components</h3>
          </div>

          <p class="mb-4 line-clamp-2 text-sm text-text-secondary">
            Components component with comprehensive functionality
          </p>

          <div class="flex items-center justify-between text-xs text-text-tertiary">
            <span>0 props</span>
          </div>
        </Card>

        <Card variant="elevated" padding="md" href={resolve('/docs/components/docs-layout')}>
          <div class="mb-3 flex items-start justify-between">
            <h3 class="text-lg font-semibold">DocsLayout</h3>
          </div>

          <p class="mb-4 line-clamp-2 text-sm text-text-secondary">
            DocsLayout component with comprehensive functionality
          </p>

          <div class="flex items-center justify-between text-xs text-text-tertiary">
            <span>6 props</span>
          </div>
        </Card>

        <Card variant="elevated" padding="md" href={resolve('/docs/components/info-card')}>
          <div class="mb-3 flex items-start justify-between">
            <h3 class="text-lg font-semibold">InfoCard</h3>
          </div>

          <p class="mb-4 line-clamp-2 text-sm text-text-secondary">
            InfoCard component with comprehensive functionality
          </p>

          <div class="flex items-center justify-between text-xs text-text-tertiary">
            <span>5 props</span>
          </div>
        </Card>

        <Card variant="elevated" padding="md" href={resolve('/docs')}>
          <div class="mb-3 flex items-start justify-between">
            <h3 class="text-lg font-semibold">PerformanceStats</h3>
          </div>

          <p class="mb-4 line-clamp-2 text-sm text-text-secondary">
            PerformanceStats component with comprehensive functionality
          </p>

          <div class="flex items-center justify-between text-xs text-text-tertiary">
            <span>3 props</span>
          </div>
        </Card>

        <Card
          variant="elevated"
          padding="md"
          href={resolve('/docs/components/playground-configurator')}
        >
          <div class="mb-3 flex items-start justify-between">
            <h3 class="text-lg font-semibold">PlaygroundConfigurator</h3>
          </div>

          <p class="mb-4 line-clamp-2 text-sm text-text-secondary">
            PlaygroundConfigurator component with comprehensive functionality
          </p>

          <div class="flex items-center justify-between text-xs text-text-tertiary">
            <span>9 props</span>
          </div>
        </Card>

        <Card variant="elevated" padding="md" href={resolve('/docs/components/section')}>
          <div class="mb-3 flex items-start justify-between">
            <h3 class="text-lg font-semibold">Section</h3>
          </div>

          <p class="mb-4 line-clamp-2 text-sm text-text-secondary">
            Section component with comprehensive functionality
          </p>

          <div class="flex items-center justify-between text-xs text-text-tertiary">
            <span>14 props</span>
          </div>
        </Card>

        <Card variant="elevated" padding="md" href={resolve('/docs/components/table-of-contents')}>
          <div class="mb-3 flex items-start justify-between">
            <h3 class="text-lg font-semibold">TableOfContents</h3>
          </div>

          <p class="mb-4 line-clamp-2 text-sm text-text-secondary">
            TableOfContents component with comprehensive functionality
          </p>

          <div class="flex items-center justify-between text-xs text-text-tertiary">
            <span>7 props</span>
          </div>
        </Card>

        <Card variant="elevated" padding="md" href={resolve('/docs/components/types-reference')}>
          <div class="mb-3 flex items-start justify-between">
            <h3 class="text-lg font-semibold">TypesReference</h3>
          </div>

          <p class="mb-4 line-clamp-2 text-sm text-text-secondary">
            TypesReference component with comprehensive functionality
          </p>

          <div class="flex items-center justify-between text-xs text-text-tertiary">
            <span>0 props</span>
          </div>
        </Card>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="mt-16 text-center text-sm text-text-tertiary">
    Last updated: {new Date('2025-08-29T20:14:35.119Z').toLocaleDateString()}
  </div>
</DocsPageLayout>
