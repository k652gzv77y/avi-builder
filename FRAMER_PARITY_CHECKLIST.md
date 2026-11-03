# Framer Parity Checklist

Use this document to select the first builder capabilities to implement. Check the
`Implement first` box for any item you want prioritized. Existing Avi Builder support
is marked separately from parity work so we do not rebuild working capabilities.

Legend: `[x]` present in Avi Builder, `[~]` partial or needs verification, `[ ]` missing
or materially below Framer's workflow.

## 1. Project, Canvas, and Pages

- [x] Pages, page folders, routes, redirects, and page settings
- [x] Canvas selection, zoom, layer tree, and stack/flex sibling reorder with gap indicators
- [x] Free-form drag, resize handles, and arrow-key nudge for absolute, fixed, and frame children
- [x] Drag and resize snap to parent and sibling edges and centers, with temporary alignment guides while the gesture is active
- [x] Persistent canvas rulers in page pixels, with zoom-aware ticks, selection ranges, and a show/hide toggle
- [ ] Smart-guide panel listing active guides
- [x] Desktop/tablet/phone breakpoints
- [x] Per-breakpoint layout overrides with a clear inherited-value indicator
- [ ] Independent breakpoint creation, naming, ordering, and range editing
- [ ] Framer-style breakpoint canvas switcher and viewport presets
- [ ] Per-page canvas presets and device frames
- [ ] Page transitions and route-level animation controls
- [ ] Canvas comments, pins, threads, mentions, and resolution state
- [ ] Canvas sections for organizing long pages
- [x] Shift/Cmd-click and marquee multi-select, plus align and distribute for free-form layers
- [ ] Spacing inspector and alignment for stack or grid children
- [ ] Copy/paste styles and copy/paste responsive properties between layers
- [ ] Keyboard shortcut reference and command palette for all editor actions

## 2. Layout and Responsive Design

- [x] Stack/flex layout, grid, padding, gap, alignment, wrap, and positioning
- [x] Width, height, min/max sizing, overflow, and aspect-ratio support
- [~] Visual layout controls need Framer-level density and discoverability
- [x] Framer-style `Fill`, `Fit`, `Fixed`, `Relative`, and `Viewport` sizing for width and height (`Fit`, not Hug)
- [ ] Fractional grid controls, named grid areas, and visual cell placement
- [ ] Full positioning pin controls with responsive constraints
- [ ] Auto layout suggestions when grouping or arranging selected layers
- [x] Reorderable layout children directly on canvas (stack and grid siblings; absolute children move instead)
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
- [x] Component property controls on the primary: text, rich text, number, boolean, enum, color, image, link, audio, video, icon, array, object, and slot
- [x] Framer-style component property controls: text, number, boolean, enum, color, image, link, array, object, and slot
- [x] Variant property matrix: each variant can store property defaults. Instances use that variant's defaults, then their own overrides. Stack defaults keep tablet and phone values. Canvas, preview, and published pages share that order
- [x] Instance-level overrides with a visible reset-to-component control (one property, or all overrides)
- [x] Slots for child content and fallback. A frame's children are the fallback. An instance can replace that content and reset it. Canvas, preview, and published pages render the override or the fallback
- [ ] Component package/library sharing across projects
- [ ] Component documentation, changelog, and usage panel
- [ ] Safe component upgrades with override conflict resolution
- [x] Interactive component states that map directly to variants. Hover and Pressed switch a resting instance for the gesture, then return. Tap, Hover, and Press actions can target any variant. The active variant's property defaults apply on the canvas, in preview, and on published pages

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
- [~] Tap, Hover, Press, Drag, Keyboard, and Timer can be authored with Navigate, Set Variant, Open Overlay, Scroll to, and Set Variable. Viewport leave and the rest of Framer's interaction model are still open
- [~] Layer event panel: Tap, Hover (mouse enter), Press (pointer down), Drag (free, horizontal, vertical, or locked to the first axis; optional parent or pixel bounds; snap points; a short momentum glide), Keyboard (key down or key up, with Shift, Cmd, Alt, and Ctrl), and Timer (delay, and repeat with an interval) can be added, edited, and deleted on a layer, including a component instance. Appear, Scroll, and Load remain animation events. Viewport leave is not offered
- [~] Actions: Navigate to a page or URL, Set Variant, Open/Close Overlay (modal, popover, and tooltip chrome; sheet and menu are partial), Scroll to a layer or the top or bottom of the page, and Set Variable (project variable and value) are stored on the event and run in preview for Tap, Hover, Press, Drag, Keyboard, and Timer. Hover and Press Set Variant return to the previous variant when the gesture ends. Tap stays. A Drag Set Variant can keep the variant after a direction and distance (like Tap) or return when the drag ends (like Hover). Other Drag actions run when the drag starts, on release, or both. Play media, submit form, and run code are not offered
- [x] Transition editor on Set Variant and Open/Close Overlay: duration, delay, easing (ease, ease in, ease out, ease in out, linear, and cubic-bezier), or a spring (stiffness, damping, mass), plus stagger between the layer's direct children. An omitted transition stays instant, so existing projects do not move until an author edits one. Preview and published pages play it for Tap, Hover, Press, and Drag Set Variant, including the Hover, Press, and drag-to-variant return. Opening, closing, and dismissing an overlay use it too (a Close Overlay action can set its own; otherwise it reuses the open transition). The design canvas still swaps immediately. Variant changes crossfade the outgoing tree rather than interpolating each nested property
- [ ] Scroll transforms, parallax, sticky sections, and scroll-linked animation timeline
- [x] Drag gestures with axis lock, optional parent or pixel bounds, snap points, a short momentum glide on release, and drag-to-variant thresholds. The gesture runs in preview and on published pages. The design canvas still uses the pointer to select and move free-form layers
- [x] Overlay system: modal dialog (centered card, backdrop, focus trap) and anchored popover and tooltip (flip and clamp, optional anchor layer) with Escape, outside click, return focus, and Close Overlay. Works from Tap, Hover, Press, Drag, Keyboard, and Timer in preview and on published pages
- [~] Sheet (bottom panel, no drag-to-dismiss) and menu (anchored like a popover, no arrow-key item navigation) share that overlay plumbing
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

- [x] Component property controls and instance overrides (text, number, boolean, enum, color, image, link, array, object, slot, and the existing media controls)
- [x] Variant property matrix and interactive variants. Each variant stores property defaults. Hover, Press, and Tap switch the active variant and use those defaults
- [ ] Variables/bindings picker and computed variables
- [~] Layer event/action panel: Tap, Hover, Press, Drag, Keyboard, or Timer to Navigate, Set Variant, Open Overlay, Scroll to, or Set Variable. Drag can switch variants from a direction and distance. Modal, popover, and tooltip overlays can be created from the event. Sheet and menu are partial
- [x] Framer-style responsive sizing and breakpoint inspector
- [ ] Code Components and layer overrides
- [ ] Design-token modes/themes and style preset browser
- [ ] Branch previews, visual version comparison, and publish workflow
- [ ] Accessibility and responsive design linting
