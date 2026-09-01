// Gupshup WhatsApp Message Composer — iframe content only (no Bloomreach chrome).
// Phase 1 configuration UI: template selection, variables, media, CTA buttons,
// campaign metadata (read-only), consent, and Preview / Send Test / Save actions.
// No campaign builder, segmentation, analytics, journey builder, AI agent, or
// customer management here — that's explicitly out of scope for this component.
//
// Implements Bloomreach's real Widget Webhook postMessage protocol, per:
// https://documentation.bloomreach.com/engagement/docs/configure-and-implement-widget-webhooks
// widget_hello -> app_hello -> widget_initialized -> (on Save/Test) app_request_state -> widget_state

// There's no Bloomreach API to enumerate a project's real customer/event
// properties (confirmed against their docs — schemas are custom per project
// and only browsable in the Data Manager UI). Bloomreach's own Personalization
// panel (Customer properties / Trigger event properties, with a "copy to
// clipboard" Jinja2 expression) is the real source of truth for this — so
// these inputs are plain text, prefilled with a plausible starting guess the
// marketer is expected to verify/replace via that panel, not a fake picker.

const TEMPLATES = [
  {
    id: "order_confirmation",
    label: "Order Confirmation",
    category: "UTILITY",
    description: "Sent after checkout completes",
    body: "Hi {{1}}, your order #{{2}} has been confirmed! Total: {{3}}",
    hasMedia: false,
    mediaType: null,
    variables: [
      { key: "1", label: "Customer Name", default: "{{ customer.first_name }}", sample: "Aarav" },
      { key: "2", label: "Order ID", default: "{{ event.properties.order_id }}", sample: "10432" },
      { key: "3", label: "Order Total", default: "{{ event.properties.order_total }}", sample: "₹2,499" }
    ],
    buttons: []
  },
  {
    id: "order_shipped",
    label: "Order Shipped",
    category: "UTILITY",
    description: "Sent when order status changes to shipped",
    body: "Your order #{{1}} is on its way! Expected delivery: {{2}}.",
    hasMedia: false,
    mediaType: null,
    variables: [
      { key: "1", label: "Order ID", default: "{{ event.properties.order_id }}", sample: "10432" },
      { key: "2", label: "ETA", default: "{{ event.properties.eta }}", sample: "6:00 PM today" }
    ],
    buttons: [
      { type: "url", label: "Track Order", urlBase: "https://track.example.com/", dynamic: true, default: "{{ event.properties.order_id }}", sample: "10432" }
    ]
  },
  {
    id: "abandoned_cart",
    label: "Abandoned Cart",
    category: "MARKETING",
    description: "Active cart or payment step viewers",
    body: "Hey {{1}}, you left {{2}} item(s) in your cart. Complete your purchase before it's gone!",
    hasMedia: true,
    mediaType: "Image",
    variables: [
      { key: "1", label: "Customer Name", default: "{{ customer.first_name }}", sample: "Priya" },
      { key: "2", label: "Item Count", default: "{{ event.properties.item_count }}", sample: "3" }
    ],
    buttons: [
      { type: "quick_reply", label: "Complete Purchase" },
      { type: "quick_reply", label: "Not Interested" }
    ]
  },
  {
    id: "product_recommendation",
    label: "Product Recommendation",
    category: "MARKETING",
    description: "High-intent browsers, no purchase in 7 days",
    body: "{{1}}, based on your interest in {{2}}, check out our latest picks for you!",
    hasMedia: true,
    mediaType: "Image",
    variables: [
      { key: "1", label: "Customer Name", default: "{{ customer.first_name }}", sample: "Rohan" },
      { key: "2", label: "Product Category", default: "{{ event.properties.product_category }}", sample: "running shoes" }
    ],
    buttons: [
      { type: "url", label: "Shop Now", urlBase: "https://shop.example.com/", dynamic: true, default: "{{ event.properties.product_category }}", sample: "running-shoes" }
    ]
  },
  {
    id: "promotional_offer",
    label: "Promotional Offer",
    category: "MARKETING",
    description: "Seasonal or limited-time discount campaigns",
    body: "{{1}}, enjoy {{2}}% off your next order — today only!",
    hasMedia: true,
    mediaType: "Image",
    variables: [
      { key: "1", label: "Customer Name", default: "{{ customer.first_name }}", sample: "Meera" },
      { key: "2", label: "Discount Percent", default: "{{ event.properties.discount_percent }}", sample: "20" }
    ],
    buttons: [
      { type: "phone", label: "Call Us", phone: "+911234567890" },
      { type: "quick_reply", label: "Redeem Now" }
    ]
  }
];

