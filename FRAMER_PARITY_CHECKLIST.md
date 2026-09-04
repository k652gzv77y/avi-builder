# Framer Parity Checklist

Use this document to select the first builder capabilities to implement. Check the
`Implement first` box for any item you want prioritized. Existing Avi Builder support
is marked separately from parity work so we do not rebuild working capabilities.

Legend: `[x]` present in Avi Builder, `[~]` partial or needs verification, `[ ]` missing
or materially below Framer's workflow.

## 1. Project, Canvas, and Pages

- [x] Pages, page folders, routes, redirects, and page settings
- [x] Canvas selection, drag/drop, zoom, guides, gap indicators, and layer tree
- [x] Desktop/tablet/phone breakpoints
- [~] Per-breakpoint layout overrides with a clear inherited-value indicator
- [ ] Independent breakpoint creation, naming, ordering, and range editing
- [ ] Framer-style breakpoint canvas switcher and viewport presets
- [ ] Per-page canvas presets and device frames
- [ ] Page transitions and route-level animation controls
- [ ] Canvas comments, pins, threads, mentions, and resolution state
- [ ] Canvas sections for organizing long pages
- [ ] Figma-style multi-select alignment/distribution/spacing inspector
- [ ] Copy/paste styles and copy/paste responsive properties between layers
- [ ] Keyboard shortcut reference and command palette for all editor actions

## 2. Layout and Responsive Design

- [x] Stack/flex layout, grid, padding, gap, alignment, wrap, and positioning
- [x] Width, height, min/max sizing, overflow, and aspect-ratio support
- [~] Visual layout controls need Framer-level density and discoverability
- [ ] Framer-style `Fill`, `Hug`, `Fixed`, and `Relative` sizing modes everywhere
- [ ] Fractional grid controls, named grid areas, and visual cell placement
- [ ] Full positioning pin controls with responsive constraints
- [ ] Auto layout suggestions when grouping or arranging selected layers
- [ ] Reorderable layout children directly on canvas
- [ ] Per-breakpoint layout change history / diff view
- [ ] Container-query and responsive-visibility rules in the visual inspector

## 3. Layers, Styles, and Visual Design

- [x] Fills, borders, radius, shadows, opacity, blend modes, filters, and transforms
- [x] Typography, uploaded fonts, color variables, layer styles, and custom CSS
- [x] Assets, asset folders, image uploads, and image rendering
- [x] Rich text, links, tables, embeds, maps, sliders, and lightboxes
- [~] Style grouping and variable UX needs a Framer-like inspector pass
- [ ] Framer-style style presets for text, colors, effects, and layout values
- [ ] Design-token browser with aliases, usage counts, and safe rename/delete
- [ ] Token modes/themes such as Light, Dark, Brand, and High Contrast
- [ ] Gradient editor with editable stops, angle, radial controls, and reuse
- [ ] Advanced backdrop blur, material/glass presets, and effect composition
- [ ] Image focal point controls and responsive image crop variants
- [ ] Video background controls, poster frames, autoplay/accessibility options
- [ ] SVG/vector editor and boolean path operations
- [ ] Icon library with searchable icon sets and property controls

## 4. Components and Variants

- [x] Reusable components, component variants, component references, and component layers
- [x] Component-related MCP controls and component rendering
- [~] Component authoring UI and exposed property model need validation
- [ ] Framer-style component property controls: text, number, boolean, enum, color, image, link, array, object, and slot
- [ ] Variant property matrix with combinations, defaults, and responsive values
- [ ] Instance-level overrides with a visible reset-to-component control
- [ ] Slots for arbitrary child content and slot fallback content
- [ ] Component package/library sharing across projects
- [ ] Component documentation, changelog, and usage panel
- [ ] Safe component upgrades with override conflict resolution
- [ ] Interactive component states that map directly to variants

## 5. Variables, Data, and Bindings

- [x] Global variables, dynamic variables, CMS variable resolution, and collection layers
- [x] CMS collections, fields, items, pagination, filters, imports, and forms
- [x] Visibility conditions and collection item values
- [~] Variable controls exist but need Framer-style binding ergonomics
- [ ] Unified variable picker for every compatible property
- [ ] Variables with typed defaults, descriptions, folders, and scope
- [ ] Formulas / computed variables with validation and dependency tracing
- [ ] Array, object, and JSON variables with visual editors
- [ ] Fetch/API variables with loading, empty, and error states
- [ ] CMS relation/reference fields with visual filtering and sorting
- [ ] Inline collection editing from canvas or preview
- [ ] Data binding inspector that shows the source and active fallback
- [ ] External data connectors beyond Supabase with secure server-side credentials

