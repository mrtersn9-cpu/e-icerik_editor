# Agent Instructions

## TTKB-Facing Output Policy

This editor is private until a learner preview or SCORM package is produced. Every learner-facing preview, exported HTML, and SCORM output must be treated as material that may be reviewed by TTKB.

The active policy is broader than visual styling. Follow [docs/TTKB-UYUM-POLITIKASI.md](docs/TTKB-UYUM-POLITIKASI.md) for every change that can affect preview, exported HTML, learner runtime, package presets, generated content, assessment logic, media, metadata, or SCORM output.

Always do a TTKB risk pass before finalizing work that touches learner-facing behavior. Report any discovered non-compliant or risky items to the user, even if the requested change was unrelated. If no issue is found, say that the TTKB pass did not find a new learner-facing risk.

Do not create SCORM-only or preview-only visual/behavior patches. The editor is the source of truth: anything TTKB-related must be enforced while creating/editing the content in the editor data and controls, then preview and SCORM should render that same editor-approved result.

The product exports only SCORM 1.2 packages. Do not add or expose SCORM 2004, xAPI, cmi5, LTI, standalone learner package modes, or external tracking in the editor unless the user explicitly changes this product rule.

External links are allowed when production needs them, but SCORM export must warn the user when external HTTP/HTTPS links or embeds are present so they can review TTKB/KVKK/telif risk before packaging.

Button animation is package-level. All buttons that belong to the same visual package must use the same TTKB-safe hover/press motion profile; do not assign unrelated per-button animation styles inside the same package.

Activities may override the package's default button animation profile. If an activity-level button animation profile is changed, every button in that activity must receive the same profile while keeping the selected package's color/style system.

When changing anything that can appear in preview or SCORM output, enforce all of these review dimensions:

- Legal and ethical suitability: no unlawful, discriminatory, exclusionary, unsafe, violent, obscene, privacy-violating, advertising, or copyright-infringing content.
- Scientific and educational accuracy: no factual errors, concept mistakes, inconsistent terminology, unsupported claims, or missing source/citation requirements.
- Curriculum alignment: content, examples, activities, skills, values, difficulty, and scope must match the relevant grade level, learning outcomes, and program boundaries.
- Assessment quality: instructions must be clear; questions must be valid, age-appropriate, unambiguous, answerable from the content, and free of answer-pattern clues or accidental hints.
- Language quality: spelling, punctuation, grammar, terminology, tone, and expression must be clear, consistent, and appropriate for the target grade level.
- Visual and interaction design: layout, hierarchy, icons, colors, animations, popups, feedback, and navigation must support learning without creating unnecessary cognitive load.
- Accessibility and universal design: support sufficient contrast, keyboard/screen-reader friendly labels where applicable, non-color-only feedback, readable text, and meaningful alternative text for important media.
- Electronic content quality: SCORM/HTML output must work reliably without hidden interaction leaks, broken buttons, broken links, stale layers, external tracking, unnecessary permissions, or platform-specific failures.
- Audio/video/media quality: media must be clear, synced, age-appropriate, non-distracting, and pedagogically relevant.

Minimum visual/runtime rules:
- Keep typography systematic. Same-role text such as button labels, menu labels, headings, body text, feedback titles, and feedback bodies must keep consistent font size, weight, color, and family across scenes and layers.
- Avoid arbitrary font-size and color changes between packages. Package themes may change tone, but they must not break readability or hierarchy.
- Use accessible contrast. Text and meaningful icons must remain readable against their backgrounds and should follow WCAG contrast expectations.
- Prefer calm, educational palettes. Avoid eye-straining neon, excessive glow, heavy blur, decorative clutter, or effects that increase cognitive load.
- Feedback and menu popups should be visually solid and readable. Any dim layer behind them must keep the base activity readable enough for students to check their answers.
- Use stable semantic icons in learner-facing output: correct `✓`, incorrect `×`, warning `!`, solution/show-answer `✎`, menu `☰`, home `⌂`, restart `↻`.
- Layer content must render above base-layer content. Base-layer drag/drop or click interactions must not leak cursor states or interaction blockers over open popups.
- Button packages and answer-layer presets must be normalized for TTKB-safe SCORM rendering, even if the editor-side picker uses expressive names or thumbnails.

If this policy changes, update this file first so future agents follow the same rule.