// PROPOSED — Gupshup's real production WhatsApp send endpoint is still TBD.
// This points at our own mock receiver (backend/ — WhatsAppWebhookController)
// so Bloomreach's "Test webhook" button, and eventually real sends, have a
// live 200-OK endpoint to exercise the integration against instead of 404ing
// on a placeholder domain. Swap for the real Gupshup endpoint once defined.
const GUPSHUP_SEND_URL = "https://begin-adelaide-nice-pete.trycloudflare.com/webhooks/whatsapp/send";

const BUTTON_ICON = { url: "&#128279;", phone: "&#128222;", quick_reply: "&#8617;" };

// ---------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------

const loginScreen = document.getElementById("loginScreen");
const skeletonWrap = document.getElementById("skeletonWrap");
const widgetContent = document.getElementById("widgetContent");
const loginSubmit = document.getElementById("loginSubmit");
const loginEmail = document.getElementById("loginEmail");
const loginProject = document.getElementById("loginProject");
const loginPassword = document.getElementById("loginPassword");
const signedInUser = document.getElementById("signedInUser");
const signedInProject = document.getElementById("signedInProject");

const ddTrigger = document.getElementById("ddTrigger");
const ddMenu = document.getElementById("ddMenu");
const ddTitle = document.getElementById("ddTitle");
const ddSub = document.getElementById("ddSub");
const ddCategory = document.getElementById("ddCategory");

const variablesContainer = document.getElementById("variablesContainer");
const variablesEmpty = document.getElementById("variablesEmpty");

const mediaCard = document.getElementById("mediaCard");
const mediaTypeLabel = document.getElementById("mediaTypeLabel");
const mediaUrlInput = document.getElementById("mediaUrl");
const mediaError = document.getElementById("mediaError");

const ctaCard = document.getElementById("ctaCard");
const ctaEmpty = document.getElementById("ctaEmpty");
const buttonsContainer = document.getElementById("buttonsContainer");

const consentCategory = document.getElementById("consentCategory");
const generalConsent = document.getElementById("generalConsent");
const handshakeStatus = document.getElementById("handshakeStatus");

const waMedia = document.getElementById("waMedia");
const waBubble = document.getElementById("waBubble");
const waButtons = document.getElementById("waButtons");

const validationSummary = document.getElementById("validationSummary");
const previewBtn = document.getElementById("previewBtn");
const testBtn = document.getElementById("testBtn");
const saveBtn = document.getElementById("saveBtn");
const actionFeedback = document.getElementById("actionFeedback");

const jsonToggle = document.getElementById("jsonToggle");
const jsonBlock = document.getElementById("jsonBlock");
const toast = document.getElementById("toast");

// ---------------------------------------------------------------------
// State
// ---------------------------------------------------------------------

let selectedTemplateId = TEMPLATES[0].id;
let varState = {};    // key -> plain string (a Jinja2 expression or a fixed value)
let buttonState = {}; // index -> plain string, for dynamic URL button params

function getSelectedTemplate() {
  return TEMPLATES.find((t) => t.id === selectedTemplateId);
}

function resetStateForTemplate(tpl) {
  varState = {};
  tpl.variables.forEach((v) => { varState[v.key] = v.default; });
  buttonState = {};
  tpl.buttons.forEach((b, i) => {
    if (b.dynamic) buttonState[i] = b.default;
  });
  mediaUrlInput.value = "";
}

// ---------------------------------------------------------------------
// Template dropdown
// ---------------------------------------------------------------------

