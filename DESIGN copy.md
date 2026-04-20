# Design System Strategy

## 1. Overview & Creative North Star
**Creative North Star: "The Trusted Path"**

This design system moves beyond the rigid, utilitarian nature of traditional insurance and financial platforms. Our mission is to blend **authority with accessibility**. By utilizing a "High-End Editorial" approach, we transform complex data into a narrative-driven experience. 

The aesthetic is characterized by **Organic Precision**: the cleanliness of a Swiss grid interrupted by organic, rounded shapes and high-contrast typography. We break the "template" feel through intentional asymmetry—letting images bleed past container boundaries and using overlapping elements to create a sense of movement and professional vitality.

---

## 2. Colors
Our palette is a sophisticated interplay of deep, authoritative tones and energetic accents.

*   **Primary (`#006874`) & Primary Container (`#49b2c1`):** The Teal/Cyan core. Use these for momentum-building elements.
*   **Secondary (`#8c4f00`) & Secondary Container (`#f7941d`):** The Orange accent. Reserved strictly for conversion points and critical highlights.
*   **Tertiary (`#435d98`):** The Dark Blue anchor. Provides the "Professional" weight to the "Friendly" aesthetic.

### The "No-Line" Rule
Standard UI relies on gray borders to separate content. This design system prohibits 1px solid borders for sectioning. Boundaries must be defined by:
1.  **Background Shifts:** Transitioning from `surface` to `surface-container-low`.
2.  **Tonal Transitions:** Using subtle, large-scale gradients to guide the eye.

### Surface Hierarchy & Nesting
Treat the UI as physical layers. An interface should never feel flat.
*   **Base:** `surface` (#f8f9ff)
*   **Sectioning:** `surface-container-low` (#f0f4fd)
*   **Content Cards:** `surface-container-lowest` (#ffffff) to create a soft "pop" against the background.

### The "Glass & Gradient" Rule
To add visual "soul," primary CTAs and Hero sections should utilize linear gradients (e.g., `primary` to `primary_container`). For floating navigation or over-image labels, use **Glassmorphism**: apply a semi-transparent surface color with a `backdrop-filter: blur(20px)`.

---

## 3. Typography
We use a dual-font strategy to balance character with readability.

*   **Display & Headline (Plus Jakarta Sans):** A modern sans-serif with a wide stance. Used for high-impact editorial moments. Its geometric nature provides the "Professional" side of the aesthetic.
*   **Title, Body & Label (Be Vietnam Pro):** Chosen for its exceptional legibility in both English and Thai. The slightly taller x-height ensures that instructional text remains approachable.

**The Hierarchy of Trust:**
*   **Display-Lg (3.5rem):** Used for singular hero statements.
*   **Headline-Md (1.75rem):** Used for section headers to establish clear information architecture.
*   **Body-Lg (1rem):** Our standard for readability, ensuring the "Friendly" brand promise is met through ease of consumption.

---

## 4. Elevation & Depth
We reject the heavy drop-shadows of the early web. Depth in this system is achieved through **Tonal Layering**.

*   **The Layering Principle:** Instead of a shadow, place a `surface-container-lowest` card on a `surface-container-low` background. The slight shift in value creates a "Soft Lift."
*   **Ambient Shadows:** When an element must float (like a FAB or a Modal), use an extra-diffused shadow. 
    *   *Spec:* `0px 12px 32px rgba(17, 48, 105, 0.06)`. Note the use of the Tertiary color (#113069) in the shadow to keep it "cool" and integrated.
*   **The "Ghost Border" Fallback:** If accessibility requires a stroke, use `outline-variant` at 15% opacity. Never use a 100% opaque border.
*   **Organic Masking:** As seen in the reference images, use large, rounded radii (`xl`: 1.5rem or `full`) to mask images into organic blobs, breaking the rectangular monotony of the screen.

---

## 5. Components

### Buttons
*   **Primary:** Gradient fill (`primary` to `primary_container`), `full` roundedness, white text. Bold and high-contrast.
*   **Secondary:** `surface-container-highest` background with `on-surface` text. For secondary actions.
*   **Tertiary:** No background. `primary` text color with a small icon suffix to denote action.

### Input Fields
*   **Style:** Background-filled (`surface-container-high`) rather than outlined. 
*   **Shape:** `md` (0.75rem) corner radius.
*   **Interaction:** On focus, the background shifts to `surface-container-lowest` with a 2px `primary` "Ghost Border" (20% opacity).

### Cards & Lists
*   **Forbid Dividers:** Use `1.5rem` to `2rem` of vertical white space to separate list items.
*   **Visual Grouping:** Group related items inside a `surface-container-low` wrapper with `xl` (1.5rem) rounded corners.

### Feature Icons
*   Encapsulate icons within a circular `surface-variant` container. Use the `primary` or `secondary` color for the icon glyph to draw the eye to key value propositions.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use overlapping elements. Let a photo slightly "cut into" the section below it.
*   **Do** use high-contrast typography scales (e.g., a massive Headline-Lg next to a modest Body-Md).
*   **Do** utilize the `secondary` orange (#f7941d) specifically for "Buy" or "Contact" triggers.
*   **Do** embrace white space. If a layout feels "crowded," double the spacing between elements.

### Don't:
*   **Don't** use black (`#000000`). Use `on-surface` (#171c22) for all text to maintain a premium feel.
*   **Don't** use sharp corners. Every container must have at least a `sm` (0.25rem) radius; heroes and cards should use `xl` (1.5rem).
*   **Don't** use standard 1px gray dividers. They create "visual noise" and break the editorial flow.
*   **Don't** use "Drop Shadows" on buttons. Use tonal contrast to make them stand out.