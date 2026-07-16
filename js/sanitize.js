const ALLOWED_TAGS = new Set(['H4', 'P', 'BR', 'STRONG', 'EM', 'UL', 'LI']);

// Allowlist HTML sanitizer for admin-authored rich text (e.g. transport info).
// Uses a <template> element so parsing never executes scripts or loads
// resources — its content is an inert DocumentFragment.
export function sanitizeHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  stripDisallowed(template.content);
  return template.innerHTML;
}

function stripDisallowed(node) {
  [...node.childNodes].forEach(child => {
    if (child.nodeType !== Node.ELEMENT_NODE) return;

    if (!ALLOWED_TAGS.has(child.tagName)) {
      child.replaceWith(document.createTextNode(child.textContent));
      return;
    }

    [...child.attributes].forEach(attr => child.removeAttribute(attr.name));
    stripDisallowed(child);
  });
}
