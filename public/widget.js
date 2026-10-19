/*
 * AEO Engine embeddable widget.
 *
 * Usage (paste before </body>):
 *   <script src="https://your-domain.com/widget.js" data-agent="SHARE_TOKEN" async></script>
 *
 * Optional data attributes:
 *   data-position="left|right"   default: right
 *   data-color="#4f46e5"         launcher background
 *   data-title="Chat with us"    launcher tooltip
 *
 * No dependencies, no build step. The iframe is created on first click so the
 * host page pays no cost for visitors who never open the widget.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var token = script.getAttribute("data-agent");
  if (!token) {
    console.warn("[AEO widget] Missing data-agent attribute.");
    return;
  }

  // Resolve the app origin from the script's own src so the snippet works
  // unchanged across localhost and production.
  var origin;
  try {
    origin = new URL(script.src, window.location.href).origin;
  } catch (e) {
    console.warn("[AEO widget] Could not resolve script origin.");
    return;
  }

  var position = script.getAttribute("data-position") === "left" ? "left" : "right";
  var color = script.getAttribute("data-color") || "#4f46e5";
  var title = script.getAttribute("data-title") || "Chat with us";

  var PANEL_WIDTH = 400;
  var PANEL_HEIGHT = 620;
  var MOBILE_BREAKPOINT = 520;
  var MARGIN = 20;
  var Z = 2147483000;

  var open = false;
  var iframe = null;

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.setAttribute("aria-label", title);
  launcher.title = title;
  launcher.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
    "</svg>";

  Object.assign(launcher.style, {
    position: "fixed",
    bottom: MARGIN + "px",
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    border: "none",
    background: color,
    color: "#fff",
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.24)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: String(Z + 1),
    transition: "transform 160ms ease, box-shadow 160ms ease",
    padding: "0",
  });

  if (position === "left") launcher.style.left = MARGIN + "px";
  else launcher.style.right = MARGIN + "px";

  launcher.addEventListener("mouseenter", function () {
    launcher.style.transform = "scale(1.06)";
  });
  launcher.addEventListener("mouseleave", function () {
    launcher.style.transform = "scale(1)";
  });

  function panelStyles() {
    var compact = window.innerWidth < MOBILE_BREAKPOINT;
    var styles = {
      position: "fixed",
      zIndex: String(Z),
      border: "none",
      borderRadius: "16px",
      boxShadow: "0 18px 48px rgba(15, 23, 42, 0.22)",
      background: "#fff",
      overflow: "hidden",
      transition: "opacity 160ms ease, transform 160ms ease",
      opacity: "1",
      transform: "translateY(0)",
    };

    if (compact) {
      styles.left = "12px";
      styles.right = "12px";
      styles.bottom = "88px";
      styles.width = "auto";
      styles.height = Math.min(PANEL_HEIGHT, window.innerHeight - 120) + "px";
    } else {
      styles.width = PANEL_WIDTH + "px";
      styles.height = PANEL_HEIGHT + "px";
      styles.bottom = MARGIN + 68 + "px";
      if (position === "left") styles.left = MARGIN + "px";
      else styles.right = MARGIN + "px";
    }
    return styles;
  }

  function createPanel() {
    iframe = document.createElement("iframe");
    iframe.src = origin + "/embed/" + encodeURIComponent(token);
    iframe.title = title;
    iframe.setAttribute("allow", "clipboard-write");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.style.display = "block";
    Object.assign(iframe.style, {});

    var panel = document.createElement("div");
    panel.setAttribute("data-aeo-panel", "true");
    Object.assign(panel.style, panelStyles());

    var wrapper = document.createElement("div");
    wrapper.style.width = "100%";
    wrapper.style.height = "100%";
    wrapper.appendChild(iframe);
    panel.appendChild(wrapper);

    document.body.appendChild(panel);
    return panel;
  }

  var panel = null;

  function toggle() {
    if (!panel) panel = createPanel();

    open = !open;
    panel.style.display = open ? "block" : "none";

    if (open) {
      // Hide the launcher while the panel is open on small screens so it does
      // not overlap the composer.
      launcher.style.opacity = "0";
      launcher.style.pointerEvents = "none";
    } else {
      launcher.style.opacity = "1";
      launcher.style.pointerEvents = "auto";
    }
  }

  launcher.addEventListener("click", toggle);

  window.addEventListener("resize", function () {
    if (panel && open) Object.assign(panel.style, panelStyles());
  });

  function mount() {
    document.body.appendChild(launcher);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