## 6. Interactions, Motion, and Code

- [x] Animation presets, animation initialization, interactions-related MCP tools, and custom code injection
- [x] HTML embeds and head/body code injection
- [~] Basic motion capability exists; Framer-style interaction authoring needs work
- [ ] Layer event panel: tap, click, hover, press, drag, scroll, viewport enter/leave, keyboard, timer
- [ ] Actions: navigate, scroll to, open overlay, set variant, set variable, play media, submit form, run code
- [ ] Transition editor with spring parameters, easing curves, delay, duration, and stagger
- [ ] Scroll transforms, parallax, sticky sections, and scroll-linked animation timeline
- [ ] Drag gestures with constraints, snap points, momentum, and drag-to-variant behavior
- [ ] Overlay system: modal, sheet, popover, tooltip, menu, anchor positioning, close rules
- [ ] Shared-layout animations between pages and component states
- [ ] Lottie and Rive controls with property bindings
- [ ] First-class Code Components with TypeScript, property controls, preview, error UI, and versioning
- [ ] Code Overrides that safely augment selected layers without replacing builder output
- [ ] Interaction testing mode with event/state inspector

## 7. CMS, Forms, Search, and App Features

- [x] CMS, collection imports, forms, pagination, filtering, and webhooks
- [x] Assets, uploads, email services, and page access/auth helpers
- [ ] Collection detail pages and automatic route templates with visual field mapping
- [ ] Draft/published CMS content workflow and scheduled publishing
- [ ] Content permissions by role, collection, field, and workflow stage
- [ ] Native search index and search UI component with result templates
- [ ] Native authentication UI blocks and protected-route rules
- [ ] User accounts, roles, invitations, and profile pages as builder primitives
- [ ] File storage picker with access policy awareness
- [ ] Form validation builder, multi-step forms, conditional fields, and submission dashboard
- [ ] Native analytics events and conversion goals

## 8. Collaboration, Versioning, and AI

- [x] Realtime cursors, active users, resource locks, activity notifications, versions, and backup/restore
- [x] AI agent runtime, provider adapters, MCP server, and design-lint foundations
- [~] Collaboration needs a product-level review against Framer's branching and review flow
- [ ] Named branches with previews, merge workflow, conflict resolution, and branch history
- [ ] Comments and approvals attached to pages/layers
- [ ] Revert individual property/layer changes, not only project-level restore
- [ ] Compare versions visually and inspect changed layers/styles/content
- [ ] Publish permissions and review gates
- [ ] AI prompt-to-page/component workflow with an editable plan and reversible changes
- [ ] AI design audit for responsiveness, contrast, semantics, broken links, and unused styles
- [ ] AI-assisted migration from Framer export/reference structure

## 9. Preview, Publish, SEO, and Operations

- [x] Publishing, deployment support, metadata, sitemap, hreflang, localization, and security-header helpers
- [x] Vercel deployment model and GitHub source integration
- [~] Current deployment is GitHub-driven; local CLI linkage is optional
- [ ] Preview URLs per branch and per editor version
- [ ] Publish dialog with changed-page summary and rollback choice
- [ ] Domain management, redirects, environment-specific configuration, and DNS status in the builder
- [ ] Page performance and image optimization audit
- [ ] Accessibility inspector: semantic landmarks, contrast, keyboard focus, labels, and heading outline
- [ ] SEO inspector: title, description, Open Graph, structured data, canonical, robots, and per-page validation
- [ ] Cookie consent, consent categories, and privacy-friendly analytics controls
- [ ] Error monitoring and deployment log viewer in the builder

## 10. Framer Features We Do Not Need to Clone Initially

- [ ] Marketplace template commerce and paid remix flow
- [ ] Framer-specific hosting/billing controls
- [ ] Every proprietary effect or one-off canvas convenience

## Suggested First Implementation Batch

Mark the items you want from this set first:

- [ ] Component property controls and instance overrides
- [ ] Variant property matrix and interactive variants
- [ ] Variables/bindings picker and computed variables
- [ ] Layer event/action panel and overlay system
- [ ] Framer-style responsive sizing and breakpoint inspector
- [ ] Code Components and layer overrides
- [ ] Design-token modes/themes and style preset browser
- [ ] Branch previews, visual version comparison, and publish workflow
- [ ] Accessibility and responsive design linting