function populateDropdownMenu() {
  ddMenu.innerHTML = "";
  TEMPLATES.forEach((t) => {
    const opt = document.createElement("div");
    opt.className = "dd-option";
    opt.innerHTML = `
      <div class="dd-option-main">
        <div class="dd-option-title">${t.label}</div>
        <div class="dd-option-sub">${t.description}</div>
      </div>
      <span class="category-badge ${t.category.toLowerCase()}">${t.category}</span>
    `;
    opt.addEventListener("click", () => {
      selectedTemplateId = t.id;
      resetStateForTemplate(t);
      syncDropdownTrigger();
      ddMenu.classList.remove("open");
      renderAll();
    });
    ddMenu.appendChild(opt);
  });
}

function syncDropdownTrigger() {
  const tpl = getSelectedTemplate();
  ddTitle.textContent = tpl.label;
  ddSub.textContent = tpl.description;
  ddCategory.textContent = tpl.category;
  ddCategory.className = "category-badge " + tpl.category.toLowerCase();
}

ddTrigger.addEventListener("click", (e) => {
  e.stopPropagation();
  ddMenu.classList.toggle("open");
});
document.addEventListener("click", () => ddMenu.classList.remove("open"));

// ---------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------

function renderVariableFields() {
  const tpl = getSelectedTemplate();
  variablesContainer.innerHTML = "";
  variablesEmpty.style.display = tpl.variables.length ? "none" : "block";

  tpl.variables.forEach((v) => {
    const row = document.createElement("div");
    row.className = "var-row";

    const top = document.createElement("div");
    top.className = "var-row-top";
    top.innerHTML = `<span class="var-tag">{{${v.key}}}</span><span class="var-label">${v.label}</span>`;
    row.appendChild(top);

    const input = document.createElement("input");
    input.className = "field-input mono";
    input.placeholder = "e.g. {{ customer.first_name }}";
    input.value = varState[v.key];
    row.appendChild(input);

    const hint = document.createElement("div");
    hint.className = "field-hint";
    hint.innerHTML = "Use Bloomreach's <strong>Personalization</strong> panel (Customer / Trigger event properties) to find the exact attribute, then paste its copied expression here.";
    row.appendChild(hint);

    const errorEl = document.createElement("div");
    errorEl.className = "field-error";
    errorEl.style.display = "none";
    errorEl.textContent = `${v.label} is required.`;
    row.appendChild(errorEl);

    input.addEventListener("input", () => {
      varState[v.key] = input.value;
      errorEl.style.display = "none";
      input.classList.remove("has-error");
      updatePreview();
    });

    variablesContainer.appendChild(row);
  });
}

// ---------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------

function renderMediaCard() {
  const tpl = getSelectedTemplate();
  mediaCard.style.display = tpl.hasMedia ? "block" : "none";
  if (tpl.hasMedia) {
    mediaTypeLabel.textContent = tpl.mediaType;
  }
  mediaError.style.display = "none";
}

// ---------------------------------------------------------------------
// CTA / Buttons
// ---------------------------------------------------------------------

function renderButtonsCard() {
  const tpl = getSelectedTemplate();
  const hasButtons = tpl.buttons.length > 0;
  ctaCard.style.display = hasButtons ? "block" : "none";
  ctaEmpty.style.display = hasButtons ? "none" : "flex";
  buttonsContainer.innerHTML = "";

  tpl.buttons.forEach((b, i) => {
    const row = document.createElement("div");
    row.className = "button-row";

    const icon = document.createElement("div");
    icon.className = "button-type-icon";
    icon.innerHTML = BUTTON_ICON[b.type] || "";
    row.appendChild(icon);

    const body = document.createElement("div");
    body.className = "button-row-body";

    const label = document.createElement("div");
    label.className = "button-row-label";
    label.textContent = b.label + (b.type === "url" ? " (URL button)" : b.type === "phone" ? " (Call button)" : " (Quick reply)");
    body.appendChild(label);

    if (b.type === "phone") {
      const hint = document.createElement("div");
      hint.className = "field-hint";
      hint.style.marginTop = "0";
      hint.textContent = b.phone;
      body.appendChild(hint);
    } else if (b.type === "quick_reply") {
      const hint = document.createElement("div");
      hint.className = "field-hint";
      hint.style.marginTop = "0";
      hint.textContent = "No configuration needed — sends a fixed reply payload.";
      body.appendChild(hint);
    } else if (b.type === "url" && b.dynamic) {
      const staticUrl = document.createElement("div");
      staticUrl.className = "field-hint";
      staticUrl.style.marginTop = "0";
      staticUrl.style.marginBottom = "6px";
      staticUrl.innerHTML = `<code>${b.urlBase}</code>&#8203;<span class="var-tag" style="margin-left:2px;">{{1}}</span>`;
      body.appendChild(staticUrl);

      const input = document.createElement("input");
      input.className = "field-input mono";
      input.placeholder = "e.g. {{ event.properties.order_id }}";
      input.value = buttonState[i];
      input.addEventListener("input", () => {
        buttonState[i] = input.value;
        updatePreview();
      });
      body.appendChild(input);

      const hint = document.createElement("div");
      hint.className = "field-hint";
      hint.innerHTML = "From Bloomreach's <strong>Personalization</strong> panel — copy the expression and paste it here.";
      body.appendChild(hint);
    }

    row.appendChild(body);
    buttonsContainer.appendChild(row);
  });
}

