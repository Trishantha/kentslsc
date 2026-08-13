import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../../.env');

const envText = fs.readFileSync(envPath, 'utf-8');
for (const line of envText.split('\n')) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (match) {
    const [, key, value] = match;
    if (process.env[key] === undefined && value !== '') {
      process.env[key] = value;
    }
  }
}

const host = process.env.EMAIL_HOST;
const port = Number(process.env.EMAIL_PORT || 587);
const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASS;
const from = process.env.EMAIL_FROM;
const to = process.argv[2] || 'trishansilva@gmail.com';

if (!host || !user || !pass || !from) {
  console.error('Email is not configured. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_FROM in .env');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass }
});

try {
  await transporter.verify();
  console.log('SMTP connection verified successfully.');
} catch (err) {
  console.error('SMTP verification failed:', err.message);
  process.exit(1);
}

try {
  const info = await transporter.sendMail({
    from,
    to,
    subject: 'Kent SLSC email test',
    text: 'This is a test email from the Kent SLSC platform. If you received it, SMTP is configured correctly.',
    html: '<p>This is a test email from the Kent SLSC platform.</p><p>If you received it, SMTP is configured correctly.</p>'
  });
  console.log('Test email sent:');
  console.log('  Message ID:', info.messageId);
  console.log('  Accepted:', info.accepted);
  console.log('  Rejected:', info.rejected);
} catch (err) {
  console.error('Failed to send test email:', err.message);
  process.exit(1);
}
