const fs = require('fs');

let rules = fs.readFileSync('firestore.rules', 'utf8');

rules = rules.replace(
  /function isValidSetting\(data\) \{[\s\S]*?data\.keys\(\)\.hasAll\(\['recipients'\]\);\s*\}/,
  `function isValidSetting(data) {
      return (!('recipients' in data) || (data.recipients is list && (data.recipients.size() == 0 || data.recipients[0] is string))) &&
             (!('updatedAt' in data) || data.updatedAt == request.time) &&
             (!('emailjs_service_id' in data) || data.emailjs_service_id is string) &&
             (!('emailjs_template_id' in data) || data.emailjs_template_id is string) &&
             (!('emailjs_public_key' in data) || data.emailjs_public_key is string) &&
             (!('emailjs_enabled' in data) || data.emailjs_enabled is bool) &&
             (!('logoBase64' in data) || data.logoBase64 is string);
    }`
);

fs.writeFileSync('firestore.rules', rules);
console.log('Rules updated');