// ---------------------------------------------------------------------
// Preview + payload building
// ---------------------------------------------------------------------

function renderSampleMessage(tpl) {
  let text = tpl.body;
  tpl.variables.forEach((v) => {
    text = text.split(`{{${v.key}}}`).join(v.sample);
  });
  return text;
}

function renderPreviewButtons(tpl) {
  waButtons.innerHTML = "";
  tpl.buttons.forEach((b) => {
    const chip = document.createElement("div");
    chip.className = "wa-cta-btn";
    const iconMap = { url: "&#8599;", phone: "&#128222;", quick_reply: "" };
    chip.innerHTML = `${iconMap[b.type] || ""} ${b.label}`;
    waButtons.appendChild(chip);
  });
}

function buildWebhookObject(tpl) {
  const variables = {};
  tpl.variables.forEach((v) => { variables[v.key] = varState[v.key]; });

  const buttons = tpl.buttons.map((b, i) => {
    if (b.type === "url" && b.dynamic) {
      return { type: b.type, label: b.label, url: b.urlBase + buttonState[i] };
    }
    if (b.type === "phone") return { type: b.type, label: b.label, phone: b.phone };
    return { type: b.type, label: b.label };
  });

  const bodyTemplate = {
    channel: "whatsapp",
    template_id: tpl.id,
    template_category: tpl.category,
    language: "en",
    variables,
    media: tpl.hasMedia ? { type: (tpl.mediaType || "").toLowerCase(), url: mediaUrlInput.value || null } : null,
    buttons,
    recipient: "{{ customer.phone }}"
  };

  return {
    url: GUPSHUP_SEND_URL,
    method: "POST",
    response_handling: "json",
    auth: {
      type: "basic",
      // Bloomreach's docs show the password omitted only in the app_hello it
      // sends US (it already has it stored). The widget_state WE send back
      // must include the real value, or Bloomreach rejects it with
      // "auth_pass: This field is required."
      username: signedInUser.textContent || "demo@gupshup.io",
      password: loginPassword.value || "demopassword"
    },
    headers: [
      { name: "Content-Type", value: "application/json", type: "public" }
    ],
    body: JSON.stringify(bodyTemplate, null, 2),
    event_properties: {},
    frequency_policy: null,
    consent_category: consentCategory.value || null,
    general_consent: generalConsent.checked
  };
}

function updatePreview() {
  const tpl = getSelectedTemplate();
  waBubble.textContent = renderSampleMessage(tpl);
  waMedia.style.display = tpl.hasMedia ? "flex" : "none";
  waMedia.textContent = tpl.hasMedia ? `📷 ${tpl.mediaType} header` : "";
  renderPreviewButtons(tpl);
  jsonBlock.textContent = JSON.stringify(buildWebhookObject(tpl), null, 2);
}

function renderAll() {
  renderVariableFields();
  renderMediaCard();
  renderButtonsCard();
  updatePreview();
}

// ---------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------

