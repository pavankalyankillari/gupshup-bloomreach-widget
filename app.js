// Gupshup WhatsApp Widget — iframe content only (no Bloomreach chrome).
// This is what a marketer sees embedded inside a Bloomreach campaign node
// when they add the "Gupshup" step, analogous to the Rokt widget PoC.

const TEMPLATES = [
  {
    id: "order_confirmation",
    label: "Order Confirmation",
    description: "Sent after checkout completes",
    body: "Hi {{1}}, your order #{{2}} has been confirmed! Total: {{3}}",
    hasMedia: false,
    variables: [
      { key: "1", label: "Customer Name", placeholder: "Aarav", default: "Aarav" },
      { key: "2", label: "Order ID", placeholder: "10432", default: "10432" },
      { key: "3", label: "Order Total", placeholder: "₹2,499", default: "₹2,499" }
    ]
  },
  {
    id: "cart_abandonment_reminder",
    label: "Cart Abandonment Reminder",
    description: "Active cart or payment step viewers",
    body: "Hey {{1}}, you left {{2}} item(s) in your cart. Complete your purchase before it's gone!",
    hasMedia: true,
    variables: [
      { key: "1", label: "Customer Name", placeholder: "Priya", default: "Priya" },
      { key: "2", label: "Item Count", placeholder: "3", default: "3" }
    ]
  },
  {
    id: "delivery_update",
    label: "Delivery Update",
    description: "Sent when order status changes to out-for-delivery",
    body: "Your order #{{1}} is out for delivery and will arrive by {{2}}.",
    hasMedia: false,
    variables: [
      { key: "1", label: "Order ID", placeholder: "10432", default: "10432" },
      { key: "2", label: "ETA", placeholder: "6:00 PM today", default: "6:00 PM today" }
    ]
  },
  {
    id: "product_recommendation",
    label: "Product Recommendation",
    description: "High-intent browsers, no purchase in 7 days",
    body: "{{1}}, based on your interest in {{2}}, check out our latest picks for you!",
    hasMedia: true,
    variables: [
      { key: "1", label: "Customer Name", placeholder: "Rohan", default: "Rohan" },
      { key: "2", label: "Product Category", placeholder: "running shoes", default: "running shoes" }
    ]
  }
];

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

function buildWebhookPayload(tpl) {
  return {
    customer: {
      identifier: "{{customer.whatsapp_number}}",
      bloomreach_customer_id: "{{customer.id}}"
    },
    message: {
      channel: "whatsapp",
      template_id: tpl.id,
      language: "en",
      variables: { ...currentVarValues },
      media: tpl.hasMedia ? { type: "image", url: mediaUrlInput.value || null } : null
    },
    action: {
      type: selectedAction
    },
    campaign: {
      campaign_id: "{{campaign.id}}",
      campaign_name: "{{campaign.name}}"
    },
    metadata: {
      correlation_id: "corr_" + Math.random().toString(36).slice(2, 10),
      timestamp: new Date().toISOString(),
      source: "bloomreach-gupshup-widget"
    }
  };
}

function updatePreview() {
  const tpl = getSelectedTemplate();
  previewTemplateName.textContent = tpl.label;
  jsonBlock.textContent = JSON.stringify(buildWebhookPayload(tpl), null, 2);
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

// Mocked sign-in gate — no real auth, just a stand-in screen before the
// widget content is revealed.
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
});

document.getElementById("signOutLink").addEventListener("click", (e) => {
  e.preventDefault();
  widgetContent.style.display = "none";
  loginScreen.style.display = "flex";
  loginPassword.value = "";
});

// Init
populateDropdownMenu();
syncDropdownTrigger();
renderVariableFields();
setAction("send_message");
updatePreview();
