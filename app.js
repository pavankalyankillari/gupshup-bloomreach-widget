// Gupshup WhatsApp Widget — iframe content only (no Bloomreach chrome).
// This is what a marketer sees embedded inside a Bloomreach campaign node
// when they add the "Gupshup" step, analogous to the Rokt widget PoC.
//
// Implements Bloomreach's real Widget Webhook postMessage protocol, per:
// https://documentation.bloomreach.com/engagement/docs/configure-and-implement-widget-webhooks
// widget_hello -> app_hello -> widget_initialized -> (on Save/Test) app_request_state -> widget_state

const TEMPLATES = [
  {
    id: "order_confirmation",
    label: "Order Confirmation",
    description: "Sent after checkout completes",
    hasMedia: false,
    variables: [
      { key: "1", label: "Customer Name", placeholder: "{{ customer.first_name }}", default: "{{ customer.first_name }}" },
      { key: "2", label: "Order ID", placeholder: "{{ event.properties.order_id }}", default: "{{ event.properties.order_id }}" },
      { key: "3", label: "Order Total", placeholder: "{{ event.properties.order_total }}", default: "{{ event.properties.order_total }}" }
    ]
  },
  {
    id: "cart_abandonment_reminder",
    label: "Cart Abandonment Reminder",
    description: "Active cart or payment step viewers",
    hasMedia: true,
    variables: [
      { key: "1", label: "Customer Name", placeholder: "{{ customer.first_name }}", default: "{{ customer.first_name }}" },
      { key: "2", label: "Item Count", placeholder: "{{ event.properties.item_count }}", default: "{{ event.properties.item_count }}" }
    ]
  },
  {
    id: "delivery_update",
    label: "Delivery Update",
    description: "Sent when order status changes to out-for-delivery",
    hasMedia: false,
    variables: [
      { key: "1", label: "Order ID", placeholder: "{{ event.properties.order_id }}", default: "{{ event.properties.order_id }}" },
      { key: "2", label: "ETA", placeholder: "{{ event.properties.eta }}", default: "{{ event.properties.eta }}" }
    ]
  },
  {
    id: "product_recommendation",
    label: "Product Recommendation",
    description: "High-intent browsers, no purchase in 7 days",
    hasMedia: true,
    variables: [
      { key: "1", label: "Customer Name", placeholder: "{{ customer.first_name }}", default: "{{ customer.first_name }}" },
      { key: "2", label: "Product Category", placeholder: "{{ event.properties.product_category }}", default: "{{ event.properties.product_category }}" }
    ]
  }
];

// PROPOSED — Gupshup's real WhatsApp send endpoint is TBD; placeholder only.
const GUPSHUP_SEND_URL = "https://api.gupshup.io/br/messages/whatsapp";

const ddTrigger = document.getElementById("ddTrigger");
const ddMenu = document.getElementById("ddMenu");
const ddTitle = document.getElementById("ddTitle");
const ddSub = document.getElementById("ddSub");
const variablesContainer = document.getElementById("variablesContainer");
const mediaField = document.getElementById("mediaField");
const mediaUrlInput = document.getElementById("mediaUrl");
const previewTemplateName = document.getElementById("previewTemplateName");
const jsonBlock = document.getElementById("jsonBlock");
const jsonToggle = document.getElementById("jsonToggle");
const flowActionLabel = document.getElementById("flowActionLabel");
const actionSend = document.getElementById("actionSend");
const actionSkip = document.getElementById("actionSkip");
const consentCategory = document.getElementById("consentCategory");
const generalConsent = document.getElementById("generalConsent");
const handshakeStatus = document.getElementById("handshakeStatus");

let selectedTemplateId = TEMPLATES[0].id;
let selectedAction = "send_message";
let currentVarValues = {};

function getSelectedTemplate() {
  return TEMPLATES.find((t) => t.id === selectedTemplateId);
}

function populateDropdownMenu() {
  ddMenu.innerHTML = "";
  TEMPLATES.forEach((t) => {
    const opt = document.createElement("div");
    opt.className = "dd-option";
    opt.innerHTML = `<div class="dd-option-title">${t.label}</div><div class="dd-option-sub">${t.description}</div>`;
    opt.addEventListener("click", () => {
      selectedTemplateId = t.id;
      syncDropdownTrigger();
      ddMenu.classList.remove("open");
      renderVariableFields();
      updatePreview();
    });
    ddMenu.appendChild(opt);
  });
}

function syncDropdownTrigger() {
  const tpl = getSelectedTemplate();
  ddTitle.textContent = tpl.label;
  ddSub.textContent = tpl.description;
}

ddTrigger.addEventListener("click", (e) => {
  e.stopPropagation();
  ddMenu.classList.toggle("open");
});

document.addEventListener("click", () => ddMenu.classList.remove("open"));

function renderVariableFields() {
  const tpl = getSelectedTemplate();
  variablesContainer.innerHTML = "";
  currentVarValues = {};

  tpl.variables.forEach((v) => {
    currentVarValues[v.key] = v.default;

    const row = document.createElement("div");
    row.className = "var-row";

    const tag = document.createElement("span");
    tag.className = "var-tag";
    tag.textContent = `{{${v.key}}}`;

    const wrap = document.createElement("div");
    wrap.className = "var-row-body";

    const label = document.createElement("div");
    label.className = "var-label";
    label.textContent = v.label;

    const input = document.createElement("input");
    input.className = "field-input";
    input.placeholder = v.placeholder;
    input.value = v.default;
    input.addEventListener("input", () => {
      currentVarValues[v.key] = input.value;
      updatePreview();
    });

    wrap.appendChild(label);
    wrap.appendChild(input);
    row.appendChild(tag);
    row.appendChild(wrap);
    variablesContainer.appendChild(row);
  });

  mediaField.style.display = tpl.hasMedia ? "block" : "none";
}