function validate() {
  const tpl = getSelectedTemplate();
  const errors = [];

  const varRows = variablesContainer.querySelectorAll(".var-row");
  tpl.variables.forEach((v, i) => {
    const invalid = !varState[v.key] || !varState[v.key].trim();
    const row = varRows[i];
    const errorEl = row ? row.querySelector(".field-error") : null;
    const inputEl = row ? row.querySelector(".field-input") : null;
    if (invalid) {
      errors.push(`${v.label} is required.`);
      if (errorEl) errorEl.style.display = "flex";
      if (inputEl) inputEl.classList.add("has-error");
    } else {
      if (errorEl) errorEl.style.display = "none";
      if (inputEl) inputEl.classList.remove("has-error");
    }
  });

  if (tpl.hasMedia) {
    const url = mediaUrlInput.value.trim();
    if (!url || !url.startsWith("https://")) {
      errors.push("Media URL is required and must start with https://.");
      mediaError.style.display = "flex";
      mediaUrlInput.classList.add("has-error");
    } else {
      mediaError.style.display = "none";
      mediaUrlInput.classList.remove("has-error");
    }
  }

  return { valid: errors.length === 0, errors };
}

function showValidationSummary(errors) {
  if (!errors.length) {
    validationSummary.style.display = "none";
    return;
  }
  validationSummary.style.display = "block";
  validationSummary.innerHTML = `<strong>Fix the following before continuing:</strong><ul>${errors.map((e) => `<li>${e}</li>`).join("")}</ul>`;
}

// ---------------------------------------------------------------------
// Actions: Preview / Send Test Message / Save
// ---------------------------------------------------------------------

function setActionFeedback(text, kind) {
  actionFeedback.textContent = text;
  actionFeedback.className = "action-feedback" + (kind ? " " + kind : "");
}

