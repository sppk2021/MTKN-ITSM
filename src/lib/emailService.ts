import { collection, addDoc, getDocs, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";

export interface EmailAlertLog {
  id?: string;
  timestamp: any;
  subject: string;
  body: string;
  recipients: string[];
  type: "isp_down" | "log_update";
  status: "sent" | "failed";
}

export interface EmailSettings {
  recipients: string[];
  emailjs_service_id?: string;
  emailjs_template_id?: string;
  emailjs_public_key?: string;
  emailjs_enabled?: boolean;
}

// Default emails to use if no settings are stored in Firestore yet
const DEFAULT_RECIPIENTS = [
  "sawpyaephyokyaw777@gmail.com",
  "admin@mtknitsm.com",
  "ops-manager@mtknitsm.com"
];

/**
 * Get full email settings from Firestore
 */
export async function getEmailSettings(): Promise<EmailSettings> {
  try {
    const settingsDoc = await getDoc(doc(db, "settings", "email_alerts"));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      return {
        recipients: Array.isArray(data.recipients) && data.recipients.length > 0 ? data.recipients : DEFAULT_RECIPIENTS,
        emailjs_service_id: data.emailjs_service_id || "",
        emailjs_template_id: data.emailjs_template_id || "",
        emailjs_public_key: data.emailjs_public_key || "",
        emailjs_enabled: typeof data.emailjs_enabled === "boolean" ? data.emailjs_enabled : false
      };
    }
  } catch (error) {
    console.error("Error fetching email settings:", error);
    handleFirestoreError(error, OperationType.GET, "settings/email_alerts");
  }
  return {
    recipients: DEFAULT_RECIPIENTS,
    emailjs_service_id: "",
    emailjs_template_id: "",
    emailjs_public_key: "",
    emailjs_enabled: false
  };
}

/**
 * Save complete EmailSettings to Firestore
 */
export async function saveEmailSettings(settings: EmailSettings): Promise<void> {
  const cleanRecipients = settings.recipients
    .map(email => email.trim())
    .filter(email => email.length > 0 && email.includes("@"));
  
  try {
    await setDoc(doc(db, "settings", "email_alerts"), {
      recipients: cleanRecipients,
      emailjs_service_id: settings.emailjs_service_id?.trim() || "",
      emailjs_template_id: settings.emailjs_template_id?.trim() || "",
      emailjs_public_key: settings.emailjs_public_key?.trim() || "",
      emailjs_enabled: !!settings.emailjs_enabled,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "settings/email_alerts");
  }
}

/**
 * Get the target recipient email addresses from Firestore settings (for backward compatibility)
 */
export async function getAlertRecipients(): Promise<string[]> {
  const settings = await getEmailSettings();
  return settings.recipients;
}

/**
 * Save custom recipient emails to Firestore (for backward compatibility)
 */
export async function saveAlertRecipients(recipients: string[]): Promise<void> {
  const current = await getEmailSettings();
  await saveEmailSettings({
    ...current,
    recipients
  });
}

/**
 * Generates a standard mailto link for zero-config manual dispatch from user's local mail client
 */
export function getMailtoLink(subject: string, body: string, recipients: string[]): string {
  const to = recipients.join(",");
  const formattedSubject = encodeURIComponent(subject);
  const formattedBody = encodeURIComponent(body);
  return `mailto:${to}?subject=${formattedSubject}&body=${formattedBody}`;
}

/**
 * Sends an email alert.
 * 1. Resolves active email settings and recipients.
 * 2. If EmailJS is enabled and configured, dispatches emails via EmailJS REST API.
 * 3. Logs the alert to Firestore in `email_alerts_log` for tracking.
 */
export async function sendEmailAlert(
  subject: string,
  body: string,
  type: "isp_down" | "log_update"
): Promise<EmailAlertLog> {
  const settings = await getEmailSettings();
  const recipients = settings.recipients;
  
  // Format the alert message body with professional styling
  const formattedBody = `
    [MTKN ITSM Alert System]
    Type: ${type === "isp_down" ? "🛑 CRITICAL OUTAGE" : "📝 LOG UPDATE"}
    Subject: ${subject}
    Timestamp: ${new Date().toLocaleString()}
    
    Message:
    ${body}
    
    This is an automated alert dispatched to:
    ${recipients.join(", ")}
  `;

  let status: "sent" | "failed" = "sent";
  let deliveryError = "";

  // Dispatch via EmailJS API if configured and enabled
  if (settings.emailjs_enabled && settings.emailjs_service_id && settings.emailjs_template_id && settings.emailjs_public_key) {
    try {
      const sendPromises = recipients.map(async (email) => {
        const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            service_id: settings.emailjs_service_id,
            template_id: settings.emailjs_template_id,
            user_id: settings.emailjs_public_key,
            template_params: {
              to_email: email,
              subject: subject,
              type_label: type === "isp_down" ? "🛑 CRITICAL OUTAGE" : "📝 LOG UPDATE",
              message: body,
              timestamp: new Date().toLocaleString(),
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`EmailJS responded with ${response.status}: ${errText}`);
        }
      });

      await Promise.all(sendPromises);
      console.log(`[EmailJS Alerts Dispatched successfully to ${recipients.length} recipients]`);
    } catch (err: any) {
      console.error("Failed to send email via EmailJS:", err);
      status = "failed";
      deliveryError = err?.message || String(err);
    }
  }

  // Log in Firestore
  const alertLog: Omit<EmailAlertLog, "id"> = {
    timestamp: new Date().toISOString(),
    subject,
    body: deliveryError ? `${formattedBody}\n\n[Delivery Error]: ${deliveryError}` : formattedBody,
    recipients,
    type,
    status
  };

  try {
    const docRef = await addDoc(collection(db, "email_alerts_log"), {
      ...alertLog,
      createdAt: serverTimestamp()
    });
    
    return { id: docRef.id, ...alertLog };
  } catch (error) {
    console.error("Failed to log or send email alert:", error);
    handleFirestoreError(error, OperationType.CREATE, "email_alerts_log");
    return { ...alertLog, status: "failed" };
  }
}