// Builds Bloomreach's actual Widget Webhook "webhook" object — this is what
// gets sent back as widget_state.webhook, and is what Bloomreach's own
// webhook engine calls at send time (rendering the jinja2 body template
// with real per-customer values). Not a Gupshup-invented payload shape.
function buildWebhookObject(tpl) {
  const bodyTemplate = {
    channel: "whatsapp",
    template_id: tpl.id,
    language: "en",
    variables: { ...currentVarValues },
    media: tpl.hasMedia ? { type: "image", url: mediaUrlInput.value || null } : null,
    recipient: "{{ customer.phone }}",
    action: selectedAction
  };

  return {
    url: GUPSHUP_SEND_URL,
    method: "POST",
    response_handling: "json",
    auth: {
      type: "basic",
      // password intentionally omitted here — Bloomreach stores it securely
      // server-side once entered; the widget never re-reads it back in plaintext.
      username: (document.getElementById("signedInUser") || {}).textContent || "demo@gupshup.io"
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
  previewTemplateName.textContent = tpl.label;
  jsonBlock.textContent = JSON.stringify(buildWebhookObject(tpl), null, 2);
}

function setAction(action) {
  selectedAction = action;
  actionSend.classList.toggle("active", action === "send_message");
  actionSkip.classList.toggle("active", action === "skip_message");
  flowActionLabel.textContent = action === "send_message" ? "Send Message" : "Skip Message";
  updatePreview();
}

actionSend.addEventListener("click", () => setAction("send_message"));
actionSkip.addEventListener("click", () => setAction("skip_message"));

jsonToggle.addEventListener("click", () => {
  const visible = jsonBlock.style.display !== "none";
  jsonBlock.style.display = visible ? "none" : "block";
  jsonToggle.innerHTML = (visible ? "&#9656; Show" : "&#9662; Hide") + " webhook body (JSON)";
});

mediaUrlInput.addEventListener("input", updatePreview);
consentCategory.addEventListener("input", updatePreview);
generalConsent.addEventListener("change", updatePreview);

// Mocked sign-in gate — no real auth, just a stand-in screen before the
// widget content is revealed. Independent of the real Bloomreach handshake
// below, which runs regardless of whether the marketer has clicked through
// this mock screen yet.
const loginScreen = document.getElementById("loginScreen");
const widgetContent = document.getElementById("widgetContent");
const loginSubmit = document.getElementById("loginSubmit");
const loginEmail = document.getElementById("loginEmail");
const loginProject = document.getElementById("loginProject");
const loginPassword = document.getElementById("loginPassword");
const signedInUser = document.getElementById("signedInUser");
const signedInProject = document.getElementById("signedInProject");

loginSubmit.addEventListener("click", () => {
  signedInUser.textContent = loginEmail.value || "demo@gupshup.io";
  signedInProject.textContent = loginProject.value || "default";
  loginScreen.style.display = "none";
  widgetContent.style.display = "grid";
  updatePreview();
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
let appOrigin = null; // captured from the first message Bloomreach sends us
let existingWidgetState = null;

function isEmbedded() {
  return window.parent && window.parent !== window;
}

function sendToParent(message) {
  if (!isEmbedded()) return;
  // Bloomreach's own docs hardcode a single origin (e.g. https://app.exponea.com)
  // for their example, but Bloomreach runs on multiple regional clusters — using
  // '*' for the handshake and then locking to event.origin afterwards (below)
  // is more robust than guessing a fixed domain. PROPOSED deviation from the
  // doc's literal example, for that reason.
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

    if (msg.webhook) {
      hydrateFromExistingWebhook(msg.webhook);
    }
    if (msg.widget_state) {
      existingWidgetState = msg.widget_state;
    }

    sendToParent({ message_type: "widget_initialized" });
  } else if (msg.message_type === "app_reject") {
    setHandshakeStatus("rejected", "Bloomreach widget API version not supported (got v" + SUPPORTED_VERSION + ")");
  } else if (msg.message_type === "app_request_state") {
    sendToParent({
      message_type: "widget_state",
      webhook: buildWebhookObject(getSelectedTemplate()),
      widget_state: { selectedTemplateId, selectedAction }
    });
  } else if (msg.message_type === "errors") {
    console.warn("Bloomreach validation errors:", msg.errors);
  }
}

// Best-effort: if Bloomreach is editing an existing node, try to re-select
// the template/action this webhook was previously configured for by
// inspecting the saved body template for a recognizable template_id.
function hydrateFromExistingWebhook(webhook) {
  try {
    const parsedBody = JSON.parse(webhook.body || "{}");
    if (parsedBody.template_id && TEMPLATES.some((t) => t.id === parsedBody.template_id)) {
      selectedTemplateId = parsedBody.template_id;
      syncDropdownTrigger();
      renderVariableFields();
    }
    if (parsedBody.action) {
      setAction(parsedBody.action);
    }
  } catch (e) {
    // Not JSON, or shape changed — fall back to defaults silently.
  }
  if (webhook.consent_category) consentCategory.value = webhook.consent_category;
  if (typeof webhook.general_consent === "boolean") generalConsent.checked = webhook.general_consent;
}

window.addEventListener("message", handleParentMessage);

// Init
populateDropdownMenu();
syncDropdownTrigger();
renderVariableFields();
setAction("send_message");
updatePreview();

if (isEmbedded()) {
  sendToParent({
    min_supported_version: SUPPORTED_VERSION,
    max_supported_version: SUPPORTED_VERSION,
    message_type: "widget_hello"
  });
} else {
  setHandshakeStatus("standalone", "Standalone preview — not embedded in Bloomreach");
}