function withLoading(btn, label, run) {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> ${label}`;
  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = original;
    run();
  }, 800);
}

previewBtn.addEventListener("click", () => {
  const { valid, errors } = validate();
  showValidationSummary(errors);
  if (!valid) {
    setActionFeedback("Preview blocked — see the issues above.", "error");
    return;
  }
  updatePreview();
  setActionFeedback("Preview is up to date.", "success");
  document.querySelector(".preview-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
});

testBtn.addEventListener("click", () => {
  const { valid, errors } = validate();
  showValidationSummary(errors);
  if (!valid) {
    setActionFeedback("Can't send a test message until the issues above are fixed.", "error");
    return;
  }
  setActionFeedback("");
  withLoading(testBtn, "Sending&hellip;", () => {
    setActionFeedback("Test message sent (mock) to +91XXXXXXXXXX.", "success");
    showToast("Mock webhook call sent ✓ — Gupshup would respond 202 Accepted with a message_id.");
  });
});

saveBtn.addEventListener("click", () => {
  const { valid, errors } = validate();
  showValidationSummary(errors);
  if (!valid) {
    setActionFeedback("Can't save until the issues above are fixed.", "error");
    return;
  }
  setActionFeedback("");
  withLoading(saveBtn, "Saving&hellip;", () => {
    setActionFeedback("Saved. Bloomreach's own Save button on this node will persist the same configuration.", "success");
    showToast("Widget configuration saved.");
  });
});

function showToast(message, duration = 3200) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), duration);
}

jsonToggle.addEventListener("click", () => {
  const visible = jsonBlock.style.display !== "none";
  jsonBlock.style.display = visible ? "none" : "block";
  jsonToggle.innerHTML = (visible ? "&#9656; Advanced: view" : "&#9662; Advanced: hide") + " webhook payload";
});

mediaUrlInput.addEventListener("input", () => {
  mediaError.style.display = "none";
  mediaUrlInput.classList.remove("has-error");
  updatePreview();
});
consentCategory.addEventListener("input", updatePreview);
generalConsent.addEventListener("change", updatePreview);

// ---------------------------------------------------------------------
// Mocked sign-in gate -> loading skeleton -> content
// ---------------------------------------------------------------------

loginSubmit.addEventListener("click", () => {
  signedInUser.textContent = loginEmail.value || "demo@gupshup.io";
  signedInProject.textContent = loginProject.value || "default";
  loginScreen.style.display = "none";
  skeletonWrap.style.display = "block";

  setTimeout(() => {
    skeletonWrap.style.display = "none";
    widgetContent.style.display = "block";
    updatePreview();
  }, 650);
});

document.getElementById("signOutLink").addEventListener("click", (e) => {
  e.preventDefault();
  widgetContent.style.display = "none";
  loginScreen.style.display = "flex";
  loginPassword.value = "";
});

// ---------------------------------------------------------------------
// Bloomreach Widget Webhook postMessage handshake
// https://documentation.bloomreach.com/engagement/docs/configure-and-implement-widget-webhooks
// ---------------------------------------------------------------------

const SUPPORTED_VERSION = 1;
let appOrigin = null;

function isEmbedded() {
  return window.parent && window.parent !== window;
}

function sendToParent(message) {
  if (!isEmbedded()) return;
  // Bloomreach's docs hardcode a single origin for their example, but
  // Bloomreach runs on multiple regional clusters — using '*' for the
  // handshake and then locking to event.origin afterwards is more robust
  // than guessing a fixed domain. PROPOSED deviation from the doc's
  // literal example, for that reason.
  window.parent.postMessage(message, appOrigin || "*");
}

function setHandshakeStatus(state, text) {
  handshakeStatus.className = "handshake-status " + state;
  handshakeStatus.textContent = text;
}

function handleParentMessage(event) {
  const msg = event.data;
  if (!msg || typeof msg !== "object" || !msg.message_type) return;

  if (msg.message_type === "app_hello") {
    appOrigin = event.origin;
    setHandshakeStatus("connected", "Connected to Bloomreach");

    if (msg.webhook) hydrateFromExistingWebhook(msg.webhook);
    sendToParent({ message_type: "widget_initialized" });
  } else if (msg.message_type === "app_reject") {
    setHandshakeStatus("rejected", "Bloomreach widget API version not supported (got v" + SUPPORTED_VERSION + ")");
  } else if (msg.message_type === "app_request_state") {
    sendToParent({
      message_type: "widget_state",
      webhook: buildWebhookObject(getSelectedTemplate()),
      widget_state: { selectedTemplateId }
    });
  } else if (msg.message_type === "errors") {
    console.warn("Bloomreach validation errors:", msg.errors);
  }
}

// Best-effort: if Bloomreach is editing an existing node, try to re-select
// the template this webhook was previously configured for.
function hydrateFromExistingWebhook(webhook) {
  try {
    const parsedBody = JSON.parse(webhook.body || "{}");
    if (parsedBody.template_id && TEMPLATES.some((t) => t.id === parsedBody.template_id)) {
      selectedTemplateId = parsedBody.template_id;
      const tpl = getSelectedTemplate();
      resetStateForTemplate(tpl);
      syncDropdownTrigger();

      if (parsedBody.variables) {
        tpl.variables.forEach((v) => {
          if (parsedBody.variables[v.key] != null) varState[v.key] = parsedBody.variables[v.key];
        });
      }
      if (parsedBody.buttons) {
        tpl.buttons.forEach((b, i) => {
          if (b.dynamic && parsedBody.buttons[i] && parsedBody.buttons[i].url) {
            buttonState[i] = parsedBody.buttons[i].url.replace(b.urlBase, "");
          }
        });
      }
      if (parsedBody.media && parsedBody.media.url) mediaUrlInput.value = parsedBody.media.url;
    }
  } catch (e) {
    // Not JSON, or shape changed — fall back to defaults silently.
  }
  if (webhook.consent_category) consentCategory.value = webhook.consent_category;
  if (typeof webhook.general_consent === "boolean") generalConsent.checked = webhook.general_consent;
  renderAll();
}

window.addEventListener("message", handleParentMessage);

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------

resetStateForTemplate(getSelectedTemplate());
populateDropdownMenu();
syncDropdownTrigger();
renderAll();

if (isEmbedded()) {
  sendToParent({
    min_supported_version: SUPPORTED_VERSION,
    max_supported_version: SUPPORTED_VERSION,
    message_type: "widget_hello"
  });
} else {
  setHandshakeStatus("standalone", "Standalone preview — not embedded in Bloomreach");
}
